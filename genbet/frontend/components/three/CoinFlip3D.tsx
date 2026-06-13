'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Text } from '@react-three/drei';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

type Props = {
  result?: 'heads' | 'tails' | null;
  spinning: boolean;
};

/**
 * A coin with engraved H / T faces and a fluted edge.
 *
 * The cylinder's axis is Y, so the two faces are at ±Y. We mount Text on each
 * face slightly above the surface, and tilt the whole coin so the camera sees
 * it edge-on while spinning then face-on when it lands.
 */
function Coin({ result, spinning }: Props) {
  const ref = useRef<THREE.Group>(null!);
  const [phase, setPhase] = useState<'spin' | 'land'>('spin');
  const landTarget = useRef(0);

  useEffect(() => {
    if (result) {
      // The coin's body lies flat (axis = Y). To show a face, we need to rotate
      // it onto its side: rotate around X by -PI/2 (heads up) or +PI/2 (tails).
      const flips = 6;
      const final = result === 'heads' ? -Math.PI / 2 : Math.PI / 2;
      landTarget.current = -flips * Math.PI * 2 + final;
      setPhase('land');
    } else if (spinning) {
      setPhase('spin');
    }
  }, [result, spinning]);

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    if (phase === 'spin') {
      g.rotation.x -= dt * 12;
      g.rotation.y += dt * 1.5;
      g.position.y = Math.sin(performance.now() / 200) * 0.15;
    } else {
      const target = landTarget.current;
      g.rotation.x += (target - g.rotation.x) * Math.min(1, dt * 5);
      g.rotation.y *= 1 - Math.min(1, dt * 6);
      g.position.y *= 1 - Math.min(1, dt * 8);
    }
  });

  // Fluted edge — a ring of thin radial boxes around the rim.
  const ridges = Array.from({ length: 48 });

  return (
    <group ref={ref}>
      {/* Coin body */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[1, 1, 0.18, 96]} />
        <meshStandardMaterial color="#ffd23f" metalness={0.9} roughness={0.18} />
      </mesh>

      {/* Inner rim ring on each face for a stamped-coin look */}
      <mesh position={[0, 0.092, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.85, 0.92, 64]} />
        <meshStandardMaterial color="#caa024" metalness={0.95} roughness={0.25} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -0.092, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.85, 0.92, 64]} />
        <meshStandardMaterial color="#caa024" metalness={0.95} roughness={0.25} side={THREE.DoubleSide} />
      </mesh>

      {/* Fluted edge */}
      {ridges.map((_, i) => {
        const a = (i / ridges.length) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 1.005, 0, Math.sin(a) * 1.005]}
            rotation={[0, -a, 0]}
          >
            <boxGeometry args={[0.04, 0.18, 0.02]} />
            <meshStandardMaterial color="#e6b830" metalness={0.9} roughness={0.3} />
          </mesh>
        );
      })}

      {/* Heads face (+Y) — "H" */}
      <Text
        position={[0, 0.096, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.95}
        color="#1a1505"
        anchorX="center"
        anchorY="middle"
      >
        H
      </Text>

      {/* Tails face (-Y) — "T" */}
      <Text
        position={[0, -0.096, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        fontSize={0.95}
        color="#1a1505"
        anchorX="center"
        anchorY="middle"
      >
        T
      </Text>
    </group>
  );
}

export function CoinFlip3D(props: Props) {
  return (
    <div className="h-[280px] w-full overflow-hidden rounded-xl bg-gradient-to-b from-black/40 to-transparent">
      <Canvas shadows camera={{ position: [0, 1.2, 3], fov: 38 }}>
        <ambientLight intensity={0.45} />
        <directionalLight position={[3, 5, 2]} intensity={1.3} castShadow />
        <directionalLight position={[-3, 2, 1]} intensity={0.5} color="#ffe9a8" />
        <Coin {...props} />
        {/* shadow catcher */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.05, 0]} receiveShadow>
          <planeGeometry args={[6, 6]} />
          <shadowMaterial transparent opacity={0.3} />
        </mesh>
        <Environment preset="city" />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={!props.result}
          autoRotateSpeed={0.6}
        />
      </Canvas>
    </div>
  );
}
