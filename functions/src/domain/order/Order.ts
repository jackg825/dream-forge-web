/**
 * Order Aggregate
 *
 * Clean Architecture: Domain entity with business logic
 * Encapsulates all order-related business rules and state transitions
 */

import {
  Order,
  OrderStatus,
  OrderItem,
  OrderStatusChange,
  PaymentInfo,
  ShippingAddress,
  ShippingMethod,
  ShippingTracking,
  CreateOrderInput,
  PrintMaterial,
  PrintSizeId,
  isValidTransition,
  isCancellable,
  calculateSubtotal,
  DELIVERY_BONUS_PERCENTAGE,
} from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Order validation error
 */
export class OrderValidationError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'OrderValidationError';
  }
}

/**
 * Order state transition error
 */
export class OrderTransitionError extends Error {
  constructor(
    message: string,
    public readonly fromStatus: OrderStatus,
    public readonly toStatus: OrderStatus
  ) {
    super(message);
    this.name = 'OrderTransitionError';
  }
}

/**
 * Order Aggregate Root
 *
 * Responsible for:
 * - Creating new orders with validation
 * - Managing state transitions
 * - Enforcing business rules (cancellation policy, status flow)
 * - Calculating totals and bonus credits
 */
export class OrderAggregate {
  private _order: Order;

  private constructor(order: Order) {
    this._order = order;
  }

  // ============================================
  // Static Factory Methods
  // ============================================

  /**
   * Create a new order from input
   */
  static create(
    input: CreateOrderInput,
    pricingLookup: (material: PrintMaterial, size: PrintSizeId) => number
  ): OrderAggregate {
    // Validate input
    OrderAggregate.validateCreateInput(input);

    // Generate IDs and calculate prices for items
    const items: OrderItem[] = input.items.map((item) => {
      const unitPrice = pricingLookup(item.material, item.size);
      return {
        ...item,
        id: uuidv4(),
        unitPrice,
        subtotal: unitPrice * item.quantity,
      };
    });

    // Calculate totals
    const subtotal = calculateSubtotal(items);
    const shippingCost = OrderAggregate.calculateShippingCost(
      input.shippingMethod,
      input.shippingAddress.country
    );

    const now = new Date();

    const order: Order = {
      id: uuidv4(),
      userId: input.userId,
      status: 'pending',
      statusHistory: [
        {
          from: 'pending' as OrderStatus, // Initial state
          to: 'pending',
          changedBy: input.userId,
          changedAt: now,
          reason: 'Order created',
        },
      ],
      items,
      shippingAddress: input.shippingAddress,
      shippingMethod: input.shippingMethod,
      payment: {
        method: 'pending',
        status: 'pending',
        currency: OrderAggregate.getCurrencyForCountry(input.shippingAddress.country),
        subtotal,
        shippingCost,
        totalAmount: subtotal + shippingCost,
      },
      createdAt: now,
      updatedAt: now,
    };

    return new OrderAggregate(order);
  }

  /**
   * Reconstruct an order from stored data
   */
  static fromData(data: Order): OrderAggregate {
    return new OrderAggregate(data);
  }

  // ============================================
  // Getters
  // ============================================

  get order(): Order {
    return { ...this._order };
  }

  get id(): string {
    return this._order.id;
  }

  get userId(): string {
    return this._order.userId;
  }

  get status(): OrderStatus {
    return this._order.status;
  }

  get items(): OrderItem[] {
    return [...this._order.items];
  }

  get totalAmount(): number {
    return this._order.payment.totalAmount;
  }

  get isCancellable(): boolean {
    return isCancellable(this._order.status);
  }

  // ============================================
  // State Transitions
  // ============================================

  /**
   * Transition order to a new status
   */
  transitionTo(
    newStatus: OrderStatus,
    changedBy: string,
    reason?: string,
    adminNotes?: string
  ): void {
    const currentStatus = this._order.status;

    // Validate transition
    if (!isValidTransition(currentStatus, newStatus)) {
      throw new OrderTransitionError(
        `Cannot transition from '${currentStatus}' to '${newStatus}'`,
        currentStatus,
        newStatus
      );
    }

    // Record the change
    const change: OrderStatusChange = {
      from: currentStatus,
      to: newStatus,
      changedBy,
      changedAt: new Date(),
      reason,
      adminNotes,
    };

    this._order.statusHistory.push(change);
    this._order.status = newStatus;
    this._order.updatedAt = new Date();

    // Update timestamp based on new status
    switch (newStatus) {
      case 'confirmed':
        this._order.confirmedAt = new Date();
        break;
      case 'printing':
        this._order.printedAt = new Date();
        break;
      case 'shipping':
        this._order.shippedAt = new Date();
        break;
      case 'delivered':
        this._order.deliveredAt = new Date();
        break;
      case 'cancelled':
        this._order.cancelledAt = new Date();
        break;
      case 'refunded':
        this._order.refundedAt = new Date();
        break;
    }

    // Store admin notes if provided
    if (adminNotes) {
      this._order.adminNotes = adminNotes;
    }
  }

  /**
   * Confirm the order (admin action)
   */
  confirm(adminId: string, notes?: string): void {
    this.transitionTo('confirmed', `admin:${adminId}`, 'Order confirmed by admin', notes);
  }

  /**
   * Mark order as printing
   */
  startPrinting(adminId: string): void {
    this.transitionTo('printing', `admin:${adminId}`, 'Printing started');
  }

