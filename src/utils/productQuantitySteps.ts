export type ProductUnitType = '250g' | '1kg' | 'piece' | 'gram' | 'kg' | 'liter' | 'packet';

export type ProductUnitKind = 'gram' | 'kg' | 'liter' | 'packet' | 'piece';

export interface ProductQuantityStep {
  index: number;
  value: number; // numeric value in kg (for gram/kg) or count (for liter/packet/piece)
  labelBn: string; // e.g. "২৫০ গ্রাম", "৫০০ গ্রাম", "১ কেজি", "১ লিটার", "১ প্যাকেট", "১টি"
  labelEn: string; // e.g. "250g", "500g", "1kg", "1 Liter", "1 Packet", "1 pc"
  shortLabel: string; // e.g. "250g", "500g", "1kg", "1L", "1 pkt", "1"
  multiplier: number; // Price multiplier relative to base unit price (Total = Base Price * Multiplier)
}

/**
 * Bengali digits converter
 */
export function toBnDigit(num: number | string): string {
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/[0-9]/g, d => bnDigits[parseInt(d, 10)]);
}

/**
 * Bengali to English digits converter
 */
export function toEnDigit(num: number | string): string {
  const bnToEn: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  };
  return String(num).replace(/[০-৯]/g, d => bnToEn[d] || d);
}

export interface ProductBaseInfo {
  baseQuantity: number;
  unitName: string;
  formattedBaseLabelBn: string;
  formattedBaseLabelEn: string;
}

/**
 * Resolves the dynamic base quantity and unit from database / admin input.
 * E.g., baseQuantity = 250, unitName = "গ্রাম"; or baseQuantity = 1, unitName = "কেজি" / "টি" / "লিটার" / "প্যাকেট"
 */
