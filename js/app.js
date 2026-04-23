// ============================================================
// App — Main orchestration
// ============================================================

import { toast, initDragDrop, validateImage, loadImageFromFile, showModal, closeModal } from './ui.js';
import { analyzeFace, seededRandom } from './face.js';
import { AvatarStage, generateAvatar, rollRarity, startRecording } from './avatar3d.js';
import { track, getDailyCounter } from './analytics.js';

const STORAGE_GALLERY = 'af_gallery_v1';

// DOM
const fileInput = document.getElementById('file-input');
const uploadBtn = document.getElementById('upload-btn');
const uploadArea = document.getElementById('upload-area');
const uploadPreview = document.getElementById('upload-preview');
const previewImg = document.getElementById('preview-img');
const uploadReset = document.getElementById('upload-reset');
const styleGrid = document.querySelector('.style-grid');
const btnSummon = document.getElementById('btn-summon');
const threeContainer = document.getElementById('three-container');
const viewerOverlay = document.getElementById('viewer-overlay');
const rarityBadge = document.getElementById('rarity-badge');
const rarityLabel = document.getElementById('rarity-label');
const statsRow = document.getElementById('stats-row');
const avatarNameEl = document.getElementById('avatar-name');
const summonCountEl = document.getElementById('summon-count');
const btnScreenshot = document.getElementById('btn-screenshot');
const btnRecord = document.getElementById('btn-record');
const btnDownload = document.getElementById('btn-download');
const btnShare = document.getElementById('btn-share');
const recIndicator = document.getElementById('rec-indicator');
const gachaOverlay = document.getElementById('gacha-overlay');
const gachaText = document.getElementById('gacha-text');
const galleryGrid = document.getElementById('gallery-grid');
const shareSiteBtn = document.getElementById('share-site-btn');

// State
let currentFile = null;
let currentImage = null;
let currentFeatures = null;
let currentStyle = 'voxel';
let currentRarity = null;
let currentAvatarName = null;
let recording = false;
let stage = null;

// ============================================================
// Init: Three stage
// ============================================================
function initStage() {
  if (!stage) {
    stage = new AvatarStage(threeContainer);
    // デモアバター表示（初期）
    showDemoAvatar();
  }
}

function showDemoAvatar() {
  const demoFeatures = {
    hasFace: false,
    faceBox: null,
    palette: { skin: '#f0c48c', hair: '#3a2a1a', bg: '#2a1a4a', accent: '#7a88ff' },
    brightness: 0.5, saturation: 0.5, hairRatio: 0.3, aspectRatio: 1,
    seed: 42,
  };
  const demoRarity = { key: 'R', label: 'R', color: 0x94a3b8, weight: 80 };
  const { group, update } = generateAvatar({ features: demoFeatures, style: currentStyle, rarity: demoRarity });
  stage.setAvatar(group, update);
}

// ============================================================
// File handling
// ============================================================
async function handleFile(file) {
  const v = validateImage(file);
  if (!v.ok) {
    toast(v.error, 'err');
    return;
  }
  try {
    const img = await loadImageFromFile(file);
    currentFile = file;
    currentImage = img;

    previewImg.src = img.src;
    document.querySelector('.upload-cta').hidden = true;
    uploadPreview.hidden = false;

    track('photo_uploaded', { size: file.size, type: file.type });
    toast('写真をアップロードしました', 'ok');
  } catch (e) {
    toast('画像の読み込みに失敗しました', 'err');
    console.error(e);
  }
}

uploadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) handleFile(file);
});
initDragDrop(uploadArea, handleFile);
uploadReset.addEventListener('click', () => {
  currentFile = null;
  currentImage = null;
  previewImg.src = '';
  document.querySelector('.upload-cta').hidden = false;
  uploadPreview.hidden = true;
  fileInput.value = '';
});

// ============================================================
// Style selection
// ============================================================
styleGrid.addEventListener('click', (e) => {
  const tile = e.target.closest('.style-tile');
  if (!tile) return;
  document.querySelectorAll('.style-tile').forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-checked', 'false');
  });
  tile.classList.add('active');
  tile.setAttribute('aria-checked', 'true');
  currentStyle = tile.dataset.style;
  track('style_selected', { style: currentStyle });
});

