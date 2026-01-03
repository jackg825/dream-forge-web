"use strict";
/**
 * Domain types for Print Order system
 *
 * Clean Architecture: Pure TypeScript, zero Firebase dependencies
 * These types define the business domain for 3D print ordering
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_COLORS = exports.DELIVERY_BONUS_PERCENTAGE = exports.DEFAULT_PRICING = exports.SIZE_CONFIGS = exports.MATERIAL_CONFIGS = exports.ORDER_STATUS_CONFIG = exports.CANCELLABLE_STATUSES = exports.ORDER_STATUS_TRANSITIONS = void 0;
exports.isValidTransition = isValidTransition;
exports.isCancellable = isCancellable;
exports.calculateSubtotal = calculateSubtotal;
exports.getEstimatedDelivery = getEstimatedDelivery;
/**
 * Valid status transitions
 * Key: current status, Value: array of valid next statuses
 */
exports.ORDER_STATUS_TRANSITIONS = {
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
exports.CANCELLABLE_STATUSES = [
    'pending',
    'quality_check',
    'shipping',
];
/**
 * Order status display configuration
 */
exports.ORDER_STATUS_CONFIG = {
    pending: { label: 'Pending', labelZh: '待確認', color: 'yellow', icon: 'clock' },
    confirmed: { label: 'Confirmed', labelZh: '已確認', color: 'blue', icon: 'check' },
    printing: { label: 'Printing', labelZh: '列印中', color: 'purple', icon: 'printer' },
    quality_check: { label: 'Quality Check', labelZh: '品質檢查', color: 'orange', icon: 'search' },
    shipping: { label: 'Shipping', labelZh: '配送中', color: 'cyan', icon: 'truck' },
    delivered: { label: 'Delivered', labelZh: '已送達', color: 'green', icon: 'package' },
    cancelled: { label: 'Cancelled', labelZh: '已取消', color: 'gray', icon: 'x' },
    refunded: { label: 'Refunded', labelZh: '已退款', color: 'red', icon: 'rotate-ccw' },
};
/**
 * Default material configurations
 */
exports.MATERIAL_CONFIGS = {
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
/**
 * Default size configurations
 */
exports.SIZE_CONFIGS = {
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
exports.DEFAULT_PRICING = {
    'pla-single': {
        '5x5x5': 1500, // $15 / ¥100
        '10x10x10': 3500, // $35 / ¥250
        '15x15x15': 6500, // $65 / ¥450
    },
    'pla-multi': {
        '5x5x5': 2500, // $25 / ¥180
        '10x10x10': 5500, // $55 / ¥400
        '15x15x15': 9500, // $95 / ¥680
    },
    resin: {
        '5x5x5': 3500, // $35 / ¥250
        '10x10x10': 8000, // $80 / ¥580
        '15x15x15': 15000, // $150 / ¥1080
    },
};
/**
 * Bonus credits percentage refunded on delivery
 * e.g., 10 = 10% of model generation credits refunded
 */
exports.DELIVERY_BONUS_PERCENTAGE = 10;
/**
 * Default color palette
 */
exports.DEFAULT_COLORS = [
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
// Helper Functions
// ============================================
/**
 * Check if a status transition is valid
 */
function isValidTransition(from, to) {
    return exports.ORDER_STATUS_TRANSITIONS[from].includes(to);
}
/**
 * Check if an order can be cancelled
 */
function isCancellable(status) {
    return exports.CANCELLABLE_STATUSES.includes(status);
}
/**
 * Calculate order subtotal from items
 */
function calculateSubtotal(items) {
    return items.reduce((sum, item) => sum + item.subtotal, 0);
}
/**
 * Get estimated delivery date based on material and shipping method
 */
function getEstimatedDelivery(material, shippingMethod, fromDate = new Date()) {
    const materialDays = exports.MATERIAL_CONFIGS[material].estimatedDays;
    const shippingDays = shippingMethod === 'express' ? 3 : 7;
    const totalDays = materialDays + shippingDays;
    const estimatedDate = new Date(fromDate);
    estimatedDate.setDate(estimatedDate.getDate() + totalDays);
    return estimatedDate;
}
//# sourceMappingURL=types.js.map