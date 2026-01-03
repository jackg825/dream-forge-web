"use strict";
/**
 * Disabled Payment Adapter
 *
 * Clean Architecture: Stub implementation for "Coming Soon" payment
 * Returns disabled status for all operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.disabledPaymentAdapter = exports.DisabledPaymentAdapter = void 0;
/**
 * Disabled Payment Adapter
 *
 * Used when payment is not yet integrated.
 * All operations return a "coming soon" error.
 */
class DisabledPaymentAdapter {
    method = 'pending';
    isEnabled = false;
    async createPaymentIntent(_orderId, _amount, _currency, _metadata) {
        return {
            success: false,
            error: 'Payment integration coming soon. Orders are currently processed manually.',
        };
    }
    async confirmPayment(_transactionId) {
        return {
            success: false,
            transactionId: '',
            error: 'Payment integration coming soon.',
        };
    }
    async refundPayment(_transactionId, _amount, _reason) {
        return {
            success: false,
            error: 'Payment integration coming soon.',
        };
    }
    verifyWebhook(_payload, _signature) {
        return false;
    }
}
exports.DisabledPaymentAdapter = DisabledPaymentAdapter;
/**
 * Singleton instance
 */
exports.disabledPaymentAdapter = new DisabledPaymentAdapter();
//# sourceMappingURL=DisabledPaymentAdapter.js.map