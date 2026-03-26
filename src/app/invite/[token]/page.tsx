"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Film, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InvitePageProps {
  params: { token: string };
}

export default function InvitePage({ params }: InvitePageProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "accepting" | "success" | "error">("loading");
  const [error, setError] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");

  useEffect(() => {
    // Check if user is logged in
    acceptInvite();
  }, []);

  const acceptInvite = async () => {
    setStatus("accepting");
    try {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: params.token }),
      });

      const json = await res.json();

      if (res.status === 401) {
        // Not logged in - redirect to login with return URL
        router.push(`/login?redirect=/invite/${params.token}`);
        return;
      }

      if (!json.ok) {
        setStatus("error");
        setError(json.error?.message || "招待の処理に失敗しました");
        return;
      }

      setWorkspaceSlug(json.data.workspaceSlug);
      setStatus("success");

      // Auto-redirect after a short delay
      setTimeout(() => {
        router.push(`/w/${json.data.workspaceSlug}`);
      }, 2000);
    } catch {
      setStatus("error");
      setError("招待の処理に失敗しました");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="w-12 h-12 bg-zinc-950 rounded-xl flex items-center justify-center mx-auto">
          <Film className="w-7 h-7 text-white" />
        </div>

        {(status === "loading" || status === "accepting") && (
          <div className="space-y-3">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-zinc-400" />
            <p className="text-sm text-muted-foreground">招待を処理中...</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-3">
            <h1 className="text-xl font-bold">ワークスペースに参加しました</h1>
            <p className="text-sm text-muted-foreground">
              まもなくワークスペースに移動します...
            </p>
            <Button onClick={() => router.push(`/w/${workspaceSlug}`)}>
              ワークスペースを開く
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-3">
            <h1 className="text-xl font-bold text-destructive">エラー</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => router.push("/login")}>
              ログインページへ
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
