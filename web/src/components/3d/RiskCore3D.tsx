/**
 * ORDIUM Risk Core 3D
 * Central glowing spherical intelligence core with orbiting nodes,
 * animated data links, and incoming risk signal pulses (ALLOW/REVIEW/REJECT).
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface RiskCore3DProps {
  className?: string;
  interactive?: boolean;
}

export const RiskCore3D: React.FC<RiskCore3DProps> = ({ className = '', interactive = true }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Check reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 500;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 18;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    container.appendChild(renderer.domElement);

    // Root Group
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // 1. Central Core Sphere (Icosahedron wireframe + inner glowing sphere)
    const innerCoreGeo = new THREE.SphereGeometry(2.4, 32, 32);
    const innerCoreMat = new THREE.MeshBasicMaterial({
      color: 0x6C5CE7,
      transparent: true,
      opacity: 0.25,
      wireframe: false
    });
    const innerCore = new THREE.Mesh(innerCoreGeo, innerCoreMat);
    rootGroup.add(innerCore);

    // Geodesic Wireframe Shell
    const shellGeo = new THREE.IcosahedronGeometry(3.2, 2);
    const shellMat = new THREE.MeshBasicMaterial({
      color: 0x22D3EE,
      wireframe: true,
      transparent: true,
      opacity: 0.35
    });
    const shellMesh = new THREE.Mesh(shellGeo, shellMat);
    rootGroup.add(shellMesh);

    // Outer Gyro Rings
    const ring1Geo = new THREE.TorusGeometry(4.2, 0.04, 16, 100);
    const ring1Mat = new THREE.MeshBasicMaterial({ color: 0x6C5CE7, transparent: true, opacity: 0.6 });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1.rotation.x = Math.PI / 3;
    rootGroup.add(ring1);

    const ring2Geo = new THREE.TorusGeometry(4.8, 0.03, 16, 100);
    const ring2Mat = new THREE.MeshBasicMaterial({ color: 0x22D3EE, transparent: true, opacity: 0.5 });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.y = Math.PI / 4;
    rootGroup.add(ring2);

    // 2. Connected Nodes in Orbit
    const nodeCount = 14;
    const nodeGroup = new THREE.Group();
    rootGroup.add(nodeGroup);

    const nodeGeo = new THREE.SphereGeometry(0.18, 16, 16);
    const nodeMats = [
      new THREE.MeshBasicMaterial({ color: 0x10B981 }), // Safe (ALLOW)
      new THREE.MeshBasicMaterial({ color: 0xF59E0B }), // Warning (REVIEW)
      new THREE.MeshBasicMaterial({ color: 0xEF4444 }), // Danger (REJECT)
      new THREE.MeshBasicMaterial({ color: 0x22D3EE })  // Signal Cyan
    ];

    const nodesData: { mesh: THREE.Mesh; angle: number; radius: number; speed: number; y: number }[] = [];

    for (let i = 0; i < nodeCount; i++) {
      const angle = (i / nodeCount) * Math.PI * 2;
      const radius = 3.6 + Math.sin(i * 1.5) * 1.4;
      const mat = nodeMats[i % nodeMats.length];
      const mesh = new THREE.Mesh(nodeGeo, mat);
      const y = (Math.random() - 0.5) * 3;
      mesh.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      nodeGroup.add(mesh);
      nodesData.push({ mesh, angle, radius, speed: (0.008 + (i % 3) * 0.004) * (i % 2 === 0 ? 1 : -1), y });
    }

    // 3. Dynamic Lines Connecting Orbiting Nodes to the Core
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x6C5CE7,
      transparent: true,
      opacity: 0.22
    });
    const lineGeo = new THREE.BufferGeometry();
    const linePositions = new Float32Array(nodeCount * 6);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    const linesMesh = new THREE.LineSegments(lineGeo, lineMat);
    rootGroup.add(linesMesh);

    // 4. Incoming Signal Pulses (ALLOW - Emerald, REVIEW - Amber, REJECT - Red)
    const signalCount = 18;
    const signalsGeo = new THREE.SphereGeometry(0.12, 12, 12);
    const signalColors = [0x10B981, 0xF59E0B, 0xEF4444, 0x22D3EE];
    const signalData: {
      mesh: THREE.Mesh;
      dir: THREE.Vector3;
      dist: number;
      speed: number;
      color: number;
    }[] = [];

    for (let i = 0; i < signalCount; i++) {
      const color = signalColors[i % signalColors.length];
      const mat = new THREE.MeshBasicMaterial({ color });
      const mesh = new THREE.Mesh(signalsGeo, mat);
      
      const phi = Math.random() * Math.PI * 2;
      const theta = Math.acos(Math.random() * 2 - 1);
      const dir = new THREE.Vector3(
        Math.sin(theta) * Math.cos(phi),
        Math.sin(theta) * Math.sin(phi),
        Math.cos(theta)
      ).normalize();

      const dist = 7 + Math.random() * 6;
      mesh.position.copy(dir.clone().multiplyScalar(dist));
      rootGroup.add(mesh);

      signalData.push({
        mesh,
        dir,
        dist,
        speed: 0.04 + Math.random() * 0.04,
        color
      });
    }

    // 5. Surrounding Particle Field
    const particleCount = 200;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 24;
      particlePositions[i + 1] = (Math.random() - 0.5) * 24;
      particlePositions[i + 2] = (Math.random() - 0.5) * 16;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x94A3B8,
      size: 0.08,
      transparent: true,
      opacity: 0.4
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    rootGroup.add(particles);

    // Mouse Interaction
    let mouseX = 0;
    let mouseY = 0;
    let targetRotX = 0;
    let targetRotY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive) return;
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      mouseX = x * 0.8;
      mouseY = y * 0.8;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Resize Observer
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        const newHeight = entry.contentRect.height;
        if (newWidth > 0 && newHeight > 0) {
          camera.aspect = newWidth / newHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(newWidth, newHeight);
          if (prefersReducedMotion) renderer.render(scene, camera);
        }
      }
    });
    resizeObserver.observe(container);

    // Animation Loop
    let animationFrameId = 0;
    let clock = new THREE.Clock();

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();

      if (!prefersReducedMotion) {
        // Slow rotation
        shellMesh.rotation.y = elapsedTime * 0.15;
        shellMesh.rotation.x = elapsedTime * 0.08;

        innerCore.rotation.y = -elapsedTime * 0.25;

        ring1.rotation.z = elapsedTime * 0.2;
        ring2.rotation.x = -elapsedTime * 0.18;

        // Interactive camera / root dampening
        targetRotX += (mouseY - targetRotX) * 0.05;
        targetRotY += (mouseX - targetRotY) * 0.05;
        rootGroup.rotation.x = targetRotX;
        rootGroup.rotation.y = targetRotY + elapsedTime * 0.05;

        // Orbit nodes and update connecting lines
        const posAttr = lineGeo.attributes.position as THREE.BufferAttribute;
        const posArray = posAttr.array as Float32Array;

        nodesData.forEach((item, idx) => {
          item.angle += item.speed;
          const x = Math.cos(item.angle) * item.radius;
          const z = Math.sin(item.angle) * item.radius;
          item.mesh.position.set(x, item.y + Math.sin(elapsedTime * 1.5 + idx) * 0.2, z);

          // Line segment from center (0,0,0) to node position
          const base = idx * 6;
          posArray[base] = 0;
          posArray[base + 1] = 0;
          posArray[base + 2] = 0;
          posArray[base + 3] = x;
          posArray[base + 4] = item.mesh.position.y;
          posArray[base + 5] = z;
        });
        posAttr.needsUpdate = true;

        // Signal pulses moving into core
        signalData.forEach(sig => {
          sig.dist -= sig.speed;
          if (sig.dist <= 2.4) {
            // Pulse reached core, reset out to edge
            sig.dist = 8 + Math.random() * 5;
          }
          sig.mesh.position.copy(sig.dir.clone().multiplyScalar(sig.dist));
        });

        // Ambient particles floating
        particles.rotation.y = elapsedTime * 0.02;
      }

      renderer.render(scene, camera);
      if (!prefersReducedMotion) animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      resizeObserver.disconnect();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [interactive]);

  return (
    <div
      ref={mountRef}
      className={`relative w-full h-full min-h-[420px] flex items-center justify-center overflow-hidden ${className}`}
      aria-label="ORDIUM 3D Risk Intelligence Core visualization"
      role="img"
    >
      {/* Fallback semantic text for accessibility */}
      <div className="sr-only">
        Interactive 3D Risk Intelligence Core showing interconnected order entities and real-time risk decision evaluation (ALLOW, REVIEW, REJECT).
      </div>
    </div>
  );
};
