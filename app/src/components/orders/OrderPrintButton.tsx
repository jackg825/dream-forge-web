'use client';

/**
 * Order Print Button
 *
 * Button displayed on the model viewer to start the print order flow
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PrintOrderModal } from './PrintOrderModal';

interface OrderPrintButtonProps {
  pipelineId: string;
  modelUrl: string;
  modelThumbnail?: string;
  modelName?: string;
  disabled?: boolean;
}

export function OrderPrintButton({
  pipelineId,
  modelUrl,
  modelThumbnail,
  modelName,
  disabled = false,
}: OrderPrintButtonProps) {
  const t = useTranslations('orders');
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Button
        onClick={() => setShowModal(true)}
        disabled={disabled}
        className="gap-2"
      >
        <Printer className="h-4 w-4" />
        {t('orderPrint')}
      </Button>

      <PrintOrderModal
        open={showModal}
        onClose={() => setShowModal(false)}
        pipelineId={pipelineId}
        modelUrl={modelUrl}
        modelThumbnail={modelThumbnail}
        modelName={modelName}
      />
    </>
  );
}
