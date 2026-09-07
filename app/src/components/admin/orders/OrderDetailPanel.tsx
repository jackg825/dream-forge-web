'use client';

/**
 * Order Detail Panel
 *
 * Side panel or modal showing full order details with admin actions
 */

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FillImage } from '@/components/ui/fill-image';
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
  Loader2,
  ExternalLink,
} from 'lucide-react';
import type { AdminOrder, OrderStatus, UpdateOrderStatusRequest } from '@/types/order';
import { ORDER_STATUS_TRANSITIONS, ORDER_STATUS_COLORS } from '@/types/order';

interface OrderDetailPanelProps {
  order: AdminOrder | null;
  open: boolean;
  onClose: () => void;
  onUpdateStatus: (request: UpdateOrderStatusRequest) => Promise<boolean>;
  onUpdateTracking: (orderId: string, tracking: { carrier: string; trackingNumber: string; trackingUrl?: string }) => Promise<boolean>;
  updating?: boolean;
  error?: string | null;
  initialStatus?: OrderStatus | '';
}

export function OrderDetailPanel({
  order,
  open,
  onClose,
  onUpdateStatus,
  onUpdateTracking,
  updating,
  error,
  initialStatus = '',
}: OrderDetailPanelProps) {
  const t = useTranslations('adminOrders');
  const locale = useLocale();

  const [newStatus, setNewStatus] = useState<OrderStatus | ''>(initialStatus);
  const [statusReason, setStatusReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [trackingCarrier, setTrackingCarrier] = useState(order?.tracking?.carrier || '');
  const [trackingNumber, setTrackingNumber] = useState(order?.tracking?.trackingNumber || '');
  const [trackingUrl, setTrackingUrl] = useState(order?.tracking?.trackingUrl || '');
  const [validationError, setValidationError] = useState<string | null>(null);

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: order?.payment.currency || 'USD',
    }).format(cents / 100);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale, {
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

  const validateTracking = () => {
    if (!trackingCarrier.trim() || !trackingNumber.trim()) {
      setValidationError(t('detail.trackingRequired'));
      return false;
    }
    if (trackingUrl.trim()) {
      try {
        if (!['https:', 'http:'].includes(new URL(trackingUrl.trim()).protocol)) throw new Error();
      } catch {
        setValidationError(t('detail.invalidTrackingUrl'));
        return false;
      }
    }
    return true;
  };

  const handleUpdateStatus = async () => {
    if (!order || !newStatus || updating) return;
    setValidationError(null);
    if (newStatus === 'shipping' && !validateTracking()) return;
    await onUpdateStatus({
      orderId: order.id,
      newStatus,
      reason: statusReason.trim() || undefined,
      adminNotes: adminNotes.trim() || undefined,
      tracking: newStatus === 'shipping'
        ? { carrier: trackingCarrier.trim(), trackingNumber: trackingNumber.trim(), trackingUrl: trackingUrl.trim() || undefined }
        : undefined,
    });
  };

  const handleUpdateTracking = async () => {
    if (!order || updating) return;
    setValidationError(null);
    if (!validateTracking()) return;
    await onUpdateTracking(order.id, {
      carrier: trackingCarrier.trim(),
      trackingNumber: trackingNumber.trim(),
      trackingUrl: trackingUrl.trim(),
    });
  };

  if (!order) return null;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && !updating && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>{t('detail.title')} #{order.id.slice(-6).toUpperCase()}</span>
            <Badge className={`${getStatusBadgeClass(order.status)} border-0`}>
              {t(`status.${order.status}`)}
            </Badge>
          </SheetTitle>
          <SheetDescription>{order.id}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {(validationError || error) && (
            <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{validationError || error}</p>
          )}
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
                  <div className="relative w-10 h-10 overflow-hidden rounded-full">
                    <FillImage
                      src={order.userPhotoURL}
                      alt=""
                      className="object-cover"
                      sizes="40px"
                    />
                  </div>
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
                    <div className="relative w-16 h-16 overflow-hidden rounded">
                      <FillImage
                        src={item.modelThumbnail}
                        alt=""
                        className="object-cover"
                        sizes="64px"
                      />
                    </div>
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
                        {t(`status.${change.from}`)} → {t(`status.${change.to}`)}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(change.changedAt)}</p>
                      {change.reason && <p className="text-xs mt-1">{change.reason}</p>}
                      {change.adminNotes && <p className="text-xs mt-1">{t('detail.adminNotes')}: {change.adminNotes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Update status */}
          {ORDER_STATUS_TRANSITIONS[order.status].length > 0 && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">{t('detail.updateStatus')}</CardTitle>
            </CardHeader>
            <CardContent className="py-3 space-y-4">
              <div className="space-y-2">
                <Label>{t('detail.newStatus')}</Label>
                <Select disabled={updating} value={newStatus} onValueChange={(v) => setNewStatus(v as OrderStatus)}>
                  <SelectTrigger aria-label={t('detail.newStatus')}>
                    <SelectValue placeholder={t('detail.selectStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_STATUS_TRANSITIONS[order.status].map((status) => (
                      <SelectItem key={status} value={status}>
                        {t(`status.${status}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="order-reason">{t('detail.reason')}</Label>
                <Input
                  id="order-reason"
                  aria-label={t('detail.reason')}
                  maxLength={2000}
                  disabled={updating}
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder={t('detail.reasonPlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="order-adminNotes">{t('detail.adminNotes')}</Label>
                <Textarea
                  id="order-adminNotes"
                  aria-label={t('detail.adminNotes')}
                  maxLength={5000}
                  disabled={updating}
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
                    <Label htmlFor="order-carrier">{t('detail.carrier')}</Label>
                    <Input
                      id="order-carrier"
                      aria-label={t('detail.carrier')}
                      maxLength={100}
                      disabled={updating}
                      value={trackingCarrier}
                      onChange={(e) => setTrackingCarrier(e.target.value)}
                      placeholder="e.g., FedEx, DHL"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="order-trackingNumber">{t('detail.trackingNumber')}</Label>
                    <Input
                      id="order-trackingNumber"
                      aria-label={t('detail.trackingNumber')}
                      maxLength={200}
                      disabled={updating}
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="e.g., 1234567890"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="order-trackingUrl">{t('detail.trackingUrl')}</Label>
                    <Input
                      id="order-trackingUrl"
                      aria-label={t('detail.trackingUrl')}
                      maxLength={2048}
                      disabled={updating}
                      value={trackingUrl}
                      onChange={(e) => setTrackingUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </>
              )}

              <Button
                onClick={handleUpdateStatus}
                disabled={!newStatus || updating || (newStatus === 'shipping' && (!trackingCarrier.trim() || !trackingNumber.trim()))}
                className="w-full"
              >
                {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('detail.updateStatusButton')}
              </Button>
            </CardContent>
          </Card>
          )}

          {/* Update tracking separately */}
          {(order.status === 'shipping' || order.status === 'delivered') && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">{t('detail.editTracking')}</CardTitle>
              </CardHeader>
              <CardContent className="py-3 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="order-carrier">{t('detail.carrier')}</Label>
                  <Input
                    id="order-carrier"
                    aria-label={t('detail.carrier')}
                    maxLength={100}
                    disabled={updating}
                    value={trackingCarrier}
                    onChange={(e) => setTrackingCarrier(e.target.value)}
                    placeholder="e.g., FedEx, DHL"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="order-trackingNumber">{t('detail.trackingNumber')}</Label>
                  <Input
                    id="order-trackingNumber"
                    aria-label={t('detail.trackingNumber')}
                    maxLength={200}
                    disabled={updating}
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="e.g., 1234567890"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="order-trackingUrl">{t('detail.trackingUrl')}</Label>
                  <Input
                    id="order-trackingUrl"
                    aria-label={t('detail.trackingUrl')}
                    maxLength={2048}
                    disabled={updating}
                    value={trackingUrl}
                    onChange={(e) => setTrackingUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <Button
                  onClick={handleUpdateTracking}
                  disabled={!trackingCarrier.trim() || !trackingNumber.trim() || updating}
                  className="w-full"
                >
                  {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('detail.saveTracking')}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
