import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { formatRand } from '../../../shared/guard/figures';
import type { RoomSnapshot } from '../../../shared/scene/room-model';
import type { CameraStation } from './replay';

// The 3D room. Geometry and labels read ONE snapshot; nothing here does money maths. Motion (camera, lever, bobbing) is
// cosmetic and never touches a figure. Every object that matters also has a DOM equivalent in overlay.tsx.

/** Set by Scene on every render from the founder's preference; read inside animation frames. */
let REDUCED = false;

export const TILE_LEN = 1.5;
export const TILE_W = 3.4;
const STEP = TILE_LEN + 0.07;

export function tilePose(i: number, count = 36): { x: number; y: number; z: number; yaw: number } {
  const z = -i * STEP;
  const x = Math.sin(i * 0.11) * 1.5;
  const dx = Math.cos(i * 0.11) * 0.11 * 1.5;
  const yaw = -Math.atan2(dx, STEP);
  const y = Math.sin((Math.PI * i) / Math.max(1, count - 1)) * 0.9;
  return { x, y, z, yaw };
}

const PEARL = new THREE.Color('#efe9ff');
const FROST = new THREE.Color('#aab3e6');
const GOLD = '#e7c46b';
const INK = '#121826';
const PATH_COLOUR: Record<string, string> = { A: '#3f6fd8', B: '#d9825f', C: '#7a5cc7' };

function hatchTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 64, 64);
  g.strokeStyle = 'rgba(40,48,110,0.55)';
  g.lineWidth = 5;
  for (let k = -64; k < 128; k += 16) {
    g.beginPath();
    g.moveTo(k, 64);
    g.lineTo(k + 64, 0);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1.2, 1.2);
  return t;
}

function skyTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#b9c6f5');
  grad.addColorStop(0.45, '#e5dcff');
  grad.addColorStop(0.8, '#fbdccd');
  grad.addColorStop(1, '#fff1d8');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Sky() {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const tex = skyTexture();
    scene.background = tex;
    scene.fog = new THREE.Fog('#e4dcfb', 18, 70);
    return () => {
      scene.background = null;
      scene.fog = null;
      tex.dispose();
    };
  }, [scene]);
  return null;
}

interface BridgeProps {
  snapshot: RoomSnapshot;
  selectedMonth: number;
  onSelect: (m: number) => void;
  onHover: (m: number | null) => void;
  showGhost: boolean;
}

