/**
 * Create Order Use Case
 *
 * Clean Architecture: Application layer orchestrating domain and infrastructure
 * Handles the complete order creation flow
 */
import { PrintMaterial, PrintSizeId } from '../../domain/order';
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
export declare class CreateOrderUseCase {
    private readonly orderRepository;
    private readonly notificationService;
    constructor(orderRepository: IOrderRepository, notificationService: INotificationService);
    /**
     * Execute the use case
     */
    execute(request: CreateOrderRequest): Promise<CreateOrderResponse>;
}
