'use client';

/**
 * Admin Orders Page
 *
 * Order management dashboard with Kanban and List views
 */

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AdminGuard } from '@/components/auth/AdminGuard';
import { AdminHeader } from '@/components/layout/headers';
import { useAdminOrders } from '@/hooks/useOrders';
import { OrderKanban, OrderList, OrderDetailPanel } from '@/components/admin/orders';
import { Card, CardContent } from '@/components/ui/card';
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
import { ORDER_STATUS_TRANSITIONS } from '@/types/order';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AdminOrder, OrderStatus, UpdateOrderStatusRequest } from '@/types/order';

function AdminOrdersContent() {
  const t = useTranslations('adminOrders');
  const locale = useLocale();

  const {
    orders,
    loading,
    error,
    statsError,
    pagination,
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

  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [offset, setOffset] = useState(0);
  const [initialStatus, setInitialStatus] = useState<OrderStatus | ''>('');
  const pageSize = 50;
  const busy = loading || updatingStatus || updatingTracking;
  const refreshOrders = useCallback(() => fetchOrders({
    status: statusFilter === 'all' ? undefined : statusFilter,
    limit: pageSize,
    offset,
  }), [fetchOrders, statusFilter, offset]);

  useEffect(() => { refreshOrders(); }, [refreshOrders]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleSelectOrder = (order: AdminOrder) => {
    if (busy) return;
    setInitialStatus('');
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
      handleCloseDetail();
      await Promise.all([refreshOrders(), fetchStats()]);
    }
    return Boolean(result);
  };

  const handleUpdateTracking = async (
    orderId: string,
    tracking: { carrier: string; trackingNumber: string; trackingUrl?: string }
  ) => {
    const result = await updateTracking(orderId, tracking);
    if (result) {
      handleCloseDetail();
      await refreshOrders();
    }
    return Boolean(result);
  };

  const handleQuickStatusUpdate = async (orderId: string, status: OrderStatus) => {
    if (status === 'shipping' || status === 'cancelled') {
      const order = orders.find((item) => item.id === orderId);
      if (order) {
        handleSelectOrder(order);
        setInitialStatus(status);
      }
      return;
    }
    await handleUpdateStatus({ orderId, newStatus: status });
  };

  const formatPrice = (cents: number, currency: string) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
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
                refreshOrders();
                fetchStats();
              }}
              disabled={busy}
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

        {(error || statsError) && (
          <div role="alert" className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error || statsError}
          </div>
        )}

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
                    <div className="text-2xl font-bold">
                      {stats.daily.revenueByCurrency
                        ? Object.keys(stats.daily.revenueByCurrency).length
                          ? Object.entries(stats.daily.revenueByCurrency).map(([currency, amount]) => (
                            <p key={currency}>{formatPrice(amount, currency)}</p>
                          ))
                          : <p>{t('stats.noPaidOrders')}</p>
                        : <p className="text-sm">{t('stats.revenueUnavailable')}</p>}
                    </div>
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
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
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

            <div className="flex flex-wrap items-center gap-3">
              <Select value={statusFilter} disabled={busy} onValueChange={(value) => {
                setStatusFilter(value as OrderStatus | 'all');
                setOffset(0);
              }}>
                <SelectTrigger className="w-44" aria-label={t('filterStatus')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allStatuses')}</SelectItem>
                  {Object.keys(ORDER_STATUS_TRANSITIONS).map((status) => (
                    <SelectItem key={status} value={status}>{t(`status.${status}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="secondary">{pagination?.total ?? orders.length} {t('ordersCount')}</Badge>
            </div>
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
                  updating={updatingStatus || updatingTracking}
                  onSelectOrder={handleSelectOrder}
                  onUpdateStatus={handleQuickStatusUpdate}
                  selectedOrderId={selectedOrder?.id}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        {pagination && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {t('pageSummary', { start: orders.length ? pagination.offset + 1 : 0,
                end: orders.length ? pagination.offset + orders.length : 0, total: pagination.total })}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" disabled={busy || offset === 0}
                onClick={() => setOffset(Math.max(0, offset - pageSize))}>{t('previousPage')}</Button>
              <Button variant="outline" disabled={busy || !pagination.hasMore}
                onClick={() => setOffset(offset + pageSize)}>{t('nextPage')}</Button>
            </div>
          </div>
        )}
      </main>

      {/* Order Detail Panel */}
      <OrderDetailPanel
        key={selectedOrder?.id || 'closed'}
        initialStatus={initialStatus}
        error={error}
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
