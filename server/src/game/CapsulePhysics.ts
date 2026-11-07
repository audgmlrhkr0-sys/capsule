import type { BallState, CapsuleColor, CapsuleState } from '@capsule-claw/shared';
import Matter from 'matter-js';
import {
  BALL_RADIUS,
  CAPSULE_COLORS,
  CAPSULE_RADIUS,
  DEPTH_LAYERS,
  FILLER_BALL_COUNT,
  INITIAL_CAPSULE_COUNT,
  PHYSICS_HEIGHT,
  PHYSICS_WIDTH,
} from './constants.js';

interface PhysicsBody {
  id: string;
  body: Matter.Body;
  color: CapsuleColor;
  z: number;
  radius: number;
}

const WALL_THICKNESS = 80;
const SPAWN_COLUMNS = 10;
const WALL_CATEGORY = 0x0001;

export class CapsulePhysics {
  private readonly engine = Matter.Engine.create({
    gravity: { x: 0, y: 1, scale: 0.0012 },
  });
  private readonly capsules = new Map<string, PhysicsBody>();
  private readonly balls = new Map<string, PhysicsBody>();
  private nextId = 1;
  private nextBallId = 1;

  constructor(
    private readonly random: () => number = Math.random,
    initialCount = INITIAL_CAPSULE_COUNT,
    fillerCount = FILLER_BALL_COUNT,
  ) {
    const wallOptions = {
      isStatic: true,
      collisionFilter: { category: WALL_CATEGORY },
    };
    const walls = [
      Matter.Bodies.rectangle(
        -WALL_THICKNESS / 2,
        PHYSICS_HEIGHT / 2,
        WALL_THICKNESS,
        PHYSICS_HEIGHT * 2,
        wallOptions,
      ),
      Matter.Bodies.rectangle(
        PHYSICS_WIDTH + WALL_THICKNESS / 2,
        PHYSICS_HEIGHT / 2,
        WALL_THICKNESS,
        PHYSICS_HEIGHT * 2,
        wallOptions,
      ),
      Matter.Bodies.rectangle(
        PHYSICS_WIDTH / 2,
        PHYSICS_HEIGHT + WALL_THICKNESS / 2,
        PHYSICS_WIDTH + WALL_THICKNESS * 2,
        WALL_THICKNESS,
        wallOptions,
      ),
    ];
    Matter.Composite.add(this.engine.world, walls);
    const total = initialCount + fillerCount;
    for (let slot = 0; slot < total; slot += 1) {
      if (Math.floor(((slot + 1) * initialCount) / total) > this.capsules.size) {
        this.addCapsule(slot);
      } else {
        this.addBall(slot);
      }
    }
  }

  tick(deltaMs: number): void {
    Matter.Engine.update(this.engine, deltaMs);
  }

  refill(targetCount = INITIAL_CAPSULE_COUNT): void {
    for (let spawnIndex = 0; this.capsules.size < targetCount; spawnIndex += 1) {
      this.addCapsule(spawnIndex);
    }
  }

  reset(): void {
    for (const capsule of this.capsules.values()) {
      Matter.Composite.remove(this.engine.world, capsule.body);
    }
    this.capsules.clear();
    this.nextId = 1;
    this.refill();
  }

  removeCapsule(id: string): boolean {
    const capsule = this.capsules.get(id);
    if (!capsule) {
      return false;
    }
    Matter.Composite.remove(this.engine.world, capsule.body);
    return this.capsules.delete(id);
  }

  peekNearest(x: number, z: number, maximumDistance: number): CapsuleState | null {
    const nearest = this.findNearest(x, z, maximumDistance);
    return nearest ? serializeBody(nearest) : null;
  }

  takeNearest(x: number, z: number, maximumDistance: number): CapsuleState | null {
    const nearest = this.findNearest(x, z, maximumDistance);
    if (!nearest) {
      return null;
    }
    const state = serializeBody(nearest);
    this.removeCapsule(nearest.id);
    return state;
  }

  serialize(): CapsuleState[] {
    return sortedById(this.capsules).map(serializeBody);
  }

  serializeBalls(): BallState[] {
    return sortedById(this.balls).map(serializeBody);
  }

  get count(): number {
    return this.capsules.size;
  }

  private findNearest(x: number, z: number, maximumDistance: number): PhysicsBody | null {
    let nearest: PhysicsBody | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const capsule of this.capsules.values()) {
      const distance = Math.hypot(capsule.body.position.x - x, capsule.z - z);
      if (distance <= maximumDistance + 1e-9 && distance < nearestDistance) {
        nearest = capsule;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  private addCapsule(slot: number): void {
    const index = this.nextId - 1;
    const id = `capsule-${this.nextId++}`;
    const color = CAPSULE_COLORS[index % CAPSULE_COLORS.length]!;
    this.capsules.set(id, this.createBody(id, slot, CAPSULE_RADIUS, color));
  }

  private addBall(slot: number): void {
    const index = this.nextBallId - 1;
    const id = `ball-${this.nextBallId++}`;
    const color = CAPSULE_COLORS[(index + 3) % CAPSULE_COLORS.length]!;
    this.balls.set(id, this.createBody(id, slot, BALL_RADIUS, color));
  }

  private createBody(
    id: string,
    slot: number,
    radius: number,
    color: CapsuleColor,
  ): PhysicsBody {
    const layer = slot % DEPTH_LAYERS.length;
    const layerIndex = Math.floor(slot / DEPTH_LAYERS.length);
    const column = layerIndex % SPAWN_COLUMNS;
    const row = Math.floor(layerIndex / SPAWN_COLUMNS);
    const x = 80 + column * 115 + (this.random() - 0.5) * 12;
    const y = 50 + row * 90 + (this.random() - 0.5) * 8;
    const category = WALL_CATEGORY << (layer + 1);
    const body = Matter.Bodies.circle(x, y, radius, {
      restitution: 0.32,
      friction: 0.18,
      frictionAir: 0.006,
      density: 0.0018,
      label: id,
      collisionFilter: { category, mask: WALL_CATEGORY | category },
    });
    const [near, far] = DEPTH_LAYERS[layer]!;
    const z = round(near + this.random() * (far - near));
    Matter.Composite.add(this.engine.world, body);
    return { id, body, color, z, radius };
  }
}

function sortedById(bodies: Map<string, PhysicsBody>): PhysicsBody[] {
  return [...bodies.values()].sort((left, right) =>
    left.id.localeCompare(right.id, undefined, { numeric: true }),
  );
}

function serializeBody({ id, body, color, z, radius }: PhysicsBody): CapsuleState {
  return {
    id,
    x: round(body.position.x),
    y: round(body.position.y),
    angle: round(body.angle),
    z,
    radius,
    color,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
