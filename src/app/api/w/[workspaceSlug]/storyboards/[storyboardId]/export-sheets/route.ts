import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceWithAuth } from '@/lib/api-helpers';

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string; storyboardId: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  // Get Google access token from cookie
  const googleToken = request.cookies.get('google-access-token')?.value;

  if (!googleToken) {
    return errorResponse('no_token', 'Googleアカウントでログインし直してください。スプレッドシートへのアクセス権限が必要です。', 401);
  }

  const db = getSupabase();

  // Get storyboard
  const { data: storyboard } = await db
    .from('storyboards')
    .select('*')
    .eq('id', params.storyboardId)
    .single();

  if (!storyboard) return errorResponse('not_found', 'Storyboard not found', 404);

  // Get latest draft
  const { data: draft } = await db
    .from('drafts')
    .select('*')
    .eq('storyboard_id', params.storyboardId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!draft) return errorResponse('not_found', 'Draft not found', 404);

  // Get scenes
  const { data: scenes } = await db
    .from('draft_scenes')
    .select('*')
    .eq('draft_id', draft.id)
    .order('scene_order');

  // Create Google Spreadsheet via API
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${googleToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: `${storyboard.title || '絵コンテ'} - Storyboard`,
      },
      sheets: [
        {
          properties: {
            title: '絵コンテ',
            gridProperties: { frozenRowCount: 1 },
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    console.error('Google Sheets API error:', errText);
    return errorResponse('sheets_error', 'スプレッドシートの作成に失敗しました。Googleアカウントでログインし直してください。', 500);
  }

  const spreadsheet = await createRes.json();
  const spreadsheetId = spreadsheet.spreadsheetId;
  const spreadsheetUrl = spreadsheet.spreadsheetUrl;

  // Populate with data
  const headerRow = ['シーン番号', 'セリフ', 'シーン説明', '画像プロンプト', '画像URL'];
  const dataRows = (scenes || []).map((s: Record<string, unknown>) => [
    s.scene_order,
    s.dialogue || '',
    s.description || '',
    s.image_prompt || '',
    s.image_url || '',
  ]);

  const values = [headerRow, ...dataRows];

  // Update values
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/絵コンテ!A1?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${googleToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );

  // Format header row (bold, background color)
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${googleToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.1, green: 0.1, blue: 0.1 },
                  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 0, endIndex: 5 },
              properties: { pixelSize: 200 },
              fields: 'pixelSize',
            },
          },
        ],
      }),
    }
  );

  return jsonResponse({ spreadsheetId, spreadsheetUrl });
}
