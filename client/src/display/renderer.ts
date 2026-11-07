import type {
  CapsuleColor,
  CapsuleState,
  ClawState,
  PublicGameState,
} from '@capsule-claw/shared';

const WORLD_WIDTH = 1200;
const WORLD_HEIGHT = 620;
const WORLD_DEPTH = 620;
// Must match CHUTE_LEFT / OUTLET_Z in server/src/game/constants.ts.
const CHUTE_LEFT = 1030;
const CHUTE_FRONT_DEPTH = 420;
const CHUTE_TOP = 350;
const RAIL_Y = 18;
const CLAW_HEAD_OFFSET = 138;
const BACK_SCALE_RATIO = 0.72;
const TURN_SECONDS = 30;

const GREEN_DEEP = '#2c4c17';

const CAPSULE_COLORS: Record<CapsuleColor, string> = {
  coral: '#f7889a',
  gold: '#fff1dc',
  mint: '#b2de85',
  sky: '#ffc2c5',
  violet: '#6d9e45',
  pink: '#e6f5d2',
};
const CLAW_COLORS = ['#ff5b67', '#4aa8f0', '#ffc94d'];
const IDLE_CLAW_COLOR = '#9fc77a';

type BodyStyle = 'translucent' | 'matte' | 'pearl';

interface Room {
  frontScale: number;
  backScale: number;
  frontLeft: number;
  backLeft: number;
  frontFloor: number;
  backFloor: number;
}

interface Projected {
  x: number;
  y: number;
  scale: number;
}

type DrawItem =
  | { kind: 'body'; depth: number; body: CapsuleState; style: BodyStyle }
  | { kind: 'claw'; depth: number; claw: ClawState; index: number; occupied: boolean };

const noisePatterns = new WeakMap<CanvasRenderingContext2D, CanvasPattern | null>();