function Bridge({ snapshot, selectedMonth, onSelect, onHover, showGhost }: BridgeProps) {
  const rows = snapshot.active.rows;
  const n = rows.length;
  const tiles = useRef<THREE.InstancedMesh>(null);
  const hatch = useRef<THREE.InstancedMesh>(null);
  const hatchTex = useMemo(hatchTexture, []);
  useEffect(() => () => hatchTex.dispose(), [hatchTex]);
  const negative = useMemo(() => rows.filter((r) => r.cash < 0).map((r) => r.month), [rows]);
  const ghost = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i < n; i++) {
      const p = tilePose(i, n);
      const hw = TILE_W / 2;
      const hl = TILE_LEN / 2;
      const c = Math.cos(p.yaw);
      const s = Math.sin(p.yaw);
      const corner = (dx: number, dz: number) => [p.x + dx * c + dz * s, p.y + 0.7, p.z - dx * s + dz * c];
      const a = corner(-hw, -hl);
      const b = corner(hw, -hl);
      const d = corner(hw, hl);
      const e = corner(-hw, hl);
      pts.push(...a, ...b, ...b, ...d, ...d, ...e, ...e, ...a);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [n]);

  useLayoutEffect(() => {
    const mesh = tiles.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    for (let i = 0; i < n; i++) {
      const p = tilePose(i, n);
      e.set(0, p.yaw, 0);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(1, 1, 1));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, rows[i]!.cash < 0 ? FROST : PEARL);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    const h = hatch.current;
    if (h) {
      negative.forEach((month, k) => {
        const p = tilePose(month - 1, n);
        e.set(0, p.yaw, 0);
        q.setFromEuler(e);
        m.compose(new THREE.Vector3(p.x, p.y + 0.075, p.z), q, new THREE.Vector3(1, 1, 1));
        h.setMatrixAt(k, m);
      });
      h.count = negative.length;
      h.instanceMatrix.needsUpdate = true;
    }
  }, [rows, n, negative]);

  const first = snapshot.active.firstShortfall;
  const low = snapshot.active.lowest;
  const lowPose = tilePose(low.month - 1, n);
  const markerPose = first ? tilePose(first - 1, n) : null;
  const sel = tilePose(Math.min(Math.max(selectedMonth, 1), n) - 1, n);

  return (
    <group>
      <instancedMesh
        ref={tiles}
        args={[undefined, undefined, 36]}
        onClick={(ev) => {
          ev.stopPropagation();
          if (ev.instanceId !== undefined) onSelect(ev.instanceId + 1);
        }}
        onPointerMove={(ev) => {
          ev.stopPropagation();
          if (ev.instanceId !== undefined) onHover(ev.instanceId + 1);
        }}
        onPointerOut={() => onHover(null)}
      >
        <boxGeometry args={[TILE_W, 0.14, TILE_LEN]} />
        <meshPhysicalMaterial roughness={0.18} metalness={0.1} clearcoat={1} clearcoatRoughness={0.12} iridescence={0.6} iridescenceIOR={1.4} emissive="#d9ccff" emissiveIntensity={0.18} />
      </instancedMesh>
      <instancedMesh ref={hatch} args={[undefined, undefined, 36]} raycast={() => null}>
        <planeGeometry args={[TILE_W * 0.98, TILE_LEN * 0.96]} />
        <meshBasicMaterial map={hatchTex} transparent depthWrite={false} side={THREE.DoubleSide} />
      </instancedMesh>
      <Rails n={n} />
      {/* selected month ring */}
      <mesh position={[sel.x, sel.y + 0.12, sel.z]} rotation={[-Math.PI / 2, 0, sel.yaw]} raycast={() => null}>
        <ringGeometry args={[1.45, 1.6, 4, 1, Math.PI / 4]} />
        <meshBasicMaterial color={GOLD} side={THREE.DoubleSide} transparent opacity={0.95} />
      </mesh>
      {/* lowest-cash beacon */}
      <group position={[lowPose.x - TILE_W / 2 - 0.2, lowPose.y, lowPose.z]}>
        <mesh position={[0, 0.9, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 1.8, 8]} />
          <meshBasicMaterial color={GOLD} />
        </mesh>
        <Html zIndexRange={[4, 0]} position={[0, 2, 0]} center distanceFactor={14} style={{ pointerEvents: 'none' }}>
          <div className="room-label">Lowest cash {formatRand(low.cash)} · month {low.month}</div>
        </Html>
      </group>
      {/* first-shortfall marker */}
      {markerPose && (
        <group position={[markerPose.x + TILE_W / 2 + 0.25, markerPose.y, markerPose.z]}>
          <mesh position={[0, 1.2, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 2.4, 10]} />
            <meshStandardMaterial color="#fff6d6" emissive="#ffe08a" emissiveIntensity={0.8} />
          </mesh>
          <mesh position={[0, 2.5, 0]}>
            <sphereGeometry args={[0.22, 20, 20]} />
            <meshStandardMaterial color="#fff6d6" emissive="#ffe08a" emissiveIntensity={1} />
          </mesh>
          <Html zIndexRange={[4, 0]} position={[0, 3.1, 0]} center distanceFactor={14} style={{ pointerEvents: 'none' }}>
            <div className="room-label room-label--marker">Cash runs out · month {first}</div>
          </Html>
        </group>
      )}
      {showGhost && (
        <lineSegments geometry={ghost} raycast={() => null}>
          <lineBasicMaterial color={GOLD} transparent opacity={0.65} />
        </lineSegments>
      )}
    </group>
  );
}

