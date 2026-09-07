'use client';

/**
 * Order Kanban Board
 *
 * Displays orders in a kanban-style board grouped by status
 */

import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Clock,
  CheckCircle2,
  Printer,
  AlertTriangle,
  Truck,
  Package,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import type { AdminOrder, OrderStatus } from '@/types/order';
import { FillImage } from '@/components/ui/fill-image';

interface OrderKanbanProps {
  orders: AdminOrder[];
  onSelectOrder: (order: AdminOrder) => void;
  selectedOrderId?: string;
}

// Kanban columns configuration
const KANBAN_COLUMNS: {
  status: OrderStatus;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}[] = [
  { status: 'pending', icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-50 dark:bg-yellow-900/20' },
  { status: 'confirmed', icon: CheckCircle2, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-900/20' },
  { status: 'printing', icon: Printer, color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-900/20' },
  { status: 'quality_check', icon: AlertTriangle, color: 'text-orange-600', bgColor: 'bg-orange-50 dark:bg-orange-900/20' },
  { status: 'shipping', icon: Truck, color: 'text-cyan-600', bgColor: 'bg-cyan-50 dark:bg-cyan-900/20' },
  { status: 'delivered', icon: Package, color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-900/20' },
  { status: 'cancelled', icon: XCircle, color: 'text-gray-600', bgColor: 'bg-gray-50 dark:bg-gray-900/20' },
  { status: 'refunded', icon: RotateCcw, color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-900/20' },
];

export function OrderKanban({ orders, onSelectOrder, selectedOrderId }: OrderKanbanProps) {
  const t = useTranslations('adminOrders');
  const locale = useLocale();

  // Group orders by status
  const ordersByStatus = KANBAN_COLUMNS.reduce((acc, col) => {
    acc[col.status] = orders.filter((o) => o.status === col.status);
    return acc;
  }, {} as Record<OrderStatus, AdminOrder[]>);

  const formatPrice = (cents: number, currency: string) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(cents / 100);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {KANBAN_COLUMNS.map((column) => {
        const Icon = column.icon;
        const columnOrders = ordersByStatus[column.status] || [];

        return (
          <div key={column.status} className="flex-shrink-0 w-72">
            <Card className={column.bgColor}>
              <CardHeader className="py-3 px-4">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className={`flex items-center gap-2 ${column.color}`}>
                    <Icon className="h-4 w-4" />
                    {t(`status.${column.status}`)}
                  </span>
                  <Badge variant="secondary" className="ml-2">
                    {columnOrders.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <ScrollArea className="h-[calc(100vh-280px)]">
                  <div className="space-y-2 pr-2">
                    {columnOrders.length === 0 ? (
                      <div className="text-center py-4 text-sm text-muted-foreground">
                        {t('kanban.noOrders')}
                      </div>
                    ) : (
                      columnOrders.map((order) => (
                        <OrderKanbanCard
                          key={order.id}
                          order={order}
                          onClick={() => onSelectOrder(order)}
                          isSelected={selectedOrderId === order.id}
                          formatPrice={formatPrice}
                          formatDate={formatDate}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}

interface OrderKanbanCardProps {
  order: AdminOrder;
  onClick: () => void;
  isSelected: boolean;
  formatPrice: (cents: number, currency: string) => string;
  formatDate: (dateStr: string) => string;
}

function OrderKanbanCard({ order, onClick, isSelected, formatPrice, formatDate }: OrderKanbanCardProps) {
  const t = useTranslations('adminOrders');
  const thumbnail = order.items[0]?.modelThumbnail;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg bg-card border cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
    >
      <div className="flex gap-3">
        {/* Thumbnail */}
        {thumbnail ? (
          <div className="relative w-12 h-12 flex-shrink-0 overflow-hidden rounded">
            <FillImage
              src={thumbnail}
              alt=""
              className="object-cover"
              sizes="48px"
            />
          </div>
        ) : (
          <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
            <Package className="h-5 w-5 text-muted-foreground" />
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium truncate">
              #{order.id.slice(-6).toUpperCase()}
            </span>
            <span className="text-sm font-semibold text-primary">
              {formatPrice(order.payment.totalAmount, order.payment.currency)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {order.userDisplayName || order.userEmail}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('itemCount', { count: order.items.reduce((sum, item) => sum + item.quantity, 0) })} · {formatDate(order.createdAt)}
          </p>
        </div>
      </div>
    </button>
  );
}