export function interpolateState(
  previous: PublicGameState | null,
  current: PublicGameState,
  alpha: number,
): PublicGameState {
  if (!previous || previous.roomCode !== current.roomCode) {
    return current;
  }

  const amount = Math.max(0, Math.min(1, alpha));
  return {
    ...current,
    serverTime: lerp(previous.serverTime, current.serverTime, amount),
    capsules: interpolateBodies(previous.capsules, current.capsules, amount),
    balls: interpolateBodies(previous.balls, current.balls, amount),
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
  const room = createRoom(width, height);

  drawRoom(context, room, width, height);
  if (state) {
    drawContents(context, room, state);
  }
  drawChute(context, room);
  drawGlass(context, width, height);
}

function createRoom(width: number, height: number): Room {
  const frontScale = Math.min(width / WORLD_WIDTH, (height * 0.96) / WORLD_HEIGHT);
  const backScale = frontScale * BACK_SCALE_RATIO;
  const frontFloor = height;
  return {
    frontScale,
    backScale,
    frontLeft: (width - WORLD_WIDTH * frontScale) / 2,
    backLeft: (width - WORLD_WIDTH * backScale) / 2,
    frontFloor,
    backFloor: frontFloor - height * 0.15,
  };
}

function project(room: Room, x: number, y: number, z: number): Projected {
  const depth = clamp01(z / WORLD_DEPTH);
  const scale = lerp(room.backScale, room.frontScale, depth);
  const left = lerp(room.backLeft, room.frontLeft, depth);
  const floor = lerp(room.backFloor, room.frontFloor, depth);
  return { x: left + x * scale, y: floor - (WORLD_HEIGHT - y) * scale, scale };
}

function drawRoom(
  context: CanvasRenderingContext2D,
  room: Room,
  width: number,
  height: number,
): void {
  const backTopLeft = project(room, 0, 0, 0);
  const backBottomRight = project(room, WORLD_WIDTH, WORLD_HEIGHT, 0);
  const frontTopLeft = project(room, 0, 0, WORLD_DEPTH);
  const frontBottomRight = project(room, WORLD_WIDTH, WORLD_HEIGHT, WORLD_DEPTH);
  const bl = backTopLeft.x;
  const bt = backTopLeft.y;
  const br = backBottomRight.x;
  const bb = backBottomRight.y;
  const fl = frontTopLeft.x;
  const ft = frontTopLeft.y;
  const fr = frontBottomRight.x;
  const fb = frontBottomRight.y;

  context.fillStyle = '#e59aa1';
  context.fillRect(0, 0, width, height);

  const ceiling = context.createLinearGradient(0, 0, 0, bt);
  ceiling.addColorStop(0, '#d98890');
  ceiling.addColorStop(1, '#efb0b5');
  context.fillStyle = ceiling;
  context.fillRect(0, 0, width, Math.max(ft, 0));
  polygon(context, [[fl, ft], [fr, ft], [br, bt], [bl, bt]]);
  context.fill();

  const leftWall = context.createLinearGradient(fl, 0, bl, 0);
  leftWall.addColorStop(0, '#f0a3aa');
  leftWall.addColorStop(1, '#f8bdc1');
  context.fillStyle = leftWall;
  polygon(context, [[bl, bt], [bl, bb], [fl, fb], [fl, ft]]);
  context.fill();

  const rightWall = context.createLinearGradient(fr, 0, br, 0);
  rightWall.addColorStop(0, '#eea0a7');
  rightWall.addColorStop(1, '#f7babf');
  context.fillStyle = rightWall;
  polygon(context, [[br, bt], [fr, ft], [fr, fb], [br, bb]]);
  context.fill();

  const backWall = context.createLinearGradient(0, bt, 0, bb);
  backWall.addColorStop(0, '#ffd9db');
  backWall.addColorStop(1, '#ffc2c5');
  context.fillStyle = backWall;
  context.fillRect(bl, bt, br - bl, bb - bt);

  const pattern = getNoisePattern(context);
  if (pattern) {
    context.save();
    context.globalAlpha = 0.55;
    context.fillStyle = pattern;
    polygon(context, [[fl, ft], [fr, ft], [fr, fb], [fl, fb]]);
    context.fill();
    context.restore();
  }

  drawFormTies(context, bl, bt, br, bb);

  const floor = context.createLinearGradient(0, bb, 0, fb);
  floor.addColorStop(0, '#e8979e');
  floor.addColorStop(1, '#d97f88');
  context.fillStyle = floor;
  polygon(context, [[bl, bb], [br, bb], [fr, fb], [fl, fb]]);
  context.fill();

  context.save();
  context.strokeStyle = 'rgb(120 40 52 / 14%)';
  context.lineWidth = 2;
  for (const [x1, y1, x2, y2] of [
    [bl, bt, fl, ft],
    [br, bt, fr, ft],
    [bl, bb, fl, fb],
    [br, bb, fr, fb],
  ] as const) {
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
  }
  context.strokeRect(bl, bt, br - bl, bb - bt);
  context.restore();

  const spotlight = context.createRadialGradient(
    width / 2,
    bt,
    0,
    width / 2,
    bt,
    (br - bl) * 0.6,
  );
  spotlight.addColorStop(0, 'rgb(255 255 255 / 34%)');
  spotlight.addColorStop(1, 'rgb(255 255 255 / 0%)');
  context.fillStyle = spotlight;
  context.fillRect(0, 0, width, height);

  context.save();
  context.fillStyle = 'rgb(255 250 250 / 92%)';
  context.shadowColor = 'rgb(255 255 255 / 90%)';
  context.shadowBlur = 18;
  context.fillRect(fl + 24, Math.max(ft, 0) + 4, fr - fl - 48, 5);
  context.restore();

  for (const x of [0, WORLD_WIDTH]) {
    const back = project(room, x, RAIL_Y, 0);
    const front = project(room, x, RAIL_Y, WORLD_DEPTH);
    metalLine(context, back.x, back.y, front.x, front.y, 7 * back.scale, 9 * front.scale);
  }
}

function drawFormTies(
  context: CanvasRenderingContext2D,
  left: number,
  top: number,
  right: number,
  bottom: number,
): void {
  const columns = 6;
  const rows = 4;
  const radius = Math.max(2, (right - left) * 0.0045);
  context.save();
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      const x = left + ((column + 0.5) / columns) * (right - left);
      const y = top + ((row + 0.5) / rows) * (bottom - top);
      context.fillStyle = 'rgb(160 70 82 / 28%)';
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgb(255 255 255 / 45%)';
      context.beginPath();
      context.arc(x + radius * 0.3, y + radius * 0.45, radius * 0.75, 0, Math.PI);
      context.fill();
    }
  }
  context.strokeStyle = 'rgb(170 80 92 / 10%)';
  context.lineWidth = 1.5;
  for (let column = 1; column < 3; column += 1) {
    const x = left + (column / 3) * (right - left);
    context.beginPath();
    context.moveTo(x, top);
    context.lineTo(x, bottom);
    context.stroke();
  }
  context.restore();
}

