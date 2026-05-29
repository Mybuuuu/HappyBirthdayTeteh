import { useRef, useState, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { PointMaterial, Points, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Memory, PlanetTheme } from '../types';
import { audioReactivity } from '../utils/audioReactivity';

interface PlanetProps {
  memory: Memory;
  onClick: (id: string, position: THREE.Vector3) => void;
  focused: boolean;
}

const THEMES: Record<PlanetTheme, { 
    color: string, emissive: string, ring: string, particle: string, rough: number, metal: number, wireframe?: boolean, rings: number 
}> = {
  dream: { color: '#fbcfe8', emissive: '#f472b6', ring: '#fdf2f8', particle: '#fdf2f8', rough: 0.4, metal: 0.1, rings: 1 },
  mystery: { color: '#2a0a18', emissive: '#991b1b', ring: '#ef4444', particle: '#dc2626', rough: 0.8, metal: 0.2, rings: 2 },
  matcha: { color: '#dcfce7', emissive: '#22c55e', ring: '#86efac', particle: '#bbf7d0', rough: 0.6, metal: 0.1, rings: 1 },
  crystal: { color: '#faf5ff', emissive: '#a855f7', ring: '#e9d5ff', particle: '#d8b4fe', rough: 0.1, metal: 0.9, rings: 3 },
  flower: { color: '#fef08a', emissive: '#fbbf24', ring: '#fde047', particle: '#fef9c3', rough: 0.5, metal: 0.3, rings: 1 },
  vintage: { color: '#ffedd5', emissive: '#ea580c', ring: '#fdba74', particle: '#fed7aa', rough: 0.7, metal: 0.5, rings: 1 },
  neon: { color: '#cffafe', emissive: '#06b6d4', ring: '#22d3ee', particle: '#67e8f9', rough: 0.2, metal: 0.8, wireframe: true, rings: 2 },
  moon: { color: '#f3f4f6', emissive: '#9ca3af', ring: '#e5e7eb', particle: '#f9fafb', rough: 0.9, metal: 0.1, rings: 1 },
  birthday: { color: '#fda4af', emissive: '#e11d48', ring: '#fb7185', particle: '#fde047', rough: 0.2, metal: 0.6, rings: 3 },
};

export function Planet({ memory, onClick, focused }: PlanetProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Group & THREE.Mesh>(null);
  const moonsRef = useRef<THREE.Group>(null);
  const explosionRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  
  const [hovered, setHovered] = useState(false);
  const theme = THEMES[memory.theme];
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const materialsList = useRef<THREE.MeshStandardMaterial[]>([]);

  // Local particles simulating atmospheric dust/orbiting debris
  const localParticles = useMemo(() => {
    const count = isMobile ? 30 : 80;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const r = memory.size * (1.2 + Math.random() * 1.5);
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(2 * Math.random() - 1);
        pos[i * 3] = r * Math.sin(phi) * Math.cos(theta); // x
        pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta); // y
        pos[i * 3 + 2] = r * Math.cos(phi); // z
    }
    return pos;
  }, [memory.size, isMobile]);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    const soundReact = audioReactivity.getLevel(time);

    if (!focused && groupRef.current) {
        // Orbit
        const angle = time * memory.orbitSpeed + memory.orbitAngleOffset;
        groupRef.current.position.x = Math.cos(angle) * memory.orbitRadius;
        groupRef.current.position.z = Math.sin(angle) * memory.orbitRadius;
        
        // Add vertical floating based on theme
        const verticalDrift = memory.theme === 'dream' || memory.theme === 'flower' || memory.theme === 'birthday' ? 
            Math.sin(time * 0.8 + memory.orbitAngleOffset) * 2.5 : 
            Math.sin(time * 0.5 + memory.orbitAngleOffset) * 1.5;
            
        groupRef.current.position.y = memory.yOffset + verticalDrift;
    }
    
    if (meshRef.current) {
        // spin
        meshRef.current.rotation.y += delta * (memory.theme === 'neon' ? 0.5 : 0.2);

        // Music-reactive pulse scale modifier
        const soundPulse = 1.0 + soundReact * 0.12;
        const baseScale = hovered ? memory.size * 1.05 : memory.size;

        if (memory.theme === 'birthday') {
            const pulse = 1 + Math.sin(time * 2.5) * 0.05;
            meshRef.current.scale.setScalar(pulse * soundPulse);
        } else {
            meshRef.current.scale.setScalar(baseScale * soundPulse);
        }

        // Dynamically shift material emissive values (optimized compilation - zero traversal cost after spinup)
        if (materialsList.current.length === 0) {
            meshRef.current.traverse((child) => {
                if (child instanceof THREE.Mesh && child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(mat => {
                        if ('emissive' in mat) {
                            materialsList.current.push(mat as THREE.MeshStandardMaterial);
                        }
                    });
                }
            });
        }

        const emissiveIntensity = (hovered ? 2.5 : 1.0) + soundReact * 1.3;
        for (let i = 0; i < materialsList.current.length; i++) {
            materialsList.current[i].emissiveIntensity = emissiveIntensity;
        }
    }
    
    if (moonsRef.current) {
        moonsRef.current.rotation.y += delta * (0.5 + soundReact * 0.4);
        moonsRef.current.rotation.x += delta * 0.1;
    }

    if (particlesRef.current) {
        particlesRef.current.rotation.y -= delta * (0.1 + soundReact * 0.1);
    }

    // Explosion ripple reaction when focused (extra expansion for birthday)
    if (explosionRef.current) {
        if (focused) {
            const maxScale = memory.theme === 'birthday' ? memory.size * 8 : memory.size * 6;
            if (explosionRef.current.scale.x < maxScale) {
                explosionRef.current.scale.addScalar(delta * 25);
                const mat = explosionRef.current.material as THREE.MeshBasicMaterial;
                mat.opacity = Math.max(0, mat.opacity - delta * 1.5);
            }
        } else {
            explosionRef.current.scale.set(memory.size, memory.size, memory.size);
            const mat = explosionRef.current.material as THREE.MeshBasicMaterial;
            mat.opacity = 0.6;
        }
    }
  });

  const handlePointerOver = () => setHovered(true);
  const handlePointerOut = () => setHovered(false);
  const handleClick = (e: any) => {
    e.stopPropagation();
    if (groupRef.current) {
      onClick(memory.id, groupRef.current.position.clone());
    }
  };

  const sphereSegments = isMobile ? 12 : 20;

  // Let's cache all WebGL geometries to prevent frame-by-frame GC sweeps
  const sphereGeometry = useMemo(() => new THREE.SphereGeometry(1, sphereSegments, sphereSegments), [sphereSegments]);
  const glowGeometry = useMemo(() => new THREE.SphereGeometry(1, sphereSegments, isMobile ? 6 : 10), [sphereSegments, isMobile]);
  const ringGeometries = useMemo(() => {
    return [...Array(theme.rings)].map((_, idx) => {
      const inner = memory.size * (1.5 + idx * 0.3);
      const outer = memory.size * (1.55 + idx * 0.3);
      return new THREE.RingGeometry(inner, outer, isMobile ? 16 : 30);
    });
  }, [memory.size, theme.rings, isMobile]);

  // Birthday-specific shapes
  const cakeBaseGeometry = useMemo(() => memory.theme === 'birthday' ? new THREE.CylinderGeometry(0.9, 0.9, 0.6, isMobile ? 16 : 24) : null, [memory.theme, isMobile]);
  const cakeTopGeometry = useMemo(() => memory.theme === 'birthday' ? new THREE.CylinderGeometry(0.65, 0.65, 0.5, isMobile ? 16 : 24) : null, [memory.theme, isMobile]);
  const candleGeometry = useMemo(() => memory.theme === 'birthday' ? new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8) : null, [memory.theme]);
  const flameGeometry = useMemo(() => memory.theme === 'birthday' ? new THREE.SphereGeometry(0.1, 8, 8) : null, [memory.theme]);
  const moonGeometry1 = useMemo(() => memory.theme === 'birthday' ? new THREE.SphereGeometry(0.15, 8, 8) : null, [memory.theme]);

  // Standard orbiting moons
  const moonGeometry2 = useMemo(() => theme.rings < 3 ? new THREE.SphereGeometry(0.2, 8, 8) : null, [theme.rings]);
  const moonGeometry3 = useMemo(() => theme.rings < 3 ? new THREE.SphereGeometry(0.1, 8, 8) : null, [theme.rings]);
  const dodecahedronGeometry = useMemo(() => memory.theme === 'birthday' ? new THREE.DodecahedronGeometry(0.1, 0) : null, [memory.theme]);

  // Dispose WebGL resources on unmount
  useEffect(() => {
    return () => {
      sphereGeometry.dispose();
      glowGeometry.dispose();
      ringGeometries.forEach(g => g.dispose());
      cakeBaseGeometry?.dispose();
      cakeTopGeometry?.dispose();
      candleGeometry?.dispose();
      flameGeometry?.dispose();
      moonGeometry1?.dispose();
      moonGeometry2?.dispose();
      moonGeometry3?.dispose();
      dodecahedronGeometry?.dispose();
    };
  }, [sphereGeometry, glowGeometry, ringGeometries, cakeBaseGeometry, cakeTopGeometry, candleGeometry, flameGeometry, moonGeometry1, moonGeometry2, moonGeometry3, dodecahedronGeometry]);

  return (
    <group ref={groupRef}>
      {/* Base Planet */}
      {memory.theme === 'birthday' ? (
        <group 
          ref={meshRef}
          onClick={handleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          {/* Cake Base Layer */}
          <mesh position={[0, -0.4, 0]} geometry={cakeBaseGeometry || undefined}>
            <meshStandardMaterial 
              color="#fda4af" 
              emissive="#fb7185" 
              emissiveIntensity={0.8} 
              roughness={0.2} 
              metalness={0.1}
            />
          </mesh>
          {/* Cake Top Layer */}
          <mesh position={[0, 0.2, 0]} geometry={cakeTopGeometry || undefined}>
            <meshStandardMaterial 
              color="#ffffff" 
              emissive="#fbcfe8" 
              emissiveIntensity={1.4} 
              roughness={0.1} 
              metalness={0.0}
            />
          </mesh>
          {/* Candle stick */}
          <mesh position={[0, 0.7, 0]} geometry={candleGeometry || undefined}>
            <meshStandardMaterial color="#fbcfe8" emissive="#fb7185" emissiveIntensity={0.8} />
          </mesh>
          {/* Flame */}
          <mesh position={[0, 1.05, 0]} geometry={flameGeometry || undefined}>
            <meshBasicMaterial color="#fb923c" />
          </mesh>
          {/* Candle "23" tag */}
          <Html position={[0, 1.6, 0]} center transform pointerEvents="none">
            <div className="flex flex-col items-center select-none scale-50 leading-none">
              <span className="text-xl font-bold bg-gradient-to-r from-pink-400 via-rose-500 to-amber-300 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(244,63,94,0.8)] font-serif italic whitespace-nowrap">
                23
              </span>
            </div>
          </Html>
        </group>
      ) : (
        <mesh 
          ref={meshRef}
          onClick={handleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          scale={hovered ? memory.size * 1.05 : memory.size}
          geometry={sphereGeometry}
        >
          <meshStandardMaterial 
            color={theme.color} 
            emissive={theme.emissive}
            emissiveIntensity={hovered ? 2.5 : 1}
            roughness={theme.rough}
            metalness={theme.metal}
            wireframe={theme.wireframe}
          />
        </mesh>
      )}
      
      {/* Atmospheric Glow Aura */}
      <mesh scale={memory.size * 1.2} geometry={glowGeometry}>
         <meshBasicMaterial color={theme.emissive} transparent opacity={0.15} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Explosion Ripple */}
      <mesh ref={explosionRef} scale={memory.size} geometry={glowGeometry}>
         <meshBasicMaterial color={theme.color} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Orbit Rings (Dynamic based on theme) */}
      {[...Array(theme.rings)].map((_, idx) => (
        <mesh key={idx} rotation={[Math.PI / 2 + (idx * 0.2), 0, 0]} geometry={ringGeometries[idx]}>
            <meshBasicMaterial color={theme.ring} transparent opacity={0.2 - (idx * 0.05)} side={THREE.DoubleSide} wireframe={theme.wireframe} />
        </mesh>
      ))}

      {/* Local Theme Particles */}
      <Points ref={particlesRef} positions={localParticles} stride={3} frustumCulled={false}>
        <PointMaterial
          transparent
          color={theme.particle}
          size={0.15}
          sizeAttenuation={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </Points>

      {/* Mini orbiting objects depending on theme */}
      {memory.theme === 'birthday' ? (
        <group ref={moonsRef}>
            {/* Star Moon 1 */}
            <mesh position={[memory.size * 1.7, 0.4, 0]} geometry={moonGeometry1 || undefined}>
                <meshStandardMaterial color="#fef08a" emissive="#facc15" emissiveIntensity={1.5} />
            </mesh>
            {/* Flower Petal debris */}
            <mesh position={[-memory.size * 1.9, -0.3, 0.2]} geometry={dodecahedronGeometry || undefined}>
                <meshStandardMaterial color="#fbcfe8" emissive="#fb7185" emissiveIntensity={1} />
            </mesh>
        </group>
      ) : theme.rings < 3 && (
        <group ref={moonsRef}>
            <mesh position={[memory.size * 1.8, 0, 0]} geometry={moonGeometry2 || undefined}>
                <meshStandardMaterial color={theme.ring} emissive={theme.ring} emissiveIntensity={1} />
            </mesh>
            <mesh position={[-memory.size * 2, memory.size * 0.5, 0]} geometry={moonGeometry3 || undefined}>
                <meshStandardMaterial color={theme.color} emissive={theme.color} emissiveIntensity={0.8} />
            </mesh>
        </group>
      )}
    </group>
  );
}
