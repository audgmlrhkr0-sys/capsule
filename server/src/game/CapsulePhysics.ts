import type { CapsuleColor, CapsuleState } from '@capsule-claw/shared';
import Matter from 'matter-js';
import {
  CAPSULE_COLORS,
  CAPSULE_RADIUS,
  INITIAL_CAPSULE_COUNT,
  PHYSICS_HEIGHT,
  PHYSICS_WIDTH,
} from './constants.js';

interface CapsuleBody {
  id: string;
  body: Matter.Body;
  color: CapsuleColor;
  z: number;
  radius: number;
}

const WALL_THICKNESS = 80;

export class CapsulePhysics {
  private readonly engine = Matter.Engine.create({
    gravity: { x: 0, y: 1, scale: 0.0012 },
  });
  private readonly capsules = new Map<string, CapsuleBody>();
  private nextId = 1;

  constructor(
    private readonly random: () => number = Math.random,
    initialCount = INITIAL_CAPSULE_COUNT,
  ) {
    const walls = [
      Matter.Bodies.rectangle(
        -WALL_THICKNESS / 2,
        PHYSICS_HEIGHT / 2,
        WALL_THICKNESS,
        PHYSICS_HEIGHT * 2,
        { isStatic: true },
      ),
      Matter.Bodies.rectangle(
        PHYSICS_WIDTH + WALL_THICKNESS / 2,
        PHYSICS_HEIGHT / 2,
        WALL_THICKNESS,
        PHYSICS_HEIGHT * 2,
        { isStatic: true },
      ),
      Matter.Bodies.rectangle(
        PHYSICS_WIDTH / 2,
        PHYSICS_HEIGHT + WALL_THICKNESS / 2,
        PHYSICS_WIDTH + WALL_THICKNESS * 2,
        WALL_THICKNESS,
        { isStatic: true },
      ),
    ];
    Matter.Composite.add(this.engine.world, walls);
    this.refill(initialCount);
  }

  tick(deltaMs: number): void {
    Matter.Engine.update(this.engine, deltaMs);
  }

  refill(targetCount = INITIAL_CAPSULE_COUNT): void {
    while (this.capsules.size < targetCount) {
      this.addCapsule();
    }
  }

  removeCapsule(id: string): boolean {
    const capsule = this.capsules.get(id);
    if (!capsule) {
      return false;
    }
    Matter.Composite.remove(this.engine.world, capsule.body);
    return this.capsules.delete(id);
  }

  serialize(): CapsuleState[] {
    return [...this.capsules.values()]
      .sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }))
      .map(({ id, body, color, z, radius }) => ({
        id,
        x: round(body.position.x),
        y: round(body.position.y),
        angle: round(body.angle),
        z,
        radius,
        color,
      }));
  }

  get count(): number {
    return this.capsules.size;
  }

  private addCapsule(): void {
    const index = this.nextId - 1;
    const column = index % 9;
    const row = Math.floor(index / 9);
    const radius = CAPSULE_RADIUS;
    const x = 92 + column * 127 + (this.random() - 0.5) * 12;
    const y = 65 + row * 88 + (this.random() - 0.5) * 8;
    const body = Matter.Bodies.circle(x, y, radius, {
      restitution: 0.32,
      friction: 0.18,
      frictionAir: 0.006,
      density: 0.0018,
      label: 'capsule',
    });
    const id = `capsule-${this.nextId++}`;
    const color = CAPSULE_COLORS[index % CAPSULE_COLORS.length]!;
    const z = round(0.15 + this.random() * 0.85);
    this.capsules.set(id, { id, body, color, z, radius });
    Matter.Composite.add(this.engine.world, body);
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
