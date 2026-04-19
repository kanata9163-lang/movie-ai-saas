"use client";

import Link from "next/link";
import { Film, Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.error?.message || "登録に失敗しました");
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="w-12 h-12 bg-zinc-950 rounded-xl flex items-center justify-center mx-auto">
            <Mail className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">確認メールを送信しました</h1>
            <p className="text-sm text-muted-foreground mt-2">
              <span className="font-medium">{email}</span> 宛に確認メールをお送りしました。
              <br />
              メール内のリンクをクリックして登録を完了してください。
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            メールが届かない場合は迷惑メールフォルダをご確認ください。
          </p>
          <Link href="/login" className="text-sm text-foreground hover:underline font-medium inline-block">
            ログイン画面へ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-zinc-950 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Film className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold">新規登録</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vid Harness アカウントを作成
          </p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="text-sm font-medium">メールアドレス</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">パスワード</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワード（6文字以上）"
              minLength={6}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "確認メールを送信"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          アカウントをお持ちの方は{" "}
          <Link href="/login" className="text-foreground hover:underline font-medium">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}
