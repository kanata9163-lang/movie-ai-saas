"use client";

import { Bell, LogOut, Coins } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";

function formatDate(date: Date): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayName = days[date.getDay()];
  const monthName = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  return `${dayName}, ${monthName} ${day}, ${year}`;
}

interface HeaderProps {
  title?: string;
  userEmail?: string;
}

export default function Header({ title, userEmail }: HeaderProps) {
  const today = new Date();
  const dateStr = formatDate(today);
  const router = useRouter();
  const pathname = usePathname();
  const [showMenu, setShowMenu] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Extract workspace slug from pathname
  const workspaceSlug = pathname?.match(/\/w\/([^/]+)/)?.[1] || '';

  useEffect(() => {
    if (!workspaceSlug) return;
    fetch(`/api/w/${workspaceSlug}/credits`)
      .then(res => res.json())
      .then(json => {
        if (json.ok) {
          setCredits(json.data.balance);
          setIsAdmin(json.data.isAdmin || false);
        }
      })
      .catch(() => {});
  }, [workspaceSlug]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <header className="h-14 border-b border-border bg-background flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-2">
        {title && (
          <h1 className="text-sm font-semibold text-foreground">{title}</h1>
        )}
      </div>
      <div className="flex items-center gap-3">
        {/* Credit balance - hidden for admins */}
        {credits !== null && workspaceSlug && !isAdmin && (
          <button
            onClick={() => router.push(`/w/${workspaceSlug}/settings?tab=billing`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors border border-amber-200"
          >
            <Coins className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-sm font-semibold text-amber-700">
              {credits.toLocaleString()}
            </span>
          </button>
        )}
        {/* Admin badge */}
        {isAdmin && workspaceSlug && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
            <Coins className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-700">∞</span>
          </div>
        )}
        {/* Email button */}
        <div className="relative">
          <button
            type="button"
            className="flex items-center gap-2 text-sm text-foreground hover:bg-muted px-3 py-1.5 rounded-lg transition-colors"
            onClick={() => setShowMenu(!showMenu)}
          >
            {userEmail || "ゲスト"}
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-background border border-border rounded-lg shadow-lg py-1 z-50 min-w-[160px]">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
              >
                <LogOut className="w-4 h-4" />
                ログアウト
              </button>
            </div>
          )}
        </div>
        {/* Date */}
        <span className="text-sm text-muted-foreground hidden sm:block">{dateStr}</span>
        {/* Bell */}
        <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
          <Bell className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
