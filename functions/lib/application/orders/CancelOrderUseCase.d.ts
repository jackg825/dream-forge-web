/**
 * Cancel Order Use Case
 *
 * Clean Architecture: Handles order cancellation
 * Available at: pending, quality_check, shipping statuses
 */
import { OrderStatus } from '../../domain/order';
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
export declare class CancelOrderUseCase {
    private readonly orderRepository;
    private readonly notificationService;
    constructor(orderRepository: IOrderRepository, notificationService: INotificationService);
    /**
     * Execute the use case
     */
    execute(request: CancelOrderRequest): Promise<CancelOrderResponse>;
}
