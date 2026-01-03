/**
 * Update Order Status Use Case
 *
 * Clean Architecture: Handles order status transitions
 * Used by admin to move orders through the workflow
 */

import * as functions from 'firebase-functions';
import {
  OrderAggregate,
  OrderStatus,
  ShippingTracking,
} from '../../domain/order';
import { IOrderRepository } from '../../domain/ports/IOrderRepository';
import { INotificationService } from '../../domain/ports/INotificationService';
import { refundCredits } from '../../utils/credits';

/**
 * Update status request
 */
export interface UpdateOrderStatusRequest {
  orderId: string;
  newStatus: OrderStatus;
  adminId: string;
  reason?: string;
  adminNotes?: string;
  tracking?: ShippingTracking;
}

/**
 * Update status response
 */
export interface UpdateOrderStatusResponse {
  success: boolean;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  bonusCreditsAwarded?: number;
}

/**
 * Update Order Status Use Case
 */
export class UpdateOrderStatusUseCase {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly notificationService: INotificationService
  ) {}

  /**
   * Execute the use case
   */
  async execute(request: UpdateOrderStatusRequest): Promise<UpdateOrderStatusResponse> {
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
    const orderAggregate = OrderAggregate.fromData(order);

    let bonusCreditsAwarded: number | undefined;

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
          throw new functions.https.HttpsError(
            'invalid-argument',
            'Tracking information required for shipping status'
          );
        }
        orderAggregate.ship(request.adminId, request.tracking);
        break;

      case 'delivered':
        bonusCreditsAwarded = orderAggregate.markDelivered(request.adminId);

        // Award bonus credits to user
        if (bonusCreditsAwarded > 0) {
          try {
            await refundCredits(
              order.userId,
              bonusCreditsAwarded,
              `delivery-bonus:${order.id}`
            );
            functions.logger.info('Bonus credits awarded', {
              userId: order.userId,
              credits: bonusCreditsAwarded,
              orderId: order.id,
            });
          } catch (error) {
            functions.logger.error('Failed to award bonus credits', { error });
            // Don't fail the status update
          }
        }
        break;

      default:
        orderAggregate.transitionTo(
          request.newStatus,
          `admin:${request.adminId}`,
          request.reason,
          request.adminNotes
        );
    }

    // 3. Save updated order
    const updatedOrder = orderAggregate.toData();
    await this.orderRepository.update(request.orderId, updatedOrder);

    // 4. Send notification
    try {
      await this.notificationService.sendOrderStatusNotification(
        {
          order: updatedOrder,
          previousStatus,
          newStatus: request.newStatus,
          changedBy: `admin:${request.adminId}`,
          timestamp: new Date(),
        },
        { webhookUrl: process.env.ORDER_WEBHOOK_URL }
      );
    } catch (error) {
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
