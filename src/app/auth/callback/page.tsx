"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import LoadingAnimation from "@/components/LoadingAnimation";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session) {
          try {
            // Set cookies via server API
            const res = await fetch("/api/auth/oauth-complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                access_token: session.access_token,
                refresh_token: session.refresh_token,
                user_id: session.user.id,
                provider_token: session.provider_token || null,
                provider_refresh_token: session.provider_refresh_token || null,
              }),
            });

            const json = await res.json();
            if (!json.ok) {
              throw new Error(json.error?.message || "認証処理に失敗しました");
            }

            router.push(`/w/${json.data.workspaceSlug}`);
          } catch (err) {
            console.error("OAuth complete error:", err);
            setError(err instanceof Error ? err.message : "認証に失敗しました");
            setTimeout(() => router.push("/login"), 3000);
          }
        }
      }
    );

    // Also try to get existing session (in case onAuthStateChange already fired)
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        try {
          const res = await fetch("/api/auth/oauth-complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
              user_id: data.session.user.id,
              provider_token: data.session.provider_token || null,
              provider_refresh_token: data.session.provider_refresh_token || null,
            }),
          });

          const json = await res.json();
          if (json.ok) {
            router.push(`/w/${json.data.workspaceSlug}`);
          }
        } catch {
          // Will be handled by onAuthStateChange
        }
      }
    };

    // Small delay to let Supabase process the hash fragment
    setTimeout(checkSession, 500);

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-2">{error}</p>
          <p className="text-sm text-muted-foreground">ログイン画面に戻ります...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingAnimation message="認証処理中..." />
    </div>
  );
}
