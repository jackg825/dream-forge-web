/**
 * Disabled Payment Adapter
 *
 * Clean Architecture: Stub implementation for "Coming Soon" payment
 * Returns disabled status for all operations
 */
import { IPaymentGateway, CreatePaymentIntentResult, ConfirmPaymentResult, RefundResult } from '../../domain/ports/IPaymentGateway';
import { PaymentMethod } from '../../domain/order/types';
/**
 * Disabled Payment Adapter
 *
 * Used when payment is not yet integrated.
 * All operations return a "coming soon" error.
 */
export declare class DisabledPaymentAdapter implements IPaymentGateway {
    readonly method: PaymentMethod;
    readonly isEnabled = false;
    createPaymentIntent(_orderId: string, _amount: number, _currency: string, _metadata?: Record<string, string>): Promise<CreatePaymentIntentResult>;
    confirmPayment(_transactionId: string): Promise<ConfirmPaymentResult>;
    refundPayment(_transactionId: string, _amount?: number, _reason?: string): Promise<RefundResult>;
    verifyWebhook(_payload: string, _signature: string): boolean;
}
/**
 * Singleton instance
 */
export declare const disabledPaymentAdapter: DisabledPaymentAdapter;
