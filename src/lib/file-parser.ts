/**
 * Extract text content from attached documents using Gemini API.
 * Supports: PDF, DOCX, CSV, XLSX
 */

const SUPPORTED_MIME_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word (DOCX)',
  'application/msword': 'Word (DOC)',
  'text/csv': 'CSV',
  'application/vnd.ms-excel': 'Excel (XLS)',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel (XLSX)',
};

export function isSupportedFileType(mimeType: string): boolean {
  return mimeType in SUPPORTED_MIME_TYPES || mimeType === 'text/plain';
}

export function getFileTypeLabel(mimeType: string): string {
  return SUPPORTED_MIME_TYPES[mimeType] || 'テキスト';
}

/**
 * Extract text from a document file using Gemini API
 */
export async function extractTextFromFile(
  base64Data: string,
  mimeType: string,
  fileName: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  // For CSV and plain text, just decode directly
  if (mimeType === 'text/csv' || mimeType === 'text/plain') {
    const buffer = Buffer.from(base64Data, 'base64');
    return buffer.toString('utf-8');
  }

  // For binary files (PDF, DOCX, XLSX), use Gemini to extract text
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data,
              }
            },
            {
              text: `この添付ファイル（${fileName}）の内容をすべてテキストとして抽出してください。表やリストがある場合はそのまま構造を保って出力してください。余計な解説は不要です。ファイルの中身だけを出力してください。`
            }
          ]
        }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 8000,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini file parse error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
}
