import { ContactShadows, useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { WIND_TIME, drawDisplays, dressEnvironment } from './dressing';
import { WORLD_BASE, type CourtyardManifest, type ObjectId } from './manifest';
import type { RoomReadout } from './readout';

// What makes the courtyard feel lived in: festoon lights, steam off the pots, the air moving, and objects that answer
// when picked up. The lights also carry the decision: when the month on screen is below zero they sink, and the room
// goes a little darker. That is a mood, not a figure; the figures stay in the panel and on the paper.

const glowTexture = (() => {
  let made: THREE.CanvasTexture | null = null;
  return () => {
    if (made) return made;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    made = new THREE.CanvasTexture(canvas);
    return made;
  };
})();

const STRINGS = [10.2, 5.2, 0.1, -5, -9.8];
const BULBS = 22;
const FROM_X = -5.82;
const TO_X = 5.82;
const HIGH = 3.72;
const SAG = 0.85;

/** A string of bulbs across the courtyard, hanging in a shallow curve. Same positions every time. */
function bulbPoints(): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (const z of STRINGS) {
    for (let i = 0; i < BULBS; i++) {
      const t = (i + 0.5) / BULBS;
      out.push(new THREE.Vector3(FROM_X + (TO_X - FROM_X) * t, HIGH - SAG * 4 * t * (1 - t), z));
    }
  }
  return out;
}

function Festoon({ below, reduced }: { below: boolean; reduced: boolean }) {
  const points = useMemo(bulbPoints, []);
  const bulbs = useRef<THREE.InstancedMesh>(null);
  const bulbMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.75, 0.95), toneMapped: false }), []);
  const glowMaterial = useMemo(() => new THREE.PointsMaterial({ color: '#ffb873', size: 0.62, map: glowTexture(), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }), []);
  const glowGeometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);
  const wires = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const v: number[] = [];
    for (const z of STRINGS) {
      for (let i = 0; i < 40; i++) {
        const a = i / 40;
        const b = (i + 1) / 40;
        v.push(FROM_X + (TO_X - FROM_X) * a, HIGH - SAG * 4 * a * (1 - a) + 0.03, z, FROM_X + (TO_X - FROM_X) * b, HIGH - SAG * 4 * b * (1 - b) + 0.03, z);
      }
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    return g;
  }, []);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    points.forEach((p, i) => bulbs.current?.setMatrixAt(i, m.setPosition(p)));
    if (bulbs.current) bulbs.current.instanceMatrix.needsUpdate = true;
  }, [points]);
  const level = useRef(1);
  const gl = useThree((s) => s.gl);
  const exposure = useRef(gl.toneMappingExposure);
  useEffect(
    () => () => {
      gl.toneMappingExposure = exposure.current;
    },
    [gl],
  );
  useFrame((_, delta) => {
    const target = below ? 0.16 : 1;
    level.current = reduced ? target : level.current + (target - level.current) * Math.min(1, delta * 1.8);
    const k = level.current;
    bulbMaterial.color.setRGB(2.6 * k + 0.1, 1.75 * k + 0.05, 0.95 * k + 0.03);
    glowMaterial.opacity = 0.5 * k;
    gl.toneMappingExposure = exposure.current * (0.82 + 0.18 * k);
  });
  return (
    <group>
      <instancedMesh ref={bulbs} args={[undefined, undefined, points.length]} material={bulbMaterial} frustumCulled={false} raycast={() => undefined}>
        <sphereGeometry args={[0.032, 10, 8]} />
      </instancedMesh>
      <points geometry={glowGeometry} material={glowMaterial} frustumCulled={false} raycast={() => undefined} />
      <lineSegments geometry={wires} frustumCulled={false} raycast={() => undefined}>
        <lineBasicMaterial color="#26221f" />
      </lineSegments>
    </group>
  );
}

const STEAM_PER_POT = 7;

