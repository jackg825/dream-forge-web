/**
 * Firestore Order Repository
 *
 * Clean Architecture: Concrete implementation of IOrderRepository
 * Handles all order-related Firestore operations
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import {
  IOrderRepository,
  PaginationParams,
  PaginatedResult,
  OrderFilterParams,
} from '../../domain/ports/IOrderRepository';
import {
  Order,
  AdminOrder,
  OrderStatus,
  ShippingAddress,
  PrintMaterial,
  PrintSizeId,
  MaterialConfig,
  SizeConfig,
  ColorOption,
  MATERIAL_CONFIGS,
  SIZE_CONFIGS,
  DEFAULT_COLORS,
  DEFAULT_PRICING,
} from '../../domain/order/types';

const db = admin.firestore();

// Collection names
const ORDERS_COLLECTION = 'orders';
const SHIPPING_ADDRESSES_COLLECTION = 'shippingAddresses';
const PRINT_CONFIG_COLLECTION = 'printConfig';
const USERS_COLLECTION = 'users';

/**
 * Convert Firestore Timestamp to Date
 */
function timestampToDate(timestamp: admin.firestore.Timestamp | Date | undefined): Date | undefined {
  if (!timestamp) return undefined;
  if (timestamp instanceof Date) return timestamp;
  return timestamp.toDate();
}

/**
 * Convert Order document from Firestore format
 */
