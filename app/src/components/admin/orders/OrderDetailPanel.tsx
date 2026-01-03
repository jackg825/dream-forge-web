'use client';

/**
 * Order Detail Panel
 *
 * Side panel or modal showing full order details with admin actions
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Package,
  MapPin,
  CreditCard,
  Truck,
  User,
  Clock,
  CheckCircle2,
  Printer,
  AlertTriangle,
  XCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import type { AdminOrder, OrderStatus, UpdateOrderStatusRequest } from '@/types/order';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, CANCELLABLE_STATUSES } from '@/types/order';

interface OrderDetailPanelProps {
  order: AdminOrder | null;
  open: boolean;
  onClose: () => void;
  onUpdateStatus: (request: UpdateOrderStatusRequest) => Promise<void>;
  onUpdateTracking: (orderId: string, tracking: { carrier: string; trackingNumber: string; trackingUrl?: string }) => Promise<void>;
  updating?: boolean;
}

const STATUS_OPTIONS: OrderStatus[] = [
  'pending',
  'confirmed',
  'printing',
  'quality_check',
  'shipping',
  'delivered',
  'cancelled',
  'refunded',
];

export function OrderDetailPanel({
  order,
  open,
  onClose,
  onUpdateStatus,
  onUpdateTracking,
  updating,
}: OrderDetailPanelProps) {
  const t = useTranslations('adminOrders');

  const [newStatus, setNewStatus] = useState<OrderStatus | ''>('');
  const [statusReason, setStatusReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [trackingCarrier, setTrackingCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
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

  const handleUpdateStatus = async () => {
    if (!order || !newStatus) return;

    await onUpdateStatus({
      orderId: order.id,
      newStatus,
      reason: statusReason || undefined,
      adminNotes: adminNotes || undefined,
      tracking: newStatus === 'shipping' && trackingCarrier && trackingNumber
        ? { carrier: trackingCarrier, trackingNumber, trackingUrl: trackingUrl || undefined }
        : undefined,
    });

    // Reset form
    setNewStatus('');
    setStatusReason('');
    setAdminNotes('');
    setTrackingCarrier('');
    setTrackingNumber('');
    setTrackingUrl('');
  };

  const handleUpdateTracking = async () => {
    if (!order || !trackingCarrier || !trackingNumber) return;

    await onUpdateTracking(order.id, {
      carrier: trackingCarrier,
      trackingNumber,
      trackingUrl: trackingUrl || undefined,
    });

    // Reset form
    setTrackingCarrier('');
    setTrackingNumber('');
    setTrackingUrl('');
  };

  if (!order) return null;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>{t('detail.title')} #{order.id.slice(-6).toUpperCase()}</span>
            <Badge className={`${getStatusBadgeClass(order.status)} border-0`}>
              {ORDER_STATUS_LABELS[order.status]}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Customer info */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" />
                {t('detail.customer')}
              </CardTitle>
            </CardHeader>
            <CardContent className="py-3">
              <div className="flex items-center gap-3">
                {order.userPhotoURL ? (
                  <img src={order.userPhotoURL} alt="" className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-sm font-medium">{order.userDisplayName?.[0] || '?'}</span>
                  </div>
                )}
                <div>
                  <p className="font-medium">{order.userDisplayName}</p>
                  <p className="text-sm text-muted-foreground">{order.userEmail}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order items */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="h-4 w-4" />
                {t('detail.items')} ({order.items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="py-3 space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="flex gap-3">
                  {item.modelThumbnail ? (
                    <img src={item.modelThumbnail} alt="" className="w-16 h-16 rounded object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded bg-muted flex items-center justify-center">
                      <Package className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.modelName || 'Model'}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.material} · {item.size} · {item.colors.join(', ')}
                    </p>
                    <p className="text-sm">
                      {formatPrice(item.unitPrice)} × {item.quantity} = {formatPrice(item.subtotal)}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Shipping address */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {t('detail.shippingAddress')}
              </CardTitle>
            </CardHeader>
            <CardContent className="py-3">
              <address className="not-italic text-sm">
                <p className="font-medium">{order.shippingAddress.recipientName}</p>
                <p className="text-muted-foreground">{order.shippingAddress.phone}</p>
                <p className="mt-1">{order.shippingAddress.addressLine1}</p>
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

          {/* Payment summary */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                {t('detail.payment')}
              </CardTitle>
            </CardHeader>
            <CardContent className="py-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('detail.subtotal')}</span>
                <span>{formatPrice(order.payment.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('detail.shipping')}</span>
                <span>{formatPrice(order.payment.shippingCost)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-medium">
                <span>{t('detail.total')}</span>
                <span>{formatPrice(order.payment.totalAmount)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Tracking info */}
          {order.tracking && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  {t('detail.tracking')}
                </CardTitle>
              </CardHeader>
              <CardContent className="py-3 space-y-2">
                <p className="text-sm">
                  <span className="text-muted-foreground">{t('detail.carrier')}:</span>{' '}
                  {order.tracking.carrier}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">{t('detail.trackingNumber')}:</span>{' '}
                  {order.tracking.trackingNumber}
                </p>
                {order.tracking.trackingUrl && (
                  <Button asChild variant="outline" size="sm">
                    <a href={order.tracking.trackingUrl} target="_blank" rel="noopener noreferrer">
                      {t('detail.trackPackage')}
                      <ExternalLink className="ml-2 h-3 w-3" />
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Status history */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {t('detail.statusHistory')}
              </CardTitle>
            </CardHeader>
            <CardContent className="py-3">
              <div className="space-y-3">
                {order.statusHistory.map((change, index) => (
                  <div key={index} className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {ORDER_STATUS_LABELS[change.from]} → {ORDER_STATUS_LABELS[change.to]}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(change.changedAt)}</p>
                      {change.reason && <p className="text-xs mt-1">{change.reason}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Update status */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">{t('detail.updateStatus')}</CardTitle>
            </CardHeader>
            <CardContent className="py-3 space-y-4">
              <div className="space-y-2">
                <Label>{t('detail.newStatus')}</Label>
                <Select value={newStatus} onValueChange={(v) => setNewStatus(v as OrderStatus)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('detail.selectStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {ORDER_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('detail.reason')}</Label>
                <Input
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder={t('detail.reasonPlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('detail.adminNotes')}</Label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder={t('detail.notesPlaceholder')}
                  rows={2}
                />
              </div>

              {/* Tracking fields for shipping status */}
              {newStatus === 'shipping' && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label>{t('detail.carrier')}</Label>
                    <Input
                      value={trackingCarrier}
                      onChange={(e) => setTrackingCarrier(e.target.value)}
                      placeholder="e.g., FedEx, DHL"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('detail.trackingNumber')}</Label>
                    <Input
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="e.g., 1234567890"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('detail.trackingUrl')}</Label>
                    <Input
                      value={trackingUrl}
                      onChange={(e) => setTrackingUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </>
              )}

              <Button
                onClick={handleUpdateStatus}
                disabled={!newStatus || updating}
                className="w-full"
              >
                {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('detail.updateStatusButton')}
              </Button>
            </CardContent>
          </Card>

          {/* Update tracking separately */}
          {order.status === 'shipping' && !order.tracking && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">{t('detail.addTracking')}</CardTitle>
              </CardHeader>
              <CardContent className="py-3 space-y-4">
                <div className="space-y-2">
                  <Label>{t('detail.carrier')}</Label>
                  <Input
                    value={trackingCarrier}
                    onChange={(e) => setTrackingCarrier(e.target.value)}
                    placeholder="e.g., FedEx, DHL"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('detail.trackingNumber')}</Label>
                  <Input
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="e.g., 1234567890"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('detail.trackingUrl')}</Label>
                  <Input
                    value={trackingUrl}
                    onChange={(e) => setTrackingUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <Button
                  onClick={handleUpdateTracking}
                  disabled={!trackingCarrier || !trackingNumber || updating}
                  className="w-full"
                >
                  {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('detail.addTrackingButton')}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
