import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
admin.initializeApp();

// Export all Cloud Functions
export { onUserCreate } from './handlers/users';
export { generateModel, checkJobStatus, retryFailedJob } from './handlers/generate';
export {
  addCredits,
  checkRodinBalance,
  checkAllProviderBalances,
  getAdminStats,
  listUsers,
  listAllPipelines,
  deductCredits,
  getUserTransactions,
  updateUserTier,
  // Admin pipeline regeneration functions
  adminRegeneratePipelineImage,
  adminStartPipelineMesh,
  adminCheckPreviewStatus,
  adminConfirmPreview,
  adminRejectPreview,
} from './handlers/admin';

// Multi-step creation flow (Sessions)
export {
  createSession,
  updateSession,
  deleteSession,
  getUserSessions,
} from './handlers/sessions';

// Multi-step creation flow (Views)
export {
  generateSessionViews,
  regenerateView,
  uploadCustomView,
} from './handlers/views';

// Multi-step creation flow (Model)
export {
  startSessionModelGeneration,
  checkSessionModelStatus,
} from './handlers/model';

// H2C 7-color optimization for Bambu Lab H2C printer
export {
  optimizeColorsForH2C,
  uploadEditedH2CImage,
} from './handlers/h2c';

// New simplified pipeline flow (Gemini + Meshy)
export {
  createPipeline,
  generatePipelineImages,
  regeneratePipelineImage,
  startPipelineMesh,
  checkPipelineStatus,
  startPipelineTexture,
  updatePipelineAnalysis,
  resetPipelineStep,
} from './handlers/pipeline';

// Gemini Batch API handlers
export { submitGeminiBatch } from './handlers/gemini-batch';

// Image analysis (pre-upload Gemini analysis)
export { analyzeUploadedImage } from './handlers/analyze';

// 3D Print mesh optimization
export {
  optimizeMeshForPrint,
  analyzeMeshForPrint,
} from './handlers/optimize';
