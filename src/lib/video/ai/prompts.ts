export const ANALYZE_URL_PROMPT = `あなたは企業分析の専門家です。以下のウェブサイトの内容を分析し、企業情報を抽出してください。

ウェブサイトの内容:
{content}

以下のJSON形式で回答してください（日本語で）：
{
  "companyName": "会社名",
  "industry": "業界",
  "products": ["製品・サービス1", "製品・サービス2"],
  "targetAudience": "ターゲット層",
  "tone": "ブランドのトーン（例：プロフェッショナル、フレンドリー、革新的）",
  "keyMessages": ["重要なメッセージ1", "重要なメッセージ2"],
  "description": "企業の概要説明"
}

JSONのみを返してください。`;

export const GENERATE_SCRIPT_PROMPT = `あなたは企業プロモーション動画の脚本家です。以下の企業情報をもとに、TikTokやショート動画向けのプロモーション動画の台本を作成してください。

企業情報:
{analysis}

参照画像の説明:
{imageDescriptions}

シーン数: {sceneCount}

{knowledgeContext}

以下の条件で台本を作成してください：
1. 各シーンは3〜15秒程度
2. ナレーションは自然な日本語で、親しみやすいトーンで
3. 画像プロンプトは英語で、具体的な映像描写を含める
4. 企業の魅力が伝わるストーリー構成にする
5. 最初のシーンで視聴者の注目を集め、最後に行動喚起（CTA）を入れる

**ビジュアルの統一性に関する重要な指示：**
- まず「visualStyle」にて動画全体で統一するビジュアルスタイルを定義してください
- 全シーンのimagePromptの冒頭に、この統一スタイルを必ず含めてください
- 統一すべき要素：配色（カラーパレット）、照明（ライティング）、トーン（明るさ・雰囲気）、撮影スタイル（写実的/イラスト/CGなど）、フォント・テキストオーバーレイのスタイル
- 同じ人物が複数シーンに登場する場合、外見（服装、髪型、肌の色など）を統一してください
- ブランドカラーや企業ロゴの扱いも全シーンで一貫させてください

以下のJSON形式で回答してください：
{
  "title": "動画のタイトル",
  "visualStyle": "全シーン共通のビジュアルスタイル（例：Soft natural lighting, warm color palette with cream and coral tones, clean modern Japanese aesthetic, photorealistic style, young Japanese woman model with shoulder-length black hair）",
  "scenes": [
    {
      "sceneNumber": 1,
      "visualDescription": "シーンの映像説明（日本語）",
      "imagePrompt": "[共通スタイル含む] English image generation prompt, detailed, high quality",
      "narrationText": "ナレーションテキスト（日本語）",
      "durationSeconds": 5
    }
  ]
}

JSONのみを返してください。`;
