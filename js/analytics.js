// ============================================================
// Analytics Module
// Cookieレス・匿名・端末内完結の軽量アナリティクス
// ============================================================
// 設計方針:
//  - 個人識別子は一切生成しない
//  - IPは収集しない（静的ホスティングなので当然送信先もない）
//  - イベントはlocalStorageに蓄積
//  - 任意のエンドポイントに集約送信できるフック提供（オフ推奨）
// ============================================================

const STORAGE_KEY = 'af_analytics_v1';
const MAX_EVENTS = 500;

// 安全なUUID-like生成（識別目的ではなくイベントID用）
function eventId() {
  const a = new Uint8Array(8);
  (crypto && crypto.getRandomValues) ? crypto.getRandomValues(a) : a.forEach((_, i) => a[i] = Math.floor(Math.random() * 256));
  return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { events: [], counters: {}, firstSeen: Date.now() };
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : { events: [], counters: {}, firstSeen: Date.now() };
  } catch {
    return { events: [], counters: {}, firstSeen: Date.now() };
  }
}
function save(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) { /* quota */ }
}

const state = load();
if (!state.firstSeen) state.firstSeen = Date.now();

/**
 * イベント記録
 */
export function track(eventName, properties = {}) {
  if (typeof eventName !== 'string' || eventName.length > 80) return;

  // 安全なproperties（文字列/数値/boolのみ、最大10キー）
  const safe = {};
  let i = 0;
  for (const [k, v] of Object.entries(properties || {})) {
    if (i++ >= 10) break;
    if (typeof k !== 'string' || k.length > 40) continue;
    if (['string', 'number', 'boolean'].includes(typeof v)) {
      if (typeof v === 'string' && v.length > 200) continue;
      safe[k] = v;
    }
  }

  const ev = {
    id: eventId(),
    name: eventName,
    t: Date.now(),
    p: safe,
    path: location.pathname,
    ref: document.referrer ? new URL(document.referrer).hostname : '',
    ua: (navigator.userAgent || '').slice(0, 120),
    w: window.innerWidth,
    lang: (navigator.language || '').slice(0, 8),
  };

  state.events.push(ev);
  if (state.events.length > MAX_EVENTS) state.events = state.events.slice(-MAX_EVENTS);

  state.counters[eventName] = (state.counters[eventName] || 0) + 1;
  save(state);
}

/**
 * カウンタ取得
 */
export function getCounter(name) {
  return state.counters[name] || 0;
}

/**
 * 日次カウンタ
 */
export function getDailyCounter(name) {
  const today = new Date().toISOString().slice(0, 10);
  return state.events.filter(e => e.name === name && new Date(e.t).toISOString().slice(0, 10) === today).length;
}

/**
 * 全データ取得（デバッグ用）
 */
export function exportAnalytics() {
  return JSON.parse(JSON.stringify(state));
}

/**
 * リセット
 */
export function resetAnalytics() {
  state.events = [];
  state.counters = {};
  save(state);
}

// ページビュートラッキング
track('pageview', { path: location.pathname });

// ページ滞在時間
let startTime = performance.now();
let pageHidden = false;
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !pageHidden) {
    const dur = Math.round((performance.now() - startTime) / 1000);
    track('session_end', { duration_sec: dur });
    pageHidden = true;
  } else if (!document.hidden && pageHidden) {
    startTime = performance.now();
    pageHidden = false;
  }
});

// エラー捕捉
window.addEventListener('error', (e) => {
  track('js_error', {
    msg: (e.message || '').slice(0, 120),
    src: (e.filename || '').slice(0, 80),
    line: e.lineno || 0,
  });
});
window.addEventListener('unhandledrejection', (e) => {
  track('promise_error', { msg: String(e.reason || '').slice(0, 120) });
});

// グローバルに小さなAPIを露出（DevToolsでのデバッグ用）
window.__AF_ANALYTICS__ = { track, getCounter, getDailyCounter, exportAnalytics, resetAnalytics };
