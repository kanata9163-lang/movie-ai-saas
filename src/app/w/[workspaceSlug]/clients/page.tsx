"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, type Client } from "@/lib/api-client";
import { Plus, Users, Loader2, Trash2 } from "lucide-react";
import { useUser } from "@/lib/useUser";

interface ClientsPageProps {
  params: { workspaceSlug: string };
}

export default function ClientsPage({ params }: ClientsPageProps) {
  const { workspaceSlug } = params;
  const { user } = useUser();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  const loadClients = async () => {
    try {
      const data = await api.listClients(workspaceSlug);
      setClients(data);
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadClients(); }, [workspaceSlug]);

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.createClient(workspaceSlug, { name: newName.trim(), notes: newNotes || undefined });
      setNewName(""); setNewNotes(""); setShowAdd(false);
      loadClients();
    } catch { alert("作成に失敗しました"); }
    finally { setCreating(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このクライアントを削除しますか？")) return;
    try { await api.deleteClient(workspaceSlug, id); loadClients(); }
    catch { alert("削除に失敗しました"); }
  };

  if (loading) {
    return (
      <>
        <Header title="クライアント情報" userEmail={user?.email} />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="クライアント情報" userEmail={user?.email} />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">クライアント情報</h1>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4" /> 新規クライアント追加
          </Button>
        </div>

        {showAdd && (
          <div className="mb-4 rounded-xl border border-border bg-card p-4 space-y-3">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="クライアント名" autoFocus />
            <Input value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="メモ（任意）" />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={creating}>
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "作成"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>キャンセル</Button>
            </div>
          </div>
        )}

        <div className="mb-4">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="クライアントを検索..." className="max-w-sm" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-3 text-center py-12 text-sm text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
              クライアントがありません
            </div>
          ) : (
            filtered.map((client) => (
              <div key={client.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <Users className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <h3 className="text-sm font-semibold">{client.name}</h3>
                  </div>
                  <button onClick={() => handleDelete(client.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {client.notes && <p className="text-xs text-muted-foreground">{client.notes}</p>}
                <p className="text-xs text-muted-foreground mt-2">
                  登録日: {new Date(client.created_at).toLocaleDateString('ja-JP')}
                </p>
              </div>
            ))
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-3">{filtered.length}件のクライアント</p>
      </main>
    </>
  );
}
