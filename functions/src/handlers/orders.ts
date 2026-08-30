/**
 * Order Cloud Functions
 *
 * User-facing and admin order management functions
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { orderRepository } from '../infrastructure/repositories/OrderRepository';
import { webhookNotificationAdapter } from '../infrastructure/notification/WebhookNotificationAdapter';
import {
  CreateOrderUseCase,
  UpdateOrderStatusUseCase,
  CancelOrderUseCase,
} from '../application/orders';
import {
  Order,
  OrderStatus,
  ShippingAddress,
  PrintMaterial,
  PrintSizeId,
} from '../domain/order';
import { getSignedUrl } from '../storage';
import { extractStorageReferenceFromUrl, type StorageBackend } from '../utils/storage-validation';

const db = admin.firestore();
const PRINT_MATERIALS: PrintMaterial[] = ['pla-single', 'pla-multi', 'resin'];
const PRINT_SIZES: PrintSizeId[] = ['5x5x5', '10x10x10', '15x15x15'];
const MAX_PRINT_PRICE_CENTS = 100_000_000;

function isValidPrice(price: unknown): price is number {
  return typeof price === 'number' &&
    Number.isInteger(price) &&
    price >= 0 &&
    price <= MAX_PRINT_PRICE_CENTS;
}

function isSafeExternalUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function parsePageNumber(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  field: string
): number {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `${field} must be an integer between ${minimum} and ${maximum}`
    );
  }
  return value as number;
}

/**
 * Check if user is admin
 */
async function isAdmin(uid: string): Promise<boolean> {
  const userDoc = await db.collection('users').doc(uid).get();
  return userDoc.data()?.role === 'admin';
}

/**
 * Order records keep a durable storage identity and expose a freshly signed
 * access URL. Legacy records can be recovered from their approved URL shape.
 */
async function refreshOrderModelUrls<T extends Order>(order: T): Promise<T> {
  const items = await Promise.all(order.items.map(async (item) => {
    const legacyReference = extractStorageReferenceFromUrl(item.modelUrl);
    const storagePath = item.modelStoragePath || legacyReference?.storagePath;
    const storedBackend = item.modelStorageBackend;
    const backend: StorageBackend | undefined =
      storedBackend === 'firebase' || storedBackend === 'r2'
        ? storedBackend
        : legacyReference?.backend;
    const thumbnailReference = item.modelThumbnail
      ? extractStorageReferenceFromUrl(item.modelThumbnail)
      : null;
    const thumbnailPath = item.modelThumbnailStoragePath || thumbnailReference?.storagePath;
    const thumbnailBackend = item.modelThumbnailStorageBackend || thumbnailReference?.backend;
    let modelThumbnail: string | undefined;
    if (thumbnailPath && thumbnailBackend) {
      try {
        modelThumbnail = await getSignedUrl(thumbnailPath, 3600, thumbnailBackend);
      } catch {
        modelThumbnail = undefined;
      }
    }
    const sanitizedItem = { ...item, modelThumbnail };

    if (!storagePath || !backend) return sanitizedItem;
    if (
      !item.modelStoragePath &&
      (!legacyReference || legacyReference.storagePath !== storagePath)
    ) {
      return sanitizedItem;
    }

    try {
      return {
        ...sanitizedItem,
        modelUrl: await getSignedUrl(storagePath, 3600, backend),
        modelStoragePath: storagePath,
        modelStorageBackend: backend,
        modelThumbnail,
        ...(modelThumbnail && {
          modelThumbnailStoragePath: thumbnailPath,
          modelThumbnailStorageBackend: thumbnailBackend,
        }),
      };
    } catch (error) {
      functions.logger.warn('Could not refresh an order model URL', {
        orderId: order.id,
        itemId: item.id,
        storagePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return sanitizedItem;
    }
  }));

  const tracking = order.tracking
    ? {
        ...order.tracking,
        trackingUrl: isSafeExternalUrl(order.tracking.trackingUrl)
          ? order.tracking.trackingUrl
          : undefined,
      }
    : undefined;

  return { ...order, items, tracking };
}

// ============================================
// User Functions
// ============================================

/**
 * Create a new print order
 */
export const createOrder = functions
  .region('asia-east1')
  .https.onCall(async (data, context) => {
    // Auth check
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    const userId = context.auth.uid;

    // Validate request
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'At least one item is required');
    }

    if (!data.shippingAddress) {
      throw new functions.https.HttpsError('invalid-argument', 'Shipping address is required');
    }

    // Create use case instance
    const useCase = new CreateOrderUseCase(orderRepository, webhookNotificationAdapter);

    try {
      const result = await useCase.execute({
        userId,
        items: data.items,
        shippingAddress: data.shippingAddress,
        shippingMethod: data.shippingMethod || 'standard',
        saveAddress: data.saveAddress || false,
      });

      return {
        success: true,
        orderId: result.orderId,
        totalAmount: result.totalAmount,
        currency: result.currency,
        estimatedDelivery: result.estimatedDelivery.toISOString(),
      };
    } catch (error) {
      functions.logger.error('createOrder failed:', error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Failed to create order'
      );
    }
  });

