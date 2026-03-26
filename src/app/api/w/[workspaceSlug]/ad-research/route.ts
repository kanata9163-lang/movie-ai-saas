import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getWorkspaceBySlug } from '@/lib/api-helpers';

export const maxDuration = 60;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const TEXT_MODEL = 'gemini-2.5-flash';
const IMAGE_MODEL = 'gemini-2.0-flash-preview-image-generation';

export async function GET(req: NextRequest, { params }: { params: { workspaceSlug: string } }) {
  const supabase = createServerClient();
  const workspace = await getWorkspaceBySlug(params.workspaceSlug);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('ad_analyses')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

function getAdLibraryLinks(platform: string, query: string): { name: string; url: string }[] {
  const q = encodeURIComponent(query);
  const links: { name: string; url: string }[] = [];

  if (platform === 'Facebook' || platform === 'Instagram') {
    links.push({
      name: 'Meta広告ライブラリ',
      url: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=JP&q=${q}&media_type=all`,
    });
  }
  if (platform === 'TikTok') {
    links.push({
      name: 'TikTok Creative Center',
      url: `https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/ja`,
    });
    links.push({
      name: 'TikTok広告ライブラリ',
      url: `https://library.tiktok.com/ads?region=JP&keyword=${q}`,
    });
  }
  if (platform === 'YouTube' || platform === 'Google') {
    links.push({
      name: 'Google広告透明性センター',
      url: `https://adstransparency.google.com/?region=JP&query=${q}`,
    });
  }
  // Always add Meta as a general reference
  if (platform !== 'Facebook' && platform !== 'Instagram') {
    links.push({
      name: 'Meta広告ライブラリ',
      url: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=JP&q=${q}&media_type=all`,
    });
  }
  return links;
}

async function generateCreativeMockup(patternName: string, description: string, query: string, platform: string): Promise<string | null> {
  try {
    const prompt = `Create a professional social media ad creative mockup/example for ${platform}.
Ad type: ${patternName}
Product/theme: ${query}
Style: ${description}

Generate a realistic-looking ${platform} ad creative image. Make it look like an actual advertisement that would appear on ${platform}. Include visual elements, text overlays, and branding typical of high-performing ${platform} ads. The image should be a vertical 9:16 format suitable for mobile viewing. Make it polished and professional.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
      }
    );

    if (!response.ok) return null;
    const result = await response.json();
    const parts = result.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest, { params }: { params: { workspaceSlug: string } }) {
  const supabase = createServerClient();
  const workspace = await getWorkspaceBySlug(params.workspaceSlug);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const body = await req.json();
  const { query, platform, industry } = body;

  if (!query || !platform) return NextResponse.json({ error: 'Query and platform are required' }, { status: 400 });

  const prompt = `あなたは広告クリエイティブの分析専門家です。以下の条件に基づいて、実際に成功している広告クリエイティブの具体例を分析してください。

検索クエリ: ${query}
プラットフォーム: ${platform}
業界: ${industry || '指定なし'}

**重要**: 各パターンには、実際の広告クリエイティブの具体例を必ず含めてください。ブランド名、具体的な広告のフォーマット、ビジュアルの構成を詳しく記述してください。

以下のJSON形式で分析結果を返してください：
{
  "adPatterns": [
    {
      "patternName": "パターン名",
      "description": "パターンの詳細説明",
      "effectiveness": "high/medium/low",
      "creativeExamples": [
        {
          "brandName": "具体的なブランド名",
          "adFormat": "動画広告/カルーセル/静止画等",
          "visualDescription": "クリエイティブの視覚的な説明（画面構成、色使い、テキスト配置など）を50文字以上で詳しく",
          "copyText": "実際の広告コピー例",
          "whyItWorks": "なぜこのクリエイティブが効果的なのか",
          "sourceUrl": "この広告事例の参考URL（記事やSNS投稿のURL）があれば記載",
          "thumbnailUrl": "広告のサムネイル画像URL（見つかれば記載、なければ空文字）"
        }
      ],
      "keyElements": {
        "hook": "冒頭の掴み方（具体的な秒数と内容）",
        "body": "本文の構成（具体的なシーン遷移）",
        "cta": "行動喚起の方法（具体的なテキストとデザイン）"
      },
      "storyboard": {
        "scene1": "0-2秒: 具体的な画面内容",
        "scene2": "2-5秒: 具体的な画面内容",
        "scene3": "5-10秒: 具体的な画面内容",
        "scene4": "10-15秒: 具体的な画面内容"
      },
      "targetAudience": "想定ターゲット",
      "estimatedEngagement": "予想エンゲージメント率"
    }
  ],
  "overallInsights": {
    "topFormats": ["効果的なフォーマット1", "効果的なフォーマット2"],
    "colorTrends": ["トレンドカラー1", "トレンドカラー2"],
    "musicStyles": ["効果的な音楽スタイル1"],
    "optimalDuration": "最適な動画時間",
    "doList": ["すべきこと1", "すべきこと2"],
    "dontList": ["避けるべきこと1", "避けるべきこと2"]
  },
  "recommendations": [
    {
      "title": "推奨アクション",
      "description": "詳細",
      "priority": "high/medium/low"
    }
  ]
}

JSONのみを返してください。`;

  try {
    // 1. Text analysis with Google Search grounding
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ googleSearch: {} }],
        }),
      }
    );

    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Extract grounding source URLs from Gemini metadata
    const groundingMeta = result.candidates?.[0]?.groundingMetadata;
    const groundingSources: { title: string; url: string }[] = [];
    if (groundingMeta?.groundingChunks) {
      for (const chunk of groundingMeta.groundingChunks) {
        if (chunk.web?.uri && chunk.web?.title) {
          groundingSources.push({ title: chunk.web.title, url: chunk.web.uri });
        }
      }
    }
    // Also check searchEntryPoint for rendered search results
    if (groundingMeta?.webSearchQueries) {
      // Store the search queries used
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid response from Gemini');

    const parsedResults = JSON.parse(jsonMatch[0]);
    const insights = parsedResults.overallInsights || null;

    // Attach grounding sources as reference URLs
    parsedResults.referenceSources = groundingSources;

    // 2. Generate mockup images for top 2 patterns (parallel)
    const patterns = parsedResults.adPatterns || [];
    const topPatterns = patterns.slice(0, 2);

    const mockupPromises = topPatterns.map((p: { patternName: string; description: string }) =>
      generateCreativeMockup(p.patternName, p.description, query, platform)
    );
    const mockupResults = await Promise.all(mockupPromises);

    // Attach mockup images to patterns
    for (let i = 0; i < topPatterns.length; i++) {
      if (mockupResults[i]) {
        topPatterns[i].mockupImage = mockupResults[i];
      }
    }

    // 3. Add ad library links
    parsedResults.adLibraryLinks = getAdLibraryLinks(platform, query);

    const { data, error } = await supabase
      .from('ad_analyses')
      .insert({
        workspace_id: workspace.id,
        query,
        platform,
        results: parsedResults,
        insights,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
