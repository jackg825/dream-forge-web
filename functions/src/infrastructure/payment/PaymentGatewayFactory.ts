/**
 * Payment Gateway Factory
 *
 * Clean Architecture: Creates payment gateway instances
 * Currently only supports DisabledPaymentAdapter
 * Future: Add StripeAdapter, PayPalAdapter, etc.
 */

import {
  IPaymentGateway,
  IPaymentGatewayFactory,
} from '../../domain/ports/IPaymentGateway';
import { PaymentMethod } from '../../domain/order/types';
import { DisabledPaymentAdapter, disabledPaymentAdapter } from './DisabledPaymentAdapter';

/**
 * Payment Gateway Factory Implementation
 */
export class PaymentGatewayFactory implements IPaymentGatewayFactory {
  private gateways: Map<PaymentMethod, IPaymentGateway> = new Map();

  constructor() {
    // Register available gateways
    // Currently only disabled adapter is available
    this.gateways.set('pending', disabledPaymentAdapter);

    // Future: Add real payment gateways when ready
    // this.gateways.set('stripe', new StripePaymentAdapter());
    // this.gateways.set('paypal', new PayPalPaymentAdapter());
    // this.gateways.set('alipay', new AlipayPaymentAdapter());
  }

  getGateway(method: PaymentMethod): IPaymentGateway {
    const gateway = this.gateways.get(method);
    if (!gateway) {
      // Fall back to disabled adapter for unknown methods
      return disabledPaymentAdapter;
    }
    return gateway;
  }

  getEnabledGateways(): IPaymentGateway[] {
    return Array.from(this.gateways.values()).filter((g) => g.isEnabled);
  }

  isMethodEnabled(method: PaymentMethod): boolean {
    const gateway = this.gateways.get(method);
    return gateway?.isEnabled ?? false;
  }
}

/**
 * Singleton factory instance
 */
export const paymentGatewayFactory = new PaymentGatewayFactory();