/**
 * Get user's orders
 */
export const getUserOrders = functions
  .region('asia-east1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    const userId = context.auth.uid;
    const limit = parsePageNumber(data?.limit, 20, 1, 50, 'limit');
    const offset = parsePageNumber(data?.offset, 0, 0, 1000, 'offset');

    try {
      const result = await orderRepository.getByUserId(userId, { limit, offset });

      const refreshedOrders = await Promise.all(
        result.items.map((order) => refreshOrderModelUrls(order))
      );

      return {
        success: true,
        orders: refreshedOrders.map((order) => ({
          ...order,
          createdAt: order.createdAt.toISOString(),
          updatedAt: order.updatedAt.toISOString(),
          confirmedAt: order.confirmedAt?.toISOString(),
          shippedAt: order.shippedAt?.toISOString(),
          deliveredAt: order.deliveredAt?.toISOString(),
        })),
        pagination: {
          total: result.total,
          limit,
          offset,
          hasMore: result.hasMore,
        },
      };
    } catch (error) {
      functions.logger.error('getUserOrders failed:', error);
      throw new functions.https.HttpsError('internal', 'Failed to fetch orders');
    }
  });

/**
 * Get single order details
 */
export const getOrderDetails = functions
  .region('asia-east1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    const { orderId } = data;
    if (!orderId) {
      throw new functions.https.HttpsError('invalid-argument', 'Order ID is required');
    }

    try {
      const order = await orderRepository.getById(orderId);

      if (!order) {
        throw new functions.https.HttpsError('not-found', 'Order not found');
      }

      // Check ownership or admin
      const userIsAdmin = await isAdmin(context.auth.uid);
      if (order.userId !== context.auth.uid && !userIsAdmin) {
        throw new functions.https.HttpsError('permission-denied', 'Access denied');
      }

      const refreshedOrder = await refreshOrderModelUrls(order);

      return {
        success: true,
        order: {
          ...refreshedOrder,
          createdAt: refreshedOrder.createdAt.toISOString(),
          updatedAt: refreshedOrder.updatedAt.toISOString(),
          confirmedAt: refreshedOrder.confirmedAt?.toISOString(),
          shippedAt: refreshedOrder.shippedAt?.toISOString(),
          deliveredAt: refreshedOrder.deliveredAt?.toISOString(),
        },
      };
    } catch (error) {
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      functions.logger.error('getOrderDetails failed:', error);
      throw new functions.https.HttpsError('internal', 'Failed to fetch order');
    }
  });

/**
 * Cancel an order (user)
 */
export const cancelOrder = functions
  .region('asia-east1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    const { orderId, reason } = data;
    if (!orderId) {
      throw new functions.https.HttpsError('invalid-argument', 'Order ID is required');
    }

    const useCase = new CancelOrderUseCase(orderRepository, webhookNotificationAdapter);

    try {
      const result = await useCase.execute({
        orderId,
        userId: context.auth.uid,
        reason: reason || 'Cancelled by user',
        isAdmin: await isAdmin(context.auth.uid),
      });

      return {
        success: true,
        message: result.message,
        previousStatus: result.previousStatus,
      };
    } catch (error) {
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      functions.logger.error('cancelOrder failed:', error);
      throw new functions.https.HttpsError('internal', 'Failed to cancel order');
    }
  });

// ============================================
// Shipping Addresses
// ============================================

/**
 * Get user's saved shipping addresses
 */
export const getShippingAddresses = functions
  .region('asia-east1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    try {
      const addresses = await orderRepository.getAddresses(context.auth.uid);
      return { success: true, addresses };
    } catch (error) {
      functions.logger.error('getShippingAddresses failed:', error);
      throw new functions.https.HttpsError('internal', 'Failed to fetch addresses');
    }
  });

/**
 * Save a shipping address
 */
export const saveShippingAddress = functions
  .region('asia-east1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    const address: ShippingAddress = {
      ...data.address,
      id: data.address?.id,
    };

    // Validate required fields
    if (!address.recipientName || !address.phone || !address.country ||
        !address.city || !address.addressLine1) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required address fields');
    }

    try {
      const addressId = await orderRepository.saveAddress(context.auth.uid, address);
      return { success: true, addressId };
    } catch (error) {
      functions.logger.error('saveShippingAddress failed:', error);
      throw new functions.https.HttpsError('internal', 'Failed to save address');
    }
  });

