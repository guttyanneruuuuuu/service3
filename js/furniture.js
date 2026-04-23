// furniture.js - 家具の定義 & 3Dメッシュ生成（procedural）
import * as THREE from 'three';

/**
 * Furniture catalog. Each item generates its mesh procedurally
 * (no external model files = small size, fast load, fully offline).
 *
 * Categories: basic, bed, desk, kitchen, deco, plant, tech, music,
 *             fantasy (premium), neon (premium), space (premium)
 */

export const CATEGORIES = [
  { id: 'basic', name: '基本' },
  { id: 'bed',   name: 'ベッド' },
  { id: 'desk',  name: 'デスク' },
  { id: 'kitchen', name: 'キッチン' },
  { id: 'deco',  name: '装飾' },
  { id: 'plant', name: '植物' },
  { id: 'tech',  name: 'ガジェット' },
  { id: 'music', name: '音楽' },
  { id: 'fantasy', name: '✨ ファンタジー', premium: true },
  { id: 'neon',    name: '🌈 ネオン', premium: true },
  { id: 'space',   name: '🚀 宇宙', premium: true },
];

// Helper: make basic Lambert material
const mat = (color, opts={}) => new THREE.MeshStandardMaterial({
  color, roughness: opts.rough ?? 0.7, metalness: opts.metal ?? 0.0,
  emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.ei ?? 0,
  transparent: opts.transparent ?? false, opacity: opts.opacity ?? 1,
});

// Helper: build a group
const G = () => new THREE.Group();

// Simple box primitive
const box = (w,h,d,material) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material);
  m.castShadow = true; m.receiveShadow = true;
  return m;
};
const cyl = (rt,rb,h,material, seg=16) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg), material);
  m.castShadow=true; m.receiveShadow=true; return m;
};
const sph = (r, material, seg=16) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), material);
  m.castShadow=true; m.receiveShadow=true; return m;
};

