import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "blue" | "green" | "yellow" | "red" | "gray";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        {
          "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200": variant === "default",
          "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300": variant === "blue",
          "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300": variant === "green",
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300": variant === "yellow",
          "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300": variant === "red",
          "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400": variant === "gray",
        },
        className
      )}
    >
      {children}
    </span>
  );
}
