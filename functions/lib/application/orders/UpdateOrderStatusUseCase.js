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
        const { previousOrder, order: updatedOrder } = await this.orderRepository.updateAtomically(request.orderId, (order) => {
            const aggregate = order_1.OrderAggregate.fromData(order);
            try {
                switch (request.newStatus) {
                    case 'confirmed':
                        aggregate.confirm(request.adminId, request.adminNotes);
                        break;
                    case 'printing':
                        aggregate.startPrinting(request.adminId);
                        break;
                    case 'quality_check':
                        aggregate.startQualityCheck(request.adminId, request.adminNotes);
                        break;
                    case 'shipping':
                        if (!request.tracking) {
                            throw new functions.https.HttpsError('invalid-argument', 'Tracking information required for shipping status');
                        }
                        aggregate.ship(request.adminId, request.tracking);
                        break;
                    case 'delivered':
                        aggregate.markDelivered(request.adminId);
                        break;
                    case 'refunded':
                        aggregate.refund(request.adminId, request.reason || 'Refund recorded by admin');
                        break;
                    default:
                        aggregate.transitionTo(request.newStatus, `admin:${request.adminId}`, request.reason);
                }
            }
            catch (error) {
                if (error instanceof order_1.OrderTransitionError || error instanceof order_1.OrderValidationError) {
                    throw new functions.https.HttpsError('failed-precondition', error.message);
                }
                throw error;
            }
            const updated = aggregate.toData();
            // Preserve administrator input for every transition, including delivery.
            const change = updated.statusHistory[updated.statusHistory.length - 1];
            if (request.reason)
                change.reason = request.reason;
            if (request.adminNotes) {
                change.adminNotes = request.adminNotes;
                updated.adminNotes = request.adminNotes;
            }
            return updated;
        });
        const previousStatus = previousOrder.status;
        const bonusCreditsAwarded = request.newStatus === 'delivered'
            ? updatedOrder.bonusCreditsAwarded
            : undefined;
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