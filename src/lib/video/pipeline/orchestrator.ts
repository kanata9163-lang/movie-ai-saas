import { createServerClient } from '@/lib/supabase/server';
import { analyzeCompanyUrl, generateScript, ReferenceImage } from '../ai/gemini';
import { generateVideoImage, ReferenceImageData } from '../api/image-gen';
import { createVideoFromImage, checkTaskStatus } from '../api/runway';
import { generateNarration } from '../api/elevenlabs';

async function updateProjectStatus(projectId: string, status: string, errorMessage?: string) {
  const supabase = createServerClient();
  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (errorMessage !== undefined) update.error_message = errorMessage;
  await supabase.from('video_projects').update(update).eq('id', projectId);
}

async function addLog(projectId: string, message: string) {
  const supabase = createServerClient();
  const timestamp = new Date().toLocaleTimeString('ja-JP');
  const logLine = `[${timestamp}] ${message}`;

  const { data } = await supabase.from('video_projects').select('pipeline_logs').eq('id', projectId).single();
  const logs: string[] = data?.pipeline_logs || [];
  logs.push(logLine);
  await supabase.from('video_projects').update({ pipeline_logs: logs }).eq('id', projectId);
  console.log(`[VideoPipeline ${projectId}] ${message}`);
}

async function fetchReferenceImages(projectId: string): Promise<ReferenceImageData[]> {
  const supabase = createServerClient();
  const { data: refImages } = await supabase.from('video_reference_images').select('*').eq('video_project_id', projectId);

  const images: ReferenceImageData[] = [];
  if (refImages) {
    for (const img of refImages) {
      if (img.image_data) {
        // image_data is stored as base64 data URL or raw base64
        let base64 = img.image_data;
        if (base64.startsWith('data:')) {
          base64 = base64.split(',')[1];
        }
        images.push({ data: base64, mimeType: img.mime_type || 'image/png' });
      }
    }
  }
  return images;
}