export function getProductBaseInfo(product?: {
  unit_type?: string;
  unitType?: string;
  unit?: string;
  unit_pack?: string;
  unit_quantity?: string | number;
  unit_value?: string | number;
  unitAmount?: string | number;
  name?: string;
  nameBn?: string;
  title_bn?: string;
}): ProductBaseInfo {
  if (!product) {
    return {
      baseQuantity: 1,
      unitName: 'টি',
      formattedBaseLabelBn: '১ টি',
      formattedBaseLabelEn: '1 pc'
    };
  }

  const kind = getProductUnitKind(product);
  const rawUnitType = `${product.unit_type || ''} ${product.unitType || ''}`.toLowerCase().trim();
  const rawUnitPack = `${product.unit_pack || ''} ${product.unit || ''}`.trim();
  const rawFull = `${rawUnitPack} ${rawUnitType} ${product.nameBn || ''} ${product.title_bn || ''} ${product.name || ''}`.toLowerCase();

  // Parse explicit unit_quantity / unitAmount / unit_value
  const rawQtyValue = product.unit_quantity !== undefined && product.unit_quantity !== null && String(product.unit_quantity).trim() !== ''
    ? product.unit_quantity
    : ((product as any).unitAmount !== undefined ? (product as any).unitAmount : product.unit_value);
  const qStr = toEnDigit(rawQtyValue || '');
  const parsedQty = parseFloat(qStr.replace(/[^0-9.]/g, ''));

  // 1. Gram based
  if (kind === 'gram') {
    let baseQty = 250;
    if (!isNaN(parsedQty) && parsedQty > 0) {
      if (parsedQty >= 50) {
        baseQty = parsedQty; // e.g. 250, 500, 100, 750
      } else if (parsedQty === 0.25) {
        baseQty = 250;
      } else if (parsedQty === 0.5) {
        baseQty = 500;
      } else if (parsedQty === 0.75) {
        baseQty = 750;
      } else if (parsedQty === 1) {
        if (rawFull.includes('250') || rawFull.includes('২৫০')) baseQty = 250;
        else if (rawFull.includes('500') || rawFull.includes('৫০০')) baseQty = 500;
        else if (rawFull.includes('100') || rawFull.includes('১০০')) baseQty = 100;
        else baseQty = 250;
      } else {
        baseQty = parsedQty;
      }
    } else {
      if (rawFull.includes('500g') || rawFull.includes('500 গ্রাম') || rawFull.includes('৫০০ গ্রাম') || rawFull.includes('৫০০') || rawFull.includes('আধা কেজি')) {
        baseQty = 500;
      } else if (rawFull.includes('100g') || rawFull.includes('100 গ্রাম') || rawFull.includes('১০০ গ্রাম') || rawFull.includes('১০০')) {
        baseQty = 100;
      } else if (rawFull.includes('750g') || rawFull.includes('750 গ্রাম') || rawFull.includes('৭৫০ গ্রাম') || rawFull.includes('৭৫০')) {
        baseQty = 750;
      } else {
        baseQty = 250;
      }
    }

    return {
      baseQuantity: baseQty,
      unitName: 'গ্রাম',
      formattedBaseLabelBn: `${toBnDigit(baseQty)} গ্রাম`,
      formattedBaseLabelEn: `${baseQty}g`
    };
  }

  // 2. Kilogram based
  if (kind === 'kg') {
    let baseQty = 1;
    if (!isNaN(parsedQty) && parsedQty > 0) {
      baseQty = parsedQty;
    } else {
      if (rawFull.includes('২ কেজি') || rawFull.includes('2kg') || rawFull.includes('2 kg')) baseQty = 2;
      else if (rawFull.includes('৫ কেজি') || rawFull.includes('5kg') || rawFull.includes('5 kg')) baseQty = 5;
      else baseQty = 1;
    }
    return {
      baseQuantity: baseQty,
      unitName: 'কেজি',
      formattedBaseLabelBn: `${toBnDigit(baseQty)} কেজি`,
      formattedBaseLabelEn: `${baseQty} kg`
    };
  }

  // 3. Liter based
  if (kind === 'liter') {
    let baseQty = 1;
    if (!isNaN(parsedQty) && parsedQty > 0) {
      baseQty = parsedQty;
    }
    return {
      baseQuantity: baseQty,
      unitName: 'লিটার',
      formattedBaseLabelBn: `${toBnDigit(baseQty)} লিটার`,
      formattedBaseLabelEn: `${baseQty} L`
    };
  }

  // 4. Packet based
  if (kind === 'packet') {
    let baseQty = 1;
    if (!isNaN(parsedQty) && parsedQty > 0) {
      baseQty = parsedQty;
    }
    return {
      baseQuantity: baseQty,
      unitName: 'প্যাকেট',
      formattedBaseLabelBn: `${toBnDigit(baseQty)} প্যাকেট`,
      formattedBaseLabelEn: `${baseQty} Packet`
    };
  }

  // 5. Piece / Count / General
  let baseQty = 1;
  if (!isNaN(parsedQty) && parsedQty > 0) {
    baseQty = parsedQty;
  }
  let unitName = 'টি';
  if (rawUnitType.includes('পিস') || rawUnitPack.includes('পিস') || rawUnitType.includes('piece')) {
    unitName = 'টি';
  } else if (rawUnitType.includes('ডজন') || rawUnitPack.includes('ডজন')) {
    unitName = 'ডজন';
  } else if (rawUnitType.includes('বক্স') || rawUnitPack.includes('বক্স')) {
    unitName = 'বক্স';
  } else if (rawUnitType.includes('জোড়া') || rawUnitPack.includes('জোড়া')) {
    unitName = 'জোড়া';
  } else if (rawUnitType && !rawUnitType.includes('/') && rawUnitType !== 'একক') {
    unitName = rawUnitType;
  }

  return {
    baseQuantity: baseQty,
    unitName: unitName,
    formattedBaseLabelBn: `${toBnDigit(baseQty)} ${unitName}`.trim(),
    formattedBaseLabelEn: `${baseQty} ${unitName === 'টি' ? (baseQty === 1 ? 'pc' : 'pcs') : unitName}`
  };
}

/**
 * Formats dynamic selected quantity and unit for display:
 * - For grams: 250 -> "২৫০ গ্রাম", 500 -> "৫০০ গ্রাম", 750 -> "৭৫০ গ্রাম", 1000 -> "১ কেজি", 1500 -> "১.৫ কেজি", 2000 -> "২ কেজি"
 * - For kg: 1 -> "১ কেজি", 2 -> "২ কেজি", 3 -> "৩ কেজি"
 * - For liter: 1 -> "১ লিটার", 2 -> "২ লিটার"
 * - For packet: 1 -> "১ প্যাকেট", 2 -> "২ প্যাকেট"
 * - For piece/টি: 1 -> "১ টি", 2 -> "২ টি"
 */
