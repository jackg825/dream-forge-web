'use client';

/**
 * Admin Orders Page
 *
 * Order management dashboard with Kanban and List views
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdminGuard } from '@/components/auth/AdminGuard';
import { AdminHeader } from '@/components/layout/headers';
import { useAdminOrders } from '@/hooks/useOrders';
import { OrderKanban, OrderList, OrderDetailPanel } from '@/components/admin/orders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  LayoutGrid,
  List,
  Package,
  DollarSign,
  Users,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import type { AdminOrder, OrderStatus, UpdateOrderStatusRequest } from '@/types/order';

function AdminOrdersContent() {
  const t = useTranslations('adminOrders');

  const {
    orders,
    loading,
    fetchOrders,
    fetchStats,
    stats,
    updateOrderStatus,
    updateTracking,
    updatingStatus,
    updatingTracking,
  } = useAdminOrders();

  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // Fetch data on mount
  useEffect(() => {
    fetchOrders();
    fetchStats();
  }, [fetchOrders, fetchStats]);

  const handleSelectOrder = (order: AdminOrder) => {
    setSelectedOrder(order);
    setShowDetail(true);
  };

  const handleCloseDetail = () => {
    setShowDetail(false);
    setSelectedOrder(null);
  };

  const handleUpdateStatus = async (request: UpdateOrderStatusRequest) => {
    const result = await updateOrderStatus(request);
    if (result) {
      // Refresh orders and close panel
      await fetchOrders();
      await fetchStats();
      handleCloseDetail();
    }
  };

  const handleUpdateTracking = async (
    orderId: string,
    tracking: { carrier: string; trackingNumber: string; trackingUrl?: string }
  ) => {
    const result = await updateTracking(orderId, tracking);
    if (result) {
      await fetchOrders();
      handleCloseDetail();
    }
  };

  const handleQuickStatusUpdate = async (orderId: string, status: OrderStatus) => {
    await handleUpdateStatus({ orderId, newStatus: status });
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AdminHeader />

      <main className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('title')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {t('subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchOrders();
                fetchStats();
              }}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">{t('refresh')}</span>
            </Button>
          </div>
        </div>

        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {/* Today's orders */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('stats.todayOrders')}</p>
                    <p className="text-3xl font-bold">{stats.daily.orders}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Today's revenue */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('stats.todayRevenue')}</p>
                    <p className="text-3xl font-bold">{formatPrice(stats.daily.revenue)}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Weekly orders */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('stats.weeklyOrders')}</p>
                    <p className="text-3xl font-bold">{stats.weekly.totalOrders}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* New customers today */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('stats.newCustomers')}</p>
                    <p className="text-3xl font-bold">{stats.daily.newCustomers}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                    <Users className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Status summary */}
        {stats && (
          <div className="flex flex-wrap gap-2 mb-6">
            {Object.entries(stats.statusCounts).map(([status, count]) => (
              <Badge key={status} variant="outline" className="text-sm">
                {t(`status.${status}`)}: {count}
              </Badge>
            ))}
          </div>
        )}

        {/* View toggle and orders */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'kanban' | 'list')}>
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="kanban" className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                {t('viewMode.kanban')}
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-2">
                <List className="h-4 w-4" />
                {t('viewMode.list')}
              </TabsTrigger>
            </TabsList>

            <Badge variant="secondary">
              {orders.length} {t('ordersCount')}
            </Badge>
          </div>

          <TabsContent value="kanban" className="mt-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <OrderKanban
                orders={orders}
                onSelectOrder={handleSelectOrder}
                selectedOrderId={selectedOrder?.id}
              />
            )}
          </TabsContent>

          <TabsContent value="list" className="mt-0">
            <Card>
              <CardContent className="p-0">
                <OrderList
                  orders={orders}
                  loading={loading}
                  onSelectOrder={handleSelectOrder}
                  onUpdateStatus={handleQuickStatusUpdate}
                  selectedOrderId={selectedOrder?.id}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Order Detail Panel */}
      <OrderDetailPanel
        order={selectedOrder}
        open={showDetail}
        onClose={handleCloseDetail}
        onUpdateStatus={handleUpdateStatus}
        onUpdateTracking={handleUpdateTracking}
        updating={updatingStatus || updatingTracking}
      />
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <AdminGuard>
      <AdminOrdersContent />
    </AdminGuard>
  );
}
