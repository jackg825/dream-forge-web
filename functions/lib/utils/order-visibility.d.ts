import { Order } from '../domain/order/types';
/** Internal fulfilment notes are only exposed through administrator responses. */
export declare function customerOrder(order: Order): Order;
