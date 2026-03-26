import { NextRequest } from 'next/server';
import { getSupabase, jsonResponse, errorResponse, getWorkspaceWithAuth } from '@/lib/api-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const url = new URL(request.url);
  const q = url.searchParams.get('q');

  let query = db
    .from('clients')
    .select('id, workspace_id, name, notes, website_url, industry, contact_person, contact_email, phone, created_at, updated_at')
    .eq('workspace_id', auth.workspace.id)
    .order('created_at', { ascending: false });

  if (q) query = query.ilike('name', `%${q}%`);

  const { data, error } = await query;
  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(data, 200, 30);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceSlug: string } }
) {
  const auth = await getWorkspaceWithAuth(params.workspaceSlug, request);
  if (!auth) return errorResponse('forbidden', 'Not a workspace member', 403);

  const db = getSupabase();
  const body = await request.json();
  if (!body.name) return errorResponse('validation', 'name is required');

  const { data, error } = await db
    .from('clients')
    .insert({
      workspace_id: auth.workspace.id,
      name: body.name,
      notes: body.notes || null,
      website_url: body.website_url || null,
      industry: body.industry || null,
      contact_person: body.contact_person || null,
      contact_email: body.contact_email || null,
      phone: body.phone || null,
    })
    .select()
    .single();

  if (error) return errorResponse('db_error', error.message, 500);
  return jsonResponse(data, 201);
}
