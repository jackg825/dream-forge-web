/**
 * Frontend Types for Print Ordering System
 *
 * Mirrors domain types for frontend usage
 */

// ============================================
// Order Status
// ============================================

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'printing'
  | 'quality_check'
  | 'shipping'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: '待確認',
  confirmed: '已確認',
  printing: '列印中',
  quality_check: '品質檢查',
  shipping: '配送中',
  delivered: '已送達',
  cancelled: '已取消',
  refunded: '已退款',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'yellow',
  confirmed: 'blue',
  printing: 'purple',
  quality_check: 'orange',
  shipping: 'cyan',
  delivered: 'green',
  cancelled: 'gray',
  refunded: 'red',
};

export const CANCELLABLE_STATUSES: OrderStatus[] = [
  'pending',
  'quality_check',
  'shipping',
];

// ============================================
// Print Materials
// ============================================

export type PrintMaterial = 'pla-single' | 'pla-multi' | 'resin';

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

// ============================================
// Print Sizes
// ============================================

export type PrintSizeId = '5x5x5' | '10x10x10' | '15x15x15';

export interface SizeConfig {
  id: PrintSizeId;
  dimensions: { x: number; y: number; z: number };
  displayName: string;
  displayNameZh: string;
  available: boolean;
  sortOrder: number;
}

// ============================================
// Colors
// ============================================

export interface ColorOption {
  id: string;
  name: string;
  nameZh: string;
  hex: string;
  available: boolean;
}

// ============================================
// Shipping
// ============================================

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

export type ShippingMethod = 'standard' | 'express';

export interface ShippingTracking {
  carrier: string;
  trackingNumber: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
  shippedAt: string;
}

// ============================================
// Order Items
// ============================================

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

// ============================================
// Payment
// ============================================

export type PaymentMethod = 'pending' | 'stripe' | 'paypal' | 'alipay' | 'wechat_pay';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

export interface PaymentInfo {
  method: PaymentMethod;
  status: PaymentStatus;
  currency: 'USD' | 'CNY' | 'TWD';
  subtotal: number;
  shippingCost: number;
  totalAmount: number;
  transactionId?: string;
  paidAt?: string;
  refundedAt?: string;
}

// ============================================
// Order Status Change
// ============================================

export interface OrderStatusChange {
  from: OrderStatus;
  to: OrderStatus;
  changedBy: string;
  changedAt: string;
  reason?: string;
  adminNotes?: string;
}

// ============================================
// Order
// ============================================

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
  adminNotes?: string;
  qualityCheckNotes?: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  printedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  refundedAt?: string;
}

// ============================================
// Admin Order (with user info)
// ============================================

export interface AdminOrder extends Order {
  userDisplayName: string;
  userEmail: string;
  userPhotoURL: string | null;
}

// ============================================
// API Request/Response Types
// ============================================

export interface CreateOrderRequest {
  items: Array<{
    pipelineId: string;
    modelUrl: string;
    modelThumbnail?: string;
    modelName?: string;
    material: PrintMaterial;
    size: PrintSizeId;
    colors: string[];
    quantity: number;
  }>;
  shippingAddress: ShippingAddress;
  shippingMethod: ShippingMethod;
  saveAddress?: boolean;
}

export interface CreateOrderResponse {
  success: boolean;
  orderId: string;
  totalAmount: number;
  currency: string;
  estimatedDelivery: string;
}

export interface GetOrdersResponse {
  success: boolean;
  orders: Order[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface GetOrderDetailsResponse {
  success: boolean;
  order: Order;
}

export interface CancelOrderResponse {
  success: boolean;
  message: string;
  previousStatus: OrderStatus;
}

export interface PrintConfigResponse {
  success: boolean;
  materials: MaterialConfig[];
  sizes: SizeConfig[];
  colors: ColorOption[];
  pricing: Record<PrintMaterial, Record<PrintSizeId, number>>;
}

export interface UpdateOrderStatusRequest {
  orderId: string;
  newStatus: OrderStatus;
  reason?: string;
  adminNotes?: string;
  tracking?: {
    carrier: string;
    trackingNumber: string;
    trackingUrl?: string;
    estimatedDelivery?: string;
  };
}

export interface UpdateOrderStatusResponse {
  success: boolean;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  bonusCreditsAwarded?: number;
}

export interface OrderStatsResponse {
  success: boolean;
  statusCounts: Record<OrderStatus, number>;
  daily: {
    orders: number;
    revenue: number;
    newCustomers: number;
  };
  weekly: {
    totalOrders: number;
    totalRevenue: number;
    ordersByStatus: Record<OrderStatus, number>;
    ordersByMaterial: Record<PrintMaterial, number>;
    ordersBySize: Record<PrintSizeId, number>;
  };
}

// ============================================
// Cart State (Client-side only)
// ============================================

export interface CartItem {
  pipelineId: string;
  modelUrl: string;
  modelThumbnail?: string;
  modelName?: string;
  material: PrintMaterial;
  size: PrintSizeId;
  colors: string[];
  quantity: number;
  unitPrice: number;
}

export interface CartState {
  items: CartItem[];
  shippingAddress: ShippingAddress | null;
  shippingMethod: ShippingMethod;
}
