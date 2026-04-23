// ============================================================
// 3D Avatar Generator (Three.js)
// 顔特徴量 + スタイル + レアリティから手続き的に3Dアバターを生成
// ============================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { seededRandom } from './face.js';

/**
 * シーン・カメラ・レンダラ・コントロールを管理
 */
export class AvatarStage {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = null; // 透過して背景グラデに任せる

    const { clientWidth: w, clientHeight: h } = container;
    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
    this.camera.position.set(0, 0.3, 4.8);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true, // スクショ・録画用
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(ambient);
    const key = new THREE.DirectionalLight(0xfff0e0, 1.4);
    key.position.set(3, 5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xb388ff, 1.6);
    rim.position.set(-4, 2, -3);
    this.scene.add(rim);
    const rim2 = new THREE.DirectionalLight(0x00e5ff, 1.0);
    rim2.position.set(4, -1, -2);
    this.scene.add(rim2);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 2.8;
    this.controls.maxDistance = 7;
    this.controls.target.set(0, 0.2, 0);
    this.controls.enablePan = false;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 1.2;

    this.avatarGroup = new THREE.Group();
    this.scene.add(this.avatarGroup);

    // Ground shadow plane
    const groundGeom = new THREE.CircleGeometry(2, 40);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.35 });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.35;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this._resize = this._resize.bind(this);
    window.addEventListener('resize', this._resize);

    this._animate = this._animate.bind(this);
    this._running = true;
    requestAnimationFrame(this._animate);
  }

  _resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _animate() {
    if (!this._running) return;
    this.controls.update();

    // アニメーション用の周期更新
    const t = performance.now() * 0.001;
    if (this.onUpdate) this.onUpdate(t);

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._animate);
  }

  clearAvatar() {
    while (this.avatarGroup.children.length > 0) {
      const obj = this.avatarGroup.children[0];
      this.avatarGroup.remove(obj);
      obj.traverse?.((c) => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
          else c.material.dispose();
        }
      });
    }
    this.onUpdate = null;
  }

  setAvatar(group, onUpdate) {
    this.clearAvatar();
    this.avatarGroup.add(group);
    this.onUpdate = onUpdate;
  }

  captureSnapshot(mime = 'image/png') {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL(mime);
  }

  getCanvas() {
    return this.renderer.domElement;
  }

  dispose() {
    this._running = false;
    window.removeEventListener('resize', this._resize);
    this.controls.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}

// ============================================================
// Avatar Generation
// ============================================================

const RARITIES = [
  { key: 'R', label: 'R', weight: 80, color: 0x94a3b8 },
  { key: 'SR', label: 'SR', weight: 16, color: 0xa78bfa },
  { key: 'SSR', label: 'SSR', weight: 4, color: 0xffd54a },
];

/**
 * レアリティをガチャ抽選
 */
export function rollRarity(rng = Math.random) {
  const total = RARITIES.reduce((s, r) => s + r.weight, 0);
  let n = rng() * total;
  for (const r of RARITIES) {
    n -= r.weight;
    if (n <= 0) return r;
  }
  return RARITIES[0];
}

/**
 * アバター生成メイン
 */
export function generateAvatar({ features, style, rarity }) {
  const rng = seededRandom(features.seed + Date.now());
  const group = new THREE.Group();

  let parts;
  switch (style) {
    case 'voxel':   parts = buildVoxel(features, rarity, rng); break;
    case 'lowpoly': parts = buildLowPoly(features, rarity, rng); break;
    case 'cyber':   parts = buildCyber(features, rarity, rng); break;
    case 'bio':     parts = buildBio(features, rarity, rng); break;
    case 'fantasy': parts = buildFantasy(features, rarity, rng); break;
    case 'crystal': parts = buildCrystal(features, rarity, rng); break;
    default:        parts = buildLowPoly(features, rarity, rng);
  }
  group.add(parts.root);

  // レアリティ演出
  addRarityEffects(group, rarity, rng);

  // ステータス算出
  const stats = calculateStats(features, rarity, rng);

  // 名前生成
  const avatarName = generateAvatarName(style, rarity, rng);

  return {
    group,
    stats,
    avatarName,
    update: parts.update || null,
  };
}

// ============================================================
// Stats & Name
// ============================================================
function calculateStats(features, rarity, rng) {
  const bonus = rarity.key === 'SSR' ? 40 : rarity.key === 'SR' ? 20 : 0;
  return {
    power: Math.min(99, Math.floor(30 + rng() * 50 + bonus + features.saturation * 30)),
    magic: Math.min(99, Math.floor(30 + rng() * 50 + bonus + features.brightness * 30)),
    speed: Math.min(99, Math.floor(30 + rng() * 50 + bonus)),
    luck:  Math.min(99, Math.floor(30 + rng() * 50 + bonus)),
  };
}

