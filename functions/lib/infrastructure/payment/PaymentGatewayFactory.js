"use strict";
/**
 * Payment Gateway Factory
 *
 * Clean Architecture: Creates payment gateway instances
 * Currently only supports DisabledPaymentAdapter
 * Future: Add StripeAdapter, PayPalAdapter, etc.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentGatewayFactory = exports.PaymentGatewayFactory = void 0;
const DisabledPaymentAdapter_1 = require("./DisabledPaymentAdapter");
/**
 * Payment Gateway Factory Implementation
 */
class PaymentGatewayFactory {
    gateways = new Map();
    constructor() {
        // Register available gateways
        // Currently only disabled adapter is available
        this.gateways.set('pending', DisabledPaymentAdapter_1.disabledPaymentAdapter);
        // Future: Add real payment gateways when ready
        // this.gateways.set('stripe', new StripePaymentAdapter());
        // this.gateways.set('paypal', new PayPalPaymentAdapter());
        // this.gateways.set('alipay', new AlipayPaymentAdapter());
    }
    getGateway(method) {
        const gateway = this.gateways.get(method);
        if (!gateway) {
            // Fall back to disabled adapter for unknown methods
            return DisabledPaymentAdapter_1.disabledPaymentAdapter;
        }
        return gateway;
    }
    getEnabledGateways() {
        return Array.from(this.gateways.values()).filter((g) => g.isEnabled);
    }
    isMethodEnabled(method) {
        const gateway = this.gateways.get(method);
        return gateway?.isEnabled ?? false;
    }
}
exports.PaymentGatewayFactory = PaymentGatewayFactory;
/**
 * Singleton factory instance
 */
exports.paymentGatewayFactory = new PaymentGatewayFactory();
//# sourceMappingURL=PaymentGatewayFactory.js.map