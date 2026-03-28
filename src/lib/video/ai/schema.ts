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
  visualStyle: z.string().optional().default(''),
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
  citations: z.array(z.object({
    fact: z.string(),
    source: z.string(),
    context: z.string().optional(),
  })).optional().default([]),
  marketInsights: z.array(z.object({
    insight: z.string(),
    basis: z.string(),
  })).optional().default([]),
});

export type CompanyAnalysis = z.infer<typeof CompanyAnalysisSchema>;
export type Storyboard = z.infer<typeof StoryboardSchema>;
export type StoryboardScene = z.infer<typeof StoryboardSceneSchema>;
