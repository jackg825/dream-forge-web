/**
 * Disabled Payment Adapter
 *
 * Clean Architecture: Stub implementation for "Coming Soon" payment
 * Returns disabled status for all operations
 */

import {
  IPaymentGateway,
  CreatePaymentIntentResult,
  ConfirmPaymentResult,
  RefundResult,
} from '../../domain/ports/IPaymentGateway';
import { PaymentMethod } from '../../domain/order/types';

/**
 * Disabled Payment Adapter
 *
 * Used when payment is not yet integrated.
 * All operations return a "coming soon" error.
 */
export class DisabledPaymentAdapter implements IPaymentGateway {
  readonly method: PaymentMethod = 'pending';
  readonly isEnabled = false;

  async createPaymentIntent(
    _orderId: string,
    _amount: number,
    _currency: string,
    _metadata?: Record<string, string>
  ): Promise<CreatePaymentIntentResult> {
    return {
      success: false,
      error: 'Payment integration coming soon. Orders are currently processed manually.',
    };
  }

  async confirmPayment(_transactionId: string): Promise<ConfirmPaymentResult> {
    return {
      success: false,
      transactionId: '',
      error: 'Payment integration coming soon.',
    };
  }

  async refundPayment(
    _transactionId: string,
    _amount?: number,
    _reason?: string
  ): Promise<RefundResult> {
    return {
      success: false,
      error: 'Payment integration coming soon.',
    };
  }

  verifyWebhook(_payload: string, _signature: string): boolean {
    return false;
  }
}

/**
 * Singleton instance
 */
export const disabledPaymentAdapter = new DisabledPaymentAdapter();
