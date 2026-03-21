"use client";

import Header from "@/components/Header";
import { Calendar } from "lucide-react";
import { useUser } from "@/lib/useUser";

export default function SchedulePage() {
  const { user } = useUser();
  return (
    <>
      <Header title="スケジュール一覧" userEmail={user?.email} />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">スケジュール一覧</h1>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-2">
            スケジュールはプロジェクト詳細画面の「スケジュール」タブで管理できます。
          </p>
          <p className="text-xs text-muted-foreground">
            各プロジェクトのマイルストーンを設定して、進行管理を行いましょう。
          </p>
        </div>
      </main>
    </>
  );
}
