"use client";

import { useState, useEffect, useMemo } from "react";
import Header from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, type Milestone } from "@/lib/api-client";
import {
  Calendar,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  List,
  BarChart3,
} from "lucide-react";
import LoadingAnimation from "@/components/LoadingAnimation";
import { useUser } from "@/lib/useUser";

interface SchedulePageProps {
  params: { workspaceSlug: string };
}

interface ScheduleItem extends Milestone {
  project_name: string;
}

export default function SchedulePage({ params }: SchedulePageProps) {
  const { workspaceSlug } = params;
  const { user } = useUser();
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "timeline">("timeline");

  // Timeline navigation
  const [timelineStart, setTimelineStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  });

  const timelineDays = 28; // 4 weeks view

  useEffect(() => {
    loadSchedules();
  }, [workspaceSlug]);

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const data = await api.listAllSchedules(workspaceSlug);
      setSchedules(data);
    } catch {
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(
    () =>
      schedules.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.project_name.toLowerCase().includes(search.toLowerCase())
      ),
    [schedules, search]
  );

  const statusColor = (status: string) => {
    switch (status) {
      case "進行中":
      case "対応中":
        return "blue" as const;
      case "完了":
        return "green" as const;
      case "保留":
        return "yellow" as const;
      case "予定":
      case "planned":
        return "default" as const;
      default:
        return "default" as const;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "planned":
        return "予定";
      default:
        return status;
    }
  };

  // Timeline helpers
  const timelineDates = useMemo(() => {
    const dates: Date[] = [];
    for (let i = 0; i < timelineDays; i++) {
      const d = new Date(timelineStart);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, [timelineStart, timelineDays]);

  const timelineEnd = useMemo(() => {
    const d = new Date(timelineStart);
    d.setDate(d.getDate() + timelineDays);
    return d;
  }, [timelineStart, timelineDays]);

  const formatShortDate = (date: Date) => {
    const y = date.getFullYear().toString().slice(2);
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}.${m}.${d}`;
  };

  const formatDateRange = (start: string | null, end: string | null) => {
    if (start && end) {
      return `${formatShortDate(new Date(start))} ~ ${formatShortDate(new Date(end))}`;
    }
    if (start) return `${formatShortDate(new Date(start))} ~`;
    if (end) return `~ ${formatShortDate(new Date(end))}`;
    return "-";
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;

  const getBarPosition = (item: ScheduleItem) => {
    const start = item.start_date ? new Date(item.start_date) : null;
    const end = item.end_date || item.due_date ? new Date((item.end_date || item.due_date)!) : null;

    if (!start && !end) return null;

    const effectiveStart = start || end!;
    const effectiveEnd = end || start!;

    const timelineStartTime = timelineStart.getTime();
    const dayMs = 86400000;
    const totalWidth = timelineDays;

    const startOffset = Math.max(
      0,
      (effectiveStart.getTime() - timelineStartTime) / dayMs
    );
    const endOffset = Math.min(
      totalWidth,
      (effectiveEnd.getTime() - timelineStartTime) / dayMs + 1
    );

    if (endOffset <= 0 || startOffset >= totalWidth) return null;

    const left = (Math.max(0, startOffset) / totalWidth) * 100;
    const width = ((endOffset - Math.max(0, startOffset)) / totalWidth) * 100;

    return { left: `${left}%`, width: `${Math.max(width, 2)}%` };
  };

  const getBarColor = (status: string) => {
    switch (status) {
      case "進行中":
      case "対応中":
        return "bg-blue-500";
      case "完了":
        return "bg-green-500";
      case "保留":
        return "bg-yellow-500";
      default:
        return "bg-zinc-400";
    }
  };

  const navigateTimeline = (direction: "prev" | "next") => {
    setTimelineStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + (direction === "next" ? 7 : -7));
      return d;
    });
  };

  const goToToday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    setTimelineStart(d);
  };

  // Group dates by month for header
  const monthGroups = useMemo(() => {
    const groups: { month: string; count: number }[] = [];
    let currentMonth = "";
    for (const date of timelineDates) {
      const month = `${date.getFullYear()}年${date.getMonth() + 1}月`;
      if (month !== currentMonth) {
        groups.push({ month, count: 1 });
        currentMonth = month;
      } else {
        groups[groups.length - 1].count++;
      }
    }
    return groups;
  }, [timelineDates]);

  if (loading) {
    return (
      <>
        <Header title="スケジュール一覧" userEmail={user?.email} />
        <main className="flex-1 flex items-center justify-center">
          <LoadingAnimation message="スケジュールを読み込み中..." />
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="スケジュール一覧" userEmail={user?.email} />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">スケジュール一覧</h1>
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === "list"
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("timeline")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === "timeline"
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="スケジュール名・プロジェクト名で検索"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm">
            <Filter className="w-3.5 h-3.5" />
            フィルター
          </Button>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground mb-1">
              スケジュールがありません
            </p>
            <p className="text-xs text-muted-foreground">
              プロジェクト詳細画面でスケジュールを追加すると、ここに表示されます。
            </p>
          </div>
        ) : viewMode === "list" ? (
          /* List View */
          <div className="rounded-xl border border-border overflow-hidden bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    スケジュール名
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    プロジェクト
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    ステータス
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    期間
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium">{item.name}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {item.project_name}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={statusColor(item.status)}>
                        {statusLabel(item.status)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {formatDateRange(item.start_date, item.end_date || item.due_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Timeline / Gantt View */
          <div className="rounded-xl border border-border overflow-hidden bg-card">
            {/* Timeline controls */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigateTimeline("prev")}
                  className="p-1 rounded hover:bg-zinc-200 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={goToToday}
                  className="px-2 py-0.5 text-xs font-medium rounded border border-border hover:bg-zinc-100 transition-colors"
                >
                  今日
                </button>
                <button
                  onClick={() => navigateTimeline("next")}
                  className="p-1 rounded hover:bg-zinc-200 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatShortDate(timelineStart)} ~ {formatShortDate(timelineEnd)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                {/* Month header */}
                <div className="flex border-b border-border">
                  <div className="w-56 flex-shrink-0 px-4 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/20 border-r border-border" />
                  <div className="flex-1 flex">
                    {monthGroups.map((group, idx) => (
                      <div
                        key={idx}
                        className="text-center text-xs font-semibold text-muted-foreground py-1.5 border-r border-border last:border-r-0"
                        style={{ width: `${(group.count / timelineDays) * 100}%` }}
                      >
                        {group.month}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Day header */}
                <div className="flex border-b border-border">
                  <div className="w-56 flex-shrink-0 px-4 py-1.5 text-xs text-muted-foreground bg-muted/20 border-r border-border">
                    スケジュール名
                  </div>
                  <div className="flex-1 flex">
                    {timelineDates.map((date, idx) => (
                      <div
                        key={idx}
                        className={`flex-1 text-center text-[10px] py-1.5 border-r border-border/50 last:border-r-0 ${
                          isToday(date)
                            ? "bg-blue-50 text-blue-600 font-bold"
                            : isWeekend(date)
                            ? "bg-zinc-50 text-zinc-400"
                            : "text-muted-foreground"
                        }`}
                      >
                        {date.getDate()}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Schedule rows */}
                {filtered.map((item) => {
                  const bar = getBarPosition(item);
                  return (
                    <div key={item.id} className="flex border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors">
                      <div className="w-56 flex-shrink-0 px-4 py-3 border-r border-border">
                        <div className="text-sm font-medium truncate">{item.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-muted-foreground truncate">
                            {item.project_name}
                          </span>
                          <Badge variant={statusColor(item.status)} className="text-[10px] px-1 py-0">
                            {statusLabel(item.status)}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex-1 relative">
                        {/* Day grid lines */}
                        <div className="absolute inset-0 flex">
                          {timelineDates.map((date, idx) => (
                            <div
                              key={idx}
                              className={`flex-1 border-r border-border/30 last:border-r-0 ${
                                isToday(date)
                                  ? "bg-blue-50/50"
                                  : isWeekend(date)
                                  ? "bg-zinc-50/50"
                                  : ""
                              }`}
                            />
                          ))}
                        </div>

                        {/* Bar */}
                        {bar && (
                          <div className="absolute top-1/2 -translate-y-1/2 h-6 px-0.5" style={{ left: bar.left, width: bar.width }}>
                            <div
                              className={`h-full rounded ${getBarColor(item.status)} opacity-80`}
                              title={`${item.name}: ${formatDateRange(item.start_date, item.end_date || item.due_date)}`}
                            />
                          </div>
                        )}

                        {/* Today line */}
                        {timelineDates.some((d) => isToday(d)) && (
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-10"
                            style={{
                              left: `${
                                ((new Date().getTime() - timelineStart.getTime()) /
                                  (timelineDays * 86400000)) *
                                100
                              }%`,
                            }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}

                {filtered.length === 0 && (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    スケジュールがありません
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-3">
          {filtered.length}件のスケジュール
        </p>
      </main>
    </>
  );
}
