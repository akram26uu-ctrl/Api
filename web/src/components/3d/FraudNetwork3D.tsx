/**
 * ORDIUM Fraud Network 3D Graph
 * Visualizes how Customer, Phone, Device, Address, IP, and Order nodes link together,
 * dynamically highlighting suspicious multi-account fraud rings.
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface FraudNetwork3DProps {
  className?: string;
  highlightCluster?: boolean;
}

interface NodeMeta {
  id: string;
  type: 'Customer' | 'Phone' | 'Device' | 'Address' | 'IP' | 'Order';
  label: string;
  isSuspicious: boolean;
  position: THREE.Vector3;
}

export const FraudNetwork3D: React.FC<FraudNetwork3DProps> = ({
  className = '',
  highlightCluster = true
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<NodeMeta | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 450;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 4, 16);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const graphGroup = new THREE.Group();
    scene.add(graphGroup);

    // Color definitions
    const COLORS = {
      Order: 0x6C5CE7,     // Electric Indigo
      Customer: 0x22D3EE,  // Signal Cyan
      Phone: 0x38BDF8,     // Sky
      Device: 0xA855F7,    // Purple
      Address: 0x10B981,   // Emerald
      IP: 0x94A3B8,        // Slate
      Suspicious: 0xEF4444 // Risk Red
    };

    // Construct realistic nodes network
    const nodesData: NodeMeta[] = [
      // Suspicious Cluster (Cluster #CL-441)
      { id: '1', type: 'Order', label: 'ORD-77402 ($1,420)', isSuspicious: true, position: new THREE.Vector3(-3, 1.5, 0) },
      { id: '2', type: 'Order', label: 'ORD-77372 ($2,190)', isSuspicious: true, position: new THREE.Vector3(-4.5, -0.5, 1) },
      { id: '3', type: 'Customer', label: 'Arthur Vance (Multi-alias)', isSuspicious: true, position: new THREE.Vector3(-2, 0, 1.5) },
      { id: '4', type: 'Phone', label: '+1 (415) 555-0199', isSuspicious: true, position: new THREE.Vector3(-3.8, 3, -1) },
      { id: '5', type: 'Device', label: 'HW-FPrint-8f0a (Reused)', isSuspicious: true, position: new THREE.Vector3(-1.2, 2.5, 0.5) },
      { id: '6', type: 'IP', label: '185.220.101.44 (Tor Egress)', isSuspicious: true, position: new THREE.Vector3(-4, -2, -1) },
      { id: '7', type: 'Address', label: 'Portland, OR (Drop address)', isSuspicious: true, position: new THREE.Vector3(-5.5, 1, -1.5) },

      // Legitimate Clean Order Network
      { id: '8', type: 'Order', label: 'ORD-77395 ($345)', isSuspicious: false, position: new THREE.Vector3(3.5, 1, 0) },
      { id: '9', type: 'Customer', label: 'Elena Rostova', isSuspicious: false, position: new THREE.Vector3(2.5, -0.8, 1) },
      { id: '10', type: 'Device', label: 'MacBook Pro M2 (Consistent)', isSuspicious: false, position: new THREE.Vector3(4.5, 2.2, -0.5) },
      { id: '11', type: 'Phone', label: '+1 (206) 555-8812', isSuspicious: false, position: new THREE.Vector3(2, 2.5, -1) },
      { id: '12', type: 'Address', label: 'Seattle, WA 98101', isSuspicious: false, position: new THREE.Vector3(5, -1.2, 1) },
      { id: '13', type: 'IP', label: '76.102.19.14 (Clean ISP)', isSuspicious: false, position: new THREE.Vector3(1.5, -2.5, -0.5) }
    ];

    // Node Meshes
    const nodeMeshes: THREE.Mesh[] = [];
    const sphereGeo = new THREE.SphereGeometry(0.32, 20, 20);

    nodesData.forEach(node => {
      const color = node.isSuspicious && highlightCluster ? COLORS.Suspicious : COLORS[node.type];
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: node.isSuspicious ? 0.6 : 0.25,
        roughness: 0.3,
        metalness: 0.7
      });
      const mesh = new THREE.Mesh(sphereGeo, mat);
      mesh.position.copy(node.position);
      mesh.userData = node;
      graphGroup.add(mesh);
      nodeMeshes.push(mesh);
    });

    // Edges (Connections)
    const connections: [number, number][] = [
      // Suspicious ring
      [0, 2], [1, 2], [2, 3], [2, 4], [2, 5], [0, 6], [1, 6], [4, 5],
      // Clean ring
      [7, 8], [8, 9], [8, 10], [7, 11], [8, 12]
    ];

    const linesGroup = new THREE.Group();
    graphGroup.add(linesGroup);

    connections.forEach(([srcIdx, tgtIdx]) => {
      const src = nodesData[srcIdx];
      const tgt = nodesData[tgtIdx];
      const isSuspiciousEdge = src.isSuspicious && tgt.isSuspicious && highlightCluster;

      const points = [src.position, tgt.position];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({
        color: isSuspiciousEdge ? 0xEF4444 : 0x6C5CE7,
        transparent: true,
        opacity: isSuspiciousEdge ? 0.7 : 0.25,
        linewidth: isSuspiciousEdge ? 2 : 1
      });
      const line = new THREE.Line(lineGeo, lineMat);
      linesGroup.add(line);
    });

    // Lighting
    const ambLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambLight);
    const dirLight = new THREE.DirectionalLight(0x22D3EE, 1.2);
    dirLight.position.set(5, 10, 8);
    scene.add(dirLight);

    // Raycaster for hover
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(-999, -999);

    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    container.addEventListener('mousemove', handlePointerMove);

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
        graphGroup.rotation.y = Math.sin(elapsed * 0.2) * 0.4;
        graphGroup.rotation.x = Math.cos(elapsed * 0.15) * 0.15;

        // Suspicious node pulsating
        nodeMeshes.forEach((mesh, idx) => {
          const node = mesh.userData as NodeMeta;
          if (node.isSuspicious && highlightCluster) {
            const scale = 1 + Math.sin(elapsed * 3 + idx) * 0.15;
            mesh.scale.set(scale, scale, scale);
          }
        });
      }

      // Hover detection
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodeMeshes);
      if (intersects.length > 0) {
        const hit = intersects[0].object.userData as NodeMeta;
        setHoveredNode(hit);
      } else {
        setHoveredNode(null);
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener('mousemove', handlePointerMove);
      resizeObserver.disconnect();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [highlightCluster]);

  return (
    <div className={`relative w-full h-full min-h-[380px] overflow-hidden ${className}`}>
      <div ref={mountRef} className="w-full h-full flex items-center justify-center cursor-crosshair" />

      {/* Hover Node Tooltip */}
      {hoveredNode && (
        <div className="absolute top-4 left-4 z-20 pointer-events-none bg-[#0D1320]/90 backdrop-blur-md border border-white/10 rounded-lg p-3 text-xs shadow-2xl transition-all">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`w-2 h-2 rounded-full ${
                hoveredNode.isSuspicious ? 'bg-[#EF4444] animate-pulse' : 'bg-[#22D3EE]'
              }`}
            />
            <span className="font-mono text-[#94A3B8] uppercase tracking-wider">{hoveredNode.type} Entity</span>
          </div>
          <div className="font-semibold text-white text-sm">{hoveredNode.label}</div>
          {hoveredNode.isSuspicious ? (
            <div className="mt-1 text-[#EF4444] font-medium flex items-center gap-1">
              <span>⚠ Suspicious Fraud Cluster Member (#CL-441)</span>
            </div>
          ) : (
            <div className="mt-1 text-[#10B981] font-medium">✓ Clean Reputation Node</div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 right-3 z-10 pointer-events-none flex flex-wrap gap-2 text-[10px] font-mono bg-[#080B12]/80 backdrop-blur-sm border border-white/5 px-2.5 py-1.5 rounded-md">
        <span className="flex items-center gap-1 text-[#22D3EE]"><span className="w-1.5 h-1.5 rounded-full bg-[#22D3EE]"></span>Customer</span>
        <span className="flex items-center gap-1 text-[#6C5CE7]"><span className="w-1.5 h-1.5 rounded-full bg-[#6C5CE7]"></span>Order</span>
        <span className="flex items-center gap-1 text-[#A855F7]"><span className="w-1.5 h-1.5 rounded-full bg-[#A855F7]"></span>Device</span>
        <span className="flex items-center gap-1 text-[#EF4444]"><span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]"></span>Fraud Cluster</span>
      </div>
    </div>
  );
};
