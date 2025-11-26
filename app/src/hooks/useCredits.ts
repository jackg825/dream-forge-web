'use client';

import { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface UseCreditsReturn {
  credits: number;
  loading: boolean;
  hasCredits: boolean;
  lowCredits: boolean;
}

/**
 * Hook for managing user credits with real-time updates
 */
export function useCredits(userId: string | undefined): UseCreditsReturn {
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !db) {
      setCredits(0);
      setLoading(false);
      return;
    }

    const userRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(
      userRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setCredits(docSnap.data().credits || 0);
        } else {
          setCredits(0);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching credits:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  const hasCredits = useMemo(() => credits > 0, [credits]);
  const lowCredits = useMemo(() => credits > 0 && credits < 2, [credits]);

  return { credits, loading, hasCredits, lowCredits };
}
