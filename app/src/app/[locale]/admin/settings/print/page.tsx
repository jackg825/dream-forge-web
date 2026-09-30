'use client';

/**
 * Admin Print Settings Page
 *
 * Configure print materials, sizes, colors, and pricing
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
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

const EMPTY_PRICING = {} as Record<PrintMaterial, Record<PrintSizeId, number>>;

function PrintSettingsContent() {
  const t = useTranslations('adminSettings');

  const { materials, sizes, colors, pricing, loading, refresh } = usePrintConfig();

  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<'success' | 'error' | null>(null);
  const [editedPricing, setEditedPricing] = useState<Record<PrintMaterial, Record<PrintSizeId, number>>>(EMPTY_PRICING);

  // Initialize edited pricing from loaded config
  useEffect(() => {
    if (pricing && Object.keys(pricing).length > 0) {
      setEditedPricing(structuredClone(pricing));
    }
  }, [pricing]);

  const handlePricingChange = (material: PrintMaterial, size: PrintSizeId, value: string) => {
    const cents = Math.round(parseFloat(value) * 100) || 0;
    setSaveResult(null);
    setEditedPricing((prev) => ({
      ...prev,
      [material]: {
        ...prev[material],
        [size]: cents,
      },
    }));
  };

  const handleSavePricing = async () => {
    if (!functions) return;

    setSaving(true);
    setSaveResult(null);
    try {
      const updatePricingFn = httpsCallable<{ pricing: typeof editedPricing }, { success: boolean }>(
        functions,
        'updatePricing'
      );
      await updatePricingFn({ pricing: editedPricing });
      await refresh();
      setSaveResult('success');
    } catch (error) {
      console.error('Failed to save pricing:', error);
      setSaveResult('error');
    } finally {
      setSaving(false);
    }
  };

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AdminHeader />
        <main className="studio-shell">
          <div className="store-card flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />

      <main className="studio-shell">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-10">
          <div>
            <h1 className="studio-page-title">
              {t('print.title')}
            </h1>
            <p className="studio-page-subtitle">
              {t('print.subtitle')}
            </p>
          </div>

          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">{t('print.refresh')}</span>
          </Button>
        </div>

        <Tabs defaultValue="pricing">
          <TabsList className="mb-8 h-auto flex-wrap rounded-2xl p-1.5">
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
            <Card className="overflow-hidden border-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl">{t('print.pricing.title')}</CardTitle>
                <CardDescription>{t('print.pricing.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-2xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('print.pricing.material')}</TableHead>
                        {sizes.map((size) => (
                          <TableHead key={size.id} className="text-center">
                            {size.displayName}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {materials.map((material) => (
                        <TableRow key={material.id}>
                          <TableCell className="font-medium">
                            {material.name}
                          </TableCell>
                          {sizes.map((size) => (
                            <TableCell key={size.id} className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-muted-foreground">$</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={formatPrice(editedPricing[material.id]?.[size.id] || 0)}
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
                  <Button onClick={handleSavePricing} disabled={saving}>
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
            <Card className="overflow-hidden border-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl">{t('print.materials.title')}</CardTitle>
                <CardDescription>{t('print.materials.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-2xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('print.materials.name')}</TableHead>
                        <TableHead>{t('print.materials.description')}</TableHead>
                        <TableHead className="text-center">{t('print.materials.maxColors')}</TableHead>
                        <TableHead className="text-center">{t('print.materials.estimatedDays')}</TableHead>
                        <TableHead className="text-center">{t('print.materials.available')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {materials.map((material) => (
                        <TableRow key={material.id}>
                          <TableCell className="font-medium">
                            <div>
                              <p>{material.name}</p>
                              <p className="text-sm text-muted-foreground">{material.nameZh}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm">{material.description}</p>
                          </TableCell>
                          <TableCell className="text-center">{material.maxColors}</TableCell>
                          <TableCell className="text-center">{material.estimatedDays} days</TableCell>
                          <TableCell className="text-center">
                            <Switch checked={material.available} disabled />
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
            <Card className="overflow-hidden border-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl">{t('print.sizes.title')}</CardTitle>
                <CardDescription>{t('print.sizes.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-2xl border border-border">
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
                          <TableCell className="font-medium">
                            <div>
                              <p>{size.displayName}</p>
                              <p className="text-sm text-muted-foreground">{size.displayNameZh}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {size.dimensions.x} × {size.dimensions.y} × {size.dimensions.z} cm
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch checked={size.available} disabled />
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
            <Card className="overflow-hidden border-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl">{t('print.colors.title')}</CardTitle>
                <CardDescription>{t('print.colors.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {colors.map((color) => (
                    <div
                      key={color.id}
                      className={`p-4 rounded-2xl border border-border ${color.available ? '' : 'opacity-50'}`}
                    >
                      <div
                        className="w-full h-12 overflow-hidden rounded-2xl border border-border mb-2"
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