export function formatQuantityWithUnit(
  quantity: number,
  unitName: string,
  baseQuantity: number = 1,
  lang: 'bn' | 'en' = 'bn'
): { labelBn: string; labelEn: string; shortLabel: string } {
  const isGram = unitName === 'গ্রাম' || unitName.toLowerCase().includes('gram') || unitName.toLowerCase().includes('gm');

  if (isGram) {
    if (quantity < 1000) {
      return {
        labelBn: `${toBnDigit(quantity)} গ্রাম`,
        labelEn: `${quantity}g`,
        shortLabel: `${quantity}g`
      };
    }
    if (quantity === 1000) {
      return {
        labelBn: '১ কেজি',
        labelEn: '1kg',
        shortLabel: '1kg'
      };
    }
    if (quantity % 1000 === 0) {
      const kg = quantity / 1000;
      return {
        labelBn: `${toBnDigit(kg)} কেজি`,
        labelEn: `${kg}kg`,
        shortLabel: `${kg}kg`
      };
    }
    const kgFloat = Number((quantity / 1000).toFixed(2));
    const kgStr = String(kgFloat);
    return {
      labelBn: `${toBnDigit(kgStr)} কেজি`,
      labelEn: `${kgFloat}kg`,
      shortLabel: `${kgFloat}kg`
    };
  }

  if (unitName === 'কেজি' || unitName.toLowerCase().includes('kg')) {
    return {
      labelBn: `${toBnDigit(quantity)} কেজি`,
      labelEn: `${quantity} kg`,
      shortLabel: `${quantity}kg`
    };
  }

  if (unitName === 'লিটার' || unitName.toLowerCase().includes('liter') || unitName.toLowerCase().includes('litre')) {
    return {
      labelBn: `${toBnDigit(quantity)} লিটার`,
      labelEn: `${quantity} L`,
      shortLabel: `${quantity}L`
    };
  }

  if (unitName === 'প্যাকেট' || unitName.toLowerCase().includes('pack')) {
    return {
      labelBn: `${toBnDigit(quantity)} প্যাকেট`,
      labelEn: `${quantity} ${quantity === 1 ? 'Packet' : 'Packets'}`,
      shortLabel: `${quantity} pkt`
    };
  }

  // Count / piece
  const displayUnit = unitName || 'টি';
  return {
    labelBn: `${toBnDigit(quantity)} ${displayUnit}`.trim(),
    labelEn: `${quantity} ${displayUnit === 'টি' ? (quantity === 1 ? 'pc' : 'pcs') : displayUnit}`,
    shortLabel: `${toBnDigit(quantity)} ${displayUnit}`.trim()
  };
}

/**
 * Determines the category of unit:
 * - 'gram': Weight based (গ্রাম, gram, gm, 250g, 500g, পোয়া) -> steps: 250 গ্রাম, 500 গ্রাম, 750 গ্রাম, 1 কেজি...
 * - 'kg': Kilogram based (কেজি, kg, kilo) -> steps: 500 গ্রাম, 1 কেজি, 2 কেজি, 3 কেজি...
 * - 'liter': Volume based (লিটার, liter, litre) -> suffix: লিটার (1 লিটার, 2 লিটার, 3 লিটার...)
 * - 'packet': Packet based (প্যাকেট, packet, pack) -> suffix: প্যাকেট (1 প্যাকেট, 2 প্যাকেট, 3 প্যাকেট...)
 * - 'piece': Count based (পিস, একটি, piece, pc) -> suffix: টি / একটি (1টি, 2টি, 3টি...)
 */
export function getProductUnitKind(product?: {
  unit_type?: string;
  unitType?: string;
  unit?: string;
  unit_pack?: string;
  unit_quantity?: string | number;
  unit_value?: string | number;
  name?: string;
  nameBn?: string;
  title_bn?: string;
}): ProductUnitKind {
  if (!product) return 'piece';

  const raw = `${product.unit_pack || ''} ${product.unit || ''} ${product.nameBn || ''} ${product.title_bn || ''} ${product.name || ''}`.toLowerCase().trim();
  const directType = `${product.unit_type || ''} ${product.unitType || ''}`.toLowerCase().trim();

  // 1. Gram indicators take highest priority (e.g. 250 গ্রাম (g), 500 গ্রাম, 250g, etc.)
  if (
    raw.includes('গ্রাম') ||
    raw.includes('gram') ||
    raw.includes('gm') ||
    raw.includes('পোয়া') ||
    raw.includes('powa') ||
    raw.includes('250g') ||
    raw.includes('500g') ||
    raw.includes('750g') ||
    raw.includes('100g') ||
    raw.includes('২৫০') ||
    raw.includes('৫০০') ||
    raw.includes('৭৫০') ||
    directType.includes('গ্রাম') ||
    directType.includes('gram') ||
    directType.includes('gm')
  ) {
    return 'gram';
  }

  // 2. Kilogram indicators (unless it's a generic "কেজি/পিস" with no kg weight)
  if (
    raw.includes('কেজি') ||
    raw.includes('kg') ||
    raw.includes('কিলো') ||
    raw.includes('kilogram') ||
    directType.includes('কেজি') ||
    directType.includes('kg') ||
    directType.includes('kilo')
  ) {
    // If it's literally "কেজি/পিস" and has no other indications, treat as kg
    return 'kg';
  }

  // 3. Liter / Volume
  if (
    raw.includes('লিটার') ||
    raw.includes('liter') ||
    raw.includes('litre') ||
    raw.includes('ltr') ||
    raw.includes('ল.') ||
    raw.includes('মিলিলিটার') ||
    raw.includes('ml') ||
    directType.includes('লিটার') ||
    directType.includes('liter') ||
    directType.includes('litre') ||
    directType.includes('ltr')
  ) {
    return 'liter';
  }

  // 4. Packet
  if (
    raw.includes('প্যাকেট') ||
    raw.includes('packet') ||
    raw.includes('pack') ||
    raw.includes('pkt') ||
    directType.includes('প্যাকেট') ||
    directType.includes('packet') ||
    directType.includes('pack')
  ) {
    return 'packet';
  }

  // 5. Piece / Count
  if (
    raw.includes('পিস') ||
    raw.includes('piece') ||
    raw.includes('টি') ||
    raw.includes('জোড়া') ||
    raw.includes('বস্তা') ||
    raw.includes('ডজন') ||
    directType.includes('পিস') ||
    directType.includes('piece') ||
    directType.includes('টি')
  ) {
    return 'piece';
  }

  return 'piece';
}

