/**
 * Payment Gateway Factory
 *
 * Clean Architecture: Creates payment gateway instances
 * Currently only supports DisabledPaymentAdapter
 * Future: Add StripeAdapter, PayPalAdapter, etc.
 */
import { IPaymentGateway, IPaymentGatewayFactory } from '../../domain/ports/IPaymentGateway';
import { PaymentMethod } from '../../domain/order/types';
/**
 * Payment Gateway Factory Implementation
 */
export declare class PaymentGatewayFactory implements IPaymentGatewayFactory {
    private gateways;
    constructor();
    getGateway(method: PaymentMethod): IPaymentGateway;
    getEnabledGateways(): IPaymentGateway[];
    isMethodEnabled(method: PaymentMethod): boolean;
}
/**
 * Singleton factory instance
 */
export declare const paymentGatewayFactory: PaymentGatewayFactory;
