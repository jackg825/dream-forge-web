"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderText = orderText;
exports.optionalOrderText = optionalOrderText;
exports.orderId = orderId;
exports.orderStatus = orderStatus;
exports.optionalOrderStatusFilter = optionalOrderStatusFilter;
exports.orderDate = orderDate;
exports.orderTracking = orderTracking;
exports.optionalOrderTracking = optionalOrderTracking;
exports.orderMaterial = orderMaterial;
const v1_1 = require("firebase-functions/v1");
const types_1 = require("../domain/order/types");
function orderText(value, field, maxLength = 2000) {
    if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
        throw new v1_1.https.HttpsError('invalid-argument', `${field} must be a non-empty string of at most ${maxLength} characters`);
    }
    return value.trim();
}
/** Callable payload encoding can turn optional undefined values into null. */
function optionalOrderText(value, field, maxLength = 2000) {
    return value == null || value === '' ? undefined : orderText(value, field, maxLength);
}
function orderId(value) {
    const id = orderText(value, 'Order ID', 128);
    if (id.includes('/'))
        throw new v1_1.https.HttpsError('invalid-argument', 'Invalid order ID');
    return id;
}
function orderStatus(value) {
    if (typeof value !== 'string' || !Object.hasOwn(types_1.ORDER_STATUS_TRANSITIONS, value)) {
        throw new v1_1.https.HttpsError('invalid-argument', 'Invalid order status');
    }
    return value;
}
function optionalOrderStatusFilter(value) {
    if (value == null)
        return undefined;
    if (!Array.isArray(value))
        return orderStatus(value);
    if (value.length === 0 || value.length > 8) {
        throw new v1_1.https.HttpsError('invalid-argument', 'Provide between one and eight statuses');
    }
    return value.map(orderStatus);
}
function orderDate(value, field) {
    if (value === undefined || value === null || value === '')
        return undefined;
    if (typeof value !== 'string' || !Number.isFinite(new Date(value).getTime())) {
        throw new v1_1.https.HttpsError('invalid-argument', `Invalid ${field}`);
    }
    return new Date(value);
}
function orderTracking(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new v1_1.https.HttpsError('invalid-argument', 'Tracking information is required');
    }
    const input = value;
    const tracking = {
        carrier: orderText(input.carrier, 'Carrier', 100),
        trackingNumber: orderText(input.trackingNumber, 'Tracking number', 200),
    };
    if (input.trackingUrl != null && input.trackingUrl !== '') {
        const url = orderText(input.trackingUrl, 'Tracking URL', 2048);
        try {
            if (!['http:', 'https:'].includes(new URL(url).protocol))
                throw new Error();
        }
        catch {
            throw new v1_1.https.HttpsError('invalid-argument', 'Tracking URL must use HTTP or HTTPS');
        }
        tracking.trackingUrl = url;
    }
    const estimatedDelivery = orderDate(input.estimatedDelivery, 'estimated delivery');
    if (estimatedDelivery)
        tracking.estimatedDelivery = estimatedDelivery;
    return tracking;
}
function optionalOrderTracking(value) {
    return value == null ? undefined : orderTracking(value);
}
function orderMaterial(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new v1_1.https.HttpsError('invalid-argument', 'Material configuration is required');
    }
    const input = value;
    if (typeof input.id !== 'string' || !Object.hasOwn(types_1.MATERIAL_CONFIGS, input.id) ||
        typeof input.available !== 'boolean' ||
        !Number.isInteger(input.maxColors) || input.maxColors < 1 || input.maxColors > 4 ||
        (input.id !== 'pla-multi' && input.maxColors !== 1) ||
        !Number.isInteger(input.estimatedDays) || input.estimatedDays < 1 || input.estimatedDays > 365 ||
        !Number.isInteger(input.sortOrder) || input.sortOrder < 0 || input.sortOrder > 1000) {
        throw new v1_1.https.HttpsError('invalid-argument', 'Invalid material configuration');
    }
    return {
        id: input.id,
        name: orderText(input.name, 'Material name', 200),
        nameZh: orderText(input.nameZh, 'Material name (Chinese)', 200),
        description: orderText(input.description, 'Material description'),
        descriptionZh: orderText(input.descriptionZh, 'Material description (Chinese)'),
        maxColors: input.maxColors,
        estimatedDays: input.estimatedDays,
        available: input.available,
        sortOrder: input.sortOrder,
    };
}
//# sourceMappingURL=order-validation.js.map