function Rails({ n }: { n: number }) {
  const geos = useMemo(() => {
    return [-1, 1].map((side) => {
      const pts = Array.from({ length: n }, (_, i) => {
        const p = tilePose(i, n);
        const c = Math.cos(p.yaw);
        const sn = Math.sin(p.yaw);
        const dx = side * (TILE_W / 2 + 0.18);
        return new THREE.Vector3(p.x + dx * c, p.y + 0.95, p.z - dx * sn);
      });
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 4, 0.045, 8, false);
    });
  }, [n]);
  const posts = useMemo(() => Array.from({ length: Math.ceil(n / 4) + 1 }, (_, k) => Math.min(k * 4, n - 1)), [n]);
  return (
    <group>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} raycast={() => null}>
          <meshStandardMaterial color="#f3d27a" emissive="#ffd978" emissiveIntensity={0.7} metalness={0.9} roughness={0.2} />
        </mesh>
      ))}
      {posts.map((i) => {
        const p = tilePose(i, n);
        return (
          <group key={i} position={[p.x, p.y, p.z]} rotation={[0, p.yaw, 0]}>
            {[-1, 1].map((sd) => (
              <group key={sd} position={[sd * (TILE_W / 2 + 0.18), 0, 0]}>
                <mesh position={[0, 0.5, 0]} raycast={() => null}>
                  <cylinderGeometry args={[0.05, 0.07, 1, 10]} />
                  <meshStandardMaterial color="#f3d27a" emissive="#ffd978" emissiveIntensity={0.4} metalness={0.9} roughness={0.25} />
                </mesh>
                <mesh position={[0, 1.05, 0]} raycast={() => null}>
                  <sphereGeometry args={[0.1, 14, 14]} />
                  <meshStandardMaterial color="#fffbe8" emissive="#fff0b0" emissiveIntensity={1.2} />
                </mesh>
              </group>
            ))}
          </group>
        );
      })}
    </group>
  );
}

