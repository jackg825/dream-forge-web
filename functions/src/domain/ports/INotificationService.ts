/**
 * Notification Service Interface (Port)
 *
 * Clean Architecture: Abstract interface for sending notifications
 * Implementations: WebhookAdapter (Discord/Slack), EmailAdapter, SMSAdapter
 */

import { Order, OrderStatus } from '../order/types';

/**
 * Notification channel types
 */
export type NotificationChannel =
  | 'webhook'     // Discord, Slack, custom webhook
  | 'email'       // Email notifications
  | 'sms'         // SMS notifications
  | 'push';       // Push notifications (future)

/**
 * Notification recipient
 */
export interface NotificationRecipient {
  userId?: string;
  email?: string;
  phone?: string;
  webhookUrl?: string;
}

/**
 * Notification content
 */
export interface NotificationContent {
  title: string;
  message: string;
  data?: Record<string, unknown>;
  actionUrl?: string;
  actionLabel?: string;
}

/**
 * Order notification payload
 */
export interface OrderNotificationPayload {
  order: Order;
  previousStatus?: OrderStatus;
  newStatus: OrderStatus;
  changedBy: string;
  timestamp: Date;
}

/**
 * Notification result
 */
export interface NotificationResult {
  success: boolean;
  channel: NotificationChannel;
  messageId?: string;
  error?: string;
}

/**
 * Notification Service Interface
 *
 * All notification adapters must implement this interface
 */
export interface INotificationService {
  /**
   * Get the notification channel
   */
  readonly channel: NotificationChannel;

  /**
   * Check if this notification service is enabled
   */
  readonly isEnabled: boolean;

  /**
   * Send an order status change notification
   *
   * @param payload - Order notification data
   * @param recipient - Who to notify
   */
  sendOrderStatusNotification(
    payload: OrderNotificationPayload,
    recipient: NotificationRecipient
  ): Promise<NotificationResult>;

  /**
   * Send a new order notification (for admins)
   *
   * @param order - The new order
   * @param recipient - Admin recipient (webhook URL for Discord/Slack)
   */
  sendNewOrderNotification(
    order: Order,
    recipient: NotificationRecipient
  ): Promise<NotificationResult>;

  /**
   * Send a custom notification
   *
   * @param content - Notification content
   * @param recipient - Recipient info
   */
  sendNotification(
    content: NotificationContent,
    recipient: NotificationRecipient
  ): Promise<NotificationResult>;
}

/**
 * Notification Service Factory
 *
 * Creates notification services for different channels
 */
export interface INotificationServiceFactory {
  /**
   * Get a notification service for the specified channel
   */
  getService(channel: NotificationChannel): INotificationService;

  /**
   * Get all enabled notification services
   */
  getEnabledServices(): INotificationService[];

  /**
   * Send notification through all enabled channels
   */
  notifyAll(
    content: NotificationContent,
    recipient: NotificationRecipient
  ): Promise<NotificationResult[]>;
}

/**
 * Admin notification configuration
 */
export interface AdminNotificationConfig {
  discordWebhookUrl?: string;
  slackWebhookUrl?: string;
  adminEmails?: string[];
  notifyOnNewOrder: boolean;
  notifyOnStatusChange: boolean;
  notifyOnCancellation: boolean;
}
