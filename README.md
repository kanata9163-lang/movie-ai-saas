# Vid Harness - AI動画広告制作SaaS

URLを入力するだけで、AIが自動で広告動画を制作するSaaSプラットフォームです。

## 主な機能

- **URL解析 & 台本自動生成** - WebサイトURLからAIが企業分析・台本を自動作成
- **AI画像生成** - シーンごとの広告画像を自動生成
- **AI動画生成** - BytePlus Seedance APIで画像から動画を生成
- **ナレーション生成** - ElevenLabsで自然な音声ナレーションを生成
- **字幕テロップ** - シーンごとのテロップを自動挿入
- **BGM生成** - Gemini AIでBGMを自動生成
- **動画結合 & エクスポート** - FFmpeg WASMでブラウザ上で動画を結合、ZIP一括エクスポート
- **広告パフォーマンス予測** - Meta広告のCTR/CVR等をAIが予測
- **クリエイティブ分析** - 既存動画をアップロードして分析
- **配信リスクチェック** - 広告ポリシー違反リスクをAIが検出
- **広告リサーチ** - 競合広告の分析と改善提案
- **クレジット課金** - Stripe決済でクレジット購入
- **チーム管理** - ワークスペース・メンバー招待機能
- **Slack / LINE通知** - 連携設定で進捗通知

## 技術スタック

| カテゴリ | 技術 |
|---|---|
| フレームワーク | Next.js 14 (App Router) |
| 言語 | TypeScript |
| データベース / 認証 | Supabase |
| AI (テキスト・分析) | Google Gemini 2.5 Flash |
| AI (動画生成) | BytePlus Seedance 1.5 Pro |
| AI (ナレーション) | ElevenLabs |
| 決済 | Stripe Checkout |
| 動画処理 | FFmpeg WASM (ブラウザ上) |
| デプロイ | Vercel |
| UI | Tailwind CSS, shadcn/ui |

## セットアップ

### 1. リポジトリをクローン

```bash
git clone https://github.com/your-username/vid-harness.git
cd vid-harness
npm install
```

### 2. 環境変数を設定

```bash
cp .env.example .env.local
```

`.env.local` を編集して各APIキーを設定してください。

### 3. Supabaseのセットアップ

Supabaseプロジェクトを作成し、`supabase/migrations/` 内のSQLを実行してテーブルを作成してください。

### 4. 開発サーバーを起動

```bash
npm run dev
```

http://localhost:3000 でアクセスできます。

### 5. Vercelにデプロイ

```bash
vercel deploy
```

Vercelダッシュボードで環境変数を設定してください。

## 必要なAPIキー

| サービス | 用途 | 取得先 |
|---|---|---|
| Supabase | DB・認証 | https://supabase.com |
| Google Gemini | テキスト分析・台本生成 | https://aistudio.google.com |
| BytePlus | 動画生成 | https://www.byteplus.com |
| ElevenLabs | ナレーション音声 | https://elevenlabs.io |
| Stripe | 決済 | https://stripe.com |

## ライセンス

MIT

## 制作

Claude Code (Anthropic Claude) と共同開発