const NAME_PREFIX = ['ZE', 'RY', 'KA', 'MI', 'VA', 'NO', 'XE', 'LU', 'BY', 'OR', 'IN', 'DR', 'TE', 'AZ', 'FY'];
const NAME_MID = ['RON', 'LUX', 'VOR', 'RIS', 'NOX', 'SOL', 'KAI', 'ZEN', 'MIR', 'ARC', 'VEL', 'OCT'];
const NAME_SUFFIX = ['-α', '-β', '-γ', '', '-X', '-Ω', '-7', '-01', '-EX', ''];
const TITLE = {
  voxel:   ['PIXEL', 'BLOX', 'BIT', 'CUBE', 'VOX'],
  lowpoly: ['POLY', 'MESH', 'EDGE', 'VERT', 'TRI'],
  cyber:   ['CYBR', 'NEON', 'GRID', 'SYN', 'HACK'],
  bio:     ['FLESH', 'SINEW', 'ORGA', 'NEURO', 'GENE'],
  fantasy: ['KNIGHT', 'MAGE', 'SAGE', 'LORD', 'WARRIOR'],
  crystal: ['PRISM', 'SHARD', 'GEM', 'CRYST', 'FACET'],
};
function generateAvatarName(style, rarity, rng) {
  const p = NAME_PREFIX[Math.floor(rng() * NAME_PREFIX.length)];
  const m = NAME_MID[Math.floor(rng() * NAME_MID.length)];
  const s = NAME_SUFFIX[Math.floor(rng() * NAME_SUFFIX.length)];
  const t = TITLE[style]?.[Math.floor(rng() * (TITLE[style]?.length || 1))] || '';
  const prefix = rarity.key === 'SSR' ? '★ ' : rarity.key === 'SR' ? '◆ ' : '';
  return `${prefix}${p}${m}${s} / ${t}`;
}

// ============================================================
// Style 1: VOXEL (マイクラ/ドット絵風)
// ============================================================
function buildVoxel(features, rarity, rng) {
  const root = new THREE.Group();
  const skin = new THREE.Color(features.palette.skin);
  const hair = new THREE.Color(features.palette.hair);
  const accent = new THREE.Color(features.palette.accent);
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });

  // ヘッド (8x8x8ブロック風だが実際は1キューブ)
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), mat(skin));
  head.position.y = 0.6; head.castShadow = true; root.add(head);

  // 髪 (上に薄いブロック)
  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.3, 1.15), mat(hair));
  hairTop.position.y = 1.28; hairTop.castShadow = true; root.add(hairTop);

  // 髪サイド
  if (features.hairRatio > 0.2) {
    const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 1.15), mat(hair));
    sideL.position.set(-0.64, 0.85, 0); root.add(sideL);
    const sideR = sideL.clone(); sideR.position.x = 0.64; root.add(sideR);
  }

  // 目 (ブロック)
  const eyeMat = mat(new THREE.Color('#1a1a2a'));
  const ey = 0.65, es = 0.12;
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(es, es, 0.05), eyeMat);
  eyeL.position.set(-0.22, ey, 0.56); root.add(eyeL);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.22; root.add(eyeR);

  // 目の輝き (SR/SSR)
  if (rarity.key !== 'R') {
    const sparkMat = new THREE.MeshBasicMaterial({ color: rarity.key === 'SSR' ? 0xffd54a : 0x00e5ff });
    const s = 0.04;
    const sp1 = new THREE.Mesh(new THREE.BoxGeometry(s, s, 0.02), sparkMat);
    sp1.position.set(-0.18, ey + 0.03, 0.59); root.add(sp1);
    const sp2 = sp1.clone(); sp2.position.x = 0.26; root.add(sp2);
  }

  // 口
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.04), mat(new THREE.Color('#7a2a2a')));
  mouth.position.set(0, 0.35, 0.56); root.add(mouth);

  // ボディ (縦長ブロック)
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.2, 0.6), mat(accent));
  body.position.y = -0.4; body.castShadow = true; root.add(body);

  // 腕
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.0, 0.3), mat(skin));
  armL.position.set(-0.7, -0.4, 0); armL.castShadow = true; root.add(armL);
  const armR = armL.clone(); armR.position.x = 0.7; root.add(armR);

  // 脚
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.9, 0.4), mat(new THREE.Color('#2a2a5a')));
  legL.position.set(-0.22, -1.45, 0); legL.castShadow = true; root.add(legL);
  const legR = legL.clone(); legR.position.x = 0.22; root.add(legR);

  // SSRクラウン
  if (rarity.key === 'SSR') {
    const crown = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 1.2), new THREE.MeshStandardMaterial({ color: 0xffd54a, metalness: 0.9, roughness: 0.2, emissive: 0xffa500, emissiveIntensity: 0.3 }));
    crown.position.y = 1.55; root.add(crown);
    for (let i = 0; i < 4; i++) {
      const pk = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.15), new THREE.MeshStandardMaterial({ color: 0xffd54a, metalness: 0.9, roughness: 0.2 }));
      const a = (i / 4) * Math.PI * 2;
      pk.position.set(Math.cos(a) * 0.5, 1.75, Math.sin(a) * 0.5);
      root.add(pk);
    }
  }

  root.scale.setScalar(0.85);
  root.position.y = 0.3;

  return {
    root,
    update: (t) => { root.rotation.y = 0; }, // OrbitControlsに任せる
  };
}

