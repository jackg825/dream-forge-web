/**
 * Domain types for Print Order system
 *
 * Clean Architecture: Pure TypeScript, zero Firebase dependencies
 * These types define the business domain for 3D print ordering
 */

// ============================================
// Order Status Flow
// ============================================

/**
 * Order status representing the lifecycle of a print order
 *
 * Flow: pending → confirmed → printing → quality_check → shipping → delivered
 *       ↓                                    ↓              ↓
 *     cancelled                           cancelled     cancelled → refunded
 */
export type OrderStatus =
  | 'pending'        // Awaiting payment/confirmation
  | 'confirmed'      // Payment confirmed, ready to print
  | 'printing'       // Currently being printed
  | 'quality_check'  // Print complete, checking quality
  | 'shipping'       // Shipped, in transit
  | 'delivered'      // Successfully delivered
  | 'cancelled'      // Cancelled by user or admin
  | 'refunded';      // Credits/payment refunded

/**
 * Valid status transitions
 * Key: current status, Value: array of valid next statuses
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['printing', 'cancelled'],
  printing: ['quality_check'],
  quality_check: ['shipping', 'cancelled'],
  shipping: ['delivered', 'cancelled'],
  delivered: ['refunded'],
  cancelled: ['refunded'],
  refunded: [],
};

/**
 * Statuses where cancellation is allowed
 */
export const CANCELLABLE_STATUSES: OrderStatus[] = [
  'pending',
  'quality_check',
  'shipping',
];

/**
 * Order status display configuration
 */
export const ORDER_STATUS_CONFIG: Record<OrderStatus, {
  label: string;
  labelZh: string;
  color: string;
  icon: string;
}> = {
  pending: { label: 'Pending', labelZh: '待確認', color: 'yellow', icon: 'clock' },
  confirmed: { label: 'Confirmed', labelZh: '已確認', color: 'blue', icon: 'check' },
  printing: { label: 'Printing', labelZh: '列印中', color: 'purple', icon: 'printer' },
  quality_check: { label: 'Quality Check', labelZh: '品質檢查', color: 'orange', icon: 'search' },
  shipping: { label: 'Shipping', labelZh: '配送中', color: 'cyan', icon: 'truck' },
  delivered: { label: 'Delivered', labelZh: '已送達', color: 'green', icon: 'package' },
  cancelled: { label: 'Cancelled', labelZh: '已取消', color: 'gray', icon: 'x' },
  refunded: { label: 'Refunded', labelZh: '已退款', color: 'red', icon: 'rotate-ccw' },
};

// ============================================
// Print Materials
// ============================================

/**
 * Print material types
 */
export type PrintMaterial =
  | 'pla-single'     // PLA/PETG Single-color
  | 'pla-multi'      // PLA/PETG Multi-color (2-4 colors)
  | 'resin';         // Resin (high detail)

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
export const MATERIAL_CONFIGS: Record<PrintMaterial, MaterialConfig> = {
  'pla-single': {
    id: 'pla-single',
    name: 'PLA/PETG Single-color',
    nameZh: 'PLA/PETG 單色',
    description: 'Durable plastic, single color',
    descriptionZh: '耐用塑料，單色列印',
    maxColors: 1,
    estimatedDays: 5,
    available: true,
    sortOrder: 1,
  },
  'pla-multi': {
    id: 'pla-multi',
    name: 'PLA/PETG Multi-color',
    nameZh: 'PLA/PETG 多色',
    description: 'Durable plastic, up to 4 colors',
    descriptionZh: '耐用塑料，最多 4 色',
    maxColors: 4,
    estimatedDays: 7,
    available: true,
    sortOrder: 2,
  },
  resin: {
    id: 'resin',
    name: 'Resin',
    nameZh: '樹脂',
    description: 'High detail, smooth finish',
    descriptionZh: '高精細度，光滑表面',
    maxColors: 1,
    estimatedDays: 7,
    available: true,
    sortOrder: 3,
  },
};

// ============================================
// Print Sizes
// ============================================

/**
 * Print size identifiers (bounding box dimensions)
 */
export type PrintSizeId = '5x5x5' | '10x10x10' | '15x15x15';

/**
 * Print size configuration
 */
export interface SizeConfig {
  id: PrintSizeId;
  dimensions: { x: number; y: number; z: number }; // cm
  displayName: string;
  displayNameZh: string;
  available: boolean;
  sortOrder: number;
}

/**
 * Default size configurations
 */
export const SIZE_CONFIGS: Record<PrintSizeId, SizeConfig> = {
  '5x5x5': {
    id: '5x5x5',
    dimensions: { x: 5, y: 5, z: 5 },
    displayName: '5×5×5 cm (Small)',
    displayNameZh: '5×5×5 公分（小）',
    available: true,
    sortOrder: 1,
  },
  '10x10x10': {
    id: '10x10x10',
    dimensions: { x: 10, y: 10, z: 10 },
    displayName: '10×10×10 cm (Medium)',
    displayNameZh: '10×10×10 公分（中）',
    available: true,
    sortOrder: 2,
  },
  '15x15x15': {
    id: '15x15x15',
    dimensions: { x: 15, y: 15, z: 15 },
    displayName: '15×15×15 cm (Large)',
    displayNameZh: '15×15×15 公分（大）',
    available: true,
    sortOrder: 3,
  },
};

// ============================================
// Pricing
// ============================================

/**
 * Pricing matrix: Material × Size → Price (in cents/分)
 * This is a default; actual pricing is admin-configurable in Firestore
 */
