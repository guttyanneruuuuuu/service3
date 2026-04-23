# 🏠 Roomify

**自分の部屋を3Dで作って、世界に公開できるSNS**

ブラウザだけで歩き回れる3Dルームをデザインし、URL 1本で誰でもシェア可能。
完全クライアントサイド、サーバー不要、**完全無料**で運営できる Web サービスです。

🔗 **Live Demo**: https://guttyanneruuuuuu.github.io/service3/

---

## ✨ 特徴

- 🎨 **ドラッグ＆ドロップで家具配置** — マイクラ風の直感操作
- 🚶 **歩き回れる3Dビューア** — WASD / ジョイスティックで散策
- 🔗 **URL 1つでシェア** — 部屋のデータは全部URL内に圧縮格納（サーバーレス）
- 💬 **訪問者メッセージ** — 部屋に落書き可能
- 🎭 **テーマ切り替え** — ほっこり・モダン・ダーク・カワイイ（無料）／ネオン・宇宙・水中・アニメ（PRO）
- 📱 **PC・スマホ完全対応** — タッチ操作・仮想ジョイスティック
- 🔒 **セキュリティ対策済み** — CSP / XSS対策 / nosniff / referrer policy
- 📊 **Google Analytics 連携** — プライバシー配慮（IP匿名化）
- ⚡ **完全オフライン動作可** — 一度読み込めばネット不要

---

## 🎯 マネタイズモデル

1. **Premium Pack ¥500（買い切り）**
   - 限定家具パック（ユニコーン・ネオン看板・宇宙カプセル等）
   - プレミアムテーマ解放
   - カスタムURL
   - 訪問者アナリティクス
2. **カスタムドメイン（月額300円）** *(将来)*
3. **企業コラボ部屋** *(将来)*
4. **投げ銭機能** *(将来)*

---

## 🛠 技術スタック

| レイヤ | 使用技術 |
|--------|---------|
| 3Dレンダリング | Three.js (r160) |
| UI | Vanilla JS (ESM) + CSS3 |
| データ保存 | URL Hash (deflate-raw 圧縮 + base64url) |
| QRコード | qrcode.js (lazy load) |
| ホスティング | GitHub Pages（完全無料） |
| アナリティクス | Google Analytics 4 |
| セキュリティ | CSP / XCTO / Referrer Policy |

**ゼロバックエンド設計** — 部屋データはURLに、メッセージ等はLocalStorageに保存されます。

---

## 📂 プロジェクト構成

```
/
├── index.html            # エントリーポイント
├── 404.html              # GitHub Pages用リダイレクト
├── robots.txt
├── sitemap.xml
├── .nojekyll
├── css/
│   └── style.css         # 全スタイル
└── js/
    ├── app.js            # アプリケーション制御
    ├── editor.js         # 3D部屋エディター
    ├── viewer.js         # 歩き回りビューアー
    ├── hero.js           # ランディング3D背景
    ├── furniture.js      # 家具定義（手続き的メッシュ生成）
    └── share.js          # URL圧縮/シェア/QR/メッセージ
```

---

## 🚀 ローカル開発

```bash
# リポジトリをクローン
git clone https://github.com/guttyanneruuuuuu/service3.git
cd service3

# 任意の静的サーバで動きます
python3 -m http.server 8000
# → http://localhost:8000 にアクセス
```

---

## 🔐 セキュリティ

- **Content-Security-Policy** で XSS を大幅ブロック
- **X-Content-Type-Options: nosniff**
- **Referrer-Policy: strict-origin-when-cross-origin**
- ユーザー入力は全て `escapeHtml` でエスケープ
- 外部スクリプトは CDN + integrity（Three.js公式CDN経由）
- LocalStorage のみ使用、Cookie不使用

---

## 📊 アナリティクス

- Google Analytics 4 (`G-PLACEHOLDER` を本番用IDに置換してください)
- IP匿名化有効
- 主要イベント: `screen_view` / `add_furniture` / `share_open` / `share_copy` / `view_shared_room` / `premium_view` / `premium_unlock_demo` / `leave_message`

---

## 🎨 家具の追加

`js/furniture.js` の `FURNITURE` 配列に新しい家具を定義するだけ。全て関数的に3Dモデルを生成する（procedural）ため、外部3Dファイル不要。

```js
function myNewItem(){
  const g = new THREE.Group();
  // … meshを組み立てる
  return { group: g, size: {w:1, h:1, d:1} };
}
// FURNITURE 配列に追加
{ id:'myitem', name:'私の家具', icon:'🎁', cat:'basic', build: myNewItem },
```

---

## 📜 ライセンス

MIT

---

Built with ❤️ for creators everywhere.
