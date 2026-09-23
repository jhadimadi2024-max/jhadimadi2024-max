import React, { useState } from 'react';
import { 
  ShoppingBag, Search, Star, Plus, Leaf, Sparkles
} from 'lucide-react';
import { OrganicProduct, Language } from '../types';
import { ProductCard } from './ProductCard';

interface ShopScreenProps {
  products: OrganicProduct[];
  lang?: Language;
  onAddToCart: (product: OrganicProduct) => void;
  onSelectProduct: (product: OrganicProduct) => void;
  onOpenCart: () => void;
  totalCartCount: number;
  onOpenServiceOrder?: (category?: 'service' | 'ecommerce' | 'logistics') => void;
}

export const ShopScreen: React.FC<ShopScreenProps> = ({
  products,
  lang = 'bn',
  onAddToCart,
  onSelectProduct,
  onOpenCart,
  totalCartCount,
  onOpenServiceOrder
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const SHOP_CATEGORIES = [
    { id: 'all', labelBn: 'সকল পণ্য', labelEn: 'All Products' },
    { id: 'Fruits', labelBn: 'ফলমূল ও শাকসবজি', labelEn: 'Fruits & Veg' },
    { id: 'Handicrafts', labelBn: 'হস্তশিল্প ও পোশাক', labelEn: 'Handicrafts' },
    { id: 'Spices', labelBn: 'মধু ও পাহাড়ি মসলা', labelEn: 'Honey & Spices' },
    { id: 'Organic', labelBn: '১০০% অর্গানিক', labelEn: 'Pure Organic' },
  ];

  const filteredProducts = products.filter((p) => {
    const matchesSearch = 
      p.nameBn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sellerName.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (selectedCategory === 'all') return matchesSearch;
    if (selectedCategory === 'Fruits') return matchesSearch && (p.category === 'Food' || p.nameEn.toLowerCase().includes('fruit') || p.nameEn.toLowerCase().includes('banana') || p.nameEn.toLowerCase().includes('papaya'));
    if (selectedCategory === 'Handicrafts') return matchesSearch && (p.category === 'Clothing' || p.nameEn.toLowerCase().includes('bag') || p.nameEn.toLowerCase().includes('shawl'));
    if (selectedCategory === 'Spices') return matchesSearch && (p.nameEn.toLowerCase().includes('honey') || p.nameEn.toLowerCase().includes('turmeric') || p.nameEn.toLowerCase().includes('ginger'));
    if (selectedCategory === 'Organic') return matchesSearch && p.isOrganic;
    return matchesSearch;
  });

  return (
    <div className="space-y-3.5 animate-in fade-in duration-200">
      
      {/* Top Banner - Light Leaf Green */}
      <div className="bg-[#8BC34A] p-4 rounded-2xl text-slate-950 shadow-sm flex items-center justify-between border border-[#7CB342]">
        <div>
          <span className="px-2 py-0.5 bg-white/70 text-slate-950 font-black text-[9.5px] rounded-md tracking-wider uppercase inline-block mb-1 shadow-2xs">
            CHT Organic Store
          </span>
          <h3 className="text-base sm:text-lg font-black tracking-tight leading-tight text-slate-950">
            পাহাড়ের খাঁটি অর্গানিক বাজার
          </h3>
          <p className="text-xs font-semibold text-slate-900/80 mt-0.5">
            সরাসরি জুম চাষী ও পাহাড়ি তাঁত শিল্পীদের থেকে সংগৃহীত
          </p>
        </div>

        <button
          onClick={onOpenCart}
          className="p-3 bg-white text-slate-950 rounded-2xl shadow-sm font-black text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition hover:bg-slate-50 border border-slate-200"
        >
          <ShoppingBag className="w-4 h-4 text-[#689F38]" />
          <span>কার্ট ({totalCartCount})</span>
        </button>
      </div>

      {/* Search and Category Filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="পাহাড়ি মধু, জুমের ফলমূল, থামি ও মসলা খুঁজুন..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium focus:outline-hidden focus:border-[#8BC34A] focus:ring-1 focus:ring-[#8BC34A] shadow-2xs"
          />
        </div>

        {/* Categories Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {SHOP_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-[#8BC34A] text-slate-950 font-black shadow-2xs border border-[#7CB342]'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
              }`}
            >
              {lang === 'bn' ? cat.labelBn : cat.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {filteredProducts.map((prod) => (
          <ProductCard
            key={prod.id}
            product={prod}
            lang={lang}
            onSelect={onSelectProduct}
            onAddToCart={onAddToCart}
          />
        ))}
      </div>

    </div>
  );
};
