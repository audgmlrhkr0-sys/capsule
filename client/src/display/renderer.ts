import type {
  CapsuleColor,
  CapsuleState,
  PublicGameState,
} from '@capsule-claw/shared';

const WIDTH = 1200;
const HEIGHT = 620;
const CAPSULE_COLORS: Record<CapsuleColor, [string, string]> = {
  coral: ['#ff6b6b', '#d83e5c'],
  gold: ['#ffd166', '#e89c2f'],
  mint: ['#5de2bd', '#27aa91'],
  sky: ['#63c7ff', '#378bd8'],
  violet: ['#ae85ff', '#704fc5'],
  pink: ['#ff8fc7', '#dc579c'],
};
const CLAW_COLORS = ['#ff5b67', '#51b9ff', '#ffc94d'];

export function interpolateState(
  previous: PublicGameState | null,
  current: PublicGameState,
  alpha: number,
): PublicGameState {
  if (!previous || previous.roomCode !== current.roomCode) {
    return current;
  }

  const amount = Math.max(0, Math.min(1, alpha));
  const previousById = new Map(previous.capsules.map((capsule) => [capsule.id, capsule]));
  return {
    ...current,
    serverTime: lerp(previous.serverTime, current.serverTime, amount),
    capsules: current.capsules.map((capsule) => {
      const old = previousById.get(capsule.id);
      return old ? interpolateCapsule(old, capsule, amount) : capsule;
    }),
    claws: current.claws.map((claw, index) => {
      const old = previous.claws[index];
      return old
        ? {
            ...claw,
            x: lerp(old.x, claw.x, amount),
            z: lerp(old.z, claw.z, amount),
            height: lerp(old.height, claw.height, amount),
          }
        : claw;
    }),
  };
}

export function renderMachine(
  context: CanvasRenderingContext2D,
  state: PublicGameState | null,
  width: number,
  height: number,
  pixelRatio: number,
): void {
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.save();
  context.scale(width / WIDTH, height / HEIGHT);

  const backdrop = context.createLinearGradient(0, 0, 0, HEIGHT);
  backdrop.addColorStop(0, '#10172a');
  backdrop.addColorStop(1, '#07101c');
  context.fillStyle = backdrop;
  roundedRect(context, 8, 8, WIDTH - 16, HEIGHT - 16, 34);
  context.fill();

  drawMachineInterior(context);
  if (state) {
    drawClaws(context, state);
    drawCapsules(context, state.capsules);
  }
  drawAcrylic(context);
  context.restore();
}

function drawMachineInterior(context: CanvasRenderingContext2D): void {
  const interior = context.createLinearGradient(0, 40, 0, 590);
  interior.addColorStop(0, '#263452');
  interior.addColorStop(0.56, '#152641');
  interior.addColorStop(1, '#0d1829');
  context.fillStyle = interior;
  roundedRect(context, 35, 34, 1130, 550, 26);
  context.fill();

  context.save();
  context.globalAlpha = 0.2;
  context.strokeStyle = '#a8d8ff';
  context.lineWidth = 1;
  for (let y = 100; y < 560; y += 70) {
    context.beginPath();
    context.moveTo(50, y);
    context.lineTo(1150, y);
    context.stroke();
  }
  context.restore();

  const floor = context.createLinearGradient(0, 530, 0, 600);
  floor.addColorStop(0, '#152337');
  floor.addColorStop(1, '#050a12');
  context.fillStyle = floor;
  context.beginPath();
  context.moveTo(35, 518);
  context.lineTo(1165, 518);
  context.lineTo(1115, 584);
  context.lineTo(85, 584);
  context.closePath();
  context.fill();
}

function drawClaws(context: CanvasRenderingContext2D, state: PublicGameState): void {
  context.lineCap = 'round';
  context.strokeStyle = '#d8eaff';
  context.lineWidth = 8;
  context.shadowColor = '#b8d9ff';
  context.shadowBlur = 10;
  context.beginPath();
  context.moveTo(80, 72);
  context.lineTo(1120, 72);
  context.stroke();
  context.shadowBlur = 0;

  state.claws.forEach((claw, index) => {
    const color = CLAW_COLORS[index]!;
    const x = claw.x;
    const headY = 138 + claw.height;
    context.strokeStyle = color;
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(x, 72);
    context.lineTo(x, headY - 18);
    context.stroke();

    context.fillStyle = color;
    context.shadowColor = color;
    context.shadowBlur = 15;
    roundedRect(context, x - 30, headY - 20, 60, 28, 12);
    context.fill();
    context.shadowBlur = 0;

    context.strokeStyle = '#dce8f7';
    context.lineWidth = 6;
    context.beginPath();
    context.moveTo(x - 19, headY + 4);
    context.quadraticCurveTo(x - 35, headY + 36, x - 43, headY + 55);
    context.moveTo(x + 19, headY + 4);
    context.quadraticCurveTo(x + 35, headY + 36, x + 43, headY + 55);
    context.stroke();
  });
}

function drawCapsules(context: CanvasRenderingContext2D, capsules: CapsuleState[]): void {
  const sorted = [...capsules].sort((left, right) => left.z - right.z);
  for (const capsule of sorted) {
    const depthScale = 0.84 + capsule.z * 0.18;
    const x = WIDTH / 2 + (capsule.x - WIDTH / 2) * (0.94 + capsule.z * 0.06);
    const y = capsule.y;
    const radius = capsule.radius * depthScale;
    const [top, bottom] = CAPSULE_COLORS[capsule.color];

    context.save();
    context.translate(x, y);
    context.rotate(capsule.angle);
    context.shadowColor = `rgba(0, 0, 0, ${0.28 + capsule.z * 0.22})`;
    context.shadowBlur = 13;
    context.shadowOffsetY = 9;

    const fill = context.createLinearGradient(0, -radius, 0, radius);
    fill.addColorStop(0, top);
    fill.addColorStop(0.49, top);
    fill.addColorStop(0.5, bottom);
    fill.addColorStop(1, bottom);
    context.fillStyle = fill;
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fill();

    context.shadowColor = 'transparent';
    context.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(0, 0, radius - 1, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    context.beginPath();
    context.moveTo(-radius + 4, 0);
    context.lineTo(radius - 4, 0);
    context.stroke();

    context.fillStyle = 'rgba(255, 255, 255, 0.52)';
    context.beginPath();
    context.ellipse(-radius * 0.3, -radius * 0.34, radius * 0.18, radius * 0.1, -0.7, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}

function drawAcrylic(context: CanvasRenderingContext2D): void {
  context.save();
  context.strokeStyle = 'rgba(196, 229, 255, 0.65)';
  context.lineWidth = 5;
  roundedRect(context, 32, 31, 1136, 556, 29);
  context.stroke();

  const shine = context.createLinearGradient(50, 0, 420, 0);
  shine.addColorStop(0, 'rgba(255,255,255,0.24)');
  shine.addColorStop(0.4, 'rgba(255,255,255,0.04)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = shine;
  context.beginPath();
  context.moveTo(60, 50);
  context.lineTo(330, 50);
  context.lineTo(210, 570);
  context.lineTo(55, 570);
  context.closePath();
  context.fill();
  context.restore();
}

function interpolateCapsule(
  previous: CapsuleState,
  current: CapsuleState,
  alpha: number,
): CapsuleState {
  return {
    ...current,
    x: lerp(previous.x, current.x, alpha),
    y: lerp(previous.y, current.y, alpha),
    angle: lerp(previous.angle, current.angle, alpha),
    z: lerp(previous.z, current.z, alpha),
  };
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}
