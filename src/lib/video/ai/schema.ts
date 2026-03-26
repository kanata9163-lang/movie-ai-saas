import { z } from 'zod';

export const StoryboardSceneSchema = z.object({
  sceneNumber: z.number().default(1),
  visualDescription: z.string().default(''),
  imagePrompt: z.string().default(''),
  narrationText: z.string().default(''),
  durationSeconds: z.number().min(3).max(15).default(5),
});

export const StoryboardSchema = z.object({
  title: z.string(),
  scenes: z.array(StoryboardSceneSchema).min(1).max(10),
});

export const CompanyAnalysisSchema = z.object({
  companyName: z.string(),
  industry: z.string(),
  products: z.array(z.string()),
  targetAudience: z.string(),
  tone: z.string(),
  keyMessages: z.array(z.string()),
  description: z.string(),
});

export type CompanyAnalysis = z.infer<typeof CompanyAnalysisSchema>;
export type Storyboard = z.infer<typeof StoryboardSchema>;
export type StoryboardScene = z.infer<typeof StoryboardSceneSchema>;
