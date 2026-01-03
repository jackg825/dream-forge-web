"use strict";
/**
 * Order Domain Module
 *
 * Exports all order-related domain types and entities
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderTransitionError = exports.OrderValidationError = exports.OrderAggregate = void 0;
__exportStar(require("./types"), exports);
var Order_1 = require("./Order");
Object.defineProperty(exports, "OrderAggregate", { enumerable: true, get: function () { return Order_1.OrderAggregate; } });
Object.defineProperty(exports, "OrderValidationError", { enumerable: true, get: function () { return Order_1.OrderValidationError; } });
Object.defineProperty(exports, "OrderTransitionError", { enumerable: true, get: function () { return Order_1.OrderTransitionError; } });
//# sourceMappingURL=index.js.map