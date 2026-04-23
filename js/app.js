// app.js - Main application logic
import { RoomEditor } from './editor.js';
import { RoomViewer } from './viewer.js';
import { initHeroScene } from './hero.js';
import { FURNITURE, CATEGORIES, THEMES } from './furniture.js';
import {
  encodeRoom, decodeRoom, buildShareUrl, readTokenFromUrl,
  drawQR, makeTwitterUrl, makeLineUrl, nativeShare, copyToClipboard,
  getGlobalStats, incrementStat, getMessages, addMessage,
} from './share.js';

// ===== DOM refs =====
const $ = sel => document.querySelector(sel);
const screens = {
  hero:   $('#hero'),
  editor: $('#editor'),
  viewer: $('#viewer'),
};

// ===== State =====
const APP = {
  editor: null,
  viewer: null,
  heroDispose: null,
  currentToken: null,
  currentCat: 'basic',
  isPremium: localStorage.getItem('roomify:premium') === '1',
  autosaveTimer: null,
};

// ===== Screens =====
function show(screenName){
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[screenName].classList.add('active');
  window.scrollTo(0,0);
  // track
  try{ window.gtag?.('event', 'screen_view', { screen_name: screenName }); }catch{}
}

function toast(msg, type='success', ms=2400){
  const wrap = $('#toast-wrap');
  wrap.hidden = false;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(()=>{
    el.style.opacity='0'; el.style.transition='opacity .25s';
    setTimeout(()=>{ el.remove(); if(!wrap.children.length) wrap.hidden = true; }, 250);
  }, ms);
}

// ===== Init Hero =====
function initHero(){
  const canvas = $('#hero-canvas');
  APP.heroDispose = initHeroScene(canvas);

  // stats
  const stats = getGlobalStats();
  $('#stat-rooms').textContent = stats.rooms || 0;
  $('#stat-visits').textContent = stats.visits || 0;
  animateCount('#stat-rooms', stats.rooms || 0);
  animateCount('#stat-visits', stats.visits || 0);

  $('#btn-create').addEventListener('click', () => {
    enterEditor();
  });
  $('#btn-explore').addEventListener('click', () => {
    // Demo room
    loadDemoRoom();
  });
}
function animateCount(sel, target){
  const el = document.querySelector(sel);
  if(!el) return;
  let current = 0;
  const step = Math.max(1, Math.ceil(target / 40));
  const iv = setInterval(()=>{
    current += step;
    if(current >= target){ current = target; clearInterval(iv); }
    el.textContent = current.toLocaleString();
  }, 25);
}

// ===== Editor =====
function enterEditor(state=null){
  show('editor');
  if(!APP.editor){
    APP.editor = new RoomEditor($('#editor-canvas'), {
      onSelect: onItemSelected,
      onChange: onRoomChanged,
    });
    buildFurniturePalette();
    buildThemeGrid();
    bindEditorUI();
  }
  if(state){
    APP.editor.loadState(state);
    $('#room-title').value = state.title || '';
  }else{
    // Fresh
    const saved = loadAutosave();
    if(saved){
      APP.editor.loadState(saved);
      $('#room-title').value = saved.title || '';
      toast('前回の編集を復元しました', 'success');
    } else {
      // seed with a few items
      APP.editor.addItem('bed', -3, -3);
      APP.editor.addItem('desk', 3, -3);
      APP.editor.addItem('chair', 3, -2);
      APP.editor.addItem('plant', -3, 3);
      APP.editor.addItem('rug', 0, 0);
    }
  }
  setTimeout(()=>APP.editor._onResize(), 50);
}

function onItemSelected(item, screenPos){
  const popup = $('#selection-popup');
  if(!item){ popup.hidden = true; return; }
  popup.hidden = false;
  const canvasWrap = $('.canvas-wrap').getBoundingClientRect();
  const px = Math.max(8, Math.min(canvasWrap.width - 160, screenPos.x - canvasWrap.left - 80));
  const py = Math.max(8, Math.min(canvasWrap.height - 80, screenPos.y - canvasWrap.top - 60));
  popup.style.left = px + 'px';
  popup.style.top  = py + 'px';
}

