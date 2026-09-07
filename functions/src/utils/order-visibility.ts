import { Order } from '../domain/order/types';

/** Internal fulfilment notes are only exposed through administrator responses. */
export function customerOrder(order: Order): Order {
  const { adminNotes: _adminNotes, qualityCheckNotes: _qualityCheckNotes, ...visible } = order;
  return {
    ...visible,
    statusHistory: order.statusHistory.map(({ adminNotes: _notes, ...change }) => change),
  };
}
