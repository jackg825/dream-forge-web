"use strict";
/**
 * Cancel Order Use Case
 *
 * Clean Architecture: Handles order cancellation
 * Available at: pending, quality_check, shipping statuses
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CancelOrderUseCase = void 0;
const functions = __importStar(require("firebase-functions"));
const order_1 = require("../../domain/order");
/**
 * Cancel Order Use Case
 */
class CancelOrderUseCase {
    orderRepository;
    notificationService;
    constructor(orderRepository, notificationService) {
        this.orderRepository = orderRepository;
        this.notificationService = notificationService;
    }
    /**
     * Execute the use case
     */
    async execute(request) {
        functions.logger.info('CancelOrderUseCase: Starting', {
            orderId: request.orderId,
            userId: request.userId,
            isAdmin: request.isAdmin,
        });
        // 1. Get order from repository
        const order = await this.orderRepository.getById(request.orderId);
        if (!order) {
            throw new functions.https.HttpsError('not-found', 'Order not found');
        }
        // 2. Verify ownership (unless admin)
        if (!request.isAdmin && order.userId !== request.userId) {
            throw new functions.https.HttpsError('permission-denied', 'You can only cancel your own orders');
        }
        const previousStatus = order.status;
        // 3. Create aggregate and cancel
        const orderAggregate = order_1.OrderAggregate.fromData(order);
        try {
            const cancelledBy = request.isAdmin
                ? `admin:${request.userId}`
                : request.userId;
            orderAggregate.cancel(cancelledBy, request.reason);
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('Cannot cancel')) {
                throw new functions.https.HttpsError('failed-precondition', `Cannot cancel order in '${order.status}' status. Orders can only be cancelled when pending, in quality check, or shipping.`);
            }
            throw error;
        }
        // 4. Save updated order
        const updatedOrder = orderAggregate.toData();
        await this.orderRepository.update(request.orderId, updatedOrder);
        // 5. Send notification
        try {
            await this.notificationService.sendOrderStatusNotification({
                order: updatedOrder,
                previousStatus,
                newStatus: 'cancelled',
                changedBy: request.isAdmin ? `admin:${request.userId}` : request.userId,
                timestamp: new Date(),
            }, { webhookUrl: process.env.ORDER_WEBHOOK_URL });
        }
        catch (error) {
            functions.logger.warn('Failed to send cancellation notification', { error });
        }
        functions.logger.info('CancelOrderUseCase: Order cancelled', {
            orderId: request.orderId,
            previousStatus,
        });
        return {
            success: true,
            previousStatus,
            message: 'Order has been cancelled successfully',
        };
    }
}
exports.CancelOrderUseCase = CancelOrderUseCase;
//# sourceMappingURL=CancelOrderUseCase.js.map