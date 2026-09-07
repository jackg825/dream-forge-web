import { MaterialConfig, OrderStatus, ShippingTracking } from '../domain/order/types';
export declare function orderText(value: unknown, field: string, maxLength?: number): string;
/** Callable payload encoding can turn optional undefined values into null. */
export declare function optionalOrderText(value: unknown, field: string, maxLength?: number): string | undefined;
export declare function orderId(value: unknown): string;
export declare function orderStatus(value: unknown): OrderStatus;
export declare function optionalOrderStatusFilter(value: unknown): OrderStatus | OrderStatus[] | undefined;
export declare function orderDate(value: unknown, field: string): Date | undefined;
export declare function orderTracking(value: unknown): Omit<ShippingTracking, 'shippedAt'>;
export declare function optionalOrderTracking(value: unknown): Omit<ShippingTracking, 'shippedAt'> | undefined;
export declare function orderMaterial(value: unknown): MaterialConfig;
