"use client";

import { useState } from "react";
import { Share2, Check, Copy, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShareButtonProps {
  title?: string;
  text?: string;
  url?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function ShareButton({ title, text, url, variant = "outline", size, className }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");

  const handleShare = async () => {
    // Try native Web Share API first (works on mobile, macOS Safari - includes AirDrop)
    if (navigator.share) {
      try {
        await navigator.share({
          title: title || document.title,
          text: text || "",
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or share failed, fall through to menu
      }
    }
    // Fallback: show copy menu
    setShowMenu(!showMenu);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => { setCopied(false); setShowMenu(false); }, 1500);
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => { setCopied(false); setShowMenu(false); }, 1500);
    }
  };

  return (
    <div className="relative">
      <Button variant={variant} size={size} onClick={handleShare} className={className}>
        {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Share2 className="w-3.5 h-3.5" />}
        共有
      </Button>
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg border border-border shadow-lg py-1 min-w-[200px]">
            <button
              onClick={handleCopyUrl}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-50 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-zinc-500" />}
              {copied ? "コピーしました！" : "URLをコピー"}
            </button>
            <button
              onClick={() => {
                window.open(`https://line.me/R/share?text=${encodeURIComponent((title || "") + " " + shareUrl)}`, "_blank", "width=500,height=600");
                setShowMenu(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-50 transition-colors"
            >
              <Link2 className="w-4 h-4 text-green-500" />
              LINEで送る
            </button>
          </div>
        </>
      )}
    </div>
  );
}
