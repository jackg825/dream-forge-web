import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
admin.initializeApp();

// Export all Cloud Functions
export { onUserCreate } from './handlers/users';
export { generateModel, checkJobStatus, generateTexture, retryFailedJob } from './handlers/generate';
export {
  addCredits,
  setUnlimitedCredits,
  checkRodinBalance,
  getAdminStats,
  listUsers,
} from './handlers/admin';

// Multi-step creation flow (Sessions)
export {
  createSession,
  getSession,
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
  getPipeline,
  generatePipelineImages,
  regeneratePipelineImage,
  startPipelineMesh,
  checkPipelineStatus,
  startPipelineTexture,
} from './handlers/pipeline';