// ============================================================
// Style 2: LOW POLY (ゲームキャラ風)
// ============================================================
function buildLowPoly(features, rarity, rng) {
  const root = new THREE.Group();
  const skin = new THREE.Color(features.palette.skin);
  const hair = new THREE.Color(features.palette.hair);
  const accent = new THREE.Color(features.palette.accent);
  const smat = (c, m = 0.1, r = 0.7) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r, flatShading: true });

  // 頭 (低ポリ球)
  const headGeom = new THREE.IcosahedronGeometry(0.7, 1);
  const head = new THREE.Mesh(headGeom, smat(skin));
  head.position.y = 0.6; head.castShadow = true; root.add(head);

  // 髪（半球キャップ）
  const hairGeom = new THREE.SphereGeometry(0.75, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2.2);
  const hairMesh = new THREE.Mesh(hairGeom, smat(hair, 0.0, 0.9));
  hairMesh.position.y = 0.7; hairMesh.castShadow = true;
  // フラットシェーディング用に頂点を少しランダムに動かす
  const pos = hairGeom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > 0.2) {
      pos.setX(i, pos.getX(i) * (1 + (rng() - 0.5) * 0.2));
      pos.setZ(i, pos.getZ(i) * (1 + (rng() - 0.5) * 0.2));
    }
  }
  pos.needsUpdate = true; hairGeom.computeVertexNormals();
  root.add(hairMesh);

  // 目
  const eyeMat = new THREE.MeshBasicMaterial({ color: rarity.key === 'SSR' ? 0xffd54a : rarity.key === 'SR' ? 0x00e5ff : 0x222244 });
  const eyeGeom = new THREE.SphereGeometry(0.07, 8, 6);
  const eyeL = new THREE.Mesh(eyeGeom, eyeMat);
  eyeL.position.set(-0.2, 0.65, 0.6); root.add(eyeL);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.2; root.add(eyeR);

  // ボディ (テーパー円柱)
  const bodyGeom = new THREE.CylinderGeometry(0.35, 0.55, 1.3, 6);
  const body = new THREE.Mesh(bodyGeom, smat(accent, 0.2, 0.6));
  body.position.y = -0.4; body.castShadow = true; root.add(body);

  // 肩アーマー
  const shLGeom = new THREE.IcosahedronGeometry(0.25, 0);
  const shL = new THREE.Mesh(shLGeom, smat(new THREE.Color(features.palette.bg), 0.5, 0.4));
  shL.position.set(-0.55, 0.1, 0); shL.castShadow = true; root.add(shL);
  const shR = shL.clone(); shR.position.x = 0.55; root.add(shR);

  // 腕
  const armGeom = new THREE.CylinderGeometry(0.12, 0.15, 0.9, 5);
  const armL = new THREE.Mesh(armGeom, smat(skin));
  armL.position.set(-0.6, -0.35, 0); armL.castShadow = true;
  armL.rotation.z = 0.15; root.add(armL);
  const armR = armL.clone(); armR.position.x = 0.6; armR.rotation.z = -0.15; root.add(armR);

  // 脚
  const legGeom = new THREE.CylinderGeometry(0.15, 0.13, 0.9, 5);
  const legL = new THREE.Mesh(legGeom, smat(new THREE.Color('#2a2545'), 0.1, 0.8));
  legL.position.set(-0.2, -1.5, 0); legL.castShadow = true; root.add(legL);
  const legR = legL.clone(); legR.position.x = 0.2; root.add(legR);

  // SSR: ソード
  if (rarity.key === 'SSR') {
    const bladeGeom = new THREE.BoxGeometry(0.08, 1.4, 0.02);
    const blade = new THREE.Mesh(bladeGeom, new THREE.MeshStandardMaterial({ color: 0xccccff, metalness: 1, roughness: 0.1, emissive: 0x8899ff, emissiveIntensity: 0.4 }));
    blade.position.set(0.85, 0.1, 0); root.add(blade);
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.08), new THREE.MeshStandardMaterial({ color: 0xffd54a, metalness: 0.9, roughness: 0.2 }));
    hilt.position.set(0.85, -0.6, 0); root.add(hilt);
  }

  return {
    root,
    update: (t) => {
      // わずかに呼吸
      body.scale.y = 1 + Math.sin(t * 2) * 0.02;
    },
  };
}

