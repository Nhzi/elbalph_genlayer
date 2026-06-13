'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Text } from '@react-three/drei';
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

const POCKET_COUNT = WHEEL_ORDER.length;
const OUTER_RADIUS = 1.6;
const INNER_RADIUS = 1.05;
const POCKET_HEIGHT = 0.18;

function Pocket({ value, angle }: { value: number; angle: number }) {
  const color = value === 0 ? '#1ad670' : RED.has(value) ? '#d6321a' : '#0a0a0a';
  const midRadius = (OUTER_RADIUS + INNER_RADIUS) / 2;
  const x = Math.cos(angle) * midRadius;
  const z = Math.sin(angle) * midRadius;
  return (
    <group position={[x, 0, z]} rotation={[0, -angle + Math.PI / 2, 0]}>
      {/* The pocket floor */}
      <mesh>
        <boxGeometry args={[OUTER_RADIUS - INNER_RADIUS, POCKET_HEIGHT, 0.24]} />
        <meshStandardMaterial color={color} metalness={0.35} roughness={0.55} />
      </mesh>
      {/* Number label, painted onto the inside of the pocket facing the centre */}
      <Text
        position={[0, POCKET_HEIGHT / 2 + 0.001, 0]}
        rotation={[-Math.PI / 2, 0, Math.PI / 2]}
        fontSize={0.18}
        color="#fff"
        anchorX="center"
        anchorY="middle"
      >
        {String(value)}
      </Text>
    </group>
  );
}

function Wheel({ spin, spinning }: Props) {
  const ref = useRef<THREE.Group>(null!);
  const target = useRef<number | null>(null);

  useEffect(() => {
    if (spin == null) {
      target.current = null;
      return;
    }
    const idx = WHEEL_ORDER.indexOf(spin);
    const pocketAngle = (idx / POCKET_COUNT) * Math.PI * 2;
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
      {/* Outer felt rim — wider and darker */}
      <mesh position={[0, -0.04, 0]}>
        <cylinderGeometry args={[OUTER_RADIUS + 0.15, OUTER_RADIUS + 0.15, 0.06, 96]} />
        <meshStandardMaterial color="#2a1810" metalness={0.3} roughness={0.85} />
      </mesh>

      {/* Pocket ring base */}
      <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[OUTER_RADIUS, OUTER_RADIUS, 0.04, 96]} />
        <meshStandardMaterial color="#3a2418" metalness={0.4} roughness={0.6} />
      </mesh>

      {/* Pockets */}
      {WHEEL_ORDER.map((n, i) => {
        const a = (i / POCKET_COUNT) * Math.PI * 2;
        return <Pocket key={n} value={n} angle={a} />;
      })}

      {/* Thin radial dividers between pockets */}
      {WHEEL_ORDER.map((_, i) => {
        const a = ((i + 0.5) / POCKET_COUNT) * Math.PI * 2;
        const midR = (OUTER_RADIUS + INNER_RADIUS) / 2;
        return (
          <mesh
            key={`d-${i}`}
            position={[Math.cos(a) * midR, POCKET_HEIGHT / 2 + 0.001, Math.sin(a) * midR]}
            rotation={[0, -a, 0]}
          >
            <boxGeometry args={[OUTER_RADIUS - INNER_RADIUS, 0.02, 0.015]} />
            <meshStandardMaterial color="#e6c187" metalness={0.85} roughness={0.25} />
          </mesh>
        );
      })}

      {/* Inner bowl — slopes down to the centre */}
      <mesh position={[0, 0.05, 0]}>
        <coneGeometry args={[INNER_RADIUS, 0.18, 64, 1, true]} />
        <meshStandardMaterial
          color="#2a1810"
          metalness={0.4}
          roughness={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Central hub (turret) */}
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.22, 0.32, 0.22, 32]} />
        <meshStandardMaterial color="#caa024" metalness={0.95} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.26, 0]}>
        <cylinderGeometry args={[0.04, 0.18, 0.12, 24]} />
        <meshStandardMaterial color="#ffd23f" metalness={0.95} roughness={0.18} />
      </mesh>

      {/* Crossbars on top of the turret */}
      {[0, Math.PI / 2].map((rot) => (
        <mesh key={rot} position={[0, 0.34, 0]} rotation={[0, rot, 0]}>
          <boxGeometry args={[0.42, 0.04, 0.04]} />
          <meshStandardMaterial color="#ffd23f" metalness={0.9} roughness={0.2} />
        </mesh>
      ))}

      {/* The ball — sits on the rim, rides along with the wheel */}
      {spin != null && (
        <mesh position={[Math.cos(0) * (OUTER_RADIUS - 0.18), POCKET_HEIGHT + 0.05, 0]}>
          <sphereGeometry args={[0.07, 24, 24]} />
          <meshStandardMaterial color="#fff" metalness={0.6} roughness={0.2} />
        </mesh>
      )}
    </group>
  );
}

export function Roulette3D({ spin, spinning }: Props) {
  return (
    <div className="relative h-[320px] w-full overflow-hidden rounded-xl bg-gradient-to-b from-black/40 to-transparent">
      <Canvas shadows camera={{ position: [0, 2.4, 2.4], fov: 40 }}>
        <ambientLight intensity={0.45} />
        <directionalLight position={[3, 5, 2]} intensity={1.3} castShadow />
        <directionalLight position={[-2, 3, -2]} intensity={0.5} color="#ffe9a8" />
        <Wheel spin={spin} spinning={spinning} />
        {/* Static pointer — fixed indicator outside the spinning group */}
        <mesh position={[0, 0.45, OUTER_RADIUS + 0.18]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.09, 0.32, 6]} />
          <meshStandardMaterial color="#fff" metalness={0.7} roughness={0.2} />
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
