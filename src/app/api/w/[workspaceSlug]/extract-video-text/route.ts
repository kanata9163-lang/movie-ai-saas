import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceWithAuth, errorResponse } from '@/lib/api-helpers';

export const maxDuration = 120;

export async function POST(req: NextRequest, { params }: { params: { workspaceSlug: string } }) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, req);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return errorResponse('config', 'GEMINI_API_KEY not set', 500);

  const formData = await req.formData();
  const file = formData.get('video') as File | null;
  if (!file) return errorResponse('validation', '動画ファイルが必要です', 400);

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || 'video/mp4';

  // Step 1: Upload file to Gemini File API
  const uploadRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Command': 'upload, finalize',
        'X-Goog-Upload-Header-Content-Length': String(buffer.length),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': mimeType,
      },
      body: buffer,
    }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    return NextResponse.json({ ok: false, error: `ファイルアップロードに失敗: ${err}` }, { status: 500 });
  }

  const uploadResult = await uploadRes.json();
  const fileUri = uploadResult.file?.uri;
  if (!fileUri) {
    return NextResponse.json({ ok: false, error: 'ファイルURIの取得に失敗しました' }, { status: 500 });
  }

  // Step 2: Wait for file to be processed (poll until ACTIVE)
  const fileName = uploadResult.file?.name;
  let fileState = uploadResult.file?.state;
  let attempts = 0;
  while (fileState === 'PROCESSING' && attempts < 30) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const statusRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`
    );
    if (statusRes.ok) {
      const statusData = await statusRes.json();
      fileState = statusData.state;
    }
    attempts++;
  }

  if (fileState !== 'ACTIVE') {
    return NextResponse.json({ ok: false, error: '動画の処理がタイムアウトしました' }, { status: 500 });
  }

  // Step 3: Ask Gemini to extract all text from the video
  const extractPrompt = `この動画を分析して、以下の情報をすべてテキストとして抽出してください。

1. **音声書き起こし**: 動画内で話されている全ての音声をそのまま書き起こしてください
2. **テロップ・字幕**: 画面上に表示されているテキスト（テロップ、字幕、タイトル、ロゴテキスト等）をすべて抽出してください
3. **映像の説明**: 各シーンで何が映っているか簡潔に説明してください

以下のフォーマットで出力してください：

## 音声書き起こし
（ここに音声テキスト）

## テロップ・画面内テキスト
（ここに画面上のテキスト一覧）

## 映像内容
（ここに映像の説明）`;

  const genRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { fileData: { fileUri, mimeType } },
            { text: extractPrompt },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8000 },
      }),
    }
  );

  // Clean up uploaded file (fire and forget)
  fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`, {
    method: 'DELETE',
  }).catch(() => {});

  if (!genRes.ok) {
    const err = await genRes.text();
    return NextResponse.json({ ok: false, error: `テキスト抽出に失敗: ${err}` }, { status: 500 });
  }

  const genResult = await genRes.json();
  const extractedText = genResult.candidates?.[0]?.content?.parts
    ?.filter((p: { text?: string }) => p.text)
    ?.map((p: { text: string }) => p.text)
    ?.join('') || '';

  if (!extractedText) {
    return NextResponse.json({ ok: false, error: '動画からテキストを抽出できませんでした' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: { extractedText } });
}
