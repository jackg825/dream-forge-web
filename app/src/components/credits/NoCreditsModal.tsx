'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, X, Coins } from 'lucide-react';

interface NoCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NoCreditsModal({ isOpen, onClose }: NoCreditsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 dark:bg-black/70 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <Card className="relative w-full max-w-md shadow-xl">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute right-2 top-2 h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>

          <CardHeader className="text-center pt-8">
            <div className="mx-auto w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mb-4">
              <Coins className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
            </div>
            <CardTitle>No Credits Remaining</CardTitle>
          </CardHeader>

          <CardContent className="text-center">
            <p className="text-muted-foreground mb-6">
              You've used all your free credits. Each 3D model generation requires 1 credit.
            </p>

            {/* Coming soon notice */}
            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Coming soon:</span> Purchase additional credits to continue generating 3D models.
              </p>
            </div>
          </CardContent>

          <CardFooter>
            <Button onClick={onClose} className="w-full">
              Got it
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