/**
 * Delete a shipping address
 */
export const deleteShippingAddress = functions
  .region('asia-east1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    const { addressId } = data;
    if (!addressId) {
      throw new functions.https.HttpsError('invalid-argument', 'Address ID is required');
    }

    try {
      await orderRepository.deleteAddress(context.auth.uid, addressId);
      return { success: true };
    } catch (error) {
      functions.logger.error('deleteShippingAddress failed:', error);
      throw new functions.https.HttpsError('internal', 'Failed to delete address');
    }
  });

// ============================================
// Print Configuration (Read-only for users)
// ============================================

/**
 * Get print configuration (materials, sizes, colors, pricing)
 */
export const getPrintConfig = functions
  .region('asia-east1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    try {
      const [materials, sizes, colors, pricing] = await Promise.all([
        orderRepository.getMaterials(),
        orderRepository.getSizes(),
        orderRepository.getColors(),
        orderRepository.getPricingMatrix(),
      ]);

      return {
        success: true,
        materials: materials.filter((m) => m.available),
        sizes: sizes.filter((s) => s.available),
        colors: colors.filter((c) => c.available),
        pricing,
      };
    } catch (error) {
      functions.logger.error('getPrintConfig failed:', error);
      throw new functions.https.HttpsError('internal', 'Failed to fetch print configuration');
    }
  });

// ============================================
// Admin Functions
// ============================================

/**
 * List all orders (admin)
 */
export const listAllOrders = functions
  .region('asia-east1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    if (!(await isAdmin(context.auth.uid))) {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }

    const { status, userId, fromDate, toDate } = data || {};
    const limit = parsePageNumber(data?.limit, 50, 1, 50, 'limit');
    const offset = parsePageNumber(data?.offset, 0, 0, 1000, 'offset');

    try {
      const result = await orderRepository.getAll(
        {
          status,
          userId,
          fromDate: fromDate ? new Date(fromDate) : undefined,
          toDate: toDate ? new Date(toDate) : undefined,
        },
        { limit, offset }
      );

      const refreshedOrders = await Promise.all(
        result.items.map((order) => refreshOrderModelUrls(order))
      );

      return {
        success: true,
        orders: refreshedOrders.map((order) => ({
          ...order,
          createdAt: order.createdAt.toISOString(),
          updatedAt: order.updatedAt.toISOString(),
          confirmedAt: order.confirmedAt?.toISOString(),
          shippedAt: order.shippedAt?.toISOString(),
          deliveredAt: order.deliveredAt?.toISOString(),
        })),
        pagination: {
          total: result.total,
          limit,
          offset,
          hasMore: result.hasMore,
        },
      };
    } catch (error) {
      functions.logger.error('listAllOrders failed:', error);
      throw new functions.https.HttpsError('internal', 'Failed to fetch orders');
    }
  });

/**
 * Get orders by status (admin - for Kanban)
 */
export const getOrdersByStatus = functions
  .region('asia-east1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    if (!(await isAdmin(context.auth.uid))) {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }

    const { status } = data || {};
    const limit = parsePageNumber(data?.limit, 20, 1, 50, 'limit');

    if (!status) {
      throw new functions.https.HttpsError('invalid-argument', 'Status is required');
    }

    try {
      const result = await orderRepository.getByStatus(status as OrderStatus, { limit });

      const refreshedOrders = await Promise.all(
        result.items.map((order) => refreshOrderModelUrls(order))
      );

      return {
        success: true,
        orders: refreshedOrders.map((order) => ({
          ...order,
          createdAt: order.createdAt.toISOString(),
          updatedAt: order.updatedAt.toISOString(),
        })),
        total: result.total,
      };
    } catch (error) {
      functions.logger.error('getOrdersByStatus failed:', error);
      throw new functions.https.HttpsError('internal', 'Failed to fetch orders');
    }
  });

/**
 * Update order status (admin)
 */
export const updateOrderStatus = functions
  .region('asia-east1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    if (!(await isAdmin(context.auth.uid))) {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }

    const { orderId, newStatus, reason, adminNotes, tracking } = data;

    if (!orderId || !newStatus) {
      throw new functions.https.HttpsError('invalid-argument', 'Order ID and status are required');
    }
    if (tracking?.trackingUrl && !isSafeExternalUrl(tracking.trackingUrl)) {
      throw new functions.https.HttpsError('invalid-argument', 'Tracking URL must use HTTP or HTTPS');
    }

    const useCase = new UpdateOrderStatusUseCase(orderRepository, webhookNotificationAdapter);

    try {
      const result = await useCase.execute({
        orderId,
        newStatus: newStatus as OrderStatus,
        adminId: context.auth.uid,
        reason,
        adminNotes,
        tracking: tracking ? {
          ...tracking,
          shippedAt: new Date(),
        } : undefined,
      });

      return {
        success: true,
        previousStatus: result.previousStatus,
        newStatus: result.newStatus,
        bonusCreditsAwarded: result.bonusCreditsAwarded,
      };
    } catch (error) {
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      functions.logger.error('updateOrderStatus failed:', error);
      throw new functions.https.HttpsError('internal', 'Failed to update order status');
    }
  });

