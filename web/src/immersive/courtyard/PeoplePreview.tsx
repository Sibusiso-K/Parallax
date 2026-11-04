import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { ObjectId } from './manifest';

// Work-in-progress fictional characters. Keep this separate from the world and
// controller so failure to load a large preview asset cannot block navigation.
const PEOPLE = [
  { id: 'ayanda', url: '/avatars/ayanda-preview-v3.glb', position: [-4.7, 0.02, 6.65] as const, rotation: 2.35 },
  { id: 'advisor', url: '/avatars/advisor-preview-v3.glb', position: [-4.7, 0.02, 5.52] as const, rotation: 2.35 },
] as const;

class AvatarErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.warn('Character preview unavailable', error); }
  render() { return this.state.failed ? null : this.props.children; }
}

function Person({ person, reduced, selected }: { person: typeof PEOPLE[number]; reduced: boolean; selected: ObjectId | null }) {
  const gltf = useGLTF(person.url);
  const scene = useMemo(() => {
    const copy = clone(gltf.scene);
    copy.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) {
        const mesh = object as THREE.Mesh;
        mesh.raycast = () => undefined;
        mesh.frustumCulled = false;
        mesh.castShadow = false; // Static courtyard shadows are baked once.
        mesh.receiveShadow = true;
      }
    });
    return copy;
  }, [gltf.scene]);
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  const active = useRef<THREE.AnimationAction | null>(null);
  useEffect(() => {
    const idleClip = THREE.AnimationClip.findByName(gltf.animations, 'idle');
    const pointClip = THREE.AnimationClip.findByName(gltf.animations, 'point');
    if (!idleClip) return;
    const idle = mixer.clipAction(idleClip).reset().setLoop(THREE.LoopRepeat, Infinity);
    idle.play(); active.current = idle;
    if (reduced) mixer.setTime(0);
    const onFinished = (event: { action: THREE.AnimationAction }) => {
      if (pointClip && event.action === mixer.existingAction(pointClip)) {
        idle.reset().play().crossFadeFrom(event.action, 0.3, false);
        active.current = idle;
      }
    };
    mixer.addEventListener('finished', onFinished);
    return () => {
      mixer.removeEventListener('finished', onFinished);
      mixer.stopAllAction();
      mixer.uncacheRoot(scene);
      active.current = null;
    };
  }, [gltf.animations, mixer, reduced, scene]);
  useEffect(() => {
    if (reduced || person.id !== 'advisor' || selected !== 'contract') return;
    const clip = THREE.AnimationClip.findByName(gltf.animations, 'point');
    if (!clip) return;
    const next = mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce, 1);
    next.clampWhenFinished = true;
    next.play();
    if (active.current && active.current !== next) next.crossFadeFrom(active.current, 0.3, false);
    active.current = next;
  }, [gltf.animations, mixer, person.id, reduced, selected]);
  useFrame((_state, delta) => { if (!reduced) mixer.update(Math.min(delta, 0.05)); });
  return <primitive object={scene} position={person.position} rotation={[0, person.rotation, 0]} dispose={null} />;
}

export default function PeoplePreview({ reduced, selected }: { reduced: boolean; selected: ObjectId | null }) {
  return <AvatarErrorBoundary><Suspense fallback={null}>{PEOPLE.map((person) =>
    <Person key={person.id} person={person} reduced={reduced} selected={selected} />
  )}</Suspense></AvatarErrorBoundary>;
}
