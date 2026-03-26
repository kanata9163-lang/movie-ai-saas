"use client";

import { useEffect, useState } from "react";

// 映画制作にちなんだローディングアニメーション
// カチンコ（クラッパーボード）が走り、フィルムリールが回る

export default function LoadingAnimation({ message }: { message?: string }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % 200);
    }, 30);
    return () => clearInterval(interval);
  }, []);

  // Clapperboard position (runs across screen)
  const clapX = (frame * 2.5) % 420 - 60;
  // Film reel rotation
  const reelRotation = frame * 6;
  // Bounce
  const bounce = Math.abs(Math.sin((frame * 0.08) * Math.PI)) * 8;

  return (
    <div className="flex flex-col items-center justify-center py-8 select-none">
      {/* Animation stage */}
      <div className="relative w-80 h-20 overflow-hidden mb-4">
        {/* Ground line */}
        <div className="absolute bottom-2 left-0 right-0 h-px bg-zinc-200" />

        {/* Film strip on ground */}
        <div className="absolute bottom-2 left-0 right-0 flex">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-6 h-1 border-x border-zinc-100"
              style={{
                transform: `translateX(${-(frame * 1.5) % 24}px)`,
              }}
            >
              <div className="w-full h-full bg-zinc-50" />
            </div>
          ))}
        </div>

        {/* Running clapperboard character */}
        <div
          className="absolute bottom-2 transition-none"
          style={{
            transform: `translateX(${clapX}px) translateY(${-bounce}px)`,
          }}
        >
          {/* Clapperboard body */}
          <svg width="40" height="48" viewBox="0 0 40 48" fill="none">
            {/* Board */}
            <rect x="4" y="16" width="32" height="24" rx="2" fill="#18181b" />
            <rect x="6" y="18" width="28" height="20" rx="1" fill="#27272a" />
            {/* Stripes on top */}
            <rect
              x="4"
              y="10"
              width="32"
              height="8"
              rx="1"
              fill="#18181b"
              style={{
                transformOrigin: "4px 18px",
                transform: `rotate(${Math.sin(frame * 0.15) * 8 - 4}deg)`,
              }}
            />
            {/* White stripes */}
            <rect x="8" y="11" width="5" height="6" fill="white" opacity="0.9"
              style={{
                transformOrigin: "4px 18px",
                transform: `rotate(${Math.sin(frame * 0.15) * 8 - 4}deg)`,
              }}
            />
            <rect x="17" y="11" width="5" height="6" fill="white" opacity="0.9"
              style={{
                transformOrigin: "4px 18px",
                transform: `rotate(${Math.sin(frame * 0.15) * 8 - 4}deg)`,
              }}
            />
            <rect x="26" y="11" width="5" height="6" fill="white" opacity="0.9"
              style={{
                transformOrigin: "4px 18px",
                transform: `rotate(${Math.sin(frame * 0.15) * 8 - 4}deg)`,
              }}
            />
            {/* Text on board */}
            <text x="20" y="31" textAnchor="middle" fill="white" fontSize="6" fontWeight="bold">
              SCENE
            </text>
            {/* Legs */}
            <line
              x1="14"
              y1="40"
              x2={12 + Math.sin(frame * 0.2) * 4}
              y2="47"
              stroke="#18181b"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <line
              x1="26"
              y1="40"
              x2={28 - Math.sin(frame * 0.2) * 4}
              y2="47"
              stroke="#18181b"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Film reel (static position, rotating) */}
        <div className="absolute right-4 bottom-3">
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            style={{ transform: `rotate(${reelRotation}deg)` }}
          >
            <circle cx="14" cy="14" r="13" fill="none" stroke="#d4d4d8" strokeWidth="1.5" />
            <circle cx="14" cy="14" r="9" fill="none" stroke="#d4d4d8" strokeWidth="1" />
            <circle cx="14" cy="14" r="3" fill="#d4d4d8" />
            {/* Spokes */}
            {[0, 60, 120, 180, 240, 300].map((angle) => (
              <line
                key={angle}
                x1="14"
                y1="14"
                x2={14 + Math.cos((angle * Math.PI) / 180) * 9}
                y2={14 + Math.sin((angle * Math.PI) / 180) * 9}
                stroke="#d4d4d8"
                strokeWidth="0.8"
              />
            ))}
            {/* Film holes */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
              <circle
                key={angle}
                cx={14 + Math.cos((angle * Math.PI) / 180) * 11}
                cy={14 + Math.sin((angle * Math.PI) / 180) * 11}
                r="1.5"
                fill="#e4e4e7"
              />
            ))}
          </svg>
        </div>

        {/* Sparkles / stars trail */}
        {[0, 1, 2].map((i) => {
          const sparkX = clapX - 10 - i * 15;
          const sparkY = 30 + Math.sin((frame + i * 20) * 0.1) * 5;
          const opacity = Math.max(0, 1 - i * 0.35);
          if (sparkX < -20) return null;
          return (
            <div
              key={i}
              className="absolute text-zinc-300"
              style={{
                left: sparkX,
                top: sparkY,
                opacity,
                fontSize: "10px",
              }}
            >
              ✦
            </div>
          );
        })}
      </div>

      {message && (
        <p className="text-sm text-muted-foreground animate-pulse">{message}</p>
      )}
    </div>
  );
}