function softTexture(inner: string, outer: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A sea of soft cloud discs under the bridge, and a low sun at its far end. Pure atmosphere. */
function Atmosphere({ low }: { low: boolean }) {
  const cloud = useMemo(() => softTexture('rgba(255,255,255,0.95)', 'rgba(255,255,255,0)'), []);
  const sun = useMemo(() => softTexture('rgba(255,244,214,1)', 'rgba(255,214,170,0)'), []);
  useEffect(() => () => { cloud.dispose(); sun.dispose(); }, [cloud, sun]);
  const clouds = useMemo(
    () => Array.from({ length: low ? 40 : 90 }, (_, i) => ({ x: ((i * 53) % 80) - 40, y: -3.2 + ((i * 7) % 5) * 0.55, z: 8 - ((i * 31) % 100), s: 7 + ((i * 11) % 9) })),
    [low],
  );
  return (
    <group>
      {clouds.map((c, i) => (
        <sprite key={i} position={[c.x, c.y, c.z]} scale={[c.s, c.s * 0.55, 1]} raycast={() => null}>
          <spriteMaterial map={cloud} transparent opacity={0.9} depthWrite={false} fog={false} />
        </sprite>
      ))}
      <sprite position={[8, 7, -62]} scale={[30, 30, 1]} raycast={() => null}>
        <spriteMaterial map={sun} transparent depthWrite={false} fog={false} blending={THREE.AdditiveBlending} />
      </sprite>
    </group>
  );
}

/** Floating islands with a few trees, to give the sides a sense of place. */
function Islands() {
  const items = useMemo(
    () => [
      { x: -13, y: 1.2, z: -8, r: 4.2 }, { x: 14, y: 2.2, z: -20, r: 5 }, { x: -16, y: 3, z: -34, r: 5.5 },
      { x: 15, y: 1.6, z: -46, r: 4.5 }, { x: -12, y: 2.4, z: -56, r: 4 },
    ],
    [],
  );
  return (
    <group>
      {items.map((it, i) => (
        <group key={i} position={[it.x, it.y, it.z]}>
          <mesh position={[0, -it.r * 0.55, 0]} rotation={[Math.PI, 0, 0]} raycast={() => null}>
            <coneGeometry args={[it.r, it.r * 1.3, 7]} />
            <meshStandardMaterial color="#d9d2f2" roughness={0.6} flatShading />
          </mesh>
          <mesh position={[0, 0, 0]} raycast={() => null}>
            <cylinderGeometry args={[it.r, it.r * 0.96, 0.4, 24]} />
            <meshStandardMaterial color="#cfe6c6" roughness={0.8} />
          </mesh>
          {[0, 1, 2].map((k) => (
            <group key={k} position={[Math.cos(k * 2.1 + i) * it.r * 0.5, 0.2, Math.sin(k * 2.1 + i) * it.r * 0.5]}>
              <mesh position={[0, 0.5, 0]} raycast={() => null}>
                <cylinderGeometry args={[0.07, 0.1, 1, 6]} />
                <meshStandardMaterial color="#8a6a52" />
              </mesh>
              <mesh position={[0, 1.4, 0]} raycast={() => null}>
                <icosahedronGeometry args={[0.75, 1]} />
                <meshStandardMaterial color={['#a9d6a0', '#f2c4d4', '#c4b5f0'][k % 3]} roughness={0.7} flatShading />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

function Lever({ pulled, onToggle, label }: { pulled: boolean; onToggle: () => void; label: string }) {
  const handle = useRef<THREE.Group>(null);
  const drag = useRef<{ y: number; start: number; moved: boolean } | null>(null);
  const preview = useRef<number | null>(null);
  useFrame((_, dt) => {
    const g = handle.current;
    if (!g) return;
    const progress = preview.current ?? (pulled ? 1 : 0);
    const target = -0.65 + progress * 1.6;
    g.rotation.x = REDUCED || preview.current !== null ? target : THREE.MathUtils.damp(g.rotation.x, target, 7, dt);
  });
  const [hot, setHot] = useState(false);
  return (
    <group
      position={[-3.2, 0.1, 0.6]}
      onPointerDown={(e) => {
        e.stopPropagation();
        (e.target as Element).setPointerCapture?.(e.pointerId);
        drag.current = { y: e.clientY, start: pulled ? 1 : 0, moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dy = e.clientY - d.y;
        if (Math.abs(dy) > 6) d.moved = true;
        if (d.moved) preview.current = Math.min(1, Math.max(0, d.start + dy / 110));
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        const d = drag.current;
        drag.current = null;
        const p = preview.current;
        preview.current = null;
        if (!d) return;
        if (!d.moved) onToggle();
        else if ((p ?? 0) > 0.5 !== pulled) onToggle();
      }}
      onPointerCancel={() => {
        drag.current = null;
        preview.current = null;
      }}
      onPointerOver={() => setHot(true)}
      onPointerOut={() => setHot(false)}
    >
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[1.1, 0.7, 0.9]} />
        <meshPhysicalMaterial color="#f4efff" roughness={0.3} clearcoat={0.7} />
      </mesh>
      <group ref={handle} position={[0, 0.8, 0]}>
        <mesh position={[0, 0.7, 0]}>
          <cylinderGeometry args={[0.07, 0.09, 1.4, 12]} />
          <meshStandardMaterial color={GOLD} metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0, 1.45, 0]}>
          <sphereGeometry args={[0.22, 20, 20]} />
          <meshPhysicalMaterial color="#fffaf0" roughness={0.1} clearcoat={1} emissive={hot ? '#ffe9b0' : '#000000'} emissiveIntensity={0.6} />
        </mesh>
      </group>
      <Html zIndexRange={[4, 0]} position={[0, 2.8, 0]} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
        <div className="room-label">{label} · drag or click</div>
      </Html>
    </group>
  );
}

function Contract({ onOpen, text }: { onOpen: () => void; text: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current && !REDUCED) ref.current.position.y = 2.6 + Math.sin(clock.elapsedTime * 0.9) * 0.08;
  });
  return (
    <group position={[-3.6, 0, -4.5]}>
      <mesh
        ref={ref}
        position={[0, 2.6, 0]}
        rotation={[0, 0.35, 0.04]}
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
      >
        <boxGeometry args={[1.8, 2.4, 0.05]} />
        <meshPhysicalMaterial color="#fffaf0" roughness={0.6} emissive="#fff2cc" emissiveIntensity={0.25} />
      </mesh>
      <Html zIndexRange={[4, 0]} position={[0, 4.3, 0]} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
        <div className="room-label">{text}</div>
      </Html>
    </group>
  );
}

function Pan({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <group
      position={[3.6, 0, 0.4]}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.55, 0.5, 0.6, 24]} />
        <meshPhysicalMaterial color="#f1ecf7" roughness={0.2} metalness={0.7} clearcoat={0.8} />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.58, 0.58, 0.06, 24]} />
        <meshStandardMaterial color={GOLD} metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh position={[0.8, 0.4, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 0.5, 8]} />
        <meshStandardMaterial color={GOLD} metalness={0.9} roughness={0.25} />
      </mesh>
      <Html zIndexRange={[4, 0]} position={[0, 1.7, 0]} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
        <div className="room-label">{label}</div>
      </Html>
    </group>
  );
}

function Fridge({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <group
      position={[4.4, 0, -3]}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[1.2, 2.2, 1]} />
        <meshPhysicalMaterial color="#f6f4ff" roughness={0.25} metalness={0.2} clearcoat={0.6} />
      </mesh>
      <mesh position={[0.45, 1.3, 0.52]}>
        <boxGeometry args={[0.07, 0.7, 0.05]} />
        <meshStandardMaterial color={GOLD} metalness={0.9} roughness={0.2} />
      </mesh>
      <Html zIndexRange={[4, 0]} position={[0, 2.8, 0]} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
        <div className="room-label">{label}</div>
      </Html>
    </group>
  );
}

