"use client";

import { useState, useEffect } from "react";
import { cachedFetch } from "./fetch-cache";

interface User {
  id: string;
  email: string;
}

interface AuthResponse {
  ok: boolean;
  data?: User;
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cachedFetch<AuthResponse>("/api/auth/me", 60000)
      .then((json) => {
        if (json.ok && json.data) {
          setUser(json.data);
        } else {
          setUser(null);
        }
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return { user, loading };
}