// ============================================================
// Style 3: CYBER (サイバーパンク)
// ============================================================
function buildCyber(features, rarity, rng) {
  const root = new THREE.Group();
  const skin = new THREE.Color(features.palette.skin).lerp(new THREE.Color('#9988ff'), 0.15);
  const neon = rarity.key === 'SSR' ? new THREE.Color(0xffd54a) : rarity.key === 'SR' ? new THREE.Color(0xff3cac) : new THREE.Color(0x00e5ff);

  const metalMat = new THREE.MeshStandardMaterial({ color: 0x2a1a45, metalness: 0.95, roughness: 0.25 });
  const neonMat = new THREE.MeshStandardMaterial({ color: neon, emissive: neon, emissiveIntensity: 1.8, metalness: 0.3, roughness: 0.4 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, metalness: 0.1, roughness: 0.5 });

  // 頭
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.68, 24, 20), skinMat);
  head.position.y = 0.6; head.castShadow = true; root.add(head);

  // バイザー (サイバーゴーグル)
  const visorGeom = new THREE.TorusGeometry(0.45, 0.1, 8, 24, Math.PI);
  const visor = new THREE.Mesh(visorGeom, metalMat);
  visor.position.set(0, 0.65, 0.15); visor.rotation.x = Math.PI / 2; visor.rotation.z = Math.PI; root.add(visor);

  // ネオンライン（バイザーの光る部分）
  const lineGeom = new THREE.TorusGeometry(0.45, 0.03, 6, 24, Math.PI);
  const line = new THREE.Mesh(lineGeom, neonMat);
  line.position.set(0, 0.65, 0.25); line.rotation.x = Math.PI / 2; line.rotation.z = Math.PI; root.add(line);

  // 耳のチップ
  const chipGeom = new THREE.BoxGeometry(0.08, 0.12, 0.04);
  const chipL = new THREE.Mesh(chipGeom, neonMat);
  chipL.position.set(-0.72, 0.55, 0); root.add(chipL);
  const chipR = chipL.clone(); chipR.position.x = 0.72; root.add(chipR);

  // 髪（モヒカン風）
  const mohGeom = new THREE.BoxGeometry(0.15, 0.5, 0.9);
  const moh = new THREE.Mesh(mohGeom, new THREE.MeshStandardMaterial({ color: neon, emissive: neon, emissiveIntensity: 0.6 }));
  moh.position.y = 1.15; moh.castShadow = true; root.add(moh);

  // ボディ (メカアーマー)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.55), metalMat);
  torso.position.y = -0.35; torso.castShadow = true; root.add(torso);
  // コアライト
  const core = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), neonMat);
  core.position.set(0, -0.2, 0.28); root.add(core);

  // 肩アーマー
  const shGeom = new THREE.BoxGeometry(0.4, 0.3, 0.4);
  const shL = new THREE.Mesh(shGeom, metalMat);
  shL.position.set(-0.62, 0.1, 0); shL.castShadow = true; root.add(shL);
  const shR = shL.clone(); shR.position.x = 0.62; root.add(shR);

  // 腕（メカ）
  const armGeom = new THREE.CylinderGeometry(0.1, 0.13, 0.85, 8);
  const armL = new THREE.Mesh(armGeom, metalMat);
  armL.position.set(-0.62, -0.4, 0); armL.castShadow = true; root.add(armL);
  const armR = armL.clone(); armR.position.x = 0.62; root.add(armR);

  // 腕ライン
  for (let side = 0; side < 2; side++) {
    const x = side === 0 ? -0.62 : 0.62;
    const lineSmall = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.02, 6, 16), neonMat);
    lineSmall.position.set(x, -0.4, 0); lineSmall.rotation.x = Math.PI / 2; root.add(lineSmall);
  }

  // 脚
  const legGeom = new THREE.CylinderGeometry(0.14, 0.11, 0.95, 8);
  const legL = new THREE.Mesh(legGeom, metalMat);
  legL.position.set(-0.22, -1.45, 0); legL.castShadow = true; root.add(legL);
  const legR = legL.clone(); legR.position.x = 0.22; root.add(legR);

  // グリッチ用ネオンタイル（背景寄り）
  const neonGroup = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const tile = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.04), neonMat);
    tile.position.set((rng() - 0.5) * 3, (rng() - 0.5) * 3, -1.5 - rng() * 0.5);
    neonGroup.add(tile);
  }
  root.add(neonGroup);

  // SSR: ホログラムウィング
  if (rarity.key === 'SSR') {
    const wingMat = new THREE.MeshStandardMaterial({ color: 0xffd54a, emissive: 0xffa500, emissiveIntensity: 1.2, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? 1 : -1;
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), wingMat);
      wing.position.set(sign * 0.9, 0.1, -0.2);
      wing.rotation.y = sign * 0.3;
      root.add(wing);
    }
  }

  return {
    root,
    update: (t) => {
      line.material.emissiveIntensity = 1.5 + Math.sin(t * 4) * 0.5;
      core.material.emissiveIntensity = 1.5 + Math.sin(t * 3) * 0.5;
      neonGroup.children.forEach((c, i) => {
        c.material.opacity = 0.5 + Math.sin(t * 2 + i) * 0.4;
      });
    },
  };
}

