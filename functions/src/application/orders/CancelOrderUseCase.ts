/**
 * Cancel Order Use Case
 *
 * Clean Architecture: Handles order cancellation
 * Available at: pending, quality_check, shipping statuses
 */

import * as functions from 'firebase-functions';
import { OrderAggregate, OrderStatus, OrderValidationError, OrderTransitionError } from '../../domain/order';
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

    const { previousOrder, order: updatedOrder } = await this.orderRepository.updateAtomically(
      request.orderId,
      (order) => {
        if (!request.isAdmin && order.userId !== request.userId) {
          throw new functions.https.HttpsError('permission-denied', 'You can only cancel your own orders');
        }
        const aggregate = OrderAggregate.fromData(order);
        try {
          if (request.isAdmin) {
            aggregate.transitionTo('cancelled', `admin:${request.userId}`, request.reason);
          } else {
            aggregate.cancel(request.userId, request.reason);
          }
        } catch (error) {
          if (error instanceof OrderValidationError || error instanceof OrderTransitionError) {
            throw new functions.https.HttpsError('failed-precondition', error.message);
          }
          throw error;
        }
        return aggregate.toData();
      }
    );
    const previousStatus = previousOrder.status;

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