/** Stand-in people: procedural figures that point and listen. The reviewed, rigged Ayanda replaces them. */
function Person({ anchor, glass, pointAt, speaking }: { anchor: THREE.Vector3; glass?: boolean; pointAt: THREE.Vector3; speaking: boolean }) {
  const root = useRef<THREE.Group>(null);
  const arm = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const target = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }, dt) => {
    const a = arm.current;
    const b = body.current;
    const r = root.current;
    if (!a || !b || !r) return;
    const calm = REDUCED;
    if (calm) r.position.copy(anchor);
    else {
      r.position.x = THREE.MathUtils.damp(r.position.x, anchor.x, 3, dt);
      r.position.y = THREE.MathUtils.damp(r.position.y, anchor.y, 3, dt);
      r.position.z = THREE.MathUtils.damp(r.position.z, anchor.z, 3, dt);
    }
    const reduced = REDUCED;
    target.copy(pointAt);
    const local = b.worldToLocal(target.clone());
    const yaw = Math.atan2(local.x, -local.z);
    const pitch = Math.atan2(local.y - 1.4, Math.hypot(local.x, local.z));
    a.rotation.y = reduced ? yaw : THREE.MathUtils.damp(a.rotation.y, yaw, 6, dt);
    a.rotation.x = reduced ? -pitch : THREE.MathUtils.damp(a.rotation.x, -pitch, 6, dt);
    if (!reduced) b.position.y = Math.sin(clock.elapsedTime * (speaking ? 3 : 1.2)) * 0.015;
  });
  const skin = glass ? '#e6dcff' : '#8a5a44';
  const top = glass ? '#cdbdff' : '#a58ee0';
  const mat = glass
    ? { transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0, clearcoat: 1, emissive: '#c9b8ff', emissiveIntensity: 0.35 }
    : { roughness: 0.55 };
  return (
    <group ref={root} position={[anchor.x, anchor.y, anchor.z]} scale={1.35}>
      <group ref={body}>
        <mesh position={[0, 0.75, 0]}>
          <capsuleGeometry args={[0.32, 0.9, 6, 14]} />
          <meshPhysicalMaterial color={top} {...mat} />
        </mesh>
        <mesh position={[0, 0.45, 0.28]}>
          <boxGeometry args={[0.5, 0.7, 0.05]} />
          <meshPhysicalMaterial color={glass ? '#f0eaff' : '#fbf6ec'} {...mat} />
        </mesh>
        <mesh position={[0, 1.7, 0]}>
          <sphereGeometry args={[0.25, 24, 24]} />
          <meshPhysicalMaterial color={skin} {...mat} />
        </mesh>
        {!glass && (
          <>
            <mesh position={[0, 1.83, -0.04]}>
              <sphereGeometry args={[0.27, 24, 24, 0, Math.PI * 2, 0, Math.PI / 1.9]} />
              <meshStandardMaterial color="#2a1c18" roughness={0.8} />
            </mesh>
            <mesh position={[0, 2.12, -0.05]}>
              <sphereGeometry args={[0.13, 16, 16]} />
              <meshStandardMaterial color="#2a1c18" roughness={0.8} />
            </mesh>
          </>
        )}
        <group ref={arm} position={[0.34, 1.4, 0]}>
          <mesh position={[0, 0, -0.35]} rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[0.07, 0.6, 4, 8]} />
            <meshPhysicalMaterial color={top} {...mat} />
          </mesh>
          <mesh position={[0, 0, -0.75]}>
            <sphereGeometry args={[0.085, 12, 12]} />
            <meshPhysicalMaterial color={skin} {...mat} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function Pearls({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({ x: ((i * 37) % 50) - 25, y: 2 + ((i * 13) % 9), z: -((i * 23) % 60), s: 0.08 + ((i * 7) % 5) * 0.03, p: i })), [count]);
  const drawn = useRef(false);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    if (REDUCED && drawn.current) return;
    drawn.current = true;
    const d = new THREE.Object3D();
    seeds.forEach((s, i) => {
      d.position.set(s.x, s.y + (REDUCED ? 0 : Math.sin(clock.elapsedTime * 0.5 + s.p) * 0.25), s.z);
      d.scale.setScalar(s.s);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} raycast={() => null}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshPhysicalMaterial color="#fffaf5" roughness={0.1} clearcoat={1} emissive="#fff0d8" emissiveIntensity={0.4} />
    </instancedMesh>
  );
}

