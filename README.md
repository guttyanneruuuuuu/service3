# ⚔️ AVATAR FORGE

**写真1枚から伝説級3Dアバターを召喚するWebサービス。**
SSR/SR/Rガチャ演出 × 6スタイル × 360°録画 × SNSシェア。

🌐 **Live**: https://guttyanneruuuuuu.github.io/service3/

---

## 🎯 コンセプト

「自撮り1枚」→「ガチャ召喚」→「SSR引いた！」って叫びたくなる、SNSバズ狙いのエンタメ3Dアバター生成サービス。

### 差別化ポイント
- **完全ブラウザ処理** — 画像はサーバーに送信されず、プライバシー完璧
- **手続き型3D生成** — AIモデル不要で軽量・爆速・無料運用
- **ガチャ演出** — SSR 4% / SR 16% / R 80% で射倖心をくすぐる
- **6スタイル** — VOXEL / LOW POLY / CYBER / BIO MECH / FANTASY / CRYSTAL
- **360°録画** — 画面をそのまま動画化してTikTok/Xへ即投稿
- **レアリティバフ** — SSRには王冠・翼・パーティクル・専用武器などの追加演出
- **ステータスシステム** — POWER / MAGIC / SPEED / LUCK の4軸ステータス
- **ローカルギャラリー** — 召喚履歴を端末内保存（最大12体）

---

## 💰 マネタイズ設計

無料で始められ、成長したら段階的に課金化できる設計：

1. **Buy Me a Coffee / Ko-fi** — 応援ボタン（初期導線）
2. **プレミアムスタイル** — 「神話PREMIUM」「宇宙神」など限定スタイル
3. **Pro機能** — 4K解像度、透過背景PNG、高解像度録画
4. **広告** — Google AdSense枠を将来追加可能（現状は広告無し）
5. **アフィリエイト** — 3Dプリントサービス、VR機器など親和性高
6. **NFT/デジタル販売** — アバターデータをOpenSea等で販売（将来）

**高校生でも完全無料で運用可能**：
- ホスティング: GitHub Pages (無料)
- ドメイン: GitHub Pagesのデフォルト (無料)
- 処理: 全てクライアントサイド (サーバー費0円)

---

## 🛠️ 技術スタック

- **Three.js 0.160** — WebGL 3Dレンダリング（ESM + importmap）
- **FaceDetector API** — ブラウザネイティブ顔検出（Chromeなど）
- **Canvas 2D** — 色解析によるパレット抽出（全ブラウザ対応）
- **MediaRecorder API** — 360°動画録画（WebM/MP4）
- **Clipboard API** — スクショのクリップボードコピー
- **Web Share API** — ネイティブシェア
- **localStorage** — ギャラリー永続化
- **Service Worker** — オフライン対応

**サーバー不要** — 完全静的サイト。

---

## 🔐 セキュリティ対策

- **Content Security Policy (CSP)** — 外部スクリプト送信先ホワイトリスト化
- **X-Content-Type-Options: nosniff**
- **Referrer-Policy: strict-origin-when-cross-origin**
- **XSS対策** — `textContent`使用、DOMでのサニタイズ
- **ファイル検証** — MIME/サイズの二重チェック
- **画像非送信** — 全処理ブラウザ内完結
- **第三者クッキーゼロ** — トラッキング無し

---

## 📊 アナリティクス

自前軽量実装（`js/analytics.js`）、プライバシー重視：
- Cookieレス
- 個人識別子ゼロ
- localStorageに集計のみ保存
- トラッキングイベント例:
  - `pageview`
  - `photo_uploaded`
  - `style_selected`
  - `avatar_summoned` (style/rarity/stats)
  - `screenshot_taken`
  - `record_completed`
  - `share_native`
  - `js_error` / `promise_error`

DevTools Consoleで `__AF_ANALYTICS__.exportAnalytics()` を実行すると全データを確認できます。

---

## 📁 ディレクトリ構成

```
/
├── index.html          メイン
├── css/style.css       スタイル
├── js/
│   ├── app.js          アプリ本体
│   ├── ui.js           UI共通（トースト/モーダル/DnD）
│   ├── face.js         顔解析
│   ├── avatar3d.js     3Dアバター生成エンジン
│   ├── analytics.js    軽量アナリティクス
│   └── bg.js           背景パーティクル
├── assets/             ファビコン等
├── sw.js               Service Worker
├── robots.txt
├── sitemap.xml
└── .nojekyll           GitHub Pages Jekyll無効化
```

---

## 🚀 デプロイ

GitHub Pages（Actions不要、Settingsで`main`ブランチ指定）。

```bash
git push origin main
# Settings → Pages → Branch: main / root
```

---

## 🎮 隠し機能

コナミコマンド (↑↑↓↓←→←→BA) で次回SSR確率UP！

---

## 📜 ライセンス

MIT License

## 🙏 Credits

- Three.js — https://threejs.org/
- Fonts: Orbitron, Noto Sans JP (Google Fonts)
