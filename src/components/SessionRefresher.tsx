"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes
const PUBLIC_PATHS = ["/login", "/signup", "/auth/callback"];

export default function SessionRefresher() {
  const router = useRouter();
  const pathname = usePathname();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Don't run on public paths
    if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return;

    const refreshSession = async () => {
      try {
        const res = await fetch("/api/auth/refresh", { method: "POST" });
        if (res.status === 401) {
          // Session completely expired - redirect to login
          router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
        }
      } catch {
        // Network error - skip this cycle
      }
    };

    // Refresh immediately on mount (checks token validity)
    refreshSession();

    // Then refresh periodically
    intervalRef.current = setInterval(refreshSession, REFRESH_INTERVAL);

    // Also refresh when tab becomes visible again (user returns after being away)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshSession();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [pathname, router]);

  return null;
}