function CameraRig({ station, month, count, reduced, free }: { station: CameraStation; month: number; count: number; reduced: boolean; free: boolean }) {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3(0, 0.5, -4));
  useFrame((_, dt) => {
    if (free) return;
    const p = tilePose(Math.min(Math.max(month, 1), count) - 1, count);
    let pos: THREE.Vector3;
    let tgt: THREE.Vector3;
    switch (station) {
      case 'contract':
        pos = new THREE.Vector3(-1.2, 3, 3.5);
        tgt = new THREE.Vector3(-4.2, 2.4, -6);
        break;
      case 'marker':
        pos = new THREE.Vector3(p.x + 3.2, p.y + 3.4, p.z + 6.5);
        tgt = new THREE.Vector3(p.x, p.y + 1, p.z - 1);
        break;
      case 'overview':
        pos = new THREE.Vector3(8, 16, 14);
        tgt = new THREE.Vector3(0, 0, -20);
        break;
      case 'memo':
        pos = new THREE.Vector3(0, 7, 12);
        tgt = new THREE.Vector3(0, 0, -22);
        break;
      default:
        pos = new THREE.Vector3(p.x + 2.2, p.y + 4.6, p.z + 8.8);
        tgt = new THREE.Vector3(p.x, p.y - 1.1, p.z - 3.5);
    }
    const k = reduced ? 1 : 1 - Math.exp(-dt * 3.2);
    camera.position.lerp(pos, k);
    look.current.lerp(tgt, k);
    camera.lookAt(look.current);
  });
  return null;
}

