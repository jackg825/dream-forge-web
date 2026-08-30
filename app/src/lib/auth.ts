import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut as firebaseSignOut,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from './firebase';

const googleProvider = new GoogleAuthProvider();

/**
 * Sign in with Google OAuth
 */
export async function signInWithGoogle(): Promise<FirebaseUser> {
  if (!auth) {
    throw new Error('Firebase is not configured');
  }
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<FirebaseUser> {
  if (!auth) {
    throw new Error('Firebase is not configured');
  }
  const result = await signInWithEmailAndPassword(auth, email, password);
  if (!result.user.emailVerified) {
    try {
      await sendEmailVerification(result.user);
    } finally {
      // Never leave an unverified account authenticated when verification or
      // profile follow-up fails.
      await firebaseSignOut(auth);
    }
    const error = new Error('Verify your email before signing in') as Error & { code: string };
    error.code = 'auth/email-not-verified';
    throw error;
  }
  return result.user;
}

/**
 * Create a new account with email and password
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<FirebaseUser> {
  if (!auth) {
    throw new Error('Firebase is not configured');
  }
  const result = await createUserWithEmailAndPassword(auth, email, password);

  try {
    // Update display name if provided
    if (displayName && result.user) {
      await updateProfile(result.user, { displayName });
    }

    await sendEmailVerification(result.user);
  } finally {
    // Creating the Firebase account signs the user in immediately. Always end
    // that session until the address has been verified.
    await firebaseSignOut(auth);
  }

  return result.user;
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  if (!auth) {
    throw new Error('Firebase is not configured');
  }
  await firebaseSignOut(auth);
}

/**
 * Get a human-readable error message from Firebase auth errors
 */
export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: string }).code;

    switch (code) {
      case 'auth/email-already-in-use':
        return 'This email is already registered. Try signing in instead.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/operation-not-allowed':
        return 'This sign-in method is not enabled.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters.';
      case 'auth/user-disabled':
        return 'This account has been disabled.';
      case 'auth/user-not-found':
        return 'No account found with this email.';
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again.';
      case 'auth/invalid-credential':
        return 'Invalid email or password.';
      case 'auth/popup-closed-by-user':
        return 'Sign-in popup was closed. Please try again.';
      case 'auth/popup-blocked':
        return 'Sign-in popup was blocked. Please enable popups.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection.';
      case 'auth/email-not-verified':
        return 'Please verify your email. We sent you a new verification link.';
      default:
        return error.message || 'An unknown error occurred.';
    }
  }
  return 'An unknown error occurred.';
}
