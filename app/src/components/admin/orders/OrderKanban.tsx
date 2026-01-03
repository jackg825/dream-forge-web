'use client';

/**
 * Order Kanban Board
 *
 * Displays orders in a kanban-style board grouped by status
 */

import { useTranslations } from 'next-intl';
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
} from 'lucide-react';
import type { AdminOrder, OrderStatus } from '@/types/order';
import { ORDER_STATUS_LABELS } from '@/types/order';

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
];

export function OrderKanban({ orders, onSelectOrder, selectedOrderId }: OrderKanbanProps) {
  const t = useTranslations('adminOrders');

  // Group orders by status
  const ordersByStatus = KANBAN_COLUMNS.reduce((acc, col) => {
    acc[col.status] = orders.filter((o) => o.status === col.status);
    return acc;
  }, {} as Record<OrderStatus, AdminOrder[]>);

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-TW', {
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
                    {ORDER_STATUS_LABELS[column.status]}
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
  formatPrice: (cents: number) => string;
  formatDate: (dateStr: string) => string;
}

function OrderKanbanCard({ order, onClick, isSelected, formatPrice, formatDate }: OrderKanbanCardProps) {
  const thumbnail = order.items[0]?.modelThumbnail;

  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg bg-card border cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
    >
      <div className="flex gap-3">
        {/* Thumbnail */}
        {thumbnail ? (
          <img
            src={thumbnail}
            alt=""
            className="w-12 h-12 rounded object-cover flex-shrink-0"
          />
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
              {formatPrice(order.payment.totalAmount)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {order.userDisplayName || order.userEmail}
          </p>
          <p className="text-xs text-muted-foreground">
            {order.items.length} item{order.items.length > 1 ? 's' : ''} · {formatDate(order.createdAt)}
          </p>
        </div>
      </div>
    </div>
  );
}
