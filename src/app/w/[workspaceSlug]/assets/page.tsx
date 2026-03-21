"use client";

import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Upload, FileText } from "lucide-react";
import { useUser } from "@/lib/useUser";

export default function AssetsPage() {
  const { user } = useUser();
  return (
    <>
      <Header title="ファイル" userEmail={user?.email} />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">ファイル</h1>
          <Button size="sm">
            <Upload className="w-4 h-4" />
            アップロード
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            ファイルはプロジェクトに紐づけて管理されます。
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            プロジェクト詳細からファイルをアップロードできます。
          </p>
        </div>
      </main>
    </>
  );
}
