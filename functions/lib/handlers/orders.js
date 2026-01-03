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
const db = admin.firestore();
/**
 * Check if user is admin
 */
async function isAdmin(uid) {
    const userDoc = await db.collection('users').doc(uid).get();
    return userDoc.data()?.role === 'admin';
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
    const limit = data?.limit || 20;
    const offset = data?.offset || 0;
    try {
        const result = await OrderRepository_1.orderRepository.getByUserId(userId, { limit, offset });
        return {
            success: true,
            orders: result.items.map((order) => ({
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
    const { orderId } = data;
    if (!orderId) {
        throw new functions.https.HttpsError('invalid-argument', 'Order ID is required');
    }
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
        return {
            success: true,
            order: {
                ...order,
                createdAt: order.createdAt.toISOString(),
                updatedAt: order.updatedAt.toISOString(),
                confirmedAt: order.confirmedAt?.toISOString(),
                shippedAt: order.shippedAt?.toISOString(),
                deliveredAt: order.deliveredAt?.toISOString(),
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
    const { orderId, reason } = data;
    if (!orderId) {
        throw new functions.https.HttpsError('invalid-argument', 'Order ID is required');
    }
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
    try {
        const [materials, sizes, colors, pricing] = await Promise.all([
            OrderRepository_1.orderRepository.getMaterials(),
            OrderRepository_1.orderRepository.getSizes(),
            OrderRepository_1.orderRepository.getColors(),
            OrderRepository_1.orderRepository.getPricingMatrix(),
        ]);
        return {
            success: true,
            materials: materials.filter((m) => m.available),
            sizes: sizes.filter((s) => s.available),
            colors: colors.filter((c) => c.available),
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
    const { status, userId, fromDate, toDate, limit = 50, offset = 0 } = data || {};
    try {
        const result = await OrderRepository_1.orderRepository.getAll({
            status,
            userId,
            fromDate: fromDate ? new Date(fromDate) : undefined,
            toDate: toDate ? new Date(toDate) : undefined,
        }, { limit, offset });
        return {
            success: true,
            orders: result.items.map((order) => ({
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
    const { status, limit = 20 } = data || {};
    if (!status) {
        throw new functions.https.HttpsError('invalid-argument', 'Status is required');
    }
    try {
        const result = await OrderRepository_1.orderRepository.getByStatus(status, { limit });
        return {
            success: true,
            orders: result.items.map((order) => ({
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
    const { orderId, newStatus, reason, adminNotes, tracking } = data;
    if (!orderId || !newStatus) {
        throw new functions.https.HttpsError('invalid-argument', 'Order ID and status are required');
    }
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
    const { orderId, carrier, trackingNumber, trackingUrl, estimatedDelivery } = data;
    if (!orderId || !carrier || !trackingNumber) {
        throw new functions.https.HttpsError('invalid-argument', 'Order ID, carrier, and tracking number are required');
    }
    try {
        const order = await OrderRepository_1.orderRepository.getById(orderId);
        if (!order) {
            throw new functions.https.HttpsError('not-found', 'Order not found');
        }
        await OrderRepository_1.orderRepository.update(orderId, {
            tracking: {
                carrier,
                trackingNumber,
                trackingUrl,
                estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : undefined,
                shippedAt: order.tracking?.shippedAt || new Date(),
            },
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
    const { material } = data;
    if (!material?.id) {
        throw new functions.https.HttpsError('invalid-argument', 'Material configuration required');
    }
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
    const { material, size, price } = data;
    if (!material || !size || typeof price !== 'number') {
        throw new functions.https.HttpsError('invalid-argument', 'Material, size, and price are required');
    }
    try {
        await OrderRepository_1.orderRepository.updatePricing(material, size, price);
        return { success: true };
    }
    catch (error) {
        functions.logger.error('updatePricing failed:', error);
        throw new functions.https.HttpsError('internal', 'Failed to update pricing');
    }
});
//# sourceMappingURL=orders.js.map