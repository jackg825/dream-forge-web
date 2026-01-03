'use client';

/**
 * Order Hooks for Print Ordering System
 *
 * Provides hooks for managing orders, cart, and print configuration
 */

import { useState, useCallback, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import type {
  Order,
  AdminOrder,
  OrderStatus,
  ShippingAddress,
  CartItem,
  CartState,
  CreateOrderRequest,
  CreateOrderResponse,
  GetOrdersResponse,
  GetOrderDetailsResponse,
  CancelOrderResponse,
  PrintConfigResponse,
  MaterialConfig,
  SizeConfig,
  ColorOption,
  PrintMaterial,
  PrintSizeId,
  UpdateOrderStatusRequest,
  UpdateOrderStatusResponse,
  OrderStatsResponse,
} from '@/types/order';

// ============================================
// Print Config Hook
// ============================================

interface UsePrintConfigReturn {
  materials: MaterialConfig[];
  sizes: SizeConfig[];
  colors: ColorOption[];
  pricing: Record<PrintMaterial, Record<PrintSizeId, number>>;
  loading: boolean;
  error: string | null;
  getPrice: (material: PrintMaterial, size: PrintSizeId) => number;
  refresh: () => Promise<void>;
}

export function usePrintConfig(): UsePrintConfigReturn {
  const [materials, setMaterials] = useState<MaterialConfig[]>([]);
  const [sizes, setSizes] = useState<SizeConfig[]>([]);
  const [colors, setColors] = useState<ColorOption[]>([]);
  const [pricing, setPricing] = useState<Record<PrintMaterial, Record<PrintSizeId, number>>>({} as any);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!functions) return;

    setLoading(true);
    setError(null);

    try {
      const getPrintConfigFn = httpsCallable<void, PrintConfigResponse>(
        functions,
        'getPrintConfig'
      );
      const result = await getPrintConfigFn();

      setMaterials(result.data.materials);
      setSizes(result.data.sizes);
      setColors(result.data.colors);
      setPricing(result.data.pricing);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load print configuration';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getPrice = useCallback(
    (material: PrintMaterial, size: PrintSizeId): number => {
      return pricing[material]?.[size] || 0;
    },
    [pricing]
  );

  return {
    materials,
    sizes,
    colors,
    pricing,
    loading,
    error,
    getPrice,
    refresh,
  };
}

// ============================================
// Cart Hook (Client-side state)
// ============================================

interface UseCartReturn {
  items: CartItem[];
  shippingAddress: ShippingAddress | null;
  shippingMethod: 'standard' | 'express';
  itemCount: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, 'unitPrice'>, unitPrice: number) => void;
  removeItem: (pipelineId: string) => void;
  updateQuantity: (pipelineId: string, quantity: number) => void;
  setShippingAddress: (address: ShippingAddress) => void;
  setShippingMethod: (method: 'standard' | 'express') => void;
  clearCart: () => void;
}

export function useCart(): UseCartReturn {
  const [cart, setCart] = useState<CartState>({
    items: [],
    shippingAddress: null,
    shippingMethod: 'standard',
  });

  const addItem = useCallback((item: Omit<CartItem, 'unitPrice'>, unitPrice: number) => {
    setCart((prev) => {
      // Check if item already exists
      const existingIndex = prev.items.findIndex(
        (i) =>
          i.pipelineId === item.pipelineId &&
          i.material === item.material &&
          i.size === item.size &&
          JSON.stringify(i.colors) === JSON.stringify(item.colors)
      );

      if (existingIndex >= 0) {
        // Update quantity
        const newItems = [...prev.items];
        newItems[existingIndex].quantity += item.quantity;
        return { ...prev, items: newItems };
      }

      // Add new item
      return {
        ...prev,
        items: [...prev.items, { ...item, unitPrice }],
      };
    });
  }, []);

  const removeItem = useCallback((pipelineId: string) => {
    setCart((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.pipelineId !== pipelineId),
    }));
  }, []);

  const updateQuantity = useCallback((pipelineId: string, quantity: number) => {
    if (quantity < 1) return;

    setCart((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        i.pipelineId === pipelineId ? { ...i, quantity } : i
      ),
    }));
  }, []);

  const setShippingAddress = useCallback((address: ShippingAddress) => {
    setCart((prev) => ({ ...prev, shippingAddress: address }));
  }, []);

  const setShippingMethod = useCallback((method: 'standard' | 'express') => {
    setCart((prev) => ({ ...prev, shippingMethod: method }));
  }, []);

  const clearCart = useCallback(() => {
    setCart({
      items: [],
      shippingAddress: null,
      shippingMethod: 'standard',
    });
  }, []);

  const itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = cart.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  return {
    items: cart.items,
    shippingAddress: cart.shippingAddress,
    shippingMethod: cart.shippingMethod,
    itemCount,
    subtotal,
    addItem,
    removeItem,
    updateQuantity,
    setShippingAddress,
    setShippingMethod,
    clearCart,
  };
}

