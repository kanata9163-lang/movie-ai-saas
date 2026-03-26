"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/lib/useUser";
import { Settings, Users, Link2, Loader2, Trash2, Copy, Check, MessageSquare, Zap, Send } from "lucide-react";
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

  // Integration state
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  const [slackChannel, setSlackChannel] = useState("");
  const [slackEnabled, setSlackEnabled] = useState(false);
  const [slackSaving, setSlackSaving] = useState(false);
  const [slackTesting, setSlackTesting] = useState(false);
  const [slackConnected, setSlackConnected] = useState(false);

  const [lineToken, setLineToken] = useState("");
  const [lineEnabled, setLineEnabled] = useState(false);
  const [lineSaving, setLineSaving] = useState(false);
  const [lineTesting, setLineTesting] = useState(false);
  const [lineConnected, setLineConnected] = useState(false);

  const loadData = async () => {
    try {
      const [settingsRes, membersRes, invitesRes, integrationsRes] = await Promise.all([
        fetch(`/api/w/${workspaceSlug}/settings`),
        fetch(`/api/w/${workspaceSlug}/members`),
        fetch(`/api/w/${workspaceSlug}/invites`).catch(() => null),
        fetch(`/api/w/${workspaceSlug}/integrations`).catch(() => null),
      ]);

      const settingsJson = await settingsRes.json();
      const membersJson = await membersRes.json();

      if (settingsJson.ok) {
        setWorkspace(settingsJson.data.workspace);
        setRole(settingsJson.data.role);
        setWorkspaceName(settingsJson.data.workspace.name || "");
      }
      if (membersJson.ok) setMembers(membersJson.data || []);

      if (invitesRes) {
        const invitesJson = await invitesRes.json();
        if (invitesJson.ok) setInvites(invitesJson.data || []);
      }
      if (integrationsRes) {
        const integrationsJson = await integrationsRes.json();
        if (integrationsJson.ok) {
          const integrations = integrationsJson.data as Array<{
            type: string;
            config: Record<string, string>;
            enabled: boolean;
          }>;
          const slack = integrations.find((i) => i.type === "slack");
          if (slack) {
            setSlackEnabled(slack.enabled);
            setSlackConnected(true);
            setSlackWebhookUrl(slack.config?.webhook_url || "");
            setSlackChannel(slack.config?.channel_name || "");
          }
          const line = integrations.find((i) => i.type === "line");
          if (line) {
            setLineEnabled(line.enabled);
            setLineConnected(true);
            setLineToken(line.config?.access_token || "");
          }
        }
      }
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
        alert("ワークスペース名を保存しました");
      } else {
        alert(json.error?.message || "保存に失敗しました");
      }
    } catch (e) {
      alert("保存に失敗しました: " + (e instanceof Error ? e.message : ""));
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
        alert("招待リンクを作成しました");
      } else {
        alert(json.error?.message || "招待リンクの作成に失敗しました");
      }
    } catch (e) {
      alert("招待リンクの作成に失敗しました: " + (e instanceof Error ? e.message : ""));
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

  const handleSaveSlack = async () => {
    setSlackSaving(true);
    try {
      const res = await fetch(`/api/w/${workspaceSlug}/integrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "slack",
          config: { webhook_url: slackWebhookUrl, channel_name: slackChannel },
          enabled: slackEnabled,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setSlackConnected(true);
        alert("Slack設定を保存しました");
      } else {
        alert(json.error?.message || "保存に失敗しました");
      }
    } catch {
      alert("保存に失敗しました");
    } finally {
      setSlackSaving(false);
    }
  };

  const handleTestSlack = async () => {
    setSlackTesting(true);
    try {
      if (!slackWebhookUrl) {
        alert("Webhook URLを入力してください");
        setSlackTesting(false);
        return;
      }
      const res = await fetch(`/api/w/${workspaceSlug}/integrations/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "slack", webhook_url: slackWebhookUrl }),
      });
      const json = await res.json();
      if (json.ok) {
        alert("テスト通知を送信しました！");
      } else {
        alert(json.error?.message || "テスト通知の送信に失敗しました。Webhook URLを確認してください。");
      }
    } catch {
      alert("テスト通知の送信に失敗しました。");
    } finally {
      setSlackTesting(false);
    }
  };

  const handleSaveLine = async () => {
    setLineSaving(true);
    try {
      const res = await fetch(`/api/w/${workspaceSlug}/integrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "line",
          config: { access_token: lineToken },
          enabled: lineEnabled,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setLineConnected(true);
        alert("LINE設定を保存しました");
      } else {
        alert(json.error?.message || "保存に失敗しました");
      }
    } catch {
      alert("保存に失敗しました");
    } finally {
      setLineSaving(false);
    }
  };

  const handleTestLine = async () => {
    setLineTesting(true);
    try {
      if (!lineToken) {
        alert("アクセストークンを入力してください");
        setLineTesting(false);
        return;
      }
      const res = await fetch(`/api/w/${workspaceSlug}/integrations/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "line", access_token: lineToken }),
      });
      const json = await res.json();
      if (json.ok) {
        alert("テスト通知を送信しました！");
      } else {
        alert(json.error?.message || "テスト通知の送信に失敗しました。アクセストークンを確認してください。");
      }
    } catch {
      alert("テスト通知の送信に失敗しました。");
    } finally {
      setLineTesting(false);
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

        {/* Integrations */}
        {isOwnerOrAdmin && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-zinc-500" />
              <h2 className="text-base font-semibold">連携設定</h2>
            </div>

            {/* Slack Integration */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#4A154B]/10 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-[#4A154B]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Slack連携</h3>
                    <p className="text-xs text-muted-foreground">Webhook URLで通知を送信</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  slackConnected && slackEnabled
                    ? "bg-green-100 text-green-700"
                    : "bg-zinc-100 text-zinc-500"
                }`}>
                  {slackConnected && slackEnabled ? "接続済み" : "未接続"}
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-zinc-600 mb-1 block">
                    Webhook URL
                  </label>
                  <Input
                    type="url"
                    value={slackWebhookUrl}
                    onChange={(e) => setSlackWebhookUrl(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-600 mb-1 block">
                    チャンネル名 (任意)
                  </label>
                  <Input
                    value={slackChannel}
                    onChange={(e) => setSlackChannel(e.target.value)}
                    placeholder="#general"
                    className="text-sm max-w-xs"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-zinc-600">有効化</label>
                  <button
                    onClick={() => setSlackEnabled(!slackEnabled)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      slackEnabled ? "bg-green-500" : "bg-zinc-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        slackEnabled ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <Button size="sm" onClick={handleSaveSlack} disabled={slackSaving}>
                  {slackSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "保存"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTestSlack}
                  disabled={slackTesting || !slackWebhookUrl}
                  className="gap-1.5"
                >
                  {slackTesting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  テスト送信
                </Button>
              </div>
            </div>

            {/* LINE Integration */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#00B900]/10 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-[#00B900]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">LINE Notify連携</h3>
                    <p className="text-xs text-muted-foreground">LINE Notifyで通知を送信</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  lineConnected && lineEnabled
                    ? "bg-green-100 text-green-700"
                    : "bg-zinc-100 text-zinc-500"
                }`}>
                  {lineConnected && lineEnabled ? "接続済み" : "未接続"}
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-zinc-600 mb-1 block">
                    アクセストークン
                  </label>
                  <Input
                    type="password"
                    value={lineToken}
                    onChange={(e) => setLineToken(e.target.value)}
                    placeholder="LINE Notify アクセストークン"
                    className="text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    <a
                      href="https://notify-bot.line.me/my/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      LINE Notify
                    </a>
                    {" "}でトークンを発行してください
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-zinc-600">有効化</label>
                  <button
                    onClick={() => setLineEnabled(!lineEnabled)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      lineEnabled ? "bg-green-500" : "bg-zinc-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        lineEnabled ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <Button size="sm" onClick={handleSaveLine} disabled={lineSaving}>
                  {lineSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "保存"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTestLine}
                  disabled={lineTesting || !lineToken}
                  className="gap-1.5"
                >
                  {lineTesting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  テスト送信
                </Button>
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
