import RAPIER from '@dimforge/rapier3d-compat';
import type { CourtyardManifest, ObjectId } from './manifest';
import { OBJECT_IDS } from './manifest';

type Vec = { x: number; y: number; z: number };
const STEP = 1 / 60;
const MAX_STEPS = 5;
const RADIUS = 0.3;
const HALF_HEIGHT = 0.55;
const CENTER_HEIGHT = RADIUS + HALF_HEIGHT;
const asVec = (v: readonly number[]): Vec => ({ x: v[0]!, y: v[1]!, z: v[2]! });

// Overlapping init and world cleanup reproduced unsafe aliasing in Rapier 0.12.
// Share initialization: StrictMode can start two controller creations at once.
let initialization: Promise<void> | undefined;
function initializeRapier(): Promise<void> {
  if (!initialization) {
    initialization = RAPIER.init().catch((error: unknown) => {
      initialization = undefined; // A failed load may be retried on the next attempt.
      throw error;
    });
  }
  return initialization;
}

/** Independent physics world. Position is capsule centre; camera sits at manifest eye height above its feet. */
export class CourtyardController {
  private world: RAPIER.World;
  private body: RAPIER.RigidBody;
  private collider: RAPIER.Collider;
  private controller: RAPIER.KinematicCharacterController;
  private accumulator = 0;
  private vertical = 0;
  private grounded = false;
  private disposed = false;
  private colliderIds = new Map<number, string>();

  static async create(manifest: CourtyardManifest): Promise<CourtyardController> {
    await initializeRapier();
    return new CourtyardController(manifest);
  }
  private constructor(private manifest: CourtyardManifest) {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = STEP;
    for (const box of manifest.colliders) {
      if (box.size.some((n) => !Number.isFinite(n) || n <= 0)) throw new Error(`Invalid collider ${box.id}`);
      const c = this.world.createCollider(RAPIER.ColliderDesc.cuboid(box.size[0] / 2, box.size[1] / 2, box.size[2] / 2).setTranslation(...box.center));
      this.colliderIds.set(c.handle, box.id);
    }
    const spawn = manifest.places[manifest.spawn].stand;
    this.body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn[0], spawn[1] + CENTER_HEIGHT + 0.03, spawn[2]));
    this.collider = this.world.createCollider(RAPIER.ColliderDesc.capsule(HALF_HEIGHT, RADIUS), this.body);
    this.controller = this.world.createCharacterController(0.02);
    this.controller.enableAutostep(0.2, 0.3, false);
    this.controller.enableSnapToGround(0.12);
    this.controller.setMaxSlopeClimbAngle(Math.PI / 4);
    this.controller.setMinSlopeSlideAngle(Math.PI / 3);
    this.world.step();
  }
  get position(): Vec { return this.body.translation(); }
  get eye(): Vec { const p = this.position; return { x: p.x, y: p.y - CENTER_HEIGHT + this.manifest.eyeHeight, z: p.z }; }
  get isGrounded(): boolean { return this.grounded; }
  /** yaw=0 faces -Z. Large elapsed times are dropped, so a resumed tab cannot teleport. */
  advance(elapsed: number, input: { x: number; z: number }, yaw: number): void {
    if (this.disposed) throw new Error('Controller disposed');
    const dt = Number.isFinite(elapsed) ? Math.max(0, Math.min(elapsed, STEP * MAX_STEPS)) : 0;
    this.accumulator = Math.min(this.accumulator + dt, STEP * MAX_STEPS);
    const length = Math.hypot(input.x, input.z);
    const scale = Number.isFinite(length) && length > 1 ? 1 / length : Number.isFinite(length) ? 1 : 0;
    const x = Number.isFinite(input.x) ? input.x * scale : 0;
    const z = Number.isFinite(input.z) ? input.z * scale : 0;
    const angle = Number.isFinite(yaw) ? yaw : 0;
    while (this.accumulator + 1e-9 >= STEP) {
      this.vertical = Math.max(-20, this.vertical - 9.81 * STEP);
      const cos = Math.cos(angle), sin = Math.sin(angle);
      this.controller.computeColliderMovement(this.collider, { x: (x * cos + z * sin) * 2.5 * STEP, y: this.vertical * STEP, z: (z * cos - x * sin) * 2.5 * STEP });
      const move = this.controller.computedMovement(), p = this.position;
      this.grounded = this.controller.computedGrounded();
      if (this.grounded && this.vertical < 0) this.vertical = 0;
      this.body.setNextKinematicTranslation({ x: p.x + move.x, y: p.y + move.y, z: p.z + move.z });
      this.world.step();
      this.accumulator -= STEP;
      const pos = this.position;
      if (![pos.x, pos.y, pos.z].every(Number.isFinite) || pos.y < this.manifest.bounds.min[1]) this.recover();
    }
  }
  recover(): void { this.standAt(this.manifest.places[this.manifest.spawn].stand); }
  /** Moves the capsule straight to a floor point, feet on the ground: recovery, and entering Walk at a place. */
  standAt(stand: readonly number[]): void {
    const p = { x: stand[0]!, y: stand[1]! + CENTER_HEIGHT + 0.03, z: stand[2]! };
    this.body.setTranslation(p, true); this.body.setNextKinematicTranslation(p);
    this.world.propagateModifiedBodyPositionsToColliders(); this.world.step();
    this.vertical = 0; this.grounded = false; this.accumulator = 0;
  }
  /** Only an in-range object with a clear proxy-collider ray can be selected. */
  nearestVisible(target?: ObjectId): ObjectId | null {
    const origin = this.eye;
    const candidates = OBJECT_IDS.map((id) => {
      const o = this.manifest.objects[id], p = asVec(o.position);
      const delta = { x: p.x - origin.x, y: p.y - origin.y, z: p.z - origin.z };
      return { id, o, delta, distance: Math.hypot(delta.x, delta.y, delta.z) };
    }).filter((c) => (!target || c.id === target) && c.distance > 0 && c.distance <= c.o.radius).sort((a, b) => a.distance - b.distance);
    for (const c of candidates) {
      const d = c.distance;
      const ray = new RAPIER.Ray(origin, { x: c.delta.x / d, y: c.delta.y / d, z: c.delta.z / d });
      const hit = this.world.castRay(ray, d, true, undefined, undefined, this.collider, undefined, (collider) => this.colliderIds.get(collider.handle) !== c.id);
      if (!hit || hit.timeOfImpact >= d - 0.05) return c.id;
    }
    return null;
  }
  dispose(): void { if (!this.disposed) { this.world.removeCharacterController(this.controller); this.world.free(); this.disposed = true; } }
}
