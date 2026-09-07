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
  OrderTransitionError,
  OrderValidationError,
} from '../../domain/order';
import { IOrderRepository } from '../../domain/ports/IOrderRepository';
import { INotificationService } from '../../domain/ports/INotificationService';

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

    const { previousOrder, order: updatedOrder } = await this.orderRepository.updateAtomically(
      request.orderId,
      (order) => {
        const aggregate = OrderAggregate.fromData(order);
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
                throw new functions.https.HttpsError(
                  'invalid-argument', 'Tracking information required for shipping status'
                );
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
        } catch (error) {
          if (error instanceof OrderTransitionError || error instanceof OrderValidationError) {
            throw new functions.https.HttpsError('failed-precondition', error.message);
          }
          throw error;
        }
        const updated = aggregate.toData();
        // Preserve administrator input for every transition, including delivery.
        const change = updated.statusHistory[updated.statusHistory.length - 1];
        if (request.reason) change.reason = request.reason;
        if (request.adminNotes) {
          change.adminNotes = request.adminNotes;
          updated.adminNotes = request.adminNotes;
        }
        return updated;
      }
    );
    const previousStatus = previousOrder.status;
    const bonusCreditsAwarded = request.newStatus === 'delivered'
      ? updatedOrder.bonusCreditsAwarded
      : undefined;

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
