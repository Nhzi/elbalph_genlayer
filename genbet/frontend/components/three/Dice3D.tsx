'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Edges, OrbitControls, Environment } from '@react-three/drei';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

type Props = {
  roll?: number | null; // 1..100
  spinning: boolean;
};

/**
 * Two-dice visual: settles to a value that, when read as `(a-1)*10 + b`, encodes
 * the roll (roughly). For the website we just animate then display the roll number
 * as a HUD beneath the canvas.
 */
function Dice({ spinning, settle }: { spinning: boolean; settle: boolean }) {
  const a = useRef<THREE.Mesh>(null!);
  const b = useRef<THREE.Mesh>(null!);
  useFrame((_, dt) => {
    const speed = spinning && !settle ? 6 : 0.6;
    [a, b].forEach((r, i) => {
      const m = r.current;
      if (!m) return;
      m.rotation.x += dt * speed * (1 + i * 0.4);
      m.rotation.y += dt * speed * (0.8 + i * 0.6);
    });
  });
  return (
    <>
      <mesh ref={a} position={[-0.8, 0, 0]} castShadow>
        <boxGeometry args={[0.9, 0.9, 0.9]} />
        <meshStandardMaterial color="#ff3ea5" metalness={0.4} roughness={0.4} />
        <Edges scale={1.001} color="#fff5" />
      </mesh>
      <mesh ref={b} position={[0.8, 0, 0]} castShadow>
        <boxGeometry args={[0.9, 0.9, 0.9]} />
        <meshStandardMaterial color="#3fe5ff" metalness={0.4} roughness={0.4} />
        <Edges scale={1.001} color="#fff5" />
      </mesh>
    </>
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
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 5, 2]} intensity={1.2} castShadow />
        <Dice spinning={spinning || roll == null} settle={settled} />
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
