"use strict";
/**
 * Order Aggregate
 *
 * Clean Architecture: Domain entity with business logic
 * Encapsulates all order-related business rules and state transitions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderAggregate = exports.OrderTransitionError = exports.OrderValidationError = void 0;
const types_1 = require("./types");
const uuid_1 = require("uuid");
/**
 * Order validation error
 */
class OrderValidationError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'OrderValidationError';
    }
}
exports.OrderValidationError = OrderValidationError;
/**
 * Order state transition error
 */
class OrderTransitionError extends Error {
    fromStatus;
    toStatus;
    constructor(message, fromStatus, toStatus) {
        super(message);
        this.fromStatus = fromStatus;
        this.toStatus = toStatus;
        this.name = 'OrderTransitionError';
    }
}
exports.OrderTransitionError = OrderTransitionError;
/**
 * Order Aggregate Root
 *
 * Responsible for:
 * - Creating new orders with validation
 * - Managing state transitions
 * - Enforcing business rules (cancellation policy, status flow)
 * - Calculating totals and bonus credits
 */
class OrderAggregate {
    _order;
    constructor(order) {
        this._order = order;
    }
    // ============================================
    // Static Factory Methods
    // ============================================
    /**
     * Create a new order from input
     */
    static create(input, pricingLookup) {
        // Validate input
        OrderAggregate.validateCreateInput(input);
        // Generate IDs and calculate prices for items
        const items = input.items.map((item) => {
            const unitPrice = pricingLookup(item.material, item.size);
            return {
                ...item,
                id: (0, uuid_1.v4)(),
                unitPrice,
                subtotal: unitPrice * item.quantity,
            };
        });
        // Calculate totals
        const subtotal = (0, types_1.calculateSubtotal)(items);
        const shippingCost = OrderAggregate.calculateShippingCost(input.shippingMethod, input.shippingAddress.country);
        const now = new Date();
        const order = {
            id: (0, uuid_1.v4)(),
            userId: input.userId,
            status: 'pending',
            statusHistory: [
                {
                    from: 'pending', // Initial state
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
    static fromData(data) {
        return new OrderAggregate(data);
    }
    // ============================================
    // Getters
    // ============================================
    get order() {
        return { ...this._order };
    }
    get id() {
        return this._order.id;
    }
    get userId() {
        return this._order.userId;
    }
    get status() {
        return this._order.status;
    }
    get items() {
        return [...this._order.items];
    }
    get totalAmount() {
        return this._order.payment.totalAmount;
    }
    get isCancellable() {
        return (0, types_1.isCancellable)(this._order.status);
    }
    // ============================================
    // State Transitions
    // ============================================
    /**
     * Transition order to a new status
     */
    transitionTo(newStatus, changedBy, reason, adminNotes) {
        const currentStatus = this._order.status;
        // Validate transition
        if (!(0, types_1.isValidTransition)(currentStatus, newStatus)) {
            throw new OrderTransitionError(`Cannot transition from '${currentStatus}' to '${newStatus}'`, currentStatus, newStatus);
        }
        // Record the change
        const change = {
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
    confirm(adminId, notes) {
        this.transitionTo('confirmed', `admin:${adminId}`, 'Order confirmed by admin', notes);
    }
    /**
     * Mark order as printing
     */
    startPrinting(adminId) {
        this.transitionTo('printing', `admin:${adminId}`, 'Printing started');
    }
    /**
     * Mark order as in quality check
     */
    startQualityCheck(adminId, qualityNotes) {
        this.transitionTo('quality_check', `admin:${adminId}`, 'Quality check started');
        if (qualityNotes) {
            this._order.qualityCheckNotes = qualityNotes;
        }
    }
    /**
     * Mark order as shipped with tracking info
     */
    ship(adminId, tracking) {
        this._order.tracking = tracking;
        this.transitionTo('shipping', `admin:${adminId}`, 'Order shipped');
    }
    /**
     * Mark order as delivered
     * Returns the bonus credits to award
     */
    markDelivered(adminId) {
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
    cancel(cancelledBy, reason) {
        if (!this.isCancellable) {
            throw new OrderValidationError(`Cannot cancel order in '${this._order.status}' status`, 'ORDER_NOT_CANCELLABLE');
        }
        this.transitionTo('cancelled', cancelledBy, reason);
    }
    /**
     * Refund the order
     */
    refund(adminId, reason) {
        if (this._order.status !== 'cancelled' && this._order.status !== 'delivered') {
            throw new OrderValidationError('Can only refund cancelled or delivered orders', 'ORDER_NOT_REFUNDABLE');
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
    updatePayment(transactionId, status) {
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
    updateTracking(tracking) {
        if (this._order.tracking) {
            this._order.tracking = { ...this._order.tracking, ...tracking };
        }
        else if (tracking.carrier && tracking.trackingNumber && tracking.shippedAt) {
            this._order.tracking = tracking;
        }
        this._order.updatedAt = new Date();
    }
    // ============================================
    // Private Helpers
    // ============================================
    /**
     * Validate order creation input
     */
    static validateCreateInput(input) {
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
    static calculateShippingCost(method, country) {
        // Simplified shipping cost calculation
        // In production, this would integrate with shipping carriers
        const baseShipping = {
            TW: 100, // Taiwan: $1
            HK: 200, // Hong Kong: $2
            CN: 300, // China: $3
            US: 1500, // USA: $15
            DEFAULT: 2000, // International: $20
        };
        const base = baseShipping[country] || baseShipping.DEFAULT;
        const multiplier = method === 'express' ? 2 : 1;
        return base * multiplier;
    }
    /**
     * Get currency based on country
     */
    static getCurrencyForCountry(country) {
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
    calculateBonusCredits() {
        // Sum up assumed generation credits for each model
        // In production, this would query the pipelines collection
        const totalGenerationCredits = this._order.items.length * 5; // Assume 5 credits per model
        return Math.ceil(totalGenerationCredits * (types_1.DELIVERY_BONUS_PERCENTAGE / 100));
    }
    // ============================================
    // Serialization
    // ============================================
    /**
     * Convert to plain object for storage
     */
    toData() {
        return { ...this._order };
    }
}
exports.OrderAggregate = OrderAggregate;
//# sourceMappingURL=Order.js.map