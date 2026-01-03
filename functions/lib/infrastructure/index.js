"use strict";
/**
 * Infrastructure Layer
 *
 * Clean Architecture: Concrete implementations of domain ports
 *
 * This layer contains:
 * - Repositories: Firestore implementations
 * - Payment Adapters: Stripe, PayPal, Disabled (Coming Soon)
 * - Notification Adapters: Webhook, Email
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookNotificationAdapter = exports.WebhookNotificationAdapter = exports.paymentGatewayFactory = exports.PaymentGatewayFactory = exports.disabledPaymentAdapter = exports.DisabledPaymentAdapter = exports.orderRepository = exports.FirestoreOrderRepository = void 0;
// Repositories
var OrderRepository_1 = require("./repositories/OrderRepository");
Object.defineProperty(exports, "FirestoreOrderRepository", { enumerable: true, get: function () { return OrderRepository_1.FirestoreOrderRepository; } });
Object.defineProperty(exports, "orderRepository", { enumerable: true, get: function () { return OrderRepository_1.orderRepository; } });
// Payment
var DisabledPaymentAdapter_1 = require("./payment/DisabledPaymentAdapter");
Object.defineProperty(exports, "DisabledPaymentAdapter", { enumerable: true, get: function () { return DisabledPaymentAdapter_1.DisabledPaymentAdapter; } });
Object.defineProperty(exports, "disabledPaymentAdapter", { enumerable: true, get: function () { return DisabledPaymentAdapter_1.disabledPaymentAdapter; } });
var PaymentGatewayFactory_1 = require("./payment/PaymentGatewayFactory");
Object.defineProperty(exports, "PaymentGatewayFactory", { enumerable: true, get: function () { return PaymentGatewayFactory_1.PaymentGatewayFactory; } });
Object.defineProperty(exports, "paymentGatewayFactory", { enumerable: true, get: function () { return PaymentGatewayFactory_1.paymentGatewayFactory; } });
// Notifications
var WebhookNotificationAdapter_1 = require("./notification/WebhookNotificationAdapter");
Object.defineProperty(exports, "WebhookNotificationAdapter", { enumerable: true, get: function () { return WebhookNotificationAdapter_1.WebhookNotificationAdapter; } });
Object.defineProperty(exports, "webhookNotificationAdapter", { enumerable: true, get: function () { return WebhookNotificationAdapter_1.webhookNotificationAdapter; } });
//# sourceMappingURL=index.js.map