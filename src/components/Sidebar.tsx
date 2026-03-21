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
    <div className="flex flex-col h-full bg-white border-r border-border">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-zinc-900 rounded-md flex items-center justify-center">
            <Film className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-bold tracking-tight text-zinc-900">絵コンテ生成</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
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
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
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