// ============================================================
// Style 4: BIO MECH (バイオメカ)
// ============================================================
function buildBio(features, rarity, rng) {
  const root = new THREE.Group();
  const organic = new THREE.Color(features.palette.skin).lerp(new THREE.Color('#3a5544'), 0.3);
  const veins = new THREE.Color('#ff3cac');

  const fleshMat = new THREE.MeshStandardMaterial({ color: organic, metalness: 0.1, roughness: 0.85, flatShading: false });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x444455, metalness: 0.9, roughness: 0.3 });
  const veinMat = new THREE.MeshStandardMaterial({ color: veins, emissive: veins, emissiveIntensity: 0.9, metalness: 0.0, roughness: 0.6 });

  // 頭 (歪な球)
  const headGeom = new THREE.SphereGeometry(0.68, 24, 20);
  const hp = headGeom.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    const x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i);
    const noise = (rng() - 0.5) * 0.08;
    hp.setXYZ(i, x + noise, y + (rng() - 0.5) * 0.05, z + noise);
  }
  hp.needsUpdate = true; headGeom.computeVertexNormals();
  const head = new THREE.Mesh(headGeom, fleshMat);
  head.position.y = 0.6; head.castShadow = true; root.add(head);

  // 頭頂メカ部
  const topMech = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 0.3, 8), metalMat);
  topMech.position.y = 1.05; topMech.castShadow = true; root.add(topMech);

  // ケーブル
  for (let i = 0; i < 5; i++) {
    const cableGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6);
    const cable = new THREE.Mesh(cableGeom, metalMat);
    const a = (i / 5) * Math.PI * 2;
    cable.position.set(Math.cos(a) * 0.4, 1.3, Math.sin(a) * 0.4);
    cable.rotation.z = Math.cos(a) * 0.3;
    cable.rotation.x = Math.sin(a) * 0.3;
    root.add(cable);
  }

  // 目（光る）
  const eyeMat = new THREE.MeshStandardMaterial({ color: veins, emissive: veins, emissiveIntensity: 2.5 });
  const eyeGeom = new THREE.SphereGeometry(0.08, 10, 8);
  const eyeL = new THREE.Mesh(eyeGeom, eyeMat);
  eyeL.position.set(-0.22, 0.6, 0.58); root.add(eyeL);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.22; root.add(eyeR);

  // ボディ (歪んだ形)
  const bodyGeom = new THREE.CapsuleGeometry(0.45, 0.6, 8, 16);
  const bp = bodyGeom.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i);
    bp.setXYZ(i, x + (rng() - 0.5) * 0.06, y, z + (rng() - 0.5) * 0.06);
  }
  bp.needsUpdate = true; bodyGeom.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeom, fleshMat);
  body.position.y = -0.3; body.castShadow = true; root.add(body);

  // 肋骨状のメカ
  const ribs = [];
  for (let i = 0; i < 4; i++) {
    const ribGeom = new THREE.TorusGeometry(0.5 - i * 0.02, 0.03, 6, 16, Math.PI);
    const rib = new THREE.Mesh(ribGeom, metalMat);
    rib.position.set(0, -0.1 - i * 0.15, 0.1);
    rib.rotation.y = Math.PI / 2;
    root.add(rib);
    ribs.push(rib);
  }

  // 血管的な光るライン
  const veinGroup = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const vGeom = new THREE.CylinderGeometry(0.015, 0.015, 0.8 + rng() * 0.4, 6);
    const v = new THREE.Mesh(vGeom, veinMat);
    const a = (i / 6) * Math.PI * 2;
    v.position.set(Math.cos(a) * 0.4, -0.3 + (rng() - 0.5) * 0.3, Math.sin(a) * 0.4);
    v.rotation.z = Math.cos(a) * 0.2;
    v.rotation.x = Math.sin(a) * 0.2;
    veinGroup.add(v);
  }
  root.add(veinGroup);

  // 腕（メカ+有機）
  const armMechGeom = new THREE.CylinderGeometry(0.11, 0.14, 0.9, 8);
  const armL = new THREE.Mesh(armMechGeom, metalMat);
  armL.position.set(-0.6, -0.3, 0); armL.castShadow = true; root.add(armL);
  const armR = armL.clone(); armR.position.x = 0.6; root.add(armR);

  // クロー (手)
  for (let side = 0; side < 2; side++) {
    const sign = side === 0 ? -1 : 1;
    for (let f = 0; f < 3; f++) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.18, 6), metalMat);
      claw.position.set(sign * 0.6 + (f - 1) * 0.05, -0.85, 0);
      claw.rotation.z = sign * 0.3;
      root.add(claw);
    }
  }

  // 脚
  const legGeom = new THREE.CylinderGeometry(0.14, 0.1, 0.95, 8);
  const legL = new THREE.Mesh(legGeom, fleshMat);
  legL.position.set(-0.22, -1.45, 0); legL.castShadow = true; root.add(legL);
  const legR = legL.clone(); legR.position.x = 0.22; root.add(legR);

  // SSR: 背中の翼骨
  if (rarity.key === 'SSR') {
    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? -1 : 1;
      const wing = new THREE.Group();
      for (let j = 0; j < 4; j++) {
        const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7 + j * 0.1, 6), metalMat);
        bone.position.set(sign * (0.4 + j * 0.15), 0.3 - j * 0.1, -0.2);
        bone.rotation.z = sign * (Math.PI / 3 + j * 0.1);
        wing.add(bone);
      }
      root.add(wing);
    }
  }

  return {
    root,
    update: (t) => {
      eyeL.material.emissiveIntensity = 2 + Math.sin(t * 3) * 1;
      eyeR.material.emissiveIntensity = 2 + Math.sin(t * 3 + 0.3) * 1;
      veinGroup.children.forEach((c, i) => {
        c.material.emissiveIntensity = 0.5 + Math.sin(t * 2 + i * 0.5) * 0.6;
      });
    },
  };
}