// ====== Generators ======
function bedSingle(){
  const g=G();
  g.add(Object.assign(box(1.0,0.3,2.0,mat(0x8b6f4e)),{position:new THREE.Vector3(0,0.15,0)}));
  const mattress = box(0.95,0.2,1.95,mat(0xffffff));
  mattress.position.y = 0.4; g.add(mattress);
  const pillow = box(0.85,0.12,0.35,mat(0xf8b4c4));
  pillow.position.set(0,0.56,-0.75); g.add(pillow);
  const blanket = box(0.95,0.08,1.3,mat(0xa855f7));
  blanket.position.set(0,0.52,0.25); g.add(blanket);
  return { group:g, size:{w:1.0,h:0.6,d:2.0} };
}
function bedDouble(){
  const g=G();
  g.add(Object.assign(box(1.6,0.3,2.0,mat(0x8b6f4e)),{position:new THREE.Vector3(0,0.15,0)}));
  const mattress = box(1.55,0.2,1.95,mat(0xffffff)); mattress.position.y=0.4; g.add(mattress);
  const p1 = box(0.55,0.12,0.35,mat(0xf8b4c4)); p1.position.set(-0.35,0.56,-0.75); g.add(p1);
  const p2 = box(0.55,0.12,0.35,mat(0xc4b4f8)); p2.position.set(0.35,0.56,-0.75); g.add(p2);
  const blanket = box(1.55,0.08,1.3,mat(0x6366f1)); blanket.position.set(0,0.52,0.25); g.add(blanket);
  return { group:g, size:{w:1.6,h:0.6,d:2.0} };
}
function desk(){
  const g=G();
  const top = box(1.4,0.06,0.7,mat(0x8b6f4e)); top.position.y=0.75; g.add(top);
  [[-0.6,-0.3],[0.6,-0.3],[-0.6,0.3],[0.6,0.3]].forEach(([x,z])=>{
    const leg = box(0.06,0.72,0.06,mat(0x5c4630)); leg.position.set(x,0.36,z); g.add(leg);
  });
  return { group:g, size:{w:1.4,h:0.8,d:0.7} };
}
function chair(){
  const g=G();
  const seat=box(0.45,0.05,0.45,mat(0x333344)); seat.position.y=0.45; g.add(seat);
  const back=box(0.45,0.5,0.05,mat(0x333344)); back.position.set(0,0.7,-0.22); g.add(back);
  [[-0.18,-0.18],[0.18,-0.18],[-0.18,0.18],[0.18,0.18]].forEach(([x,z])=>{
    const leg = box(0.04,0.45,0.04,mat(0x222233)); leg.position.set(x,0.22,z); g.add(leg);
  });
  return { group:g, size:{w:0.45,h:0.95,d:0.45} };
}
function sofa(){
  const g=G();
  const base = box(1.8,0.35,0.8,mat(0x555566)); base.position.y=0.25; g.add(base);
  const back = box(1.8,0.55,0.2,mat(0x555566)); back.position.set(0,0.7,-0.3); g.add(back);
  const armL = box(0.2,0.4,0.8,mat(0x555566)); armL.position.set(-0.8,0.45,0); g.add(armL);
  const armR = box(0.2,0.4,0.8,mat(0x555566)); armR.position.set(0.8,0.45,0); g.add(armR);
  const cushion1 = box(0.55,0.18,0.55,mat(0xe0c4ff)); cushion1.position.set(-0.38,0.52,0.05); g.add(cushion1);
  const cushion2 = box(0.55,0.18,0.55,mat(0xc4e0ff)); cushion2.position.set(0.38,0.52,0.05); g.add(cushion2);
  return { group:g, size:{w:1.8,h:0.95,d:0.8} };
}
function table(){
  const g=G();
  const top=cyl(0.5,0.5,0.05,mat(0xaf8e68)); top.position.y=0.5; g.add(top);
  const stem=cyl(0.06,0.08,0.5,mat(0x333333)); stem.position.y=0.25; g.add(stem);
  const base=cyl(0.3,0.35,0.04,mat(0x222222)); base.position.y=0.02; g.add(base);
  return { group:g, size:{w:1.0,h:0.55,d:1.0} };
}
function bookshelf(){
  const g=G();
  const frame=box(0.9,1.8,0.3,mat(0x6b4e2e)); frame.position.y=0.9; g.add(frame);
  for(let i=0;i<4;i++){
    const shelf=box(0.84,0.02,0.26,mat(0x8b6f4e)); shelf.position.set(0,0.2+i*0.4,0); g.add(shelf);
  }
  // books
  const colors=[0xff6b6b,0x4ecdc4,0xffd93d,0x6a4c93,0x1a936f,0xf18f01,0x3a86ff];
  for(let s=0;s<4;s++){
    let x=-0.38;
    const count = 5 + Math.floor(Math.random()*4);
    for(let i=0;i<count;i++){
      const w = 0.04 + Math.random()*0.06;
      const h = 0.28 + Math.random()*0.08;
      if(x+w > 0.4) break;
      const b = box(w,h,0.22, mat(colors[Math.floor(Math.random()*colors.length)]));
      b.position.set(x+w/2, 0.2+s*0.4+h/2+0.01, 0);
      g.add(b);
      x+=w+0.005;
    }
  }
  return { group:g, size:{w:0.9,h:1.82,d:0.3} };
}
function lamp(){
  const g=G();
  const base=cyl(0.12,0.15,0.04,mat(0x222222)); base.position.y=0.02; g.add(base);
  const stem=cyl(0.02,0.02,1.2,mat(0x111111)); stem.position.y=0.62; g.add(stem);
  const shade=cyl(0.08,0.22,0.25,mat(0xfff7c0,{emissive:0xffdd88,ei:0.8}),12); shade.position.y=1.35; g.add(shade);
  const bulb = new THREE.PointLight(0xffe0a0, 1.5, 6, 2); bulb.position.y=1.3; g.add(bulb);
  return { group:g, size:{w:0.3,h:1.5,d:0.3} };
}
function plantSmall(){
  const g=G();
  const pot=cyl(0.14,0.18,0.2,mat(0x8b4513)); pot.position.y=0.1; g.add(pot);
  const leaves = sph(0.22, mat(0x2d7a2d)); leaves.position.y=0.42; leaves.scale.y=1.4; g.add(leaves);
  const l2 = sph(0.18, mat(0x3a9a3a)); l2.position.set(0.1,0.55,0.05); g.add(l2);
  return { group:g, size:{w:0.4,h:0.75,d:0.4} };
}
function plantTall(){
  const g=G();
  const pot=cyl(0.22,0.28,0.3,mat(0x6b3510)); pot.position.y=0.15; g.add(pot);
  const trunk=cyl(0.04,0.06,1.5,mat(0x5c4030)); trunk.position.y=1.05; g.add(trunk);
  for(let i=0;i<6;i++){
    const leaf = box(0.5,0.04,0.1,mat(0x2d7a2d));
    leaf.position.set(Math.cos(i)*0.25, 1.4+i*0.12, Math.sin(i)*0.25);
    leaf.rotation.z = 0.3; leaf.rotation.y=i;
    g.add(leaf);
  }
  const top = sph(0.35, mat(0x3a9a3a)); top.position.y=2.0; top.scale.set(1.2,0.8,1.2); g.add(top);
  return { group:g, size:{w:0.6,h:2.3,d:0.6} };
}
function tvSet(){
  const g=G();
  const stand = box(1.2,0.4,0.35,mat(0x222222)); stand.position.y=0.2; g.add(stand);
  const tv = box(1.4,0.8,0.06,mat(0x0a0a0a)); tv.position.set(0,0.85,-0.05); g.add(tv);
  const screen = box(1.32,0.74,0.01,mat(0x1a4a8a,{emissive:0x1a4a8a,ei:0.5})); screen.position.set(0,0.85,0); g.add(screen);
  return { group:g, size:{w:1.4,h:1.3,d:0.35} };
}
function computer(){
  const g=G();
  const base = box(0.5,0.02,0.3,mat(0x222222)); base.position.y=0.01; g.add(base);
  const stem = cyl(0.02,0.02,0.25,mat(0x111111)); stem.position.y=0.13; g.add(stem);
  const monitor = box(0.7,0.42,0.04,mat(0x0a0a0a)); monitor.position.set(0,0.45,0); g.add(monitor);
  const screen = box(0.65,0.38,0.01,mat(0x88ccff,{emissive:0x224466,ei:1.2})); screen.position.set(0,0.45,0.025); g.add(screen);
  const keyboard = box(0.5,0.03,0.18,mat(0x1a1a1a)); keyboard.position.set(0,0.01,0.35); g.add(keyboard);
  return { group:g, size:{w:0.7,h:0.7,d:0.6} };
}
function speaker(){
  const g=G();
  const body = box(0.3,0.8,0.3,mat(0x1a1a1a)); body.position.y=0.4; g.add(body);
  const cone1 = cyl(0.08,0.08,0.01,mat(0x333333)); cone1.rotation.x=Math.PI/2; cone1.position.set(0,0.58,0.16); g.add(cone1);
  const cone2 = cyl(0.12,0.12,0.01,mat(0x333333)); cone2.rotation.x=Math.PI/2; cone2.position.set(0,0.25,0.16); g.add(cone2);
  return { group:g, size:{w:0.3,h:0.8,d:0.3} };
}
function guitar(){
  const g=G();
  const body = cyl(0.2,0.22,0.06,mat(0xc77b3f),20); body.rotation.x=Math.PI/2; body.position.set(0,0.3,0); g.add(body);
  const neck = box(0.08,0.9,0.04,mat(0x3c2414)); neck.position.set(0,0.85,0); g.add(neck);
  const head = box(0.12,0.15,0.04,mat(0x3c2414)); head.position.set(0,1.35,0); g.add(head);
  return { group:g, size:{w:0.5,h:1.5,d:0.2} };
}
function piano(){
  const g=G();
  const body=box(1.4,0.9,0.4,mat(0x0a0a0a)); body.position.y=0.45; g.add(body);
  const keys=box(1.3,0.05,0.25,mat(0xffffff)); keys.position.set(0,0.72,0.12); g.add(keys);
  // black keys
  for(let i=-5;i<=5;i++){
    if(i===0 || i===3 || i===-3) continue;
    const bk = box(0.05,0.04,0.15,mat(0x000000));
    bk.position.set(i*0.1,0.75,0.07);
    g.add(bk);
  }
  return { group:g, size:{w:1.4,h:0.9,d:0.4} };
}
function rug(){
  const g=G();
  const r = box(2.0,0.02,1.4,mat(0xc04040,{rough:0.95})); r.position.y=0.01; g.add(r);
  const inner = box(1.7,0.025,1.1,mat(0xe8b040,{rough:0.95})); inner.position.y=0.018; g.add(inner);
  return { group:g, size:{w:2.0,h:0.03,d:1.4} };
}
function painting(){
  const g=G();
  const frame = box(1.0,0.7,0.04,mat(0x3c2414)); frame.position.y=0; g.add(frame);
  const art = box(0.92,0.62,0.01,mat(0x7b68ee,{emissive:0x442288,ei:0.2})); art.position.set(0,0,0.025); g.add(art);
  const stripe = box(0.92,0.08,0.012,mat(0xff6b6b)); stripe.position.set(0,0.2,0.028); g.add(stripe);
  const stripe2 = box(0.92,0.12,0.012,mat(0x4ecdc4)); stripe2.position.set(0,-0.1,0.028); g.add(stripe2);
  // note: hanging, mount on wall
  return { group:g, size:{w:1.0,h:0.7,d:0.05}, wall:true };
}
function clock(){
  const g=G();
  const face=cyl(0.25,0.25,0.04,mat(0xffffff),20); face.rotation.x=Math.PI/2; g.add(face);
  for(let i=0;i<12;i++){
    const tick=box(0.02,0.04,0.005,mat(0x000000));
    tick.position.set(Math.sin(i*Math.PI/6)*0.21,Math.cos(i*Math.PI/6)*0.21,0.025);
    g.add(tick);
  }
  const hourH=box(0.012,0.14,0.01,mat(0x000000)); hourH.position.set(0,0.07,0.03); g.add(hourH);
  const minH=box(0.008,0.2,0.01,mat(0x333333)); minH.position.set(0.02,0.1,0.035); minH.rotation.z=-0.4; g.add(minH);
  return { group:g, size:{w:0.5,h:0.5,d:0.05}, wall:true };
}
function fridge(){
  const g=G();
  const body = box(0.7,1.8,0.7,mat(0xe8e8e8,{metal:0.3,rough:0.3})); body.position.y=0.9; g.add(body);
  const handle1 = box(0.05,0.3,0.03,mat(0x888888,{metal:0.8})); handle1.position.set(0.32,1.3,0.37); g.add(handle1);
  const handle2 = box(0.05,0.3,0.03,mat(0x888888,{metal:0.8})); handle2.position.set(0.32,0.6,0.37); g.add(handle2);
  const divider = box(0.7,0.02,0.01,mat(0xc0c0c0)); divider.position.set(0,0.95,0.355); g.add(divider);
  return { group:g, size:{w:0.7,h:1.8,d:0.7} };
}
function stove(){
  const g=G();
  const body = box(0.8,0.85,0.7,mat(0xc0c0c0,{metal:0.5})); body.position.y=0.425; g.add(body);
  const top = box(0.78,0.02,0.68,mat(0x111111)); top.position.y=0.86; g.add(top);
  for(let i=0;i<4;i++){
    const burner = cyl(0.1,0.1,0.01,mat(0x333333),12);
    burner.position.set((i%2-0.5)*0.3, 0.87, (Math.floor(i/2)-0.5)*0.3);
    g.add(burner);
  }
  return { group:g, size:{w:0.8,h:0.9,d:0.7} };
}
function window_(){
  const g=G();
  const frame = box(1.2,1.2,0.08,mat(0xffffff)); g.add(frame);
  const glass = box(1.1,1.1,0.02,mat(0x87ceeb,{emissive:0x4488cc,ei:0.4,opacity:0.7,transparent:true})); glass.position.z=0.02; g.add(glass);
  const crossH = box(1.1,0.04,0.04,mat(0xffffff)); g.add(crossH);
  const crossV = box(0.04,1.1,0.04,mat(0xffffff)); g.add(crossV);
  return { group:g, size:{w:1.2,h:1.2,d:0.08}, wall:true };
}
function door(){
  const g=G();
  const frame = box(1.0,2.0,0.1,mat(0x8b4513)); frame.position.y=1.0; g.add(frame);
  const panel = box(0.85,1.85,0.03,mat(0xa0522d)); panel.position.set(0,1.0,0.04); g.add(panel);
  const knob = sph(0.04,mat(0xffd700,{metal:0.8})); knob.position.set(0.35,1.0,0.08); g.add(knob);
  return { group:g, size:{w:1.0,h:2.0,d:0.1}, wall:true };
}

