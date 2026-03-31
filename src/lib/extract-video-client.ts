/**
 * Client-side video text extraction.
 * Uploads video directly to Gemini File API (bypasses Vercel body size limit),
 * then calls our server to run text extraction with the uploaded file URI.
 */
export async function extractVideoText(
  workspaceSlug: string,
  videoFile: File,
  onProgress?: (msg: string) => void
): Promise<string> {
  // Step 1: Get Gemini API key from server
  onProgress?.('APIキーを取得中...');
  const keyRes = await fetch(`/api/w/${workspaceSlug}/extract-video-text`);
  const keyJson = await keyRes.json();
  if (!keyJson.ok) throw new Error(keyJson.error || 'APIキーの取得に失敗');
  const apiKey = keyJson.data.apiKey;

  // Step 2: Upload video directly to Gemini File API
  onProgress?.('動画をアップロード中...');
  const buffer = await videoFile.arrayBuffer();
  const mimeType = videoFile.type || 'video/mp4';

  const uploadRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Command': 'upload, finalize',
        'X-Goog-Upload-Header-Content-Length': String(buffer.byteLength),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': mimeType,
      },
      body: buffer,
    }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`アップロード失敗: ${err}`);
  }

  const uploadResult = await uploadRes.json();
  const fileUri = uploadResult.file?.uri;
  const fileName = uploadResult.file?.name;
  if (!fileUri) throw new Error('ファイルURIの取得に失敗');

  // Step 3: Call server to extract text using the uploaded file
  onProgress?.('動画を解析中...（音声・テロップを抽出しています）');
  const extractRes = await fetch(`/api/w/${workspaceSlug}/extract-video-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileUri, mimeType, fileName }),
  });

  const extractJson = await extractRes.json();
  if (!extractJson.ok) throw new Error(extractJson.error || 'テキスト抽出に失敗');

  return extractJson.data.extractedText;
}
