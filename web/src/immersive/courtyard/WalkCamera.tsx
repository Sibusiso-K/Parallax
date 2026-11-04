import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import type * as THREE from 'three';
import type { CourtyardController } from './controller';
import { MovementInput, isEditableTarget, type MoveAction } from './input';
import type { CourtyardManifest, ObjectId, PlaceId } from './manifest';
import { routeTo, stopForObject, turnToward, yawToward, type Stop } from './route';

// Walking owns the camera only while mounted, and the physics world is disposed on every exit. The physics engine
// (Rapier and its WASM, about 2 MB) is imported here on demand, so the guided room never pays for it. Looking is by
// dragging, not pointer lock: the cursor stays free to click objects, and there is no browser banner or lost-lock state.

export type HoldAction = MoveAction | 'turnLeft' | 'turnRight';

export interface WalkHandle {
  press(action: HoldAction): void;
  release(action: HoldAction): void;
  /** A press with no pointer (a screen reader or a keyboard): moves for a moment. */
  nudge(action: HoldAction): void;
  /** Selects the object when it is in reach and in view; otherwise walks over to it first. */
  inspect(id?: ObjectId): void;
  recover(): void;
}

interface Route {
  points: { x: number; z: number }[];
  index: number;
  /** The place the Places row shows on arrival. */
  place: PlaceId;
  /** What to face on arrival. */
  face: readonly number[];
  then: ObjectId | null;
  clock: number;
  from: { x: number; z: number };
}

const TURN_SPEED = 1.7;
const ROUTE_TURN_SPEED = 3.4;
const LOOK_YAW = 0.0035;
const LOOK_PITCH = 0.003;
const MAX_PITCH = 1.15;

