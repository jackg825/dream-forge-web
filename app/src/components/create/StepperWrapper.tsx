'use client';

import { useSearchParams } from 'next/navigation';
import { CreateStepper } from './CreateStepper';
import { useSession } from '@/hooks/useSession';

/**
 * StepperWrapper - Fetches session data and passes to CreateStepper
 *
 * This wrapper exists because the layout can't directly access searchParams
 * in a server component context.
 */
export function StepperWrapper() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const { session } = useSession(sessionId);

  return (
    <CreateStepper
      sessionId={sessionId}
      sessionStatus={session?.status}
      className="mb-6"
    />
  );
}
