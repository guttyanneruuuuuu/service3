// ============================================================
// UI Module — トースト、モーダル、ドラッグ&ドロップ
// ============================================================

const toastContainer = document.getElementById('toast-container');

/**
 * トースト通知表示
 * @param {string} message
 * @param {'ok'|'err'|'warn'|'info'} type
 * @param {number} duration
 */
export function toast(message, type = 'info', duration = 3000) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message; // textContent使用でXSS対策
  toastContainer.appendChild(el);

  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 400);
  }, duration);
}

/**
 * モーダル表示
 */
export function showModal(html) {
  const modal = document.getElementById('modal');
  const body = document.getElementById('modal-body');
  body.innerHTML = ''; // リセット

  if (typeof html === 'string') {
    // 信頼できるHTMLのみ渡す前提、但し念のため
    body.innerHTML = html;
  } else if (html instanceof HTMLElement) {
    body.appendChild(html);
  }

  modal.hidden = false;
  document.body.style.overflow = 'hidden';
}

export function closeModal() {
  const modal = document.getElementById('modal');
  modal.hidden = true;
  document.body.style.overflow = '';
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-close-modal]')) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

/**
 * ドラッグ&ドロップ初期化
 */
export function initDragDrop(dropZone, onFile) {
  ['dragenter', 'dragover'].forEach((ev) => {
    dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach((ev) => {
    dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    });
  });
  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      onFile(files[0]);
    }
  });
}

/**
 * 画像ファイルバリデーション
 * セキュリティ: MIMEとサイズチェック
 */
export function validateImage(file) {
  if (!file) return { ok: false, error: 'ファイルが選択されていません' };
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
  if (!allowedTypes.includes(file.type)) {
    return { ok: false, error: '画像形式が対応していません (JPEG/PNG/WebP)' };
  }
  const maxSize = 20 * 1024 * 1024; // 20MB
  if (file.size > maxSize) {
    return { ok: false, error: 'ファイルサイズが大きすぎます (最大20MB)' };
  }
  return { ok: true };
}

/**
 * 画像をImageElementとして読み込む
 */
export function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('画像読み込みに失敗'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('ファイル読み込みに失敗'));
    reader.readAsDataURL(file);
  });
}

/**
 * プライバシー・利用規約モーダル
 */
export function initLegalModals() {
  document.getElementById('privacy-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    showModal(`
      <h3>プライバシーポリシー</h3>
      <p>AVATAR FORGE は、ユーザーのプライバシーを最優先に設計されています。</p>
      <ul style="color:var(--text-dim); line-height:1.8; font-size:14px;">
        <li><b>写真データ</b>: アップロードされた画像はブラウザ内でのみ処理され、<b>サーバーへ一切送信されません</b>。</li>
        <li><b>顔解析</b>: MediaPipe/FaceDetector等のブラウザ内ライブラリで処理されます。</li>
        <li><b>アバターデータ</b>: 生成されたアバターは端末のlocalStorageにのみ保存されます。</li>
        <li><b>アクセス解析</b>: Cookieを使わない匿名の統計（ページビュー数、召喚回数など）のみ収集します。個人を特定する情報は一切収集しません。</li>
        <li><b>第三者</b>: 外部CDN(jsdelivr, Google Fonts)を使用しています。</li>
      </ul>
      <p style="font-size:12px; color:var(--text-mute); margin-top:16px;">最終更新: 2026-04-23</p>
    `);
  });

  document.getElementById('terms-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    showModal(`
      <h3>利用規約</h3>
      <p>本サービスを利用することで、以下の規約に同意したものとみなされます:</p>
      <ul style="color:var(--text-dim); line-height:1.8; font-size:14px;">
        <li>本人または権利を持つ画像のみアップロードしてください。</li>
        <li>生成されたアバターは個人利用・SNS投稿に自由に使えます。</li>
        <li>商用利用は個別にお問い合わせください。</li>
        <li>他者の権利を侵害する使い方を禁止します。</li>
        <li>本サービスは現状のまま提供され、明示・黙示を問わず保証はありません。</li>
      </ul>
      <p style="font-size:12px; color:var(--text-mute); margin-top:16px;">最終更新: 2026-04-23</p>
    `);
  });
}

initLegalModals();
