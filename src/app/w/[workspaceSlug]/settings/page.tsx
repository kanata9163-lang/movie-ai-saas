"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/lib/useUser";
import { Settings, Users, Link2, Loader2, Trash2, Copy, Check } from "lucide-react";
import LoadingAnimation from "@/components/LoadingAnimation";

interface SettingsPageProps {
  params: { workspaceSlug: string };
}

interface Member {
  id: string;
  user_id: string;
  role: string;
  email: string;
  display_name: string;
  created_at: string;
}

interface Invite {
  id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

export default function SettingsPage({ params }: SettingsPageProps) {
  const { workspaceSlug } = params;
  const { user } = useUser();

  const [loading, setLoading] = useState(true);
  const [, setWorkspace] = useState<Record<string, unknown> | null>(null);
  const [role, setRole] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);

  const [workspaceName, setWorkspaceName] = useState("");
  const [saving, setSaving] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [settingsRes, membersRes, invitesRes] = await Promise.all([
        fetch(`/api/w/${workspaceSlug}/settings`),
        fetch(`/api/w/${workspaceSlug}/members`),
        fetch(`/api/w/${workspaceSlug}/invites`),
      ]);

      const settingsJson = await settingsRes.json();
      const membersJson = await membersRes.json();
      const invitesJson = await invitesRes.json();

      if (settingsJson.ok) {
        setWorkspace(settingsJson.data.workspace);
        setRole(settingsJson.data.role);
        setWorkspaceName(settingsJson.data.workspace.name || "");
      }
      if (membersJson.ok) setMembers(membersJson.data);
      if (invitesJson.ok) setInvites(invitesJson.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workspaceSlug]);

  const handleSaveName = async () => {
    if (!workspaceName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/w/${workspaceSlug}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workspaceName.trim() }),
      });
      const json = await res.json();
      if (json.ok) {
        setWorkspace(json.data);
      }
    } catch {
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateInvite = async () => {
    setCreatingInvite(true);
    try {
      const res = await fetch(`/api/w/${workspaceSlug}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json.ok) {
        setInvites((prev) => [json.data, ...prev]);
      }
    } catch {
      alert("招待リンクの作成に失敗しました");
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleCopyInviteLink = (token: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("このメンバーをワークスペースから削除しますか？")) return;
    try {
      const res = await fetch(`/api/w/${workspaceSlug}/members?memberId=${memberId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.ok) {
        setMembers((prev) => prev.filter((m) => m.id !== memberId));
      } else {
        alert(json.error?.message || "削除に失敗しました");
      }
    } catch {
      alert("削除に失敗しました");
    }
  };

  const isOwnerOrAdmin = role === "owner" || role === "admin";

  if (loading) {
    return (
      <>
        <Header title="ワークスペース設定" userEmail={user?.email} />
        <main className="flex-1 flex items-center justify-center">
          <LoadingAnimation message="設定を読み込み中..." />
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="ワークスペース設定" userEmail={user?.email} />
      <main className="flex-1 overflow-y-auto p-6 space-y-8 max-w-3xl">
        {/* Workspace Name */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-zinc-500" />
            <h2 className="text-base font-semibold">基本設定</h2>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div>
              <label className="text-sm font-medium text-zinc-700 mb-1 block">
                ワークスペース名
              </label>
              <div className="flex gap-3">
                <Input
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  disabled={!isOwnerOrAdmin}
                  className="max-w-sm"
                />
                {isOwnerOrAdmin && (
                  <Button onClick={handleSaveName} disabled={saving} size="sm">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "保存"}
                  </Button>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-700 mb-1 block">
                スラッグ
              </label>
              <p className="text-sm text-muted-foreground">{workspaceSlug}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-700 mb-1 block">
                あなたの権限
              </label>
              <p className="text-sm text-muted-foreground">{role}</p>
            </div>
          </div>
        </section>

        {/* Members */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-zinc-500" />
            <h2 className="text-base font-semibold">メンバー</h2>
          </div>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium">{member.display_name}</p>
                  <p className="text-xs text-muted-foreground">{member.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs px-2 py-1 rounded-full bg-zinc-100 text-zinc-600 font-medium">
                    {member.role}
                  </span>
                  {isOwnerOrAdmin && member.user_id !== user?.id && (
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {members.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                メンバーがいません
              </div>
            )}
          </div>
        </section>

        {/* Invites */}
        {isOwnerOrAdmin && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-zinc-500" />
                <h2 className="text-base font-semibold">招待リンク</h2>
              </div>
              <Button onClick={handleCreateInvite} disabled={creatingInvite} size="sm">
                {creatingInvite ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "新しい招待リンクを作成"
                )}
              </Button>
            </div>
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {invites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-mono text-zinc-600">
                      {invite.token.slice(0, 8)}...
                    </p>
                    <p className="text-xs text-muted-foreground">
                      有効期限: {new Date(invite.expires_at).toLocaleDateString("ja-JP")}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyInviteLink(invite.token)}
                    className="gap-1.5"
                  >
                    {copiedToken === invite.token ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        コピー済み
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        リンクをコピー
                      </>
                    )}
                  </Button>
                </div>
              ))}
              {invites.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  有効な招待リンクがありません
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
