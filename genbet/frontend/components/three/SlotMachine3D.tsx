'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Text } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

type Props = {
  reels?: string[] | null;
  spinning: boolean;
};

const SYMBOLS = ['7', 'BAR', 'BELL', 'CHERRY', 'LEMON', 'PLUM'];

function Reel({
  index,
  finalSymbol,
  spinning,
  x,
}: {
  index: number;
  finalSymbol?: string | null;
  spinning: boolean;
  x: number;
}) {
  const ref = useRef<THREE.Group>(null!);
  const target = useRef<number | null>(null);

  useEffect(() => {
    if (!finalSymbol) {
      target.current = null;
      return;
    }
    const idx = SYMBOLS.indexOf(finalSymbol);
    const spins = 6 + index * 2;
    target.current = spins * Math.PI * 2 + (idx / SYMBOLS.length) * Math.PI * 2;
  }, [finalSymbol, index]);

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    if (target.current == null) {
      g.rotation.x += dt * (spinning ? 9 : 1.5);
    } else {
      g.rotation.x += (target.current - g.rotation.x) * Math.min(1, dt * 2.4);
    }
  });

  return (
    <group position={[x, 0, 0]}>
      <mesh>
        <cylinderGeometry args={[0.45, 0.45, 0.5, 32, 1, true]} />
        <meshStandardMaterial color="#1a1a2a" side={THREE.DoubleSide} metalness={0.4} roughness={0.5} />
      </mesh>
      <group ref={ref}>
        {SYMBOLS.map((s, i) => {
          const a = (i / SYMBOLS.length) * Math.PI * 2;
          return (
            <group key={s} rotation={[a, 0, 0]}>
              <Text
                position={[0, 0.45, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.22}
                color="#ffd23f"
                anchorX="center"
                anchorY="middle"
              >
                {s}
              </Text>
            </group>
          );
        })}
      </group>
    </group>
  );
}

export function SlotMachine3D({ reels, spinning }: Props) {
  return (
    <div className="relative h-[320px] w-full overflow-hidden rounded-xl bg-gradient-to-b from-black/40 to-transparent">
      <Canvas shadows camera={{ position: [0, 0.6, 2.4], fov: 40 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 4, 3]} intensity={1.1} />
        <Reel index={0} x={-1.05} spinning={spinning} finalSymbol={reels?.[0] ?? null} />
        <Reel index={1} x={0} spinning={spinning} finalSymbol={reels?.[1] ?? null} />
        <Reel index={2} x={1.05} spinning={spinning} finalSymbol={reels?.[2] ?? null} />
        <Environment preset="city" />
        <OrbitControls enableZoom={false} enablePan={false} />
      </Canvas>
      {reels && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center">
          <div className="inline-flex items-baseline gap-2 rounded-lg bg-black/60 px-3 py-1.5 backdrop-blur font-mono">
            {reels.map((r, i) => (
              <span key={i} className="text-2xl font-bold text-neon-gold">
                {r}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
