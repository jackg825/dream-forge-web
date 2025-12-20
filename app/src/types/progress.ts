/**
 * Progress constants for unified pipeline progress display
 *
 * This file provides consistent messaging, timing, and navigation hints
 * across all pipeline steps for a coherent user experience.
 */

import type { PipelineStatus, ModelProvider, PROVIDER_OPTIONS } from './index';

/**
 * Progress message configuration for each pipeline status
 */
export interface ProgressMessage {
  /** Main title shown in progress indicator */
  title: string;
  /** Subtitle with more detail about current action */
  subtitle: string;
  /** Estimated time range for this step */
  estimatedTime: string;
  /** Whether user can safely leave the page */
  canLeave: boolean;
  /** Icon identifier for this status */
  icon: 'upload' | 'loader' | 'images' | 'box' | 'palette' | 'check' | 'alert';
}

/**
 * Unified progress messages for all pipeline statuses
 */
export const PIPELINE_PROGRESS_MESSAGES: Record<PipelineStatus, ProgressMessage> = {
  'draft': {
    title: '正在提交作業...',
    subtitle: '您的圖片正在上傳並排隊處理',
    estimatedTime: '',
    canLeave: true,
    icon: 'upload',
  },
  'batch-queued': {
    title: '排隊中',
    subtitle: 'AI 正在準備處理您的圖片',
    estimatedTime: '5-15 分鐘',
    canLeave: true,
    icon: 'loader',
  },
  'batch-processing': {
    title: '批次處理中',
    subtitle: 'AI 正在分析並生成多角度視圖',
    estimatedTime: '5-15 分鐘',
    canLeave: true,
    icon: 'images',
  },
  'generating-images': {
    title: '生成視角圖片',
    subtitle: 'AI 正在為您的模型生成多個角度的視圖',
    estimatedTime: '2-5 分鐘',
    canLeave: false,
    icon: 'images',
  },
  'images-ready': {
    title: '圖片就緒',
    subtitle: '請檢查生成的視角圖片',
    estimatedTime: '',
    canLeave: true,
    icon: 'check',
  },
  'generating-mesh': {
    title: '生成 3D 網格',
    subtitle: '正在將圖片轉換為 3D 模型', // Dynamic subtitle - use getProgressMessage with provider
    estimatedTime: '2-5 分鐘',
    canLeave: false,
    icon: 'box',
  },
  'mesh-ready': {
    title: '網格就緒',
    subtitle: '3D 網格已生成完成',
    estimatedTime: '',
    canLeave: true,
    icon: 'check',
  },
  'generating-texture': {
    title: '生成貼圖',
    subtitle: '正在為 3D 模型添加精細貼圖',
    estimatedTime: '2-5 分鐘',
    canLeave: false,
    icon: 'palette',
  },
  'completed': {
    title: '完成',
    subtitle: '您的 3D 模型已準備就緒',
    estimatedTime: '',
    canLeave: true,
    icon: 'check',
  },
  'failed': {
    title: '處理失敗',
    subtitle: '發生錯誤，請重試',
    estimatedTime: '',
    canLeave: true,
    icon: 'alert',
  },
};

/**
 * Next step preview for user expectations
 */
export interface NextStepInfo {
  /** Label for the next step */
  label: string;
  /** Credit cost for the next step (if applicable) */
  cost?: number;
  /** Whether the step is optional */
  optional?: boolean;
}

/**
 * Preview of what comes next after each status
 */
export const PIPELINE_NEXT_STEP: Partial<Record<PipelineStatus, NextStepInfo>> = {
  'images-ready': {
    label: '生成 3D 網格',
    cost: 5,
  },
  'mesh-ready': {
    label: '添加貼圖',
    cost: 10,
    optional: true,
  },
};

/** Provider display names for progress messages */
const PROVIDER_DISPLAY_NAMES: Record<ModelProvider, string> = {
  meshy: 'Meshy AI',
  hunyuan: 'Hunyuan 3D',
  rodin: 'Rodin',
  tripo: 'Tripo3D',
  hitem3d: 'HiTem3D',
};

/**
 * Helper to get progress message for a status
 * @param status - Pipeline status
 * @param provider - Optional provider for dynamic subtitles (used for generating-mesh)
 */
export function getProgressMessage(status: PipelineStatus, provider?: ModelProvider): ProgressMessage {
  const message = PIPELINE_PROGRESS_MESSAGES[status];

  // For generating-mesh, include provider name in subtitle
  if (status === 'generating-mesh' && provider) {
    const providerName = PROVIDER_DISPLAY_NAMES[provider] || provider;
    return {
      ...message,
      subtitle: `${providerName} 正在將圖片轉換為 3D 模型`,
    };
  }

  return message;
}

/**
 * Helper to get next step info for a status
 */
export function getNextStepInfo(status: PipelineStatus): NextStepInfo | undefined {
  return PIPELINE_NEXT_STEP[status];
}
