'use client';

/**
 * Order Details Page
 *
 * Displays full order details with status timeline and actions
 * Uses query parameter: /dashboard/orders/details?id=xxx
 */

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { UserHeader } from '@/components/layout/headers';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  Package,
  Loader2,
  Clock,
  Printer,
  Truck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  MapPin,
  CreditCard,
  Gift,
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { useUserOrders } from '@/hooks/useOrders';
import type { Order, OrderStatus, OrderStatusChange } from '@/types/order';
import { ORDER_STATUS_LABELS, CANCELLABLE_STATUSES } from '@/types/order';

function OrderDetailsContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('id');
  const t = useTranslations('orders');

  const { cancelOrder, cancellingOrder } = useUserOrders();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch order details
  useEffect(() => {
    const fetchOrder = async () => {
      if (!functions || !orderId) return;

      try {
        const getOrderDetailsFn = httpsCallable<{ orderId: string }, { success: boolean; order: Order }>(
          functions,
          'getOrderDetails'
        );
        const result = await getOrderDetailsFn({ orderId });
        setOrder(result.data.order);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load order');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  // Handle cancel
  const handleCancel = async () => {
    if (!orderId) return;
    const success = await cancelOrder(orderId, 'User requested cancellation');
    if (success) {
      window.location.reload();
    }
  };

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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  if (!orderId) {
    return (
      <div className="min-h-screen bg-background">
        <UserHeader />
        <main className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <XCircle className="h-16 w-16 text-destructive/50 mb-4" />
              <h3 className="text-lg font-medium mb-1">{t('orderDetails.notFound')}</h3>
              <p className="text-muted-foreground mb-4">{t('orderDetails.notFoundDescription')}</p>
              <Button asChild>
                <Link href="/dashboard/orders">{t('orderDetails.backToOrders')}</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <UserHeader />
        <main className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-background">
        <UserHeader />
        <main className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <XCircle className="h-16 w-16 text-destructive/50 mb-4" />
              <h3 className="text-lg font-medium mb-1">{t('orderDetails.notFound')}</h3>
              <p className="text-muted-foreground mb-4">{error || t('orderDetails.notFoundDescription')}</p>
              <Button asChild>
                <Link href="/dashboard/orders">{t('orderDetails.backToOrders')}</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const statusConfig = getStatusConfig(order.status);
  const StatusIcon = statusConfig.icon;
  const canCancel = CANCELLABLE_STATUSES.includes(order.status);

  return (
    <div className="min-h-screen bg-background">
      <UserHeader />

      <main className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button */}
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link href="/dashboard/orders" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t('orderDetails.backToOrders')}
          </Link>
        </Button>

        {/* Order header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t('orderDetails.title')} #{order.id.slice(-8).toUpperCase()}
            </h1>
            <p className="text-muted-foreground">
              {t('orderDetails.placedOn')} {formatDate(order.createdAt)}
            </p>
          </div>

          <Badge variant="secondary" className={`${statusConfig.bg} ${statusConfig.color} border-0 text-base px-4 py-2`}>
            <StatusIcon className="mr-2 h-4 w-4" />
            {ORDER_STATUS_LABELS[order.status]}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order items */}
            <Card>
              <CardHeader>
                <CardTitle>{t('orderDetails.items')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex gap-4">
                    {item.modelThumbnail ? (
                      <img
                        src={item.modelThumbnail}
                        alt={item.modelName || 'Model'}
                        className="w-20 h-20 rounded-md object-cover ring-1 ring-border bg-black"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-md bg-muted flex items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h4 className="font-medium">{item.modelName || 'Model'}</h4>
                      <p className="text-sm text-muted-foreground">
                        {item.material} · {item.size}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t('orderDetails.colors')}: {item.colors.join(', ')}
                      </p>
                      <p className="text-sm">
                        {formatPrice(item.unitPrice)} × {item.quantity} = {formatPrice(item.subtotal)}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Status timeline */}
            <Card>
              <CardHeader>
                <CardTitle>{t('orderDetails.timeline')}</CardTitle>
              </CardHeader>
              <CardContent>
                <OrderTimeline statusHistory={order.statusHistory} />
              </CardContent>
            </Card>

            {/* Tracking info */}
            {order.tracking && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    {t('orderDetails.tracking')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p>
                      <span className="text-muted-foreground">{t('orderDetails.carrier')}:</span>{' '}
                      {order.tracking.carrier}
                    </p>
                    <p>
                      <span className="text-muted-foreground">{t('orderDetails.trackingNumber')}:</span>{' '}
                      {order.tracking.trackingNumber}
                    </p>
                    {order.tracking.trackingUrl && (
                      <Button asChild variant="outline" size="sm">
                        <a href={order.tracking.trackingUrl} target="_blank" rel="noopener noreferrer" className="gap-2">
                          {t('orderDetails.trackPackage')}
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Order summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  {t('orderDetails.summary')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('orderDetails.subtotal')}</span>
                  <span>{formatPrice(order.payment.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('orderDetails.shipping')}</span>
                  <span>{formatPrice(order.payment.shippingCost)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>{t('orderDetails.total')}</span>
                  <span>{formatPrice(order.payment.totalAmount)}</span>
                </div>
                {order.bonusCreditsAwarded && order.bonusCreditsAwarded > 0 && (
                  <div className="flex items-center gap-2 text-green-600 bg-green-500/10 p-2 rounded">
                    <Gift className="h-4 w-4" />
                    <span className="text-sm">
                      +{order.bonusCreditsAwarded} {t('orderDetails.creditsAwarded')}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Shipping address */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  {t('orderDetails.shippingAddress')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <address className="not-italic text-sm">
                  <p className="font-medium">{order.shippingAddress.recipientName}</p>
                  <p className="text-muted-foreground">{order.shippingAddress.phone}</p>
                  <p className="mt-2">{order.shippingAddress.addressLine1}</p>
                  {order.shippingAddress.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
                  <p>
                    {order.shippingAddress.city}
                    {order.shippingAddress.state && `, ${order.shippingAddress.state}`}{' '}
                    {order.shippingAddress.postalCode}
                  </p>
                  <p>{order.shippingAddress.country}</p>
                </address>
              </CardContent>
            </Card>

            {/* Actions */}
            {canCancel && (
              <Card>
                <CardContent className="pt-6">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full" disabled={cancellingOrder}>
                        {cancellingOrder && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('orderDetails.cancelOrder')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('orderDetails.cancelConfirmTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('orderDetails.cancelConfirmDescription')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('orderDetails.keepOrder')}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          {t('orderDetails.confirmCancel')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function OrderTimeline({ statusHistory }: { statusHistory: OrderStatusChange[] }) {
  const t = useTranslations('orders');

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-TW', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (statusHistory.length === 0) {
    return <p className="text-muted-foreground">{t('orderDetails.noHistory')}</p>;
  }

  return (
    <div className="relative">
      {statusHistory.map((change, index) => (
        <div key={index} className="flex gap-4 pb-6 last:pb-0">
          {/* Timeline line */}
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-primary" />
            {index < statusHistory.length - 1 && (
              <div className="w-0.5 flex-1 bg-border mt-2" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 pb-2">
            <p className="font-medium">
              {ORDER_STATUS_LABELS[change.to]}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatDate(change.changedAt)}
            </p>
            {change.reason && (
              <p className="text-sm mt-1">{change.reason}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function OrderDetailsWithSuspense() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background">
        <UserHeader />
        <main className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </div>
    }>
      <OrderDetailsContent />
    </Suspense>
  );
}

export default function OrderDetailsPage() {
  return (
    <AuthGuard>
      <OrderDetailsWithSuspense />
    </AuthGuard>
  );
}
