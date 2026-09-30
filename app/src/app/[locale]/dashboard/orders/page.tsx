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
import { FillImage } from '@/components/ui/fill-image';
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
  const { orders, loading, fetchOrders } = useUserOrders();

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

      <main className="studio-shell py-12 sm:py-16">
        {/* Page header */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between mb-10">
          <div>
            <h1 className="studio-page-title">{t('myOrders.title')}</h1>
            <p className="studio-page-subtitle">{t('myOrders.subtitle')}</p>
          </div>
        </div>

        {/* Status filters */}
        <Tabs value={filter} onValueChange={(v) => handleFilterChange(v as FilterStatus)} className="mb-8 overflow-x-auto pb-1">
          <TabsList className="h-11 min-w-max">
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
            <CardContent className="flex flex-col items-center justify-center px-5 py-20 text-center">
              <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-muted">
                <Package className="h-9 w-9 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <h3 className="mb-3 text-2xl font-semibold tracking-tight">
                {filter === 'all' ? t('myOrders.noOrders') : t('myOrders.noOrdersFiltered')}
              </h3>
              <p className="mb-6 max-w-md text-sm leading-relaxed text-muted-foreground">
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
              <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
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
        return { icon: Printer, color: 'text-primary', bg: 'bg-primary/10' };
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
      className="group flex flex-wrap items-center gap-4 rounded-[28px] bg-card p-5 shadow-[0_4px_24px_rgba(0,0,0,0.025)] transition-shadow hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] sm:gap-6 sm:p-7"
    >
      {/* Thumbnail */}
      {thumbnail ? (
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-muted">
          <FillImage
            src={thumbnail}
            alt=""
            className="object-cover"
            sizes="80px"
          />
        </div>
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-muted">
          <Package className="h-8 w-8 text-muted-foreground" />
        </div>
      )}

      {/* Order info */}
      <div className="flex-1 min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold tracking-tight">#{order.id.slice(-8).toUpperCase()}</span>
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
      <div className="ml-auto text-right">
        <p className="text-lg font-semibold tracking-tight">{formatPrice(order.payment.totalAmount)}</p>
        <p className="text-sm text-muted-foreground">{order.payment.currency}</p>
      </div>

      {/* Arrow */}
      <ArrowRight className="hidden h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 sm:block" />
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
