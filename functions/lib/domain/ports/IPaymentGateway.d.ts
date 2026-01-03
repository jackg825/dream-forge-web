/**
 * Payment Gateway Interface (Port)
 *
 * Clean Architecture: Abstract interface for payment processing
 * Implementations: StripeAdapter, PayPalAdapter, DisabledAdapter (Coming Soon)
 */
import { PaymentMethod } from '../order/types';
/**
 * Payment intent creation result
 */
export interface CreatePaymentIntentResult {
    success: boolean;
    clientSecret?: string;
    transactionId?: string;
    redirectUrl?: string;
    error?: string;
}
/**
 * Payment confirmation result
 */
export interface ConfirmPaymentResult {
    success: boolean;
    transactionId: string;
    paidAt?: Date;
    error?: string;
}
/**
 * Refund result
 */
export interface RefundResult {
    success: boolean;
    refundId?: string;
    refundedAt?: Date;
    error?: string;
}
/**
 * Payment Gateway Interface
 *
 * All payment provider adapters must implement this interface
 */
export interface IPaymentGateway {
    /**
     * Get the payment method identifier
     */
    readonly method: PaymentMethod;
    /**
     * Check if this gateway is enabled
     */
    readonly isEnabled: boolean;
    /**
     * Create a payment intent for an order
     *
     * @param orderId - The order ID
     * @param amount - Amount in cents
     * @param currency - Currency code (USD, CNY, TWD)
     * @param metadata - Additional metadata (userId, items, etc.)
     */
    createPaymentIntent(orderId: string, amount: number, currency: string, metadata?: Record<string, string>): Promise<CreatePaymentIntentResult>;
    /**
     * Confirm a payment (webhook or polling)
     *
     * @param transactionId - The transaction ID from createPaymentIntent
     */
    confirmPayment(transactionId: string): Promise<ConfirmPaymentResult>;
    /**
     * Process a refund
     *
     * @param transactionId - The original transaction ID
     * @param amount - Amount to refund in cents (optional, defaults to full refund)
     * @param reason - Reason for refund
     */
    refundPayment(transactionId: string, amount?: number, reason?: string): Promise<RefundResult>;
    /**
     * Verify a webhook signature
     *
     * @param payload - Raw webhook payload
     * @param signature - Webhook signature header
     */
    verifyWebhook(payload: string, signature: string): boolean;
}
/**
 * Payment Gateway Factory
 *
 * Creates the appropriate payment gateway based on method
 */
export interface IPaymentGatewayFactory {
    /**
     * Get a payment gateway for the specified method
     */
    getGateway(method: PaymentMethod): IPaymentGateway;
    /**
     * Get all enabled payment gateways
     */
    getEnabledGateways(): IPaymentGateway[];
    /**
     * Check if a payment method is enabled
     */
    isMethodEnabled(method: PaymentMethod): boolean;
}
