'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

type Props = {
  result?: 'heads' | 'tails' | null;
  spinning: boolean;
};

/**
 * 3D coin that spins until `result` is set, then settles to show heads/tails up.
 */
function Coin({ result, spinning }: Props) {
  const ref = useRef<THREE.Mesh>(null!);
  const [phase, setPhase] = useState<'spin' | 'land'>('spin');
  const landTarget = useRef(0);

  useEffect(() => {
    if (result) {
      // Snap to a clean integer of rotations + 0 or PI to land on the right face.
      const flips = 6;
      landTarget.current = flips * Math.PI * 2 + (result === 'heads' ? 0 : Math.PI);
      setPhase('land');
    } else if (spinning) {
      setPhase('spin');
    }
  }, [result, spinning]);

  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    if (phase === 'spin') {
      m.rotation.x += dt * 12;
      m.rotation.y += dt * 4;
      m.position.y = Math.sin(performance.now() / 200) * 0.15;
    } else {
      const target = landTarget.current;
      m.rotation.x += (target - m.rotation.x) * Math.min(1, dt * 6);
      m.rotation.y *= 1 - Math.min(1, dt * 6);
      m.position.y *= 1 - Math.min(1, dt * 8);
    }
  });

  return (
    <mesh ref={ref} castShadow receiveShadow>
      <cylinderGeometry args={[1, 1, 0.18, 64]} />
      <meshStandardMaterial color="#ffd23f" metalness={0.85} roughness={0.18} />
    </mesh>
  );
}

export function CoinFlip3D(props: Props) {
  return (
    <div className="h-[280px] w-full overflow-hidden rounded-xl bg-gradient-to-b from-black/40 to-transparent">
      <Canvas shadows camera={{ position: [0, 1.2, 3], fov: 38 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[3, 5, 2]} intensity={1.2} castShadow />
        <Coin {...props} />
        <Environment preset="city" />
        <OrbitControls enableZoom={false} enablePan={false} autoRotate={!props.result} autoRotateSpeed={0.6} />
      </Canvas>
    </div>
  );
}
