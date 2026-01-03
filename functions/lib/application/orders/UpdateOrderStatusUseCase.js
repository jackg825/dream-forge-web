"use strict";
/**
 * Update Order Status Use Case
 *
 * Clean Architecture: Handles order status transitions
 * Used by admin to move orders through the workflow
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
exports.UpdateOrderStatusUseCase = void 0;
const functions = __importStar(require("firebase-functions"));
const order_1 = require("../../domain/order");
const credits_1 = require("../../utils/credits");
/**
 * Update Order Status Use Case
 */
class UpdateOrderStatusUseCase {
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
        functions.logger.info('UpdateOrderStatusUseCase: Starting', {
            orderId: request.orderId,
            newStatus: request.newStatus,
            adminId: request.adminId,
        });
        // 1. Get order from repository
        const order = await this.orderRepository.getById(request.orderId);
        if (!order) {
            throw new functions.https.HttpsError('not-found', 'Order not found');
        }
        const previousStatus = order.status;
        // 2. Create aggregate and transition status
        const orderAggregate = order_1.OrderAggregate.fromData(order);
        let bonusCreditsAwarded;
        // Handle special cases
        switch (request.newStatus) {
            case 'confirmed':
                orderAggregate.confirm(request.adminId, request.adminNotes);
                break;
            case 'printing':
                orderAggregate.startPrinting(request.adminId);
                break;
            case 'quality_check':
                orderAggregate.startQualityCheck(request.adminId, request.adminNotes);
                break;
            case 'shipping':
                if (!request.tracking) {
                    throw new functions.https.HttpsError('invalid-argument', 'Tracking information required for shipping status');
                }
                orderAggregate.ship(request.adminId, request.tracking);
                break;
            case 'delivered':
                bonusCreditsAwarded = orderAggregate.markDelivered(request.adminId);
                // Award bonus credits to user
                if (bonusCreditsAwarded > 0) {
                    try {
                        await (0, credits_1.refundCredits)(order.userId, bonusCreditsAwarded, `delivery-bonus:${order.id}`);
                        functions.logger.info('Bonus credits awarded', {
                            userId: order.userId,
                            credits: bonusCreditsAwarded,
                            orderId: order.id,
                        });
                    }
                    catch (error) {
                        functions.logger.error('Failed to award bonus credits', { error });
                        // Don't fail the status update
                    }
                }
                break;
            default:
                orderAggregate.transitionTo(request.newStatus, `admin:${request.adminId}`, request.reason, request.adminNotes);
        }
        // 3. Save updated order
        const updatedOrder = orderAggregate.toData();
        await this.orderRepository.update(request.orderId, updatedOrder);
        // 4. Send notification
        try {
            await this.notificationService.sendOrderStatusNotification({
                order: updatedOrder,
                previousStatus,
                newStatus: request.newStatus,
                changedBy: `admin:${request.adminId}`,
                timestamp: new Date(),
            }, { webhookUrl: process.env.ORDER_WEBHOOK_URL });
        }
        catch (error) {
            functions.logger.warn('Failed to send status notification', { error });
        }
        functions.logger.info('UpdateOrderStatusUseCase: Status updated', {
            orderId: request.orderId,
            previousStatus,
            newStatus: request.newStatus,
        });
        return {
            success: true,
            previousStatus,
            newStatus: request.newStatus,
            bonusCreditsAwarded,
        };
    }
}
exports.UpdateOrderStatusUseCase = UpdateOrderStatusUseCase;
//# sourceMappingURL=UpdateOrderStatusUseCase.js.map