// ============================================================
// Style 5: FANTASY (騎士/魔法使い)
// ============================================================
function buildFantasy(features, rarity, rng) {
  const root = new THREE.Group();
  const skin = new THREE.Color(features.palette.skin);
  const hair = new THREE.Color(features.palette.hair);
  const armor = rarity.key === 'SSR' ? new THREE.Color(0xffd54a) : rarity.key === 'SR' ? new THREE.Color(0xc0c0c0) : new THREE.Color(0x8a5a3a);
  const cloth = new THREE.Color(features.palette.accent);

  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
  const armorMat = new THREE.MeshStandardMaterial({ color: armor, metalness: 0.9, roughness: 0.3 });
  const clothMat = new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.9 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.85 });

  // 頭
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 16), skinMat);
  head.position.y = 0.65; head.castShadow = true; root.add(head);

  // ヘルム or 帽子
  const isWizard = rng() > 0.5;
  if (isWizard) {
    const hatGeom = new THREE.ConeGeometry(0.55, 1.0, 16);
    const hat = new THREE.Mesh(hatGeom, new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.85 }));
    hat.position.y = 1.4; hat.castShadow = true; root.add(hat);
    const brimGeom = new THREE.TorusGeometry(0.5, 0.1, 8, 20);
    const brim = new THREE.Mesh(brimGeom, new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.85 }));
    brim.position.y = 1.0; brim.rotation.x = Math.PI / 2; root.add(brim);
  } else {
    // ヘルム
    const helmGeom = new THREE.SphereGeometry(0.6, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.5);
    const helm = new THREE.Mesh(helmGeom, armorMat);
    helm.position.y = 0.75; helm.castShadow = true; root.add(helm);
    // フェイスガード
    const guardGeom = new THREE.BoxGeometry(0.7, 0.2, 0.1);
    const guard = new THREE.Mesh(guardGeom, armorMat);
    guard.position.set(0, 0.6, 0.52); root.add(guard);
    // ホーン (SSR)
    if (rarity.key === 'SSR') {
      for (let side = 0; side < 2; side++) {
        const sign = side === 0 ? -1 : 1;
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 8), armorMat);
        horn.position.set(sign * 0.45, 1.1, 0);
        horn.rotation.z = sign * 0.5;
        root.add(horn);
      }
    }
  }

  // 髪 (帽子タイプでも少しはみ出す)
  if (features.hairRatio > 0.15 && isWizard) {
    const hairSide = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 10, 0, Math.PI * 2, Math.PI / 2.5, Math.PI / 4), hairMat);
    hairSide.position.y = 0.65; root.add(hairSide);
  }

  // 目
  const eyeMat = new THREE.MeshStandardMaterial({ color: rarity.key === 'SSR' ? 0xffd54a : 0x3a5fff, emissive: rarity.key === 'SSR' ? 0xffa500 : 0x1a2f8a, emissiveIntensity: 0.5 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), eyeMat);
  eyeL.position.set(-0.18, 0.65, 0.48); root.add(eyeL);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.18; root.add(eyeR);

  // 鎧 (胴体)
  const chestGeom = new THREE.CylinderGeometry(0.5, 0.5, 0.9, 8);
  const chest = new THREE.Mesh(chestGeom, isWizard ? clothMat : armorMat);
  chest.position.y = -0.2; chest.castShadow = true; root.add(chest);

  // 胸飾り/魔石
  const gemMat = new THREE.MeshStandardMaterial({ color: rarity.key === 'SSR' ? 0xffd54a : rarity.key === 'SR' ? 0x00e5ff : 0xff6a8c, emissive: rarity.key === 'SSR' ? 0xffa500 : rarity.key === 'SR' ? 0x00a5bf : 0xa02040, emissiveIntensity: 1.0, metalness: 0.5, roughness: 0.2 });
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), gemMat);
  gem.position.set(0, -0.05, 0.52); root.add(gem);

  // 肩アーマー
  if (!isWizard) {
    const shGeom = new THREE.SphereGeometry(0.28, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const shL = new THREE.Mesh(shGeom, armorMat);
    shL.position.set(-0.55, 0.15, 0); shL.castShadow = true; root.add(shL);
    const shR = shL.clone(); shR.position.x = 0.55; root.add(shR);
  }

  // 腕
  const armGeom = new THREE.CylinderGeometry(0.1, 0.12, 0.85, 8);
  const armL = new THREE.Mesh(armGeom, isWizard ? clothMat : armorMat);
  armL.position.set(-0.6, -0.2, 0); armL.castShadow = true; root.add(armL);
  const armR = armL.clone(); armR.position.x = 0.6; root.add(armR);

  // 脚
  const legGeom = new THREE.CylinderGeometry(0.14, 0.12, 0.9, 8);
  const legL = new THREE.Mesh(legGeom, isWizard ? clothMat : armorMat);
  legL.position.set(-0.2, -1.35, 0); legL.castShadow = true; root.add(legL);
  const legR = legL.clone(); legR.position.x = 0.2; root.add(legR);

  // マント (背中)
  const capeGeom = new THREE.PlaneGeometry(1.1, 1.6, 8, 8);
  const cape = new THREE.Mesh(capeGeom, new THREE.MeshStandardMaterial({ color: cloth, side: THREE.DoubleSide, roughness: 0.95 }));
  cape.position.set(0, -0.4, -0.3); cape.castShadow = true;
  const cp = capeGeom.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i);
    cp.setZ(i, Math.cos(x * 3) * 0.1);
  }
  cp.needsUpdate = true; capeGeom.computeVertexNormals();
  root.add(cape);

  // 武器
  if (isWizard) {
    // 杖
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8), new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.85 }));
    staff.position.set(0.75, -0.3, 0); staff.castShadow = true; root.add(staff);
    const orbMat = new THREE.MeshStandardMaterial({ color: rarity.key === 'SSR' ? 0xffd54a : 0xff3cac, emissive: rarity.key === 'SSR' ? 0xffa500 : 0xaa2288, emissiveIntensity: 1.5 });
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 1), orbMat);
    orb.position.set(0.75, 0.7, 0); root.add(orb);
    // パーティクル
    const pGroup = new THREE.Group();
    for (let i = 0; i < 12; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), orbMat);
      pGroup.add(p);
    }
    root.add(pGroup);
    root.userData.pGroup = pGroup;
    root.userData.orbBase = 0.7;
  } else {
    // 剣
    const sword = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.5, 0.02), new THREE.MeshStandardMaterial({ color: 0xccccff, metalness: 1, roughness: 0.1 }));
    sword.position.set(0.8, 0.1, 0); root.add(sword);
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.1, 0.08), armorMat);
    hilt.position.set(0.8, -0.65, 0); root.add(hilt);
  }

  return {
    root,
    update: (t) => {
      if (root.userData.pGroup) {
        root.userData.pGroup.children.forEach((p, i) => {
          const a = (i / 12) * Math.PI * 2 + t * 2;
          p.position.set(0.75 + Math.cos(a) * 0.25, 0.7 + Math.sin(t * 3 + i) * 0.15, Math.sin(a) * 0.25);
          p.material.opacity = 0.6 + Math.sin(t * 4 + i) * 0.4;
        });
      }
    },
  };
}

