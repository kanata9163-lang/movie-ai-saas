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
  "description": "企業の概要説明",
  "citations": [
    {
      "fact": "抽出した事実や数値データ",
      "source": "この情報の出典箇所（ページ内のどの部分から抽出したか）",
      "context": "前後の文脈"
    }
  ],
  "marketInsights": [
    {
      "insight": "市場や競合に関する示唆",
      "basis": "この示唆の根拠"
    }
  ]
}

重要：
- citationsには、サイトから抽出した具体的な事実・数値・統計データを含めてください
- 各citationには必ずsource（出典箇所）を明記してください
- marketInsightsには、分析から得られた市場に関する洞察を含めてください
- JSONのみを返してください。`;

export const GENERATE_SCRIPT_PROMPT = `あなたは企業プロモーション動画の脚本家です。以下の企業情報をもとに、TikTokやショート動画向けのプロモーション動画の台本を作成してください。

企業情報:
{analysis}

参照画像の説明:
{imageDescriptions}

シーン数: {sceneCount}

{knowledgeContext}

重要：台本作成時は、企業の実際のデータや数値を活用してください。市場調査や分析結果の情報がある場合は、具体的な数字や事実を引用してナレーションに盛り込んでください。

以下の条件で台本を作成してください：
1. 各シーンは5〜10秒（durationSecondsは5または10のみ）
2. ナレーションは自然な日本語で、親しみやすいトーンで
3. 画像プロンプトは英語で、具体的な映像描写を含める
4. 企業の魅力が伝わるストーリー構成にする
5. 最初のシーンで視聴者の注目を集め、最後に行動喚起（CTA）を入れる

**ナレーション文字数の制限（非常に重要）：**
- 日本語ナレーションは1秒あたり約4文字が目安です
- durationSeconds=5のシーン → ナレーションは最大20文字以内
- durationSeconds=10のシーン → ナレーションは最大40文字以内
- この文字数制限を厳守してください。長すぎるナレーションは音声が途切れる原因になります
- 短く印象的なフレーズを心がけてください

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