function drawContents(
  context: CanvasRenderingContext2D,
  room: Room,
  state: PublicGameState,
): void {
  const items: DrawItem[] = [
    ...state.balls.map((body): DrawItem => ({
      kind: 'body',
      depth: body.z,
      body,
      style: ballStyle(body.id),
    })),
    ...state.capsules.map((body): DrawItem => ({
      kind: 'body',
      depth: body.z,
      body,
      style: 'translucent',
    })),
  ];

  const idlePositions = new Set<string>();
  state.claws.forEach((claw, index) => {
    const occupied = state.players[index] != null;
    if (!occupied && claw.phase === 'waiting') {
      const key = `${Math.round(claw.x)}:${Math.round(claw.z)}:${Math.round(claw.height)}`;
      if (idlePositions.has(key)) return;
      idlePositions.add(key);
    }
    items.push({ kind: 'claw', depth: claw.z + 0.01, claw, index, occupied });
  });

  items.sort((left, right) => left.depth - right.depth);
  for (const item of items) {
    if (item.kind === 'body') {
      drawBody(context, room, item.body, item.style);
    } else {
      drawClaw(context, room, state, item.claw, item.index, item.occupied);
    }
  }
}

function drawClaw(
  context: CanvasRenderingContext2D,
  room: Room,
  state: PublicGameState,
  claw: ClawState,
  index: number,
  occupied: boolean,
): void {
  const color = occupied ? CLAW_COLORS[index]! : IDLE_CLAW_COLOR;
  const railLeft = project(room, 0, RAIL_Y, claw.z);
  const railRight = project(room, WORLD_WIDTH, RAIL_Y, claw.z);
  const scale = railLeft.scale;
  metalLine(context, railLeft.x, railLeft.y, railRight.x, railRight.y, 8 * scale, 8 * scale);

  const carriage = project(room, claw.x, RAIL_Y, claw.z);
  context.save();
  context.translate(carriage.x, carriage.y);
  context.scale(scale, scale);
  const carriageFill = context.createLinearGradient(0, -10, 0, 12);
  carriageFill.addColorStop(0, '#5b6266');
  carriageFill.addColorStop(1, '#2f3436');
  context.fillStyle = carriageFill;
  roundedRect(context, -26, -10, 52, 22, 5);
  context.fill();
  context.fillStyle = color;
  context.fillRect(-26, 6, 52, 4);
  context.restore();

  const headY = CLAW_HEAD_OFFSET + claw.height;
  const head = project(room, claw.x, headY, claw.z);
  context.save();
  context.translate(head.x, head.y);
  context.scale(scale, scale);

  const cableTop = RAIL_Y + 10 - headY;
  context.strokeStyle = '#b9bfc3';
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(0, cableTop);
  context.lineTo(0, -62);
  context.stroke();

  context.fillStyle = '#41474a';
  roundedRect(context, -11, -66, 22, 9, 3);
  context.fill();

  for (let segment = 0; segment < 6; segment += 1) {
    const top = -57 + segment * 6.4;
    const ring = context.createLinearGradient(-15, 0, 15, 0);
    ring.addColorStop(0, shade(color, -0.25));
    ring.addColorStop(0.35, shade(color, 0.35));
    ring.addColorStop(1, shade(color, -0.3));
    context.fillStyle = ring;
    roundedRect(context, -15, top, 30, 5.6, 2.8);
    context.fill();
  }

  const hub = context.createLinearGradient(-18, 0, 18, 0);
  hub.addColorStop(0, '#8c9296');
  hub.addColorStop(0.4, '#f5f6f7');
  hub.addColorStop(1, '#7b8185');
  context.fillStyle = hub;
  roundedRect(context, -18, -19, 36, 19, 5);
  context.fill();
  context.strokeStyle = '#555c60';
  context.lineWidth = 1.5;
  context.stroke();

  const open = clawOpening(claw);
  prong(context, (path) => {
    path.moveTo(0, -2);
    path.quadraticCurveTo(open * 0.18, 30, 0, 62);
  }, 0.75);
  prong(context, (path) => {
    path.moveTo(-12, -2);
    path.quadraticCurveTo(-open - 10, 16, -open, 44);
    path.quadraticCurveTo(-open + 5, 60, -open * 0.45, 70);
  });
  prong(context, (path) => {
    path.moveTo(12, -2);
    path.quadraticCurveTo(open + 10, 16, open, 44);
    path.quadraticCurveTo(open - 5, 60, open * 0.45, 70);
  });

  const endsAt = state.players[index]?.turnEndsAt;
  if (occupied && claw.phase === 'aiming' && endsAt) {
    const remaining = Math.max(0, (endsAt - state.serverTime) / 1000);
    drawTimerRing(context, open + 46, -34, remaining, color);
  }
  context.restore();
}

