'use client';

/**
 * Order List Table
 *
 * Displays orders in a sortable, filterable table format
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Package,
  MoreHorizontal,
  Eye,
  Printer,
  Truck,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import type { AdminOrder, OrderStatus } from '@/types/order';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/types/order';

interface OrderListProps {
  orders: AdminOrder[];
  loading?: boolean;
  onSelectOrder: (order: AdminOrder) => void;
  onUpdateStatus?: (orderId: string, status: OrderStatus) => void;
  selectedOrderId?: string;
}

export function OrderList({
  orders,
  loading,
  onSelectOrder,
  onUpdateStatus,
  selectedOrderId,
}: OrderListProps) {
  const t = useTranslations('adminOrders');

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadgeClass = (status: OrderStatus) => {
    const colorMap: Record<string, string> = {
      yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      cyan: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
      green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      gray: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    };
    return colorMap[ORDER_STATUS_COLORS[status]] || colorMap.gray;
  };

  // Quick status actions based on current status
  const getQuickActions = (order: AdminOrder) => {
    const actions: { label: string; status: OrderStatus; icon: React.ComponentType<{ className?: string }> }[] = [];

    switch (order.status) {
      case 'pending':
        actions.push({ label: t('actions.confirm'), status: 'confirmed', icon: CheckCircle });
        actions.push({ label: t('actions.cancel'), status: 'cancelled', icon: XCircle });
        break;
      case 'confirmed':
        actions.push({ label: t('actions.startPrinting'), status: 'printing', icon: Printer });
        break;
      case 'printing':
        actions.push({ label: t('actions.qualityCheck'), status: 'quality_check', icon: CheckCircle });
        break;
      case 'quality_check':
        actions.push({ label: t('actions.ship'), status: 'shipping', icon: Truck });
        break;
      case 'shipping':
        actions.push({ label: t('actions.delivered'), status: 'delivered', icon: Package });
        break;
    }

    return actions;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {t('list.noOrders')}
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">{t('list.orderId')}</TableHead>
            <TableHead>{t('list.customer')}</TableHead>
            <TableHead>{t('list.items')}</TableHead>
            <TableHead>{t('list.status')}</TableHead>
            <TableHead>{t('list.total')}</TableHead>
            <TableHead>{t('list.date')}</TableHead>
            <TableHead className="w-[100px] text-right">{t('list.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const quickActions = getQuickActions(order);
            const thumbnail = order.items[0]?.modelThumbnail;

            return (
              <TableRow
                key={order.id}
                className={`cursor-pointer ${selectedOrderId === order.id ? 'bg-accent' : ''}`}
                onClick={() => onSelectOrder(order)}
              >
                <TableCell className="font-mono text-sm">
                  #{order.id.slice(-6).toUpperCase()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {order.userPhotoURL ? (
                      <img
                        src={order.userPhotoURL}
                        alt=""
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-xs font-medium">
                          {order.userDisplayName?.[0] || '?'}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium">{order.userDisplayName || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{order.userEmail}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt=""
                        className="w-10 h-10 rounded object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <span className="text-sm">
                      {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={`${getStatusBadgeClass(order.status)} border-0`}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">
                  {formatPrice(order.payment.totalAmount)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(order.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onSelectOrder(order)}>
                        <Eye className="mr-2 h-4 w-4" />
                        {t('actions.viewDetails')}
                      </DropdownMenuItem>
                      {quickActions.map((action) => (
                        <DropdownMenuItem
                          key={action.status}
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateStatus?.(order.id, action.status);
                          }}
                        >
                          <action.icon className="mr-2 h-4 w-4" />
                          {action.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
