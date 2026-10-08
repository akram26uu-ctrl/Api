/**
 * ORDIUM Interactive Identity Graph 3D
 * Full-fidelity 3D entity relationship visualizer with orbit rotation,
 * interactive raycast inspection, and cluster highlight controls.
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { IdentityNode, IdentityGraphData } from '../../lib/api/types';
import { ShieldAlert, ZoomIn, ZoomOut, RefreshCw, Eye } from 'lucide-react';

interface IdentityGraph3DProps {
  data?: IdentityGraphData;
  className?: string;
  onSelectNode?: (node: IdentityNode) => void;
}

export const IdentityGraph3D: React.FC<IdentityGraph3DProps> = ({
  data,
  className = '',
  onSelectNode
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<IdentityNode | null>(null);
  const [filterCluster, setFilterCluster] = useState<boolean>(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 700;
    const height = container.clientHeight || 500;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 0, 16);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Fallback data if none provided
    const graphNodes: IdentityNode[] = data?.nodes || [
      { id: '1', type: 'order', label: 'ORD-77402', value: '$1,420.00', risk_level: 'danger', connected_count: 5, cluster_id: 'cl_1' },
      { id: '2', type: 'customer', label: 'Arthur Vance', value: 'a.vance99@temp-inbox.net', risk_level: 'danger', connected_count: 4, cluster_id: 'cl_1' },
      { id: '3', type: 'phone', label: '+1 (415) 555-0199', value: 'VOIP Carrier', risk_level: 'danger', connected_count: 3, cluster_id: 'cl_1' },
      { id: '4', type: 'device', label: 'HW-Dev-8f0a', value: 'Reused Hardware', risk_level: 'danger', connected_count: 4, cluster_id: 'cl_1' },
      { id: '5', type: 'ip', label: '185.220.101.44', value: 'Tor Exit Node', risk_level: 'danger', connected_count: 3, cluster_id: 'cl_1' },
      { id: '6', type: 'address', label: 'Portland, OR 97201', value: 'Shipping Drop', risk_level: 'danger', connected_count: 2, cluster_id: 'cl_1' },
      // Safe cluster
      { id: '7', type: 'order', label: 'ORD-77395', value: '$345.50', risk_level: 'safe', connected_count: 4 },
      { id: '8', type: 'customer', label: 'Elena Rostova', value: 'elena.rostova@icloud.com', risk_level: 'safe', connected_count: 4 },
      { id: '9', type: 'device', label: 'Apple M2 Silicon', value: 'Consistent', risk_level: 'safe', connected_count: 2 },
      { id: '10', type: 'ip', label: '76.102.19.14', value: 'Comcast Residential', risk_level: 'safe', connected_count: 2 }
    ];

    const typeColorMap: Record<string, number> = {
      order: 0x6C5CE7,
      customer: 0x22D3EE,
      phone: 0x38BDF8,
      device: 0xA855F7,
      ip: 0x94A3B8,
      address: 0x10B981
    };

    const nodeMeshes: THREE.Mesh[] = [];
    const sphereGeo = new THREE.SphereGeometry(0.36, 24, 24);

    // Arrange nodes in 3D space
    graphNodes.forEach((node, idx) => {
      const isCluster = Boolean(node.cluster_id);
      const angle = (idx / graphNodes.length) * Math.PI * 2;
      const radius = isCluster ? 4.2 : 5.8;
      const x = isCluster ? (Math.cos(angle) * 3 - 2.5) : (Math.cos(angle) * 3.5 + 2.5);
      const y = Math.sin(angle * 2) * 2;
      const z = Math.sin(angle) * 2.5;

      const baseColor = node.risk_level === 'danger' ? 0xEF4444 : (node.risk_level === 'warning' ? 0xF59E0B : typeColorMap[node.type] || 0x22D3EE);
      const mat = new THREE.MeshStandardMaterial({
        color: baseColor,
        emissive: baseColor,
        emissiveIntensity: node.risk_level === 'danger' ? 0.6 : 0.25,
        roughness: 0.3,
        metalness: 0.8
      });

      const mesh = new THREE.Mesh(sphereGeo, mat);
      mesh.position.set(x, y, z);
      mesh.userData = node;
      rootGroup.add(mesh);
      nodeMeshes.push(mesh);
    });

    // Connecting Edges
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x6C5CE7,
      transparent: true,
      opacity: 0.3,
      linewidth: 1
    });

    // Connect node 0 (order) with nodes 1-5 (suspicious ring)
    const linePoints: THREE.Vector3[] = [];
    for (let i = 1; i <= 5 && i < nodeMeshes.length; i++) {
      linePoints.push(nodeMeshes[0].position, nodeMeshes[i].position);
    }
    // Connect device to customer, phone to customer
    if (nodeMeshes[1] && nodeMeshes[3]) linePoints.push(nodeMeshes[1].position, nodeMeshes[3].position);
    if (nodeMeshes[1] && nodeMeshes[2]) linePoints.push(nodeMeshes[1].position, nodeMeshes[2].position);

    // Connect safe cluster (node 6 to 7-9)
    if (nodeMeshes[6]) {
      for (let i = 7; i <= 9 && i < nodeMeshes.length; i++) {
        linePoints.push(nodeMeshes[6].position, nodeMeshes[i].position);
      }
    }

    const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    rootGroup.add(lines);

    // Lights
    const amb = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(amb);
    const dir = new THREE.DirectionalLight(0x22D3EE, 1.2);
    dir.position.set(5, 8, 10);
    scene.add(dir);

    // Mouse Interaction / Drag Orbit
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let rotVel = { x: 0, y: 0 };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouse.x;
      const deltaY = e.clientY - prevMouse.y;
      rotVel.y += deltaX * 0.005;
      rotVel.x += deltaY * 0.005;
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Click Raycaster
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(nodeMeshes);
      if (hits.length > 0) {
        const node = hits[0].object.userData as IdentityNode;
        setSelectedNode(node);
        onSelectNode?.(node);
      }
    };

    container.addEventListener('click', handleClick);

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

      if (!isDragging && !prefersReducedMotion) {
        rootGroup.rotation.y += 0.003;
      }

      rootGroup.rotation.y += rotVel.y;
      rootGroup.rotation.x += rotVel.x;
      rotVel.x *= 0.92;
      rotVel.y *= 0.92;

      // Pulse danger nodes
      nodeMeshes.forEach(mesh => {
        const node = mesh.userData as IdentityNode;
        if (node.risk_level === 'danger') {
          const s = 1 + Math.sin(elapsed * 4) * 0.12;
          mesh.scale.set(s, s, s);
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('click', handleClick);
      resizeObserver.disconnect();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [data]);

  return (
    <div className={`relative w-full h-full min-h-[420px] overflow-hidden bg-[#0D1320]/40 rounded-xl border border-white/5 ${className}`}>
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* On-canvas Controls */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <div className="bg-[#080B12]/80 backdrop-blur-md border border-white/10 rounded-lg p-1.5 flex gap-1 text-xs">
          <button
            onClick={() => setFilterCluster(!filterCluster)}
            className={`px-2.5 py-1 rounded flex items-center gap-1.5 font-medium transition-colors ${
              filterCluster ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30' : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Fraud Rings Only</span>
          </button>
        </div>
      </div>

      {/* Selected Node Inspector Flyout */}
      {selectedNode && (
        <div className="absolute bottom-4 left-4 z-20 bg-[#080B12]/95 backdrop-blur-md border border-white/10 p-4 rounded-xl max-w-sm text-xs shadow-2xl animate-in fade-in">
          <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${selectedNode.risk_level === 'danger' ? 'bg-[#EF4444]' : 'bg-[#10B981]'}`} />
              <span className="font-mono uppercase font-bold text-white tracking-wider">{selectedNode.type} Entity</span>
            </div>
            <button onClick={() => setSelectedNode(null)} className="text-[#94A3B8] hover:text-white">✕</button>
          </div>
          <div className="font-medium text-white text-sm mb-1">{selectedNode.label}</div>
          <div className="font-mono text-[#94A3B8] mb-3">{selectedNode.value}</div>
          <div className="grid grid-cols-2 gap-2 text-[11px] bg-white/5 p-2 rounded">
            <div>
              <span className="text-[#94A3B8]">Connected:</span>{' '}
              <span className="font-bold text-white">{selectedNode.connected_count} nodes</span>
            </div>
            <div>
              <span className="text-[#94A3B8]">حالة المخاطر:</span>{' '}
              <span className={`font-bold ${selectedNode.risk_level === 'danger' ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                {selectedNode.risk_level.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-1 text-[11px] font-mono bg-[#080B12]/80 backdrop-blur-md border border-white/10 p-2.5 rounded-lg text-[#94A3B8]">
        <div className="text-[10px] text-white/50 uppercase tracking-wider mb-1">Entity Map</div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#22D3EE]" /> Customer</div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#6C5CE7]" /> Order</div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#A855F7]" /> Device</div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#38BDF8]" /> Phone</div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#94A3B8]" /> IP Address</div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#10B981]" /> Address</div>
      </div>
    </div>
  );
};
