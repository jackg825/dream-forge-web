"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customerOrder = customerOrder;
/** Internal fulfilment notes are only exposed through administrator responses. */
function customerOrder(order) {
    const { adminNotes: _adminNotes, qualityCheckNotes: _qualityCheckNotes, ...visible } = order;
    return {
        ...visible,
        statusHistory: order.statusHistory.map(({ adminNotes: _notes, ...change }) => change),
    };
}
//# sourceMappingURL=order-visibility.js.map