/**
 * Resolves legacy ProductUnitType for backward compatibility
 */
export function getProductUnitType(product: {
  unit_type?: string;
  unitType?: string;
  unit?: string;
  unit_pack?: string;
}): ProductUnitType {
  const kind = getProductUnitKind(product);
  if (kind === 'gram') return '250g';
  if (kind === 'kg') return '1kg';
  if (kind === 'liter') return 'liter';
  if (kind === 'packet') return 'packet';
  return 'piece';
}

/**
 * Detects the base weight in KG that the product's unit price corresponds to.
 * Guaranteed to return standard kilograms (e.g. 0.25 for 250g, 0.50 for 500g, 1.0 for 1kg).
 */
export function getProductBaseWeightInKg(
  product?: {
    unit_type?: string;
    unitType?: string;
    unit?: string;
    unit_pack?: string;
    unit_quantity?: string | number;
    unit_value?: string | number;
    name?: string;
    nameBn?: string;
    title_bn?: string;
  },
  _unitType?: ProductUnitType
): number {
  if (!product) return 1.0;
  const kind = getProductUnitKind(product);
  const fullText = `${product.unit_pack || ''} ${product.unit || ''} ${product.nameBn || ''} ${product.title_bn || ''} ${product.name || ''}`.toLowerCase();

  // 1. Text-based weight detection takes first priority to avoid misconfigured unit_quantity
  if (
    fullText.includes('250g') ||
    fullText.includes('250 গ্রাম') ||
    fullText.includes('২৫০ গ্রাম') ||
    fullText.includes('250 gm') ||
    fullText.includes('পোয়া') ||
    fullText.includes('powa') ||
    fullText.includes('250') ||
    fullText.includes('২৫০')
  ) {
    return 0.25;
  }

  if (
    fullText.includes('500g') ||
    fullText.includes('500 গ্রাম') ||
    fullText.includes('৫০০ গ্রাম') ||
    fullText.includes('500 gm') ||
    fullText.includes('আধা কেজি') ||
    fullText.includes('half kg') ||
    fullText.includes('500') ||
    fullText.includes('৫০০')
  ) {
    return 0.50;
  }

  if (
    fullText.includes('750g') ||
    fullText.includes('750 গ্রাম') ||
    fullText.includes('৭৫০ গ্রাম') ||
    fullText.includes('750') ||
    fullText.includes('৭৫০')
  ) {
    return 0.75;
  }

  if (
    fullText.includes('100g') ||
    fullText.includes('100 গ্রাম') ||
    fullText.includes('১০০ গ্রাম') ||
    fullText.includes('100') ||
    fullText.includes('১০০')
  ) {
    return 0.10;
  }

  if (
    fullText.includes('2 kg') ||
    fullText.includes('2kg') ||
    fullText.includes('২ কেজি') ||
    fullText.includes('২কেজি')
  ) {
    return 2.0;
  }

  if (
    fullText.includes('5 kg') ||
    fullText.includes('5kg') ||
    fullText.includes('৫ কেজি') ||
    fullText.includes('৫কেজি')
  ) {
    return 5.0;
  }

  if (
    fullText.includes('1 kg') ||
    fullText.includes('1kg') ||
    fullText.includes('১ কেজি') ||
    fullText.includes('১কেজি') ||
    fullText.includes('1000g') ||
    fullText.includes('১০০০ গ্রাম')
  ) {
    return 1.0;
  }

  // 2. Numeric unit_quantity parsing (converting Bengali digits to Arabic)
  const qStr = `${product.unit_quantity || ''} ${product.unit_value || ''}`
    .replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString())
    .trim();

  if (qStr) {
    const num = parseFloat(qStr.replace(/[^0-9.]/g, ''));
    if (!isNaN(num) && num > 0) {
      if (kind === 'gram') {
        if (num >= 50) return num / 1000;
        if (num < 10) return num < 1 ? num : 0.25;
      }
      if (kind === 'kg') {
        return num;
      }
    }
  }

  // 3. Fallbacks by kind
  if (kind === 'gram') return 0.25; // Standard 250g base unit for grams
  if (kind === 'kg') return 1.0;    // Standard 1kg base unit for kg
  return 1.0;
}

