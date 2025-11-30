'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, Sparkles, Eye, Box, Image, ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

// Step definitions matching CreateStepper
const STEPS = [
  { id: 1, key: 'upload', icon: Upload },
  { id: 2, key: 'views', icon: Sparkles },
  { id: 3, key: 'preview', icon: Eye },
  { id: 4, key: 'generate', icon: Box },
  { id: 5, key: 'result', icon: Image },
] as const;

interface AdvancedFlowPreviewProps {
  user: User | null;
  className?: string;
}

/**
 * AdvancedFlowPreview - Preview card for the advanced 5-step flow
 * Shows flow diagram, benefits, and link to /create
 */
export function AdvancedFlowPreview({ user, className }: AdvancedFlowPreviewProps) {
  const t = useTranslations();

  const benefits = [
    t('home.advancedPreview.benefit1'),
    t('home.advancedPreview.benefit2'),
    t('home.advancedPreview.benefit3'),
  ];

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="pt-6 space-y-6">
        {/* Title */}
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">
            {t('home.advancedPreview.title')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t('home.advancedPreview.description')}
          </p>
        </div>

        {/* 5-step flow diagram */}
        <div className="flex items-center justify-center gap-1 md:gap-2 py-4 overflow-x-auto">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.id} className="flex items-center">
                {/* Step circle */}
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-primary/30 bg-primary/5 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="mt-1 text-xs text-muted-foreground whitespace-nowrap">
                    {t(`create.steps.${step.key}`)}
                  </span>
                </div>

                {/* Arrow between steps */}
                {index < STEPS.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground/50 mx-1 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {/* Benefits list */}
        <div className="space-y-2 bg-muted/50 rounded-lg p-4">
          {benefits.map((benefit, index) => (
            <div key={index} className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-muted-foreground">{benefit}</span>
            </div>
          ))}
        </div>

        {/* Start button */}
        <Link href={user ? '/create' : '/auth?redirect=/create'} className="block">
          <Button
            size="lg"
            variant="outline"
            className="w-full border-primary/30 hover:bg-primary/5 hover:border-primary"
          >
            <Sparkles className="mr-2 h-5 w-5" />
            {t('home.advancedPreview.startButton')}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
