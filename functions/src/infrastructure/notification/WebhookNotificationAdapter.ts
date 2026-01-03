/**
 * Webhook Notification Adapter
 *
 * Clean Architecture: Sends notifications to Discord/Slack webhooks
 */

import axios from 'axios';
import * as functions from 'firebase-functions';
import {
  INotificationService,
  NotificationChannel,
  NotificationRecipient,
  NotificationResult,
  NotificationContent,
  OrderNotificationPayload,
} from '../../domain/ports/INotificationService';
import { Order, ORDER_STATUS_CONFIG } from '../../domain/order/types';

/**
 * Discord embed color based on order status
 */
const STATUS_COLORS: Record<string, number> = {
  pending: 0xfbbf24,      // Yellow
  confirmed: 0x3b82f6,    // Blue
  printing: 0xa855f7,     // Purple
  quality_check: 0xf97316, // Orange
  shipping: 0x06b6d4,     // Cyan
  delivered: 0x22c55e,    // Green
  cancelled: 0x6b7280,    // Gray
  refunded: 0xef4444,     // Red
};

/**
 * Webhook Notification Adapter
 *
 * Sends notifications to Discord and Slack webhooks
 */
export class WebhookNotificationAdapter implements INotificationService {
  readonly channel: NotificationChannel = 'webhook';
  readonly isEnabled: boolean;

  constructor() {
    // Check if webhook URL is configured
    this.isEnabled = !!process.env.ORDER_WEBHOOK_URL || !!process.env.ORDER_DISCORD_WEBHOOK_URL;
  }

  /**
   * Send order status change notification
   */
  async sendOrderStatusNotification(
    payload: OrderNotificationPayload,
    recipient: NotificationRecipient
  ): Promise<NotificationResult> {
    const webhookUrl = recipient.webhookUrl || process.env.ORDER_WEBHOOK_URL;

    if (!webhookUrl) {
      return {
        success: false,
        channel: 'webhook',
        error: 'No webhook URL configured',
      };
    }

    const statusConfig = ORDER_STATUS_CONFIG[payload.newStatus];
    const color = STATUS_COLORS[payload.newStatus] || 0x6b7280;

    // Build Discord embed
    const embed = {
      title: `Order ${payload.order.id.slice(0, 8)} Status Updated`,
      description: `Status changed from **${payload.previousStatus}** to **${payload.newStatus}**`,
      color,
      fields: [
        {
          name: 'Order ID',
          value: payload.order.id,
          inline: true,
        },
        {
          name: 'Status',
          value: statusConfig.label,
          inline: true,
        },
        {
          name: 'Items',
          value: `${payload.order.items.length} item(s)`,
          inline: true,
        },
        {
          name: 'Total',
          value: this.formatCurrency(payload.order.payment.totalAmount, payload.order.payment.currency),
          inline: true,
        },
        {
          name: 'Changed By',
          value: payload.changedBy,
          inline: true,
        },
      ],
      timestamp: payload.timestamp.toISOString(),
      footer: {
        text: 'Dream Forge Print Orders',
      },
    };

    try {
      await axios.post(webhookUrl, { embeds: [embed] });

      return {
        success: true,
        channel: 'webhook',
      };
    } catch (error) {
      functions.logger.error('Webhook notification failed:', error);
      return {
        success: false,
        channel: 'webhook',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send new order notification (for admins)
   */
  async sendNewOrderNotification(
    order: Order,
    recipient: NotificationRecipient
  ): Promise<NotificationResult> {
    const webhookUrl = recipient.webhookUrl || process.env.ORDER_WEBHOOK_URL;

    if (!webhookUrl) {
      return {
        success: false,
        channel: 'webhook',
        error: 'No webhook URL configured',
      };
    }

    // Build Discord embed for new order
    const embed = {
      title: '🆕 New Print Order Received!',
      description: `Order **${order.id.slice(0, 8)}** has been placed.`,
      color: 0x22c55e, // Green
      fields: [
        {
          name: 'Order ID',
          value: order.id,
          inline: false,
        },
        {
          name: 'Items',
          value: order.items.map((item) =>
            `• ${item.material} (${item.size}) × ${item.quantity}`
          ).join('\n') || 'No items',
          inline: false,
        },
        {
          name: 'Total Amount',
          value: this.formatCurrency(order.payment.totalAmount, order.payment.currency),
          inline: true,
        },
        {
          name: 'Shipping To',
          value: `${order.shippingAddress.city}, ${order.shippingAddress.country}`,
          inline: true,
        },
        {
          name: 'Shipping Method',
          value: order.shippingMethod === 'express' ? 'Express 🚀' : 'Standard 📦',
          inline: true,
        },
      ],
      timestamp: order.createdAt.toISOString(),
      footer: {
        text: 'Dream Forge Print Orders',
      },
    };

    try {
      await axios.post(webhookUrl, { embeds: [embed] });

      return {
        success: true,
        channel: 'webhook',
      };
    } catch (error) {
      functions.logger.error('New order webhook notification failed:', error);
      return {
        success: false,
        channel: 'webhook',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send custom notification
   */
  async sendNotification(
    content: NotificationContent,
    recipient: NotificationRecipient
  ): Promise<NotificationResult> {
    const webhookUrl = recipient.webhookUrl || process.env.ORDER_WEBHOOK_URL;

    if (!webhookUrl) {
      return {
        success: false,
        channel: 'webhook',
        error: 'No webhook URL configured',
      };
    }

    const embed = {
      title: content.title,
      description: content.message,
      color: 0x6366f1, // Indigo
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Dream Forge',
      },
    };

    try {
      await axios.post(webhookUrl, { embeds: [embed] });

      return {
        success: true,
        channel: 'webhook',
      };
    } catch (error) {
      functions.logger.error('Custom webhook notification failed:', error);
      return {
        success: false,
        channel: 'webhook',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Format currency for display
   */
  private formatCurrency(amount: number, currency: string): string {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    });
    return formatter.format(amount / 100); // Convert cents to dollars
  }
}

/**
 * Singleton instance
 */
export const webhookNotificationAdapter = new WebhookNotificationAdapter();