// Premium
function unicorn(){
  const g=G();
  const body = box(0.8,0.4,0.3,mat(0xffc0e8)); body.position.y=0.5; g.add(body);
  const head = box(0.35,0.35,0.3,mat(0xffc0e8)); head.position.set(0.45,0.75,0); g.add(head);
  const horn = cyl(0.01,0.05,0.3,mat(0xffd700,{emissive:0xffaa00,ei:0.6}),8); horn.position.set(0.5,1.05,0); g.add(horn);
  // legs
  [[-0.3,-0.1],[0.3,-0.1],[-0.3,0.1],[0.3,0.1]].forEach(([x,z])=>{
    const leg = box(0.08,0.5,0.08,mat(0xffc0e8)); leg.position.set(x,0.25,z); g.add(leg);
  });
  // rainbow mane
  const mane = box(0.1,0.3,0.3,mat(0xff6b6b)); mane.position.set(0.3,0.85,0); g.add(mane);
  return { group:g, size:{w:1.0,h:1.2,d:0.4} };
}
function neonSign(){
  const g=G();
  const backplate = box(0.9,0.4,0.05,mat(0x0a0a0a)); g.add(backplate);
  // "LOVE" shaped neon tubes
  const neonMat = mat(0xff00aa,{emissive:0xff00aa,ei:2.5});
  const bars = [
    [-0.3,0.1,0.04,0.06,0.22,0.04],
    [-0.3,-0.02,0.04,0.18,0.04,0.04],
    [-0.1,0.1,0.04,0.06,0.22,0.04],
    [0.12,0,0.04,0.04,0.18,0.04],
    [0.12,-0.08,0.04,0.15,0.04,0.04],
    [0.3,0.1,0.04,0.06,0.22,0.04],
    [0.3,-0.02,0.04,0.06,0.04,0.04],
  ];
  bars.forEach(([x,y,z,w,h,d])=>{
    const b=box(w,h,d,neonMat); b.position.set(x,y,z); g.add(b);
  });
  const light = new THREE.PointLight(0xff00aa, 2, 4, 2); g.add(light);
  return { group:g, size:{w:0.9,h:0.4,d:0.08}, wall:true };
}
function spaceCapsule(){
  const g=G();
  const body = cyl(0.5,0.5,1.2,mat(0xd0d0d0,{metal:0.6,rough:0.3}),20); body.position.y=0.6; g.add(body);
  const top = sph(0.5,mat(0x88aaff,{metal:0.3,opacity:0.7,transparent:true})); top.position.y=1.2; top.scale.y=0.7; g.add(top);
  const base = cyl(0.6,0.5,0.1,mat(0x555555),20); base.position.y=0.05; g.add(base);
  const light = new THREE.PointLight(0x88aaff, 1, 3, 2); light.position.y=1.2; g.add(light);
  return { group:g, size:{w:1.2,h:1.75,d:1.2} };
}
function aquarium(){
  const g=G();
  const base = box(1.0,0.05,0.4,mat(0x1a1a1a)); base.position.y=0.025; g.add(base);
  const glass = box(1.0,0.6,0.4,mat(0x66ddff,{emissive:0x3399ee,ei:0.4,opacity:0.35,transparent:true}));
  glass.position.y=0.35; g.add(glass);
  // fake fish
  for(let i=0;i<4;i++){
    const fish = box(0.08,0.04,0.04,mat([0xff6b6b,0xffdd33,0x88ff66,0xff99cc][i]));
    fish.position.set(-0.35+i*0.25, 0.3+Math.random()*0.2, 0);
    g.add(fish);
  }
  const light = new THREE.PointLight(0x66ddff, 0.8, 3, 2); light.position.y=0.6; g.add(light);
  return { group:g, size:{w:1.0,h:0.65,d:0.4} };
}
function gamingChair(){
  const g=G();
  const seat = box(0.55,0.08,0.55,mat(0x1a1a1a)); seat.position.y=0.48; g.add(seat);
  const back = box(0.55,0.9,0.1,mat(0x1a1a1a)); back.position.set(0,0.95,-0.22); g.add(back);
  // red stripes
  const stripe = box(0.4,0.7,0.015,mat(0xff2040,{emissive:0xff0020,ei:0.3}));
  stripe.position.set(0,0.95,-0.16); g.add(stripe);
  const armL = box(0.05,0.3,0.3,mat(0x111111)); armL.position.set(-0.3,0.7,0); g.add(armL);
  const armR = box(0.05,0.3,0.3,mat(0x111111)); armR.position.set(0.3,0.7,0); g.add(armR);
  const wheel = cyl(0.15,0.18,0.05,mat(0x111111),8); wheel.position.y=0.05; g.add(wheel);
  return { group:g, size:{w:0.6,h:1.4,d:0.6} };
}
function holoTable(){
  const g=G();
  const base = cyl(0.5,0.6,0.1,mat(0x1a1a1a),20); base.position.y=0.05; g.add(base);
  const top = cyl(0.6,0.5,0.05,mat(0x0a0a0a)); top.position.y=0.7; g.add(top);
  // holographic projection
  const holo = cyl(0.3,0.1,0.8,mat(0x00ffff,{emissive:0x00ffff,ei:1.8,opacity:0.3,transparent:true}),12);
  holo.position.y=1.15; g.add(holo);
  const light = new THREE.PointLight(0x00ffff, 2, 4, 2); light.position.y=1.2; g.add(light);
  return { group:g, size:{w:1.2,h:1.6,d:1.2} };
}
function crystalBall(){
  const g=G();
  const stand = cyl(0.15,0.2,0.1,mat(0x3c2414)); stand.position.y=0.05; g.add(stand);
  const ball = sph(0.18,mat(0xa855f7,{emissive:0xa855f7,ei:0.8,opacity:0.7,transparent:true,metal:0.5}),20);
  ball.position.y=0.3; g.add(ball);
  const light = new THREE.PointLight(0xa855f7, 1.2, 3, 2); light.position.y=0.3; g.add(light);
  return { group:g, size:{w:0.4,h:0.5,d:0.4} };
}
function floatingIsland(){
  const g=G();
  // rock base inverted cone-ish
  const rock = cyl(0.6,0.1,0.5,mat(0x5a4a3a),8); rock.position.y=0.25; g.add(rock);
  const grass = cyl(0.62,0.6,0.08,mat(0x4a9a3a)); grass.position.y=0.54; g.add(grass);
  // tiny tree
  const trunk = cyl(0.03,0.04,0.3,mat(0x4a2e1a)); trunk.position.set(0,0.73,0); g.add(trunk);
  const leaves = sph(0.2,mat(0x2d7a2d)); leaves.position.set(0,0.95,0); g.add(leaves);
  // glow
  const glow = cyl(0.65,0.12,0.02,mat(0x88ddff,{emissive:0x88ddff,ei:2}),12); glow.position.y=0.13; g.add(glow);
  const light = new THREE.PointLight(0x88ddff, 1, 3, 2); light.position.y=0.1; g.add(light);
  return { group:g, size:{w:1.4,h:1.2,d:1.4} };
}

