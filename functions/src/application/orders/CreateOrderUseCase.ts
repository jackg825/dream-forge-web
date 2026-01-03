/**
 * Create Order Use Case
 *
 * Clean Architecture: Application layer orchestrating domain and infrastructure
 * Handles the complete order creation flow
 */

import * as functions from 'firebase-functions';
import {
  OrderAggregate,
  CreateOrderInput,
  PrintMaterial,
  PrintSizeId,
} from '../../domain/order';
import { IOrderRepository } from '../../domain/ports/IOrderRepository';
import { INotificationService } from '../../domain/ports/INotificationService';

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

    // 1. Validate items have valid pipelines (could be extended to check ownership)
    // For now, we trust the frontend has validated this

    // 2. Get pricing lookup from repository
    const pricingMatrix = await this.orderRepository.getPricingMatrix();
    const pricingLookup = (material: PrintMaterial, size: PrintSizeId): number => {
      return pricingMatrix[material]?.[size] || 0;
    };

    // 3. Create order input
    const orderInput: CreateOrderInput = {
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
    const orderAggregate = OrderAggregate.create(orderInput, pricingLookup);
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
    } catch (error) {
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
