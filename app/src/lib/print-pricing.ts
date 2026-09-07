import type { PrintMaterial, PrintSizeId } from '@/types/order';

export type PricingDraft = Partial<Record<PrintMaterial, Partial<Record<PrintSizeId, string>>>>;
type Pricing = Record<PrintMaterial, Record<PrintSizeId, number>>;

// Keep incomplete edits as text; converting each keystroke to cents silently
// turns an empty field into a free print and makes decimal prices hard to type.
export function parsePrintPrice(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents <= 100_000_000 ? cents : null;
}

export function createPricingDraft(pricing: Pricing): PricingDraft {
  return Object.fromEntries(Object.entries(pricing).map(([material, sizes]) => [
    material,
    Object.fromEntries(Object.entries(sizes).map(([size, cents]) => [size, (cents / 100).toFixed(2)])),
  ]));
}

export function parsePricingDraft(
  draft: PricingDraft,
  materials: PrintMaterial[],
  sizes: PrintSizeId[],
): Pricing | null {
  if (!materials.length || !sizes.length) return null;
  const pricing = {} as Pricing;
  for (const material of materials) {
    pricing[material] = {} as Record<PrintSizeId, number>;
    for (const size of sizes) {
      const cents = parsePrintPrice(draft[material]?.[size] ?? '');
      if (cents === null) return null;
      pricing[material][size] = cents;
    }
  }
  return pricing;
}
