'use client';

import { useState, useEffect, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { functions, db } from '@/lib/firebase';
import type {
  Session,
  SessionStatus,
  SessionSettings,
  SessionViewImage,
  ViewAngle,
  CreateSessionResponse,
  GetSessionResponse,
} from '@/types';

/**
 * Hook for managing a single session
 */
export function useSession(sessionId: string | null) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to session updates
  useEffect(() => {
    if (!sessionId || !db) {
      setSession(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const sessionRef = doc(db, 'sessions', sessionId);

    const unsubscribe = onSnapshot(
      sessionRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setSession({
            id: snapshot.id,
            userId: data.userId,
            status: data.status as SessionStatus,
            currentStep: data.currentStep,
            originalImage: data.originalImage,
            selectedAngles: data.selectedAngles || [],
            views: convertViews(data.views),
            settings: data.settings,
            jobId: data.jobId,
            outputModelUrl: data.outputModelUrl || null,
            viewGenerationCount: data.viewGenerationCount || 0,
            totalCreditsUsed: data.totalCreditsUsed || 0,
            createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
            updatedAt: (data.updatedAt as Timestamp)?.toDate() || new Date(),
          });
          setError(null);
        } else {
          setSession(null);
          setError('Session not found');
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching session:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [sessionId]);

  return { session, loading, error };
}

/**
 * Convert Firestore views object to typed Record
 */
function convertViews(
  views: Record<string, unknown> | undefined
): Record<ViewAngle, SessionViewImage> {
  if (!views) return {} as Record<ViewAngle, SessionViewImage>;

  const result: Partial<Record<ViewAngle, SessionViewImage>> = {};
  const angles: ViewAngle[] = ['front', 'back', 'left', 'right', 'top'];

  for (const angle of angles) {
    const view = views[angle] as {
      url: string;
      storagePath: string;
      source: 'ai' | 'upload';
      createdAt: Timestamp;
    } | undefined;

    if (view) {
      result[angle] = {
        url: view.url,
        storagePath: view.storagePath,
        source: view.source,
        createdAt: view.createdAt?.toDate?.() || new Date(),
      };
    }
  }

  return result as Record<ViewAngle, SessionViewImage>;
}

/**
 * Hook for session CRUD operations
 */
export function useSessionActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create a new session
  const createSession = useCallback(
    async (settings?: Partial<SessionSettings>): Promise<string | null> => {
      if (!functions) return null;

      setLoading(true);
      setError(null);

      try {
        const createSessionFn = httpsCallable<
          { settings?: Partial<SessionSettings> },
          CreateSessionResponse
        >(functions, 'createSession');

        const result = await createSessionFn({ settings });
        return result.data.sessionId;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create session';
        setError(message);
        console.error('Error creating session:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Update session data
  const updateSession = useCallback(
    async (data: {
      sessionId: string;
      originalImageUrl?: string;
      originalStoragePath?: string;
      selectedAngles?: ViewAngle[];
      settings?: Partial<SessionSettings>;
    }): Promise<boolean> => {
      if (!functions) return false;

      setLoading(true);
      setError(null);

      try {
        const updateSessionFn = httpsCallable<typeof data, { success: boolean }>(
          functions,
          'updateSession'
        );

        const result = await updateSessionFn(data);
        return result.data.success;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update session';
        setError(message);
        console.error('Error updating session:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Delete a session
  const deleteSession = useCallback(async (sessionId: string): Promise<boolean> => {
    if (!functions) return false;

    setLoading(true);
    setError(null);

    try {
      const deleteSessionFn = httpsCallable<{ sessionId: string }, { success: boolean }>(
        functions,
        'deleteSession'
      );

      const result = await deleteSessionFn({ sessionId });
      return result.data.success;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete session';
      setError(message);
      console.error('Error deleting session:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    createSession,
    updateSession,
    deleteSession,
    loading,
    error,
  };
}

/**
 * Hook for fetching user's sessions list
 */
export function useUserSessions(userId: string | undefined, options?: { limit?: number; status?: SessionStatus }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!userId || !functions) {
      setSessions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const getUserSessionsFn = httpsCallable<
        { limit?: number; status?: string },
        { sessions: Session[] }
      >(functions, 'getUserSessions');

      const result = await getUserSessionsFn({
        limit: options?.limit || 10,
        status: options?.status,
      });

      setSessions(result.data.sessions);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch sessions';
      setError(message);
      console.error('Error fetching sessions:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, options?.limit, options?.status]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return { sessions, loading, error, refetch: fetchSessions };
}