// ===== Catalog =====
export const FURNITURE = [
  // Basic
  { id:'chair',    name:'椅子',     icon:'🪑', cat:'basic', build:chair },
  { id:'table',    name:'テーブル', icon:'🪵', cat:'basic', build:table },
  { id:'sofa',     name:'ソファ',   icon:'🛋️', cat:'basic', build:sofa },
  { id:'rug',      name:'ラグ',     icon:'🟥', cat:'basic', build:rug },
  { id:'door',     name:'ドア',     icon:'🚪', cat:'basic', build:door },
  { id:'window',   name:'窓',       icon:'🪟', cat:'basic', build:window_ },
  // Bed
  { id:'bed',      name:'シングルベッド', icon:'🛏️', cat:'bed', build:bedSingle },
  { id:'beddbl',   name:'ダブルベッド',   icon:'🛌', cat:'bed', build:bedDouble },
  // Desk
  { id:'desk',     name:'デスク',   icon:'🗄️', cat:'desk', build:desk },
  { id:'computer', name:'PC',       icon:'💻', cat:'desk', build:computer },
  { id:'lamp',     name:'ランプ',   icon:'💡', cat:'desk', build:lamp },
  { id:'bookshelf',name:'本棚',     icon:'📚', cat:'desk', build:bookshelf },
  // Kitchen
  { id:'fridge',   name:'冷蔵庫',   icon:'🧊', cat:'kitchen', build:fridge },
  { id:'stove',    name:'コンロ',   icon:'🔥', cat:'kitchen', build:stove },
  // Deco
  { id:'painting', name:'絵画',     icon:'🖼️', cat:'deco', build:painting },
  { id:'clock',    name:'時計',     icon:'🕰️', cat:'deco', build:clock },
  { id:'tv',       name:'テレビ',   icon:'📺', cat:'deco', build:tvSet },
  // Plant
  { id:'plant',    name:'観葉植物', icon:'🪴', cat:'plant', build:plantSmall },
  { id:'planttall',name:'大型植物', icon:'🌴', cat:'plant', build:plantTall },
  // Tech
  { id:'speaker',  name:'スピーカー', icon:'🔊', cat:'tech', build:speaker },
  // Music
  { id:'guitar',   name:'ギター',   icon:'🎸', cat:'music', build:guitar },
  { id:'piano',    name:'ピアノ',   icon:'🎹', cat:'music', build:piano },

  // Premium
  { id:'unicorn',  name:'ユニコーン', icon:'🦄', cat:'fantasy', premium:true, build:unicorn },
  { id:'crystal',  name:'水晶玉',   icon:'🔮', cat:'fantasy', premium:true, build:crystalBall },
  { id:'island',   name:'浮遊島',   icon:'🏝️', cat:'fantasy', premium:true, build:floatingIsland },
  { id:'neon',     name:'ネオン看板', icon:'💗', cat:'neon', premium:true, build:neonSign },
  { id:'gchair',   name:'ゲーミング', icon:'🎮', cat:'neon', premium:true, build:gamingChair },
  { id:'holo',     name:'ホロテーブル', icon:'🌀', cat:'neon', premium:true, build:holoTable },
  { id:'capsule',  name:'宇宙カプセル', icon:'🚀', cat:'space', premium:true, build:spaceCapsule },
  { id:'aquarium', name:'水槽',     icon:'🐠', cat:'space', premium:true, build:aquarium },
];

