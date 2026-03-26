"use client";

import { useState, useEffect } from "react";
import { cachedFetch } from "@/lib/fetch-cache";

interface User {
  id: string;
  email: string;
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cachedFetch<{ ok: boolean; data?: User }>("/api/auth/me", 120000)
      .then((json) => {
        if (json.ok) {
          setUser(json.data || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { user, loading };
}