export async function runAnalyzeAndScript(projectId: string) {
  const supabase = createServerClient();

  try {
    const { data: project, error } = await supabase.from('video_projects').select('*').eq('id', projectId).single();
    if (error || !project) throw new Error('Video project not found');

    await supabase.from('video_projects').update({ pipeline_logs: [] }).eq('id', projectId);

    // Step 1: Analyze URL
    await updateProjectStatus(projectId, 'analyzing');
    await addLog(projectId, `URL解析を開始: ${project.source_url}`);

    const analysis = await analyzeCompanyUrl(project.source_url);
    await addLog(projectId, `URL解析完了: 「${analysis.companyName || '不明'}」を検出`);

    // Save analysis
    await supabase.from('video_projects').update({ company_analysis: analysis }).eq('id', projectId);

    // Reference images
    const { data: refImages } = await supabase.from('video_reference_images').select('*').eq('video_project_id', projectId);
    const imageDescriptions = (refImages || []).map((img: { image_type: string }) => `${img.image_type}画像が添付されています`);

    const referenceImages: ReferenceImage[] = [];
    if (refImages && refImages.length > 0) {
      for (const img of refImages) {
        if (img.image_data) {
          let base64 = img.image_data;
          if (base64.startsWith('data:')) base64 = base64.split(',')[1];
          referenceImages.push({ data: base64, mimeType: img.mime_type || 'image/png', imageType: img.image_type || 'other' });
        }
      }
      await addLog(projectId, `参照画像: ${referenceImages.length}枚をAIに送信`);
    }

    // Step 2: Fetch workspace knowledge for context
    let knowledgeContext = '';
    try {
      const { data: knowledgeItems } = await supabase
        .from('knowledge_items')
        .select('title, content_type, content_text')
        .eq('workspace_id', project.workspace_id)
        .limit(20);

      if (knowledgeItems && knowledgeItems.length > 0) {
        const knowledgeParts = knowledgeItems.map((item: { title: string; content_type: string; content_text: string | null }) => {
          const typeLabels: Record<string, string> = {
            text: 'テキスト',
            url: 'URL情報',
            brand_guide: 'ブランドガイドライン',
            past_work: '過去の制作実績',
            guideline: '制作ガイドライン',
          };
          const label = typeLabels[item.content_type] || item.content_type;
          return `【${label}】${item.title}\n${item.content_text?.slice(0, 500) || ''}`;
        });
        knowledgeContext = `ナレッジベース情報（以下の情報を台本に反映してください）:\n${knowledgeParts.join('\n\n')}`;
        await addLog(projectId, `ナレッジ ${knowledgeItems.length}件をプロンプトに注入`);
      }
    } catch {
      // Knowledge fetch failure is non-critical
    }

    // Generate Script
    await updateProjectStatus(projectId, 'scripting');
    await addLog(projectId, '台本作成中...');

    const sceneCount = 5;
    const storyboard = await generateScript(analysis, imageDescriptions, sceneCount, referenceImages.length > 0 ? referenceImages : undefined, knowledgeContext || undefined);
    await addLog(projectId, `台本生成完了: 「${storyboard.title}」（${storyboard.scenes.length}シーン）`);

    // Save script and create scenes
    const visualStyle = storyboard.visualStyle || '';
    await supabase.from('video_projects').update({
      script: storyboard,
      title: storyboard.title || project.title,
      status: 'script_ready',
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);

    if (visualStyle) {
      await addLog(projectId, `ビジュアルスタイル: ${visualStyle.slice(0, 80)}...`);
    }

    for (const scene of storyboard.scenes) {
      // Prepend visual style to each image prompt for consistency
      const imagePrompt = visualStyle
        ? `CONSISTENT STYLE: ${visualStyle}. SCENE: ${scene.imagePrompt ?? ''}`
        : scene.imagePrompt ?? '';

      await supabase.from('video_scenes').insert({
        video_project_id: projectId,
        scene_number: scene.sceneNumber ?? 1,
        narration_text: scene.narrationText ?? '',
        image_prompt: imagePrompt,
        description: scene.visualDescription ?? '',
        duration: scene.durationSeconds ?? 5,
        status: 'pending',
      });
    }

    await addLog(projectId, '台本確認待ち');
    return { success: true, storyboard };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await addLog(projectId, `エラー: ${message}`);
    await updateProjectStatus(projectId, 'failed', message);
    return { success: false, error: message };
  }
}

export async function runImageGeneration(projectId: string) {
  const supabase = createServerClient();

  try {
    await updateProjectStatus(projectId, 'generating_images');

    const { data: projectData } = await supabase.from('video_projects').select('aspect_ratio').eq('id', projectId).single();
    const aspectRatio = projectData?.aspect_ratio || '9:16';

    const { data: scenes } = await supabase.from('video_scenes').select('*').eq('video_project_id', projectId).order('scene_number');
    if (!scenes || scenes.length === 0) throw new Error('No scenes found');

    const refImages = await fetchReferenceImages(projectId);

    // Find next pending scene
    const scene = scenes.find((s: { status: string }) => s.status === 'pending');
    if (!scene) {
      await updateProjectStatus(projectId, 'images_ready');
      await addLog(projectId, '全画像生成完了');
      return { success: true, allDone: true };
    }

    const completedBefore = scenes.filter((s: { status: string }) => s.status === 'image_ready').length;
    await addLog(projectId, `シーン${scene.scene_number}/${scenes.length} 画像生成中...`);

    // Build scene context for visual consistency
    const otherScenes = scenes
      .filter((s: { id: string }) => s.id !== scene.id)
      .map((s: { scene_number: number; image_prompt: string }) => `Scene ${s.scene_number}: ${s.image_prompt?.slice(0, 100)}`)
      .join('\n');

    const imageBuffer = await generateVideoImage(scene.image_prompt, aspectRatio, refImages.length > 0 ? refImages : undefined, otherScenes || undefined);

    // Upload to Supabase Storage
    const path = `video/${projectId}/scenes/${scene.scene_number}.png`;
    await supabase.storage.from('generated-assets').upload(path, imageBuffer, { contentType: 'image/png', upsert: true });
    const { data: urlData } = supabase.storage.from('generated-assets').getPublicUrl(path);

    await supabase.from('video_scenes').update({ image_url: urlData.publicUrl, status: 'image_ready' }).eq('id', scene.id);

    const completedNow = completedBefore + 1;
    await addLog(projectId, `✅ シーン${scene.scene_number} 画像完了（${completedNow}/${scenes.length}）`);

    if (completedNow >= scenes.length) {
      await updateProjectStatus(projectId, 'images_ready');
      await addLog(projectId, '全画像生成完了');
      return { success: true, allDone: true };
    }

    return { success: true, allDone: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await addLog(projectId, `エラー: ${message}`);
    await updateProjectStatus(projectId, 'failed', message);
    return { success: false, error: message };
  }
}

export async function regenerateSceneImage(projectId: string, sceneId: string) {
  const supabase = createServerClient();

  try {
    const { data: projectData } = await supabase.from('video_projects').select('aspect_ratio').eq('id', projectId).single();
    const { data: scene } = await supabase.from('video_scenes').select('*').eq('id', sceneId).single();
    if (!scene) throw new Error('Scene not found');

    const refImages = await fetchReferenceImages(projectId);
    await addLog(projectId, `シーン${scene.scene_number} 画像再生成中...`);

    const imageBuffer = await generateVideoImage(scene.image_prompt, projectData?.aspect_ratio || '9:16', refImages.length > 0 ? refImages : undefined);

    const path = `video/${projectId}/scenes/${scene.scene_number}.png`;
    await supabase.storage.from('generated-assets').upload(path, imageBuffer, { contentType: 'image/png', upsert: true });
    const { data: urlData } = supabase.storage.from('generated-assets').getPublicUrl(path);
    const imageUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    await supabase.from('video_scenes').update({ image_url: imageUrl, status: 'image_ready' }).eq('id', sceneId);
    await addLog(projectId, `シーン${scene.scene_number} 画像再生成完了`);

    return { success: true, imageUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

export async function submitVideoTasks(projectId: string) {
  const supabase = createServerClient();

  try {
    await updateProjectStatus(projectId, 'generating_video');
    await addLog(projectId, '動画生成開始（Runway AI）...');

    const { data: projectData } = await supabase.from('video_projects').select('aspect_ratio').eq('id', projectId).single();
    const aspectRatio = projectData?.aspect_ratio || '9:16';

    const { data: scenes } = await supabase.from('video_scenes').select('*').eq('video_project_id', projectId).order('scene_number');
    if (!scenes || scenes.length === 0) throw new Error('No scenes found');

    const scenesWithImages = scenes.filter((s: { image_url: string | null }) => s.image_url);

    for (const scene of scenesWithImages) {
      const taskId = await createVideoFromImage(scene.image_url, scene.image_prompt || '', scene.duration || 5, aspectRatio);
      await supabase.from('video_scenes').update({ video_task_id: taskId, status: 'video_generating' }).eq('id', scene.id);
      await addLog(projectId, `シーン${scene.scene_number}: タスク送信（ID: ${taskId.slice(0, 8)}...）`);
    }

    await addLog(projectId, `全${scenesWithImages.length}タスク送信完了`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await addLog(projectId, `エラー: ${message}`);
    await updateProjectStatus(projectId, 'failed', message);
    return { success: false, error: message };
  }
}

export async function checkVideoTasks(projectId: string) {
  const supabase = createServerClient();

  try {
    const { data: scenes } = await supabase.from('video_scenes').select('*').eq('video_project_id', projectId).order('scene_number');
    if (!scenes) return { success: false, allDone: false, error: 'No scenes' };

    const pendingScenes = scenes.filter((s: { video_task_id: string | null; status: string }) => s.video_task_id && s.status === 'video_generating');
    const totalWithTasks = scenes.filter((s: { video_task_id: string | null }) => s.video_task_id).length;
    const alreadyDone = scenes.filter((s: { status: string }) => s.status === 'video_ready').length;

    if (pendingScenes.length === 0 && alreadyDone === totalWithTasks) {
      return { success: true, allDone: true, completed: alreadyDone, total: totalWithTasks };
    }

    for (const scene of pendingScenes) {
      try {
        const result = await checkTaskStatus(scene.video_task_id);
        if (result.status === 'SUCCEEDED' && result.outputUrl) {
          // Use Runway URL directly to avoid Vercel timeout on large video download+upload
          await supabase.from('video_scenes').update({ video_url: result.outputUrl, status: 'video_ready' }).eq('id', scene.id);
          await addLog(projectId, `✅ シーン${scene.scene_number} 動画完了`);
        } else if (result.status === 'FAILED') {
          await addLog(projectId, `❌ シーン${scene.scene_number} 動画失敗`);
          await supabase.from('video_scenes').update({ status: 'video_failed' }).eq('id', scene.id);
        }
      } catch (err) {
        console.error(`Scene check error:`, err);
      }
    }

    const { data: updatedScenes } = await supabase.from('video_scenes').select('status, video_task_id').eq('video_project_id', projectId);
    const nowDone = updatedScenes?.filter((s: { status: string }) => s.status === 'video_ready').length || 0;
    const nowTotal = updatedScenes?.filter((s: { video_task_id: string | null }) => s.video_task_id).length || totalWithTasks;

    return { success: true, allDone: nowDone === nowTotal, completed: nowDone, total: nowTotal };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, allDone: false, error: message };
  }
}

export async function runNarrationGeneration(projectId: string) {
  const supabase = createServerClient();

  try {
    await updateProjectStatus(projectId, 'generating_audio');
    await addLog(projectId, 'ナレーション生成開始...');

    const { data: project } = await supabase.from('video_projects').select('voice_type').eq('id', projectId).single();
    const gender = (project?.voice_type || 'female') as 'male' | 'female';

    const { data: scenes } = await supabase.from('video_scenes').select('*').eq('video_project_id', projectId).order('scene_number');
    if (!scenes || scenes.length === 0) throw new Error('No scenes found');

    // Process sequentially to avoid ElevenLabs rate limits
    let successCount = 0;
    for (const scene of scenes) {
      const narrationText = (scene as { narration_text: string }).narration_text;
      const sceneNumber = (scene as { scene_number: number }).scene_number;
      const sceneId = (scene as { id: string }).id;

      if (!narrationText) {
        await addLog(projectId, `⚠️ シーン${sceneNumber} セリフなし - スキップ`);
        continue;
      }

      try {
        const audioBuffer = await generateNarration(narrationText, gender);

        // Estimate audio duration from MP3 buffer size
        // MP3 at ~128kbps: duration ≈ (bytes * 8) / 128000
        const estimatedDuration = Math.ceil((audioBuffer.length * 8) / 128000);
        // Runway only supports 5 or 10 seconds
        const videoDuration = estimatedDuration <= 5 ? 5 : 10;

        const path = `video/${projectId}/audio/${sceneNumber}.mp3`;
        await supabase.storage.from('generated-assets').upload(path, audioBuffer, { contentType: 'audio/mpeg', upsert: true });
        const { data: urlData } = supabase.storage.from('generated-assets').getPublicUrl(path);

        // Save audio URL and update duration to match audio length
        await supabase.from('video_scenes').update({
          audio_url: urlData.publicUrl,
          duration: videoDuration,
          status: 'audio_ready',
        }).eq('id', sceneId);
        await addLog(projectId, `✅ シーン${sceneNumber} ナレーション完了（音声${estimatedDuration}秒→動画${videoDuration}秒）`);
        successCount++;
      } catch (sceneErr) {
        const msg = sceneErr instanceof Error ? sceneErr.message : 'Unknown error';
        await addLog(projectId, `❌ シーン${sceneNumber} ナレーション失敗: ${msg}`);
      }
    }

    await addLog(projectId, `全ナレーション生成完了（${successCount}/${scenes.length}）`);

    // Check if video has already been generated
    const { data: updatedScenes } = await supabase.from('video_scenes').select('video_url').eq('video_project_id', projectId);
    const hasVideos = updatedScenes?.some((s: { video_url: string | null }) => s.video_url);

    if (hasVideos) {
      // Video was generated before audio (old flow) - mark complete
      await updateProjectStatus(projectId, 'completed');
    } else {
      // New flow: audio first, then video - go back to images_ready so user can generate video
      await updateProjectStatus(projectId, 'images_ready');
      await addLog(projectId, '次のステップ: 音声の長さに合わせて動画を生成します');
    }
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await addLog(projectId, `エラー: ${message}`);
    await updateProjectStatus(projectId, 'failed', message);
    return { success: false, error: message };
  }
}
