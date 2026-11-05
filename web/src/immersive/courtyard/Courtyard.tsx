import { Canvas, useFrame, useLoader, useThree, type ThreeEvent } from '@react-three/fiber';
import { BakeShadows, Html, useGLTF } from '@react-three/drei';
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import PeoplePreview from './PeoplePreview';
import { WalkCamera, WalkControls, type WalkHandle } from './WalkCamera';
import { OBJECT_IDS, WORLD_BASE, objectForNode, skyRotationY, type CourtyardManifest, type ObjectId, type PlaceId } from './manifest';

// The courtyard: the Blender-built environment.glb, lit by the real Johannesburg sunset panorama (fill and
// reflections) and a warm low sun (key light and shadows). One component owns the camera: the guided camera eases
// between the manifest's places, and dragging only looks around. Only the manifest's named objects take the pointer.

export interface CourtyardProps {
  manifest: CourtyardManifest;
  place: PlaceId;
  walk: boolean;
  /** Filled while walking, so the panel can send the walker to an object. */
  walkHandle: RefObject<WalkHandle | null>;
  onWalkError: (message: string) => void;
  /** The walker has come to a place on foot, so the Places row can say where they are. */
  onPlaceNear: (id: PlaceId) => void;
  /** Whether the draft characters stand in the courtyard. */
  people: boolean;
  selected: ObjectId | null;
  hovered: ObjectId | null;
  onHover: (id: ObjectId | null) => void;
  onSelect: (id: ObjectId) => void;
  reduced: boolean;
  lowTier: boolean;
  onReady: () => void;
  onContextLost: () => void;
}

/** Integrated and phone GPUs are fill-bound, so they draw at ratio 1. Read from the live context: a probe would cost a second one. */
const FILL_BOUND = /Intel|Mali|Adreno|PowerVR|SwiftShader|llvmpipe/i;

export default function Courtyard(p: CourtyardProps) {
  const start = p.manifest.places[p.place];
  const [walkNotice, setWalkNotice] = useState('Walk up to an object, or press a place to walk there.');
  const [near, setNear] = useState<ObjectId | null>(null);
  // After a walk the guided camera eases back from where the walker stood, instead of jumping.
  // Set once a walk has begun, so the guided camera eases back in afterwards. State, not a ref, because it is read during render.
  const [hasWalked, setHasWalked] = useState(false);
  if (p.walk && !hasWalked) setHasWalked(true);
  return (
    <>
    <Canvas
      shadows={p.lowTier ? false : 'percentage'}
      dpr={1}
      camera={{ fov: 50, near: 0.05, far: 600, position: start.camera }}
      gl={{ antialias: !p.lowTier, toneMapping: THREE.AgXToneMapping, toneMappingExposure: p.manifest.lighting.exposure, powerPreference: 'high-performance' }}
      onCreated={({ gl, scene, camera, setDpr }) => {
        // Development and test builds expose the renderer so frame cost can be measured even when the window is throttled.
        if (import.meta.env.DEV || import.meta.env.VITE_COURTYARD_DEBUG === '1') (window as unknown as { __courtyard?: unknown }).__courtyard = { gl, scene, camera };
        const context = gl.getContext();
        const info = context.getExtension('WEBGL_debug_renderer_info');
        const renderer = info ? String(context.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'Intel';
        if (!p.lowTier && !FILL_BOUND.test(renderer)) setDpr(Math.min(window.devicePixelRatio || 1, 1.5));
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          p.onContextLost();
        });
      }}
    >
      <Suspense fallback={null}>
        <Sky manifest={p.manifest} />
        <Environment manifest={p.manifest} selected={p.selected} hovered={p.hovered ?? (p.walk ? near : null)} onHover={p.onHover} onSelect={(id) => (p.walk ? p.walkHandle.current?.inspect(id) : p.onSelect(id))} />
        {p.people && <PeoplePreview reduced={p.reduced} selected={p.selected} />}
        {/* Sun and architecture never move, so the shadow map is drawn once instead of every frame. */}
        <BakeShadows />
        <Ready onReady={p.onReady} />
      </Suspense>
      <Sun manifest={p.manifest} lowTier={p.lowTier} />
      <Lamps manifest={p.manifest} lowTier={p.lowTier} />
      {p.walk ? (
        <WalkCamera manifest={p.manifest} place={p.place} reduced={p.reduced} onSelect={p.onSelect} onError={p.onWalkError} onNotice={setWalkNotice} onNear={setNear} onPlaceNear={p.onPlaceNear} handle={p.walkHandle} />
      ) : (
        <GuidedCamera manifest={p.manifest} place={p.place} reduced={p.reduced} easeIn={hasWalked} />
      )}
    </Canvas>
    {p.walk && <WalkControls handle={p.walkHandle} notice={walkNotice} near={near} manifest={p.manifest} />}
    </>
  );
}

