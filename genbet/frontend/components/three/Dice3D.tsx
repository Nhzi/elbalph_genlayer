'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, RoundedBox } from '@react-three/drei';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

type Props = {
  roll?: number | null; // 1..100 — for HUD only
  spinning: boolean;
};

// Standard die layout: opposite faces sum to 7.
// We map the SIX faces to the SIX +X/-X/+Y/-Y/+Z/-Z directions.
// Pip coordinates are in the face's local 2D plane, range [-1, 1].
const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [
    [-0.5, -0.5],
    [0.5, 0.5],
  ],
  3: [
    [-0.6, -0.6],
    [0, 0],
    [0.6, 0.6],
  ],
  4: [
    [-0.5, -0.5],
    [0.5, -0.5],
    [-0.5, 0.5],
    [0.5, 0.5],
  ],
  5: [
    [-0.55, -0.55],
    [0.55, -0.55],
    [0, 0],
    [-0.55, 0.55],
    [0.55, 0.55],
  ],
  6: [
    [-0.55, -0.6],
    [-0.55, 0],
    [-0.55, 0.6],
    [0.55, -0.6],
    [0.55, 0],
    [0.55, 0.6],
  ],
};

// For each face, we need:
//   - position offset (face center)
//   - rotation so the pips lie flat against that face
const HALF = 0.5; // half edge length — die is 1×1×1
const PIP_INSET = 0.001; // sink slightly into the face so they don't z-fight
type FaceSpec = {
  value: number;
  position: [number, number, number];
  rotation: [number, number, number];
};
const FACES: FaceSpec[] = [
  { value: 1, position: [0, HALF + PIP_INSET, 0], rotation: [-Math.PI / 2, 0, 0] }, // top  (+Y)
  { value: 6, position: [0, -HALF - PIP_INSET, 0], rotation: [Math.PI / 2, 0, 0] }, // bot  (-Y)
  { value: 2, position: [0, 0, HALF + PIP_INSET], rotation: [0, 0, 0] }, // front (+Z)
  { value: 5, position: [0, 0, -HALF - PIP_INSET], rotation: [0, Math.PI, 0] }, // back  (-Z)
  { value: 3, position: [HALF + PIP_INSET, 0, 0], rotation: [0, Math.PI / 2, 0] }, // right (+X)
  { value: 4, position: [-HALF - PIP_INSET, 0, 0], rotation: [0, -Math.PI / 2, 0] }, // left  (-X)
];

function DiePips({ value, color }: { value: number; color: string }) {
  const pips = PIP_LAYOUTS[value] ?? [];
  return (
    <>
      {pips.map(([x, y], i) => (
        <mesh key={i} position={[x * 0.28, y * 0.28, 0]}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshStandardMaterial color={color} metalness={0.1} roughness={0.4} />
        </mesh>
      ))}
    </>
  );
}

function Die({
  spinning,
  settle,
  color,
  pipColor,
  spinAxis,
  position,
}: {
  spinning: boolean;
  settle: boolean;
  color: string;
  pipColor: string;
  spinAxis: number;
  position: [number, number, number];
}) {
  const ref = useRef<THREE.Group>(null!);
  useFrame((_, dt) => {
    const speed = spinning && !settle ? 5 : 0.4;
    const g = ref.current;
    if (!g) return;
    g.rotation.x += dt * speed * (1 + spinAxis * 0.3);
    g.rotation.y += dt * speed * (0.8 + spinAxis * 0.5);
    g.rotation.z += dt * speed * 0.3;
  });
  return (
    <group ref={ref} position={position}>
      {/* Rounded cube body */}
      <RoundedBox args={[1, 1, 1]} radius={0.12} smoothness={6} castShadow receiveShadow>
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.35} />
      </RoundedBox>

      {/* Pips on each face */}
      {FACES.map((f) => (
        <group key={f.value} position={f.position} rotation={f.rotation}>
          <DiePips value={f.value} color={pipColor} />
        </group>
      ))}
    </group>
  );
}

export function Dice3D({ roll, spinning }: Props) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (roll != null) {
      const t = setTimeout(() => setSettled(true), 700);
      return () => clearTimeout(t);
    } else {
      setSettled(false);
    }
  }, [roll]);

  return (
    <div className="relative h-[280px] w-full overflow-hidden rounded-xl bg-gradient-to-b from-black/40 to-transparent">
      <Canvas shadows camera={{ position: [0, 1.4, 3.4], fov: 40 }}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 5, 2]} intensity={1.3} castShadow />
        <directionalLight position={[-2, 3, -2]} intensity={0.4} />
        <Die
          spinning={spinning || roll == null}
          settle={settled}
          color="#ff3ea5"
          pipColor="#fff"
          spinAxis={0}
          position={[-0.85, 0, 0]}
        />
        <Die
          spinning={spinning || roll == null}
          settle={settled}
          color="#3fe5ff"
          pipColor="#0a0a0f"
          spinAxis={1}
          position={[0.85, 0, 0]}
        />
        {/* Soft floor for the shadow */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.85, 0]} receiveShadow>
          <planeGeometry args={[10, 10]} />
          <shadowMaterial transparent opacity={0.25} />
        </mesh>
        <Environment preset="city" />
        <OrbitControls enableZoom={false} enablePan={false} />
      </Canvas>
      {roll != null && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center">
          <div className="inline-flex items-baseline gap-2 rounded-lg bg-black/60 px-3 py-1.5 backdrop-blur">
            <span className="text-[10px] uppercase tracking-widest text-white/50">Roll</span>
            <span className="font-mono text-2xl font-bold text-neon-green">{roll}</span>
          </div>
        </div>
      )}
    </div>
  );
}