export interface SceneProps {
  snapshot: RoomSnapshot;
  selectedMonth: number;
  station: CameraStation;
  pulled: boolean;
  reduced: boolean;
  lowTier: boolean;
  speaking: boolean;
  contractText: string;
  fridgeText: string;
  leverLabel: string;
  onSelectMonth: (m: number) => void;
  onHoverMonth: (m: number | null) => void;
  onLever: () => void;
  onOpenContract: () => void;
  onOpenFridge: () => void;
  onOpenPan: () => void;
  panText: string;
  free: boolean;
  onContextLost: () => void;
}

export default function Scene(p: SceneProps) {
  REDUCED = p.reduced;
  const n = p.snapshot.active.rows.length;
  const pose = tilePose(Math.min(Math.max(p.selectedMonth, 1), n) - 1, n);
  const point = useMemo(() => new THREE.Vector3(pose.x, pose.y + 0.1, pose.z), [pose.x, pose.y, pose.z]);
  const stressed = p.snapshot.ref.setback !== null;
  const ayanda = useMemo(() => new THREE.Vector3(pose.x - 1.0, pose.y + 0.07, pose.z + 1.6), [pose.x, pose.y, pose.z]);
  const advisor = useMemo(() => new THREE.Vector3(pose.x + 1.0, pose.y + 0.07, pose.z + 1.9), [pose.x, pose.y, pose.z]);
  const pathColour = PATH_COLOUR[p.snapshot.ref.pathId] ?? INK;
  return (
    <Canvas
      dpr={p.lowTier ? [1, 1.25] : [1, 2]}
      camera={{ position: [2.4, 5, 9], fov: 52, near: 0.1, far: 140 }}
      gl={{ antialias: !p.lowTier, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          p.onContextLost();
        });
      }}
      aria-hidden="true"
    >
      <Sky />
      <ambientLight intensity={0.95} color="#efe8ff" />
      <hemisphereLight args={['#dfe6ff', '#ffd9c2', 0.9]} />
      <directionalLight position={[6, 12, 6]} intensity={2.1} color="#fff1dc" />
      <pointLight position={[-6, 4, -2]} intensity={14} color={pathColour} distance={18} />
      <Bridge snapshot={p.snapshot} selectedMonth={p.selectedMonth} onSelect={p.onSelectMonth} onHover={p.onHoverMonth} showGhost={stressed} />
      <Lever pulled={p.pulled} onToggle={p.onLever} label={p.leverLabel} />
      <Contract text={p.contractText} onOpen={p.onOpenContract} />
      <Fridge label={p.fridgeText} onOpen={p.onOpenFridge} />
      <Pan label={p.panText} onOpen={p.onOpenPan} />
      <Person anchor={ayanda} pointAt={point} speaking={p.speaking} />
      <Person anchor={advisor} glass pointAt={point} speaking={p.speaking} />
      <Atmosphere low={p.lowTier} />
      {!p.lowTier && <Islands />}
      {!p.lowTier && <Pearls count={36} />}
      <CameraRig station={p.station} month={p.selectedMonth} count={n} reduced={p.reduced} free={p.free} />
      {p.free && <OrbitControls makeDefault enableDamping maxPolarAngle={Math.PI * 0.49} minDistance={3} maxDistance={60} />}
    </Canvas>
  );
}
