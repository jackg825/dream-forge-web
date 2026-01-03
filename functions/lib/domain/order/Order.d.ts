/**
 * Order Aggregate
 *
 * Clean Architecture: Domain entity with business logic
 * Encapsulates all order-related business rules and state transitions
 */
import { Order, OrderStatus, OrderItem, ShippingTracking, CreateOrderInput, PrintMaterial, PrintSizeId } from './types';
/**
 * Order validation error
 */
export declare class OrderValidationError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
/**
 * Order state transition error
 */
export declare class OrderTransitionError extends Error {
    readonly fromStatus: OrderStatus;
    readonly toStatus: OrderStatus;
    constructor(message: string, fromStatus: OrderStatus, toStatus: OrderStatus);
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
export declare class OrderAggregate {
    private _order;
    private constructor();
    /**
     * Create a new order from input
     */
    static create(input: CreateOrderInput, pricingLookup: (material: PrintMaterial, size: PrintSizeId) => number): OrderAggregate;
    /**
     * Reconstruct an order from stored data
     */
    static fromData(data: Order): OrderAggregate;
    get order(): Order;
    get id(): string;
    get userId(): string;
    get status(): OrderStatus;
    get items(): OrderItem[];
    get totalAmount(): number;
    get isCancellable(): boolean;
    /**
     * Transition order to a new status
     */
    transitionTo(newStatus: OrderStatus, changedBy: string, reason?: string, adminNotes?: string): void;
    /**
     * Confirm the order (admin action)
     */
    confirm(adminId: string, notes?: string): void;
    /**
     * Mark order as printing
     */
    startPrinting(adminId: string): void;
    /**
     * Mark order as in quality check
     */
    startQualityCheck(adminId: string, qualityNotes?: string): void;
    /**
     * Mark order as shipped with tracking info
     */
    ship(adminId: string, tracking: ShippingTracking): void;
    /**
     * Mark order as delivered
     * Returns the bonus credits to award
     */
    markDelivered(adminId: string): number;
    /**
     * Cancel the order
     */
    cancel(cancelledBy: string, reason: string): void;
    /**
     * Refund the order
     */
    refund(adminId: string, reason: string): void;
    /**
     * Update payment information
     */
    updatePayment(transactionId: string, status: 'completed' | 'failed'): void;
    /**
     * Update tracking information
     */
    updateTracking(tracking: Partial<ShippingTracking>): void;
    /**
     * Validate order creation input
     */
    private static validateCreateInput;
    /**
     * Calculate shipping cost based on method and country
     */
    private static calculateShippingCost;
    /**
     * Get currency based on country
     */
    private static getCurrencyForCountry;
    /**
     * Calculate bonus credits for delivery
     * This is a placeholder - actual implementation would look up generation credits from pipelines
     */
    private calculateBonusCredits;
    /**
     * Convert to plain object for storage
     */
    toData(): Order;
}
