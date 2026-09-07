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
        const { previousOrder, order: updatedOrder } = await this.orderRepository.updateAtomically(request.orderId, (order) => {
            if (!request.isAdmin && order.userId !== request.userId) {
                throw new functions.https.HttpsError('permission-denied', 'You can only cancel your own orders');
            }
            const aggregate = order_1.OrderAggregate.fromData(order);
            try {
                if (request.isAdmin) {
                    aggregate.transitionTo('cancelled', `admin:${request.userId}`, request.reason);
                }
                else {
                    aggregate.cancel(request.userId, request.reason);
                }
            }
            catch (error) {
                if (error instanceof order_1.OrderValidationError || error instanceof order_1.OrderTransitionError) {
                    throw new functions.https.HttpsError('failed-precondition', error.message);
                }
                throw error;
            }
            return aggregate.toData();
        });
        const previousStatus = previousOrder.status;
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