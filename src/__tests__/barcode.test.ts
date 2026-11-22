import { describe, expect, it } from '@jest/globals';
import { isValidGtin, lookupVariants, normalizeBarcode, parseOffProduct, portion } from '@/services/food/barcode';

describe('barcode validation', () => {
  it('accepts valid GTINs and rejects bad check digits', () => {
    expect(isValidGtin('3017620422003')).toBe(true); // EAN-13
    expect(isValidGtin('3017620422004')).toBe(false);
    expect(isValidGtin('96385074')).toBe(true); // EAN-8
    expect(isValidGtin('036000291452')).toBe(true); // UPC-A
  });

  it('normalizes input incl. Arabic digits and spaces', () => {
    expect(normalizeBarcode(' 3017620422003 ')).toBe('3017620422003');
    expect(normalizeBarcode('٣٠١٧٦٢٠٤٢٢٠٠٣')).toBe('3017620422003');
    expect(normalizeBarcode('12345')).toBeNull();
    expect(normalizeBarcode('https://example.com')).toBeNull();
  });

  it('tries UPC/EAN variants', () => {
    expect(lookupVariants('0036000291452')).toEqual(['0036000291452', '036000291452']);
    expect(lookupVariants('036000291452')).toEqual(['036000291452', '0036000291452']);
  });
});

describe('parseOffProduct', () => {
  const sample = {
    status: 1,
    product: {
      product_name: 'Nutella',
      brands: 'Ferrero, Nutella',
      serving_quantity: '15',
      nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 },
    },
  };

  it('reads per-100g nutrition, brand and serving', () => {
    const f = parseOffProduct('3017620422003', sample)!;
    expect(f.name).toBe('Nutella');
    expect(f.brand).toBe('Ferrero');
    expect(f.kcal100).toBe(539);
    expect(f.protein100).toBe(6.3);
    expect(f.servingG).toBe(15);
    expect(f.perUnit).toBe('g');
  });

  it('prefers the Arabic name and converts kJ when kcal is missing', () => {
    const f = parseOffProduct('1', {
      status: 1,
      product: { product_name_ar: 'حليب', product_name: 'Milk', quantity: '1 L', nutriments: { 'energy-kj_100g': 255, proteins_100g: 3.2 } },
    })!;
    expect(f.name).toBe('حليب');
    expect(f.kcal100).toBeCloseTo(60.9, 1);
    expect(f.perUnit).toBe('ml');
  });

  it('returns null when not found or without nutrition', () => {
    expect(parseOffProduct('1', { status: 0 })).toBeNull();
    expect(parseOffProduct('1', { status: 1, product: { product_name: 'x', nutriments: {} } })).toBeNull();
  });
});

describe('portion', () => {
  it('scales per-100g values', () => {
    const p = portion({ kcal100: 539, protein100: 6.3, carbs100: 57.5, fat100: 30.9 }, 15);
    expect(p).toEqual({ calories: 81, protein: 0.9, carbs: 8.6, fat: 4.6 });
  });
});
