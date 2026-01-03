'use client';

/**
 * Shipping Address Form
 *
 * Form component for entering/editing shipping address
 */

import { useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ShippingAddress } from '@/types/order';

interface ShippingAddressFormProps {
  address: ShippingAddress | null;
  onChange: (address: ShippingAddress) => void;
  disabled?: boolean;
}

// Common countries for shipping
const COUNTRIES = [
  { code: 'TW', name: '台灣', nameEn: 'Taiwan' },
  { code: 'CN', name: '中國', nameEn: 'China' },
  { code: 'HK', name: '香港', nameEn: 'Hong Kong' },
  { code: 'JP', name: '日本', nameEn: 'Japan' },
  { code: 'KR', name: '韓國', nameEn: 'South Korea' },
  { code: 'US', name: '美國', nameEn: 'United States' },
  { code: 'CA', name: '加拿大', nameEn: 'Canada' },
  { code: 'UK', name: '英國', nameEn: 'United Kingdom' },
  { code: 'AU', name: '澳洲', nameEn: 'Australia' },
  { code: 'SG', name: '新加坡', nameEn: 'Singapore' },
  { code: 'MY', name: '馬來西亞', nameEn: 'Malaysia' },
];

export function ShippingAddressForm({
  address,
  onChange,
  disabled = false,
}: ShippingAddressFormProps) {
  const t = useTranslations('orders');

  const handleChange = (field: keyof ShippingAddress, value: string) => {
    onChange({
      ...address,
      recipientName: address?.recipientName || '',
      phone: address?.phone || '',
      country: address?.country || 'TW',
      city: address?.city || '',
      postalCode: address?.postalCode || '',
      addressLine1: address?.addressLine1 || '',
      [field]: value,
    });
  };

  return (
    <div className="space-y-4">
      {/* Recipient name */}
      <div className="space-y-2">
        <Label htmlFor="recipientName">{t('address.recipientName')} *</Label>
        <Input
          id="recipientName"
          value={address?.recipientName || ''}
          onChange={(e) => handleChange('recipientName', e.target.value)}
          placeholder={t('address.recipientNamePlaceholder')}
          disabled={disabled}
        />
      </div>

      {/* Phone */}
      <div className="space-y-2">
        <Label htmlFor="phone">{t('address.phone')} *</Label>
        <Input
          id="phone"
          type="tel"
          value={address?.phone || ''}
          onChange={(e) => handleChange('phone', e.target.value)}
          placeholder={t('address.phonePlaceholder')}
          disabled={disabled}
        />
      </div>

      {/* Email (optional) */}
      <div className="space-y-2">
        <Label htmlFor="email">{t('address.email')}</Label>
        <Input
          id="email"
          type="email"
          value={address?.email || ''}
          onChange={(e) => handleChange('email', e.target.value)}
          placeholder={t('address.emailPlaceholder')}
          disabled={disabled}
        />
      </div>

      {/* Country */}
      <div className="space-y-2">
        <Label htmlFor="country">{t('address.country')} *</Label>
        <Select
          value={address?.country || 'TW'}
          onValueChange={(v) => handleChange('country', v)}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                {country.name} ({country.nameEn})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* State/Province */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="state">{t('address.state')}</Label>
          <Input
            id="state"
            value={address?.state || ''}
            onChange={(e) => handleChange('state', e.target.value)}
            placeholder={t('address.statePlaceholder')}
            disabled={disabled}
          />
        </div>

        {/* City */}
        <div className="space-y-2">
          <Label htmlFor="city">{t('address.city')} *</Label>
          <Input
            id="city"
            value={address?.city || ''}
            onChange={(e) => handleChange('city', e.target.value)}
            placeholder={t('address.cityPlaceholder')}
            disabled={disabled}
          />
        </div>
      </div>

      {/* District and Postal Code */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="district">{t('address.district')}</Label>
          <Input
            id="district"
            value={address?.district || ''}
            onChange={(e) => handleChange('district', e.target.value)}
            placeholder={t('address.districtPlaceholder')}
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="postalCode">{t('address.postalCode')} *</Label>
          <Input
            id="postalCode"
            value={address?.postalCode || ''}
            onChange={(e) => handleChange('postalCode', e.target.value)}
            placeholder={t('address.postalCodePlaceholder')}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Address Line 1 */}
      <div className="space-y-2">
        <Label htmlFor="addressLine1">{t('address.addressLine1')} *</Label>
        <Input
          id="addressLine1"
          value={address?.addressLine1 || ''}
          onChange={(e) => handleChange('addressLine1', e.target.value)}
          placeholder={t('address.addressLine1Placeholder')}
          disabled={disabled}
        />
      </div>

      {/* Address Line 2 */}
      <div className="space-y-2">
        <Label htmlFor="addressLine2">{t('address.addressLine2')}</Label>
        <Input
          id="addressLine2"
          value={address?.addressLine2 || ''}
          onChange={(e) => handleChange('addressLine2', e.target.value)}
          placeholder={t('address.addressLine2Placeholder')}
          disabled={disabled}
        />
      </div>

      {/* Address label */}
      <div className="space-y-2">
        <Label htmlFor="label">{t('address.label')}</Label>
        <Input
          id="label"
          value={address?.label || ''}
          onChange={(e) => handleChange('label', e.target.value)}
          placeholder={t('address.labelPlaceholder')}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