// ============================================================
// Style 6: CRYSTAL (水晶生命体)
// ============================================================
function buildCrystal(features, rarity, rng) {
  const root = new THREE.Group();
  const base = new THREE.Color(features.palette.accent);
  const crystalMat = new THREE.MeshPhysicalMaterial({
    color: base,
    metalness: 0.1,
    roughness: 0.05,
    transmission: 0.85,
    thickness: 0.6,
    ior: 1.6,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    emissive: base,
    emissiveIntensity: 0.15,
  });

  // 頭 (クラスターの中心)
  const headGeom = new THREE.IcosahedronGeometry(0.55, 0);
  const head = new THREE.Mesh(headGeom, crystalMat);
  head.position.y = 0.6; head.castShadow = true; root.add(head);

  // 頭周りの結晶
  for (let i = 0; i < 8; i++) {
    const s = 0.15 + rng() * 0.2;
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(s, 0), crystalMat.clone());
    const a = (i / 8) * Math.PI * 2;
    shard.position.set(Math.cos(a) * 0.5, 0.6 + (rng() - 0.5) * 0.4, Math.sin(a) * 0.5);
    shard.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
    root.add(shard);
  }

  // 目（内部発光）
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), eyeMat);
  eyeL.position.set(-0.16, 0.65, 0.42); root.add(eyeL);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.16; root.add(eyeR);

  // 胴体（結晶クラスター）
  const torsoCore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), crystalMat);
  torsoCore.position.y = -0.3; torsoCore.castShadow = true; root.add(torsoCore);

  // 胴体周りの結晶
  for (let i = 0; i < 6; i++) {
    const s = 0.1 + rng() * 0.2;
    const shard = new THREE.Mesh(new THREE.ConeGeometry(s * 0.6, s * 1.8, 6), crystalMat.clone());
    const a = (i / 6) * Math.PI * 2;
    shard.position.set(Math.cos(a) * 0.45, -0.3, Math.sin(a) * 0.45);
    shard.rotation.z = Math.cos(a) * 0.6;
    shard.rotation.x = Math.sin(a) * 0.6;
    root.add(shard);
  }

  // 腕 (結晶のアーム)
  for (let side = 0; side < 2; side++) {
    const sign = side === 0 ? -1 : 1;
    for (let j = 0; j < 3; j++) {
      const s = 0.18 - j * 0.02;
      const part = new THREE.Mesh(new THREE.OctahedronGeometry(s, 0), crystalMat.clone());
      part.position.set(sign * (0.55 + j * 0.15), -0.1 - j * 0.25, 0);
      part.rotation.z = sign * (0.2 + rng() * 0.2);
      root.add(part);
    }
  }

  // 脚 (結晶の尖塔)
  const legGeom = new THREE.ConeGeometry(0.18, 1.0, 6);
  const legL = new THREE.Mesh(legGeom, crystalMat);
  legL.position.set(-0.2, -1.3, 0); legL.castShadow = true;
  legL.rotation.x = Math.PI; root.add(legL);
  const legR = legL.clone(); legR.position.x = 0.2; root.add(legR);

  // SSR: 浮遊する大結晶
  const floaters = [];
  const floaterCount = rarity.key === 'SSR' ? 6 : rarity.key === 'SR' ? 3 : 0;
  for (let i = 0; i < floaterCount; i++) {
    const s = 0.15 + rng() * 0.15;
    const fl = new THREE.Mesh(new THREE.OctahedronGeometry(s, 0), crystalMat.clone());
    const a = (i / floaterCount) * Math.PI * 2;
    const r = 1.3 + rng() * 0.3;
    fl.position.set(Math.cos(a) * r, (rng() - 0.5) * 1.5, Math.sin(a) * r);
    fl.userData.a0 = a;
    fl.userData.r = r;
    fl.userData.y0 = fl.position.y;
    fl.userData.sp = 0.5 + rng();
    root.add(fl);
    floaters.push(fl);
  }

  return {
    root,
    update: (t) => {
      floaters.forEach((f, i) => {
        const a = f.userData.a0 + t * f.userData.sp * 0.5;
        f.position.x = Math.cos(a) * f.userData.r;
        f.position.z = Math.sin(a) * f.userData.r;
        f.position.y = f.userData.y0 + Math.sin(t * f.userData.sp + i) * 0.15;
        f.rotation.x += 0.01;
        f.rotation.y += 0.015;
      });
      torsoCore.rotation.y = t * 0.3;
    },
  };
}