/**
 * Update tracking information (admin)
 */
export const updateTrackingInfo = functions
  .region('asia-east1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    if (!(await isAdmin(context.auth.uid))) {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }

    const { orderId, carrier, trackingNumber, trackingUrl, estimatedDelivery } = data;

    if (!orderId || !carrier || !trackingNumber) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Order ID, carrier, and tracking number are required'
      );
    }
    if (trackingUrl && !isSafeExternalUrl(trackingUrl)) {
      throw new functions.https.HttpsError('invalid-argument', 'Tracking URL must use HTTP or HTTPS');
    }

    try {
      const order = await orderRepository.getById(orderId);
      if (!order) {
        throw new functions.https.HttpsError('not-found', 'Order not found');
      }

      await orderRepository.update(orderId, {
        tracking: {
          carrier,
          trackingNumber,
          trackingUrl,
          estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : undefined,
          shippedAt: order.tracking?.shippedAt || new Date(),
        },
      });

      return { success: true };
    } catch (error) {
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      functions.logger.error('updateTrackingInfo failed:', error);
      throw new functions.https.HttpsError('internal', 'Failed to update tracking info');
    }
  });

/**
 * Get order statistics (admin)
 */
export const getOrderStats = functions
  .region('asia-east1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    if (!(await isAdmin(context.auth.uid))) {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }

    try {
      // Count by status for dashboard
      const statusCounts = await orderRepository.countByStatus();

      // Get today's stats
      const today = new Date();
      const dailyStats = await orderRepository.getDailyStats(today);

      // Get weekly stats
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weeklyStats = await orderRepository.getOrderStats(weekAgo, today);

      return {
        success: true,
        statusCounts,
        daily: dailyStats,
        weekly: weeklyStats,
      };
    } catch (error) {
      functions.logger.error('getOrderStats failed:', error);
      throw new functions.https.HttpsError('internal', 'Failed to fetch order stats');
    }
  });

// ============================================
// Admin Print Config Management
// ============================================

/**
 * Update material configuration (admin)
 */
export const updateMaterialConfig = functions
  .region('asia-east1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    if (!(await isAdmin(context.auth.uid))) {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }

    const { material } = data;
    if (!material?.id) {
      throw new functions.https.HttpsError('invalid-argument', 'Material configuration required');
    }

    try {
      await orderRepository.updateMaterial(material);
      return { success: true };
    } catch (error) {
      functions.logger.error('updateMaterialConfig failed:', error);
      throw new functions.https.HttpsError('internal', 'Failed to update material');
    }
  });

/**
 * Update pricing (admin)
 */
export const updatePricing = functions
  .region('asia-east1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    if (!(await isAdmin(context.auth.uid))) {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }

    try {
      if (data?.pricing && typeof data.pricing === 'object') {
        const pricing = {} as Record<PrintMaterial, Record<PrintSizeId, number>>;

        for (const material of PRINT_MATERIALS) {
          const materialPricing = data.pricing[material];
          if (!materialPricing || typeof materialPricing !== 'object') {
            throw new functions.https.HttpsError(
              'invalid-argument',
              `Missing pricing for material: ${material}`
            );
          }

          pricing[material] = {} as Record<PrintSizeId, number>;
          for (const size of PRINT_SIZES) {
            const price = materialPricing[size];
            if (!isValidPrice(price)) {
              throw new functions.https.HttpsError(
                'invalid-argument',
                `Invalid price for ${material}/${size}`
              );
            }
            pricing[material][size] = price;
          }
        }

        await orderRepository.updatePricingMatrix(pricing);
      } else {
        const { material, size, price } = data || {};
        if (!PRINT_MATERIALS.includes(material) ||
            !PRINT_SIZES.includes(size) ||
            !isValidPrice(price)) {
          throw new functions.https.HttpsError(
            'invalid-argument',
            'Valid material, size, and price are required'
          );
        }

        await orderRepository.updatePricing(material, size, price);
      }

      return { success: true };
    } catch (error) {
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      functions.logger.error('updatePricing failed:', error);
      throw new functions.https.HttpsError('internal', 'Failed to update pricing');
    }
  });
