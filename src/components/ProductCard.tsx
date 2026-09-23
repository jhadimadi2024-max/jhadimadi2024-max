import React from 'react';
import { ShoppingCart, MapPin, Star } from 'lucide-react';
import { StoreProduct } from '../data/productsData';
import { Language } from '../types';
import { getProductPublicUrl } from '../utils/directSupabaseStorage';
import { NO_IMAGE_AVAILABLE_ICON } from '../constants/imageConstants';
import { formatProductExactUnitWeight, toBnDigit } from '../utils/productQuantitySteps';

export interface ProductCardProps {
  product: StoreProduct | any;
  lang?: Language;
  onSelect: (product: any) => void;
  onAddToCart?: (product: any) => void;
  className?: string;
  showCategoryBadge?: boolean;
}

/**
 * Dynamically resolves the product code / SKU with graceful fallback
 */
export function resolveProductDisplayCode(product: any): string {
  if (!product) return 'JDM-001';
  const explicitCode = product.product_code || product.code || product.sku;
  if (explicitCode && typeof explicitCode === 'string' && explicitCode.trim()) {
    return explicitCode.trim();
  }
  if (product.id) {
    const rawId = String(product.id).replace(/[^a-zA-Z0-9]/g, '');
    const suffix = rawId.length >= 4 ? rawId.slice(-4).toUpperCase() : rawId.toUpperCase().padStart(3, '0');
    return `JDM-${suffix || '001'}`;
  }
  return 'JDM-001';
}

/**
 * Dynamically resolves the product quantity and unit from the Admin Dashboard or database
 * e.g., "২৫০ গ্রাম", "১ কেজি", "১ লিটার", "১ পিস", "১ প্যাকেট", etc.
 */
