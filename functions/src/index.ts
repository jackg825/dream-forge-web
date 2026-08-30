import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
admin.initializeApp();

// Export all Cloud Functions
export { onUserCreate, claimWelcomeCredits } from './handlers/users';
export { refreshJobAccessUrls } from './handlers/generate';
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

// Overwrite legacy URL-based callables with fail-closed stubs for one migration
// cycle. They can be explicitly deleted after this version is deployed.
export {
  createSession,
  updateSession,
  deleteSession,
  getUserSessions,
  generateSessionViews,
  regenerateView,
  uploadCustomView,
  startSessionModelGeneration,
  checkSessionModelStatus,
  optimizeColorsForH2C,
  uploadEditedH2CImage,
  generateModel,
  checkJobStatus,
  retryFailedJob,
  createOrder,
  saveShippingAddress,
  deleteShippingAddress,
} from './handlers/disabled-legacy';

// New simplified pipeline flow (Gemini + Meshy)
export {
  createPipeline,
  generatePipelineImages,
  regeneratePipelineImage,
  startPipelineMesh,
  checkPipelineStatus,
  startPipelineTexture,
  refreshPipelineAccessUrls,
  updatePipelineAnalysis,
  resetPipelineStep,
} from './handlers/pipeline';

// Keep the disabled callable exported so a deployment overwrites any older,
// vulnerable deployed version instead of leaving it active by accident.
export { submitGeminiBatch } from './handlers/gemini-batch';

// Image analysis (pre-upload Gemini analysis)
export { analyzeUploadedImage } from './handlers/analyze';

// 3D Print mesh optimization
export {
  optimizeMeshForPrint,
  analyzeMeshForPrint,
} from './handlers/optimize';

// Print ordering system
export {
  // User functions
  getUserOrders,
  getOrderDetails,
  cancelOrder,
  // Shipping addresses
  getShippingAddresses,
  // Print config
  getPrintConfig,
  // Admin functions
  listAllOrders,
  getOrdersByStatus,
  updateOrderStatus,
  updateTrackingInfo,
  getOrderStats,
  updateMaterialConfig,
  updatePricing,
} from './handlers/orders';
