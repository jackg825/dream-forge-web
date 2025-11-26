'use client';

import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, isFirebaseReady } from '@/lib/firebase';
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  signOut,
  getAuthErrorMessage,
} from '@/lib/auth';
import type { User } from '@/types';

interface UseAuthReturn {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

/**
 * Custom hook for authentication state management
 * Syncs Firebase Auth state with Firestore user document
 */
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Listen to Firebase Auth state
  useEffect(() => {
    // Skip if Firebase is not ready (SSR or missing config)
    if (!isFirebaseReady() || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser) {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Listen to Firestore user document when authenticated
  useEffect(() => {
    if (!firebaseUser || !db) return;

    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const unsubscribe = onSnapshot(
      userDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUser({
            uid: data.uid,
            email: data.email,
            displayName: data.displayName,
            photoURL: data.photoURL,
            credits: data.credits,
            totalGenerated: data.totalGenerated,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          });
        } else {
          // User document not yet created (Cloud Function may be running)
          // Use Firebase Auth data as fallback
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || 'User',
            photoURL: firebaseUser.photoURL,
            credits: 0, // Will be updated when doc is created
            totalGenerated: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching user document:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firebaseUser]);

  const handleSignInWithGoogle = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(getAuthErrorMessage(err));
      setLoading(false);
    }
  }, []);

  const handleSignInWithEmail = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      setError(getAuthErrorMessage(err));
      setLoading(false);
    }
  }, []);

  const handleSignUpWithEmail = useCallback(
    async (email: string, password: string, displayName?: string) => {
      setError(null);
      setLoading(true);
      try {
        await signUpWithEmail(email, password, displayName);
      } catch (err) {
        setError(getAuthErrorMessage(err));
        setLoading(false);
      }
    },
    []
  );

  const handleSignOut = useCallback(async () => {
    setError(null);
    try {
      await signOut();
    } catch (err) {
      setError(getAuthErrorMessage(err));
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    user,
    firebaseUser,
    loading,
    error,
    signInWithGoogle: handleSignInWithGoogle,
    signInWithEmail: handleSignInWithEmail,
    signUpWithEmail: handleSignUpWithEmail,
    signOut: handleSignOut,
    clearError,
  };
}