/**
 * Returns exact unit weight string for Product Cards, Listings, and Modals.
 * Instead of generic "কেজি/পিস", returns exact unit (e.g., "250g" or "1 kg").
 */
export function formatProductExactUnitWeight(
  product?: {
    unit_type?: string;
    unitType?: string;
    unit?: string;
    unit_pack?: string;
    unit_quantity?: string | number;
    unit_value?: string | number;
    name?: string;
    nameBn?: string;
    title_bn?: string;
  },
  preferredLang: 'en' | 'bn' = 'en'
): string {
  if (!product) return preferredLang === 'bn' ? '১ পিস' : '1 pc';

  const kind = getProductUnitKind(product);
  const baseWeightKg = getProductBaseWeightInKg(product);
  const rawUnit = `${product.unit_pack || ''} ${product.unit || ''}`.trim();
  const lowerUnit = rawUnit.toLowerCase();

  // If weight-based (Gram / Kg)
  if (
    kind === 'gram' ||
    kind === 'kg' ||
    lowerUnit.includes('গ্রাম') ||
    lowerUnit.includes('কেজি') ||
    lowerUnit.includes('gram') ||
    lowerUnit.includes('kg')
  ) {
    if (Math.abs(baseWeightKg - 0.25) < 0.01) {
      return preferredLang === 'bn' ? '২৫০ গ্রাম' : '250g';
    }
    if (Math.abs(baseWeightKg - 0.50) < 0.01) {
      return preferredLang === 'bn' ? '৫০০ গ্রাম' : '500g';
    }
    if (Math.abs(baseWeightKg - 0.75) < 0.01) {
      return preferredLang === 'bn' ? '৭৫০ গ্রাম' : '750g';
    }
    if (Math.abs(baseWeightKg - 0.10) < 0.01) {
      return preferredLang === 'bn' ? '১০০ গ্রাম' : '100g';
    }
    if (Math.abs(baseWeightKg - 1.0) < 0.01) {
      return preferredLang === 'bn' ? '১ কেজি' : '1 kg';
    }
    if (Math.abs(baseWeightKg - 2.0) < 0.01) {
      return preferredLang === 'bn' ? '২ কেজি' : '2 kg';
    }
    if (Math.abs(baseWeightKg - 5.0) < 0.01) {
      return preferredLang === 'bn' ? '৫ কেজি' : '5 kg';
    }
    if (baseWeightKg < 1) {
      const g = Math.round(baseWeightKg * 1000);
      return preferredLang === 'bn' ? `${toBnDigit(g)} গ্রাম` : `${g}g`;
    }
    return preferredLang === 'bn' ? `${toBnDigit(baseWeightKg)} কেজি` : `${baseWeightKg} kg`;
  }

  // Volume
  if (kind === 'liter' || lowerUnit.includes('লিটার') || lowerUnit.includes('liter') || lowerUnit.includes('ltr')) {
    return preferredLang === 'bn' ? '১ লিটার' : '1 L';
  }

  // Packet
  if (kind === 'packet' || lowerUnit.includes('প্যাকেট') || lowerUnit.includes('pack')) {
    return preferredLang === 'bn' ? '১ প্যাকেট' : '1 pkt';
  }

  // Generic unwanted fallbacks like "কেজি/পিস", "১ কেজি / পিস", "১ একক", "পিস (Pcs)"
  if (
    lowerUnit.includes('কেজি/পিস') ||
    lowerUnit.includes('কেজি / পিস') ||
    lowerUnit.includes('১ একক') ||
    lowerUnit === 'একক' ||
    lowerUnit === 'unit'
  ) {
    return preferredLang === 'bn' ? '১ পিস' : '1 pc';
  }

  // If clean piece
  if (lowerUnit.includes('পিস') || lowerUnit.includes('piece') || lowerUnit.includes('টি')) {
    return preferredLang === 'bn' ? '১ পিস' : '1 pc';
  }

  // Clean raw unit string
  if (rawUnit && !rawUnit.includes('/')) {
    return rawUnit;
  }

  return preferredLang === 'bn' ? '১ পিস' : '1 pc';
}