  /**
   * Mark order as in quality check
   */
  startQualityCheck(adminId: string, qualityNotes?: string): void {
    this.transitionTo('quality_check', `admin:${adminId}`, 'Quality check started');
    if (qualityNotes) {
      this._order.qualityCheckNotes = qualityNotes;
    }
  }

  /**
   * Mark order as shipped with tracking info
   */
  ship(adminId: string, tracking: ShippingTracking): void {
    this._order.tracking = tracking;
    this.transitionTo('shipping', `admin:${adminId}`, 'Order shipped');
  }

  /**
   * Mark order as delivered
   * Returns the bonus credits to award
   */
  markDelivered(adminId: string): number {
    this.transitionTo('delivered', `admin:${adminId}`, 'Order delivered');

    // Calculate bonus credits (percentage of generation credits)
    // This is a placeholder - actual calculation would use generation credits from pipelines
    const bonusCredits = this.calculateBonusCredits();
    this._order.bonusCreditsAwarded = bonusCredits;

    return bonusCredits;
  }

  /**
   * Cancel the order
   */
  cancel(cancelledBy: string, reason: string): void {
    if (!this.isCancellable) {
      throw new OrderValidationError(
        `Cannot cancel order in '${this._order.status}' status`,
        'ORDER_NOT_CANCELLABLE'
      );
    }

    this.transitionTo('cancelled', cancelledBy, reason);
  }

  /**
   * Refund the order
   */
  refund(adminId: string, reason: string): void {
    if (this._order.status !== 'cancelled' && this._order.status !== 'delivered') {
      throw new OrderValidationError(
        'Can only refund cancelled or delivered orders',
        'ORDER_NOT_REFUNDABLE'
      );
    }

    this.transitionTo('refunded', `admin:${adminId}`, reason);
    this._order.payment.status = 'refunded';
  }

  // ============================================
  // Payment
  // ============================================

  /**
   * Update payment information
   */
  updatePayment(transactionId: string, status: 'completed' | 'failed'): void {
    this._order.payment.transactionId = transactionId;
    this._order.payment.status = status;
    this._order.updatedAt = new Date();

    if (status === 'completed') {
      this._order.payment.paidAt = new Date();
    }
  }

  // ============================================
  // Tracking
  // ============================================

  /**
   * Update tracking information
   */
  updateTracking(tracking: Partial<ShippingTracking>): void {
    if (this._order.tracking) {
      this._order.tracking = { ...this._order.tracking, ...tracking };
    } else if (tracking.carrier && tracking.trackingNumber && tracking.shippedAt) {
      this._order.tracking = tracking as ShippingTracking;
    }
    this._order.updatedAt = new Date();
  }

  // ============================================
  // Private Helpers
  // ============================================

  /**
   * Validate order creation input
   */
  private static validateCreateInput(input: CreateOrderInput): void {
    // Must have at least one item
    if (!input.items || input.items.length === 0) {
      throw new OrderValidationError('Order must have at least one item', 'NO_ITEMS');
    }

    // Validate each item
    for (const item of input.items) {
      if (!item.pipelineId) {
        throw new OrderValidationError('Each item must have a pipelineId', 'INVALID_ITEM');
      }
      if (!item.modelUrl) {
        throw new OrderValidationError('Each item must have a modelUrl', 'INVALID_ITEM');
      }
      if (item.quantity < 1) {
        throw new OrderValidationError('Item quantity must be at least 1', 'INVALID_QUANTITY');
      }
      if (!item.colors || item.colors.length === 0) {
        throw new OrderValidationError('Each item must have at least one color', 'INVALID_COLORS');
      }
    }

    // Validate shipping address
    const addr = input.shippingAddress;
    if (!addr.recipientName || !addr.phone || !addr.country || !addr.city || !addr.addressLine1) {
      throw new OrderValidationError('Shipping address is incomplete', 'INVALID_ADDRESS');
    }
  }

  /**
   * Calculate shipping cost based on method and country
   */
  private static calculateShippingCost(
    method: ShippingMethod,
    country: string
  ): number {
    // Simplified shipping cost calculation
    // In production, this would integrate with shipping carriers
    const baseShipping: Record<string, number> = {
      TW: 100,     // Taiwan: $1
      HK: 200,     // Hong Kong: $2
      CN: 300,     // China: $3
      US: 1500,    // USA: $15
      DEFAULT: 2000, // International: $20
    };

    const base = baseShipping[country] || baseShipping.DEFAULT;
    const multiplier = method === 'express' ? 2 : 1;

    return base * multiplier;
  }

  /**
   * Get currency based on country
   */
  private static getCurrencyForCountry(country: string): 'USD' | 'CNY' | 'TWD' {
    switch (country) {
      case 'CN':
        return 'CNY';
      case 'TW':
        return 'TWD';
      default:
        return 'USD';
    }
  }

  /**
   * Calculate bonus credits for delivery
   * This is a placeholder - actual implementation would look up generation credits from pipelines
   */
  private calculateBonusCredits(): number {
    // Sum up assumed generation credits for each model
    // In production, this would query the pipelines collection
    const totalGenerationCredits = this._order.items.length * 5; // Assume 5 credits per model
    return Math.ceil(totalGenerationCredits * (DELIVERY_BONUS_PERCENTAGE / 100));
  }

  // ============================================
  // Serialization
  // ============================================

  /**
   * Convert to plain object for storage
   */
  toData(): Order {
    return { ...this._order };
  }
}