// ============================================================
// Rarity Effects
// ============================================================
function addRarityEffects(group, rarity, rng) {
  if (rarity.key === 'R') return;

  // SR/SSR: オーラリング
  const ringCount = rarity.key === 'SSR' ? 3 : 1;
  for (let i = 0; i < ringCount; i++) {
    const ringGeom = new THREE.RingGeometry(1.4 + i * 0.1, 1.5 + i * 0.1, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: rarity.color,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -1.3;
    ring.userData.speed = (i % 2 === 0 ? 1 : -1) * (0.3 + i * 0.2);
    group.add(ring);
  }

  // SSR: 光のパーティクル
  if (rarity.key === 'SSR') {
    const particleCount = 60;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const a = rng() * Math.PI * 2;
      const r = 1 + rng() * 1.5;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = (rng() - 0.5) * 3;
      positions[i * 3 + 2] = Math.sin(a) * r;
    }
    const pGeom = new THREE.BufferGeometry();
    pGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xffd54a,
      size: 0.08,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(pGeom, pMat);
    points.userData.isParticles = true;
    group.add(points);
  }

  // SR/SSR: ポイントライト
  const pLight = new THREE.PointLight(rarity.color, 1.5, 5);
  pLight.position.set(0, 1, 0);
  group.add(pLight);
}

/**
 * レンダラから録画用MediaStreamを取得
 */
export function startRecording(canvas, duration = 8) {
  return new Promise((resolve, reject) => {
    if (!canvas.captureStream) {
      reject(new Error('このブラウザは録画に対応していません'));
      return;
    }
    const stream = canvas.captureStream(30);
    const mimes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
    let mime = '';
    for (const m of mimes) {
      if (MediaRecorder.isTypeSupported(m)) { mime = m; break; }
    }
    if (!mime) { reject(new Error('録画フォーマット非対応')); return; }

    const chunks = [];
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
    rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: mime.split(';')[0] });
      resolve({ blob, mime: mime.split(';')[0] });
    };
    rec.onerror = (e) => reject(e.error || new Error('録画エラー'));
    rec.start();
    setTimeout(() => rec.stop(), duration * 1000);
  });
}