useGLTF.preload(`${WORLD_BASE}environment.glb`);

function Ready({ onReady }: { onReady: () => void }) {
  useEffect(() => onReady(), [onReady]);
  return null;
}

function Sky({ manifest }: { manifest: CourtyardManifest }) {
  const hdr = useLoader(HDRLoader, `${WORLD_BASE}${manifest.lighting.hdri.lighting}`);
  const backdrop = useLoader(THREE.TextureLoader, `${WORLD_BASE}${manifest.lighting.hdri.background}`);
  const scene = useThree((s) => s.scene);
  useLayoutEffect(() => {
    const rotation = skyRotationY(manifest);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    backdrop.mapping = THREE.EquirectangularReflectionMapping;
    backdrop.colorSpace = THREE.SRGBColorSpace;
    scene.environment = hdr;
    scene.environmentIntensity = manifest.lighting.skyIntensity;
    scene.environmentRotation.set(0, rotation, 0);
    scene.background = backdrop;
    scene.backgroundRotation.set(0, rotation, 0);
    return () => {
      scene.environment = null;
      scene.background = null;
    };
  }, [backdrop, hdr, manifest, scene]);
  return null;
}

function Sun({ manifest, lowTier }: { manifest: CourtyardManifest; lowTier: boolean }) {
  const [x, y, z] = manifest.lighting.sun.direction;
  const size = lowTier ? 1024 : 2048;
  return (
    <directionalLight
      position={[x * 40, y * 40, z * 40]}
      color={manifest.lighting.sun.color}
      intensity={manifest.lighting.sun.intensity}
      castShadow={!lowTier}
      shadow-mapSize={[size, size]}
      shadow-bias={-0.0003}
      shadow-normalBias={0.04}
      shadow-camera-left={-18}
      shadow-camera-right={18}
      shadow-camera-top={18}
      shadow-camera-bottom={-18}
      shadow-camera-near={1}
      shadow-camera-far={100}
    />
  );
}

/** The kitchen and stock-room ceiling lights; the courtyard lamps glow but do not light (a budget for integrated GPUs). */
function Lamps({ manifest, lowTier }: { manifest: CourtyardManifest; lowTier: boolean }) {
  const lights = manifest.lighting.lights.filter((l) => /^(kitchen_light|store_light)/.test(l.id)).slice(0, lowTier ? 2 : 5);
  return (
    <>
      {lights.map((l) => (
        <pointLight key={l.id} position={l.position} color={l.color} intensity={l.intensity * 4} distance={l.distance} decay={2} />
      ))}
    </>
  );
}

const noRaycast = () => undefined;

/**
 * Plant copies share one geometry and material per part; drawing each copy separately costs a draw call each.
 * Repeated, non-interactive parts become one InstancedMesh per part (same world transforms, same shadows).
 */
function instanceRepeats(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const groups = new Map<string, THREE.Mesh[]>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material) || m.raycast !== noRaycast) return;
    const key = `${m.geometry.uuid}|${(m.material as THREE.Material).uuid}`;
    const list = groups.get(key);
    if (list) list.push(m);
    else groups.set(key, [m]);
  });
  const rootInverse = root.matrixWorld.clone().invert();
  for (const list of groups.values()) {
    if (list.length < 3) continue;
    const first = list[0]!;
    const inst = new THREE.InstancedMesh(first.geometry, first.material, list.length);
    const local = new THREE.Matrix4();
    list.forEach((m, i) => {
      inst.setMatrixAt(i, local.multiplyMatrices(rootInverse, m.matrixWorld));
      m.removeFromParent();
    });
    inst.castShadow = first.castShadow;
    inst.receiveShadow = first.receiveShadow;
    inst.raycast = noRaycast;
    inst.computeBoundingSphere();
    root.add(inst);
  }
}

