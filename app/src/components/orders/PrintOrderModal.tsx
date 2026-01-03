'use client';

/**
 * Print Order Modal
 *
 * Modal for configuring and placing a print order
 */

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Minus, ShoppingCart, Lock } from 'lucide-react';
import { usePrintConfig, useCart, useUserOrders, useShippingAddresses } from '@/hooks/useOrders';
import { ShippingAddressForm } from './ShippingAddressForm';
import type { PrintMaterial, PrintSizeId, ShippingAddress } from '@/types/order';

interface PrintOrderModalProps {
  open: boolean;
  onClose: () => void;
  pipelineId: string;
  modelUrl: string;
  modelThumbnail?: string;
  modelName?: string;
}

type Step = 'configure' | 'shipping' | 'review';

export function PrintOrderModal({
  open,
  onClose,
  pipelineId,
  modelUrl,
  modelThumbnail,
  modelName,
}: PrintOrderModalProps) {
  const t = useTranslations('orders');
  const router = useRouter();

  // Hooks
  const { materials, sizes, colors, getPrice, loading: configLoading } = usePrintConfig();
  const { addItem, items: cartItems, subtotal, clearCart } = useCart();
  const { createOrder, creatingOrder } = useUserOrders();
  const { addresses, fetchAddresses, loading: addressesLoading } = useShippingAddresses();

  // State
  const [step, setStep] = useState<Step>('configure');
  const [selectedMaterial, setSelectedMaterial] = useState<PrintMaterial>('pla-single');
  const [selectedSize, setSelectedSize] = useState<PrintSizeId>('10x10x10');
  const [selectedColors, setSelectedColors] = useState<string[]>(['white']);
  const [quantity, setQuantity] = useState(1);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress | null>(null);
  const [shippingMethod, setShippingMethod] = useState<'standard' | 'express'>('standard');
  const [saveAddress, setSaveAddress] = useState(false);

  // Load addresses on mount
  useEffect(() => {
    if (open) {
      fetchAddresses();
    }
  }, [open, fetchAddresses]);

  // Set default address
  useEffect(() => {
    if (addresses.length > 0 && !shippingAddress) {
      const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];
      setShippingAddress(defaultAddr);
    }
  }, [addresses, shippingAddress]);

  // Get current price
  const unitPrice = getPrice(selectedMaterial, selectedSize);
  const itemTotal = unitPrice * quantity;

  // Material config
  const currentMaterial = materials.find((m) => m.id === selectedMaterial);
  const maxColors = currentMaterial?.maxColors || 1;

  // Handle color selection
  const handleColorChange = (colorId: string, index: number) => {
    const newColors = [...selectedColors];
    newColors[index] = colorId;
    setSelectedColors(newColors);
  };

  const addColorSlot = () => {
    if (selectedColors.length < maxColors) {
      setSelectedColors([...selectedColors, 'white']);
    }
  };

  const removeColorSlot = (index: number) => {
    if (selectedColors.length > 1) {
      setSelectedColors(selectedColors.filter((_, i) => i !== index));
    }
  };

  // Add to cart
  const handleAddToCart = () => {
    addItem(
      {
        pipelineId,
        modelUrl,
        modelThumbnail,
        modelName,
        material: selectedMaterial,
        size: selectedSize,
        colors: selectedColors,
        quantity,
      },
      unitPrice
    );
    setStep('shipping');
  };

  // Place order
  const handlePlaceOrder = async () => {
    if (!shippingAddress) return;

    const result = await createOrder({
      items: cartItems.map((item) => ({
        pipelineId: item.pipelineId,
        modelUrl: item.modelUrl,
        modelThumbnail: item.modelThumbnail,
        modelName: item.modelName,
        material: item.material,
        size: item.size,
        colors: item.colors,
        quantity: item.quantity,
      })),
      shippingAddress,
      shippingMethod,
      saveAddress,
    });

    if (result) {
      clearCart();
      onClose();
      router.push(`/dashboard/orders/details?id=${result.orderId}`);
    }
  };

  // Format price
  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'configure' && t('modal.configureTitle')}
            {step === 'shipping' && t('modal.shippingTitle')}
            {step === 'review' && t('modal.reviewTitle')}
          </DialogTitle>
        </DialogHeader>

        {configLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Step: Configure */}
            {step === 'configure' && (
              <div className="space-y-6">
                {/* Model preview */}
                {modelThumbnail && (
                  <div className="aspect-square w-32 mx-auto rounded-lg overflow-hidden bg-muted">
                    <img
                      src={modelThumbnail}
                      alt={modelName || 'Model'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Material selection */}
                <div className="space-y-2">
                  <Label>{t('modal.material')}</Label>
                  <RadioGroup
                    value={selectedMaterial}
                    onValueChange={(v) => {
                      setSelectedMaterial(v as PrintMaterial);
                      setSelectedColors(['white']); // Reset colors
                    }}
                  >
                    {materials.map((material) => (
                      <div key={material.id} className="flex items-center space-x-2">
                        <RadioGroupItem value={material.id} id={material.id} />
                        <Label htmlFor={material.id} className="flex-1 cursor-pointer">
                          <span className="font-medium">{material.nameZh}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            {material.descriptionZh}
                          </span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {/* Size selection */}
                <div className="space-y-2">
                  <Label>{t('modal.size')}</Label>
                  <RadioGroup
                    value={selectedSize}
                    onValueChange={(v) => setSelectedSize(v as PrintSizeId)}
                  >
                    {sizes.map((size) => (
                      <div key={size.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value={size.id} id={size.id} />
                          <Label htmlFor={size.id} className="cursor-pointer">
                            {size.displayNameZh}
                          </Label>
                        </div>
                        <span className="text-sm font-medium">
                          {formatPrice(getPrice(selectedMaterial, size.id))}
                        </span>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {/* Color selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{t('modal.colors')}</Label>
                    {maxColors > 1 && selectedColors.length < maxColors && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={addColorSlot}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        {t('modal.addColor')}
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {selectedColors.map((colorId, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Select
                          value={colorId}
                          onValueChange={(v) => handleColorChange(v, index)}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {colors.map((color) => (
                              <SelectItem key={color.id} value={color.id}>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-4 h-4 rounded-full border"
                                    style={{ backgroundColor: color.hex }}
                                  />
                                  {color.nameZh}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedColors.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeColorSlot(index)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quantity */}
                <div className="space-y-2">
                  <Label>{t('modal.quantity')}</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 text-center"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(quantity + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Price summary */}
                <div className="border-t pt-4">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>{t('modal.total')}</span>
                    <span>{formatPrice(itemTotal)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Step: Shipping */}
            {step === 'shipping' && (
              <div className="space-y-6">
                {/* Saved addresses */}
                {addresses.length > 0 && (
                  <div className="space-y-2">
                    <Label>{t('modal.savedAddresses')}</Label>
                    <RadioGroup
                      value={shippingAddress?.id || ''}
                      onValueChange={(id) => {
                        const addr = addresses.find((a) => a.id === id);
                        if (addr) setShippingAddress(addr);
                      }}
                    >
                      {addresses.map((addr) => (
                        <div key={addr.id} className="flex items-start space-x-2 p-2 border rounded">
                          <RadioGroupItem value={addr.id!} id={addr.id} className="mt-1" />
                          <Label htmlFor={addr.id} className="flex-1 cursor-pointer">
                            <div className="font-medium">{addr.recipientName}</div>
                            <div className="text-sm text-muted-foreground">
                              {addr.addressLine1}, {addr.city}, {addr.country}
                            </div>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                )}

                {/* New address form */}
                <div className="space-y-2">
                  <Label>{t('modal.newAddress')}</Label>
                  <ShippingAddressForm
                    address={shippingAddress}
                    onChange={setShippingAddress}
                  />
                </div>

                {/* Save address checkbox */}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="saveAddress"
                    checked={saveAddress}
                    onChange={(e) => setSaveAddress(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="saveAddress">{t('modal.saveAddress')}</Label>
                </div>

                {/* Shipping method */}
                <div className="space-y-2">
                  <Label>{t('modal.shippingMethod')}</Label>
                  <RadioGroup
                    value={shippingMethod}
                    onValueChange={(v) => setShippingMethod(v as 'standard' | 'express')}
                  >
                    <div className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="standard" id="standard" />
                        <Label htmlFor="standard">{t('modal.standardShipping')}</Label>
                      </div>
                      <span className="text-sm text-muted-foreground">7-10 {t('modal.days')}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="express" id="express" />
                        <Label htmlFor="express">{t('modal.expressShipping')}</Label>
                      </div>
                      <span className="text-sm text-muted-foreground">3-5 {t('modal.days')}</span>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            )}

            {/* Step: Review */}
            {step === 'review' && (
              <div className="space-y-6">
                {/* Order items */}
                <div className="space-y-2">
                  <Label>{t('modal.orderItems')}</Label>
                  {cartItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-4 p-2 border rounded">
                      {item.modelThumbnail && (
                        <img
                          src={item.modelThumbnail}
                          alt=""
                          className="w-12 h-12 rounded object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <div className="font-medium">{item.modelName || 'Model'}</div>
                        <div className="text-sm text-muted-foreground">
                          {item.material} • {item.size} • ×{item.quantity}
                        </div>
                      </div>
                      <div className="font-medium">
                        {formatPrice(item.unitPrice * item.quantity)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Shipping address */}
                <div className="space-y-2">
                  <Label>{t('modal.shippingTo')}</Label>
                  <div className="p-2 border rounded text-sm">
                    <div className="font-medium">{shippingAddress?.recipientName}</div>
                    <div className="text-muted-foreground">
                      {shippingAddress?.addressLine1}
                      {shippingAddress?.addressLine2 && `, ${shippingAddress.addressLine2}`}
                      <br />
                      {shippingAddress?.city}, {shippingAddress?.state} {shippingAddress?.postalCode}
                      <br />
                      {shippingAddress?.country}
                    </div>
                  </div>
                </div>

                {/* Total */}
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span>{t('modal.subtotal')}</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('modal.shipping')}</span>
                    <span>{shippingMethod === 'express' ? formatPrice(2000) : formatPrice(700)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-semibold">
                    <span>{t('modal.total')}</span>
                    <span>{formatPrice(subtotal + (shippingMethod === 'express' ? 2000 : 700))}</span>
                  </div>
                </div>

                {/* Payment coming soon */}
                <div className="p-4 bg-muted rounded-lg text-center">
                  <Lock className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {t('modal.paymentComingSoon')}
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        <DialogFooter className="flex gap-2">
          {step === 'configure' && (
            <>
              <Button variant="outline" onClick={onClose}>
                {t('modal.cancel')}
              </Button>
              <Button onClick={handleAddToCart}>
                <ShoppingCart className="h-4 w-4 mr-2" />
                {t('modal.continue')}
              </Button>
            </>
          )}

          {step === 'shipping' && (
            <>
              <Button variant="outline" onClick={() => setStep('configure')}>
                {t('modal.back')}
              </Button>
              <Button
                onClick={() => setStep('review')}
                disabled={!shippingAddress}
              >
                {t('modal.continue')}
              </Button>
            </>
          )}

          {step === 'review' && (
            <>
              <Button variant="outline" onClick={() => setStep('shipping')}>
                {t('modal.back')}
              </Button>
              <Button
                onClick={handlePlaceOrder}
                disabled={creatingOrder}
              >
                {creatingOrder && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('modal.placeOrder')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