/**
 * Returns formatted price label e.g., "৳ 500 / 250g" or "৳ 2000 / 1 kg"
 */
export function formatProductPriceLabel(
  price: number | string,
  product?: any,
  preferredLang: 'en' | 'bn' = 'en'
): string {
  const numPrice = typeof price === 'number' ? price : parseFloat(String(price).replace(/[^0-9.]/g, '')) || 0;
  const unitLabel = formatProductExactUnitWeight(product, preferredLang);
  const priceStr = preferredLang === 'bn' ? `৳ ${toBnDigit(numPrice)}` : `৳ ${numPrice.toLocaleString()}`;
  return `${priceStr} / ${unitLabel}`;
}

/**
 * DYNAMIC PRODUCT UNIT QUANTITY DISPLAY LOGIC:
 * Formats any numeric or string quantity according to product unit_type or unit:
 * - "গ্রাম" (Gram): Step by weight (e.g., 250 গ্রাম, 500 গ্রাম, 750 গ্রাম, 1 কেজি, 1.5 কেজি...).
 * - "কেজি" (Kg): Step by 1 or 0.5 (e.g., 500 গ্রাম, 1 কেজি, 2 কেজি, 3 কেজি...).
 * - "লিটার" (Liter): Append "লিটার" suffix (e.g., 1 লিটার, 2 লিটার, 3 লিটার...).
 * - "প্যাকেট" (Packet): Append "প্যাকেট" suffix (e.g., 1 প্যাকেট, 2 প্যাকেট, 3 প্যাকেট...).
 * - "পিস" / "টি" (Piece): Append "টি" / "একটি" suffix (e.g., 1টি, 2টি, 3টি...).
 */
export function formatProductQuantityDisplay(
  quantity: number | string,
  product?: {
    unit_type?: string;
    unitType?: string;
    unit?: string;
    unit_pack?: string;
    unit_quantity?: string | number;
    unit_value?: string | number;
  }
): string {
  const kind = getProductUnitKind(product);
  const numQty = typeof quantity === 'number' 
    ? quantity 
    : parseFloat(String(quantity).replace(/[^0-9.]/g, '')) || 1;

  if (kind === 'gram') {
    const baseWeight = getProductBaseWeightInKg(product);
    // If quantity is already in grams (e.g., 250, 500, 750, 1000, 1500, 2000)
    if (numQty >= 100) {
      if (numQty === 1000) {
        return '১ কেজি';
      }
      if (numQty > 1000 && numQty % 1000 === 0) {
        return `${toBnDigit(numQty / 1000)} কেজি`;
      }
      return `${toBnDigit(numQty)} গ্রাম`;
    }

    // If quantity is float kg (e.g. 0.25, 0.5, 0.75, 1.5)
    if (numQty > 0 && numQty < 1 && Math.abs((numQty * 1000) % 50) < 0.1) {
      const grams = Math.round(numQty * 1000);
      return `${toBnDigit(grams)} গ্রাম`;
    }

    // If quantity represents step multiplier relative to baseWeight
    const totalWeightKg = numQty * baseWeight;
    if (totalWeightKg < 1) {
      const grams = Math.round(totalWeightKg * 1000);
      return `${toBnDigit(grams)} গ্রাম`;
    }
    if (totalWeightKg === 1) {
      return '১ কেজি';
    }
    if (totalWeightKg === 1.5) {
      return '১.৫ কেজি';
    }
    if (totalWeightKg % 1 === 0) {
      return `${toBnDigit(totalWeightKg)} কেজি`;
    }
    return `${toBnDigit(totalWeightKg)} কেজি`;
  }

  if (kind === 'kg') {
    const baseWeight = getProductBaseWeightInKg(product);
    const totalKg = baseWeight === 0.5 ? numQty * 0.5 : numQty;
    if (totalKg === 0.5) return '৫০০ গ্রাম';
    if (totalKg === 1) return '১ কেজি';
    if (totalKg === 1.5) return '১.৫ কেজি';
    if (totalKg % 1 === 0) return `${toBnDigit(totalKg)} কেজি`;
    return `${toBnDigit(totalKg)} কেজি`;
  }

  if (kind === 'liter') {
    return `${toBnDigit(numQty)} লিটার`;
  }

  if (kind === 'packet') {
    return `${toBnDigit(numQty)} প্যাকেট`;
  }

  // Piece / default: "টি" / "একটি"
  return `${toBnDigit(numQty)}টি`;
}

