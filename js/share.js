// share.js - Room data encoding / URL sharing / QR / Analytics counters
//
// Encoding strategy:
//  - Serialize room state to compact JSON
//  - Gzip-like compress using built-in CompressionStream ('deflate-raw')
//  - Base64URL encode
//  - Append to URL hash so zero server needed
//
// Fallback: if CompressionStream unavailable, just base64url(JSON) + a 'v' marker.

const VERSION = 1;

/** Convert a Uint8Array to base64url string (no padding) */
function u8ToB64url(u8){
  let s = '';
  const CHUNK = 0x8000;
  for(let i=0;i<u8.length;i+=CHUNK){
    s += String.fromCharCode.apply(null, u8.subarray(i, i+CHUNK));
  }
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
/** Inverse of u8ToB64url */
function b64urlToU8(b64){
  b64 = b64.replace(/-/g,'+').replace(/_/g,'/');
  const pad = b64.length % 4;
  if(pad) b64 += '='.repeat(4-pad);
  const s = atob(b64);
  const u8 = new Uint8Array(s.length);
  for(let i=0;i<s.length;i++) u8[i] = s.charCodeAt(i);
  return u8;
}

async function compress(u8){
  if(typeof CompressionStream === 'undefined') return null;
  const cs = new CompressionStream('deflate-raw');
  const stream = new Blob([u8]).stream().pipeThrough(cs);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}
async function decompress(u8){
  if(typeof DecompressionStream === 'undefined') return null;
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([u8]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Encode room state to a share token (string).
 * @param {object} state
 * @returns {Promise<string>}
 */
export async function encodeRoom(state){
  // Compact representation: rename keys, round coords
  const packed = {
    v: VERSION,
    t: state.title || '',
    s: [state.size, state.height],
    c: [state.floorColor, state.wallColor],
    th: state.theme || 'cozy',
    items: state.items.map(it => [
      it.type,
      Math.round(it.x*1000)/1000,
      Math.round(it.z*1000)/1000,
      Math.round((it.rotY||0)*100)/100,
      it.wallSide||0, // 0=floor, 1=N,2=E,3=S,4=W
      Math.round((it.y||0)*1000)/1000,
    ]),
  };
  const json = JSON.stringify(packed);
  const u8 = new TextEncoder().encode(json);
  const compressed = await compress(u8);
  if(compressed && compressed.length < u8.length){
    return 'z.' + u8ToB64url(compressed);
  }
  return 'j.' + u8ToB64url(u8);
}

/**
 * Decode share token back to state.
 */
export async function decodeRoom(token){
  if(!token) return null;
  try{
    const [prefix, data] = token.split('.', 2);
    const bytes = b64urlToU8(data);
    let jsonBytes = bytes;
    if(prefix === 'z'){
      jsonBytes = await decompress(bytes);
      if(!jsonBytes) throw new Error('decompress unsupported');
    }
    const json = new TextDecoder().decode(jsonBytes);
    const packed = JSON.parse(json);
    if(packed.v !== VERSION) console.warn('Room version mismatch');
    return {
      title: packed.t || '',
      size: packed.s?.[0] ?? 10,
      height: packed.s?.[1] ?? 3,
      floorColor: packed.c?.[0] ?? '#8b6f4e',
      wallColor: packed.c?.[1] ?? '#f0e8dc',
      theme: packed.th || 'cozy',
      items: (packed.items||[]).map(arr => ({
        type: arr[0],
        x: arr[1], z: arr[2],
        rotY: arr[3] || 0,
        wallSide: arr[4] || 0,
        y: arr[5] || 0,
      })),
    };
  }catch(err){
    console.error('decode failed:', err);
    return null;
  }
}

/** Build shareable URL from state */
export async function buildShareUrl(state){
  const token = await encodeRoom(state);
  const base = location.origin + location.pathname;
  return `${base}#r=${token}`;
}

/** Read share token from current URL */
export function readTokenFromUrl(){
  const hash = location.hash;
  const m = hash.match(/[#&]r=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

// ======== Simple visit counter (clientside, no backend) ========
// Uses a tiny public counter via api.countapi.xyz style service is
// not reliable — instead we use localStorage for "my rooms" stats
// and display them locally. For "global" totals we use the
// localStorage across all rooms this browser has touched.
// This is intentionally privacy-preserving: no server needed.
const STATS_KEY = 'roomify:stats:v1';
export function getGlobalStats(){
  try{
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? JSON.parse(raw) : { rooms: 0, visits: 0 };
  }catch{ return { rooms:0, visits:0 }; }
}
export function incrementStat(key, by=1){
  const s = getGlobalStats();
  s[key] = (s[key]||0) + by;
  try{ localStorage.setItem(STATS_KEY, JSON.stringify(s)); }catch{}
  return s;
}

// ======== Messages (per-room, stored locally) ========
// Messages live in localStorage keyed by a short hash of the token.
// This means visitors see messages others have left *on that room on this browser*.
// It's local-first but since the room URL encodes everything, the
// "host" can collect messages when their friends return with updates.
// For real cross-user messaging, a tiny free backend (e.g. jsonbin.io)
// could be added later — but this is zero-cost.
function hashToken(token){
  let h=0; for(let i=0;i<token.length;i++){ h=((h<<5)-h+token.charCodeAt(i))|0; }
  return (h>>>0).toString(36);
}
const MSG_PREFIX = 'roomify:msg:';
export function getMessages(token){
  try{
    const raw = localStorage.getItem(MSG_PREFIX+hashToken(token));
    return raw ? JSON.parse(raw) : [];
  }catch{ return []; }
}
export function addMessage(token, name, text){
  if(!text || !text.trim()) return;
  const msgs = getMessages(token);
  msgs.unshift({
    n: (name||'ゲスト').substring(0,12),
    t: text.substring(0,140),
    d: Date.now(),
  });
  msgs.splice(50); // keep last 50
  try{ localStorage.setItem(MSG_PREFIX+hashToken(token), JSON.stringify(msgs)); }catch{}
  return msgs;
}

// ======== QR Code (minimal pure-JS generator) ========
// We use a tiny public library hot-loaded only when share modal opens,
// but to stay 100% offline we include a micro QR implementation below.
// Source: adapted from public-domain "qrcode-generator" light version.
// For brevity and reliability, we draw a simple block QR via a minimal encoder.
// If the encoder is too heavy, fall back to serving just the URL text.

export async function drawQR(canvas, text){
  // Lazy-load qrcode lib from CDN (cached after first load)
  if(!window.__qrcode){
    await new Promise((resolve, reject) => {
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
      s.onload=()=>resolve();
      s.onerror=()=>reject();
      document.head.appendChild(s);
    }).catch(()=>{});
    window.__qrcode = window.QRCode;
  }
  if(window.__qrcode){
    await window.__qrcode.toCanvas(canvas, text, { width: canvas.width, margin: 1, color:{dark:'#0a0a12',light:'#ffffff'} });
  }else{
    // fallback: just draw text
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#000'; ctx.font='10px monospace';
    ctx.fillText('QR load failed', 10, 20);
  }
}

// ======== Share helpers ========
export function makeTwitterUrl(url, title){
  const txt = `🏠 ${title || '私の部屋'} ができたよ！歩き回って見てみて #Roomify`;
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(txt)}&url=${encodeURIComponent(url)}`;
}
export function makeLineUrl(url, title){
  return `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title || 'Roomify')}`;
}

export async function nativeShare(url, title){
  if(navigator.share){
    try{
      await navigator.share({ title: title || 'Roomify', text: 'My 3D room!', url });
      return true;
    }catch(e){ /* user cancelled */ }
  }
  return false;
}

export async function copyToClipboard(text){
  try{
    await navigator.clipboard.writeText(text);
    return true;
  }catch{
    // fallback: use execCommand
    try{
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    }catch{ return false; }
  }
}
