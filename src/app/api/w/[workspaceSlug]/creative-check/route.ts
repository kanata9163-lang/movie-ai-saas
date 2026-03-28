import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getWorkspaceWithAuth, errorResponse } from '@/lib/api-helpers';

export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: { workspaceSlug: string } }) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, req);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const { mode, scriptText, projectId, platforms, industry, targetAudience, duration } = await req.json();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return errorResponse('config', 'GEMINI_API_KEY not set', 500);

  let creativeContent = scriptText || '';

  // If project mode, fetch project data
  if (mode === 'project' && projectId) {
    const supabase = createServerClient();
    const { data: project } = await supabase
      .from('video_projects')
      .select('*, video_scenes(*)')
      .eq('id', projectId)
      .single();

    if (project) {
      const scenes = (project.video_scenes || [])
        .sort((a: { scene_number: number }, b: { scene_number: number }) => a.scene_number - b.scene_number);

      creativeContent = `タイトル: ${project.title || '未設定'}\n`;
      creativeContent += `アスペクト比: ${project.aspect_ratio}\n\n`;
      creativeContent += scenes.map((s: { scene_number: number; narration_text: string; description: string; duration: number }) =>
        `シーン${s.scene_number}(${s.duration}秒): ナレーション「${s.narration_text}」 映像: ${s.description}`
      ).join('\n');
    }
  }

  if (!creativeContent) return errorResponse('validation', 'クリエイティブ内容が必要です', 400);

  const platformNames: Record<string, string> = {
    meta: 'Meta広告（Facebook/Instagram）',
    tiktok: 'TikTok広告',
    youtube: 'YouTube広告（YouTube Shorts/インストリーム）',
  };

  const platformList = (platforms || ['meta']).map((p: string) => platformNames[p] || p).join('、');

  const prompt = `あなたはデジタル広告のパフォーマンスアナリストです。以下の広告クリエイティブを各プラットフォームで配信した場合の予測パフォーマンスを分析してください。

## クリエイティブ内容
${creativeContent}

## 追加情報
- 業界: ${industry || '不明'}
- ターゲット: ${targetAudience || '一般'}
- 動画尺: ${duration || 30}秒

## 分析対象プラットフォーム
${platformList}

## 分析指示
1. 各プラットフォームの広告ベンチマークデータをWeb検索で調査してください
2. このクリエイティブの各プラットフォームでの適性を評価してください
3. プラットフォームごとの予測数値を出してください

以下のJSON配列で回答してください：
[
  {
    "platform": "meta",
    "platformLabel": "Meta広告",
    "score": 75,
    "scoreLabel": "良好",
    "metrics": {
      "ctr": { "predicted": "1.2%", "benchmark": "0.9%", "verdict": "above" },
      "cpm": { "predicted": "¥800", "benchmark": "¥1,200", "verdict": "above" },
      "cpc": { "predicted": "¥65", "benchmark": "¥85", "verdict": "above" },
      "hookRate": { "predicted": "35%", "benchmark": "25%", "verdict": "above" },
      "completionRate": { "predicted": "15%", "benchmark": "12%", "verdict": "above" }
    },
    "tips": ["フィードではテキストオーバーレイが重要", "最初の3秒で注目を集める映像を"],
    "bestFor": "認知拡大向き"
  }
]

各プラットフォームのmetricsには、そのプラットフォーム固有の重要指標を含めてください：
- Meta: CTR, CPM, CPC, フック率(hookRate), 完視聴率(completionRate)
- TikTok: CTR, CPM, 完視聴率(completionRate), サムストップ率(thumbStopRate), CVR
- YouTube: VTR(視聴率), CPV, CTR, 完視聴率(completionRate), CPM

verdictは "above", "below", "average" のいずれか。
scoreは0-100。

JSON配列のみを返してください。`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 6000 },
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

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Failed to parse analysis response');

    const analysisResults = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ ok: true, data: analysisResults });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
