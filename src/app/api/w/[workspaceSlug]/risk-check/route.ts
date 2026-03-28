import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getWorkspaceWithAuth, errorResponse } from '@/lib/api-helpers';

export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: { workspaceSlug: string } }) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, req);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const { mode, scriptText, projectId, platforms } = await req.json();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return errorResponse('config', 'GEMINI_API_KEY not set', 500);

  let content = scriptText || '';

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

      content = `タイトル: ${project.title || '未設定'}\n\n`;
      content += scenes.map((s: { scene_number: number; narration_text: string; description: string; subtitle_text: string | null }) =>
        `シーン${s.scene_number}: ナレーション「${s.narration_text}」 映像説明: ${s.description}${s.subtitle_text ? ` テロップ「${s.subtitle_text}」` : ''}`
      ).join('\n');
    }
  }

  if (!content) return errorResponse('validation', 'チェック対象のコンテンツが必要です', 400);

  const platformList = (platforms || ['meta']).join(', ');

  const prompt = `あなたは広告コンプライアンスとクオリティチェックの専門家です。以下の広告クリエイティブを配信前の最終チェックとして評価してください。

## チェック対象の広告コンテンツ
${content}

## 配信予定プラットフォーム
${platformList}

## チェック項目
1. **コンテンツリスク**: 各媒体の広告ポリシーに違反する表現がないか（薬機法、景品表示法、差別的表現、過度な煽り、根拠のない効果効能の記載、比較広告の問題等）
2. **誤字脱字チェック**: ナレーションやテロップの日本語の誤字・脱字・不自然な表現
3. **媒体別コンプライアンス**: 各プラットフォーム固有の広告ポリシーへの準拠度
4. **法務チェック**: 著作権、商標、個人情報、特定商取引法などの法的リスク

以下のJSON形式で回答してください：
{
  "overallVerdict": "safe",
  "verdictLabel": "配信可能",
  "verdictDescription": "重大なリスクは検出されませんでした。軽微な注意点があります。",
  "risks": [
    {
      "severity": "warning",
      "category": "表現リスク",
      "message": "「最高の」という最上級表現が使われています",
      "detail": "景品表示法の優良誤認に該当する可能性があります。具体的な根拠データの付記を推奨します。",
      "platform": "Meta"
    }
  ],
  "typos": [
    {
      "original": "御利用頂けます",
      "suggestion": "ご利用いただけます",
      "context": "...今すぐ御利用頂けます..."
    }
  ],
  "platformCompliance": [
    {
      "platform": "Meta広告",
      "status": "ok",
      "issues": []
    },
    {
      "platform": "TikTok広告",
      "status": "warning",
      "issues": ["15秒未満の動画が推奨されます"]
    }
  ],
  "legalChecks": [
    {
      "item": "薬機法",
      "status": "ok",
      "detail": "医薬品・健康食品に関する不適切な効能表現は検出されませんでした"
    },
    {
      "item": "景品表示法",
      "status": "warning",
      "detail": "「最安値」などの表現には根拠資料が必要です"
    },
    {
      "item": "著作権",
      "status": "ok",
      "detail": "著作権侵害のリスクは検出されませんでした"
    },
    {
      "item": "特定商取引法",
      "status": "ok",
      "detail": "問題なし"
    }
  ]
}

overallVerdictは "safe"（配信可能）, "caution"（要注意・条件付き配信可能）, "danger"（配信不可・要修正）のいずれか。
severity は "critical"（重大）, "warning"（注意）, "info"（参考情報）, "pass"（問題なし）のいずれか。

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
          generationConfig: { temperature: 0.2, maxOutputTokens: 6000 },
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

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to parse risk check response');

    const riskResult = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ ok: true, data: riskResult });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
