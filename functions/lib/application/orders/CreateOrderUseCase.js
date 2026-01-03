"use strict";
/**
 * Create Order Use Case
 *
 * Clean Architecture: Application layer orchestrating domain and infrastructure
 * Handles the complete order creation flow
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
exports.CreateOrderUseCase = void 0;
const functions = __importStar(require("firebase-functions"));
const order_1 = require("../../domain/order");
/**
 * Create Order Use Case
 */
class CreateOrderUseCase {
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
        functions.logger.info('CreateOrderUseCase: Starting', {
            userId: request.userId,
            itemCount: request.items.length,
        });
        // 1. Validate items have valid pipelines (could be extended to check ownership)
        // For now, we trust the frontend has validated this
        // 2. Get pricing lookup from repository
        const pricingMatrix = await this.orderRepository.getPricingMatrix();
        const pricingLookup = (material, size) => {
            return pricingMatrix[material]?.[size] || 0;
        };
        // 3. Create order input
        const orderInput = {
            userId: request.userId,
            items: request.items.map((item) => ({
                pipelineId: item.pipelineId,
                modelUrl: item.modelUrl,
                modelThumbnail: item.modelThumbnail,
                modelName: item.modelName,
                material: item.material,
                size: item.size,
                colors: item.colors,
                quantity: item.quantity,
                unitPrice: 0, // Will be calculated by aggregate
            })),
            shippingAddress: request.shippingAddress,
            shippingMethod: request.shippingMethod,
            saveAddress: request.saveAddress,
        };
        // 4. Create order aggregate (validates and calculates pricing)
        const orderAggregate = order_1.OrderAggregate.create(orderInput, pricingLookup);
        const order = orderAggregate.order;
        // 5. Save order to repository
        await this.orderRepository.create(order);
        // 6. Save shipping address if requested
        if (request.saveAddress) {
            await this.orderRepository.saveAddress(request.userId, {
                ...request.shippingAddress,
                isDefault: false,
            });
        }
        // 7. Send notification to admin
        try {
            await this.notificationService.sendNewOrderNotification(order, {
                webhookUrl: process.env.ORDER_WEBHOOK_URL,
            });
        }
        catch (error) {
            // Don't fail the order if notification fails
            functions.logger.warn('Failed to send new order notification', { error });
        }
        functions.logger.info('CreateOrderUseCase: Order created', {
            orderId: order.id,
            totalAmount: order.payment.totalAmount,
        });
        // 8. Calculate estimated delivery
        const firstItem = order.items[0];
        const estimatedDelivery = new Date();
        const materialDays = firstItem.material === 'resin' ? 7 : 5;
        const shippingDays = order.shippingMethod === 'express' ? 3 : 7;
        estimatedDelivery.setDate(estimatedDelivery.getDate() + materialDays + shippingDays);
        return {
            orderId: order.id,
            totalAmount: order.payment.totalAmount,
            currency: order.payment.currency,
            estimatedDelivery,
        };
    }
}
exports.CreateOrderUseCase = CreateOrderUseCase;
//# sourceMappingURL=CreateOrderUseCase.js.map