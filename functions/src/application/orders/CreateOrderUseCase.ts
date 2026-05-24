/**
 * Create Order Use Case
 *
 * Clean Architecture: Application layer orchestrating domain and infrastructure
 * Handles the complete order creation flow
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {
  OrderAggregate,
  CreateOrderInput,
  PrintMaterial,
  PrintSizeId,
  MATERIAL_CONFIGS,
  SIZE_CONFIGS,
} from '../../domain/order';
import { IOrderRepository } from '../../domain/ports/IOrderRepository';
import { INotificationService } from '../../domain/ports/INotificationService';
import type { PipelineDocument } from '../../rodin/types';

const db = admin.firestore();

/**
 * Create order request (from Cloud Function)
 */
export interface CreateOrderRequest {
  userId: string;
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
  shippingAddress: {
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
  };
  shippingMethod: 'standard' | 'express';
  saveAddress?: boolean;
}

/**
 * Create order response
 */
export interface CreateOrderResponse {
  orderId: string;
  totalAmount: number;
  currency: string;
  estimatedDelivery: Date;
}

type RequestedOrderItem = CreateOrderRequest['items'][number];
type ValidatedOrderItem = RequestedOrderItem & {
  modelUrl: string;
  modelThumbnail?: string;
};

/**
 * Create Order Use Case
 */
export class CreateOrderUseCase {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly notificationService: INotificationService
  ) {}

  /**
   * Execute the use case
   */
  async execute(request: CreateOrderRequest): Promise<CreateOrderResponse> {
    functions.logger.info('CreateOrderUseCase: Starting', {
      userId: request.userId,
      itemCount: request.items.length,
    });

    // 1. Get pricing lookup from repository
    const pricingMatrix = await this.orderRepository.getPricingMatrix();
    const validatedItems = await this.validateOrderItems(request, pricingMatrix);

    const pricingLookup = (material: PrintMaterial, size: PrintSizeId): number => {
      const price = pricingMatrix[material]?.[size];
      if (typeof price !== 'number' || price <= 0) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `No active price configured for ${material}/${size}`
        );
      }
      return price;
    };

    // 2. Create order input
    const orderInput: CreateOrderInput = {
      userId: request.userId,
      items: validatedItems.map((item) => ({
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

    // 3. Create order aggregate (validates and calculates pricing)
    const orderAggregate = OrderAggregate.create(orderInput, pricingLookup);
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
    } catch (error) {
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

  private async validateOrderItems(
    request: CreateOrderRequest,
    pricingMatrix: Record<PrintMaterial, Record<PrintSizeId, number>>
  ): Promise<ValidatedOrderItem[]> {
    if (!request.items.length || request.items.length > 10) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Order must contain 1-10 items'
      );
    }

    const pipelineDocs = await Promise.all(
      request.items.map((item) => db.collection('pipelines').doc(item.pipelineId).get())
    );

    return request.items.map((item, index) => {
      const materialConfig = MATERIAL_CONFIGS[item.material];
      const sizeConfig = SIZE_CONFIGS[item.size];
      const unitPrice = pricingMatrix[item.material]?.[item.size];

      if (!materialConfig || !materialConfig.available) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          `Unsupported print material: ${item.material}`
        );
      }

      if (!sizeConfig || !sizeConfig.available) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          `Unsupported print size: ${item.size}`
        );
      }

      if (typeof unitPrice !== 'number' || unitPrice <= 0) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `No active price configured for ${item.material}/${item.size}`
        );
      }

      if (!Array.isArray(item.colors) || item.colors.length === 0 || item.colors.length > materialConfig.maxColors) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          `Expected 1-${materialConfig.maxColors} color(s) for ${item.material}`
        );
      }

      if (item.quantity < 1 || item.quantity > 10) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Item quantity must be between 1 and 10'
        );
      }

      const pipelineDoc = pipelineDocs[index];
      if (!pipelineDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Pipeline not found');
      }

      const pipeline = pipelineDoc.data() as PipelineDocument;
      if (pipeline.userId !== request.userId) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'You do not own one of the requested models'
        );
      }

      if (pipeline.status !== 'mesh-ready' && pipeline.status !== 'completed') {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Pipeline ${item.pipelineId} is not ready for ordering`
        );
      }

      const modelUrl = pipeline.texturedModelUrl || pipeline.meshUrl;
      if (!modelUrl) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Pipeline ${item.pipelineId} does not have a generated model`
        );
      }

      return {
        ...item,
        modelUrl,
        modelThumbnail: item.modelThumbnail || pipeline.meshImages.front?.url,
      };
    });
  }
}