$('#selection-popup').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if(!btn) return;
  const act = btn.dataset.action;
  if(act === 'rotate')   APP.editor.rotateSelected();
  if(act === 'duplicate')APP.editor.duplicateSelected();
  if(act === 'delete'){ APP.editor.deleteSelected(); $('#selection-popup').hidden = true; }
});

function onRoomChanged(){
  // Autosave to localStorage (debounced)
  clearTimeout(APP.autosaveTimer);
  APP.autosaveTimer = setTimeout(() => {
    try{
      const s = APP.editor.getState();
      localStorage.setItem('roomify:autosave', JSON.stringify(s));
    }catch{}
  }, 500);
}
function loadAutosave(){
  try{
    const raw = localStorage.getItem('roomify:autosave');
    return raw ? JSON.parse(raw) : null;
  }catch{ return null; }
}

function buildFurniturePalette(){
  const cats = $('#furni-cats');
  const grid = $('#furni-grid');
  const dbody = $('#drawer-body');
  cats.innerHTML = '';

  CATEGORIES.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'furni-cat' + (c.id === APP.currentCat ? ' active' : '');
    btn.textContent = c.name;
    btn.dataset.cat = c.id;
    btn.addEventListener('click', () => {
      APP.currentCat = c.id;
      cats.querySelectorAll('.furni-cat').forEach(b => b.classList.toggle('active', b.dataset.cat === c.id));
      renderFurnitureGrid();
    });
    cats.appendChild(btn);
  });

  renderFurnitureGrid();
}

function renderFurnitureGrid(){
  const grid = $('#furni-grid');
  const dbody = $('#drawer-body');
  const items = FURNITURE.filter(f => f.cat === APP.currentCat);

  const buildItem = (f) => {
    const div = document.createElement('div');
    div.className = 'furni-item' + (f.premium && !APP.isPremium ? ' locked' : '');
    div.innerHTML = `
      ${f.premium ? '<span class="badge">PRO</span>' : ''}
      <span class="ico">${f.icon}</span>
      <span class="name">${f.name}</span>
    `;
    div.addEventListener('click', () => {
      if(f.premium && !APP.isPremium){
        openPremium();
        return;
      }
      APP.editor.addItem(f.id, (Math.random()-0.5)*4, (Math.random()-0.5)*4);
      toast(`${f.name}を配置しました`, 'success', 1200);
      // close drawer on mobile
      $('#mobile-drawer')?.classList.remove('open');
      try{ window.gtag?.('event', 'add_furniture', { type: f.id }); }catch{}
    });
    return div;
  };

  grid.innerHTML = '';
  items.forEach(f => grid.appendChild(buildItem(f)));

  // also populate drawer if exists
  if(dbody){
    dbody.innerHTML = '';
    // Build tabs content based on active drawer tab
    const activeTab = document.querySelector('.dtab.active')?.dataset.dtab || 'furniture';
    if(activeTab === 'furniture'){
      const mCats = document.createElement('div');
      mCats.className = 'furni-cats';
      CATEGORIES.forEach(c => {
        const b = document.createElement('button');
        b.className = 'furni-cat' + (c.id === APP.currentCat ? ' active' : '');
        b.textContent = c.name; b.dataset.cat = c.id;
        b.addEventListener('click', () => {
          APP.currentCat = c.id; renderFurnitureGrid();
        });
        mCats.appendChild(b);
      });
      dbody.appendChild(mCats);
      const mGrid = document.createElement('div');
      mGrid.className = 'furni-grid';
      items.forEach(f => mGrid.appendChild(buildItem(f)));
      dbody.appendChild(mGrid);
    } else if(activeTab === 'room'){
      dbody.appendChild(buildRoomControls());
    } else if(activeTab === 'theme'){
      dbody.appendChild(buildThemeContent());
    }
  }
}