// ============================================================
// Summon
// ============================================================
btnSummon.addEventListener('click', summon);

async function summon() {
  if (btnSummon.disabled) return;

  // 画像無しでも遊べるよう、デモ特徴量で進める
  btnSummon.disabled = true;

  try {
    let features;
    if (currentImage) {
      features = await analyzeFace(currentImage);
      if (!features.hasFace && 'FaceDetector' in window) {
        toast('顔を検出できなかったので、画像の色合いから生成します', 'warn');
      }
    } else {
      // ランダム特徴量
      const colors = [
        { skin: '#f0c48c', hair: '#2a1a1a', bg: '#2a1a4a', accent: '#7a88ff' },
        { skin: '#e8a57a', hair: '#5a3a1a', bg: '#4a1a4a', accent: '#ff88aa' },
        { skin: '#d49a7a', hair: '#1a1a1a', bg: '#1a3a4a', accent: '#88ffaa' },
        { skin: '#f5c8a0', hair: '#8a5a1a', bg: '#4a2a1a', accent: '#ffaa55' },
      ];
      features = {
        hasFace: false, faceBox: null,
        palette: colors[Math.floor(Math.random() * colors.length)],
        brightness: Math.random(),
        saturation: Math.random(),
        hairRatio: Math.random() * 0.5,
        aspectRatio: 1,
        seed: Math.floor(Math.random() * 1e9),
      };
    }
    currentFeatures = features;

    // ガチャ演出開始
    await playGachaAnimation();

    // ガチャ抽選
    const rng = seededRandom(features.seed + Date.now());
    const rarity = rollRarity(rng);
    currentRarity = rarity;

    // 生成
    const { group, update, stats, avatarName } = generateAvatar({ features, style: currentStyle, rarity });
    stage.setAvatar(group, update);

    // オーバーレイ消す
    viewerOverlay.classList.add('hidden');

    // レアリティバッジ
    rarityBadge.hidden = false;
    rarityBadge.className = 'rarity-badge ' + rarity.key.toLowerCase();
    rarityLabel.textContent = rarity.label;

    // ステータス更新
    statsRow.hidden = false;
    document.getElementById('stat-power').textContent = stats.power;
    document.getElementById('stat-magic').textContent = stats.magic;
    document.getElementById('stat-speed').textContent = stats.speed;
    document.getElementById('stat-luck').textContent = stats.luck;

    // 名前
    avatarNameEl.hidden = false;
    avatarNameEl.textContent = avatarName;
    currentAvatarName = avatarName;

    // 召喚演出終了
    finishGachaAnimation(rarity);

    // 統計
    track('avatar_summoned', { style: currentStyle, rarity: rarity.key, power: stats.power, magic: stats.magic });
    updateSummonCount();

    // ギャラリーに少し遅れて保存（描画後）
    setTimeout(() => saveToGallery(rarity, avatarName, stats), 800);

    // SSRならシェアを促す
    if (rarity.key === 'SSR') {
      setTimeout(() => toast('✨ SSR召喚！SNSで自慢しよう！', 'ok', 5000), 1500);
    }
  } catch (err) {
    console.error(err);
    toast('生成中にエラーが発生しました', 'err');
    track('summon_error', { msg: String(err.message || err).slice(0, 100) });
  } finally {
    btnSummon.disabled = false;
  }
}

function playGachaAnimation() {
  return new Promise((resolve) => {
    gachaOverlay.hidden = false;
    gachaText.textContent = 'SUMMONING...';
    gachaText.className = 'gacha-text';
    setTimeout(resolve, 1800);
  });
}

function finishGachaAnimation(rarity) {
  gachaText.textContent = rarity.key === 'SSR' ? '★ SSR ★' : rarity.key === 'SR' ? '◆ SR ◆' : 'R';
  gachaText.className = 'gacha-text ' + (rarity.key === 'SSR' ? 'ssr' : rarity.key === 'SR' ? 'sr' : '');
  setTimeout(() => {
    gachaOverlay.hidden = true;
  }, rarity.key === 'SSR' ? 1600 : 800);
}

