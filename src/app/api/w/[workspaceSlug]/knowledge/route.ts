import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getWorkspaceBySlug } from '@/lib/api-helpers';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const TEXT_MODEL = 'gemini-2.5-flash';

async function extractUrlContent(url: string): Promise<string> {
  let content: string;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VideoHarness/1.0)' },
    });
    const html = await response.text();
    content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 15000);
  } catch {
    return `URL: ${url} (コンテンツ取得不可)`;
  }

  const prompt = `以下のウェブページの内容を分析し、重要な情報を抽出・要約してください。ブランドガイドライン、トーン、メッセージ、ターゲット層、製品・サービス情報など、動画制作に役立つ情報を中心にまとめてください。

ウェブページの内容:
${content}

要約（日本語で）:`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );

  if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
  const result = await response.json();
  return result.candidates?.[0]?.content?.parts?.[0]?.text || content.slice(0, 2000);
}

export async function GET(req: NextRequest, { params }: { params: { workspaceSlug: string } }) {
  const supabase = createServerClient();
  const workspace = await getWorkspaceBySlug(params.workspaceSlug);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const url = new URL(req.url);
  const contentType = url.searchParams.get('content_type');
  const search = url.searchParams.get('search');

  let query = supabase
    .from('knowledge_items')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false });

  if (contentType) {
    query = query.eq('content_type', contentType);
  }
  if (search) {
    query = query.or(`title.ilike.%${search}%,content_text.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: NextRequest, { params }: { params: { workspaceSlug: string } }) {
  const supabase = createServerClient();
  const workspace = await getWorkspaceBySlug(params.workspaceSlug);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const body = await req.json();

  let contentText = body.content_text || '';

  // If URL type, extract and summarize content
  if (body.content_type === 'url' && body.source_url) {
    try {
      contentText = await extractUrlContent(body.source_url);
    } catch {
      contentText = `URL: ${body.source_url} (抽出エラー)`;
    }
  }

  const { data, error } = await supabase
    .from('knowledge_items')
    .insert({
      workspace_id: workspace.id,
      title: body.title || '無題',
      content_type: body.content_type || 'text',
      content_text: contentText,
      source_url: body.source_url || null,
      tags: body.tags || [],
      metadata: body.metadata || {},
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
