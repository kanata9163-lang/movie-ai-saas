"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/useUser";
import { Loader2, Upload, X, Link as LinkIcon, Users, FileText } from "lucide-react";

interface NewVideoProps {
  params: { workspaceSlug: string };
}

interface RefImage {
  id?: string;
  preview: string;
  imageType: string;
  name: string;
}

interface ClientOption {
  id: string;
  name: string;
  website_url?: string;
}

export default function NewVideoPage({ params }: NewVideoProps) {
  const { workspaceSlug } = params;
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [title, setTitle] = useState(searchParams.get("title") || "");
  const [sourceUrl, setSourceUrl] = useState(searchParams.get("url") || "");
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [voiceType, setVoiceType] = useState("female");
  const [voiceStyle, setVoiceStyle] = useState("energetic");
  const [customInstructions, setCustomInstructions] = useState(searchParams.get("instructions") || "");
  const [refImages, setRefImages] = useState<RefImage[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; data: string; mimeType: string }>>([]);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Client selection
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");

  useEffect(() => {
    fetch(`/api/w/${workspaceSlug}/clients`)
      .then(r => r.json())
      .then(res => {
        if (res.ok) setClients(res.data || []);
      })
      .catch(() => {});
  }, [workspaceSlug]);

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    const client = clients.find(c => c.id === clientId);
    if (client?.website_url && !sourceUrl) {
      setSourceUrl(client.website_url);
    }
  };

  const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || refImages.length >= 4) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setRefImages(prev => [...prev, {
        preview: dataUrl,
        imageType: 'other',
        name: file.name,
      }]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAddDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const supportedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ];

    if (!supportedTypes.includes(file.type)) {
      alert('対応していないファイル形式です。PDF, Word, CSV, Excelに対応しています。');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachedFiles(prev => [...prev, {
        name: file.name,
        data: reader.result as string,
        mimeType: file.type,
      }]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCreate = async () => {
    if (!sourceUrl && !title) return alert("URLまたはタイトルを入力してください");
    setCreating(true);

    try {
      // 1. Create video project
      const res = await fetch(`/api/w/${workspaceSlug}/video-projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, source_url: sourceUrl, aspect_ratio: aspectRatio, voice_type: voiceType, voice_style: voiceStyle, custom_instructions: customInstructions }),
      });
      const { data: project } = await res.json();

      // 2. Upload reference images
      for (const img of refImages) {
        await fetch(`/api/w/${workspaceSlug}/video-projects/${project.id}/reference-images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_data: img.preview, image_type: img.imageType, name: img.name }),
        });
      }

      // 2.5. Upload document attachments
      for (const doc of attachedFiles) {
        await fetch(`/api/w/${workspaceSlug}/video-projects/${project.id}/attachments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_data: doc.data, file_name: doc.name, mime_type: doc.mimeType }),
        });
      }

      // 3. Navigate to project detail (where pipeline starts)
      router.push(`/w/${workspaceSlug}/video/${project.id}`);
    } catch (e) {
      alert(`作成に失敗しました: ${e instanceof Error ? e.message : ''}`);
      setCreating(false);
    }
  };

  return (
    <>
      <Header title="新規動画生成" userEmail={user?.email} />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-bold mb-6">新規動画プロジェクト</h1>

          <div className="space-y-5">
            {/* Client Selection */}
            {clients.length > 0 && (
              <div>
                <label className="text-sm font-medium block mb-1.5 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  クライアント（任意）
                </label>
                <select
                  value={selectedClientId}
                  onChange={e => handleClientChange(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background"
                >
                  <option value="">クライアントを選択...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.website_url ? ` (${c.website_url})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">クライアントを選択すると、URLが自動入力されます</p>
              </div>
            )}

            {/* URL */}
            <div>
              <label className="text-sm font-medium block mb-1.5">参照URL（任意）</label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={e => setSourceUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-lg bg-background"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">企業サイトや商品ページのURL（省略可）</p>
            </div>

            {/* Title */}
            <div>
              <label className="text-sm font-medium block mb-1.5">タイトル（任意）</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="動画のタイトル..."
                className="w-full px-4 py-2.5 text-sm border border-border rounded-lg bg-background"
              />
            </div>

            {/* Aspect Ratio, Voice Type, Voice Style */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">アスペクト比</label>
                <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background">
                  <option value="9:16">9:16（縦・TikTok/Shorts）</option>
                  <option value="16:9">16:9（横・YouTube）</option>
                  <option value="1:1">1:1（正方形・Instagram）</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">ナレーション音声</label>
                <select value={voiceType} onChange={e => setVoiceType(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background">
                  <option value="female">女性</option>
                  <option value="male">男性</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">話し方スタイル</label>
                <select value={voiceStyle} onChange={e => setVoiceStyle(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background">
                  <option value="elegant">ゆっくり上品に</option>
                  <option value="energetic">広告っぽく元気に</option>
                  <option value="speedy">スピーディーに元気に</option>
                  <option value="brand">大人っぽく洗練された感じ</option>
                </select>
              </div>
            </div>

            {/* Reference Images */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium">参照画像（最大4枚）</label>
                {refImages.length < 4 && (
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="text-xs h-7">
                    <Upload className="w-3 h-3" />画像を追加
                  </Button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAddImage} className="hidden" />

              {refImages.length > 0 ? (
                <div className="grid grid-cols-4 gap-3">
                  {refImages.map((img, i) => (
                    <div key={i} className="relative group">
                      <img src={img.preview} alt={img.name} className="w-full aspect-square object-cover rounded-lg border border-border" loading="lazy" />
                      <select
                        value={img.imageType}
                        onChange={e => setRefImages(prev => prev.map((ri, j) => j === i ? { ...ri, imageType: e.target.value } : ri))}
                        className="absolute bottom-1 left-1 right-1 text-[10px] bg-white/90 rounded px-1 py-0.5 border"
                      >
                        <option value="logo">ロゴ</option>
                        <option value="face">顔</option>
                        <option value="product">商品</option>
                        <option value="other">その他</option>
                      </select>
                      <button
                        onClick={() => setRefImages(prev => prev.filter((_, j) => j !== i))}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-zinc-400 transition-colors"
                >
                  <Upload className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">ロゴ・人物・商品などの画像をアップロード</p>
                  <p className="text-[10px] text-muted-foreground mt-1">PNG, JPG, WEBP（最大4枚）</p>
                </div>
              )}
            </div>

            {/* Custom Instructions */}
            <div>
              <label className="text-sm font-medium block mb-1.5">追加指示（任意）</label>
              <textarea
                value={customInstructions}
                onChange={e => setCustomInstructions(e.target.value)}
                placeholder="台本や動画に反映したい指示を自由に記述してください。例：「明るいトーンで」「商品のコスパを強調」「20代女性向けの雰囲気で」など"
                className="w-full px-4 py-2.5 text-sm border border-border rounded-lg bg-background resize-none"
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">台本作成やナレーションなどに反映されます</p>
            </div>

            {/* Document Attachments */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium">資料添付（任意）</label>
                <Button variant="outline" size="sm" onClick={() => docInputRef.current?.click()} className="text-xs h-7">
                  <Upload className="w-3 h-3" />資料を追加
                </Button>
              </div>
              <input
                ref={docInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.csv,.xls,.xlsx,.txt"
                onChange={handleAddDocument}
                className="hidden"
              />
              <p className="text-xs text-muted-foreground mb-2">PDF, Word, CSV, Excelファイルを添付すると内容が台本に反映されます</p>

              {attachedFiles.length > 0 ? (
                <div className="space-y-2">
                  {attachedFiles.map((file, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-zinc-50">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span className="text-sm">{file.name}</span>
                      </div>
                      <button
                        onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))}
                        className="text-zinc-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  onClick={() => docInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-zinc-400 transition-colors"
                >
                  <FileText className="w-6 h-6 text-zinc-300 mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">クリックして資料を追加</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">PDF, Word, CSV, Excel対応</p>
                </div>
              )}
            </div>

            {/* Submit */}
            <Button
              onClick={handleCreate}
              disabled={creating || (!sourceUrl && !title)}
              className="w-full h-12 bg-zinc-900 text-white hover:bg-zinc-800 text-sm font-semibold"
            >
              {creating ? (
                <><Loader2 className="w-4 h-4 animate-spin" />プロジェクト作成中...</>
              ) : (
                '動画プロジェクトを作成'
              )}
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