export function WalkCamera({
  manifest,
  place,
  reduced,
  onSelect,
  onError,
  onNotice,
  onNear,
  onPlaceNear,
  handle,
}: {
  manifest: CourtyardManifest;
  place: PlaceId;
  reduced: boolean;
  onSelect: (id: ObjectId) => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  onNear: (id: ObjectId | null) => void;
  onPlaceNear: (id: PlaceId) => void;
  handle: RefObject<WalkHandle | null>;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const state = useRef({
    controller: null as CourtyardController | null,
    input: new MovementInput(),
    yaw: 0,
    pitch: 0,
    turn: new Set<'turnLeft' | 'turnRight'>(),
    drag: null as null | { id: number; x: number; y: number },
    route: null as Route | null,
    face: null as null | { yaw: number; pitch: number },
    near: null as ObjectId | null,
    nearClock: 0,
    placeClock: 0,
    bob: 0,
  });
  const latest = useRef({ manifest, place, reduced, onSelect, onError, onNotice, onNear, onPlaceNear });
  latest.current = { manifest, place, reduced, onSelect, onError, onNotice, onNear, onPlaceNear };
  // The place this walker last reported or was sent to. A different `place` prop means someone pressed a place.
  const synced = useRef(place);

  const faceToward = (target: readonly number[]) => {
    const s = state.current;
    const eye = s.controller?.eye;
    if (!eye) return;
    const flat = Math.hypot(target[0]! - eye.x, target[2]! - eye.z);
    s.face = { yaw: yawToward(eye, { x: target[0]!, z: target[2]! }), pitch: Math.atan2(target[1]! - eye.y, flat) };
  };

  const walkTo = (stop: Stop, toPlace: PlaceId, face: readonly number[], then: ObjectId | null) => {
    const s = state.current;
    const c = s.controller;
    if (!c) return;
    s.input.clear();
    const points = routeTo(c.position, stop);
    if (latest.current.reduced) {
      // No motion wanted: arrive at once, facing the same way the walk would have ended.
      const last = points.at(-1)!;
      c.standAt([last.x, 0, last.z]);
      arrive({ points, index: points.length, place: toPlace, face, then, clock: 0, from: last });
      return;
    }
    s.face = null;
    s.route = { points, index: 0, place: toPlace, face, then, clock: 0, from: { x: c.position.x, z: c.position.z } };
    latest.current.onNotice(then ? `Walking to the ${latest.current.manifest.objects[then].label}. Any movement key stops the walk.` : `Walking to ${latest.current.manifest.places[toPlace].label}. Any movement key stops the walk.`);
  };

  const select = (target?: ObjectId): boolean => {
    const s = state.current;
    const id = s.controller?.nearestVisible(target);
    if (!id) return false;
    s.input.clear();
    latest.current.onSelect(id);
    latest.current.onNotice(`${latest.current.manifest.objects[id].label} selected. Its details are in the panel.`);
    return true;
  };

  const arrive = (route: Route) => {
    const s = state.current;
    s.route = null;
    synced.current = route.place;
    latest.current.onPlaceNear(route.place);
    faceToward(route.face);
    if (latest.current.reduced && s.face) {
      s.yaw = s.face.yaw;
      s.pitch = s.face.pitch;
      s.face = null;
    }
    if (route.then) {
      if (!select(route.then)) latest.current.onNotice('Move closer with a clear view to inspect this object.');
    } else latest.current.onNotice(`You are at ${latest.current.manifest.places[route.place].label}.`);
  };

  useEffect(() => {
    let live = true;
    const s = state.current;
    const el = gl.domElement;
    el.tabIndex = 0;
    el.setAttribute('aria-label', 'Courtyard walking view. Drag to look, use WASD or the arrow keys to move, E to inspect what is nearby.');
    const touchAction = el.style.touchAction;
    el.style.touchAction = 'none';
    import('./controller')
      .then(({ CourtyardController }) => CourtyardController.create(latest.current.manifest))
      .then((controller) => {
        if (!live) return controller.dispose();
        s.controller = controller;
        // Walk begins where the guided camera was standing, looking at what it was looking at.
        const at = latest.current.manifest.places[latest.current.place];
        controller.standAt(at.stand);
        synced.current = latest.current.place;
        faceToward(at.target);
        if (s.face) {
          s.yaw = s.face.yaw;
          s.pitch = s.face.pitch;
          s.face = null;
        }
      })
      .catch(() => {
        if (live) latest.current.onError('Walking could not start.');
      });

    const cancelRoute = () => {
      if (!s.route) return;
      s.route = null;
      latest.current.onNotice('Stopped walking. You are in control.');
    };
    const inspect = (target?: ObjectId) => {
      if (!s.controller) return latest.current.onNotice('Walking is starting. Please try again.');
      if (select(target)) return;
      if (target) {
        const object = latest.current.manifest.objects[target];
        walkTo(stopForObject(target), object.place, object.position, target);
      } else latest.current.onNotice('Nothing is in reach. Walk up to an object, or press a place to walk there.');
    };
    const hold = (action: HoldAction, on: boolean) => {
      cancelRoute();
      if (action === 'turnLeft' || action === 'turnRight') {
        if (on) s.turn.add(action);
        else s.turn.delete(action);
      } else if (on) s.input.press(action);
      else s.input.release(action);
    };
    handle.current = {
      press: (action) => hold(action, true),
      release: (action) => hold(action, false),
      nudge: (action) => {
        hold(action, true);
        window.setTimeout(() => {
          if (live) hold(action, false);
        }, 500);
      },
      inspect,
      recover: () => {
        s.route = null;
        s.face = null;
        s.controller?.recover();
        const spawn = latest.current.manifest.spawn;
        synced.current = spawn;
        latest.current.onPlaceNear(spawn);
        faceToward(latest.current.manifest.places[spawn].target);
        latest.current.onNotice('Back at the courtyard entrance.');
      },
    };

    const clear = () => {
      s.input.clear();
      s.turn.clear();
    };
    const down = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.code === 'KeyE') {
        if (!e.repeat) inspect();
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (s.input.keyDown(e.code)) {
        cancelRoute();
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const up = (e: KeyboardEvent) => s.input.keyUp(e.code);
    const focusIn = (e: FocusEvent) => {
      if (isEditableTarget(e.target)) clear();
    };
    const pointerDown = (e: PointerEvent) => {
      el.focus({ preventScroll: true });
      s.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    };
    const pointerMove = (e: PointerEvent) => {
      if (!s.drag || e.pointerId !== s.drag.id) return;
      s.yaw -= (e.clientX - s.drag.x) * LOOK_YAW;
      s.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, s.pitch - (e.clientY - s.drag.y) * LOOK_PITCH));
      s.drag.x = e.clientX;
      s.drag.y = e.clientY;
      s.face = null;
    };
    const pointerUp = () => {
      s.drag = null;
    };
    const hidden = () => {
      if (document.hidden) clear();
    };
    el.addEventListener('pointerdown', pointerDown);
    window.addEventListener('pointermove', pointerMove);
    window.addEventListener('pointerup', pointerUp);
    window.addEventListener('pointercancel', pointerUp);
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    window.addEventListener('blur', clear);
    window.addEventListener('focusin', focusIn);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      live = false;
      clear();
      handle.current = null;
      latest.current.onNear(null);
      el.removeEventListener('pointerdown', pointerDown);
      window.removeEventListener('pointermove', pointerMove);
      window.removeEventListener('pointerup', pointerUp);
      window.removeEventListener('pointercancel', pointerUp);
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
      window.removeEventListener('blur', clear);
      window.removeEventListener('focusin', focusIn);
      document.removeEventListener('visibilitychange', hidden);
      el.removeAttribute('tabindex');
      el.removeAttribute('aria-label');
      el.style.touchAction = touchAction;
      s.controller?.dispose();
      s.controller = null;
      s.route = null;
    };
    // A dressing relabels the manifest but keeps the same colliders, so renaming a place must not rebuild the physics
    // or send the walker back to the door.
  }, [gl, handle, manifest.colliders]);

  // Pressing a place while walking walks there, rather than leaving Walk.
  useEffect(() => {
    if (place === synced.current) return;
    synced.current = place;
    if (state.current.controller) walkTo(place, place, latest.current.manifest.places[place].target, null);
  }, [place]);

  // A portrait phone would see only one wall through a 50 degree lens.
  const size = useThree((s) => s.size);
  useEffect(() => {
    camera.fov = size.width / size.height < 1 ? 72 : 55;
    camera.updateProjectionMatrix();
  }, [camera, size.height, size.width]);

  useFrame((_, delta) => {
    const s = state.current;
    const c = s.controller;
    if (!c) return;
    const dt = Math.min(delta, 0.1);
    const turning = (s.turn.has('turnLeft') ? 1 : 0) - (s.turn.has('turnRight') ? 1 : 0);
    s.yaw += turning * TURN_SPEED * dt;

    const before = c.position;
    const route = s.route;
    if (route) {
      const point = route.points[route.index];
      if (!point) arrive(route);
      else {
        const dx = point.x - before.x;
        const dz = point.z - before.z;
        const left = Math.hypot(dx, dz);
        if (left < 0.22) route.index += 1;
        else {
          c.advance(delta, { x: dx / left, z: dz / left }, 0);
          if (!s.drag) {
            s.yaw = turnToward(s.yaw, yawToward(before, point), ROUTE_TURN_SPEED * dt);
            s.pitch += (0 - s.pitch) * Math.min(1, dt * 3);
          }
          // A route should always make headway. One that does not has met something it cannot pass: stop, say so.
          route.clock += dt;
          if (route.clock >= 1.5) {
            const after = c.position;
            if (Math.hypot(after.x - route.from.x, after.z - route.from.z) < 0.08) {
              s.route = null;
              latest.current.onNotice('Something is in the way. Use the movement keys to carry on.');
            }
            route.clock = 0;
            route.from = { x: after.x, z: after.z };
          }
        }
      }
    } else c.advance(delta, s.input.vector(), s.yaw);

    if (s.face && !route) {
      s.yaw = turnToward(s.yaw, s.face.yaw, ROUTE_TURN_SPEED * dt);
      s.pitch += (s.face.pitch - s.pitch) * Math.min(1, dt * 4);
      if (s.yaw === s.face.yaw && Math.abs(s.face.pitch - s.pitch) < 0.01) s.face = null;
    }

    const after = c.position;
    const moved = Math.hypot(after.x - before.x, after.z - before.z);
    if (moved > 0.0005 && !latest.current.reduced) s.bob += dt * 8.5;
    const eye = c.eye;
    camera.position.set(eye.x, eye.y + (latest.current.reduced ? 0 : Math.sin(s.bob) * 0.016), eye.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(s.pitch, s.yaw, 0);

    s.nearClock += dt;
    if (s.nearClock >= 0.2) {
      s.nearClock = 0;
      const near = c.nearestVisible();
      if (near !== s.near) {
        s.near = near;
        latest.current.onNear(near);
      }
    }
    s.placeClock += dt;
    if (s.placeClock >= 0.4 && !s.route) {
      s.placeClock = 0;
      const places = latest.current.manifest.places;
      const closest = (Object.keys(places) as PlaceId[])
        .map((id) => ({ id, d: Math.hypot(places[id].stand[0] - after.x, places[id].stand[2] - after.z) }))
        .sort((a, b) => a.d - b.d || a.id.localeCompare(b.id))[0]!;
      if (closest.d < 2.6 && closest.id !== synced.current) {
        synced.current = closest.id;
        latest.current.onPlaceNear(closest.id);
      }
    }
  });
  return null;
}