function clawOpening(claw: ClawState): number {
  if (claw.phase === 'dropping') return 48;
  if (claw.phase === 'lifting' || claw.phase === 'dispensing') {
    return claw.heldCapsuleId ? 50 : 20;
  }
  return 34;
}

function prong(
  context: CanvasRenderingContext2D,
  trace: (path: CanvasRenderingContext2D) => void,
  alpha = 1,
): void {
  context.save();
  context.globalAlpha = alpha;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const [stroke, width] of [
    ['#40464a', 9],
    ['#d9dde0', 6],
    ['rgb(255 255 255 / 80%)', 2],
  ] as const) {
    context.strokeStyle = stroke;
    context.lineWidth = width;
    context.beginPath();
    trace(context);
    context.stroke();
  }
  context.restore();
}

function drawTimerRing(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  remaining: number,
  color: string,
): void {
  const radius = 24;
  context.save();
  context.fillStyle = 'rgb(255 255 255 / 82%)';
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = 'rgb(63 107 34 / 18%)';
  context.lineWidth = 5;
  context.stroke();
  context.strokeStyle = color;
  context.lineCap = 'round';
  context.beginPath();
  context.arc(
    x,
    y,
    radius,
    -Math.PI / 2,
    -Math.PI / 2 + Math.PI * 2 * clamp01(remaining / TURN_SECONDS),
  );
  context.stroke();
  context.fillStyle = GREEN_DEEP;
  context.font = '800 20px Pretendard, "Noto Sans KR", "Malgun Gothic", sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(Math.ceil(remaining)), x, y + 1);
  context.restore();
}

