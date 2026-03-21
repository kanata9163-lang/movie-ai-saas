"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { useState } from "react";

interface SidebarProps {
  workspaceSlug: string;
}

const navItems = (slug: string) => [
  {
    label: "ダッシュボード",
    href: `/w/${slug}`,
    icon: LayoutDashboard,
  },
  {
    label: "プロジェクト一覧",
    href: `/w/${slug}/projects`,
    icon: FolderOpen,
  },
  {
    label: "スケジュール一覧",
    href: `/w/${slug}/schedule`,
    icon: Calendar,
  },
  {
    label: "クライアント情報",
    href: `/w/${slug}/clients`,
    icon: Users,
  },
  {
    label: "ファイル",
    href: `/w/${slug}/assets`,
    icon: FileText,
  },
];

export default function Sidebar({ workspaceSlug }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = navItems(workspaceSlug);

  const isActive = (href: string) => {
    if (href === `/w/${workspaceSlug}`) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-zinc-950 text-white">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center">
            <Film className="w-5 h-5 text-zinc-950" />
          </div>
          <span className="text-lg font-bold tracking-tight">絵コンテ生成</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map((item) => {
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
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer - intentionally empty to match original */}
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
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-zinc-900 text-white rounded-lg"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/50"
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