function updateSummonCount() {
  summonCountEl.textContent = `今日の召喚数: ${getDailyCounter('avatar_summoned')}`;
}
updateSummonCount();

// ============================================================
// Screenshot / Download / Record / Share
// ============================================================
btnScreenshot.addEventListener('click', async () => {
  if (!stage) return;
  try {
    // 録画中でない場合は少し待って確実にレンダー
    await new Promise(r => requestAnimationFrame(r));
    const dataUrl = stage.captureSnapshot('image/png');
    await copyImageToClipboard(dataUrl);
    toast('スクショをコピーしました！SNSに貼り付けよう', 'ok');
    track('screenshot_taken', { style: currentStyle });
  } catch (e) {
    console.error(e);
    toast('スクショに失敗しました（ダウンロードをお試しください）', 'warn');
  }
});

btnDownload.addEventListener('click', () => {
  if (!stage) return;
  const dataUrl = stage.captureSnapshot('image/png');
  downloadDataUrl(dataUrl, `avatar-forge-${Date.now()}.png`);
  track('avatar_downloaded', { style: currentStyle });
  toast('PNG保存しました', 'ok');
});

btnRecord.addEventListener('click', async () => {
  if (recording) return;
  if (!stage) return;
  recording = true;
  btnRecord.classList.add('active');
  recIndicator.hidden = false;
  toast('8秒間録画します', 'info');
  track('record_started', { style: currentStyle });

  try {
    const { blob, mime } = await startRecording(stage.getCanvas(), 8);
    const url = URL.createObjectURL(blob);
    const ext = mime.includes('mp4') ? 'mp4' : 'webm';
    downloadDataUrl(url, `avatar-forge-${Date.now()}.${ext}`);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('録画完了！SNSへ投下せよ！', 'ok');
    track('record_completed', { style: currentStyle });
  } catch (e) {
    console.error(e);
    toast('録画に失敗しました: ' + (e.message || e), 'err');
  } finally {
    recording = false;
    btnRecord.classList.remove('active');
    recIndicator.hidden = true;
  }
});

btnShare.addEventListener('click', async () => {
  const text = currentAvatarName
    ? `🔥 ${currentAvatarName} を AVATAR FORGE で召喚した！ #AvatarForge`
    : '伝説級3Dアバターを召喚せよ！ #AvatarForge';
  const url = location.href;
  if (navigator.share) {
    try {
      await navigator.share({ title: 'AVATAR FORGE', text, url });
      track('share_native', { via: 'webshare' });
    } catch (_) { /* user cancelled */ }
  } else {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, '_blank', 'noopener');
    track('share_native', { via: 'twitter' });
  }
});

shareSiteBtn?.addEventListener('click', () => {
  btnShare.click();
});

function downloadDataUrl(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function copyImageToClipboard(dataUrl) {
  // Safariの一部バージョン・iOSではclipboard.writeが制限される
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  if (navigator.clipboard && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      return;
    } catch (_) { /* fallthrough */ }
  }
  // Fallback: ダウンロード
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, `avatar-forge-${Date.now()}.png`);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  throw new Error('clipboard not available');
}

// ============================================================
// Gallery (localStorage)
// ============================================================
function loadGallery() {
  try {
    const raw = localStorage.getItem(STORAGE_GALLERY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveGallery(items) {
  try { localStorage.setItem(STORAGE_GALLERY, JSON.stringify(items)); } catch {}
}
function saveToGallery(rarity, name, stats) {
  if (!stage) return;
  try {
    const thumb = stage.captureSnapshot('image/jpeg');
    // JPEG品質を下げて容量節約
    const items = loadGallery();
    items.unshift({
      id: Date.now().toString(36),
      rarity: rarity.key,
      name,
      style: currentStyle,
      stats,
      thumb,
      createdAt: Date.now(),
    });
    // 最大12件
    const trimmed = items.slice(0, 12);
    saveGallery(trimmed);
    renderGallery();
  } catch (e) {
    console.warn('gallery save failed', e);
  }
}

function renderGallery() {
  const items = loadGallery();
  if (items.length === 0) {
    galleryGrid.innerHTML = '<div class="gallery-empty">まだ召喚されたアバターはいません</div>';
    return;
  }
  galleryGrid.innerHTML = '';
  items.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'gallery-card';

    const img = document.createElement('img');
    img.src = item.thumb;
    img.alt = 'avatar';
    img.loading = 'lazy';
    card.appendChild(img);

    const rar = document.createElement('div');
    rar.className = `g-rarity ${item.rarity}`;
    rar.textContent = item.rarity;
    card.appendChild(rar);

    const del = document.createElement('button');
    del.className = 'g-del';
    del.textContent = '×';
    del.setAttribute('aria-label', '削除');
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      const filtered = loadGallery().filter(x => x.id !== item.id);
      saveGallery(filtered);
      renderGallery();
    });
    card.appendChild(del);

    card.addEventListener('click', () => showAvatarDetail(item));

    galleryGrid.appendChild(card);
  });
}

