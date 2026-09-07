"use strict";
/**
 * Order Cloud Functions
 *
 * User-facing and admin order management functions
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePricing = exports.updateMaterialConfig = exports.getOrderStats = exports.updateTrackingInfo = exports.updateOrderStatus = exports.getOrdersByStatus = exports.listAllOrders = exports.getPrintConfig = exports.deleteShippingAddress = exports.saveShippingAddress = exports.getShippingAddresses = exports.cancelOrder = exports.getOrderDetails = exports.getUserOrders = exports.createOrder = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const OrderRepository_1 = require("../infrastructure/repositories/OrderRepository");
const WebhookNotificationAdapter_1 = require("../infrastructure/notification/WebhookNotificationAdapter");
const orders_1 = require("../application/orders");
const storage_1 = require("../storage");
const storage_validation_1 = require("../utils/storage-validation");
const order_validation_1 = require("../utils/order-validation");
const order_visibility_1 = require("../utils/order-visibility");
const db = admin.firestore();
const PRINT_MATERIALS = ['pla-single', 'pla-multi', 'resin'];
const PRINT_SIZES = ['5x5x5', '10x10x10', '15x15x15'];
const MAX_PRINT_PRICE_CENTS = 100_000_000;
function isValidPrice(price) {
    return typeof price === 'number' &&
        Number.isInteger(price) &&
        price >= 0 &&
        price <= MAX_PRINT_PRICE_CENTS;
}
function isSafeExternalUrl(value) {
    if (typeof value !== 'string' || value.length > 2048)
        return false;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:';
    }
    catch {
        return false;
    }
}
function parsePageNumber(value, fallback, minimum, maximum, field) {
    if (value === undefined || value === null)
        return fallback;
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
        throw new functions.https.HttpsError('invalid-argument', `${field} must be an integer between ${minimum} and ${maximum}`);
    }
    return value;
}
/**
 * Check if user is admin
 */
async function isAdmin(uid) {
    const userDoc = await db.collection('users').doc(uid).get();
    return userDoc.data()?.role === 'admin';
}
/**
 * Order records keep a durable storage identity and expose a freshly signed
 * access URL. Legacy records can be recovered from their approved URL shape.
 */
async function refreshOrderModelUrls(order) {
    const items = await Promise.all(order.items.map(async (item) => {
        const legacyReference = (0, storage_validation_1.extractStorageReferenceFromUrl)(item.modelUrl);
        const storagePath = item.modelStoragePath || legacyReference?.storagePath;
        const storedBackend = item.modelStorageBackend;
        const backend = storedBackend === 'firebase' || storedBackend === 'r2'
            ? storedBackend
            : legacyReference?.backend;
        const thumbnailReference = item.modelThumbnail
            ? (0, storage_validation_1.extractStorageReferenceFromUrl)(item.modelThumbnail)
            : null;
        const thumbnailPath = item.modelThumbnailStoragePath || thumbnailReference?.storagePath;
        const thumbnailBackend = item.modelThumbnailStorageBackend || thumbnailReference?.backend;
        let modelThumbnail;
        if (thumbnailPath && thumbnailBackend) {
            try {
                modelThumbnail = await (0, storage_1.getSignedUrl)(thumbnailPath, 3600, thumbnailBackend);
            }
            catch {
                modelThumbnail = undefined;
            }
        }
        const sanitizedItem = { ...item, modelThumbnail };
        if (!storagePath || !backend)
            return sanitizedItem;
        if (!item.modelStoragePath &&
            (!legacyReference || legacyReference.storagePath !== storagePath)) {
            return sanitizedItem;
        }
        try {
            return {
                ...sanitizedItem,
                modelUrl: await (0, storage_1.getSignedUrl)(storagePath, 3600, backend),
                modelStoragePath: storagePath,
                modelStorageBackend: backend,
                modelThumbnail,
                ...(modelThumbnail && {
                    modelThumbnailStoragePath: thumbnailPath,
                    modelThumbnailStorageBackend: thumbnailBackend,
                }),
            };
        }
        catch (error) {
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
exports.createOrder = functions
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
    const useCase = new orders_1.CreateOrderUseCase(OrderRepository_1.orderRepository, WebhookNotificationAdapter_1.webhookNotificationAdapter);
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
    }
    catch (error) {
        functions.logger.error('createOrder failed:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', error instanceof Error ? error.message : 'Failed to create order');
    }
});
/**
 * Get user's orders
 */
exports.getUserOrders = functions
    .region('asia-east1')
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    const userId = context.auth.uid;
    const limit = parsePageNumber(data?.limit, 20, 1, 50, 'limit');
    const offset = parsePageNumber(data?.offset, 0, 0, 1000, 'offset');
    try {
        const result = await OrderRepository_1.orderRepository.getByUserId(userId, { limit, offset });
        const refreshedOrders = await Promise.all(result.items.map((order) => refreshOrderModelUrls(order)));
        return {
            success: true,
            orders: refreshedOrders.map((order) => ({
                ...(0, order_visibility_1.customerOrder)(order),
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
    }
    catch (error) {
        functions.logger.error('getUserOrders failed:', error);
        throw new functions.https.HttpsError('internal', 'Failed to fetch orders');
    }
});
/**
 * Get single order details
 */
exports.getOrderDetails = functions
    .region('asia-east1')
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    const orderId = (0, order_validation_1.orderId)(data?.orderId);
    try {
        const order = await OrderRepository_1.orderRepository.getById(orderId);
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
                ...(userIsAdmin ? refreshedOrder : (0, order_visibility_1.customerOrder)(refreshedOrder)),
                createdAt: refreshedOrder.createdAt.toISOString(),
                updatedAt: refreshedOrder.updatedAt.toISOString(),
                confirmedAt: refreshedOrder.confirmedAt?.toISOString(),
                shippedAt: refreshedOrder.shippedAt?.toISOString(),
                deliveredAt: refreshedOrder.deliveredAt?.toISOString(),
            },
        };
    }
    catch (error) {
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
exports.cancelOrder = functions
    .region('asia-east1')
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    const orderId = (0, order_validation_1.orderId)(data?.orderId);
    const reason = (0, order_validation_1.optionalOrderText)(data?.reason, 'Reason');
    const useCase = new orders_1.CancelOrderUseCase(OrderRepository_1.orderRepository, WebhookNotificationAdapter_1.webhookNotificationAdapter);
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
    }
    catch (error) {
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
exports.getShippingAddresses = functions
    .region('asia-east1')
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    try {
        const addresses = await OrderRepository_1.orderRepository.getAddresses(context.auth.uid);
        return { success: true, addresses };
    }
    catch (error) {
        functions.logger.error('getShippingAddresses failed:', error);
        throw new functions.https.HttpsError('internal', 'Failed to fetch addresses');
    }
});
/**
 * Save a shipping address
 */
exports.saveShippingAddress = functions
    .region('asia-east1')
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    const address = {
        ...data.address,
        id: data.address?.id,
    };
    // Validate required fields
    if (!address.recipientName || !address.phone || !address.country ||
        !address.city || !address.addressLine1) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required address fields');
    }
    try {
        const addressId = await OrderRepository_1.orderRepository.saveAddress(context.auth.uid, address);
        return { success: true, addressId };
    }
    catch (error) {
        functions.logger.error('saveShippingAddress failed:', error);
        throw new functions.https.HttpsError('internal', 'Failed to save address');
    }
});
/**
 * Delete a shipping address
 */
