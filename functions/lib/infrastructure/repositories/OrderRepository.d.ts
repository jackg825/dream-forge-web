/**
 * Firestore Order Repository
 *
 * Clean Architecture: Concrete implementation of IOrderRepository
 * Handles all order-related Firestore operations
 */
import { IOrderRepository, PaginationParams, PaginatedResult, OrderFilterParams } from '../../domain/ports/IOrderRepository';
import { Order, AdminOrder, OrderStatus, ShippingAddress, PrintMaterial, PrintSizeId, MaterialConfig, SizeConfig, ColorOption } from '../../domain/order/types';
/**
 * Firestore Order Repository Implementation
 */
export declare class FirestoreOrderRepository implements IOrderRepository {
    create(order: Order): Promise<string>;
    getById(orderId: string): Promise<Order | null>;
    getByIdWithUser(orderId: string): Promise<AdminOrder | null>;
    update(orderId: string, updates: Partial<Order>): Promise<void>;
    delete(orderId: string): Promise<void>;
    getByUserId(userId: string, pagination?: PaginationParams): Promise<PaginatedResult<Order>>;
    getAll(filters?: OrderFilterParams, pagination?: PaginationParams): Promise<PaginatedResult<AdminOrder>>;
    getByStatus(status: OrderStatus, pagination?: PaginationParams): Promise<PaginatedResult<AdminOrder>>;
    countByStatus(): Promise<Record<OrderStatus, number>>;
    saveAddress(userId: string, address: ShippingAddress): Promise<string>;
    getAddresses(userId: string): Promise<ShippingAddress[]>;
    deleteAddress(userId: string, addressId: string): Promise<void>;
    setDefaultAddress(userId: string, addressId: string): Promise<void>;
    getMaterials(): Promise<MaterialConfig[]>;
    getSizes(): Promise<SizeConfig[]>;
    getColors(): Promise<ColorOption[]>;
    getPrice(material: PrintMaterial, size: PrintSizeId): Promise<number>;
    getPricingMatrix(): Promise<Record<PrintMaterial, Record<PrintSizeId, number>>>;
    updateMaterial(material: MaterialConfig): Promise<void>;
    updateSize(size: SizeConfig): Promise<void>;
    updateColor(color: ColorOption): Promise<void>;
    updatePricing(material: PrintMaterial, size: PrintSizeId, price: number): Promise<void>;
    getOrderStats(fromDate: Date, toDate: Date): Promise<{
        totalOrders: number;
        totalRevenue: number;
        ordersByStatus: Record<OrderStatus, number>;
        ordersByMaterial: Record<PrintMaterial, number>;
        ordersBySize: Record<PrintSizeId, number>;
    }>;
    getDailyStats(date: Date): Promise<{
        orders: number;
        revenue: number;
        newCustomers: number;
    }>;
}
/**
 * Singleton instance
 */
export declare const orderRepository: FirestoreOrderRepository;