function Environment({
  manifest,
  selected,
  hovered,
  onHover,
  onSelect,
}: {
  manifest: CourtyardManifest;
  selected: ObjectId | null;
  hovered: ObjectId | null;
  onHover: (id: ObjectId | null) => void;
  onSelect: (id: ObjectId) => void;
}) {
  const { scene } = useGLTF(`${WORLD_BASE}${manifest.assets.environment}`);
  const interactive = useMemo(() => {
    const map = new Map<ObjectId, THREE.Object3D>();
    for (const id of OBJECT_IDS) {
      const node = scene.getObjectByName(manifest.objects[id].node);
      if (node) map.set(id, node);
    }
    return map;
  }, [manifest, scene]);

  useLayoutEffect(() => {
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[];
      mesh.castShadow = !mats.some((m) => m.transparent || m.emissiveIntensity > 0 && m.emissive.getHex() !== 0);
      mesh.receiveShadow = true;
      mesh.raycast = noRaycast;
    });
    // Interactive objects get their own material copies (so a highlight never tints another object) and the pointer.
    for (const node of interactive.values()) {
      node.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.raycast = THREE.Mesh.prototype.raycast;
        mesh.material = (mesh.material as THREE.Material).clone();
      });
    }
    instanceRepeats(scene);
  }, [interactive, scene]);

  useEffect(() => {
    for (const [id, node] of interactive) {
      const level = id === selected ? 0.6 : id === hovered ? 0.35 : 0;
      node.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (!m || !('emissive' in m)) return;
        m.emissive.set('#8e7cf0');
        m.emissiveIntensity = level;
      });
    }
  }, [interactive, selected, hovered]);

  const pick = (e: ThreeEvent<PointerEvent | MouseEvent>): ObjectId | null => {
    const names: string[] = [];
    for (let o: THREE.Object3D | null = e.object; o; o = o.parent) names.push(o.name);
    return objectForNode(manifest, names);
  };

  const tag = hovered ?? selected;
  const at = tag ? manifest.objects[tag].position : null;
  return (
    <>
      <primitive
        object={scene}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onHover(pick(e));
        }}
        onPointerOut={() => onHover(null)}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (e.delta > 6) return; // the end of a drag-to-look, not a click
          const id = pick(e);
          if (id) onSelect(id);
        }}
      />
      {tag && at && (
        <Html position={[at[0], at[1] + 0.35, at[2]]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="object-tag">
            {manifest.objects[tag].label} · {tag === selected ? 'Selected' : 'Inspect'}
          </div>
        </Html>
      )}
    </>
  );
}

const UP = new THREE.Vector3(0, 1, 0);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Eases the camera between places along a straight line inside the courtyard; drag adds a bounded look offset. */
function GuidedCamera({ manifest, place, reduced, easeIn }: { manifest: CourtyardManifest; place: PlaceId; reduced: boolean; easeIn: boolean }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const v3 = (a: readonly number[]) => new THREE.Vector3(a[0], a[1], a[2]);
  const state = useRef({
    fromPos: v3(manifest.places[place].camera),
    fromTarget: v3(manifest.places[place].target),
    toPos: v3(manifest.places[place].camera),
    toTarget: v3(manifest.places[place].target),
    pos: v3(manifest.places[place].camera),
    target: v3(manifest.places[place].target),
    t: 1,
    yaw: 0,
    pitch: 0,
    drag: null as null | { x: number; y: number },
  });

  const mounted = useRef(false);
  useEffect(() => {
    const s = state.current;
    const next = manifest.places[place];
    if (!mounted.current) {
      mounted.current = true;
      if (easeIn) {
        // Coming back from a walk: start from where the walker stands and looks.
        s.pos.copy(camera.position);
        s.target.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(6));
      }
    }
    s.fromPos.copy(s.pos);
    s.fromTarget.copy(s.target);
    s.toPos.copy(v3(next.camera));
    s.toTarget.copy(v3(next.target));
    s.t = reduced ? 1 : 0;
    s.yaw = 0;
    s.pitch = 0;
  }, [camera, easeIn, manifest, place, reduced]);

  useEffect(() => {
    const el = gl.domElement;
    const s = state.current;
    const down = (e: PointerEvent) => {
      s.drag = { x: e.clientX, y: e.clientY };
    };
    const move = (e: PointerEvent) => {
      if (!s.drag) return;
      s.yaw = Math.max(-0.75, Math.min(0.75, s.yaw - (e.clientX - s.drag.x) * 0.004));
      s.pitch = Math.max(-0.35, Math.min(0.35, s.pitch - (e.clientY - s.drag.y) * 0.003));
      s.drag = { x: e.clientX, y: e.clientY };
    };
    const up = () => {
      s.drag = null;
    };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [gl]);

  // A portrait phone would see only one wall through a 50 degree lens; widen it so each place still frames its objects.
  const size = useThree((s) => s.size);
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = size.width / size.height < 1 ? 72 : 50;
    cam.updateProjectionMatrix();
  }, [camera, size.height, size.width]);

  useFrame((_, dt) => {
    const s = state.current;
    if (s.t < 1) s.t = Math.min(1, s.t + Math.min(dt, 0.1) / 1.6);
    const k = ease(s.t);
    s.pos.lerpVectors(s.fromPos, s.toPos, k);
    s.target.lerpVectors(s.fromTarget, s.toTarget, k);
    const dir = s.target.clone().sub(s.pos);
    const len = dir.length();
    dir.normalize().applyAxisAngle(UP, s.yaw);
    const right = new THREE.Vector3().crossVectors(dir, UP).normalize();
    dir.applyAxisAngle(right, s.pitch);
    camera.position.copy(s.pos);
    camera.lookAt(s.pos.clone().add(dir.multiplyScalar(len)));
  });
  return null;
}