exports.deleteShippingAddress = functions
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
        await OrderRepository_1.orderRepository.deleteAddress(context.auth.uid, addressId);
        return { success: true };
    }
    catch (error) {
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
exports.getPrintConfig = functions
    .region('asia-east1')
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    if (data?.includeUnavailable != null && typeof data.includeUnavailable !== 'boolean') {
        throw new functions.https.HttpsError('invalid-argument', 'includeUnavailable must be a boolean');
    }
    const includeUnavailable = data?.includeUnavailable === true;
    if (includeUnavailable && !(await isAdmin(context.auth.uid))) {
        throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }
    try {
        const [materials, sizes, colors, pricing] = await Promise.all([
            OrderRepository_1.orderRepository.getMaterials(),
            OrderRepository_1.orderRepository.getSizes(),
            OrderRepository_1.orderRepository.getColors(),
            OrderRepository_1.orderRepository.getPricingMatrix(),
        ]);
        return {
            success: true,
            materials: includeUnavailable ? materials : materials.filter((m) => m.available),
            sizes: includeUnavailable ? sizes : sizes.filter((s) => s.available),
            colors: includeUnavailable ? colors : colors.filter((c) => c.available),
            pricing,
        };
    }
    catch (error) {
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
exports.listAllOrders = functions
    .region('asia-east1')
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    if (!(await isAdmin(context.auth.uid))) {
        throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }
    const input = data || {};
    const status = (0, order_validation_1.optionalOrderStatusFilter)(input.status);
    const userId = (0, order_validation_1.optionalOrderText)(input.userId, 'User ID', 128);
    const fromDate = (0, order_validation_1.orderDate)(input.fromDate, 'start date');
    const toDate = (0, order_validation_1.orderDate)(input.toDate, 'end date');
    if (fromDate && toDate && fromDate > toDate) {
        throw new functions.https.HttpsError('invalid-argument', 'Start date must precede end date');
    }
    const limit = parsePageNumber(data?.limit, 50, 1, 50, 'limit');
    const offset = parsePageNumber(data?.offset, 0, 0, Number.MAX_SAFE_INTEGER, 'offset');
    try {
        const result = await OrderRepository_1.orderRepository.getAll({
            status,
            userId,
            fromDate,
            toDate,
        }, { limit, offset });
        const refreshedOrders = await Promise.all(result.items.map((order) => refreshOrderModelUrls(order)));
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
    }
    catch (error) {
        functions.logger.error('listAllOrders failed:', error);
        throw new functions.https.HttpsError('internal', 'Failed to fetch orders');
    }
});
/**
 * Get orders by status (admin - for Kanban)
 */
