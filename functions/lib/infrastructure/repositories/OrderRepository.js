"use strict";
/**
 * Firestore Order Repository
 *
 * Clean Architecture: Concrete implementation of IOrderRepository
 * Handles all order-related Firestore operations
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
exports.orderRepository = exports.FirestoreOrderRepository = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const types_1 = require("../../domain/order/types");
const db = admin.firestore();
// Collection names
const ORDERS_COLLECTION = 'orders';
const SHIPPING_ADDRESSES_COLLECTION = 'shippingAddresses';
const PRINT_CONFIG_COLLECTION = 'printConfig';
const USERS_COLLECTION = 'users';
/**
 * Convert Firestore Timestamp to Date
 */
function timestampToDate(timestamp) {
    if (!timestamp)
        return undefined;
    if (timestamp instanceof Date)
        return timestamp;
    return timestamp.toDate();
}
/**
 * Convert Order document from Firestore format
 */
function convertOrderDoc(doc) {
    if (!doc.exists)
        return null;
    const data = doc.data();
    return {
        ...data,
        id: doc.id,
        createdAt: timestampToDate(data.createdAt) || new Date(),
        updatedAt: timestampToDate(data.updatedAt) || new Date(),
        confirmedAt: timestampToDate(data.confirmedAt),
        printedAt: timestampToDate(data.printedAt),
        shippedAt: timestampToDate(data.shippedAt),
        deliveredAt: timestampToDate(data.deliveredAt),
        cancelledAt: timestampToDate(data.cancelledAt),
        refundedAt: timestampToDate(data.refundedAt),
        statusHistory: (data.statusHistory || []).map((change) => ({
            ...change,
            changedAt: timestampToDate(change.changedAt) || new Date(),
        })),
        tracking: data.tracking ? {
            ...data.tracking,
            shippedAt: timestampToDate(data.tracking.shippedAt) || new Date(),
            estimatedDelivery: timestampToDate(data.tracking.estimatedDelivery),
        } : undefined,
        payment: {
            ...data.payment,
            paidAt: timestampToDate(data.payment?.paidAt),
            refundedAt: timestampToDate(data.payment?.refundedAt),
        },
    };
}
/**
 * Firestore Order Repository Implementation
 */