/**
 * Returns the localized unit suffix for stock or inline inputs:
 * - gram -> "গ্রাম"
 * - kg -> "কেজি"
 * - liter -> "লিটার"
 * - packet -> "প্যাকেট"
 * - piece -> "টি"
 */
export function getProductUnitSuffix(product?: {
  unit_type?: string;
  unitType?: string;
  unit?: string;
  unit_pack?: string;
}): string {
  const kind = getProductUnitKind(product);
  if (kind === 'gram') return 'গ্রাম';
  if (kind === 'kg') return 'কেজি';
  if (kind === 'liter') return 'লিটার';
  if (kind === 'packet') return 'প্যাকেট';
  return 'টি';
}

/**
 * Generates the array of ProductQuantityStep for a product based on unit_type and unit_value.
 * Ensures total price scales accurately based on base weight multiplier:
 * e.g., if base price for 250g is ৳500:
 * 250g = ৳500 (multiplier: 1)
 * 500g = ৳1000 (multiplier: 2)
 * 750g = ৳1500 (multiplier: 3)
 * 1kg  = ৳2000 (multiplier: 4)
 */
export function generateQuantitySteps(product: {
  unit_type?: string;
  unitType?: string;
  unit?: string;
  unit_pack?: string;
  unit_quantity?: string | number;
  unit_value?: string | number;
  stockQuantity?: number;
  stock_quantity?: number;
  stock?: number;
}): ProductQuantityStep[] {
  const kind = getProductUnitKind(product);
  const baseWeightInKg = getProductBaseWeightInKg(product);
  const stock = product.stock_quantity ?? product.stockQuantity ?? product.stock ?? 99;

  const steps: ProductQuantityStep[] = [];

  // 1. Gram (গ্রাম): Step in 250g increments (250g -> 500g -> 750g -> 1kg -> 1.5kg -> 2kg...)
  if (kind === 'gram') {
    const gramDefinitions = [
      { w: 0.25, bn: '২৫০ গ্রাম', en: '250g', short: '250g' },
      { w: 0.50, bn: '৫০০ গ্রাম', en: '500g', short: '500g' },
      { w: 0.75, bn: '৭৫০ গ্রাম', en: '750g', short: '750g' },
      { w: 1.00, bn: '১ কেজি', en: '1kg', short: '1kg' },
      { w: 1.50, bn: '১.৫ কেজি', en: '1.5kg', short: '1.5kg' },
      { w: 2.00, bn: '২ কেজি', en: '2kg', short: '2kg' },
      { w: 3.00, bn: '৩ কেজি', en: '3kg', short: '3kg' },
      { w: 5.00, bn: '৫ কেজি', en: '5kg', short: '5kg' },
      { w: 10.00, bn: '১০ কেজি', en: '10kg', short: '10kg' }
    ];

    const effectiveBase = baseWeightInKg > 0 ? baseWeightInKg : 0.25;

    gramDefinitions.forEach((def, idx) => {
      // Exactly scale: def.w / effectiveBase
      const multiplier = Math.round((def.w / effectiveBase) * 1000) / 1000;
      steps.push({
        index: idx,
        value: def.w,
        labelBn: def.bn,
        labelEn: def.en,
        shortLabel: def.short,
        multiplier: multiplier > 0 ? multiplier : 1
      });
    });

    return steps;
  }

  // 2. Kg (কেজি): Standard kilogram steps (500g, 1kg, 2kg, 3kg, 4kg, 5kg...)
  if (kind === 'kg') {
    const kgDefinitions = [
      { w: 0.50, bn: '৫০০ গ্রাম', en: '500g', short: '500g' },
      { w: 1.00, bn: '১ কেজি', en: '1kg', short: '1kg' },
      { w: 2.00, bn: '২ কেজি', en: '2kg', short: '2kg' },
      { w: 3.00, bn: '৩ কেজি', en: '3kg', short: '3kg' },
      { w: 4.00, bn: '৪ কেজি', en: '4kg', short: '4kg' },
      { w: 5.00, bn: '৫ কেজি', en: '5kg', short: '5kg' },
      { w: 10.00, bn: '১০ কেজি', en: '10kg', short: '10kg' }
    ];

    const effectiveBase = baseWeightInKg > 0 ? baseWeightInKg : 1.0;

    kgDefinitions.forEach((def, idx) => {
      const multiplier = Math.round((def.w / effectiveBase) * 1000) / 1000;
      steps.push({
        index: idx,
        value: def.w,
        labelBn: def.bn,
        labelEn: def.en,
        shortLabel: def.short,
        multiplier: multiplier > 0 ? multiplier : 1
      });
    });

    return steps;
  }

  // 3. Liter (লিটার): Step by 1 integer unit (1 -> 2 -> 3 -> 4...)
  if (kind === 'liter') {
    const literCounts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20];
    literCounts.forEach((l, idx) => {
      steps.push({
        index: idx,
        value: l,
        labelBn: `${toBnDigit(l)} লিটার`,
        labelEn: `${l} Liter`,
        shortLabel: `${l}L`,
        multiplier: l
      });
    });

    return steps;
  }

  // 4. Packet (প্যাকেট): Step by 1 integer unit (1 -> 2 -> 3 -> 4...)
  if (kind === 'packet') {
    const packetCounts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20];
    packetCounts.forEach((p, idx) => {
      steps.push({
        index: idx,
        value: p,
        labelBn: `${toBnDigit(p)} প্যাকেট`,
        labelEn: `${p} Packet`,
        shortLabel: `${p} pkt`,
        multiplier: p
      });
    });

    return steps;
  }

  // 5. Piece / Default: Step by 1 (e.g., 1টি, 2টি, 3টি...)
  const maxCount = Math.max(1, Math.min(stock > 0 ? stock : 50, 100));
  const counts: number[] = [];
  for (let c = 1; c <= Math.min(maxCount, 12); c++) {
    counts.push(c);
  }
  const higher = [15, 20, 25, 30, 40, 50, 60, 75, 100];
  for (const h of higher) {
    if (h <= maxCount && !counts.includes(h)) {
      counts.push(h);
    }
  }
  if (counts.length === 0) counts.push(1);

  counts.forEach((c, idx) => {
    steps.push({
      index: idx,
      value: c,
      labelBn: `${toBnDigit(c)}টি`,
      labelEn: `${c} ${c === 1 ? 'pc' : 'pcs'}`,
      shortLabel: `${c}টি`,
      multiplier: c
    });
  });

  return steps;
}