exports.getOrdersByStatus = functions
    .region('asia-east1')
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    if (!(await isAdmin(context.auth.uid))) {
        throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }
    const status = (0, order_validation_1.orderStatus)(data?.status);
    const limit = parsePageNumber(data?.limit, 20, 1, 50, 'limit');
    if (!status) {
        throw new functions.https.HttpsError('invalid-argument', 'Status is required');
    }
    try {
        const result = await OrderRepository_1.orderRepository.getByStatus(status, { limit });
        const refreshedOrders = await Promise.all(result.items.map((order) => refreshOrderModelUrls(order)));
        return {
            success: true,
            orders: refreshedOrders.map((order) => ({
                ...order,
                createdAt: order.createdAt.toISOString(),
                updatedAt: order.updatedAt.toISOString(),
            })),
            total: result.total,
        };
    }
    catch (error) {
        functions.logger.error('getOrdersByStatus failed:', error);
        throw new functions.https.HttpsError('internal', 'Failed to fetch orders');
    }
});
/**
 * Update order status (admin)
 */
exports.updateOrderStatus = functions
    .region('asia-east1')
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    if (!(await isAdmin(context.auth.uid))) {
        throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }
    const orderId = (0, order_validation_1.orderId)(data?.orderId);
    const newStatus = (0, order_validation_1.orderStatus)(data?.newStatus);
    const reason = (0, order_validation_1.optionalOrderText)(data?.reason, 'Reason');
    const adminNotes = (0, order_validation_1.optionalOrderText)(data?.adminNotes, 'Admin notes', 5000);
    const tracking = (0, order_validation_1.optionalOrderTracking)(data?.tracking);
    const useCase = new orders_1.UpdateOrderStatusUseCase(OrderRepository_1.orderRepository, WebhookNotificationAdapter_1.webhookNotificationAdapter);
    try {
        const result = await useCase.execute({
            orderId,
            newStatus: newStatus,
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
    }
    catch (error) {
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
exports.updateTrackingInfo = functions
    .region('asia-east1')
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    if (!(await isAdmin(context.auth.uid))) {
        throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }
    const orderId = (0, order_validation_1.orderId)(data?.orderId);
    const tracking = (0, order_validation_1.orderTracking)(data);
    try {
        await OrderRepository_1.orderRepository.updateAtomically(orderId, (order) => {
            if (order.status !== 'shipping' && order.status !== 'delivered') {
                throw new functions.https.HttpsError('failed-precondition', 'Tracking can only be updated for shipped orders');
            }
            return {
                ...order,
                tracking: {
                    ...tracking,
                    ...(tracking.estimatedDelivery === undefined && order.tracking?.estimatedDelivery && {
                        estimatedDelivery: order.tracking.estimatedDelivery,
                    }),
                    shippedAt: order.tracking?.shippedAt || order.shippedAt || new Date(),
                },
            };
        });
        return { success: true };
    }
    catch (error) {
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
exports.getOrderStats = functions
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
        const statusCounts = await OrderRepository_1.orderRepository.countByStatus();
        // Get today's stats
        const today = new Date();
        const dailyStats = await OrderRepository_1.orderRepository.getDailyStats(today);
        // Get weekly stats
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weeklyStats = await OrderRepository_1.orderRepository.getOrderStats(weekAgo, today);
        return {
            success: true,
            statusCounts,
            daily: dailyStats,
            weekly: weeklyStats,
        };
    }
    catch (error) {
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
exports.updateMaterialConfig = functions
    .region('asia-east1')
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    if (!(await isAdmin(context.auth.uid))) {
        throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }
    const material = (0, order_validation_1.orderMaterial)(data?.material);
    try {
        await OrderRepository_1.orderRepository.updateMaterial(material);
        return { success: true };
    }
    catch (error) {
        functions.logger.error('updateMaterialConfig failed:', error);
        throw new functions.https.HttpsError('internal', 'Failed to update material');
    }
});
/**
 * Update pricing (admin)
 */
exports.updatePricing = functions
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
            const pricing = {};
            for (const material of PRINT_MATERIALS) {
                const materialPricing = data.pricing[material];
                if (!materialPricing || typeof materialPricing !== 'object') {
                    throw new functions.https.HttpsError('invalid-argument', `Missing pricing for material: ${material}`);
                }
                pricing[material] = {};
                for (const size of PRINT_SIZES) {
                    const price = materialPricing[size];
                    if (!isValidPrice(price)) {
                        throw new functions.https.HttpsError('invalid-argument', `Invalid price for ${material}/${size}`);
                    }
                    pricing[material][size] = price;
                }
            }
            await OrderRepository_1.orderRepository.updatePricingMatrix(pricing);
        }
        else {
            const { material, size, price } = data || {};
            if (!PRINT_MATERIALS.includes(material) ||
                !PRINT_SIZES.includes(size) ||
                !isValidPrice(price)) {
                throw new functions.https.HttpsError('invalid-argument', 'Valid material, size, and price are required');
            }
            await OrderRepository_1.orderRepository.updatePricing(material, size, price);
        }
        return { success: true };
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        functions.logger.error('updatePricing failed:', error);
        throw new functions.https.HttpsError('internal', 'Failed to update pricing');
    }
});
//# sourceMappingURL=orders.js.map