function convertOrderDoc(doc: admin.firestore.DocumentSnapshot): Order | null {
  if (!doc.exists) return null;

  const data = doc.data()!;
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
    statusHistory: (data.statusHistory || []).map((change: any) => ({
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
  } as Order;
}

/**
 * Firestore Order Repository Implementation
 */
export class FirestoreOrderRepository implements IOrderRepository {
  // ============================================
  // Order CRUD
  // ============================================

  async create(order: Order): Promise<string> {
    const orderRef = db.collection(ORDERS_COLLECTION).doc(order.id);

    await orderRef.set({
      ...order,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    functions.logger.info('Order created', { orderId: order.id, userId: order.userId });
    return order.id;
  }

  async getById(orderId: string): Promise<Order | null> {
    const doc = await db.collection(ORDERS_COLLECTION).doc(orderId).get();
    return convertOrderDoc(doc);
  }

  async getByIdWithUser(orderId: string): Promise<AdminOrder | null> {
    const orderDoc = await db.collection(ORDERS_COLLECTION).doc(orderId).get();
    const order = convertOrderDoc(orderDoc);

    if (!order) return null;

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

  async update(orderId: string, updates: Partial<Order>): Promise<void> {
    const orderRef = db.collection(ORDERS_COLLECTION).doc(orderId);

    await orderRef.update({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    functions.logger.info('Order updated', { orderId, updates: Object.keys(updates) });
  }

  async delete(orderId: string): Promise<void> {
    // Soft delete by marking as cancelled
    await this.update(orderId, {
      status: 'cancelled',
      cancelledAt: new Date(),
    });
  }

  // ============================================
  // Order Queries
  // ============================================

  async getByUserId(
    userId: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResult<Order>> {
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
    const items = snapshot.docs.map((doc) => convertOrderDoc(doc)!).filter(Boolean);

    return {
      items,
      total,
      hasMore: offset + items.length < total,
    };
  }

  async getAll(
    filters: OrderFilterParams = {},
    pagination: PaginationParams = {}
  ): Promise<PaginatedResult<AdminOrder>> {
    const { limit = 20, offset = 0 } = pagination;

    let query: admin.firestore.Query = db.collection(ORDERS_COLLECTION);

    // Apply filters
    if (filters.userId) {
      query = query.where('userId', '==', filters.userId);
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.where('status', 'in', filters.status);
      } else {
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
    const orders = snapshot.docs.map((doc) => convertOrderDoc(doc)!).filter(Boolean);

    // Fetch user info for each order
    const userIds = [...new Set(orders.map((o) => o.userId))];
    const userDocs = await Promise.all(
      userIds.map((uid) => db.collection(USERS_COLLECTION).doc(uid).get())
    );
    const userMap = new Map(
      userDocs.map((doc) => [doc.id, doc.data()])
    );

    const items: AdminOrder[] = orders.map((order) => {
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

  async getByStatus(
    status: OrderStatus,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResult<AdminOrder>> {
    return this.getAll({ status }, pagination);
  }

  async countByStatus(): Promise<Record<OrderStatus, number>> {
    const statuses: OrderStatus[] = [
      'pending', 'confirmed', 'printing', 'quality_check',
      'shipping', 'delivered', 'cancelled', 'refunded',
    ];

    const counts: Record<OrderStatus, number> = {} as Record<OrderStatus, number>;

    await Promise.all(
      statuses.map(async (status) => {
        const snapshot = await db.collection(ORDERS_COLLECTION)
          .where('status', '==', status)
          .count()
          .get();
        counts[status] = snapshot.data().count;
      })
    );

    return counts;
  }

  // ============================================
  // Shipping Addresses
  // ============================================

  async saveAddress(userId: string, address: ShippingAddress): Promise<string> {
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
      } else {
        await batch.commit();
        const newRef = await addressesRef.add(address);
        return newRef.id;
      }
    }

    if (address.id) {
      await addressesRef.doc(address.id).set(address, { merge: true });
      return address.id;
    } else {
      const newRef = await addressesRef.add(address);
      return newRef.id;
    }
  }

  async getAddresses(userId: string): Promise<ShippingAddress[]> {
    const snapshot = await db.collection(SHIPPING_ADDRESSES_COLLECTION)
      .doc(userId)
      .collection('addresses')
      .orderBy('isDefault', 'desc')
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ShippingAddress[];
  }

  async deleteAddress(userId: string, addressId: string): Promise<void> {
    await db.collection(SHIPPING_ADDRESSES_COLLECTION)
      .doc(userId)
      .collection('addresses')
      .doc(addressId)
      .delete();
  }

  async setDefaultAddress(userId: string, addressId: string): Promise<void> {
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

  async getMaterials(): Promise<MaterialConfig[]> {
    const doc = await db.collection(PRINT_CONFIG_COLLECTION).doc('materials').get();

    if (!doc.exists) {
      // Return defaults
      return Object.values(MATERIAL_CONFIGS);
    }

    const data = doc.data();
    return data?.items || Object.values(MATERIAL_CONFIGS);
  }

  async getSizes(): Promise<SizeConfig[]> {
    const doc = await db.collection(PRINT_CONFIG_COLLECTION).doc('sizes').get();

    if (!doc.exists) {
      return Object.values(SIZE_CONFIGS);
    }

    const data = doc.data();
    return data?.items || Object.values(SIZE_CONFIGS);
  }

  async getColors(): Promise<ColorOption[]> {
    const doc = await db.collection(PRINT_CONFIG_COLLECTION).doc('colors').get();

    if (!doc.exists) {
      return DEFAULT_COLORS;
    }

    const data = doc.data();
    return data?.items || DEFAULT_COLORS;
  }

  async getPrice(material: PrintMaterial, size: PrintSizeId): Promise<number> {
    const doc = await db.collection(PRINT_CONFIG_COLLECTION).doc('pricing').get();

    if (!doc.exists) {
      return DEFAULT_PRICING[material]?.[size] || 0;
    }

    const data = doc.data();
    return data?.matrix?.[material]?.[size] || DEFAULT_PRICING[material]?.[size] || 0;
  }

  async getPricingMatrix(): Promise<Record<PrintMaterial, Record<PrintSizeId, number>>> {
    const doc = await db.collection(PRINT_CONFIG_COLLECTION).doc('pricing').get();

    if (!doc.exists) {
      return DEFAULT_PRICING;
    }

    const data = doc.data();
    return data?.matrix || DEFAULT_PRICING;
  }

  // ============================================
  // Admin Configuration (Write)
  // ============================================

  async updateMaterial(material: MaterialConfig): Promise<void> {
    const doc = await db.collection(PRINT_CONFIG_COLLECTION).doc('materials').get();
    const existing = doc.exists ? doc.data()?.items || [] : Object.values(MATERIAL_CONFIGS);

    const index = existing.findIndex((m: MaterialConfig) => m.id === material.id);
    if (index >= 0) {
      existing[index] = material;
    } else {
      existing.push(material);
    }

    await db.collection(PRINT_CONFIG_COLLECTION).doc('materials').set({
      items: existing,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  async updateSize(size: SizeConfig): Promise<void> {
    const doc = await db.collection(PRINT_CONFIG_COLLECTION).doc('sizes').get();
    const existing = doc.exists ? doc.data()?.items || [] : Object.values(SIZE_CONFIGS);

    const index = existing.findIndex((s: SizeConfig) => s.id === size.id);
    if (index >= 0) {
      existing[index] = size;
    } else {
      existing.push(size);
    }

    await db.collection(PRINT_CONFIG_COLLECTION).doc('sizes').set({
      items: existing,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  async updateColor(color: ColorOption): Promise<void> {
    const doc = await db.collection(PRINT_CONFIG_COLLECTION).doc('colors').get();
    const existing = doc.exists ? doc.data()?.items || [] : DEFAULT_COLORS;

    const index = existing.findIndex((c: ColorOption) => c.id === color.id);
    if (index >= 0) {
      existing[index] = color;
    } else {
      existing.push(color);
    }

    await db.collection(PRINT_CONFIG_COLLECTION).doc('colors').set({
      items: existing,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  async updatePricing(
    material: PrintMaterial,
    size: PrintSizeId,
    price: number
  ): Promise<void> {
    const doc = await db.collection(PRINT_CONFIG_COLLECTION).doc('pricing').get();
    const matrix = doc.exists ? doc.data()?.matrix || DEFAULT_PRICING : DEFAULT_PRICING;

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

  async getOrderStats(
    fromDate: Date,
    toDate: Date
  ): Promise<{
    totalOrders: number;
    totalRevenue: number;
    ordersByStatus: Record<OrderStatus, number>;
    ordersByMaterial: Record<PrintMaterial, number>;
    ordersBySize: Record<PrintSizeId, number>;
  }> {
    const snapshot = await db.collection(ORDERS_COLLECTION)
      .where('createdAt', '>=', fromDate)
      .where('createdAt', '<=', toDate)
      .get();

    const orders = snapshot.docs.map((doc) => convertOrderDoc(doc)!);

    const ordersByStatus: Record<OrderStatus, number> = {
      pending: 0, confirmed: 0, printing: 0, quality_check: 0,
      shipping: 0, delivered: 0, cancelled: 0, refunded: 0,
    };

    const ordersByMaterial: Record<PrintMaterial, number> = {
      'pla-single': 0, 'pla-multi': 0, resin: 0,
    };

    const ordersBySize: Record<PrintSizeId, number> = {
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

  async getDailyStats(date: Date): Promise<{
    orders: number;
    revenue: number;
    newCustomers: number;
  }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const snapshot = await db.collection(ORDERS_COLLECTION)
      .where('createdAt', '>=', startOfDay)
      .where('createdAt', '<=', endOfDay)
      .get();

    const orders = snapshot.docs.map((doc) => convertOrderDoc(doc)!);
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

/**
 * Singleton instance
 */
export const orderRepository = new FirestoreOrderRepository();
