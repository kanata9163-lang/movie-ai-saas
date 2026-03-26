"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ShareButton from "@/components/ShareButton";
import {
  Plus,
  Loader2,
  ChevronLeft,
  X,
  Trash2,
  Download,
} from "lucide-react";
import LoadingAnimation from "@/components/LoadingAnimation";
import Link from "next/link";
import { useUser } from "@/lib/useUser";

interface BudgetPageProps {
  params: { workspaceSlug: string; projectId: string };
}

interface BudgetCategory {
  id: string;
  project_id: string;
  name: string;
  budget_limit: number;
  total_spent: number;
  created_at: string;
}

interface BudgetItemData {
  id: string;
  project_id: string;
  category_id: string | null;
  category_name: string | null;
  description: string;
  amount: number;
  date: string;
  notes: string | null;
  created_at: string;
}

interface BudgetSummary {
  project: { id: string; name: string; budget_limit: number };
  categories: BudgetCategory[];
  items: BudgetItemData[];
  total_spent: number;
}

export default function BudgetPage({ params }: BudgetPageProps) {
  const { workspaceSlug, projectId } = params;
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BudgetSummary | null>(null);

  // Category modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryLimit, setNewCategoryLimit] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);

  // Item modal
  const [showItemModal, setShowItemModal] = useState(false);
  const [newItemCategoryId, setNewItemCategoryId] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemAmount, setNewItemAmount] = useState("");
  const [newItemDate, setNewItemDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [newItemNotes, setNewItemNotes] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  // Budget limit
  const [showBudgetLimitModal, setShowBudgetLimitModal] = useState(false);
  const [budgetLimitInput, setBudgetLimitInput] = useState("");
  const [savingLimit, setSavingLimit] = useState(false);

  const apiBase = `/api/w/${workspaceSlug}/projects/${projectId}/budget`;

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(apiBase);
      const json = await res.json();
      if (json.ok) setData(json.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    setAddingCategory(true);
    try {
      const res = await fetch(`${apiBase}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          budget_limit: parseInt(newCategoryLimit) || 0,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setNewCategoryName("");
        setNewCategoryLimit("");
        setShowCategoryModal(false);
        loadData();
      }
    } catch {
      alert("カテゴリの追加に失敗しました");
    } finally {
      setAddingCategory(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm("このカテゴリを削除しますか？")) return;
    try {
      await fetch(`${apiBase}/categories?id=${categoryId}`, {
        method: "DELETE",
      });
      loadData();
    } catch {
      // ignore
    }
  };

  const handleAddItem = async () => {
    if (!newItemDescription.trim() || !newItemAmount) return;
    setAddingItem(true);
    try {
      const res = await fetch(`${apiBase}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_id: newItemCategoryId || null,
          description: newItemDescription.trim(),
          amount: parseInt(newItemAmount),
          date: newItemDate,
          notes: newItemNotes.trim() || null,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setNewItemCategoryId("");
        setNewItemDescription("");
        setNewItemAmount("");
        setNewItemDate(new Date().toISOString().split("T")[0]);
        setNewItemNotes("");
        setShowItemModal(false);
        loadData();
      }
    } catch {
      alert("明細の追加に失敗しました");
    } finally {
      setAddingItem(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("この明細を削除しますか？")) return;
    try {
      await fetch(`${apiBase}/items?id=${itemId}`, { method: "DELETE" });
      loadData();
    } catch {
      // ignore
    }
  };

  const handleSaveBudgetLimit = async () => {
    setSavingLimit(true);
    try {
      const res = await fetch(apiBase, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budget_limit: parseInt(budgetLimitInput) || 0 }),
      });
      const json = await res.json();
      if (json.ok) {
        setShowBudgetLimitModal(false);
        loadData();
      }
    } catch {
      alert("予算上限の設定に失敗しました");
    } finally {
      setSavingLimit(false);
    }
  };

  const handleExportCSV = () => {
    if (!data) return;
    const headers = ["カテゴリ", "説明", "金額", "日付", "メモ"];
    const rows = data.items.map((item) => [
      item.category_name || "未分類",
      item.description,
      item.amount.toString(),
      item.date,
      item.notes || "",
    ]);

    const bom = "\uFEFF";
    const csv =
      bom +
      [headers, ...rows].map((row) => row.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `budget_${data.project.name || projectId}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (amount: number) =>
    `¥${amount.toLocaleString()}`;

  // Chart calculations
  const budgetLimit = data?.project.budget_limit || 0;
  const totalSpent = data?.total_spent || 0;
  const spentPercent =
    budgetLimit > 0 ? Math.min((totalSpent / budgetLimit) * 100, 100) : 0;
  const circumference = 2 * Math.PI * 50; // r=50

  if (loading) {
    return (
      <>
        <Header title="予算管理" userEmail={user?.email} />
        <main className="flex-1 flex items-center justify-center">
          <LoadingAnimation message="予算データを読み込み中..." />
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="予算管理" userEmail={user?.email} />
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Breadcrumb */}
        <div>
          <Link
            href={`/w/${workspaceSlug}/projects/${projectId}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
            プロジェクト詳細
          </Link>
          <span className="text-sm text-muted-foreground mx-2">&gt;</span>
          <span className="text-sm font-medium">予算管理</span>
        </div>

        <h1 className="text-xl font-bold">
          {data?.project.name || "プロジェクト"} - 予算管理
        </h1>

        {/* Graph Section */}
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">グラフ</h2>
            <button
              onClick={() => setShowCategoryModal(true)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              カテゴリを追加
            </button>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Donut Chart */}
            <div className="flex flex-col items-center">
              <div className="relative w-48 h-48">
                <svg
                  viewBox="0 0 120 120"
                  className="w-full h-full -rotate-90"
                >
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke="#f4f4f5"
                    strokeWidth="12"
                  />
                  {budgetLimit > 0 && (
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="none"
                      stroke={
                        spentPercent >= 90
                          ? "#ef4444"
                          : spentPercent >= 70
                          ? "#f59e0b"
                          : "#18181b"
                      }
                      strokeWidth="12"
                      strokeDasharray={`${
                        (spentPercent / 100) * circumference
                      } ${circumference}`}
                      strokeLinecap="round"
                    />
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-muted-foreground">
                    Total
                  </span>
                  <span className="text-sm font-semibold">
                    {formatCurrency(totalSpent)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    / {formatCurrency(budgetLimit)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setBudgetLimitInput(String(budgetLimit || ""));
                  setShowBudgetLimitModal(true);
                }}
                className="mt-3 text-xs text-blue-600 hover:underline"
              >
                予算上限を設定
              </button>
            </div>

            {/* Category Bar Charts */}
            <div className="flex-1 min-w-0">
              {data?.categories && data.categories.length > 0 ? (
                <div className="space-y-4">
                  {data.categories.map((cat) => {
                    const catPercent =
                      cat.budget_limit > 0
                        ? Math.min(
                            (cat.total_spent / cat.budget_limit) * 100,
                            100
                          )
                        : 0;
                    return (
                      <div key={cat.id} className="group">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">
                            {cat.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {formatCurrency(cat.total_spent)} /{" "}
                              {formatCurrency(cat.budget_limit)}
                            </span>
                            <button
                              onClick={() => handleDeleteCategory(cat.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-red-500"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              catPercent >= 90
                                ? "bg-red-500"
                                : catPercent >= 70
                                ? "bg-amber-500"
                                : "bg-zinc-900"
                            }`}
                            style={{ width: `${catPercent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground py-8">
                  予算明細を追加するとカテゴリ別グラフが表示されます
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Budget Table Section */}
        <section className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h2 className="text-sm font-semibold">予算表</h2>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={() => setShowItemModal(true)}
              >
                <Plus className="w-3.5 h-3.5" />
                明細を追加
              </Button>
              <ShareButton
                title={`${data?.project.name || ""} - 予算管理`}
                size="sm"
              />
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={handleExportCSV}
                disabled={!data?.items.length}
              >
                <Download className="w-3.5 h-3.5" />
                CSVで出力する
              </Button>
            </div>
          </div>

          {data?.items && data.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-zinc-50/50">
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">
                      カテゴリ
                    </th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">
                      説明
                    </th>
                    <th className="text-right px-5 py-3 font-medium text-muted-foreground">
                      金額
                    </th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">
                      日付
                    </th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">
                      メモ
                    </th>
                    <th className="text-center px-5 py-3 font-medium text-muted-foreground w-16">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.items.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-50/50 group">
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium">
                          {item.category_name || "未分類"}
                        </span>
                      </td>
                      <td className="px-5 py-3">{item.description}</td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums">
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {item.date}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground max-w-[200px] truncate">
                        {item.notes || "-"}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-zinc-50/50">
                    <td className="px-5 py-3 font-semibold" colSpan={2}>
                      合計
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">
                      {formatCurrency(totalSpent)}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <p className="text-sm text-muted-foreground mb-4">
                予算明細がありません
              </p>
              <button
                onClick={() => setShowItemModal(true)}
                className="text-sm text-foreground hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                最初の明細を追加
              </button>
            </div>
          )}
        </section>
      </main>

      {/* Category Add Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setShowCategoryModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 z-50">
            <button
              onClick={() => setShowCategoryModal(false)}
              className="absolute top-4 right-4 p-1 rounded hover:bg-zinc-100 text-zinc-400"
            >
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-semibold mb-1">カテゴリを追加</h2>
            <p className="text-sm text-muted-foreground mb-5">
              予算カテゴリを作成します
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  カテゴリ名
                </label>
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="例: 撮影費、編集費、交通費"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  予算上限（円）
                </label>
                <Input
                  type="number"
                  value={newCategoryLimit}
                  onChange={(e) => setNewCategoryLimit(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowCategoryModal(false)}
              >
                キャンセル
              </Button>
              <Button
                onClick={handleAddCategory}
                disabled={addingCategory || !newCategoryName.trim()}
              >
                {addingCategory && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                追加
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Item Add Modal */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setShowItemModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 z-50">
            <button
              onClick={() => setShowItemModal(false)}
              className="absolute top-4 right-4 p-1 rounded hover:bg-zinc-100 text-zinc-400"
            >
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-semibold mb-1">明細を追加</h2>
            <p className="text-sm text-muted-foreground mb-5">
              予算明細を追加します
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  カテゴリ
                </label>
                <select
                  value={newItemCategoryId}
                  onChange={(e) => setNewItemCategoryId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
                >
                  <option value="">未分類</option>
                  {data?.categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  説明
                </label>
                <Input
                  value={newItemDescription}
                  onChange={(e) => setNewItemDescription(e.target.value)}
                  placeholder="説明を入力"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  金額（¥）
                </label>
                <Input
                  type="number"
                  value={newItemAmount}
                  onChange={(e) => setNewItemAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  日付
                </label>
                <Input
                  type="date"
                  value={newItemDate}
                  onChange={(e) => setNewItemDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  メモ（任意）
                </label>
                <Input
                  value={newItemNotes}
                  onChange={(e) => setNewItemNotes(e.target.value)}
                  placeholder="メモを入力"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowItemModal(false)}
              >
                キャンセル
              </Button>
              <Button
                onClick={handleAddItem}
                disabled={
                  addingItem ||
                  !newItemDescription.trim() ||
                  !newItemAmount
                }
              >
                {addingItem && <Loader2 className="w-4 h-4 animate-spin" />}
                保存
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Budget Limit Modal */}
      {showBudgetLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setShowBudgetLimitModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 z-50">
            <button
              onClick={() => setShowBudgetLimitModal(false)}
              className="absolute top-4 right-4 p-1 rounded hover:bg-zinc-100 text-zinc-400"
            >
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-semibold mb-1">予算上限を設定</h2>
            <p className="text-sm text-muted-foreground mb-5">
              プロジェクト全体の予算上限を設定します
            </p>

            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">
                予算上限（円）
              </label>
              <Input
                type="number"
                value={budgetLimitInput}
                onChange={(e) => setBudgetLimitInput(e.target.value)}
                placeholder="例: 1500000"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowBudgetLimitModal(false)}
              >
                キャンセル
              </Button>
              <Button onClick={handleSaveBudgetLimit} disabled={savingLimit}>
                {savingLimit && <Loader2 className="w-4 h-4 animate-spin" />}
                設定
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
