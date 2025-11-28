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
