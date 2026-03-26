"use client";

import { useState, useEffect, useRef } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2, Trash2, Download, Image, Film, File } from "lucide-react";
import { useUser } from "@/lib/useUser";
import LinkToProject from "@/components/LinkToProject";

interface AssetsPageProps {
  params: { workspaceSlug: string };
}

interface Asset {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  project_id: string | null;
  created_at: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mime }: { mime: string }) {
  if (mime.startsWith("image/")) return <Image className="w-5 h-5 text-blue-500" />;
  if (mime.startsWith("video/")) return <Film className="w-5 h-5 text-purple-500" />;
  return <File className="w-5 h-5 text-zinc-400" />;
}

export default function AssetsPage({ params }: AssetsPageProps) {
  const { workspaceSlug } = params;
  const { user } = useUser();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAssets = async () => {
    try {
      const res = await fetch(`/api/w/${workspaceSlug}/assets`);
      const json = await res.json();
      if (json.ok) setAssets(json.data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadAssets(); }, [workspaceSlug]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        await fetch(`/api/w/${workspaceSlug}/assets`, {
          method: "POST",
          body: formData,
        });
      } catch { /* ignore */ }
    }

    e.target.value = "";
    setUploading(false);
    loadAssets();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このファイルを削除しますか？")) return;
    try {
      await fetch(`/api/w/${workspaceSlug}/assets/${id}`, { method: "DELETE" });
      setAssets(prev => prev.filter(a => a.id !== id));
    } catch { alert("削除に失敗しました"); }
  };

  return (
    <>
      <Header title="ファイル" userEmail={user?.email} />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">ファイル</h1>
          <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            アップロード
          </Button>
          <input ref={fileInputRef} type="file" multiple onChange={handleUpload} className="hidden" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : assets.length === 0 ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl border-2 border-dashed border-border bg-card p-12 text-center cursor-pointer hover:border-zinc-400 transition-colors"
          >
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              クリックまたはドラッグ&ドロップでファイルをアップロード
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              画像、動画、PDF、ドキュメント等
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {assets.map((asset) => (
              <div key={asset.id} className="flex items-center gap-4 px-5 py-3 hover:bg-zinc-50 transition-colors">
                <FileIcon mime={asset.mime_type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{asset.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(asset.size_bytes)} - {new Date(asset.created_at).toLocaleDateString("ja-JP")}
                  </p>
                </div>
                <LinkToProject
                  workspaceSlug={workspaceSlug}
                  resourceType="asset"
                  resourceId={asset.id}
                  currentProjectId={asset.project_id}
                  compact
                />
                <a
                  href={`/api/w/${workspaceSlug}/assets/${asset.id}/download`}
                  className="p-1.5 rounded hover:bg-zinc-100 text-muted-foreground transition-colors"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() => handleDelete(asset.id)}
                  className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        {assets.length > 0 && (
          <p className="text-xs text-muted-foreground mt-3">{assets.length}件のファイル</p>
        )}
      </main>
    </>
  );
}
