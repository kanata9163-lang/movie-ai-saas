"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/useUser";
import {
  Plus,
  Search,
  BookOpen,
  Link as LinkIcon,
  FileText,
  Palette,
  ClipboardList,
  Film,
  X,
  Pencil,
  Trash2,
  Loader2,
  Tag,
} from "lucide-react";
import LinkToProject from "@/components/LinkToProject";
import ShareButton from "@/components/ShareButton";

interface KnowledgePageProps {
  params: { workspaceSlug: string };
}

interface KnowledgeItem {
  id: string;
  title: string;
  content_type: string;
  content_text: string | null;
  source_url: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const CONTENT_TYPES = [
  { value: "text", label: "テキスト入力", icon: FileText },
  { value: "url", label: "URL取り込み", icon: LinkIcon },
  { value: "brand_guide", label: "ブランドガイドライン", icon: Palette },
  { value: "past_work", label: "過去の制作実績", icon: Film },
  { value: "guideline", label: "制作ガイドライン", icon: ClipboardList },
];

const typeLabel = (type: string) =>
  CONTENT_TYPES.find((t) => t.value === type)?.label || type;

const typeColor = (type: string) => {
  switch (type) {
    case "text": return "bg-zinc-100 text-zinc-700";
    case "url": return "bg-blue-100 text-blue-700";
    case "brand_guide": return "bg-purple-100 text-purple-700";
    case "past_work": return "bg-amber-100 text-amber-700";
    case "guideline": return "bg-green-100 text-green-700";
    default: return "bg-zinc-100 text-zinc-700";
  }
};

const TypeIcon = ({ type }: { type: string }) => {
  const ct = CONTENT_TYPES.find((t) => t.value === type);
  const Icon = ct?.icon || FileText;
  return <Icon className="w-4 h-4" />;
};

export default function KnowledgePage({ params }: KnowledgePageProps) {
  const { workspaceSlug } = params;
  const { user } = useUser();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<KnowledgeItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState("text");
  const [formContent, setFormContent] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formTags, setFormTags] = useState("");