// Lookup
export const FURNITURE_MAP = Object.fromEntries(FURNITURE.map(f=>[f.id,f]));

// Themes (affect lighting + floor/wall colors + sky)
export const THEMES = [
  { id:'cozy',     name:'ほっこり',   floor:'#8b6f4e', wall:'#f0e8dc', sky:'#ffe4b5', ambient:0x604020, light:0xfff4d8, premium:false },
  { id:'modern',   name:'モダン',     floor:'#d4c8b8', wall:'#f5f5f0', sky:'#e0e8f0', ambient:0x445566, light:0xffffff, premium:false },
  { id:'dark',     name:'ダーク',     floor:'#2a2a36', wall:'#1a1a24', sky:'#0a0a12', ambient:0x1a1a2a, light:0x8888aa, premium:false },
  { id:'kawaii',   name:'カワイイ',   floor:'#ffd8e8', wall:'#fff0f8', sky:'#ffb8d8', ambient:0x884466, light:0xffddee, premium:false },
  { id:'neon',     name:'🌈 ネオン',  floor:'#0a0a1a', wall:'#1a0a2a', sky:'#1a0030', ambient:0x220044, light:0xff00ff, premium:true },
  { id:'space',    name:'🌌 宇宙',    floor:'#0a0a18', wall:'#101028', sky:'#000008', ambient:0x000022, light:0x6688ff, premium:true },
  { id:'aqua',     name:'🌊 水中',    floor:'#0a3a5a', wall:'#0a4a6a', sky:'#002a4a', ambient:0x003355, light:0x66ddff, premium:true },
  { id:'anime',    name:'✨ アニメ',   floor:'#fff4d8', wall:'#ffe4a8', sky:'#ff88cc', ambient:0x884466, light:0xffccee, premium:true },
];
export const THEME_MAP = Object.fromEntries(THEMES.map(t=>[t.id,t]));
