/**
 * Webhook Notification Adapter
 *
 * Clean Architecture: Sends notifications to Discord/Slack webhooks
 */
import { INotificationService, NotificationChannel, NotificationRecipient, NotificationResult, NotificationContent, OrderNotificationPayload } from '../../domain/ports/INotificationService';
import { Order } from '../../domain/order/types';
/**
 * Webhook Notification Adapter
 *
 * Sends notifications to Discord and Slack webhooks
 */
export declare class WebhookNotificationAdapter implements INotificationService {
    readonly channel: NotificationChannel;
    readonly isEnabled: boolean;
    constructor();
    /**
     * Send order status change notification
     */
    sendOrderStatusNotification(payload: OrderNotificationPayload, recipient: NotificationRecipient): Promise<NotificationResult>;
    /**
     * Send new order notification (for admins)
     */
    sendNewOrderNotification(order: Order, recipient: NotificationRecipient): Promise<NotificationResult>;
    /**
     * Send custom notification
     */
    sendNotification(content: NotificationContent, recipient: NotificationRecipient): Promise<NotificationResult>;
    /**
     * Format currency for display
     */
    private formatCurrency;
}
/**
 * Singleton instance
 */
export declare const webhookNotificationAdapter: WebhookNotificationAdapter;
