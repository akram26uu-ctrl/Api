/**
 * ORDIUM Security Shield 3D
 * Abstract 3D crystalline barrier structure representing ORDIUM defending
 * e-commerce stores against automated attacks, bots, and fraudulent transactions.
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface SecurityShield3DProps {
  className?: string;
}

export const SecurityShield3D: React.FC<SecurityShield3DProps> = ({ className = '' }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 450;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    // Geodesic Shield Barrier Structure
    const shieldGeo = new THREE.IcosahedronGeometry(3, 1);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x6C5CE7,
      emissive: 0x22D3EE,
      emissiveIntensity: 0.2,
      wireframe: true,
      roughness: 0.2,
      metalness: 0.9
    });
    const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    group.add(shieldMesh);

    // Inner Core Shield Polyhedron
    const coreGeo = new THREE.OctahedronGeometry(1.8, 0);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x22D3EE,
      transparent: true,
      opacity: 0.4,
      roughness: 0.1,
      metalness: 0.95
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(coreMesh);

    // Deflected Threat Particles (Red / Amber deflected rays)
    const threatCount = 30;
    const threatsGeo = new THREE.BufferGeometry();
    const threatPos = new Float32Array(threatCount * 3);
    const threatVelocities: THREE.Vector3[] = [];

    for (let i = 0; i < threatCount * 3; i += 3) {
      threatPos[i] = (Math.random() - 0.5) * 12;
      threatPos[i + 1] = (Math.random() - 0.5) * 12;
      threatPos[i + 2] = 4 + Math.random() * 4;
      threatVelocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 0.05,
        (Math.random() - 0.5) * 0.05,
        -0.08 - Math.random() * 0.04
      ));
    }
    threatsGeo.setAttribute('position', new THREE.BufferAttribute(threatPos, 3));
    const threatsMat = new THREE.PointsMaterial({
      color: 0xEF4444,
      size: 0.14,
      transparent: true,
      opacity: 0.85
    });
    const threatPoints = new THREE.Points(threatsGeo, threatsMat);
    group.add(threatPoints);

    // Lights
    const amb = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(amb);
    const pointLight = new THREE.PointLight(0x22D3EE, 3, 20);
    pointLight.position.set(2, 4, 5);
    scene.add(pointLight);

    const redLight = new THREE.PointLight(0xEF4444, 2, 15);
    redLight.position.set(-3, -3, 4);
    scene.add(redLight);

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

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      if (!prefersReducedMotion) {
        shieldMesh.rotation.y = elapsed * 0.2;
        shieldMesh.rotation.x = elapsed * 0.1;
        coreMesh.rotation.y = -elapsed * 0.3;
        coreMesh.rotation.z = elapsed * 0.15;

        // Threat particles deflected off the shield barrier
        const posAttr = threatsGeo.attributes.position as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;

        for (let i = 0; i < threatCount; i++) {
          const idx = i * 3;
          arr[idx] += threatVelocities[i].x;
          arr[idx + 1] += threatVelocities[i].y;
          arr[idx + 2] += threatVelocities[i].z;

          // If threat hits shield surface radius ~3, deflect or bounce outward
          const dist = Math.sqrt(arr[idx] * arr[idx] + arr[idx + 1] * arr[idx + 1] + arr[idx + 2] * arr[idx + 2]);
          if (dist < 3.2 && arr[idx + 2] > 0) {
            // Deflected! Reverse z with dispersion
            threatVelocities[i].z = Math.abs(threatVelocities[i].z) * 1.5;
            threatVelocities[i].x += (Math.random() - 0.5) * 0.1;
            threatVelocities[i].y += (Math.random() - 0.5) * 0.1;
          }

          // Reset if too far away
          if (arr[idx + 2] > 10 || arr[idx + 2] < -5) {
            arr[idx] = (Math.random() - 0.5) * 8;
            arr[idx + 1] = (Math.random() - 0.5) * 8;
            arr[idx + 2] = 7;
            threatVelocities[i].set((Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.04, -0.08);
          }
        }
        posAttr.needsUpdate = true;
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
      <div className="absolute bottom-4 left-4 z-10 text-xs font-mono text-[#94A3B8] bg-[#080B12]/80 backdrop-blur-sm border border-white/5 px-3 py-1.5 rounded">
        <span className="text-[#10B981]">● ACTIVE DEFENSE LAYER</span>: Zero-Trust Perimeter
      </div>
    </div>
  );
};
