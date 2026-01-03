/**
 * Order Repository Interface (Port)
 *
 * Clean Architecture: Abstract interface for order persistence
 * Implementations: FirestoreOrderRepository
 */

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
} from '../order/types';

/**
 * Pagination parameters
 */
export interface PaginationParams {
  limit?: number;
  offset?: number;
  cursor?: string;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Order filter parameters
 */
export interface OrderFilterParams {
  userId?: string;
  status?: OrderStatus | OrderStatus[];
  fromDate?: Date;
  toDate?: Date;
}

/**
 * Order Repository Interface
 */
export interface IOrderRepository {
  // ============================================
  // Order CRUD
  // ============================================

  /**
   * Create a new order
   */
  create(order: Order): Promise<string>;

  /**
   * Get an order by ID
   */
  getById(orderId: string): Promise<Order | null>;

  /**
   * Get an order by ID with user info (for admin)
   */
  getByIdWithUser(orderId: string): Promise<AdminOrder | null>;

  /**
   * Update an order
   */
  update(orderId: string, updates: Partial<Order>): Promise<void>;

  /**
   * Delete an order (soft delete by marking cancelled)
   */
  delete(orderId: string): Promise<void>;

  // ============================================
  // Order Queries
  // ============================================

  /**
   * Get orders for a specific user
   */
  getByUserId(
    userId: string,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<Order>>;

  /**
   * Get all orders with filters (admin)
   */
  getAll(
    filters?: OrderFilterParams,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<AdminOrder>>;

  /**
   * Get orders by status (for Kanban view)
   */
  getByStatus(
    status: OrderStatus,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<AdminOrder>>;

  /**
   * Count orders by status (for dashboard stats)
   */
  countByStatus(): Promise<Record<OrderStatus, number>>;

  // ============================================
  // Shipping Addresses
  // ============================================

  /**
   * Save a shipping address for a user
   */
  saveAddress(userId: string, address: ShippingAddress): Promise<string>;

  /**
   * Get all addresses for a user
   */
  getAddresses(userId: string): Promise<ShippingAddress[]>;

  /**
   * Delete a shipping address
   */
  deleteAddress(userId: string, addressId: string): Promise<void>;

  /**
   * Set an address as default
   */
  setDefaultAddress(userId: string, addressId: string): Promise<void>;

  // ============================================
  // Print Configuration
  // ============================================

  /**
   * Get all materials configuration
   */
  getMaterials(): Promise<MaterialConfig[]>;

  /**
   * Get all sizes configuration
   */
  getSizes(): Promise<SizeConfig[]>;

  /**
   * Get all colors configuration
   */
  getColors(): Promise<ColorOption[]>;

  /**
   * Get pricing for a material and size
   */
  getPrice(material: PrintMaterial, size: PrintSizeId): Promise<number>;

  /**
   * Get full pricing matrix
   */
  getPricingMatrix(): Promise<Record<PrintMaterial, Record<PrintSizeId, number>>>;

  // ============================================
  // Admin Configuration (Write)
  // ============================================

  /**
   * Update material configuration
   */
  updateMaterial(material: MaterialConfig): Promise<void>;

  /**
   * Update size configuration
   */
  updateSize(size: SizeConfig): Promise<void>;

  /**
   * Update color configuration
   */
  updateColor(color: ColorOption): Promise<void>;

  /**
   * Update pricing
   */
  updatePricing(
    material: PrintMaterial,
    size: PrintSizeId,
    price: number
  ): Promise<void>;

  // ============================================
  // Reports
  // ============================================

  /**
   * Get order statistics for a date range
   */
  getOrderStats(
    fromDate: Date,
    toDate: Date
  ): Promise<{
    totalOrders: number;
    totalRevenue: number;
    ordersByStatus: Record<OrderStatus, number>;
    ordersByMaterial: Record<PrintMaterial, number>;
    ordersBySize: Record<PrintSizeId, number>;
  }>;

  /**
   * Get daily order summary
   */
  getDailyStats(
    date: Date
  ): Promise<{
    orders: number;
    revenue: number;
    newCustomers: number;
  }>;
}

/**
 * Transaction support for atomic operations
 */
export interface IOrderRepositoryTransaction {
  /**
   * Run a function within a transaction
   */
  runTransaction<T>(
    fn: (repository: IOrderRepository) => Promise<T>
  ): Promise<T>;
}