function showAvatarDetail(item) {
  const el = document.createElement('div');
  const h = document.createElement('h3');
  h.textContent = item.name || 'Avatar';
  el.appendChild(h);

  const rarityColor = item.rarity === 'SSR' ? '#ffd54a' : item.rarity === 'SR' ? '#a78bfa' : '#94a3b8';
  const rarityTag = document.createElement('div');
  rarityTag.style.cssText = `display:inline-block; padding:4px 12px; border-radius:999px; border:1px solid ${rarityColor}; color:${rarityColor}; font-family:var(--font-head); font-weight:900; letter-spacing:0.1em; margin-bottom:12px;`;
  rarityTag.textContent = item.rarity;
  el.appendChild(rarityTag);

  const img = document.createElement('img');
  img.src = item.thumb;
  img.style.cssText = 'width:100%; border-radius:10px; margin:12px 0;';
  el.appendChild(img);

  if (item.stats) {
    const statsEl = document.createElement('div');
    statsEl.style.cssText = 'display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; margin:12px 0;';
    ['power', 'magic', 'speed', 'luck'].forEach(k => {
      const s = document.createElement('div');
      s.style.cssText = 'background:rgba(10,4,24,0.6); border:1px solid var(--panel-border); border-radius:10px; padding:8px; text-align:center;';
      s.innerHTML = `<div style="font-family:var(--font-head); font-size:10px; color:var(--text-mute); letter-spacing:0.1em;">${k.toUpperCase()}</div><div style="font-family:var(--font-head); font-size:20px; color:var(--text);">${item.stats[k]}</div>`;
      statsEl.appendChild(s);
    });
    el.appendChild(statsEl);
  }

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex; gap:10px; margin-top:14px; flex-wrap:wrap;';
  const dl = document.createElement('button');
  dl.className = 'btn btn-ghost';
  dl.textContent = '⬇ PNG保存';
  dl.addEventListener('click', () => {
    downloadDataUrl(item.thumb, `avatar-forge-${item.id}.png`);
    track('gallery_download');
  });
  actions.appendChild(dl);

  const share = document.createElement('button');
  share.className = 'btn btn-primary';
  share.textContent = '🔗 シェア';
  share.addEventListener('click', () => {
    const text = `🔥 ${item.name} を AVATAR FORGE で召喚！ #AvatarForge`;
    const url = location.href;
    if (navigator.share) {
      navigator.share({ title: 'AVATAR FORGE', text, url }).catch(() => {});
    } else {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'noopener');
    }
    track('gallery_share');
  });
  actions.appendChild(share);

  el.appendChild(actions);

  showModal(el);
}

renderGallery();

// ============================================================
// Initial
// ============================================================
initStage();

// Style change → デモアバター更新（写真未アップ時のみ）
styleGrid.addEventListener('click', () => {
  if (!currentImage && !currentRarity) {
    showDemoAvatar();
  }
});

// ============================================================
// Easter egg: Konami
// ============================================================
(function konami() {
  const seq = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  let i = 0;
  document.addEventListener('keydown', (e) => {
    if (e.key === seq[i]) {
      i++;
      if (i === seq.length) {
        toast('🎮 レアリティ確率UP！次の召喚で高確率SSR！', 'ok', 4000);
        window.__AF_SSR_BOOST__ = true;
        i = 0;
      }
    } else {
      i = 0;
    }
  });
})();

// Service worker 登録 (オフライン対応)
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
