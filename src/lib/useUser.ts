"use client";

import { useState, useEffect } from "react";

interface User {
  id: string;
  email: string;
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Don't use cachedFetch for auth - always get fresh data
    fetch("/api/auth/me")
      .then(async (res) => {
        const json = await res.json();
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