  const fetchItems = () => {
    const params = new URLSearchParams();
    if (filterType) params.set("content_type", filterType);
    if (search) params.set("search", search);
    fetch(`/api/w/${workspaceSlug}/knowledge?${params}`)
      .then((r) => r.json())
      .then((res) => { setItems(res.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchItems(); }, [workspaceSlug, filterType]);

  const handleSearch = () => { setLoading(true); fetchItems(); };

  const openCreate = () => {
    setEditItem(null);
    setFormTitle("");
    setFormType("text");
    setFormContent("");
    setFormUrl("");
    setFormTags("");
    setShowModal(true);
  };

  const openEdit = (item: KnowledgeItem) => {
    setEditItem(item);
    setFormTitle(item.title);
    setFormType(item.content_type);
    setFormContent(item.content_text || "");
    setFormUrl(item.source_url || "");
    setFormTags(item.tags?.join(", ") || "");
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const tags = formTags.split(",").map((t) => t.trim()).filter(Boolean);
    const payload = {
      title: formTitle,
      content_type: formType,
      content_text: formContent,
      source_url: formUrl || undefined,
      tags,
    };

    try {
      if (editItem) {
        await fetch(`/api/w/${workspaceSlug}/knowledge/${editItem.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: formTitle, content_text: formContent, tags }),
        });
      } else {
        await fetch(`/api/w/${workspaceSlug}/knowledge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setShowModal(false);
      setLoading(true);
      fetchItems();
    } catch {
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このナレッジを削除しますか？")) return;
    await fetch(`/api/w/${workspaceSlug}/knowledge/${id}`, { method: "DELETE" });
    setLoading(true);
    fetchItems();
  };

  const filtered = items.filter((item) => {
    if (search && !item.title.toLowerCase().includes(search.toLowerCase()) &&
        !item.content_text?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <Header title="ナレッジベース" userEmail={user?.email} />
      <main className="flex-1 overflow-y-auto p-6">
        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="タイトルや内容で検索..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-background w-72"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 text-sm border border-border rounded-lg bg-background"
            >
              <option value="">全てのタイプ</option>
              {CONTENT_TYPES.map((ct) => (
                <option key={ct.value} value={ct.value}>{ct.label}</option>
              ))}
            </select>
            <span className="text-sm text-muted-foreground">{filtered.length}件</span>
          </div>
          <Button onClick={openCreate} className="bg-zinc-900 text-white hover:bg-zinc-800">
            <Plus className="w-4 h-4" />ナレッジを追加
          </Button>
        </div>

        {/* Items Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">読み込み中...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <BookOpen className="w-12 h-12 mb-3 text-zinc-300" />
            <p className="text-sm">ナレッジはまだ登録されていません</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
              <Plus className="w-3.5 h-3.5" />追加する
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-border bg-card hover:shadow-md transition-shadow p-4 group"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <TypeIcon type={item.content_type} />
                    <h3 className="font-semibold text-sm truncate">{item.title}</h3>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ShareButton title={item.title} text="ナレッジを共有" size="sm" variant="ghost" className="h-7 w-7" />
                    <button
                      onClick={() => openEdit(item)}
                      className="p-1 rounded hover:bg-zinc-100 text-muted-foreground"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium mb-2 ${typeColor(item.content_type)}`}>
                  {typeLabel(item.content_type)}
                </span>
                {item.content_text && (
                  <p className="text-xs text-muted-foreground line-clamp-3 mb-2">
                    {item.content_text.slice(0, 200)}
                  </p>
                )}
                {item.source_url && (
                  <p className="text-xs text-blue-600 truncate mb-2">{item.source_url}</p>
                )}
                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {item.tags.map((tag) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 flex items-center gap-0.5">
                        <Tag className="w-2.5 h-2.5" />{tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between mt-1">
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString("ja-JP")}
                  </div>
                  <LinkToProject
                    workspaceSlug={workspaceSlug}
                    resourceType="knowledge_item"
                    resourceId={item.id}
                    compact
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h2 className="text-sm font-semibold">
                  {editItem ? "ナレッジを編集" : "ナレッジを追加"}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-zinc-100">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-medium text-zinc-700 mb-1 block">タイトル</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="ナレッジのタイトル"
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg"
                  />
                </div>
                {!editItem && (
                  <div>
                    <label className="text-xs font-medium text-zinc-700 mb-1 block">タイプ</label>
                    <div className="grid grid-cols-2 gap-2">
                      {CONTENT_TYPES.map((ct) => {
                        const Icon = ct.icon;
                        return (
                          <button
                            key={ct.value}
                            onClick={() => setFormType(ct.value)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                              formType === ct.value
                                ? "border-zinc-900 bg-zinc-50 text-zinc-900"
                                : "border-border text-muted-foreground hover:bg-zinc-50"
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            {ct.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {formType === "url" && !editItem && (
                  <div>
                    <label className="text-xs font-medium text-zinc-700 mb-1 block">URL</label>
                    <input
                      type="url"
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      URLの内容をAIが自動で解析・要約します
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-zinc-700 mb-1 block">
                    {formType === "url" && !editItem ? "補足メモ（任意）" : "内容"}
                  </label>
                  <textarea
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder={
                      formType === "brand_guide"
                        ? "ブランドカラー、トーン、メッセージング等..."
                        : formType === "past_work"
                        ? "過去の制作実績、成果、反省点等..."
                        : formType === "guideline"
                        ? "動画制作のルール、禁止事項、必須要素等..."
                        : "テキストを入力..."
                    }
                    rows={6}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-700 mb-1 block">タグ（カンマ区切り）</label>
                  <input
                    type="text"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    placeholder="ブランド, ガイドライン, 2024"
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
                <Button variant="outline" onClick={() => setShowModal(false)}>
                  キャンセル
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !formTitle}
                  className="bg-zinc-900 text-white hover:bg-zinc-800"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                  {editItem ? "更新" : "追加"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