export const DEFAULT_PRICING: Record<PrintMaterial, Record<PrintSizeId, number>> = {
  'pla-single': {
    '5x5x5': 1500,      // $15 / ¥100
    '10x10x10': 3500,   // $35 / ¥250
    '15x15x15': 6500,   // $65 / ¥450
  },
  'pla-multi': {
    '5x5x5': 2500,      // $25 / ¥180
    '10x10x10': 5500,   // $55 / ¥400
    '15x15x15': 9500,   // $95 / ¥680
  },
  resin: {
    '5x5x5': 3500,      // $35 / ¥250
    '10x10x10': 8000,   // $80 / ¥580
    '15x15x15': 15000,  // $150 / ¥1080
  },
};

/**
 * Bonus credits percentage refunded on delivery
 * e.g., 10 = 10% of model generation credits refunded
 */
export const DELIVERY_BONUS_PERCENTAGE = 10;

// ============================================
// Colors
// ============================================

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
export const DEFAULT_COLORS: ColorOption[] = [
  { id: 'white', name: 'White', nameZh: '白色', hex: '#FFFFFF', available: true },
  { id: 'black', name: 'Black', nameZh: '黑色', hex: '#1A1A1A', available: true },
  { id: 'red', name: 'Red', nameZh: '紅色', hex: '#E53935', available: true },
  { id: 'blue', name: 'Blue', nameZh: '藍色', hex: '#1E88E5', available: true },
  { id: 'green', name: 'Green', nameZh: '綠色', hex: '#43A047', available: true },
  { id: 'yellow', name: 'Yellow', nameZh: '黃色', hex: '#FDD835', available: true },
  { id: 'orange', name: 'Orange', nameZh: '橙色', hex: '#FB8C00', available: true },
  { id: 'purple', name: 'Purple', nameZh: '紫色', hex: '#8E24AA', available: true },
  { id: 'pink', name: 'Pink', nameZh: '粉色', hex: '#EC407A', available: true },
  { id: 'brown', name: 'Brown', nameZh: '棕色', hex: '#795548', available: true },
  { id: 'gray', name: 'Gray', nameZh: '灰色', hex: '#757575', available: true },
  { id: 'cyan', name: 'Cyan', nameZh: '青色', hex: '#00BCD4', available: true },
];

// ============================================
// Shipping
// ============================================

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
  label?: string; // "Home", "Office", etc.
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

// ============================================
// Order Items
// ============================================

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
  colors: string[]; // Array of color IDs (1 for single, up to 4 for multi)
  quantity: number;
  unitPrice: number; // cents
  subtotal: number;  // unitPrice * quantity
}

// ============================================
// Payment
// ============================================

/**
 * Payment method
 */
export type PaymentMethod =
  | 'pending'        // Not yet selected (Coming Soon state)
  | 'stripe'         // Stripe
  | 'paypal'         // PayPal
  | 'alipay'         // Alipay
  | 'wechat_pay';    // WeChat Pay

/**
 * Payment status
 */
export type PaymentStatus =
  | 'pending'        // Awaiting payment
  | 'processing'     // Payment in progress
  | 'completed'      // Payment successful
  | 'failed'         // Payment failed
  | 'refunded';      // Payment refunded

/**
 * Payment information
 */
export interface PaymentInfo {
  method: PaymentMethod;
  status: PaymentStatus;
  currency: 'USD' | 'CNY' | 'TWD';
  subtotal: number;      // Sum of item subtotals (cents)
  shippingCost: number;  // Shipping cost (cents)
  totalAmount: number;   // subtotal + shippingCost (cents)
  transactionId?: string;
  paidAt?: Date;
  refundedAt?: Date;
}

// ============================================
// Order Status Change (Audit Trail)
// ============================================

/**
 * Record of a status change for audit trail
 */
export interface OrderStatusChange {
  from: OrderStatus;
  to: OrderStatus;
  changedBy: string;      // userId or 'admin:{adminId}'
  changedAt: Date;
  reason?: string;
  adminNotes?: string;
}

// ============================================
// Order Entity
// ============================================

/**
 * Complete order entity
 */
export interface Order {
  id: string;
  userId: string;

  // Status
  status: OrderStatus;
  statusHistory: OrderStatusChange[];

  // Items (cart)
  items: OrderItem[];

  // Shipping
  shippingAddress: ShippingAddress;
  shippingMethod: ShippingMethod;
  tracking?: ShippingTracking;

  // Payment
  payment: PaymentInfo;

  // Bonus credits (refunded on delivery)
  bonusCreditsAwarded?: number;
  generationCreditsRefunded?: number;

  // Admin
  adminNotes?: string;
  qualityCheckNotes?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  confirmedAt?: Date;
  printedAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  refundedAt?: Date;
}

// ============================================
// Order Creation Input
// ============================================

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

// ============================================
// Admin Order View (with user info)
// ============================================

/**
 * Order with user information for admin views
 */
export interface AdminOrder extends Order {
  userDisplayName: string;
  userEmail: string;
  userPhotoURL: string | null;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Check if a status transition is valid
 */
export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

/**
 * Check if an order can be cancelled
 */
export function isCancellable(status: OrderStatus): boolean {
  return CANCELLABLE_STATUSES.includes(status);
}

/**
 * Calculate order subtotal from items
 */
export function calculateSubtotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.subtotal, 0);
}

/**
 * Get estimated delivery date based on material and shipping method
 */
export function getEstimatedDelivery(
  material: PrintMaterial,
  shippingMethod: ShippingMethod,
  fromDate: Date = new Date()
): Date {
  const materialDays = MATERIAL_CONFIGS[material].estimatedDays;
  const shippingDays = shippingMethod === 'express' ? 3 : 7;
  const totalDays = materialDays + shippingDays;

  const estimatedDate = new Date(fromDate);
  estimatedDate.setDate(estimatedDate.getDate() + totalDays);
  return estimatedDate;
}
