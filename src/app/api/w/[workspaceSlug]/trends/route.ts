import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getWorkspaceBySlug } from '@/lib/api-helpers';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const TEXT_MODEL = 'gemini-2.5-flash';

export async function GET(req: NextRequest, { params }: { params: { workspaceSlug: string } }) {
  const supabase = createServerClient();
  const workspace = await getWorkspaceBySlug(params.workspaceSlug);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('trend_reports')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('generated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: NextRequest, { params }: { params: { workspaceSlug: string } }) {
  const supabase = createServerClient();
  const workspace = await getWorkspaceBySlug(params.workspaceSlug);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const body = await req.json();
  const { topic, platform } = body;

  if (!topic) return NextResponse.json({ error: 'Topic is required' }, { status: 400 });

  const prompt = `あなたはSNS動画マーケティングの専門家です。以下のトピックと投稿先プラットフォームに基づいて、最新のトレンド分析レポートを作成してください。

トピック: ${topic}
プラットフォーム: ${platform || '全プラットフォーム'}

以下のJSON形式で詳細なレポートを作成してください：
{
  "summary": "トレンドの概要（2-3文）",
  "trends": [
    {
      "title": "トレンド名",
      "description": "詳細な説明",
      "popularity": "high/medium/low",
      "relevance": "このトピックとの関連性の説明",
      "contentIdeas": ["動画コンテンツアイデア1", "動画コンテンツアイデア2"]
    }
  ],
  "hashtags": ["関連ハッシュタグ1", "関連ハッシュタグ2"],
  "bestPractices": ["ベストプラクティス1", "ベストプラクティス2"],
  "timingAdvice": "投稿タイミングのアドバイス",
  "competitorInsights": "競合の動向"
}

JSONのみを返してください。`;

  try {
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

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid response from Gemini');

    const reportContent = JSON.parse(jsonMatch[0]);

    // Extract grounding source URLs if available
    const sourceUrls: string[] = [];
    const groundingMetadata = result.candidates?.[0]?.groundingMetadata;
    if (groundingMetadata?.groundingChunks) {
      for (const chunk of groundingMetadata.groundingChunks) {
        if (chunk.web?.uri) sourceUrls.push(chunk.web.uri);
      }
    }

    const { data, error } = await supabase
      .from('trend_reports')
      .insert({
        workspace_id: workspace.id,
        topic,
        platform: platform || null,
        report_content: reportContent,
        source_urls: sourceUrls,
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