class FirestoreOrderRepository {
    // ============================================
    // Order CRUD
    // ============================================
    async create(order) {
        const orderRef = db.collection(ORDERS_COLLECTION).doc(order.id);
        await orderRef.set({
            ...order,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        functions.logger.info('Order created', { orderId: order.id, userId: order.userId });
        return order.id;
    }
    async getById(orderId) {
        const doc = await db.collection(ORDERS_COLLECTION).doc(orderId).get();
        return convertOrderDoc(doc);
    }
    async getByIdWithUser(orderId) {
        const orderDoc = await db.collection(ORDERS_COLLECTION).doc(orderId).get();
        const order = convertOrderDoc(orderDoc);
        if (!order)
            return null;
        // Fetch user info
        const userDoc = await db.collection(USERS_COLLECTION).doc(order.userId).get();
        const userData = userDoc.data();
        return {
            ...order,
            userDisplayName: userData?.displayName || 'Unknown',
            userEmail: userData?.email || '',
            userPhotoURL: userData?.photoURL || null,
        };
    }
    async update(orderId, updates) {
        const orderRef = db.collection(ORDERS_COLLECTION).doc(orderId);
        await orderRef.update({
            ...updates,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        functions.logger.info('Order updated', { orderId, updates: Object.keys(updates) });
    }
    async delete(orderId) {
        // Soft delete by marking as cancelled
        await this.update(orderId, {
            status: 'cancelled',
            cancelledAt: new Date(),
        });
    }
    // ============================================
    // Order Queries
    // ============================================
    async getByUserId(userId, pagination = {}) {
        const { limit = 20, offset = 0 } = pagination;
        // Count total
        const countSnapshot = await db.collection(ORDERS_COLLECTION)
            .where('userId', '==', userId)
            .count()
            .get();
        const total = countSnapshot.data().count;
        // Fetch orders
        let query = db.collection(ORDERS_COLLECTION)
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(limit);
        if (offset > 0) {
            // Get the offset document for pagination
            const offsetQuery = await db.collection(ORDERS_COLLECTION)
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .limit(offset)
                .get();
            if (offsetQuery.docs.length > 0) {
                const lastDoc = offsetQuery.docs[offsetQuery.docs.length - 1];
                query = query.startAfter(lastDoc);
            }
        }
        const snapshot = await query.get();
        const items = snapshot.docs.map((doc) => convertOrderDoc(doc)).filter(Boolean);
        return {
            items,
            total,
            hasMore: offset + items.length < total,
        };
    }
    async getAll(filters = {}, pagination = {}) {
        const { limit = 20, offset = 0 } = pagination;
        let query = db.collection(ORDERS_COLLECTION);
        // Apply filters
        if (filters.userId) {
            query = query.where('userId', '==', filters.userId);
        }
        if (filters.status) {
            if (Array.isArray(filters.status)) {
                query = query.where('status', 'in', filters.status);
            }
            else {
                query = query.where('status', '==', filters.status);
            }
        }
        if (filters.fromDate) {
            query = query.where('createdAt', '>=', filters.fromDate);
        }
        if (filters.toDate) {
            query = query.where('createdAt', '<=', filters.toDate);
        }
        // Order by createdAt
        query = query.orderBy('createdAt', 'desc');
        // Get count (approximate for complex queries)
        const countSnapshot = await query.count().get();
        const total = countSnapshot.data().count;
        // Apply pagination
        query = query.limit(limit).offset(offset);
        const snapshot = await query.get();
        const orders = snapshot.docs.map((doc) => convertOrderDoc(doc)).filter(Boolean);
        // Fetch user info for each order
        const userIds = [...new Set(orders.map((o) => o.userId))];
        const userDocs = await Promise.all(userIds.map((uid) => db.collection(USERS_COLLECTION).doc(uid).get()));
        const userMap = new Map(userDocs.map((doc) => [doc.id, doc.data()]));
        const items = orders.map((order) => {
            const userData = userMap.get(order.userId);
            return {
                ...order,
                userDisplayName: userData?.displayName || 'Unknown',
                userEmail: userData?.email || '',
                userPhotoURL: userData?.photoURL || null,
            };
        });
        return {
            items,
            total,
            hasMore: offset + items.length < total,
        };
    }
    async getByStatus(status, pagination = {}) {
        return this.getAll({ status }, pagination);
    }
    async countByStatus() {
        const statuses = [
            'pending', 'confirmed', 'printing', 'quality_check',
            'shipping', 'delivered', 'cancelled', 'refunded',
        ];
        const counts = {};
        await Promise.all(statuses.map(async (status) => {
            const snapshot = await db.collection(ORDERS_COLLECTION)
                .where('status', '==', status)
                .count()
                .get();
            counts[status] = snapshot.data().count;
        }));
        return counts;
    }
    // ============================================
    // Shipping Addresses
    // ============================================
    async saveAddress(userId, address) {
        const addressesRef = db.collection(SHIPPING_ADDRESSES_COLLECTION)
            .doc(userId)
            .collection('addresses');
        // If setting as default, unset other defaults
        if (address.isDefault) {
            const existingDefaults = await addressesRef
                .where('isDefault', '==', true)
                .get();
            const batch = db.batch();
            existingDefaults.docs.forEach((doc) => {
                batch.update(doc.ref, { isDefault: false });
            });
            if (address.id) {
                const addressRef = addressesRef.doc(address.id);
                batch.set(addressRef, address, { merge: true });
                await batch.commit();
                return address.id;
            }
            else {
                await batch.commit();
                const newRef = await addressesRef.add(address);
                return newRef.id;
            }
        }
        if (address.id) {
            await addressesRef.doc(address.id).set(address, { merge: true });
            return address.id;
        }
        else {
            const newRef = await addressesRef.add(address);
            return newRef.id;
        }
    }
    async getAddresses(userId) {
        const snapshot = await db.collection(SHIPPING_ADDRESSES_COLLECTION)
            .doc(userId)
            .collection('addresses')
            .orderBy('isDefault', 'desc')
            .get();
        return snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
    }
    async deleteAddress(userId, addressId) {
        await db.collection(SHIPPING_ADDRESSES_COLLECTION)
            .doc(userId)
            .collection('addresses')
            .doc(addressId)
            .delete();
    }
    async setDefaultAddress(userId, addressId) {
        const addressesRef = db.collection(SHIPPING_ADDRESSES_COLLECTION)
            .doc(userId)
            .collection('addresses');
        // Unset all defaults and set the new one
        const batch = db.batch();
        const existingDefaults = await addressesRef
            .where('isDefault', '==', true)
            .get();
        existingDefaults.docs.forEach((doc) => {
            batch.update(doc.ref, { isDefault: false });
        });
        batch.update(addressesRef.doc(addressId), { isDefault: true });
        await batch.commit();
    }
    // ============================================
    // Print Configuration
    // ============================================
    async getMaterials() {
        const doc = await db.collection(PRINT_CONFIG_COLLECTION).doc('materials').get();
        if (!doc.exists) {
            // Return defaults
            return Object.values(types_1.MATERIAL_CONFIGS);
        }
        const data = doc.data();
        return data?.items || Object.values(types_1.MATERIAL_CONFIGS);
    }
    async getSizes() {
        const doc = await db.collection(PRINT_CONFIG_COLLECTION).doc('sizes').get();
        if (!doc.exists) {
            return Object.values(types_1.SIZE_CONFIGS);
        }
        const data = doc.data();
        return data?.items || Object.values(types_1.SIZE_CONFIGS);
    }
    async getColors() {
        const doc = await db.collection(PRINT_CONFIG_COLLECTION).doc('colors').get();
        if (!doc.exists) {
            return types_1.DEFAULT_COLORS;
        }
        const data = doc.data();
        return data?.items || types_1.DEFAULT_COLORS;
    }
    async getPrice(material, size) {
        const doc = await db.collection(PRINT_CONFIG_COLLECTION).doc('pricing').get();
        if (!doc.exists) {
            return types_1.DEFAULT_PRICING[material]?.[size] || 0;
        }
        const data = doc.data();
        return data?.matrix?.[material]?.[size] || types_1.DEFAULT_PRICING[material]?.[size] || 0;
    }
    async getPricingMatrix() {
        const doc = await db.collection(PRINT_CONFIG_COLLECTION).doc('pricing').get();
        if (!doc.exists) {
            return types_1.DEFAULT_PRICING;
        }
        const data = doc.data();
        return data?.matrix || types_1.DEFAULT_PRICING;
    }
    // ============================================
    // Admin Configuration (Write)
    // ============================================
    async updateMaterial(material) {
        const doc = await db.collection(PRINT_CONFIG_COLLECTION).doc('materials').get();
        const existing = doc.exists ? doc.data()?.items || [] : Object.values(types_1.MATERIAL_CONFIGS);
        const index = existing.findIndex((m) => m.id === material.id);
        if (index >= 0) {
            existing[index] = material;
        }
        else {
            existing.push(material);
        }
        await db.collection(PRINT_CONFIG_COLLECTION).doc('materials').set({
            items: existing,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    async updateSize(size) {
        const doc = await db.collection(PRINT_CONFIG_COLLECTION).doc('sizes').get();
        const existing = doc.exists ? doc.data()?.items || [] : Object.values(types_1.SIZE_CONFIGS);
        const index = existing.findIndex((s) => s.id === size.id);
        if (index >= 0) {
            existing[index] = size;
        }
        else {
            existing.push(size);
        }
        await db.collection(PRINT_CONFIG_COLLECTION).doc('sizes').set({
            items: existing,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    async updateColor(color) {
        const doc = await db.collection(PRINT_CONFIG_COLLECTION).doc('colors').get();
        const existing = doc.exists ? doc.data()?.items || [] : types_1.DEFAULT_COLORS;
        const index = existing.findIndex((c) => c.id === color.id);
        if (index >= 0) {
            existing[index] = color;
        }
        else {
            existing.push(color);
        }
        await db.collection(PRINT_CONFIG_COLLECTION).doc('colors').set({
            items: existing,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    async updatePricing(material, size, price) {
        const doc = await db.collection(PRINT_CONFIG_COLLECTION).doc('pricing').get();
        const matrix = doc.exists ? doc.data()?.matrix || types_1.DEFAULT_PRICING : types_1.DEFAULT_PRICING;
        if (!matrix[material]) {
            matrix[material] = {};
        }
        matrix[material][size] = price;
        await db.collection(PRINT_CONFIG_COLLECTION).doc('pricing').set({
            matrix,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    // ============================================
    // Reports
    // ============================================
    async getOrderStats(fromDate, toDate) {
        const snapshot = await db.collection(ORDERS_COLLECTION)
            .where('createdAt', '>=', fromDate)
            .where('createdAt', '<=', toDate)
            .get();
        const orders = snapshot.docs.map((doc) => convertOrderDoc(doc));
        const ordersByStatus = {
            pending: 0, confirmed: 0, printing: 0, quality_check: 0,
            shipping: 0, delivered: 0, cancelled: 0, refunded: 0,
        };
        const ordersByMaterial = {
            'pla-single': 0, 'pla-multi': 0, resin: 0,
        };
        const ordersBySize = {
            '5x5x5': 0, '10x10x10': 0, '15x15x15': 0,
        };
        let totalRevenue = 0;
        orders.forEach((order) => {
            ordersByStatus[order.status]++;
            totalRevenue += order.payment.totalAmount;
            order.items.forEach((item) => {
                ordersByMaterial[item.material] = (ordersByMaterial[item.material] || 0) + item.quantity;
                ordersBySize[item.size] = (ordersBySize[item.size] || 0) + item.quantity;
            });
        });
        return {
            totalOrders: orders.length,
            totalRevenue,
            ordersByStatus,
            ordersByMaterial,
            ordersBySize,
        };
    }
    async getDailyStats(date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        const snapshot = await db.collection(ORDERS_COLLECTION)
            .where('createdAt', '>=', startOfDay)
            .where('createdAt', '<=', endOfDay)
            .get();
        const orders = snapshot.docs.map((doc) => convertOrderDoc(doc));
        const uniqueUserIds = new Set(orders.map((o) => o.userId));
        // Count new customers (users who have only this order)
        let newCustomers = 0;
        for (const userId of uniqueUserIds) {
            const userOrders = await db.collection(ORDERS_COLLECTION)
                .where('userId', '==', userId)
                .where('createdAt', '<', startOfDay)
                .limit(1)
                .get();
            if (userOrders.empty) {
                newCustomers++;
            }
        }
        const revenue = orders.reduce((sum, o) => sum + o.payment.totalAmount, 0);
        return {
            orders: orders.length,
            revenue,
            newCustomers,
        };
    }
}
exports.FirestoreOrderRepository = FirestoreOrderRepository;
/**
 * Singleton instance
 */
exports.orderRepository = new FirestoreOrderRepository();
//# sourceMappingURL=OrderRepository.js.map