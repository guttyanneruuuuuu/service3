// ============================================================
// Face Analysis Module
// ブラウザ内で画像を解析し、アバター生成用の特徴量を抽出
// ・FaceDetector API (Chrome系)
// ・Canvasピクセル解析 (フォールバック)
// 画像はサーバーに一切送信しない
// ============================================================

/**
 * 画像から顔特徴量を抽出
 * @param {HTMLImageElement} img
 * @returns {Promise<{
 *   hasFace: boolean,
 *   faceBox: {x:number,y:number,w:number,h:number}|null,
 *   palette: {skin:string, hair:string, bg:string, accent:string},
 *   brightness: number,
 *   saturation: number,
 *   hairRatio: number,
 *   aspectRatio: number,
 *   seed: number
 * }>}
 */
export async function analyzeFace(img) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  // 1. FaceDetector があれば顔位置検出
  let faceBox = null;
  let hasFace = false;
  if ('FaceDetector' in window) {
    try {
      const detector = new window.FaceDetector({ maxDetectedFaces: 1, fastMode: true });
      const faces = await detector.detect(img);
      if (faces && faces.length > 0) {
        const bb = faces[0].boundingBox;
        faceBox = { x: bb.x, y: bb.y, w: bb.width, h: bb.height };
        hasFace = true;
      }
    } catch (_) { /* fallback below */ }
  }

  // 2. Canvas pixel分析 (ダウンサンプリング)
  const DS = 128;
  const canvas = document.createElement('canvas');
  canvas.width = DS;
  canvas.height = DS;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, DS, DS);
  const imageData = ctx.getImageData(0, 0, DS, DS);
  const px = imageData.data;

  // デフォルト faceBox (中央)
  if (!faceBox) {
    faceBox = {
      x: w * 0.25, y: h * 0.15,
      w: w * 0.5, h: h * 0.6,
    };
  }

  // 顔領域のスケール座標
  const fx0 = Math.floor((faceBox.x / w) * DS);
  const fy0 = Math.floor((faceBox.y / h) * DS);
  const fx1 = Math.min(DS, Math.floor(((faceBox.x + faceBox.w) / w) * DS));
  const fy1 = Math.min(DS, Math.floor(((faceBox.y + faceBox.h) / h) * DS));

  // 顔領域の平均色 = 肌色推定
  let sr = 0, sg = 0, sb = 0, sn = 0;
  for (let y = fy0; y < fy1; y++) {
    for (let x = fx0; x < fx1; x++) {
      const i = (y * DS + x) * 4;
      sr += px[i]; sg += px[i + 1]; sb += px[i + 2]; sn++;
    }
  }
  const skin = sn > 0 ? rgbToHex(sr / sn, sg / sn, sb / sn) : '#f0c48c';

  // 上部1/4 = 髪色推定（暗いピクセルだけ採用）
  let hr = 0, hg = 0, hb = 0, hn = 0, darkCount = 0, totalUp = 0;
  const hy1 = Math.max(1, Math.floor(DS * 0.3));
  for (let y = 0; y < hy1; y++) {
    for (let x = 0; x < DS; x++) {
      const i = (y * DS + x) * 4;
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      totalUp++;
      if (lum < 100) {
        hr += px[i]; hg += px[i + 1]; hb += px[i + 2]; hn++;
        darkCount++;
      }
    }
  }
  const hair = hn > 20 ? rgbToHex(hr / hn, hg / hn, hb / hn) : '#2a1a1a';
  const hairRatio = totalUp > 0 ? darkCount / totalUp : 0.3;

  // 全体の平均輝度・彩度
  let lumSum = 0, satSum = 0, bgR = 0, bgG = 0, bgB = 0, bgN = 0;
  for (let y = 0; y < DS; y++) {
    for (let x = 0; x < DS; x++) {
      const i = (y * DS + x) * 4;
      const r = px[i], g = px[i + 1], b = px[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      lumSum += lum;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const sat = mx > 0 ? (mx - mn) / mx : 0;
      satSum += sat;
      // 端っこを背景色推定に
      if (x < 8 || x > DS - 8 || y < 8 || y > DS - 8) {
        bgR += r; bgG += g; bgB += b; bgN++;
      }
    }
  }
  const total = DS * DS;
  const brightness = lumSum / total / 255;
  const saturation = satSum / total;
  const bg = bgN > 0 ? rgbToHex(bgR / bgN, bgG / bgN, bgB / bgN) : '#2a1a4a';

  // アクセント色 = 肌色の補色を派手に
  const skinRGB = hexToRgb(skin);
  const accent = rgbToHex(255 - skinRGB.r, 255 - skinRGB.g, 255 - skinRGB.b);

  // 画像の種別種 (seed) — 決定論的な派生用
  // 顔領域と全体のハッシュからseedを生成（同じ画像→同じアバター派生）
  let seed = 0;
  const step = 11;
  for (let i = 0; i < px.length; i += step * 4) {
    seed = (seed * 31 + px[i] + px[i + 1] * 3 + px[i + 2] * 7) | 0;
  }
  seed = Math.abs(seed);

  return {
    hasFace,
    faceBox,
    palette: { skin, hair, bg, accent },
    brightness,
    saturation,
    hairRatio,
    aspectRatio: w / h,
    seed,
  };
}

function rgbToHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [clamp(r), clamp(g), clamp(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}
function hexToRgb(hex) {
  const m = hex.replace('#', '');
  return {
    r: parseInt(m.slice(0, 2), 16),
    g: parseInt(m.slice(2, 4), 16),
    b: parseInt(m.slice(4, 6), 16),
  };
}

/**
 * シード値ベースの疑似乱数（決定論的）
 */
export function seededRandom(seed) {
  let s = seed | 0;
  return function() {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}