function drawBody(
  context: CanvasRenderingContext2D,
  room: Room,
  body: CapsuleState,
  style: BodyStyle,
): void {
  const position = project(room, body.x, body.y, body.z);
  const radius = body.radius * position.scale;
  const color = CAPSULE_COLORS[body.color];
  const depthShade = 0.8 + clamp01(body.z / WORLD_DEPTH) * 0.2;

  context.save();
  context.translate(position.x, position.y);

  const shadow = context.createRadialGradient(
    radius * 0.12,
    radius * 0.2,
    radius * 0.4,
    radius * 0.12,
    radius * 0.2,
    radius * 1.12,
  );
  shadow.addColorStop(0, 'rgb(110 30 44 / 30%)');
  shadow.addColorStop(1, 'rgb(110 30 44 / 0%)');
  context.fillStyle = shadow;
  context.beginPath();
  context.arc(radius * 0.12, radius * 0.2, radius * 1.12, 0, Math.PI * 2);
  context.fill();

  if (style === 'translucent') {
    drawTranslucentCapsule(context, radius, body.angle, color);
  } else if (style === 'pearl') {
    drawPearlBall(context, radius, body.angle, color);
  } else {
    drawMatteBall(context, radius, color);
  }

  if (depthShade < 1) {
    context.fillStyle = `rgb(120 40 55 / ${((1 - depthShade) * 0.9).toFixed(3)})`;
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawMatteBall(context: CanvasRenderingContext2D, radius: number, color: string): void {
  const body = context.createRadialGradient(
    -radius * 0.35,
    -radius * 0.42,
    radius * 0.05,
    0,
    0,
    radius * 1.05,
  );
  body.addColorStop(0, shade(color, 0.5));
  body.addColorStop(0.5, color);
  body.addColorStop(1, shade(color, -0.3));
  context.fillStyle = body;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = 'rgb(255 255 255 / 30%)';
  context.beginPath();
  context.ellipse(-radius * 0.34, -radius * 0.44, radius * 0.3, radius * 0.18, -0.6, 0, Math.PI * 2);
  context.fill();
}

function drawTranslucentCapsule(
  context: CanvasRenderingContext2D,
  radius: number,
  angle: number,
  color: string,
): void {
  context.save();
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.clip();

  context.fillStyle = 'rgb(255 255 255 / 26%)';
  context.fillRect(-radius, -radius, radius * 2, radius * 2);

  context.rotate(angle);
  context.fillStyle = withAlpha(shade(color, -0.45), 0.4);
  context.beginPath();
  context.ellipse(radius * 0.08, radius * 0.32, radius * 0.42, radius * 0.26, 0.3, 0, Math.PI * 2);
  context.fill();

  const shell = context.createLinearGradient(0, -radius, 0, 0);
  shell.addColorStop(0, withAlpha(shade(color, 0.15), 0.82));
  shell.addColorStop(1, withAlpha(color, 0.62));
  context.fillStyle = shell;
  context.fillRect(-radius, -radius, radius * 2, radius);

  context.fillStyle = 'rgb(255 255 255 / 55%)';
  context.fillRect(-radius, -radius * 0.07, radius * 2, radius * 0.14);
  context.fillStyle = withAlpha(shade(color, -0.35), 0.45);
  context.fillRect(-radius, radius * 0.07, radius * 2, radius * 0.03);
  context.rotate(-angle);

  const rim = context.createRadialGradient(0, 0, radius * 0.62, 0, 0, radius);
  rim.addColorStop(0, 'rgb(255 255 255 / 0%)');
  rim.addColorStop(1, withAlpha(shade(color, -0.4), 0.42));
  context.fillStyle = rim;
  context.fillRect(-radius, -radius, radius * 2, radius * 2);
  context.restore();

  context.strokeStyle = 'rgb(255 255 255 / 70%)';
  context.lineWidth = Math.max(1, radius * 0.05);
  context.beginPath();
  context.arc(0, 0, radius - context.lineWidth / 2, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = 'rgb(255 255 255 / 62%)';
  context.beginPath();
  context.ellipse(-radius * 0.36, -radius * 0.46, radius * 0.32, radius * 0.14, -0.65, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = 'rgb(255 255 255 / 90%)';
  context.beginPath();
  context.arc(radius * 0.42, radius * 0.38, radius * 0.07, 0, Math.PI * 2);
  context.fill();
}

function drawPearlBall(
  context: CanvasRenderingContext2D,
  radius: number,
  angle: number,
  color: string,
): void {
  const tint = mix('#ffffff', color, 0.22);
  const body = context.createRadialGradient(
    -radius * 0.35,
    -radius * 0.4,
    radius * 0.05,
    0,
    0,
    radius * 1.05,
  );
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.45, tint);
  body.addColorStop(1, shade(mix('#b9b0b4', color, 0.2), -0.1));
  context.fillStyle = body;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();

  context.save();
  context.rotate(angle);
  context.strokeStyle = 'rgb(110 96 104 / 28%)';
  context.lineWidth = Math.max(1, radius * 0.045);
  for (const ratio of [0.22, 0.55, 0.85]) {
    context.beginPath();
    context.ellipse(0, 0, radius * ratio, radius * 0.98, 0, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();

  context.fillStyle = 'rgb(255 255 255 / 70%)';
  context.beginPath();
  context.ellipse(-radius * 0.34, -radius * 0.44, radius * 0.26, radius * 0.13, -0.6, 0, Math.PI * 2);
  context.fill();
}

function drawChute(context: CanvasRenderingContext2D, room: Room): void {
  const front = [
    project(room, CHUTE_LEFT, CHUTE_TOP, WORLD_DEPTH),
    project(room, WORLD_WIDTH, CHUTE_TOP, WORLD_DEPTH),
    project(room, WORLD_WIDTH, WORLD_HEIGHT, WORLD_DEPTH),
    project(room, CHUTE_LEFT, WORLD_HEIGHT, WORLD_DEPTH),
  ];
  const backTopLeft = project(room, CHUTE_LEFT, CHUTE_TOP, CHUTE_FRONT_DEPTH);
  const backTopRight = project(room, WORLD_WIDTH, CHUTE_TOP, CHUTE_FRONT_DEPTH);
  const backBottomLeft = project(room, CHUTE_LEFT, WORLD_HEIGHT, CHUTE_FRONT_DEPTH);

  context.save();
  context.fillStyle = 'rgb(255 255 255 / 22%)';
  polygon(context, [
    [backTopLeft.x, backTopLeft.y],
    [backTopRight.x, backTopRight.y],
    [front[1]!.x, front[1]!.y],
    [front[0]!.x, front[0]!.y],
  ]);
  context.fill();

  context.fillStyle = 'rgb(255 255 255 / 16%)';
  polygon(context, [
    [backTopLeft.x, backTopLeft.y],
    [front[0]!.x, front[0]!.y],
    [front[3]!.x, front[3]!.y],
    [backBottomLeft.x, backBottomLeft.y],
  ]);
  context.fill();

  const glass = context.createLinearGradient(front[0]!.x, 0, front[1]!.x, 0);
  glass.addColorStop(0, 'rgb(255 255 255 / 34%)');
  glass.addColorStop(1, 'rgb(255 255 255 / 14%)');
  context.fillStyle = glass;
  polygon(context, front.map(({ x, y }) => [x, y] as const));
  context.fill();
  context.restore();
}

function drawGlass(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.save();
  context.fillStyle = 'rgb(255 255 255 / 9%)';
  polygon(context, [
    [width * 0.06, 0],
    [width * 0.2, 0],
    [width * 0.08, height],
    [-width * 0.06, height],
  ]);
  context.fill();
  context.fillStyle = 'rgb(255 255 255 / 5%)';
  polygon(context, [
    [width * 0.24, 0],
    [width * 0.27, 0],
    [width * 0.15, height],
    [width * 0.12, height],
  ]);
  context.fill();

  const vignette = context.createRadialGradient(
    width / 2,
    height * 0.45,
    Math.min(width, height) * 0.45,
    width / 2,
    height * 0.45,
    Math.max(width, height) * 0.75,
  );
  vignette.addColorStop(0, 'rgb(44 76 23 / 0%)');
  vignette.addColorStop(1, 'rgb(44 76 23 / 22%)');
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);
  context.restore();
}

function metalLine(
  context: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  startWidth: number,
  endWidth: number,
): void {
  const width = (startWidth + endWidth) / 2;
  context.save();
  context.lineCap = 'round';
  context.strokeStyle = '#596064';
  context.lineWidth = width + 2;
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
  context.strokeStyle = '#e2e5e7';
  context.lineWidth = width;
  context.stroke();
  context.strokeStyle = 'rgb(255 255 255 / 85%)';
  context.lineWidth = Math.max(1, width * 0.25);
  context.beginPath();
  context.moveTo(x1, y1 - width * 0.2);
  context.lineTo(x2, y2 - width * 0.2);
  context.stroke();
  context.restore();
}

function ballStyle(id: string): BodyStyle {
  const number = Number(id.replace(/\D/g, '')) || 0;
  return number % 4 === 0 ? 'pearl' : 'matte';
}

function getNoisePattern(context: CanvasRenderingContext2D): CanvasPattern | null {
  if (noisePatterns.has(context)) {
    return noisePatterns.get(context) ?? null;
  }
  const tile = document.createElement('canvas');
  tile.width = 160;
  tile.height = 160;
  const tileContext = tile.getContext('2d');
  let pattern: CanvasPattern | null = null;
  if (tileContext) {
    for (let dot = 0; dot < 900; dot += 1) {
      const light = Math.random() > 0.5;
      tileContext.fillStyle = light
        ? `rgb(255 255 255 / ${(Math.random() * 0.22).toFixed(3)})`
        : `rgb(150 60 72 / ${(Math.random() * 0.14).toFixed(3)})`;
      tileContext.fillRect(Math.random() * 160, Math.random() * 160, 1.6, 1.6);
    }
    pattern = context.createPattern(tile, 'repeat');
  }
  noisePatterns.set(context, pattern);
  return pattern;
}

function interpolateBodies(
  previous: CapsuleState[],
  current: CapsuleState[],
  alpha: number,
): CapsuleState[] {
  const previousById = new Map(previous.map((body) => [body.id, body]));
  return current.map((body) => {
    const old = previousById.get(body.id);
    return old
      ? {
          ...body,
          x: lerp(old.x, body.x, alpha),
          y: lerp(old.y, body.y, alpha),
          angle: lerp(old.angle, body.angle, alpha),
          z: lerp(old.z, body.z, alpha),
        }
      : body;
  });
}

function polygon(
  context: CanvasRenderingContext2D,
  points: ReadonlyArray<readonly [number, number]>,
): void {
  context.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
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

function parseHex(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex([red, green, blue]: [number, number, number]): string {
  return `#${[red, green, blue]
    .map((channel) => Math.round(Math.max(0, Math.min(255, channel))).toString(16).padStart(2, '0'))
    .join('')}`;
}

function mix(from: string, to: string, amount: number): string {
  const start = parseHex(from);
  const end = parseHex(to);
  return toHex([
    lerp(start[0], end[0], amount),
    lerp(start[1], end[1], amount),
    lerp(start[2], end[2], amount),
  ]);
}

function shade(color: string, amount: number): string {
  return amount >= 0 ? mix(color, '#ffffff', amount) : mix(color, '#2a1a1e', -amount);
}

function withAlpha(color: string, alpha: number): string {
  const [red, green, blue] = parseHex(color);
  return `rgb(${red} ${green} ${blue} / ${alpha})`;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}
