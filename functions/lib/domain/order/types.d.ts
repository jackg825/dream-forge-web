/**
 * Domain types for Print Order system
 *
 * Clean Architecture: Pure TypeScript, zero Firebase dependencies
 * These types define the business domain for 3D print ordering
 */
/**
 * Order status representing the lifecycle of a print order
 *
 * Flow: pending → confirmed → printing → quality_check → shipping → delivered
 *       ↓                                    ↓              ↓
 *     cancelled                           cancelled     cancelled → refunded
 */
export type OrderStatus = 'pending' | 'confirmed' | 'printing' | 'quality_check' | 'shipping' | 'delivered' | 'cancelled' | 'refunded';
/**
 * Valid status transitions
 * Key: current status, Value: array of valid next statuses
 */
export declare const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]>;
/**
 * Statuses where cancellation is allowed
 */
export declare const CANCELLABLE_STATUSES: OrderStatus[];
/**
 * Order status display configuration
 */
export declare const ORDER_STATUS_CONFIG: Record<OrderStatus, {
    label: string;
    labelZh: string;
    color: string;
    icon: string;
}>;
/**
 * Print material types
 */
export type PrintMaterial = 'pla-single' | 'pla-multi' | 'resin';
/**
 * Material configuration for display and pricing
 */
export interface MaterialConfig {
    id: PrintMaterial;
    name: string;
    nameZh: string;
    description: string;
    descriptionZh: string;
    maxColors: number;
    estimatedDays: number;
    available: boolean;
    sortOrder: number;
}
/**
 * Default material configurations
 */
export declare const MATERIAL_CONFIGS: Record<PrintMaterial, MaterialConfig>;
/**
 * Print size identifiers (bounding box dimensions)
 */
export type PrintSizeId = '5x5x5' | '10x10x10' | '15x15x15';
/**
 * Print size configuration
 */
export interface SizeConfig {
    id: PrintSizeId;
    dimensions: {
        x: number;
        y: number;
        z: number;
    };
    displayName: string;
    displayNameZh: string;
    available: boolean;
    sortOrder: number;
}
/**
 * Default size configurations
 */
export declare const SIZE_CONFIGS: Record<PrintSizeId, SizeConfig>;
/**
 * Pricing matrix: Material × Size → Price (in cents/分)
 * This is a default; actual pricing is admin-configurable in Firestore
 */
export declare const DEFAULT_PRICING: Record<PrintMaterial, Record<PrintSizeId, number>>;
/**
 * Bonus credits percentage refunded on delivery
 * e.g., 10 = 10% of model generation credits refunded
 */
export declare const DELIVERY_BONUS_PERCENTAGE = 10;
/**
 * Predefined color option
 */
export interface ColorOption {
    id: string;
    name: string;
    nameZh: string;
    hex: string;
    available: boolean;
}
/**
 * Default color palette
 */
export declare const DEFAULT_COLORS: ColorOption[];
/**
 * Shipping address
 */
export interface ShippingAddress {
    id?: string;
    recipientName: string;
    phone: string;
    email?: string;
    country: string;
    state?: string;
    city: string;
    district?: string;
    postalCode: string;
    addressLine1: string;
    addressLine2?: string;
    isDefault?: boolean;
    label?: string;
}
/**
 * Shipping method
 */
export type ShippingMethod = 'standard' | 'express';
/**
 * Shipping tracking information
 */
export interface ShippingTracking {
    carrier: string;
    trackingNumber: string;
    trackingUrl?: string;
    estimatedDelivery?: Date;
    shippedAt: Date;
}
/**
 * Single item in an order (one model with material/size/color selection)
 */
export interface OrderItem {
    id: string;
    pipelineId: string;
    modelUrl: string;
    modelThumbnail?: string;
    modelName?: string;
    material: PrintMaterial;
    size: PrintSizeId;
    colors: string[];
    quantity: number;
    unitPrice: number;
    subtotal: number;
}
/**
 * Payment method
 */
export type PaymentMethod = 'pending' | 'stripe' | 'paypal' | 'alipay' | 'wechat_pay';
/**
 * Payment status
 */
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
/**
 * Payment information
 */
export interface PaymentInfo {
    method: PaymentMethod;
    status: PaymentStatus;
    currency: 'USD' | 'CNY' | 'TWD';
    subtotal: number;
    shippingCost: number;
    totalAmount: number;
    transactionId?: string;
    paidAt?: Date;
    refundedAt?: Date;
}
/**
 * Record of a status change for audit trail
 */
export interface OrderStatusChange {
    from: OrderStatus;
    to: OrderStatus;
    changedBy: string;
    changedAt: Date;
    reason?: string;
    adminNotes?: string;
}
/**
 * Complete order entity
 */
export interface Order {
    id: string;
    userId: string;
    status: OrderStatus;
    statusHistory: OrderStatusChange[];
    items: OrderItem[];
    shippingAddress: ShippingAddress;
    shippingMethod: ShippingMethod;
    tracking?: ShippingTracking;
    payment: PaymentInfo;
    bonusCreditsAwarded?: number;
    generationCreditsRefunded?: number;
    adminNotes?: string;
    qualityCheckNotes?: string;
    createdAt: Date;
    updatedAt: Date;
    confirmedAt?: Date;
    printedAt?: Date;
    shippedAt?: Date;
    deliveredAt?: Date;
    cancelledAt?: Date;
    refundedAt?: Date;
}
/**
 * Input for creating a new order
 */
export interface CreateOrderInput {
    userId: string;
    items: Omit<OrderItem, 'id' | 'subtotal'>[];
    shippingAddress: ShippingAddress;
    shippingMethod: ShippingMethod;
    saveAddress?: boolean;
}
/**
 * Order with user information for admin views
 */
export interface AdminOrder extends Order {
    userDisplayName: string;
    userEmail: string;
    userPhotoURL: string | null;
}
/**
 * Check if a status transition is valid
 */
export declare function isValidTransition(from: OrderStatus, to: OrderStatus): boolean;
/**
 * Check if an order can be cancelled
 */
export declare function isCancellable(status: OrderStatus): boolean;
/**
 * Calculate order subtotal from items
 */
export declare function calculateSubtotal(items: OrderItem[]): number;
/**
 * Get estimated delivery date based on material and shipping method
 */
export declare function getEstimatedDelivery(material: PrintMaterial, shippingMethod: ShippingMethod, fromDate?: Date): Date;
