'use client';

/**
 * Admin Print Settings Page
 *
 * Configure print materials, sizes, colors, and pricing
 */

import { useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AdminGuard } from '@/components/auth/AdminGuard';
import { AdminHeader } from '@/components/layout/headers';
import { usePrintConfig } from '@/hooks/useOrders';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Loader2,
  Save,
  RefreshCw,
  Palette,
  Ruler,
  Package,
  DollarSign,
} from 'lucide-react';
import type { PrintMaterial, PrintSizeId } from '@/types/order';
import { createPricingDraft, parsePrintPrice, parsePricingDraft, type PricingDraft } from '@/lib/print-pricing';

function PrintSettingsContent() {
  const t = useTranslations('adminSettings');

  const locale = useLocale();
  const { materials, sizes, colors, pricing, loading, error, refresh } = usePrintConfig(true);

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveResult, setSaveResult] = useState<'success' | 'error' | null>(null);
  const [draft, setDraft] = useState<PricingDraft | null>(null);
  const editedPricing = draft ?? createPricingDraft(pricing);
  const parsedPricing = parsePricingDraft(editedPricing, materials.map(({ id }) => id), sizes.map(({ id }) => id));
  const hasChanges = draft !== null;

  const handlePricingChange = (material: PrintMaterial, size: PrintSizeId, value: string) => {
    setSaveResult(null);
    setDraft((prev) => {
      const current = prev ?? createPricingDraft(pricing);
      return { ...current, [material]: { ...current[material], [size]: value } };
    });
  };

  const handleSavePricing = async () => {
    if (!parsedPricing || savingRef.current || loading || error || !hasChanges) return;
    if (!functions) {
      setSaveResult('error');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setSaveResult(null);
    try {
      const updatePricingFn = httpsCallable<{ pricing: typeof parsedPricing }, { success: boolean }>(
        functions,
        'updatePricing'
      );
      const result = await updatePricingFn({ pricing: parsedPricing });
      if (!result.data.success) throw new Error('Pricing update failed');
      // Preserve the submitted values if the subsequent read fails.
      if (await refresh()) setDraft(null);
      setSaveResult('success');
    } catch (error) {
      console.error('Failed to save pricing:', error);
      setSaveResult('error');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (loading && materials.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <AdminHeader />
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AdminHeader />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('print.title')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {t('print.subtitle')}
            </p>
          </div>

          <Button variant="outline" size="sm" onClick={() => { void refresh(); }} disabled={loading || saving || hasChanges}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">{t('print.refresh')}</span>
          </Button>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-md border border-destructive p-4 text-sm text-destructive">
            {t('print.loadError')}
            <Button className="ml-2" variant="outline" size="sm" disabled={loading || saving} onClick={() => { void refresh(); }}>
              {t('print.refresh')}
            </Button>
          </div>
        )}

        <Tabs defaultValue="pricing">
          <TabsList className="mb-6 h-auto w-full flex-wrap sm:w-fit">
            <TabsTrigger value="pricing" className="gap-2">
              <DollarSign className="h-4 w-4" />
              {t('print.tabs.pricing')}
            </TabsTrigger>
            <TabsTrigger value="materials" className="gap-2">
              <Package className="h-4 w-4" />
              {t('print.tabs.materials')}
            </TabsTrigger>
            <TabsTrigger value="sizes" className="gap-2">
              <Ruler className="h-4 w-4" />
              {t('print.tabs.sizes')}
            </TabsTrigger>
            <TabsTrigger value="colors" className="gap-2">
              <Palette className="h-4 w-4" />
              {t('print.tabs.colors')}
            </TabsTrigger>
          </TabsList>

          {/* Pricing Tab */}
          <TabsContent value="pricing">
            <Card>
              <CardHeader>
                <CardTitle>{t('print.pricing.title')}</CardTitle>
                <CardDescription>{t('print.pricing.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('print.pricing.material')}</TableHead>
                        {sizes.map((size) => (
                          <TableHead key={size.id} className="text-center">
                            {locale === 'zh-TW' ? size.displayNameZh : size.displayName}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {materials.map((material) => (
                        <TableRow key={material.id}>
                          <TableCell className="font-medium whitespace-nowrap">
                            {locale === 'zh-TW' ? material.nameZh : material.name}
                          </TableCell>
                          {sizes.map((size) => (
                            <TableCell key={size.id} className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-muted-foreground">$</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="1000000"
                                  inputMode="decimal"
                                  aria-label={`${locale === 'zh-TW' ? material.nameZh : material.name} ${locale === 'zh-TW' ? size.displayNameZh : size.displayName}`}
                                  aria-invalid={parsePrintPrice(editedPricing[material.id]?.[size.id] ?? '') === null}
                                  aria-describedby={hasChanges && !parsedPricing ? 'pricing-validation' : undefined}
                                  disabled={saving || loading || !!error}
                                  value={editedPricing[material.id]?.[size.id] ?? ''}
                                  onChange={(e) => handlePricingChange(material.id, size.id, e.target.value)}
                                  className="w-24 text-center"
                                />
                              </div>
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-4 flex flex-col items-end gap-2">
                  {hasChanges && !parsedPricing && (
                    <p id="pricing-validation" role="alert" className="text-sm text-destructive">{t('print.pricing.invalid')}</p>
                  )}
                  {hasChanges && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{t('print.pricing.unsaved')}</span>
                      <Button variant="outline" size="sm" disabled={saving || loading} onClick={() => { setDraft(null); setSaveResult(null); }}>
                        {t('print.pricing.discard')}
                      </Button>
                    </div>
                  )}
                  <Button onClick={handleSavePricing} disabled={saving || loading || !!error || !hasChanges || !parsedPricing}>
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {t('print.pricing.save')}
                  </Button>
                  {saveResult && (
                    <p
                      className={saveResult === 'success' ? 'text-sm text-green-700 dark:text-green-400' : 'text-sm text-destructive'}
                      role={saveResult === 'error' ? 'alert' : 'status'}
                    >
                      {t(`print.pricing.${saveResult}`)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Materials Tab */}
          <TabsContent value="materials">
            <Card>
              <CardHeader>
                <CardTitle>{t('print.materials.title')}</CardTitle>
                <CardDescription>{t('print.materials.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('print.materials.name')}</TableHead>
                        <TableHead>{t('print.materials.descriptionLabel')}</TableHead>
                        <TableHead className="text-center">{t('print.materials.maxColors')}</TableHead>
                        <TableHead className="text-center">{t('print.materials.estimatedDays')}</TableHead>
                        <TableHead className="text-center">{t('print.materials.available')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {materials.map((material) => (
                        <TableRow key={material.id}>
                          <TableCell className="font-medium whitespace-nowrap">
                            <div>
                              <p>{locale === 'zh-TW' ? material.nameZh : material.name}</p>
                              <p className="text-sm text-muted-foreground">{material.nameZh}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm">{locale === 'zh-TW' ? material.descriptionZh : material.description}</p>
                          </TableCell>
                          <TableCell className="text-center">{material.maxColors}</TableCell>
                          <TableCell className="text-center">{t('print.materials.days', { count: material.estimatedDays })}</TableCell>
                          <TableCell className="text-center">
                            <Switch checked={material.available} disabled aria-label={`${material.name} ${t('print.materials.available')}`} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  {t('print.materials.editNote')}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sizes Tab */}
          <TabsContent value="sizes">
            <Card>
              <CardHeader>
                <CardTitle>{t('print.sizes.title')}</CardTitle>
                <CardDescription>{t('print.sizes.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('print.sizes.name')}</TableHead>
                        <TableHead>{t('print.sizes.dimensions')}</TableHead>
                        <TableHead className="text-center">{t('print.sizes.available')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sizes.map((size) => (
                        <TableRow key={size.id}>
                          <TableCell className="font-medium whitespace-nowrap">
                            <div>
                              <p>{locale === 'zh-TW' ? size.displayNameZh : size.displayName}</p>
                              <p className="text-sm text-muted-foreground">{size.displayNameZh}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {size.dimensions.x} × {size.dimensions.y} × {size.dimensions.z} cm
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch checked={size.available} disabled aria-label={`${size.displayName} ${t('print.sizes.available')}`} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  {t('print.sizes.editNote')}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Colors Tab */}
          <TabsContent value="colors">
            <Card>
              <CardHeader>
                <CardTitle>{t('print.colors.title')}</CardTitle>
                <CardDescription>{t('print.colors.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {colors.map((color) => (
                    <div
                      key={color.id}
                      className={`p-4 rounded-lg border ${color.available ? '' : 'opacity-50'}`}
                    >
                      <div
                        className="w-full h-12 rounded-md border mb-2"
                        style={{ backgroundColor: color.hex }}
                      />
                      <p className="text-sm font-medium">{color.name}</p>
                      <p className="text-xs text-muted-foreground">{color.nameZh}</p>
                      <p className="text-xs text-muted-foreground mt-1">{color.hex}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  {t('print.colors.editNote')}
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default function PrintSettingsPage() {
  return (
    <AdminGuard>
      <PrintSettingsContent />
    </AdminGuard>
  );
}
