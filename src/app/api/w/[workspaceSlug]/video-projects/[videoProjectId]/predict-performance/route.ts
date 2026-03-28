import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getWorkspaceWithAuth, errorResponse } from '@/lib/api-helpers';

export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: { workspaceSlug: string; videoProjectId: string } }) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, req);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const supabase = createServerClient();
  const { data: project } = await supabase
    .from('video_projects')
    .select('*, video_scenes(*)')
    .eq('id', params.videoProjectId)
    .single();

  if (!project) return errorResponse('not_found', 'Project not found', 404);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return errorResponse('config', 'GEMINI_API_KEY not set', 500);

  // Build context from project data
  const scenes = (project.video_scenes || [])
    .sort((a: { scene_number: number }, b: { scene_number: number }) => a.scene_number - b.scene_number);

  const sceneDescriptions = scenes.map((s: { scene_number: number; narration_text: string; description: string; duration: number }) =>
    `シーン${s.scene_number}(${s.duration}秒): ナレーション「${s.narration_text}」 映像: ${s.description}`
  ).join('\n');

  const analysis = project.company_analysis || {};
  const totalDuration = scenes.reduce((sum: number, s: { duration: number }) => sum + (s.duration || 5), 0);

  const prompt = `あなたはデジタル広告のパフォーマンスアナリストです。以下の動画広告クリエイティブの内容を分析し、Meta広告（Facebook/Instagram）で配信した場合の予測パフォーマンス指標を算出してください。

## 動画広告の情報
- タイトル: ${project.title || '未設定'}
- 業界: ${analysis.industry || '不明'}
- 企業名: ${analysis.companyName || '不明'}
- ターゲット: ${analysis.targetAudience || '不明'}
- アスペクト比: ${project.aspect_ratio}
- 総尺: ${totalDuration}秒
- シーン数: ${scenes.length}

## シーン内容
${sceneDescriptions}

## 分析指示
1. まず、同業界・類似商材の競合広告のMeta広告ベンチマーク（業界平均CTR, CPM, CPC, CVR等）をWeb検索で調査してください
2. このクリエイティブの特徴（フック力、ストーリー構成、CTA、尺の適切さ等）を評価してください
3. 競合データに基づいて、このクリエイティブの予測数値を算出してください

以下のJSON形式で回答してください：
{
  "overallScore": 75,
  "scoreLabel": "良好",
  "metrics": {
    "ctr": { "predicted": "1.2%", "benchmark": "0.9%", "verdict": "above" },
    "cpm": { "predicted": "¥800", "benchmark": "¥1,200", "verdict": "above" },
    "cpc": { "predicted": "¥65", "benchmark": "¥85", "verdict": "above" },
    "cvr": { "predicted": "2.5%", "benchmark": "2.0%", "verdict": "above" },
    "hookRate": { "predicted": "35%", "benchmark": "25%", "verdict": "above" },
    "completionRate": { "predicted": "15%", "benchmark": "12%", "verdict": "above" },
    "cpa": { "predicted": "¥2,600", "benchmark": "¥3,500", "verdict": "above" }
  },
  "strengths": ["冒頭3秒のフックが強い", "CTAが明確"],
  "weaknesses": ["尺がやや長い", "テキスト情報が少ない"],
  "recommendations": ["最初の3秒をさらにインパクトのある映像に", "テキストオーバーレイを追加"],
  "competitorInsights": [
    {
      "competitor": "競合A",
      "insight": "同業界の競合Aは15秒の短尺動画でCTR 1.5%を達成",
      "source": "Meta Ad Library / 業界レポート"
    }
  ]
}

verdictは "above"（ベンチマーク以上）, "below"（以下）, "average"（同等）のいずれか。
overallScoreは0-100のスコア。

JSONのみを返してください。`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4000,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${err}`);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts
      ?.filter((p: { text?: string }) => p.text)
      ?.map((p: { text: string }) => p.text)
      ?.join('') || '';

    // Extract grounding sources
    const groundingMetadata = result.candidates?.[0]?.groundingMetadata;
    const searchResults = groundingMetadata?.groundingChunks?.map((chunk: { web?: { uri: string; title: string } }) => ({
      url: chunk.web?.uri || '',
      title: chunk.web?.title || '',
    })) || [];

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to parse prediction response');

    const prediction = JSON.parse(jsonMatch[0]);
    prediction.sources = searchResults;

    // Save prediction to project
    await supabase.from('video_projects').update({
      ad_prediction: prediction,
      updated_at: new Date().toISOString(),
    }).eq('id', params.videoProjectId);

    return NextResponse.json({ ok: true, data: prediction });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Performance prediction error:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
