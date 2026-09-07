import { https } from 'firebase-functions/v1';
import { MaterialConfig, MATERIAL_CONFIGS, ORDER_STATUS_TRANSITIONS, OrderStatus, ShippingTracking } from '../domain/order/types';

export function orderText(value: unknown, field: string, maxLength = 2000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new https.HttpsError('invalid-argument', `${field} must be a non-empty string of at most ${maxLength} characters`);
  }
  return value.trim();
}

/** Callable payload encoding can turn optional undefined values into null. */
export function optionalOrderText(value: unknown, field: string, maxLength = 2000): string | undefined {
  return value == null || value === '' ? undefined : orderText(value, field, maxLength);
}

export function orderId(value: unknown): string {
  const id = orderText(value, 'Order ID', 128);
  if (id.includes('/')) throw new https.HttpsError('invalid-argument', 'Invalid order ID');
  return id;
}

export function orderStatus(value: unknown): OrderStatus {
  if (typeof value !== 'string' || !Object.hasOwn(ORDER_STATUS_TRANSITIONS, value)) {
    throw new https.HttpsError('invalid-argument', 'Invalid order status');
  }
  return value as OrderStatus;
}

export function optionalOrderStatusFilter(value: unknown): OrderStatus | OrderStatus[] | undefined {
  if (value == null) return undefined;
  if (!Array.isArray(value)) return orderStatus(value);
  if (value.length === 0 || value.length > 8) {
    throw new https.HttpsError('invalid-argument', 'Provide between one and eight statuses');
  }
  return value.map(orderStatus);
}

export function orderDate(value: unknown, field: string): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !Number.isFinite(new Date(value).getTime())) {
    throw new https.HttpsError('invalid-argument', `Invalid ${field}`);
  }
  return new Date(value);
}

export function orderTracking(value: unknown): Omit<ShippingTracking, 'shippedAt'> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new https.HttpsError('invalid-argument', 'Tracking information is required');
  }
  const input = value as Record<string, unknown>;
  const tracking: Omit<ShippingTracking, 'shippedAt'> = {
    carrier: orderText(input.carrier, 'Carrier', 100),
    trackingNumber: orderText(input.trackingNumber, 'Tracking number', 200),
  };
  if (input.trackingUrl != null && input.trackingUrl !== '') {
    const url = orderText(input.trackingUrl, 'Tracking URL', 2048);
    try {
      if (!['http:', 'https:'].includes(new URL(url).protocol)) throw new Error();
    } catch {
      throw new https.HttpsError('invalid-argument', 'Tracking URL must use HTTP or HTTPS');
    }
    tracking.trackingUrl = url;
  }
  const estimatedDelivery = orderDate(input.estimatedDelivery, 'estimated delivery');
  if (estimatedDelivery) tracking.estimatedDelivery = estimatedDelivery;
  return tracking;
}

export function optionalOrderTracking(value: unknown): Omit<ShippingTracking, 'shippedAt'> | undefined {
  return value == null ? undefined : orderTracking(value);
}

export function orderMaterial(value: unknown): MaterialConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new https.HttpsError('invalid-argument', 'Material configuration is required');
  }
  const input = value as Record<string, unknown>;
  if (typeof input.id !== 'string' || !Object.hasOwn(MATERIAL_CONFIGS, input.id) ||
      typeof input.available !== 'boolean' ||
      !Number.isInteger(input.maxColors) || (input.maxColors as number) < 1 || (input.maxColors as number) > 4 ||
      (input.id !== 'pla-multi' && input.maxColors !== 1) ||
      !Number.isInteger(input.estimatedDays) || (input.estimatedDays as number) < 1 || (input.estimatedDays as number) > 365 ||
      !Number.isInteger(input.sortOrder) || (input.sortOrder as number) < 0 || (input.sortOrder as number) > 1000) {
    throw new https.HttpsError('invalid-argument', 'Invalid material configuration');
  }
  return {
    id: input.id as MaterialConfig['id'],
    name: orderText(input.name, 'Material name', 200),
    nameZh: orderText(input.nameZh, 'Material name (Chinese)', 200),
    description: orderText(input.description, 'Material description'),
    descriptionZh: orderText(input.descriptionZh, 'Material description (Chinese)'),
    maxColors: input.maxColors as number,
    estimatedDays: input.estimatedDays as number,
    available: input.available,
    sortOrder: input.sortOrder as number,
  };
}