/** On-screen movement: held like a key while pressed, and usable from a keyboard or a screen reader as a short step. */
function Hold({ action, label, children, handle }: { action: HoldAction; label: string; children: ReactNode; handle: RefObject<WalkHandle | null> }) {
  const down = (e: ReactPointerEvent) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    handle.current?.press(action);
  };
  const up = () => handle.current?.release(action);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={up}
      onClick={(e) => {
        if (e.detail === 0) handle.current?.nudge(action);
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

export function WalkControls({ handle, notice, near, manifest }: { handle: RefObject<WalkHandle | null>; notice: string; near: ObjectId | null; manifest: CourtyardManifest }) {
  return (
    <>
      {near && (
        <button type="button" className="walk-prompt glass" onClick={() => handle.current?.inspect(near)}>
          <kbd>E</kbd> Inspect {manifest.objects[near].label}
        </button>
      )}
      <div className="walk-controls glass" role="group" aria-label="Walk controls">
        <p className="walk-controls__hint">Drag to look · WASD or arrows to move · press a place to walk there</p>
        <p className="walk-controls__notice" role="status" aria-live="polite">{notice}</p>
        <div className="walk-pad">
          <Hold handle={handle} action="turnLeft" label="Turn left">↺</Hold>
          <Hold handle={handle} action="forward" label="Forward">↑</Hold>
          <Hold handle={handle} action="turnRight" label="Turn right">↻</Hold>
          <Hold handle={handle} action="left" label="Step left">←</Hold>
          <Hold handle={handle} action="back" label="Back">↓</Hold>
          <Hold handle={handle} action="right" label="Step right">→</Hold>
        </div>
        <button type="button" className="walk-controls__home" onClick={() => handle.current?.recover()}>Back to the entrance</button>
      </div>
    </>
  );
}