// ============================================
// User Orders Hook
// ============================================

interface UseUserOrdersReturn {
  orders: Order[];
  loading: boolean;
  error: string | null;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  } | null;
  fetchOrders: (limit?: number, offset?: number) => Promise<void>;
  createOrder: (request: CreateOrderRequest) => Promise<CreateOrderResponse | null>;
  cancelOrder: (orderId: string, reason?: string) => Promise<boolean>;
  creatingOrder: boolean;
  cancellingOrder: boolean;
}

export function useUserOrders(): UseUserOrdersReturn {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<UseUserOrdersReturn['pagination']>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(false);

  const fetchOrders = useCallback(async (limit = 20, offset = 0) => {
    if (!functions) return;

    setLoading(true);
    setError(null);

    try {
      const getUserOrdersFn = httpsCallable<
        { limit: number; offset: number },
        GetOrdersResponse
      >(functions, 'getUserOrders');

      const result = await getUserOrdersFn({ limit, offset });
      setOrders(result.data.orders);
      setPagination(result.data.pagination);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch orders';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createOrder = useCallback(async (
    request: CreateOrderRequest
  ): Promise<CreateOrderResponse | null> => {
    if (!functions) return null;

    setCreatingOrder(true);
    setError(null);

    try {
      const createOrderFn = httpsCallable<CreateOrderRequest, CreateOrderResponse>(
        functions,
        'createOrder'
      );

      const result = await createOrderFn(request);
      // Refresh orders list
      await fetchOrders();
      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create order';
      setError(message);
      return null;
    } finally {
      setCreatingOrder(false);
    }
  }, [fetchOrders]);

  const cancelOrder = useCallback(async (
    orderId: string,
    reason?: string
  ): Promise<boolean> => {
    if (!functions) return false;

    setCancellingOrder(true);
    setError(null);

    try {
      const cancelOrderFn = httpsCallable<
        { orderId: string; reason?: string },
        CancelOrderResponse
      >(functions, 'cancelOrder');

      await cancelOrderFn({ orderId, reason });
      // Refresh orders list
      await fetchOrders();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel order';
      setError(message);
      return false;
    } finally {
      setCancellingOrder(false);
    }
  }, [fetchOrders]);

  return {
    orders,
    loading,
    error,
    pagination,
    fetchOrders,
    createOrder,
    cancelOrder,
    creatingOrder,
    cancellingOrder,
  };
}

// ============================================
// Shipping Addresses Hook
// ============================================

interface UseShippingAddressesReturn {
  addresses: ShippingAddress[];
  loading: boolean;
  error: string | null;
  fetchAddresses: () => Promise<void>;
  saveAddress: (address: ShippingAddress) => Promise<string | null>;
  deleteAddress: (addressId: string) => Promise<boolean>;
  savingAddress: boolean;
  deletingAddress: boolean;
}

export function useShippingAddresses(): UseShippingAddressesReturn {
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const [deletingAddress, setDeletingAddress] = useState(false);

  const fetchAddresses = useCallback(async () => {
    if (!functions) return;

    setLoading(true);
    setError(null);

    try {
      const getAddressesFn = httpsCallable<
        void,
        { success: boolean; addresses: ShippingAddress[] }
      >(functions, 'getShippingAddresses');

      const result = await getAddressesFn();
      setAddresses(result.data.addresses);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch addresses';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveAddress = useCallback(async (
    address: ShippingAddress
  ): Promise<string | null> => {
    if (!functions) return null;

    setSavingAddress(true);
    setError(null);

    try {
      const saveAddressFn = httpsCallable<
        { address: ShippingAddress },
        { success: boolean; addressId: string }
      >(functions, 'saveShippingAddress');

      const result = await saveAddressFn({ address });
      await fetchAddresses();
      return result.data.addressId;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save address';
      setError(message);
      return null;
    } finally {
      setSavingAddress(false);
    }
  }, [fetchAddresses]);

  const deleteAddress = useCallback(async (addressId: string): Promise<boolean> => {
    if (!functions) return false;

    setDeletingAddress(true);
    setError(null);

    try {
      const deleteAddressFn = httpsCallable<
        { addressId: string },
        { success: boolean }
      >(functions, 'deleteShippingAddress');

      await deleteAddressFn({ addressId });
      await fetchAddresses();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete address';
      setError(message);
      return false;
    } finally {
      setDeletingAddress(false);
    }
  }, [fetchAddresses]);

  return {
    addresses,
    loading,
    error,
    fetchAddresses,
    saveAddress,
    deleteAddress,
    savingAddress,
    deletingAddress,
  };
}

// ============================================
// Admin Orders Hook
// ============================================

interface UseAdminOrdersReturn {
  orders: AdminOrder[];
  loading: boolean;
  error: string | null;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  } | null;
  stats: OrderStatsResponse | null;
  fetchOrders: (filters?: {
    status?: OrderStatus;
    userId?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    offset?: number;
  }) => Promise<void>;
  fetchOrdersByStatus: (status: OrderStatus, limit?: number) => Promise<AdminOrder[]>;
  fetchStats: () => Promise<void>;
  updateOrderStatus: (request: UpdateOrderStatusRequest) => Promise<UpdateOrderStatusResponse | null>;
  updateTracking: (
    orderId: string,
    tracking: { carrier: string; trackingNumber: string; trackingUrl?: string }
  ) => Promise<boolean>;
  updatingStatus: boolean;
  updatingTracking: boolean;
}

export function useAdminOrders(): UseAdminOrdersReturn {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<UseAdminOrdersReturn['pagination']>(null);
  const [stats, setStats] = useState<OrderStatsResponse | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingTracking, setUpdatingTracking] = useState(false);

  const fetchOrders = useCallback(async (filters?: {
    status?: OrderStatus;
    userId?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    offset?: number;
  }) => {
    if (!functions) return;

    setLoading(true);
    setError(null);

    try {
      const listAllOrdersFn = httpsCallable<typeof filters, GetOrdersResponse & { orders: AdminOrder[] }>(
        functions,
        'listAllOrders'
      );

      const result = await listAllOrdersFn(filters);
      setOrders(result.data.orders);
      setPagination(result.data.pagination);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch orders';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOrdersByStatus = useCallback(async (
    status: OrderStatus,
    limit = 20
  ): Promise<AdminOrder[]> => {
    if (!functions) return [];

    try {
      const getOrdersByStatusFn = httpsCallable<
        { status: OrderStatus; limit: number },
        { success: boolean; orders: AdminOrder[]; total: number }
      >(functions, 'getOrdersByStatus');

      const result = await getOrdersByStatusFn({ status, limit });
      return result.data.orders;
    } catch (err) {
      console.error('fetchOrdersByStatus error:', err);
      return [];
    }
  }, []);

  const fetchStats = useCallback(async () => {
    if (!functions) return;

    try {
      const getOrderStatsFn = httpsCallable<void, OrderStatsResponse>(
        functions,
        'getOrderStats'
      );

      const result = await getOrderStatsFn();
      setStats(result.data);
    } catch (err) {
      console.error('fetchStats error:', err);
    }
  }, []);

  const updateOrderStatus = useCallback(async (
    request: UpdateOrderStatusRequest
  ): Promise<UpdateOrderStatusResponse | null> => {
    if (!functions) return null;

    setUpdatingStatus(true);
    setError(null);

    try {
      const updateOrderStatusFn = httpsCallable<
        UpdateOrderStatusRequest,
        UpdateOrderStatusResponse
      >(functions, 'updateOrderStatus');

      const result = await updateOrderStatusFn(request);
      // Refresh orders
      await fetchOrders();
      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update order status';
      setError(message);
      return null;
    } finally {
      setUpdatingStatus(false);
    }
  }, [fetchOrders]);

  const updateTracking = useCallback(async (
    orderId: string,
    tracking: { carrier: string; trackingNumber: string; trackingUrl?: string }
  ): Promise<boolean> => {
    if (!functions) return false;

    setUpdatingTracking(true);
    setError(null);

    try {
      const updateTrackingFn = httpsCallable<
        { orderId: string } & typeof tracking,
        { success: boolean }
      >(functions, 'updateTrackingInfo');

      await updateTrackingFn({ orderId, ...tracking });
      await fetchOrders();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update tracking';
      setError(message);
      return false;
    } finally {
      setUpdatingTracking(false);
    }
  }, [fetchOrders]);

  return {
    orders,
    loading,
    error,
    pagination,
    stats,
    fetchOrders,
    fetchOrdersByStatus,
    fetchStats,
    updateOrderStatus,
    updateTracking,
    updatingStatus,
    updatingTracking,
  };
}
