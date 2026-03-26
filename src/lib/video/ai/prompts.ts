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

以下のJSON形式で回答してください：
{
  "title": "動画のタイトル",
  "scenes": [
    {
      "sceneNumber": 1,
      "visualDescription": "シーンの映像説明（日本語）",
      "imagePrompt": "English image generation prompt, detailed, high quality, corporate style",
      "narrationText": "ナレーションテキスト（日本語）",
      "durationSeconds": 5
    }
  ]
}

JSONのみを返してください。`;
