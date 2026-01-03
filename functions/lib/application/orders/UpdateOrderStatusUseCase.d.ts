/**
 * Update Order Status Use Case
 *
 * Clean Architecture: Handles order status transitions
 * Used by admin to move orders through the workflow
 */
import { OrderStatus, ShippingTracking } from '../../domain/order';
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
export declare class UpdateOrderStatusUseCase {
    private readonly orderRepository;
    private readonly notificationService;
    constructor(orderRepository: IOrderRepository, notificationService: INotificationService);
    /**
     * Execute the use case
     */
    execute(request: UpdateOrderStatusRequest): Promise<UpdateOrderStatusResponse>;
}