/**
 * Calculates dynamic total price for the selected step.
 * Formula: Total = Base Price * Selected Weight Multiplier.
 * E.g. base price ৳500 for 250g:
 * - 250g (multiplier 1) -> ৳ 500
 * - 500g (multiplier 2) -> ৳ 1000
 * - 750g (multiplier 3) -> ৳ 1500
 * - 1kg  (multiplier 4) -> ৳ 2000
 */
export function calculateDynamicStepPrice(unitPrice: number, step: ProductQuantityStep): number {
  if (!unitPrice || unitPrice <= 0 || !step) return 0;
  const mult = typeof step.multiplier === 'number' && step.multiplier > 0 ? step.multiplier : 1;
  return Math.round(unitPrice * mult);
}

/**
 * Formats button label showing both weight/quantity and calculated price:
 * e.g., "২৫০ গ্রাম - ৳ ৫০০", "৫০০ গ্রাম - ৳ ১,০০০", "১ কেজি - ৳ ২,০০০"
 */
export function getStepButtonLabel(step: ProductQuantityStep, unitPrice: number): string {
  const price = calculateDynamicStepPrice(unitPrice, step);
  return `${step.labelBn} - ৳ ${price.toLocaleString('bn-BD')}`;
}

/**
 * Calculates total price for a product based on quantity multiplier
 */
export function calculateCartItemPrice(price: number, quantity: number): number {
  if (!price || price <= 0 || !quantity || quantity <= 0) return 0;
  return Math.round(price * quantity);
}

/**
 * Computes next/previous step multiplier for unified cart stepping
 * When delta is 1: advances to next step in quantitySteps
 * When delta is -1: steps down, returning 0 if decremented below step 0 (triggers cart removal)
 */
export function getNextStepMultiplier(
  product: any,
  currentMultiplier: number,
  direction: 1 | -1
): number {
  const steps = generateQuantitySteps(product);
  if (!steps || steps.length === 0) return Math.max(0, currentMultiplier + direction);

  let currentIndex = steps.findIndex(s => Math.abs(s.multiplier - currentMultiplier) < 0.01);
  if (currentIndex === -1) {
    let minDiff = Infinity;
    steps.forEach((s, idx) => {
      const diff = Math.abs(s.multiplier - currentMultiplier);
      if (diff < minDiff) {
        minDiff = diff;
        currentIndex = idx;
      }
    });
  }

  if (direction === 1) {
    if (currentIndex < steps.length - 1) {
      return steps[currentIndex + 1].multiplier;
    }
    return steps[steps.length - 1].multiplier;
  } else {
    if (currentIndex > 0) {
      return steps[currentIndex - 1].multiplier;
    }
    return 0;
  }
}


