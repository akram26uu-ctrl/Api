/**
 * ORDIUM Risk Scanner 3D
 * Rotating 3D optical scanner sweeping over incoming order signal packets,
 * dynamically categorizing them into ALLOW, REVIEW, and REJECT states.
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface RiskScanner3DProps {
  className?: string;
}

export const RiskScanner3D: React.FC<RiskScanner3DProps> = ({ className = '' }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [activeDecision, setActiveDecision] = useState<'ALLOW' | 'REVIEW' | 'REJECT'>('ALLOW');

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 550;
    const height = container.clientHeight || 420;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 5, 14);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const root = new THREE.Group();
    scene.add(root);

    // 1. Scanner Apparatus (Rotating scanner ring and laser emitter)
    const ringGeo = new THREE.TorusGeometry(3.5, 0.08, 16, 64);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x22D3EE,
      emissive: 0x22D3EE,
      emissiveIntensity: 0.8,
      metalness: 0.8,
      roughness: 0.2
    });
    const scannerRing = new THREE.Mesh(ringGeo, ringMat);
    scannerRing.rotation.x = Math.PI / 2;
    root.add(scannerRing);

    // Sweeping laser plane (semi-transparent glowing disc)
    const planeGeo = new THREE.CircleGeometry(3.4, 32);
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0x6C5CE7,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide
    });
    const laserPlane = new THREE.Mesh(planeGeo, planeMat);
    laserPlane.rotation.x = Math.PI / 2;
    root.add(laserPlane);

    // 2. Incoming Order Signal Packets
    const packetCount = 8;
    const boxGeo = new THREE.BoxGeometry(0.7, 0.4, 0.9);
    const packets: {
      mesh: THREE.Mesh;
      speed: number;
      initialZ: number;
      type: 'ALLOW' | 'REVIEW' | 'REJECT';
      targetColor: number;
    }[] = [];

    const types: ('ALLOW' | 'REVIEW' | 'REJECT')[] = ['ALLOW', 'ALLOW', 'REVIEW', 'REJECT', 'ALLOW', 'REVIEW', 'ALLOW', 'REJECT'];
    const colorMap = {
      ALLOW: 0x10B981,  // Emerald
      REVIEW: 0xF59E0B, // Amber
      REJECT: 0xEF4444  // Red
    };

    for (let i = 0; i < packetCount; i++) {
      const type = types[i % types.length];
      const targetColor = colorMap[type];
      const mat = new THREE.MeshStandardMaterial({
        color: 0x94A3B8,
        metalness: 0.6,
        roughness: 0.4
      });
      const mesh = new THREE.Mesh(boxGeo, mat);
      const xOffset = ((i % 3) - 1) * 1.6;
      const initialZ = -8 + (i * 2.5);
      mesh.position.set(xOffset, 0, initialZ);
      root.add(mesh);

      packets.push({
        mesh,
        speed: 0.04,
        initialZ,
        type,
        targetColor
      });
    }

    // Grid Floor
    const grid = new THREE.GridHelper(20, 20, 0x6C5CE7, 0x1e293b);
    grid.position.y = -1.2;
    root.add(grid);

    // Ambient & Directional Lights
    const ambLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambLight);
    const pointLight = new THREE.PointLight(0x22D3EE, 2, 20);
    pointLight.position.set(0, 3, 0);
    scene.add(pointLight);

    // Resize
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    let animId: number;
    let clock = new THREE.Clock();
    let lastDecisionUpdate = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      if (!prefersReducedMotion) {
        // Rotate scanner
        scannerRing.rotation.z = elapsed * 0.8;
        laserPlane.position.y = Math.sin(elapsed * 2) * 0.3;

        // Move order packets along conveyer
        packets.forEach(packet => {
          packet.mesh.position.z += packet.speed;

          // When passing through the center (z = 0), illuminate color based on decision
          if (packet.mesh.position.z > -0.5 && packet.mesh.position.z < 0.5) {
            (packet.mesh.material as THREE.MeshStandardMaterial).color.setHex(packet.targetColor);
            (packet.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(packet.targetColor);
            (packet.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.8;

            if (elapsed - lastDecisionUpdate > 0.6) {
              setActiveDecision(packet.type);
              lastDecisionUpdate = elapsed;
            }
          } else if (packet.mesh.position.z <= -0.5) {
            // Unscanned: neutral slate
            (packet.mesh.material as THREE.MeshStandardMaterial).color.setHex(0x94A3B8);
            (packet.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
            (packet.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
          }

          // Loop back
          if (packet.mesh.position.z > 8) {
            packet.mesh.position.z = -8;
            (packet.mesh.material as THREE.MeshStandardMaterial).color.setHex(0x94A3B8);
            (packet.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
          }
        });

        root.rotation.y = Math.sin(elapsed * 0.1) * 0.2;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div className={`relative w-full h-full min-h-[380px] overflow-hidden ${className}`}>
      <div ref={mountRef} className="w-full h-full flex items-center justify-center" />

      {/* Real-time scanner HUD badge */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-[#0D1320]/85 backdrop-blur-md border border-white/10 px-3 py-2 rounded-lg text-xs font-mono">
        <span className="w-2 h-2 rounded-full bg-[#22D3EE] animate-ping" />
        <span className="text-[#94A3B8]">GATE SCANNER:</span>
        <span
          className={`font-bold px-2 py-0.5 rounded text-xs ${
            activeDecision === 'ALLOW'
              ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30'
              : activeDecision === 'REVIEW'
              ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30'
              : 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30'
          }`}
        >
          {activeDecision}
        </span>
      </div>

      <div className="absolute bottom-4 left-4 right-4 z-10 flex justify-between items-center text-[11px] font-mono text-[#94A3B8] bg-[#080B12]/80 backdrop-blur-sm border border-white/5 p-2 rounded-md">
        <span>INSPECTION LATENCY: measured per evaluation</span>
        <span className="text-[#22D3EE]">PIPELINE: ACTIVE INGESTION</span>
      </div>
    </div>
  );
};