export function resolveProductDisplayUnit(product: any, lang: Language = 'bn'): string {
  if (!product) return lang === 'bn' ? '১ পিস' : '1 pc';

  // 1. If explicit unit_quantity and unit_type are provided from the Admin Form
  const unitQty = product.unit_quantity !== undefined && product.unit_quantity !== null && String(product.unit_quantity).trim() !== ''
    ? String(product.unit_quantity).trim()
    : (product.unitAmount !== undefined ? String(product.unitAmount).trim() : '');
  const unitType = (product.unit_type || product.unitType || '').trim();

  if (unitQty && unitType && !unitType.includes('/') && unitType !== 'কেজি/পিস') {
    const qtyStr = lang === 'bn' ? toBnDigit(unitQty) : unitQty;
    return `${qtyStr} ${unitType}`.trim();
  }

  // 2. If direct clean string exists in unit_pack or unit
  const rawUnit = (product.unit_pack || product.unit || '').trim();
  if (
    rawUnit &&
    !rawUnit.includes('কেজি/পিস') &&
    !rawUnit.includes('কেজি / পিস') &&
    !rawUnit.includes('kg/pc') &&
    !rawUnit.includes('১ একক') &&
    rawUnit !== 'একক' &&
    rawUnit !== 'unit'
  ) {
    return lang === 'bn' ? toBnDigit(rawUnit) : rawUnit;
  }

  // 3. Fallback dynamically through exact unit detection (Gram, KG, Liter, Packet, Piece)
  return formatProductExactUnitWeight(product, lang === 'bn' ? 'bn' : 'en');
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  lang = 'bn',
  onSelect,
  onAddToCart,
  className = '',
  showCategoryBadge = true
}) => {
  const origPrice = Number((product as any).original_price || product.originalPrice || 0);
  const curPrice = Number((product as any).discount_price || (product as any).offer_price || product.price || 0);
  const hasGenuineDiscount = origPrice > 0 && curPrice > 0 && origPrice > curPrice;
  const discount = hasGenuineDiscount ? Math.round(((origPrice - curPrice) / origPrice) * 100) : 0;
  
  const isOutOfStock =
    (product.stock_quantity !== undefined && product.stock_quantity !== null && Number(product.stock_quantity) <= 0) ||
    (product.stock !== undefined && product.stock !== null && Number(product.stock) <= 0) ||
    (product as any).stock_status === 'out_of_stock' ||
    product.status === 'Out of Stock';

  // Resolved dynamic fields
  const productCode = resolveProductDisplayCode(product);
  const displayUnit = resolveProductDisplayUnit(product, lang);
  const productName = lang === 'bn' 
    ? (product.nameBn || product.title_bn || product.name || 'পণ্য') 
    : (product.nameEn || product.title_en || product.name || 'Product');
  const categoryLabel = product.categoryLabelBn || product.category_label_bn || product.category || '';

  const formattedPrice = lang === 'bn' ? toBnDigit(curPrice) : curPrice.toLocaleString();
  const formattedOrigPrice = lang === 'bn' ? toBnDigit(origPrice) : origPrice.toLocaleString();

  return (
    <div
      onClick={() => onSelect(product)}
      className={`bg-white p-2.5 rounded-2xl border border-gray-200/90 shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between cursor-pointer group relative overflow-hidden text-left ${className}`}
    >
      {/* Product Image & Badges */}
      <div className="relative w-full h-32 sm:h-36 bg-slate-100 rounded-xl overflow-hidden mb-2 shrink-0">
        <img
          src={getProductPublicUrl((product as any).products_photos || (product as any).image_url || product.image)}
          alt={productName}
          className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement;
            target.onerror = null;
            target.src = NO_IMAGE_AVAILABLE_ICON;
          }}
          loading="lazy"
        />

        {/* Origin Pin */}
        {Boolean(product.origin) && (
          <span className="absolute top-1.5 left-1.5 bg-black/65 backdrop-blur-xs text-white text-[7px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow-2xs">
            <MapPin className="w-2 h-2 text-amber-300" />
            {String(product.origin).split(' ')[0]}
          </span>
        )}

        {/* Discount / Custom Badge */}
        {hasGenuineDiscount && discount > 0 ? (
          <span className="absolute top-1.5 right-1.5 bg-red-600 text-white text-[7.5px] font-black px-1.5 py-0.5 rounded-md shadow-xs">
            {lang === 'bn' ? `${toBnDigit(discount)}% ছাড়` : `${discount}% OFF`}
          </span>
        ) : product.badge ? (
          <span className={`absolute top-1.5 right-1.5 ${product.badgeColor || 'bg-emerald-600'} text-white text-[7px] font-bold px-1.5 py-0.5 rounded-md shadow-xs`}>
            {product.badge}
          </span>
        ) : null}

        {/* Out of Stock Overlay / Badge */}
        {isOutOfStock && (
          <span className="absolute bottom-1.5 right-1.5 bg-rose-600/95 backdrop-blur-xs text-white text-[7px] font-black px-1.5 py-0.5 rounded-md shadow-xs flex items-center gap-0.5">
            {lang === 'bn' ? 'স্টক শেষ' : 'Out of Stock'}
          </span>
        )}
      </div>

      {/* Content Area - Left Aligned */}
      <div className="flex-1 flex flex-col justify-between text-left">
        <div className="space-y-1">
          {/* Optional Category Tag */}
          {showCategoryBadge && categoryLabel && (
            <span className="text-[7.5px] font-black text-emerald-700 uppercase bg-emerald-50 border border-emerald-100/70 px-1.5 py-0.5 rounded-md inline-block">
              {categoryLabel}
            </span>
          )}

          {/* Line 1: Product Title */}
          <h4 
            className="text-[11px] sm:text-xs font-black text-gray-900 leading-snug line-clamp-2 group-hover:text-emerald-700 transition-colors"
            title={productName}
          >
            {productName}
          </h4>

          {/* Line 2: Code: [Product Code] | Unit: [Quantity/Unit] */}
          <div className="flex items-center text-[8.5px] sm:text-[9.5px] font-medium text-slate-500 tracking-tight leading-none pt-0.5 truncate">
            <span className="font-semibold text-slate-700">Code:</span>
            <span className="font-mono font-bold text-slate-800 ml-1 mr-1.5 truncate max-w-[80px]" title={productCode}>
              {productCode}
            </span>
            <span className="text-slate-300 font-normal mr-1.5">|</span>
            <span className="font-semibold text-slate-700">Unit:</span>
            <span className="font-bold text-emerald-800 ml-1 truncate" title={displayUnit}>
              {displayUnit}
            </span>
          </div>

          {/* Optional Rating snippet if real reviews exist */}
          {Boolean(product.reviewsCount && Number(product.reviewsCount) > 0) && (
            <div className="flex items-center gap-1 pt-0.5">
              <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
              <span className="text-[8px] font-bold text-gray-800">{product.rating}</span>
              <span className="text-[7px] text-gray-400">({product.reviewsCount})</span>
            </div>
          )}
        </div>

        {/* Line 3: Price: High-visibility green color font (e.g., #16a34a or #22c55e), bold, clearly distinguishable */}
        <div className="flex items-end justify-between pt-2 mt-2 border-t border-gray-100">
          <div className="flex flex-col text-left">
            <div className="flex items-baseline gap-1">
              <span className="text-sm sm:text-base font-black text-[#16a34a] leading-none tracking-tight">
                ৳ {formattedPrice}
              </span>
            </div>
            {hasGenuineDiscount && (
              <span className="text-[8px] sm:text-[9px] text-gray-400 line-through font-bold mt-0.5">
                ৳ {formattedOrigPrice}
              </span>
            )}
          </div>

          {/* Add to Cart / Order Action Button */}
          {onAddToCart && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isOutOfStock) {
                  alert(lang === 'bn' ? 'দুঃখিত, এই পণ্যটির স্টক বর্তমানে শেষ।' : 'Sorry, this product is out of stock.');
                  return;
                }
                onAddToCart(product);
              }}
              disabled={isOutOfStock}
              className={`${
                isOutOfStock 
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                  : 'bg-[#16a34a] hover:bg-[#15803d] active:scale-90 text-white cursor-pointer shadow-xs hover:shadow-sm'
              } p-1.5 sm:p-2 rounded-xl transition-all flex items-center justify-center`}
              title={isOutOfStock ? (lang === 'bn' ? 'স্টক শেষ' : 'Out of Stock') : (lang === 'bn' ? 'কার্টে যোগ করুন' : 'Add to Cart')}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