function Steam({ at, strong }: { at: readonly [number, number, number]; strong: boolean }) {
  const group = useRef<THREE.Group>(null);
  const materials = useMemo(
    () => Array.from({ length: STEAM_PER_POT }, () => new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })),
    [],
  );
  const clock = useRef(0);
  useFrame((_, delta) => {
    clock.current += Math.min(delta, 0.1);
    group.current?.children.forEach((sprite, i) => {
      const life = (clock.current * 0.2 + i / STEAM_PER_POT) % 1;
      sprite.position.set(Math.sin(life * 6 + i * 2.1) * 0.03 * (0.4 + life * 1.8), life * 0.5, Math.cos(life * 5 + i) * 0.025 * (0.4 + life * 1.6));
      const size = 0.08 + life * 0.22;
      sprite.scale.set(size, size, 1);
      materials[i]!.opacity = Math.sin(life * Math.PI) * (strong ? 0.2 : 0.11);
    });
  });
  return (
    <group ref={group} position={at as unknown as THREE.Vector3Tuple}>
      {materials.map((m, i) => (
        <sprite key={i} material={m} raycast={() => undefined} />
      ))}
    </group>
  );
}

/** Slow motes in the low sun. A single draw, and it only ever rotates. */
function Dust() {
  const points = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    // A fixed sequence, so the room looks the same on every load.
    const v: number[] = [];
    for (let i = 0; i < 140; i++) {
      const a = (i * 137.5 * Math.PI) / 180;
      const r = 1.5 + ((i * 53) % 97) / 97 * 9;
      v.push(Math.cos(a) * r * 0.55, 0.4 + ((i * 29) % 83) / 83 * 3, Math.sin(a) * r);
    }
    return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  }, []);
  useFrame((_, delta) => {
    if (points.current) points.current.rotation.y += Math.min(delta, 0.1) * 0.012;
  });
  return (
    <points ref={points} geometry={geometry} frustumCulled={false} raycast={() => undefined}>
      <pointsMaterial color="#ffe2bd" size={0.028} map={glowTexture()} transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

export function Ambience({ manifest, readout, selected, reduced, lowTier }: { manifest: CourtyardManifest; readout: RoomReadout; selected: ObjectId | null; reduced: boolean; lowTier: boolean }) {
  const { scene } = useGLTF(`${WORLD_BASE}${manifest.assets.environment}`);
  const displays = useMemo(() => dressEnvironment(scene, reduced), [reduced, scene]);
  const contractLabel = manifest.objects.contract.label;
  // Fonts arrive after the first paint, and a texture drawn before that keeps the fallback face.
  useEffect(() => {
    let live = true;
    drawDisplays(displays, readout, contractLabel);
    void document.fonts?.ready.then(() => {
      if (live) drawDisplays(displays, readout, contractLabel);
    });
    return () => {
      live = false;
    };
  }, [contractLabel, displays, readout]);

  // Objects answer when picked up: the contract's page lifts, and the pots' lids rise.
  const lift = useRef({ page: 0, lid: 0 });
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    if (!reduced) WIND_TIME.value += dt;
    const ease = reduced ? 1 : Math.min(1, dt * 5);
    lift.current.page += ((selected === 'contract' ? 0.34 : 0) - lift.current.page) * ease;
    lift.current.lid += ((selected === 'pan' ? 1 : 0) - lift.current.lid) * ease;
    if (displays.contractPage) displays.contractPage.rotation.x = lift.current.page;
    displays.lids.forEach((lid, i) => {
      lid.position.y = (i === 0 ? 0.2 : 0.15) + lift.current.lid * 0.055;
      lid.rotation.x = lift.current.lid * 0.16;
    });
  });

  return (
    <>
      <Festoon below={readout.below} reduced={reduced} />
      {!reduced && <Steam at={[-3.8, 1.14, 5.55]} strong={selected === 'pan'} />}
      {!reduced && <Steam at={[-3.8, 1.09, 5.25]} strong={selected === 'pan'} />}
      {!reduced && !lowTier && <Dust />}
      {!lowTier && (
        <>
          {/* Soft contact shadows under everything on the terraces, drawn once: they only change if the world does. */}
          <ContactShadows frames={1} position={[-4.25, 0.006, 0.2]} scale={[3.5, 24.4]} resolution={512} blur={2.4} far={1.6} opacity={0.5} color="#1a1420" />
          <ContactShadows frames={1} position={[4.25, 0.006, 0.2]} scale={[3.5, 24.4]} resolution={512} blur={2.4} far={1.6} opacity={0.5} color="#1a1420" />
          <ContactShadows frames={1} position={[0, 0.006, 9.3]} scale={[5, 6.2]} resolution={256} blur={2.4} far={1.6} opacity={0.5} color="#1a1420" />
        </>
      )}
    </>
  );
}
