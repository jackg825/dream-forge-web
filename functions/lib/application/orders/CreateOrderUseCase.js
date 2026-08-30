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
const admin = __importStar(require("firebase-admin"));
const order_1 = require("../../domain/order");
const storage_validation_1 = require("../../utils/storage-validation");
const db = admin.firestore();
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
        // 1. Get pricing lookup from repository
        const pricingMatrix = await this.orderRepository.getPricingMatrix();
        const validatedItems = await this.validateOrderItems(request, pricingMatrix);
        const pricingLookup = (material, size) => {
            const price = pricingMatrix[material]?.[size];
            if (typeof price !== 'number' || price <= 0) {
                throw new functions.https.HttpsError('failed-precondition', `No active price configured for ${material}/${size}`);
            }
            return price;
        };
        // 2. Create order input
        const orderInput = {
            userId: request.userId,
            items: validatedItems.map((item) => ({
                pipelineId: item.pipelineId,
                modelUrl: item.modelUrl,
                modelStoragePath: item.modelStoragePath,
                modelStorageBackend: item.modelStorageBackend,
                modelThumbnail: item.modelThumbnail,
                modelThumbnailStoragePath: item.modelThumbnailStoragePath,
                modelThumbnailStorageBackend: item.modelThumbnailStorageBackend,
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
        // 3. Create order aggregate (validates and calculates pricing)
        const orderAggregate = order_1.OrderAggregate.create(orderInput, pricingLookup);
        const order = orderAggregate.order;
        // 4. Save order to repository
        await this.orderRepository.create(order);
        // 5. Save shipping address if requested
        if (request.saveAddress) {
            await this.orderRepository.saveAddress(request.userId, {
                ...request.shippingAddress,
                isDefault: false,
            });
        }
        // 6. Send notification to admin
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
        // 7. Calculate estimated delivery
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
    async validateOrderItems(request, pricingMatrix) {
        if (!request.items.length || request.items.length > 10) {
            throw new functions.https.HttpsError('invalid-argument', 'Order must contain 1-10 items');
        }
        const pipelineDocs = await Promise.all(request.items.map((item) => db.collection('pipelines').doc(item.pipelineId).get()));
        return request.items.map((item, index) => {
            const materialConfig = order_1.MATERIAL_CONFIGS[item.material];
            const sizeConfig = order_1.SIZE_CONFIGS[item.size];
            const unitPrice = pricingMatrix[item.material]?.[item.size];
            if (!materialConfig || !materialConfig.available) {
                throw new functions.https.HttpsError('invalid-argument', `Unsupported print material: ${item.material}`);
            }
            if (!sizeConfig || !sizeConfig.available) {
                throw new functions.https.HttpsError('invalid-argument', `Unsupported print size: ${item.size}`);
            }
            if (typeof unitPrice !== 'number' || unitPrice <= 0) {
                throw new functions.https.HttpsError('failed-precondition', `No active price configured for ${item.material}/${item.size}`);
            }
            if (!Array.isArray(item.colors) || item.colors.length === 0 || item.colors.length > materialConfig.maxColors) {
                throw new functions.https.HttpsError('invalid-argument', `Expected 1-${materialConfig.maxColors} color(s) for ${item.material}`);
            }
            if (item.quantity < 1 || item.quantity > 10) {
                throw new functions.https.HttpsError('invalid-argument', 'Item quantity must be between 1 and 10');
            }
            const pipelineDoc = pipelineDocs[index];
            if (!pipelineDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'Pipeline not found');
            }
            const pipeline = pipelineDoc.data();
            if (pipeline.userId !== request.userId) {
                throw new functions.https.HttpsError('permission-denied', 'You do not own one of the requested models');
            }
            if (pipeline.status !== 'mesh-ready' && pipeline.status !== 'completed') {
                throw new functions.https.HttpsError('failed-precondition', `Pipeline ${item.pipelineId} is not ready for ordering`);
            }
            const useTexturedModel = Boolean(pipeline.texturedModelUrl);
            const modelUrl = useTexturedModel ? pipeline.texturedModelUrl : pipeline.meshUrl;
            const configuredStoragePath = useTexturedModel
                ? pipeline.texturedModelStoragePath
                : pipeline.meshStoragePath;
            if (!modelUrl) {
                throw new functions.https.HttpsError('failed-precondition', `Pipeline ${item.pipelineId} does not have a generated model`);
            }
            const storageReference = (0, storage_validation_1.extractStorageReferenceFromUrl)(modelUrl);
            const modelStoragePath = configuredStoragePath || storageReference?.storagePath;
            if (!storageReference ||
                !modelStoragePath ||
                storageReference.storagePath !== modelStoragePath) {
                throw new functions.https.HttpsError('failed-precondition', `Pipeline ${item.pipelineId} does not have a valid stored model reference`);
            }
            const modelThumbnail = pipeline.meshImages.front?.url;
            const thumbnailReference = modelThumbnail
                ? (0, storage_validation_1.extractStorageReferenceFromUrl)(modelThumbnail)
                : null;
            return {
                ...item,
                modelUrl,
                modelStoragePath,
                modelStorageBackend: storageReference.backend,
                modelThumbnail: thumbnailReference ? modelThumbnail : undefined,
                modelThumbnailStoragePath: thumbnailReference?.storagePath,
                modelThumbnailStorageBackend: thumbnailReference?.backend,
            };
        });
    }
}
exports.CreateOrderUseCase = CreateOrderUseCase;
//# sourceMappingURL=CreateOrderUseCase.js.map