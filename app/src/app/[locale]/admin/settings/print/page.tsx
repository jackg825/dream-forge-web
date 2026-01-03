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
import { Label } from '@/components/ui/label';
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
import type { MaterialConfig, SizeConfig, ColorOption, PrintMaterial, PrintSizeId } from '@/types/order';

function PrintSettingsContent() {
  const t = useTranslations('adminSettings');

  const { materials, sizes, colors, pricing, loading, refresh } = usePrintConfig();

  const [saving, setSaving] = useState(false);
  const [editedPricing, setEditedPricing] = useState<Record<PrintMaterial, Record<PrintSizeId, number>>>({} as any);

  // Initialize edited pricing from loaded config
  useEffect(() => {
    if (pricing && Object.keys(pricing).length > 0) {
      setEditedPricing(pricing);
    }
  }, [pricing]);

  const handlePricingChange = (material: PrintMaterial, size: PrintSizeId, value: string) => {
    const cents = Math.round(parseFloat(value) * 100) || 0;
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
    try {
      const updatePricingFn = httpsCallable<{ pricing: typeof editedPricing }, { success: boolean }>(
        functions,
        'updatePricing'
      );
      await updatePricingFn({ pricing: editedPricing });
      await refresh();
    } catch (error) {
      console.error('Failed to save pricing:', error);
    } finally {
      setSaving(false);
    }
  };

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  if (loading) {
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
          <TabsList className="mb-6">
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

                <div className="mt-4 flex justify-end">
                  <Button onClick={handleSavePricing} disabled={saving}>
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {t('print.pricing.save')}
                  </Button>
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
