"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import LoadingAnimation from "@/components/LoadingAnimation";
import ImageLightbox from "@/components/ImageLightbox";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Wand2,
  ImageIcon,
  RefreshCw,
  Check,
  Download,
  Plus,
  Trash2,
  X,
  Upload,
  Clock,
  Maximize2,
  FileSpreadsheet,
} from "lucide-react";
import { useUser } from "@/lib/useUser";

interface StoryboardWizardProps {
  params: { workspaceSlug: string; projectId: string };
}

const STEPS = [
  { label: "基本情報を入力" },
  { label: "コマごとの詳細設定" },
  { label: "各シーンの編集と画像生成" },
  { label: "PDFプレビュー" },
];

interface GeneratedScene {
  id: string;
  scene_order: number;
  dialogue: string | null;
  description: string | null;
  image_prompt: string | null;
  image_url: string | null;
  character_desc?: string;
  location?: string;
  composition?: string;
}

interface ElementImage {
  id: string;
  name: string;
  dataUrl: string;
  saved: boolean;
}

export default function StoryboardWizard({ params }: StoryboardWizardProps) {
  const { workspaceSlug, projectId } = params;
  const { user } = useUser();
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState(0);

  // Step 1
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [duration, setDuration] = useState(30);
  const [panelCount, setPanelCount] = useState(8);
  const [imageStyle, setImageStyle] = useState("リアル");
  const [aspectRatio, setAspectRatio] = useState("16:9（横）");

  // Elements
  const [elements, setElements] = useState<ElementImage[]>([]);
  const [uploadingElement, setUploadingElement] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generation
  const [generationProgress, setGenerationProgress] = useState(0);
  const [storyboardId, setStoryboardId] = useState<string | null>(null);

  // Scenes
  const [scenes, setScenes] = useState<GeneratedScene[]>([]);
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);
  const [savingSceneId, setSavingSceneId] = useState<string | null>(null);

  // Lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Version history
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);

  // Publishing & export state
  const [publishing, setPublishing] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingSheet, setExportingSheet] = useState(false);

  // PDF preview ref
  const pdfPreviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadElements();
  }, [workspaceSlug, projectId]);

  const loadElements = async () => {
    try {
      const data = await api.listElements(workspaceSlug, projectId);
      setElements(
        data.map((el) => ({
          id: el.id,
          name: el.name,
          dataUrl: el.image_data,
          saved: true,
        }))
      );
    } catch {
      setElements([]);
    }
  };

  const handleAddElement = () => {
    if (elements.length >= 4) return;
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (elements.length >= 4) break;
      setUploadingElement(true);
      try {
        const dataUrl = await readFileAsDataURL(file);
        const result = await api.createElement(workspaceSlug, projectId, {
          name: file.name,
          mime_type: file.type || "image/png",
          image_data: dataUrl,
        });
        setElements((prev) => [
          ...prev,
          { id: result.id, name: file.name, dataUrl, saved: true },
        ]);
      } catch (err) {
        alert(`アップロード失敗: ${err instanceof Error ? err.message : ""}`);
      } finally {
        setUploadingElement(false);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const readFileAsDataURL = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleRemoveElement = async (id: string) => {
    try {
      await api.deleteElement(workspaceSlug, id);
      setElements((prev) => prev.filter((el) => el.id !== id));
    } catch {
      alert("削除に失敗しました");
    }
  };

  const handleNext = async () => {
    if (currentStep === 0) {
      setCurrentStep(1);
      await handleGenerate();
    } else if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  };

  const handleGenerate = async () => {
    setGenerationProgress(0);
    const progressInterval = setInterval(() => {
      setGenerationProgress((prev) => {
        if (prev >= 90) { clearInterval(progressInterval); return 90; }
        return prev + Math.random() * 15;
      });
    }, 500);

    try {
      const styleMap: Record<string, string> = {
        "漫画": "manga style, black and white ink drawing",
        "アニメ": "anime illustration style, vibrant colors",
        "リアル": "photorealistic, detailed, natural lighting",
        "シネマティック": "cinematic composition, dramatic lighting",
      };
      const result = await api.generateStoryboard(workspaceSlug, projectId, {
        title: title || "無題",
        brief: brief || undefined,
        style_preference: styleMap[imageStyle] || imageStyle,
        config: {
          duration_sec: duration,
          panel_count: panelCount,
          with_images: false,
          image_style: imageStyle,
          image_aspect: aspectRatio,
          text_density: "normal",
          dialogue_density: "normal",
        },
      });
      setStoryboardId(result.storyboardId);
      clearInterval(progressInterval);
      setGenerationProgress(95);
      const draft = await api.getDraft(workspaceSlug, result.storyboardId);
      setScenes(draft.scenes.map((s) => ({ ...s, character_desc: "", location: "", composition: "" })));
      setGenerationProgress(100);
    } catch (e) {
      clearInterval(progressInterval);
      alert(`生成に失敗しました: ${e instanceof Error ? e.message : ""}`);
      setCurrentStep(0);
    }
  };

  const handleGenerateImage = async (sceneId: string) => {
    setGeneratingImageId(sceneId);
    try {
      const result = await api.generateSceneImage(workspaceSlug, sceneId);
      setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, image_url: result.image_url } : s)));
    } catch (e) {
      alert(`画像生成に失敗しました: ${e instanceof Error ? e.message : ""}`);
    } finally {
      setGeneratingImageId(null);
    }
  };

  const handleSaveScene = async (scene: GeneratedScene) => {
    setSavingSceneId(scene.id);
    try {
      await api.updateDraftScene(workspaceSlug, scene.id, {
        dialogue: scene.dialogue, description: scene.description, image_prompt: scene.image_prompt,
      });
    } catch { alert("保存に失敗しました"); }
    finally { setSavingSceneId(null); }
  };

  const handleSaveAll = async () => { for (const s of scenes) await handleSaveScene(s); };

  const handleDeleteScene = (id: string) => setScenes((prev) => prev.filter((s) => s.id !== id));

  const handleAddScene = () => {
    const newOrder = scenes.length > 0 ? Math.max(...scenes.map((s) => s.scene_order)) + 1 : 1;
    setScenes((prev) => [...prev, {
      id: `new-${Math.random().toString(36).slice(2)}`, scene_order: newOrder,
      dialogue: "", description: "", image_prompt: "", image_url: null,
      character_desc: "", location: "", composition: "",
    }]);
  };

  const updateScene = (id: string, field: string, value: string) =>
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));

  const handlePublish = async () => {
    if (!storyboardId) return;
    setPublishing(true);
    try {
      const result = await api.publishStoryboard(workspaceSlug, storyboardId);
      alert(`公開しました！（バージョン ${result.version_number}）`);
      router.push(`/w/${workspaceSlug}/projects/${projectId}`);
    } catch {
      alert("公開に失敗しました");
    } finally {
      setPublishing(false);
    }
  };

  // PDF Export
  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const html2canvas = (await import("html2canvas")).default;

      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      // Create off-screen container
      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-9999px";
      container.style.top = "0";
      document.body.appendChild(container);

      // Helper to render a page div to canvas and add to PDF
      const renderPage = async (pageDiv: HTMLDivElement, addNewPage: boolean) => {
        container.innerHTML = ""; // eslint-disable-line no-param-reassign
        container.appendChild(pageDiv);
        const canvas = await html2canvas(pageDiv, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
        });
        if (addNewPage) pdf.addPage();
        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        pdf.addImage(imgData, "JPEG", 0, 0, pageW, pageH);
      };

      // Title page
      const titlePage = document.createElement("div");
      titlePage.style.cssText = `width:1122px;height:793px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;background:#fff;`;

      const titleText = document.createElement("div");
      titleText.style.cssText = `font-size:36px;font-weight:700;color:#18181b;margin-bottom:12px;`;
      titleText.textContent = title || "無題";
      titlePage.appendChild(titleText);

      const subtitleText = document.createElement("div");
      subtitleText.style.cssText = `font-size:16px;color:#71717a;`;
      subtitleText.textContent = `絵コンテ - ${scenes.length}シーン`;
      titlePage.appendChild(subtitleText);

      const dateText = document.createElement("div");
      dateText.style.cssText = `font-size:14px;color:#a1a1aa;margin-top:8px;`;
      dateText.textContent = new Date().toLocaleDateString("ja-JP");
      titlePage.appendChild(dateText);

      await renderPage(titlePage, false);

      // Scene pages (4 scenes per page)
      for (let i = 0; i < scenes.length; i += 4) {
        const pageScenes = scenes.slice(i, i + 4);
        const pageDiv = document.createElement("div");
        pageDiv.style.cssText = `width:1122px;height:793px;padding:30px;box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif;background:#fff;`;

        // Header
        const header = document.createElement("div");
        header.style.cssText = `font-size:11px;color:#a1a1aa;margin-bottom:16px;display:flex;justify-content:space-between;`;
        const headerLeft = document.createElement("span");
        headerLeft.textContent = title || "無題";
        const headerRight = document.createElement("span");
        headerRight.textContent = `Page ${Math.floor(i / 4) + 1}`;
        header.appendChild(headerLeft);
        header.appendChild(headerRight);
        pageDiv.appendChild(header);

        // Grid
        const grid = document.createElement("div");
        grid.style.cssText = `display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:16px;height:calc(100% - 40px);`;

        for (const scene of pageScenes) {
          const card = document.createElement("div");
          card.style.cssText = `border:1px solid #e4e4e7;border-radius:12px;overflow:hidden;display:flex;position:relative;`;

          // Scene number badge
          const badge = document.createElement("div");
          badge.style.cssText = `position:absolute;top:8px;left:8px;width:28px;height:28px;border-radius:50%;background:#2563eb;color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;z-index:1;`;
          badge.textContent = String(scene.scene_order);
          card.appendChild(badge);

          // Image
          const imgContainer = document.createElement("div");
          imgContainer.style.cssText = `width:45%;background:#f4f4f5;display:flex;align-items:center;justify-content:center;flex-shrink:0;`;
          if (scene.image_url) {
            const img = document.createElement("img");
            img.crossOrigin = "anonymous";
            img.src = scene.image_url;
            img.style.cssText = `width:100%;height:100%;object-fit:cover;`;
            imgContainer.appendChild(img);
          } else {
            const noImg = document.createElement("div");
            noImg.style.cssText = `color:#a1a1aa;font-size:12px;`;
            noImg.textContent = "No Image";
            imgContainer.appendChild(noImg);
          }
          card.appendChild(imgContainer);

          // Text
          const textContainer = document.createElement("div");
          textContainer.style.cssText = `flex:1;padding:12px;overflow:hidden;font-size:11px;line-height:1.5;`;

          if (scene.dialogue) {
            const dialogueBlock = document.createElement("div");
            dialogueBlock.style.cssText = `margin-bottom:8px;`;
            const dialogueLabel = document.createElement("div");
            dialogueLabel.style.cssText = `font-size:9px;color:#71717a;font-weight:600;margin-bottom:3px;`;
            dialogueLabel.textContent = "セリフ";
            const dialogueContent = document.createElement("div");
            dialogueContent.style.cssText = `color:#18181b;`;
            dialogueContent.textContent = scene.dialogue;
            dialogueBlock.appendChild(dialogueLabel);
            dialogueBlock.appendChild(dialogueContent);
            textContainer.appendChild(dialogueBlock);
          }
          if (scene.description) {
            const descBlock = document.createElement("div");
            const descLabel = document.createElement("div");
            descLabel.style.cssText = `font-size:9px;color:#71717a;font-weight:600;margin-bottom:3px;`;
            descLabel.textContent = "説明";
            const descContent = document.createElement("div");
            descContent.style.cssText = `color:#3f3f46;`;
            descContent.textContent = scene.description;
            descBlock.appendChild(descLabel);
            descBlock.appendChild(descContent);
            textContainer.appendChild(descBlock);
          }
          card.appendChild(textContainer);

          grid.appendChild(card);
        }

        pageDiv.appendChild(grid);
        await renderPage(pageDiv, true);
      }

      document.body.removeChild(container);
      pdf.save(`${title || "storyboard"}.pdf`);
    } catch (e) {
      alert(`PDF出力に失敗しました: ${e instanceof Error ? e.message : ""}`);
    } finally {
      setExportingPdf(false);
    }
  };

  // Google Sheets / CSV Export
  const handleExportSheet = async () => {
    setExportingSheet(true);
    try {
      if (storyboardId) {
        // Try Google Sheets API first
        try {
          const result = await api.exportToSheets(workspaceSlug, storyboardId);
          window.open(result.spreadsheetUrl, "_blank");
          setExportingSheet(false);
          return;
        } catch {
          // Fall through to CSV if Google token not available
        }
      }

      // Fallback: CSV download
      const headers = ["シーン番号", "セリフ", "シーン説明", "画像プロンプト", "画像URL"];
      const rows = scenes.map((s) => [
        String(s.scene_order),
        (s.dialogue || "").replace(/"/g, '""'),
        (s.description || "").replace(/"/g, '""'),
        (s.image_prompt || "").replace(/"/g, '""'),
        s.image_url || "",
      ]);

      const csvContent = "\uFEFF" + [
        headers.join(","),
        ...rows.map((r) => r.map((c) => `"${c}"`).join(",")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${title || "storyboard"}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`エクスポートに失敗しました: ${e instanceof Error ? e.message : ""}`);
    } finally {
      setExportingSheet(false);
    }
  };

  // Lightbox helpers
  const scenesWithImages = scenes.filter((s) => s.image_url);
  const openLightbox = (sceneId: string) => {
    const idx = scenesWithImages.findIndex((s) => s.id === sceneId);
    if (idx !== -1) setLightboxIndex(idx);
  };

  return (
    <>
      <Header title="絵コンテ作成" userEmail={user?.email} />
      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <div className="px-6 pt-4 pb-2 flex items-center justify-between">
          <h1 className="text-lg font-bold">
            {currentStep === 3 ? `${title || "無題"} - PDFプレビュー` : "新規絵コンテを生成する"}
          </h1>
          {currentStep === 3 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { setCurrentStep(0); setScenes([]); setStoryboardId(null); }}>
                <RefreshCw className="w-3.5 h-3.5" />強制再生成
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportSheet} disabled={exportingSheet}>
                {exportingSheet ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                スプレッドシート
              </Button>
              <Button size="sm" className="bg-zinc-900 text-white hover:bg-zinc-800" onClick={handleExportPdf} disabled={exportingPdf}>
                {exportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                PDFエクスポート
              </Button>
            </div>
          )}
          {(currentStep === 2 || currentStep === 1) && storyboardId && (
            <div className="relative">
              <Button variant="outline" size="sm" onClick={() => setShowVersionDropdown(!showVersionDropdown)}>
                <Clock className="w-3.5 h-3.5" />バージョン履歴<ChevronRight className="w-3 h-3 rotate-90" />
              </Button>
              {showVersionDropdown && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg border shadow-lg z-50 py-1">
                  <div className="px-3 py-2 text-xs text-muted-foreground">現在のドラフト</div>
                  <button className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50" onClick={() => setShowVersionDropdown(false)}>v1 (現在)</button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-3">
          <div className="max-w-3xl mx-auto rounded-xl border border-border bg-white">
            {/* Step dots */}
            <div className="flex items-center justify-center py-4 px-8">
              {STEPS.map((_, idx) => (
                <div key={idx} className="flex items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors ${
                    idx < currentStep ? "bg-white border-zinc-400 text-zinc-500"
                    : idx === currentStep ? "bg-white border-zinc-900 text-zinc-900"
                    : "bg-zinc-100 border-zinc-200 text-zinc-400"
                  }`}>
                    {idx < currentStep ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                  </div>
                  {idx < STEPS.length - 1 && <div className={`w-16 sm:w-24 h-0.5 mx-1 ${idx < currentStep ? "bg-zinc-400" : "bg-zinc-200"}`} />}
                </div>
              ))}
            </div>

            {/* ===== Step 1 ===== */}
            {currentStep === 0 && (
              <div className="px-8 pb-8">
                <h2 className="text-base font-bold mb-5">基本情報を入力</h2>
                <div className="space-y-5">
                  <div>
                    <label className="text-sm font-medium block mb-1.5">タイトル（任意）</label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトルを入力..." />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5">概要</label>
                    <textarea value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="概要を入力..."
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background min-h-[100px] resize-none" />
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="text-sm font-medium block mb-1.5">動画の長さ（秒）</label>
                      <Input type="number" value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 30)} min={5} max={600} />
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-1.5">コマ数</label>
                      <Input type="number" value={panelCount} onChange={(e) => setPanelCount(parseInt(e.target.value) || 8)} min={1} max={30} />
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-1.5">画像スタイル</label>
                      <select value={imageStyle} onChange={(e) => setImageStyle(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background h-10">
                        <option value="漫画">漫画</option><option value="アニメ">アニメ</option>
                        <option value="リアル">リアル</option><option value="シネマティック">シネマティック</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-1.5">アスペクト比</label>
                      <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background h-10">
                        <option value="16:9（横）">16:9（横）</option><option value="9:16（縦）">9:16（縦）</option>
                        <option value="1:1（正方形）">1:1（正方形）</option>
                      </select>
                    </div>
                  </div>

                  {/* Elements */}
                  <div className="border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-semibold">エレメンツ</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">人物・顔・商品などの参照画像（最大4枚）</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleAddElement} disabled={elements.length >= 4 || uploadingElement}>
                        {uploadingElement ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        {uploadingElement ? "保存中..." : "画像を追加"}
                      </Button>
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                    </div>
                    {elements.length === 0 ? (
                      <div className="border-2 border-dashed border-zinc-200 rounded-lg p-6 text-center cursor-pointer hover:border-zinc-300 transition-colors" onClick={handleAddElement}>
                        <ImageIcon className="w-8 h-8 mx-auto mb-2 text-zinc-300" />
                        <p className="text-xs text-muted-foreground">クリックして画像をアップロード</p>
                        <p className="text-[10px] text-muted-foreground mt-1">PNG, JPG, WEBP（最大4枚）</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-3">
                        {elements.map((el) => (
                          <div key={el.id} className="relative rounded-lg overflow-hidden border border-border group">
                            <img src={el.dataUrl} alt={el.name} className="w-full aspect-square object-cover" />
                            <button onClick={() => handleRemoveElement(el.id)}
                              className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                              <X className="w-3 h-3" />
                            </button>
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                              <p className="text-[10px] text-white truncate">{el.name}</p>
                            </div>
                          </div>
                        ))}
                        {elements.length < 4 && (
                          <button onClick={handleAddElement}
                            className="aspect-square border-2 border-dashed border-zinc-200 rounded-lg flex flex-col items-center justify-center hover:border-zinc-300 transition-colors">
                            <Plus className="w-5 h-5 text-zinc-300" /><span className="text-[10px] text-muted-foreground mt-1">追加</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-center mt-8">
                  <Button onClick={handleNext} className="w-64 bg-zinc-900 text-white hover:bg-zinc-800 h-11">次へ進む</Button>
                </div>
              </div>
            )}

            {/* ===== Generating ===== */}
            {currentStep === 1 && scenes.length === 0 && (
              <div className="px-8 pb-8">
                <h2 className="text-base font-bold mb-4">コマごとの詳細設定</h2>
                <LoadingAnimation message="AIが絵コンテを生成しています..." />
                <div className="w-48 mx-auto">
                  <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-zinc-900 rounded-full transition-all duration-300" style={{ width: `${generationProgress}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-1">{Math.round(generationProgress)}%</p>
                </div>
              </div>
            )}

            {/* ===== Step 2 ===== */}
            {currentStep === 1 && scenes.length > 0 && (
              <div className="px-8 pb-8">
                <h2 className="text-base font-bold mb-4">コマごとの詳細設定</h2>
                <div className="overflow-x-auto -mx-2">
                  <div className="flex gap-4 pb-4 px-2" style={{ minWidth: "max-content" }}>
                    {scenes.map((scene) => (
                      <div key={scene.id} className="w-80 flex-shrink-0 rounded-lg border border-border p-4 space-y-3">
                        <h3 className="text-sm font-bold">{scene.scene_order}コマ目</h3>
                        <div><label className="text-xs font-medium block mb-1">セリフ</label>
                          <Input value={scene.dialogue || ""} onChange={(e) => updateScene(scene.id, "dialogue", e.target.value)} /></div>
                        <div><label className="text-xs font-medium block mb-1">シーン説明</label>
                          <Input value={scene.description || ""} onChange={(e) => updateScene(scene.id, "description", e.target.value)} /></div>
                        <div><label className="text-xs font-medium block mb-1">人物イメージ（男女）</label>
                          <Input value={scene.character_desc || ""} onChange={(e) => updateScene(scene.id, "character_desc", e.target.value)} placeholder="性別や容姿など" /></div>
                        <div><label className="text-xs font-medium block mb-1">場所</label>
                          <Input value={scene.location || ""} onChange={(e) => updateScene(scene.id, "location", e.target.value)} placeholder="場所のイメージを入力" /></div>
                        <div><label className="text-xs font-medium block mb-1">構図</label>
                          <Input value={scene.composition || ""} onChange={(e) => updateScene(scene.id, "composition", e.target.value)} placeholder="構図のイメージを入力" /></div>
                        <div><label className="text-xs font-medium block mb-1">プロンプト文</label>
                          <p className="text-[10px] text-muted-foreground mb-1">その他の指示があれば入力してください</p>
                          <textarea value={scene.image_prompt || ""} onChange={(e) => updateScene(scene.id, "image_prompt", e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-border rounded-lg bg-background min-h-[80px] resize-none" /></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-center mt-6">
                  <Button onClick={handleNext} className="w-64 bg-zinc-900 text-white hover:bg-zinc-800 h-11">次へ進む</Button>
                </div>
              </div>
            )}

            {/* ===== Step 3 ===== */}
            {currentStep === 2 && (
              <div className="px-8 pb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold">コマごとの詳細設定</h2>
                  <button onClick={handleAddScene} className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground">
                    <Plus className="w-3.5 h-3.5" />コマを追加
                  </button>
                </div>

                <div className="overflow-x-auto -mx-2">
                  <div className="flex gap-4 pb-4 px-2" style={{ minWidth: "max-content" }}>
                    {scenes.map((scene) => (
                      <div key={scene.id} className="w-72 flex-shrink-0 rounded-lg border border-border overflow-hidden">
                        {/* Image with click-to-expand */}
                        <div
                          className="relative aspect-video bg-zinc-800 flex items-center justify-center cursor-pointer group"
                          onClick={() => scene.image_url && openLightbox(scene.id)}
                        >
                          {scene.image_url ? (
                            <>
                              <img src={scene.image_url} alt={`Scene ${scene.scene_order}`} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </>
                          ) : (
                            <span className="text-xs text-zinc-400">画像なし</span>
                          )}
                          {generatingImageId === scene.id && (
                            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1">
                              <LoadingAnimation />
                            </div>
                          )}
                        </div>

                        <div className="p-3 space-y-2">
                          <h3 className="text-sm font-bold">{scene.scene_order}コマ目</h3>
                          <div><label className="text-xs font-medium block mb-1">セリフ</label>
                            <textarea value={scene.dialogue || ""} onChange={(e) => updateScene(scene.id, "dialogue", e.target.value)}
                              className="w-full px-2 py-1.5 text-xs border border-border rounded bg-background min-h-[50px] resize-none" /></div>
                          <div><label className="text-xs font-medium block mb-1">シーン説明</label>
                            <textarea value={scene.description || ""} onChange={(e) => updateScene(scene.id, "description", e.target.value)}
                              className="w-full px-2 py-1.5 text-xs border border-border rounded bg-background min-h-[50px] resize-none" /></div>
                          <div><label className="text-xs font-medium block mb-1">生成プロンプト</label>
                            <textarea value={scene.image_prompt || ""} onChange={(e) => updateScene(scene.id, "image_prompt", e.target.value)}
                              className="w-full px-2 py-1.5 text-xs border border-border rounded bg-background min-h-[40px] resize-none text-muted-foreground" /></div>
                          <div className="flex items-center gap-2 pt-1">
                            <Button variant="outline" size="sm" className="text-xs h-7 flex-1"
                              onClick={() => handleSaveScene(scene)} disabled={savingSceneId === scene.id}>
                              {savingSceneId === scene.id && <Loader2 className="w-3 h-3 animate-spin" />}内容を保存
                            </Button>
                            <Button variant="outline" size="sm" className="text-xs h-7 flex-1"
                              onClick={() => handleGenerateImage(scene.id)} disabled={generatingImageId === scene.id}>
                              {generatingImageId === scene.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}生成する
                            </Button>
                            <button onClick={() => handleDeleteScene(scene.id)} className="p-1.5 rounded hover:bg-zinc-100 text-muted-foreground">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-center gap-3 mt-6">
                  <Button variant="outline" onClick={handleSaveAll} className="w-56 h-11">全て保存する</Button>
                  <Button onClick={handleNext} className="w-56 bg-zinc-900 text-white hover:bg-zinc-800 h-11">
                    次へ進む<ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* ===== Step 4 ===== */}
            {currentStep === 3 && (
              <div className="px-8 pb-8" ref={pdfPreviewRef}>
                <div className="grid grid-cols-2 gap-4">
                  {scenes.map((scene) => (
                    <div key={scene.id} className="flex gap-3 border border-border rounded-lg p-3">
                      <div
                        className="w-24 h-20 flex-shrink-0 bg-zinc-800 rounded overflow-hidden flex items-center justify-center relative cursor-pointer group"
                        onClick={() => scene.image_url && openLightbox(scene.id)}
                      >
                        {scene.image_url ? (
                          <>
                            <img src={scene.image_url} alt={`Scene ${scene.scene_order}`} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                              <Maximize2 className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </>
                        ) : (
                          <span className="text-[10px] text-zinc-400">画像なし</span>
                        )}
                        <div className="absolute top-0.5 left-0.5 bg-blue-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                          {scene.scene_order}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        {scene.dialogue && <div className="mb-1"><p className="text-[10px] font-semibold">セリフ</p><p className="text-xs">{scene.dialogue}</p></div>}
                        {scene.description && <div><p className="text-[10px] font-semibold">概要</p><p className="text-xs text-muted-foreground">{scene.description}</p></div>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center gap-3 mt-8">
                  <Button variant="outline" onClick={handleBack} className="w-40"><ChevronLeft className="w-4 h-4" />戻る</Button>
                  <Button onClick={handlePublish} disabled={publishing} className="w-40 bg-zinc-900 text-white hover:bg-zinc-800">
                    {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    公開する
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Image Lightbox */}
      {lightboxIndex !== null && scenesWithImages[lightboxIndex] && (
        <ImageLightbox
          src={scenesWithImages[lightboxIndex].image_url!}
          alt={`シーン ${scenesWithImages[lightboxIndex].scene_order}`}
          onClose={() => setLightboxIndex(null)}
          hasPrev={lightboxIndex > 0}
          hasNext={lightboxIndex < scenesWithImages.length - 1}
          onPrev={() => setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
          onNext={() => setLightboxIndex((i) => (i !== null && i < scenesWithImages.length - 1 ? i + 1 : i))}
        />
      )}
    </>
  );
}
