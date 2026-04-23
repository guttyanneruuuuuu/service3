// hero.js - Animated 3D hero background
import * as THREE from 'three';

export function initHeroScene(canvas){
  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 2.5, 8);
  camera.lookAt(0, 1, 0);

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w/h; camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  scene.add(new THREE.AmbientLight(0x404066, 0.8));
  const dir = new THREE.DirectionalLight(0xff88ff, 0.8); dir.position.set(4,6,4); scene.add(dir);
  const dir2 = new THREE.DirectionalLight(0x66aaff, 0.6); dir2.position.set(-4,3,-4); scene.add(dir2);

  // Floating colorful cubes (represent furniture abstractly)
  const group = new THREE.Group();
  const colors = [0xa855f7, 0xec4899, 0x38bdf8, 0xf59e0b, 0x22c55e, 0x6366f1];
  for(let i=0;i<24;i++){
    const s = 0.3 + Math.random()*0.6;
    const geom = Math.random() > 0.5
      ? new THREE.BoxGeometry(s,s,s)
      : new THREE.IcosahedronGeometry(s*0.7, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: colors[i%colors.length],
      roughness: 0.3, metalness: 0.4,
      emissive: colors[i%colors.length], emissiveIntensity: 0.3,
    });
    const m = new THREE.Mesh(geom, mat);
    m.position.set(
      (Math.random()-0.5)*14,
      Math.random()*6 - 1,
      (Math.random()-0.5)*14 - 4
    );
    m.userData.seed = Math.random()*Math.PI*2;
    m.userData.ySeed = Math.random();
    m.userData.rotSpeed = (Math.random()-0.5)*0.6;
    group.add(m);
  }
  scene.add(group);

  // Ground plane reflection hint
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a2a, metalness:0.6, roughness:0.4,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60,60), floorMat);
  floor.rotation.x = -Math.PI/2;
  floor.position.y = -2;
  scene.add(floor);

  // Starfield
  const starGeom = new THREE.BufferGeometry();
  const positions = new Float32Array(300*3);
  for(let i=0;i<positions.length;i++) positions[i] = (Math.random()-0.5)*40;
  starGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(starGeom, new THREE.PointsMaterial({ size: 0.05, color: 0xffffff, transparent:true, opacity:0.6 }));
  scene.add(stars);

  let rafId;
  const start = performance.now();
  const tick = () => {
    rafId = requestAnimationFrame(tick);
    const t = (performance.now() - start)/1000;
    group.children.forEach((m,i) => {
      m.rotation.x += 0.003 * m.userData.rotSpeed;
      m.rotation.y += 0.004 * m.userData.rotSpeed;
      m.position.y = m.position.y * 0.996 + (Math.sin(t + m.userData.seed) * 2 + m.userData.ySeed*2) * 0.004;
    });
    group.rotation.y = t*0.03;
    camera.position.x = Math.sin(t*0.1) * 1.5;
    camera.lookAt(0, 1, 0);
    renderer.render(scene, camera);
  };
  tick();

  return () => { cancelAnimationFrame(rafId); renderer.dispose(); };
}