function buildRoomControls(){
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <label class="control">
      <span>広さ</span>
      <input type="range" min="6" max="20" value="${APP.editor.state.size}" id="m-size" />
      <span class="val" id="m-size-val">${APP.editor.state.size}m</span>
    </label>
    <label class="control">
      <span>天井</span>
      <input type="range" min="2.4" max="6" step="0.2" value="${APP.editor.state.height}" id="m-height" />
      <span class="val" id="m-height-val">${APP.editor.state.height}m</span>
    </label>
    <label class="control">
      <span>床色</span>
      <input type="color" id="m-floor" value="${APP.editor.state.floorColor}" />
    </label>
    <label class="control">
      <span>壁色</span>
      <input type="color" id="m-wall" value="${APP.editor.state.wallColor}" />
    </label>
  `;
  wrap.querySelector('#m-size').addEventListener('input', e => {
    APP.editor.setSize(+e.target.value);
    wrap.querySelector('#m-size-val').textContent = e.target.value + 'm';
    syncRoomControls();
  });
  wrap.querySelector('#m-height').addEventListener('input', e => {
    APP.editor.setHeight(+e.target.value);
    wrap.querySelector('#m-height-val').textContent = (+e.target.value).toFixed(1) + 'm';
    syncRoomControls();
  });
  wrap.querySelector('#m-floor').addEventListener('input', e => APP.editor.setFloorColor(e.target.value));
  wrap.querySelector('#m-wall').addEventListener('input', e => APP.editor.setWallColor(e.target.value));
  return wrap;
}

function buildThemeContent(){
  const wrap = document.createElement('div');
  const grid = document.createElement('div');
  grid.className = 'theme-grid';
  THEMES.forEach(t => {
    const card = document.createElement('div');
    card.className = 'theme-item' + (t.premium && !APP.isPremium ? ' locked' : '') + (t.id === APP.editor.state.theme ? ' active' : '');
    card.style.background = `linear-gradient(135deg, ${t.floor}, ${t.wall}, ${t.sky})`;
    card.innerHTML = `<span>${t.name}</span>`;
    card.addEventListener('click', () => {
      if(t.premium && !APP.isPremium){ openPremium(); return; }
      APP.editor.setTheme(t.id);
      grid.querySelectorAll('.theme-item').forEach(el => el.classList.remove('active'));
      card.classList.add('active');
      // sync color inputs
      syncRoomControls();
    });
    grid.appendChild(card);
  });
  wrap.appendChild(grid);
  const note = document.createElement('div');
  note.className = 'premium-note';
  note.innerHTML = `
    <span>🔒 プレミアムテーマ</span>
    <p>ネオン、水中、宇宙、アニメ…全部解放</p>
    <button class="btn btn-primary btn-sm">¥500でアンロック</button>
  `;
  note.querySelector('button').addEventListener('click', openPremium);
  wrap.appendChild(note);
  return wrap;
}

function buildThemeGrid(){
  const grid = $('#theme-grid');
  grid.innerHTML = '';
  THEMES.forEach(t => {
    const card = document.createElement('div');
    card.className = 'theme-item' + (t.premium && !APP.isPremium ? ' locked' : '') + (t.id === APP.editor.state.theme ? ' active' : '');
    card.style.background = `linear-gradient(135deg, ${t.floor}, ${t.wall}, ${t.sky})`;
    card.innerHTML = `<span>${t.name}</span>`;
    card.addEventListener('click', () => {
      if(t.premium && !APP.isPremium){ openPremium(); return; }
      APP.editor.setTheme(t.id);
      grid.querySelectorAll('.theme-item').forEach(el => el.classList.remove('active'));
      card.classList.add('active');
      syncRoomControls();
    });
    grid.appendChild(card);
  });
}

function syncRoomControls(){
  $('#room-size').value = APP.editor.state.size;
  $('#room-size-val').textContent = APP.editor.state.size + 'm';
  $('#room-height').value = APP.editor.state.height;
  $('#room-height-val').textContent = (+APP.editor.state.height).toFixed(1) + 'm';
  $('#floor-color').value = APP.editor.state.floorColor;
  $('#wall-color').value = APP.editor.state.wallColor;
}

function bindEditorUI(){
  $('#btn-back-home').addEventListener('click', () => {
    show('hero');
  });

  $('#room-title').addEventListener('input', e => {
    APP.editor.setTitle(e.target.value);
  });

  // Room panel tabs
  document.querySelectorAll('.panel-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.panel-tabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const id = tab.dataset.tab;
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.tabContent === id));
    });
  });

  // Mobile drawer tabs
  document.querySelectorAll('.dtab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.dtab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderFurnitureGrid();
    });
  });

  // Mobile drawer swipe
  const drawer = $('#mobile-drawer');
  if(drawer){
    let startY = 0, startH = 0, dragging = false;
    drawer.querySelector('.drawer-handle')?.addEventListener('touchstart', (e) => {
      dragging = true;
      startY = e.touches[0].clientY;
      startH = drawer.classList.contains('open') ? 0 : drawer.offsetHeight - 56;
    });
    drawer.querySelector('.drawer-handle')?.addEventListener('touchmove', (e) => {
      if(!dragging) return;
    });
    drawer.querySelector('.drawer-handle')?.addEventListener('touchend', (e) => {
      if(!dragging) return;
      dragging = false;
      drawer.classList.toggle('open');
    });
  }

  // Room controls
  $('#room-size').addEventListener('input', e => {
    APP.editor.setSize(+e.target.value);
    $('#room-size-val').textContent = e.target.value + 'm';
  });
  $('#room-height').addEventListener('input', e => {
    APP.editor.setHeight(+e.target.value);
    $('#room-height-val').textContent = (+e.target.value).toFixed(1) + 'm';
  });
  $('#floor-color').addEventListener('input', e => APP.editor.setFloorColor(e.target.value));
  $('#wall-color').addEventListener('input', e => APP.editor.setWallColor(e.target.value));

  // Preview -> Viewer
  $('#btn-preview').addEventListener('click', enterPreview);

  // Share
  $('#btn-share').addEventListener('click', openShare);

  // Premium
  $('#btn-buy-premium').addEventListener('click', openPremium);
  $('#btn-checkout').addEventListener('click', doCheckout);

  // Modals close
  document.querySelectorAll('[data-close]').forEach(b => {
    b.addEventListener('click', () => {
      b.closest('.modal').hidden = true;
    });
  });
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', (e) => {
      if(e.target === m) m.hidden = true;
    });
  });

  // Share inside modal
  $('#btn-copy-url').addEventListener('click', async () => {
    const url = $('#share-url-input').value;
    if(await copyToClipboard(url)){
      toast('URLをコピーしました！', 'success');
      try{ window.gtag?.('event', 'share_copy'); }catch{}
    }else{
      toast('コピーに失敗しました', 'error');
    }
  });
  $('#share-native').addEventListener('click', async () => {
    const url = $('#share-url-input').value;
    const title = APP.editor?.state.title || 'Roomify';
    if(!(await nativeShare(url, title))){
      if(await copyToClipboard(url)) toast('URLをコピーしました', 'success');
    }
  });
}

async function enterPreview(){
  const state = APP.editor.getState();
  if(!APP.viewer){
    APP.viewer = new RoomViewer($('#viewer-canvas'));
    bindViewerUI();
  }
  APP.viewer.loadState(state);
  // messages
  const token = await encodeRoom(state);
  APP.currentToken = token;
  APP.viewer.showMessages(getMessages(token));
  show('viewer');
  $('#viewer-room-title').textContent = state.title || 'マイルーム';
  setTimeout(()=>APP.viewer._onResize(), 50);
  const tip = $('#viewer-tip');
  tip.classList.remove('hide');
  setTimeout(()=>tip.classList.add('hide'), 4000);
}

function bindViewerUI(){
  $('#btn-exit-viewer').addEventListener('click', () => {
    // If came from hero (shared link), back to hero; else editor
    if(APP.fromShare){ show('hero'); APP.fromShare = false; }
    else show('editor');
  });
  $('#btn-msg').addEventListener('click', openMessages);
  $('#btn-share2').addEventListener('click', openShare);
  $('#btn-send-msg').addEventListener('click', () => {
    const name = $('#msg-name').value.trim();
    const text = $('#msg-text').value.trim();
    if(!text){ toast('メッセージを入力してね', 'error'); return; }
    if(!APP.currentToken) return;
    addMessage(APP.currentToken, name, text);
    $('#msg-text').value = '';
    refreshMessages();
    APP.viewer.showMessages(getMessages(APP.currentToken));
    toast('メッセージを残しました！', 'success');
    try{ window.gtag?.('event', 'leave_message'); }catch{}
  });
}

function openMessages(){
  refreshMessages();
  $('#msg-modal').hidden = false;
}
function refreshMessages(){
  const list = $('#msg-list');
  if(!APP.currentToken){ list.innerHTML = ''; return; }
  const msgs = getMessages(APP.currentToken);
  list.innerHTML = msgs.map(m => {
    const time = new Date(m.d).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
    return `<div class="msg-item"><div class="head"><span>${escapeHtml(m.n)}</span><span>${time}</span></div><div class="body">${escapeHtml(m.t)}</div></div>`;
  }).join('');
}
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }

async function openShare(){
  const state = APP.editor.getState();
  const url = await buildShareUrl(state);
  APP.currentToken = await encodeRoom(state);
  $('#share-url-input').value = url;
  $('#share-twitter').href = makeTwitterUrl(url, state.title);
  $('#share-line').href = makeLineUrl(url, state.title);
  $('#share-modal').hidden = false;
  // QR
  drawQR($('#qr-canvas'), url);

  // Stats: every share "creates" a room for analytics
  incrementStat('rooms', 1);
  try{ window.gtag?.('event', 'share_open'); }catch{}
}

function openPremium(){
  $('#premium-modal').hidden = false;
  try{ window.gtag?.('event', 'premium_view'); }catch{}
}

function doCheckout(){
  // In production: redirect to Stripe Checkout. For now: unlock via demo.
  // This is the monetization hook; integration with real Stripe can be added by
  // replacing this function with a redirect to a Checkout Session URL.
  const confirmed = confirm('[デモ版] プレミアム機能を体験モードで有効化します。正式リリース時は¥500で購入できます。有効化しますか？');
  if(!confirmed) return;
  APP.isPremium = true;
  localStorage.setItem('roomify:premium', '1');
  $('#premium-modal').hidden = true;
  renderFurnitureGrid();
  buildThemeGrid();
  toast('✨ プレミアム有効化しました！', 'success');
  try{ window.gtag?.('event', 'premium_unlock_demo'); }catch{}
}

// ===== Demo room =====
function loadDemoRoom(){
  const demo = {
    title: 'Demo Room',
    size: 10, height: 3,
    floorColor: '#8b6f4e', wallColor: '#f0e8dc',
    theme: 'cozy',
    items: [
      { type:'beddbl', x:-3, z:-2.5, rotY:0 },
      { type:'desk',   x:3, z:-3, rotY:0 },
      { type:'chair',  x:3, z:-2, rotY:Math.PI },
      { type:'computer',x:3, z:-3.1, rotY:0 },
      { type:'lamp',   x:3.6, z:-3.5, rotY:0 },
      { type:'bookshelf', x:-4, z:0, rotY:Math.PI/2 },
      { type:'sofa',   x:2, z:3, rotY:Math.PI },
      { type:'table',  x:0, z:2, rotY:0 },
      { type:'tv',     x:-3, z:3.5, rotY:0 },
      { type:'rug',    x:0.5, z:2.5, rotY:0 },
      { type:'plant',  x:-4, z:-4, rotY:0 },
      { type:'planttall', x:4, z:4, rotY:0 },
      { type:'painting', x:-2, z:0, wallSide:1, y:1.8 },
      { type:'clock', x:2, z:0, wallSide:1, y:2.2 },
      { type:'window', x:0, z:0, wallSide:3, y:1.8 },
    ],
  };
  enterEditor(demo);
  $('#room-title').value = demo.title;
  toast('デモルームを読み込みました', 'success');
}

// ===== Check URL for shared room =====
async function checkSharedRoom(){
  const token = readTokenFromUrl();
  if(!token) return false;
  const state = await decodeRoom(token);
  if(!state) return false;
  // Open in viewer mode directly
  show('viewer');
  if(!APP.viewer){
    APP.viewer = new RoomViewer($('#viewer-canvas'));
    bindViewerUI();
  }
  APP.viewer.loadState(state);
  APP.currentToken = token;
  APP.fromShare = true;
  APP.viewer.showMessages(getMessages(token));
  $('#viewer-room-title').textContent = state.title || 'シェアされた部屋';
  incrementStat('visits', 1);
  $('#viewer-visits').textContent = '👁 ' + getGlobalStats().visits;
  try{ window.gtag?.('event', 'view_shared_room'); }catch{}
  return true;
}

// ===== Boot =====
(async function boot(){
  initHero();
  const didLoadShare = await checkSharedRoom();
  if(!didLoadShare){
    show('hero');
  }
})();

// ===== Global error handler =====
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled rejection:', e.reason);
});
