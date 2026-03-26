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
    .from('ad_analyses')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: NextRequest, { params }: { params: { workspaceSlug: string } }) {
  const supabase = createServerClient();
  const workspace = await getWorkspaceBySlug(params.workspaceSlug);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const body = await req.json();
  const { query, platform, industry } = body;

  if (!query || !platform) return NextResponse.json({ error: 'Query and platform are required' }, { status: 400 });

  const prompt = `あなたは広告クリエイティブの分析専門家です。以下の条件に基づいて、成功している広告クリエイティブのパターンを分析してください。

検索クエリ: ${query}
プラットフォーム: ${platform}
業界: ${industry || '指定なし'}

以下のJSON形式で分析結果を返してください：
{
  "adPatterns": [
    {
      "patternName": "パターン名",
      "description": "パターンの詳細説明",
      "effectiveness": "high/medium/low",
      "examples": ["具体例1", "具体例2"],
      "keyElements": {
        "hook": "冒頭の掴み方",
        "body": "本文の構成",
        "cta": "行動喚起の方法"
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

    const parsedResults = JSON.parse(jsonMatch[0]);
    const insights = parsedResults.overallInsights || null;

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
