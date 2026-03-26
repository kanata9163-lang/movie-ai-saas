"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderOpen,
  Calendar,
  Users,
  FileText,
  Film,
  Menu,
  X,
  Video,
  Clapperboard,
  BookOpen,
  TrendingUp,
  Megaphone,
  Settings,
  ChevronDown,
  Check,
  Plus,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cachedFetch, invalidateCache } from "@/lib/fetch-cache";

interface SidebarProps {
  workspaceSlug: string;
}

interface NavSection {
  title?: string;
  items: { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[];
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: string;
}

const navSections = (slug: string): NavSection[] => [
  {
    items: [
      { label: "ダッシュボード", href: `/w/${slug}`, icon: LayoutDashboard },
      { label: "プロジェクト一覧", href: `/w/${slug}/projects`, icon: FolderOpen },
    ],
  },
  {
    title: "絵コンテ",
    items: [
      { label: "絵コンテ一覧", href: `/w/${slug}/storyboards`, icon: Film },
    ],
  },
  {
    title: "動画生成",
    items: [
      { label: "動画プロジェクト", href: `/w/${slug}/video`, icon: Video },
      { label: "新規動画生成", href: `/w/${slug}/video/new`, icon: Clapperboard },
    ],
  },
  {
    title: "ナレッジ",
    items: [
      { label: "ナレッジベース", href: `/w/${slug}/knowledge`, icon: BookOpen },
      { label: "トレンドリサーチ", href: `/w/${slug}/trends`, icon: TrendingUp },
      { label: "広告分析", href: `/w/${slug}/ad-research`, icon: Megaphone },
    ],
  },
  {
    items: [
      { label: "スケジュール一覧", href: `/w/${slug}/schedule`, icon: Calendar },
      { label: "クライアント情報", href: `/w/${slug}/clients`, icon: Users },
      { label: "ファイル", href: `/w/${slug}/assets`, icon: FileText },
    ],
  },
  {
    items: [
      { label: "設定", href: `/w/${slug}/settings`, icon: Settings },
    ],
  },
];

export default function Sidebar({ workspaceSlug }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  const sections = navSections(workspaceSlug);

  useEffect(() => {
    cachedFetch<{ ok: boolean; data?: { items: Workspace[] } }>("/api/me/workspaces", 60000)
      .then((json) => {
        if (json.ok && json.data?.items) {
          setWorkspaces(json.data.items);
        }
      })
      .catch(() => {});
  }, []);

  // Close switcher on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const currentWorkspace = workspaces.find((w) => w.slug === workspaceSlug);

  const isActive = (href: string) => {
    if (href === `/w/${workspaceSlug}`) return pathname === href;
    return pathname.startsWith(href);
  };

  const handleSwitchWorkspace = (slug: string) => {
    setSwitcherOpen(false);
    router.push(`/w/${slug}`);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-border">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-zinc-900 rounded-md flex items-center justify-center">
            <Film className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-bold tracking-tight text-zinc-900">Vid Harness</span>
        </div>
      </div>

      {/* Workspace Switcher */}
      <div className="px-3 pt-3 pb-1" ref={switcherRef}>
        <button
          onClick={() => setSwitcherOpen(!switcherOpen)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-zinc-700 bg-zinc-50 hover:bg-zinc-100 transition-colors"
        >
          <span className="truncate">
            {currentWorkspace?.name || workspaceSlug}
          </span>
          <ChevronDown className={cn("w-4 h-4 flex-shrink-0 text-zinc-400 transition-transform", switcherOpen && "rotate-180")} />
        </button>
        {switcherOpen && (
          <div className="mt-1 rounded-lg border border-border bg-white shadow-lg py-1 z-50 relative">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => handleSwitchWorkspace(ws.slug)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                <span className="truncate">{ws.name}</span>
                {ws.slug === workspaceSlug && (
                  <Check className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                )}
              </button>
            ))}
            {workspaces.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                ワークスペースがありません
              </div>
            )}
            <div className="border-t border-border mt-1 pt-1">
              <button
                onClick={async () => {
                  const name = prompt("ワークスペース名を入力");
                  if (!name?.trim()) return;
                  try {
                    const res = await fetch("/api/me/workspaces", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: name.trim() }),
                    });
                    const json = await res.json();
                    if (json.ok && json.data?.slug) {
                      invalidateCache("workspaces");
                      router.push(`/w/${json.data.slug}`);
                    }
                  } catch { /* ignore */ }
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                新しいワークスペース
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {sections.map((section, si) => (
          <div key={si}>
            {section.title && (
              <p className="px-3 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    active
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-60 flex-shrink-0 flex-col h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile toggle button */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white border border-border text-zinc-700 rounded-lg shadow-sm"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/30"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-60 flex-shrink-0 h-full z-50">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
