'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

type Props = {
  spin?: number | null; // 0..36
  spinning: boolean;
};

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
// European wheel order (single-zero).
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

function Wheel({ spin, spinning }: Props) {
  const ref = useRef<THREE.Group>(null!);
  const target = useRef<number | null>(null);

  useEffect(() => {
    if (spin == null) {
      target.current = null;
      return;
    }
    const idx = WHEEL_ORDER.indexOf(spin);
    const pocketAngle = (idx / WHEEL_ORDER.length) * Math.PI * 2;
    // Spin several full turns before landing on the target pocket.
    target.current = Math.PI * 2 * 8 + pocketAngle;
  }, [spin]);

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    if (target.current == null) {
      g.rotation.y += dt * 1.2 * (spinning ? 6 : 1);
    } else {
      g.rotation.y += (target.current - g.rotation.y) * Math.min(1, dt * 1.2);
    }
  });

  return (
    <group ref={ref}>
      {WHEEL_ORDER.map((n, i) => {
        const a = (i / WHEEL_ORDER.length) * Math.PI * 2;
        const color = n === 0 ? '#39ff7a' : RED.has(n) ? '#ff3a3a' : '#161616';
        return (
          <mesh key={n} rotation={[0, a, 0]}>
            <boxGeometry args={[0.18, 0.16, 1.0]} />
            <meshStandardMaterial color={color} metalness={0.3} roughness={0.6} />
          </mesh>
        );
      })}
      <mesh>
        <cylinderGeometry args={[1.05, 1.05, 0.04, 64]} />
        <meshStandardMaterial color="#2a1810" metalness={0.5} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.16, 32]} />
        <meshStandardMaterial color="#ffd23f" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
}

export function Roulette3D({ spin, spinning }: Props) {
  return (
    <div className="relative h-[320px] w-full overflow-hidden rounded-xl bg-gradient-to-b from-black/40 to-transparent">
      <Canvas shadows camera={{ position: [0, 2.2, 2.4], fov: 40 }}>
        <ambientLight intensity={0.45} />
        <directionalLight position={[3, 5, 2]} intensity={1.2} castShadow />
        <Wheel spin={spin} spinning={spinning} />
        {/* static pointer */}
        <mesh position={[0, 0.4, 1.15]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.08, 0.3, 6]} />
          <meshStandardMaterial color="#fff" />
        </mesh>
        <Environment preset="city" />
        <OrbitControls enableZoom={false} enablePan={false} target={[0, 0, 0]} />
      </Canvas>
      {spin != null && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center">
          <div className="inline-flex items-baseline gap-2 rounded-lg bg-black/60 px-3 py-1.5 backdrop-blur">
            <span className="text-[10px] uppercase tracking-widest text-white/50">Number</span>
            <span className="font-mono text-2xl font-bold text-neon-green">{spin}</span>
            <span className="text-xs text-white/60">
              {spin === 0 ? 'green' : RED.has(spin) ? 'red' : 'black'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
