"use strict";
/**
 * Webhook Notification Adapter
 *
 * Clean Architecture: Sends notifications to Discord/Slack webhooks
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookNotificationAdapter = exports.WebhookNotificationAdapter = void 0;
const axios_1 = __importDefault(require("axios"));
const functions = __importStar(require("firebase-functions"));
const types_1 = require("../../domain/order/types");
/**
 * Discord embed color based on order status
 */
const STATUS_COLORS = {
    pending: 0xfbbf24, // Yellow
    confirmed: 0x3b82f6, // Blue
    printing: 0xa855f7, // Purple
    quality_check: 0xf97316, // Orange
    shipping: 0x06b6d4, // Cyan
    delivered: 0x22c55e, // Green
    cancelled: 0x6b7280, // Gray
    refunded: 0xef4444, // Red
};
/**
 * Webhook Notification Adapter
 *
 * Sends notifications to Discord and Slack webhooks
 */
class WebhookNotificationAdapter {
    channel = 'webhook';
    isEnabled;
    constructor() {
        // Check if webhook URL is configured
        this.isEnabled = !!process.env.ORDER_WEBHOOK_URL || !!process.env.ORDER_DISCORD_WEBHOOK_URL;
    }
    /**
     * Send order status change notification
     */
    async sendOrderStatusNotification(payload, recipient) {
        const webhookUrl = recipient.webhookUrl || process.env.ORDER_WEBHOOK_URL;
        if (!webhookUrl) {
            return {
                success: false,
                channel: 'webhook',
                error: 'No webhook URL configured',
            };
        }
        const statusConfig = types_1.ORDER_STATUS_CONFIG[payload.newStatus];
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
            await axios_1.default.post(webhookUrl, { embeds: [embed] });
            return {
                success: true,
                channel: 'webhook',
            };
        }
        catch (error) {
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
    async sendNewOrderNotification(order, recipient) {
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
                    value: order.items.map((item) => `• ${item.material} (${item.size}) × ${item.quantity}`).join('\n') || 'No items',
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
            await axios_1.default.post(webhookUrl, { embeds: [embed] });
            return {
                success: true,
                channel: 'webhook',
            };
        }
        catch (error) {
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
    async sendNotification(content, recipient) {
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
            await axios_1.default.post(webhookUrl, { embeds: [embed] });
            return {
                success: true,
                channel: 'webhook',
            };
        }
        catch (error) {
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
    formatCurrency(amount, currency) {
        const formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
        });
        return formatter.format(amount / 100); // Convert cents to dollars
    }
}
exports.WebhookNotificationAdapter = WebhookNotificationAdapter;
/**
 * Singleton instance
 */
exports.webhookNotificationAdapter = new WebhookNotificationAdapter();
//# sourceMappingURL=WebhookNotificationAdapter.js.map