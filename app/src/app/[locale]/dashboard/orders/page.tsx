'use client';

/**
 * My Orders Page
 *
 * Displays user's print orders with filtering and pagination
 */

import { useState, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { UserHeader } from '@/components/layout/headers';
import { useUserOrders } from '@/hooks/useOrders';
import { Link } from '@/i18n/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Package,
  Loader2,
  ArrowRight,
  Clock,
  Printer,
  Truck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import type { Order, OrderStatus } from '@/types/order';
import { ORDER_STATUS_LABELS } from '@/types/order';

type FilterStatus = 'all' | 'active' | 'completed' | 'cancelled';

const ITEMS_PER_PAGE = 10;

function OrdersContent() {
  const t = useTranslations('orders');
  const { orders, loading, fetchOrders, pagination } = useUserOrders();

  const [filter, setFilter] = useState<FilterStatus>('all');
  const [page, setPage] = useState(1);

  // Load orders on mount
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    if (filter === 'all') return orders;
    if (filter === 'active') {
      return orders.filter((o) =>
        ['pending', 'confirmed', 'printing', 'quality_check', 'shipping'].includes(o.status)
      );
    }
    if (filter === 'completed') {
      return orders.filter((o) => o.status === 'delivered');
    }
    return orders.filter((o) => ['cancelled', 'refunded'].includes(o.status));
  }, [orders, filter]);

  // Paginate
  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOrders, page]);

  // Status counts
  const statusCounts = useMemo(() => {
    return {
      all: orders.length,
      active: orders.filter((o) =>
        ['pending', 'confirmed', 'printing', 'quality_check', 'shipping'].includes(o.status)
      ).length,
      completed: orders.filter((o) => o.status === 'delivered').length,
      cancelled: orders.filter((o) => ['cancelled', 'refunded'].includes(o.status)).length,
    };
  }, [orders]);

  const handleFilterChange = (newFilter: FilterStatus) => {
    setFilter(newFilter);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-background">
      <UserHeader />

      <main className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('myOrders.title')}</h1>
            <p className="text-muted-foreground">{t('myOrders.subtitle')}</p>
          </div>
        </div>

        {/* Status filters */}
        <Tabs value={filter} onValueChange={(v) => handleFilterChange(v as FilterStatus)} className="mb-6">
          <TabsList>
            <TabsTrigger value="all" className="gap-2">
              {t('myOrders.filter.all')}
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full px-1.5">
                {statusCounts.all}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="active" className="gap-2">
              {t('myOrders.filter.active')}
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full px-1.5">
                {statusCounts.active}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-2">
              {t('myOrders.filter.completed')}
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full px-1.5">
                {statusCounts.completed}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="gap-2">
              {t('myOrders.filter.cancelled')}
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full px-1.5">
                {statusCounts.cancelled}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Orders list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : paginatedOrders.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium mb-1">
                {filter === 'all' ? t('myOrders.noOrders') : t('myOrders.noOrdersFiltered')}
              </h3>
              <p className="text-muted-foreground mb-4">
                {filter === 'all' ? t('myOrders.startOrdering') : t('myOrders.tryAdjustingFilter')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-4">
              {paginatedOrders.map((order) => (
                <OrderListItem key={order.id} order={order} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  {t('myOrders.pagination.previous')}
                </Button>

                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <Button
                      key={p}
                      variant={p === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPage(p)}
                      className="w-9"
                    >
                      {p}
                    </Button>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  {t('myOrders.pagination.next')}
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function OrderListItem({ order }: { order: Order }) {
  const t = useTranslations('orders');

  // Status icon and color
  const getStatusConfig = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10' };
      case 'confirmed':
        return { icon: CheckCircle2, color: 'text-blue-500', bg: 'bg-blue-500/10' };
      case 'printing':
        return { icon: Printer, color: 'text-purple-500', bg: 'bg-purple-500/10' };
      case 'quality_check':
        return { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-500/10' };
      case 'shipping':
        return { icon: Truck, color: 'text-cyan-500', bg: 'bg-cyan-500/10' };
      case 'delivered':
        return { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10' };
      case 'cancelled':
      case 'refunded':
        return { icon: XCircle, color: 'text-gray-500', bg: 'bg-gray-500/10' };
      default:
        return { icon: Package, color: 'text-gray-500', bg: 'bg-gray-500/10' };
    }
  };

  const statusConfig = getStatusConfig(order.status);
  const StatusIcon = statusConfig.icon;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  // Get first item thumbnail
  const thumbnail = order.items[0]?.modelThumbnail;

  return (
    <Link
      href={`/dashboard/orders/details?id=${order.id}`}
      className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
    >
      {/* Thumbnail */}
      {thumbnail ? (
        <img
          src={thumbnail}
          alt=""
          className="w-16 h-16 rounded-md object-cover ring-1 ring-border bg-black"
        />
      ) : (
        <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center">
          <Package className="h-8 w-8 text-muted-foreground" />
        </div>
      )}

      {/* Order info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium">#{order.id.slice(-8).toUpperCase()}</span>
          <Badge variant="secondary" className={`${statusConfig.bg} ${statusConfig.color} border-0`}>
            <StatusIcon className="mr-1 h-3 w-3" />
            {ORDER_STATUS_LABELS[order.status]}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {order.items.length} {order.items.length === 1 ? t('myOrders.item') : t('myOrders.items')}
          {' · '}
          {formatDate(order.createdAt)}
        </p>
        {order.tracking && (
          <p className="text-sm text-muted-foreground mt-1">
            {t('myOrders.tracking')}: {order.tracking.carrier} {order.tracking.trackingNumber}
          </p>
        )}
      </div>

      {/* Total */}
      <div className="text-right">
        <p className="font-semibold">{formatPrice(order.payment.totalAmount)}</p>
        <p className="text-sm text-muted-foreground">{order.payment.currency}</p>
      </div>

      {/* Arrow */}
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

export default function OrdersPage() {
  return (
    <AuthGuard>
      <OrdersContent />
    </AuthGuard>
  );
}
