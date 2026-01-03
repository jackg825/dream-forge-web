/**
 * Order Cloud Functions
 *
 * User-facing and admin order management functions
 */
import * as functions from 'firebase-functions/v1';
/**
 * Create a new print order
 */
export declare const createOrder: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Get user's orders
 */
export declare const getUserOrders: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Get single order details
 */
export declare const getOrderDetails: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Cancel an order (user)
 */
export declare const cancelOrder: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Get user's saved shipping addresses
 */
export declare const getShippingAddresses: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Save a shipping address
 */
export declare const saveShippingAddress: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Delete a shipping address
 */
export declare const deleteShippingAddress: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Get print configuration (materials, sizes, colors, pricing)
 */
export declare const getPrintConfig: functions.HttpsFunction & functions.Runnable<any>;
/**
 * List all orders (admin)
 */
export declare const listAllOrders: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Get orders by status (admin - for Kanban)
 */
export declare const getOrdersByStatus: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Update order status (admin)
 */
export declare const updateOrderStatus: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Update tracking information (admin)
 */
export declare const updateTrackingInfo: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Get order statistics (admin)
 */
export declare const getOrderStats: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Update material configuration (admin)
 */
export declare const updateMaterialConfig: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Update pricing (admin)
 */
export declare const updatePricing: functions.HttpsFunction & functions.Runnable<any>;
