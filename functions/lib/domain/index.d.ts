/**
 * Domain Layer
 *
 * Clean Architecture: Pure business logic with no external dependencies
 *
 * This layer contains:
 * - Entities: Order, OrderItem, ShippingAddress
 * - Value Objects: OrderStatus, PrintMaterial, PrintSize
 * - Aggregates: OrderAggregate (enforces business rules)
 * - Ports: Abstract interfaces for infrastructure
 */
export * from './order';
export * from './ports';
