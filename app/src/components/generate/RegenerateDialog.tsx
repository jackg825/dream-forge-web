'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RefreshCw, Loader2 } from 'lucide-react';

interface RegenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewType: 'mesh' | 'texture';
  angle: string;
  onConfirm: (hint?: string) => void;
  loading?: boolean;
}

const ANGLE_LABELS: Record<string, string> = {
  front: '正面',
  back: '背面',
  left: '左側',
  right: '右側',
};

/**
 * RegenerateDialog - Modal for regenerating a single view with optional hint
 *
 * Allows users to provide additional instructions when regenerating
 * a specific view (mesh or texture) at a specific angle.
 */
export function RegenerateDialog({
  open,
  onOpenChange,
  viewType,
  angle,
  onConfirm,
  loading = false,
}: RegenerateDialogProps) {
  const [hint, setHint] = useState('');

  const handleConfirm = () => {
    onConfirm(hint.trim() || undefined);
    setHint('');
  };

  const handleClose = () => {
    setHint('');
    onOpenChange(false);
  };

  const angleLabel = ANGLE_LABELS[angle] || angle;
  const typeLabel = viewType === 'mesh' ? '網格' : '貼圖';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>重新生成 {angleLabel} {typeLabel} 視圖</DialogTitle>
          <DialogDescription>
            您可以提供額外指示來調整生成結果，或留空直接重新生成。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="regenerate-hint">額外指示（可選）</Label>
            <Input
              id="regenerate-hint"
              placeholder="例如：「耳朵要更明顯」或「保持原本的顏色」"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              maxLength={100}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              {hint.length}/100 字元
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                重新生成
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
