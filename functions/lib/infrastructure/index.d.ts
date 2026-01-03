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
export { FirestoreOrderRepository, orderRepository } from './repositories/OrderRepository';
export { DisabledPaymentAdapter, disabledPaymentAdapter } from './payment/DisabledPaymentAdapter';
export { PaymentGatewayFactory, paymentGatewayFactory } from './payment/PaymentGatewayFactory';
export { WebhookNotificationAdapter, webhookNotificationAdapter } from './notification/WebhookNotificationAdapter';
