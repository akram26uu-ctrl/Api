import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/** A deterministic, low-draw-call order graph. No models, textures or network assets. */
export default function RiskScene() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: !coarsePointer, powerPreference: 'high-performance' });
    } catch {
      mount.dataset.unavailable = 'true';
      return;
    }

    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarsePointer ? 1 : 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
    camera.position.set(0, 0.4, 13.5);

    scene.add(new THREE.HemisphereLight(0xf2f2f4, 0x111318, 2.1));
    const key = new THREE.DirectionalLight(0xff6a35, 5.2);
    key.position.set(4, 5, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x8fa8c7, 3.4);
    rim.position.set(-5, -1, 3);
    scene.add(rim);

    const root = new THREE.Group();
    root.rotation.set(-0.16, -0.3, -0.08);
    scene.add(root);

    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const geometry = <T extends THREE.BufferGeometry>(value: T) => (geometries.push(value), value);
    const material = <T extends THREE.Material>(value: T) => (materials.push(value), value);

    const coreGeometry = geometry(new THREE.IcosahedronGeometry(2.05, 3));
    const coreMaterial = material(new THREE.MeshStandardMaterial({
      color: 0x25272a, metalness: 0.72, roughness: 0.3, flatShading: true,
    }));
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    root.add(core);

    const inner = new THREE.Mesh(
      geometry(new THREE.IcosahedronGeometry(1.42, 2)),
      material(new THREE.MeshStandardMaterial({ color: 0xff5102, emissive: 0x8f2100, emissiveIntensity: 0.7, roughness: 0.4 })),
    );
    root.add(inner);

    const shell = new THREE.Mesh(
      geometry(new THREE.IcosahedronGeometry(2.55, 2)),
      material(new THREE.MeshBasicMaterial({ color: 0xd7d9dc, wireframe: true, transparent: true, opacity: 0.14 })),
    );
    root.add(shell);

    const ringMaterial = material(new THREE.MeshBasicMaterial({ color: 0xb7bcc4, transparent: true, opacity: 0.28 }));
    const rings = [3.35, 4.05].map((radius, index) => {
      const ring = new THREE.Mesh(geometry(new THREE.TorusGeometry(radius, 0.012, 4, 112)), ringMaterial);
      ring.rotation.set(index ? 1.08 : 0.58, index ? 0.3 : -0.45, index ? 0.2 : 0.5);
      root.add(ring);
      return ring;
    });

    const nodeCount = 24;
    const nodeGeometry = geometry(new THREE.SphereGeometry(0.09, 8, 8));
    const nodeMaterial = material(new THREE.MeshBasicMaterial({ color: 0xe8ebec }));
    const nodes = new THREE.InstancedMesh(nodeGeometry, nodeMaterial, nodeCount);
    const nodePositions: THREE.Vector3[] = [];
    const dummy = new THREE.Object3D();
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < nodeCount; i += 1) {
      const y = 1 - (i / (nodeCount - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = goldenAngle * i;
      const point = new THREE.Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius).multiplyScalar(3.65 + (i % 3) * 0.28);
      nodePositions.push(point);
      dummy.position.copy(point);
      dummy.scale.setScalar(i % 7 === 0 ? 1.9 : 1);
      dummy.updateMatrix();
      nodes.setMatrixAt(i, dummy.matrix);
      nodes.setColorAt(i, new THREE.Color(i % 7 === 0 ? 0xff5102 : i % 5 === 0 ? 0x00b982 : 0xe8ebec));
    }
    root.add(nodes);

    const linkPositions: number[] = [];
    nodePositions.forEach((point, index) => {
      if (index % 2 === 0) linkPositions.push(0, 0, 0, point.x, point.y, point.z);
      const next = nodePositions[(index + 5) % nodeCount];
      if (index % 3 === 0) linkPositions.push(point.x, point.y, point.z, next.x, next.y, next.z);
    });
    const linksGeometry = geometry(new THREE.BufferGeometry());
    linksGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linkPositions, 3));
    const links = new THREE.LineSegments(linksGeometry, material(new THREE.LineBasicMaterial({ color: 0x9fa6b0, transparent: true, opacity: 0.18 })));
    root.add(links);

    const particleCount = coarsePointer ? 55 : 110;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i += 1) {
      const angle = i * goldenAngle;
      const radius = 5 + (i % 11) * 0.28;
      particlePositions[i * 3] = Math.cos(angle) * radius;
      particlePositions[i * 3 + 1] = Math.sin(angle * 1.7) * 4;
      particlePositions[i * 3 + 2] = -2 - (i % 9) * 0.4;
    }
    const particlesGeometry = geometry(new THREE.BufferGeometry());
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particles = new THREE.Points(particlesGeometry, material(new THREE.PointsMaterial({ color: 0xb8bdc5, size: 0.025, transparent: true, opacity: 0.45 })));
    scene.add(particles);

    let width = 0;
    let height = 0;
    const resize = () => {
      width = mount.clientWidth;
      height = mount.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    let pointerX = 0;
    let pointerY = 0;
    const onPointerMove = (event: PointerEvent) => {
      if (coarsePointer) return;
      const rect = mount.getBoundingClientRect();
      pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 0.5;
      pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 0.35;
    };
    const onPointerLeave = () => { pointerX = 0; pointerY = 0; };
    mount.addEventListener('pointermove', onPointerMove, { passive: true });
    mount.addEventListener('pointerleave', onPointerLeave, { passive: true });

    let frame = 0;
    let visible = true;
    let lastFrame = 0;
    const clock = new THREE.Clock();
    const render = (time = 0) => {
      frame = 0;
      if (!visible || document.hidden) return;
      if (coarsePointer && time - lastFrame < 32) { frame = requestAnimationFrame(render); return; }
      lastFrame = time;
      const elapsed = clock.getElapsedTime();
      if (!reduceMotion) {
        root.rotation.y += (pointerX + elapsed * 0.075 - root.rotation.y) * 0.035;
        root.rotation.x += (-pointerY - 0.16 - root.rotation.x) * 0.04;
        shell.rotation.y = -elapsed * 0.055;
        rings[0].rotation.z = 0.5 + elapsed * 0.045;
        rings[1].rotation.z = 0.2 - elapsed * 0.035;
        inner.scale.setScalar(1 + Math.sin(elapsed * 1.2) * 0.025);
        particles.rotation.y = elapsed * 0.012;
      }
      renderer.render(scene, camera);
      if (!reduceMotion) frame = requestAnimationFrame(render);
    };

    const onVisibilityChange = () => {
      if (!document.hidden && visible && !reduceMotion && !frame) frame = requestAnimationFrame(render);
    };
    const resume = () => {
      if (visible && !document.hidden && !reduceMotion && !frame) frame = requestAnimationFrame(render);
    };
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) resume();
    }, { rootMargin: '100px' });
    visibilityObserver.observe(mount);
    document.addEventListener('visibilitychange', onVisibilityChange);
    render();

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      mount.removeEventListener('pointermove', onPointerMove);
      mount.removeEventListener('pointerleave', onPointerLeave);
      geometries.forEach((item) => item.dispose());
      materials.forEach((item) => item.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  return <div className="risk-scene" ref={mountRef} aria-hidden="true" />;
}
