/**
 * Cancel Order Use Case
 *
 * Clean Architecture: Handles order cancellation
 * Available at: pending, quality_check, shipping statuses
 */

import * as functions from 'firebase-functions';
import { OrderAggregate, OrderStatus } from '../../domain/order';
import { IOrderRepository } from '../../domain/ports/IOrderRepository';
import { INotificationService } from '../../domain/ports/INotificationService';

/**
 * Cancel order request
 */
export interface CancelOrderRequest {
  orderId: string;
  userId: string;
  reason: string;
  isAdmin?: boolean;
}

/**
 * Cancel order response
 */
export interface CancelOrderResponse {
  success: boolean;
  previousStatus: OrderStatus;
  message: string;
}

/**
 * Cancel Order Use Case
 */
export class CancelOrderUseCase {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly notificationService: INotificationService
  ) {}

  /**
   * Execute the use case
   */
  async execute(request: CancelOrderRequest): Promise<CancelOrderResponse> {
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
      throw new functions.https.HttpsError(
        'permission-denied',
        'You can only cancel your own orders'
      );
    }

    const previousStatus = order.status;

    // 3. Create aggregate and cancel
    const orderAggregate = OrderAggregate.fromData(order);

    try {
      const cancelledBy = request.isAdmin
        ? `admin:${request.userId}`
        : request.userId;

      orderAggregate.cancel(cancelledBy, request.reason);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Cannot cancel')) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Cannot cancel order in '${order.status}' status. Orders can only be cancelled when pending, in quality check, or shipping.`
        );
      }
      throw error;
    }

    // 4. Save updated order
    const updatedOrder = orderAggregate.toData();
    await this.orderRepository.update(request.orderId, updatedOrder);

    // 5. Send notification
    try {
      await this.notificationService.sendOrderStatusNotification(
        {
          order: updatedOrder,
          previousStatus,
          newStatus: 'cancelled',
          changedBy: request.isAdmin ? `admin:${request.userId}` : request.userId,
          timestamp: new Date(),
        },
        { webhookUrl: process.env.ORDER_WEBHOOK_URL }
      );
    } catch (error) {
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
