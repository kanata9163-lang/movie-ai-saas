"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, type Client } from "@/lib/api-client";
import { Plus, Users, Loader2, Trash2, Globe, Mail, Phone, Building2 } from "lucide-react";
import LoadingAnimation from "@/components/LoadingAnimation";
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
  const [newWebsiteUrl, setNewWebsiteUrl] = useState("");
  const [newIndustry, setNewIndustry] = useState("");
  const [newContactPerson, setNewContactPerson] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
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
      const res = await fetch(`/api/w/${workspaceSlug}/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          notes: newNotes || undefined,
          website_url: newWebsiteUrl || undefined,
          industry: newIndustry || undefined,
          contact_person: newContactPerson || undefined,
          contact_email: newContactEmail || undefined,
          phone: newPhone || undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setNewName(""); setNewNotes(""); setNewWebsiteUrl(""); setNewIndustry("");
        setNewContactPerson(""); setNewContactEmail(""); setNewPhone("");
        setShowAdd(false);
        loadClients();
      }
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
          <LoadingAnimation message="クライアント情報を読み込み中..." />
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
          <div className="mb-4 rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-zinc-600 mb-1 block">会社名 *</label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="会社名" autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-600 mb-1 block">業界</label>
                <Input value={newIndustry} onChange={(e) => setNewIndustry(e.target.value)} placeholder="例: 化粧品, 飲食, IT" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-zinc-600 mb-1 block">ホームページURL</label>
                <Input value={newWebsiteUrl} onChange={(e) => setNewWebsiteUrl(e.target.value)} placeholder="https://example.com" type="url" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-600 mb-1 block">担当者名</label>
                <Input value={newContactPerson} onChange={(e) => setNewContactPerson(e.target.value)} placeholder="担当者名" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-600 mb-1 block">メールアドレス</label>
                <Input value={newContactEmail} onChange={(e) => setNewContactEmail(e.target.value)} placeholder="email@example.com" type="email" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-600 mb-1 block">電話番号</label>
                <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="090-xxxx-xxxx" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-600 mb-1 block">メモ</label>
                <Input value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="メモ（任意）" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleCreate} disabled={creating || !newName.trim()}>
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
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">{client.name}</h3>
                      {client.industry && (
                        <p className="text-[10px] text-muted-foreground">{client.industry}</p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(client.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {client.website_url && (
                  <a
                    href={client.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline mb-1.5"
                  >
                    <Globe className="w-3 h-3" />{client.website_url}
                  </a>
                )}
                {client.contact_person && (
                  <p className="text-xs text-zinc-600 mb-0.5">担当: {client.contact_person}</p>
                )}
                {client.contact_email && (
                  <p className="flex items-center gap-1 text-xs text-zinc-500 mb-0.5">
                    <Mail className="w-3 h-3" />{client.contact_email}
                  </p>
                )}
                {client.phone && (
                  <p className="flex items-center gap-1 text-xs text-zinc-500 mb-0.5">
                    <Phone className="w-3 h-3" />{client.phone}
                  </p>
                )}
                {client.notes && <p className="text-xs text-muted-foreground mt-1">{client.notes}</p>}
                <p className="text-[10px] text-muted-foreground mt-2">
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
