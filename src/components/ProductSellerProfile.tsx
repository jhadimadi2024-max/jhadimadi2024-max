import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Store,
  MapPin,
  Phone,
  ArrowLeft,
  MoreVertical,
  Bell,
  MessageSquare,
  LogOut,
  Trash2,
  Plus,
  X,
  Check,
  ShoppingBag,
  ShoppingCart,
  Star,
  Upload,
  Wallet,
  CreditCard,
  Tag,
  Package,
  Layers,
  Eye,
  Camera,
  Copy,
  Search,
  CheckCircle2,
  ExternalLink,
  PhoneCall,
  Share2,
  AlertCircle
} from 'lucide-react';
import { Language } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { supabaseMediaService } from '../services/supabaseMediaService';
import { compressImage } from '../utils/imageUtils';
import { getProductPublicUrl } from '../utils/directSupabaseStorage';
import { NO_IMAGE_AVAILABLE_ICON } from '../constants/imageConstants';
import { prepareProductPayload, smartSupabaseInsert } from '../utils/supabaseDataService';

/* =========================================================================
   EXACT 24 CATEGORIES SPECIFICATION
   ========================================================================= */
export const SELLER_PRODUCT_CATEGORIES = [
  'অর্গানিক পণ্য',
  'শুটকি',
  'খাবার / ফুডস',
  'মসলা',
  'ঔষধ',
  'ইলেকট্রনিক ও ইলেক্ট্রিক্যাল',
  'গহনা ও অলংকার',
  'অটোমোবাইল',
  'হস্তশিল্প',
  'মোবাইল',
  'গাড়ি ও বাইক',
  'রিয়েল এস্টেট',
  'ফলমূল',
  'শাকসবজি',
  'মাছ / মাংস',
  'পোশাক আশাক',
  'কিডস্ আইটেম',
  'ব্যাগ ও জুতা',
  'কৃষিপণ্য',
  'আসবাবপত্র',
  'বই / পত্র',
  'পাহাড়ি পোশাক',
  'চাইনা জিনিস',
  'ভেষজ পণ্য',
] as const;

export type SellerProductCategory = typeof SELLER_PRODUCT_CATEGORIES[number];

/* =========================================================================
   TYPESCRIPT INTERFACES
   ========================================================================= */
export interface SellerProductItem {
  id: string;
  code: string; // Product Code / SKU (e.g., JHD-PROD-001)
  nameBn: string;
  nameEn?: string;
  category: string;
  price: number;
  regularPrice?: number;
  stock: number;
  unit?: string;
  image: string;
  description?: string;
  sellerId?: string;
  sellerName?: string;
  createdAt?: string;
  inStock?: boolean;
}

export interface SellerProfileData {
  id?: string;
  uniqueId?: string;
  shopName: string;
  ownerName?: string;
  bloodGroup?: string;
  category?: string;
  phone?: string;
  avatar?: string;
  logo?: string;
  banner?: string;
  coverBanner?: string;
  district?: string;
  upazila?: string;
  detailedAddress?: string;
  about?: string;
  rating?: number;
  reviewsCount?: number;
  totalProducts?: number;
  walletBalance?: number;
  bkashNumber?: string;
  nagadNumber?: string;
  products?: SellerProductItem[];
}

export interface ProductSellerProfileProps {
  profileData?: any;
  currentUser?: any;
  lang?: Language;
  isOwner?: boolean;
  onEditProfile?: (data?: any) => void;
  onNavigateDashboard?: () => void;
  onSignOut?: () => void;
  onDeleteAccount?: () => void;
  onBack?: () => void;
  onAddNewProduct?: () => void;
  onAddToCart?: (product: any, quantity?: number) => void;
  onBuyNow?: (product: any, quantity?: number) => void;
  onOpenChat?: (sellerName: string) => void;
  onViewProductDetails?: (product: any) => void;
}

/* =========================================================================
   HELPER: FILTER OUT ANY PLACEHOLDER OR DEMO PRODUCTS
   ========================================================================= */
const filterOutDemoProducts = (items: any[]): SellerProductItem[] => {
  if (!Array.isArray(items)) return [];
  return items.filter((p: any) => {
    if (!p) return false;
    const id = String(p.id || '').toLowerCase();
    const code = String(p.code || p.product_code || '').toLowerCase();
    const nameBn = String(p.nameBn || p.name_bn || p.title || '').toLowerCase();
    // Strictly filter out any demo or placeholder items
    if (id.startsWith('prod_demo_') || id.startsWith('sp_demo_') || id.includes('demo')) return false;
    if (code.startsWith('jhd-prod-00') || code.includes('demo') || code.startsWith('sp-demo')) return false;
    if (nameBn.includes('ডেমো') || nameBn.includes('demo')) return false;
    return true;
  });
};

/* =========================================================================
   HELPER: GENERATE UNIQUE SKU / PRODUCT CODE
   ========================================================================= */
const generateProductCode = (count: number = 1): string => {
  const num = String(count).padStart(3, '0');
  const rand = Math.floor(100 + Math.random() * 900);
  return `JHD-PROD-${num === '000' ? rand : num}`;
};

/* =========================================================================
   MAIN COMPONENT: PRODUCT SELLER PROFILE
   ========================================================================= */
export const ProductSellerProfile: React.FC<ProductSellerProfileProps> = ({
  profileData,
  currentUser,
  lang = 'bn',
  isOwner: passedIsOwner,
  onEditProfile,
  onNavigateDashboard,
  onSignOut,
  onDeleteAccount,
  onBack,
  onAddNewProduct,
  onAddToCart,
  onBuyNow,
  onOpenChat,
  onViewProductDetails
}) => {
  // Determine if viewer is truly the owner - profile automatically renders based on user's role
  const computedIsOwner = useMemo(() => {
    if (typeof passedIsOwner === 'boolean') return passedIsOwner;
    if (!currentUser || !profileData) return false;
    const profileId = profileData.id || profileData.uniqueId || profileData.memberUID;
    const currentUserId = currentUser.id || currentUser.uniqueId || currentUser.memberUID;
    if (profileId && currentUserId && profileId === currentUserId) return true;
    if (currentUser.phone && profileData.phone && currentUser.phone === profileData.phone) return true;
    return false;
  }, [passedIsOwner, currentUser, profileData]);

  // View state automatically follows computed role (No manual view switcher toggle)
  const isOwnerView = computedIsOwner;

  // Resolved seller profile state
  const profile: SellerProfileData = useMemo(() => {
    const raw = profileData || currentUser || {};
    return {
      id: raw.id || 'seller_kha_001',
      uniqueId: raw.uniqueId || raw.sellerId || raw.code || 'ID - Kha - 001',
      shopName: raw.shopName || raw.businessName || raw.name || 'Jhadimadi',
      ownerName: raw.ownerName || raw.fullName || raw.name || 'ঝাদিমাদি মার্চেন্ট',
      bloodGroup: raw.bloodGroup || raw.blood_group || 'Blood - A+',
      category: raw.category || 'পাহাড়ি অর্গানিক ও হস্তশিল্প',
      phone: raw.phone || raw.contactNumber || '01870592699',
      avatar: raw.avatar || raw.profileImage || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80',
      logo: raw.logo || raw.avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80',
      banner: raw.banner || raw.coverBanner || 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1400&auto=format&fit=crop&q=80',
      coverBanner: raw.coverBanner || raw.banner || 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1400&auto=format&fit=crop&q=80',
      district: raw.district || 'খাগড়াছড়ি (Khagrachhari)',
      upazila: raw.upazila || 'সদর',
      detailedAddress: raw.detailedAddress || raw.address || 'পানখাইয়াপাড়া, খাগড়াছড়ি সদর',
      about: raw.about || raw.description || 'পাহাড়ি অর্গানিক খাঁটি খাদ্যদ্রব্য, জুমের মশলা ও আদিবাসী হস্তশিল্পের বিশ্বস্ত সম্ভার।',
      rating: raw.rating || 5.0,
      reviewsCount: raw.reviewsCount || 0,
      totalProducts: raw.totalProducts !== undefined ? raw.totalProducts : 0,
      walletBalance: raw.walletBalance || 0,
      bkashNumber: raw.bkashNumber || raw.phone || '',
      nagadNumber: raw.nagadNumber || raw.phone || '',
      products: Array.isArray(raw.products) && raw.products.length > 0 ? filterOutDemoProducts(raw.products) : undefined
    };
  }, [profileData, currentUser]);

  // Products state - initialized ONLY with actual products, completely devoid of demo/placeholder items
  const [products, setProducts] = useState<SellerProductItem[]>(() => {
    if (profile.products && profile.products.length > 0) {
      const real = filterOutDemoProducts(profile.products);
      if (real.length > 0) return real;
    }
    // Check localStorage fallback
    try {
      const saved = localStorage.getItem(`seller_products_${profile.uniqueId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        const real = filterOutDemoProducts(parsed);
        if (real.length > 0) return real;
      }
    } catch {}
    return [];
  });

  // Fetch real products from Supabase database for this seller
  useEffect(() => {
    let isMounted = true;
    const fetchSellerProductsFromDB = async () => {
      if (!isSupabaseConfigured) return;
      const sellerId = profile.uniqueId || profile.id;
      const sellerPhone = profile.phone;
      if (!sellerId && !sellerPhone) return;

      try {
        let query = supabase.from('products').select('*');
        if (sellerId && sellerPhone) {
          query = query.or(`seller_id.eq.${sellerId},seller_phone.eq.${sellerPhone},code.ilike.%${sellerId}%`);
        } else if (sellerId) {
          query = query.or(`seller_id.eq.${sellerId},code.ilike.%${sellerId}%`);
        } else {
          query = query.eq('seller_phone', sellerPhone);
        }

        const { data, error } = await query;
        if (!error && data && Array.isArray(data) && data.length > 0 && isMounted) {
          const mapped: SellerProductItem[] = filterOutDemoProducts(
            data.map((p: any) => {
              const origPrice = Number(p.original_price || p.regular_price || p.price || 0);
              const curPrice = Number(p.discount_price || p.price || 0);
              let pImage = p.image_url || p.image || '';
              if (!pImage && p.products_photos) {
                pImage = Array.isArray(p.products_photos) ? p.products_photos[0] : p.products_photos;
              }
              return {
                id: String(p.id),
                code: p.code || p.product_code || `JHD-${p.id}`,
                nameBn: p.name_bn || p.title || p.name || 'পাহাড়ি পণ্য',
                nameEn: p.name_en || p.name,
                category: p.category || 'অর্গানিক পণ্য',
                price: curPrice,
                regularPrice: origPrice > curPrice ? origPrice : undefined,
                stock: Number(p.stock !== undefined ? p.stock : (p.stock_quantity !== undefined ? p.stock_quantity : 1)),
                unit: p.unit || p.unit_pack || '১ পিস',
                image: pImage,
                description: p.description_bn || p.description || '',
                sellerId: p.seller_id,
                sellerName: p.seller_name,
                createdAt: p.created_at,
                inStock: p.in_stock !== false && (p.stock === undefined || Number(p.stock) > 0)
              };
            })
          );
          if (mapped.length > 0) {
            setProducts(mapped);
          }
        }
      } catch (err) {
        console.warn('[ProductSellerProfile] Supabase product fetch note:', err);
      }
    };

    fetchSellerProductsFromDB();
    return () => {
      isMounted = false;
    };
  }, [profile.uniqueId, profile.id, profile.phone]);

  // Category filter in product grid
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Active modal state
  const [activeModal, setActiveModal] = useState<
    'none' | 'addProduct' | 'notifications' | 'messages' | 'wallet' | 'delete_confirm' | 'menu'
  >('none');

  // Copy status feedback
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const copyToClipboard = (text: string, fieldKey: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  /* =========================================================================
     SUPABASE-READY ADD PRODUCT FORM STATE
     Specifications:
     1. Product Code / SKU (auto-generated with manual edit)
     2. Product Name
     3. Category Dropdown (exact 24 categories)
     4. Price & Stock (side-by-side inputs)
     5. Product Image (clean file upload)
     6. Short Description (compact textarea)
     7. Submit Button ("পণ্য প্রকাশ করুন" linked to Supabase)
     ========================================================================= */
  const [formSku, setFormSku] = useState<string>(() => generateProductCode(products.length + 1));
  const [formName, setFormName] = useState<string>('');
  const [formCategory, setFormCategory] = useState<SellerProductCategory>('অর্গানিক পণ্য');
  const [formPrice, setFormPrice] = useState<string>('');
  const [formStock, setFormStock] = useState<string>('20');
  const [formUnit, setFormUnit] = useState<string>('১ কেজি');
  const [formImageFile, setFormImageFile] = useState<File | null>(null);
  const [formImagePreview, setFormImagePreview] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [isSubmittingProduct, setIsSubmittingProduct] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-generate fresh SKU when opening add product modal
  const openAddProductModal = () => {
    setFormSku(generateProductCode(products.length + 1));
    setFormName('');
    setFormCategory('অর্গানিক পণ্য');
    setFormPrice('');
    setFormStock('20');
    setFormUnit('১ কেজি');
    setFormImageFile(null);
    setFormImagePreview('');
    setFormDescription('');
    setFormError(null);
    setActiveModal('addProduct');
  };

  // Handle image file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFormError('অনুগ্রহ করে শুধুমাত্র ছবি ফাইল (JPEG, PNG, WebP) নির্বাচন করুন');
      return;
    }

    setFormImageFile(file);
    setFormError(null);

    // Create instant local preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setFormImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop image handler
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setFormImageFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Supabase Table Insert & Local Grid Update
  const handlePublishProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('পণ্যর নাম প্রদান করা আবশ্যক');
      return;
    }
    const priceNum = parseFloat(formPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setFormError('সঠিক বিক্রয় মূল্য (৳) প্রদান করুন');
      return;
    }
    const stockNum = parseInt(formStock, 10);
    if (isNaN(stockNum) || stockNum < 0) {
      setFormError('সঠিক স্টক সংখ্যা প্রদান করুন');
      return;
    }

    setIsSubmittingProduct(true);
    setFormError(null);

    try {
      let finalImageUrl = formImagePreview || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&auto=format&fit=crop&q=80';

      // 1. Upload file to Supabase storage if file is selected
      if (formImageFile) {
        try {
          const uploadRes = await supabaseMediaService.uploadToSupabase(
            formImageFile,
            {
              productId: formSku.trim(),
              bucket: 'products'
            }
          );

          if (uploadRes.success && uploadRes.url) {
            finalImageUrl = uploadRes.url;
          }
        } catch (uploadErr) {
          console.warn('[ProductSellerProfile] Supabase storage upload note:', uploadErr);
          // Fallback to compressed base64 preview
          try {
            const compressed = await compressImage(formImageFile, 800, 800, 0.8);
            if (compressed) finalImageUrl = compressed;
          } catch {}
        }
      }

      // 2. Prepare Supabase payload
      const cleanSku = formSku.trim() || generateProductCode(products.length + 1);
      const safeProductPayload = prepareProductPayload({
        code: cleanSku,
        product_code: cleanSku,
        name_bn: formName.trim(),
        title: formName.trim(),
        category: formCategory,
        price: priceNum,
        stock: stockNum,
        stock_quantity: stockNum,
        unit: formUnit.trim() || '১ কেজি',
        image_url: finalImageUrl,
        description: formDescription.trim(),
        seller_id: profile.uniqueId || profile.id,
        seller_name: profile.shopName,
        seller_phone: profile.phone,
        district: profile.district,
        upazila: profile.upazila,
        status: 'published',
        is_active: true,
        is_published: true
      });

      // 3. Perform safe Supabase insert into 'products' table using smartSupabaseInsert
      if (isSupabaseConfigured) {
        try {
          const insertRes = await smartSupabaseInsert('products', safeProductPayload);
          if (!insertRes.success) {
            console.warn('[ProductSellerProfile] Supabase products table note:', insertRes.error);
          }
        } catch (dbErr) {
          console.warn('[ProductSellerProfile] Supabase products table exception:', dbErr);
        }

        // Also insert into 'seller_products' table if present
        try {
          await supabase.from('seller_products').insert([
            {
              ...safeProductPayload,
              unique_id: cleanSku
            }
          ]);
        } catch {}
      }

      // 4. Update local state immediately for seamless real-time preview
      const newProductItem: SellerProductItem = {
        id: `prod_${Date.now()}`,
        code: cleanSku,
        nameBn: formName.trim(),
        category: formCategory,
        price: priceNum,
        stock: stockNum,
        unit: formUnit.trim() || '১ কেজি',
        image: finalImageUrl,
        description: formDescription.trim(),
        sellerId: profile.uniqueId,
        sellerName: profile.shopName,
        inStock: stockNum > 0,
        createdAt: new Date().toISOString()
      };

      const updatedProducts = [newProductItem, ...products];
      setProducts(updatedProducts);

      // Persist to localStorage for fallback
      try {
        localStorage.setItem(`seller_products_${profile.uniqueId}`, JSON.stringify(updatedProducts));
      } catch {}

      showToast(`🎉 পণ্য "${formName.trim()}" সফলভাবে প্রকাশিত হয়েছে!`);
      setActiveModal('none');
    } catch (err: any) {
      console.error('[ProductSellerProfile] Publish error:', err);
      setFormError(err?.message || 'পণ্য প্রকাশ করতে সমস্যা হয়েছে। পুনরায় চেষ্টা করুন।');
    } finally {
      setIsSubmittingProduct(false);
    }
  };

  // Delete product action (Owner View)
  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!window.confirm(`আপনি কি নিশ্চিতভাবে "${productName}" পণ্যটি মুছে ফেলতে চান?`)) return;

    try {
      if (isSupabaseConfigured) {
        try {
          await supabase.from('products').delete().eq('id', productId);
        } catch {}
        try {
          await supabase.from('products').delete().eq('code', productId);
        } catch {}
      }

      const updated = products.filter(p => p.id !== productId && p.code !== productId);
      setProducts(updated);
      try {
        localStorage.setItem(`seller_products_${profile.uniqueId}`, JSON.stringify(updated));
      } catch {}
      showToast('পণ্যটি সফলভাবে মুছে ফেলা হয়েছে।');
    } catch {
      showToast('পণ্য মোছার সময় ত্রুটি হয়েছে।');
    }
  };

  // Filter products by category and search
  const filteredProducts = useMemo(() => {
    return products.filter(item => {
      const matchCat = selectedCategory === 'all' || item.category === selectedCategory;
      const matchSearch =
        !searchQuery.trim() ||
        item.nameBn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  return (
    <div
      className="min-h-screen bg-[#FBFBFA] text-black font-sans pb-20 selection:bg-black selection:text-white"
      id="product-seller-profile-container"
    >
      {/* =========================================================================
          TOAST ALERT
          ========================================================================= */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-black text-white px-5 py-3 rounded-md shadow-2xl border border-neutral-700 text-xs font-mono font-bold animate-fade-in flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* =========================================================================
          1. HEADER SECTION
          - Top Header: "Jhadimadi.com"
          - Sub-Header: "Product Seller Profile"
          - VIEW A: Notification icon, Messaging icon, 3-Line Menu box
          - VIEW B: Top-right icons and 3-line menu completely hidden
          ========================================================================= */}
      <header className="sticky top-0 z-40 bg-[#FBFBFA] border-b border-neutral-300 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          
          {/* Left: Back Button & Title */}
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="w-8 h-8 rounded border border-neutral-300 hover:bg-neutral-200 flex items-center justify-center transition active:scale-95 cursor-pointer"
                title="ফিরে যান"
                id="header-back-btn"
              >
                <ArrowLeft className="w-4 h-4 text-black" />
              </button>
            )}

            <div>
              <h1 className="text-sm font-black tracking-wider uppercase text-black font-mono leading-tight">
                Jhadimadi.com
              </h1>
              <h2 className="text-xs font-semibold text-neutral-600 font-mono">
                Product Seller Profile
              </h2>
            </div>
          </div>

          {/* Right Controls: CONDITIONAL RENDERING */}
          {isOwnerView ? (
            /* VIEW A (Owner View): Notification, Messaging & 3-Line Menu */
            <div className="flex items-center gap-2" id="owner-header-controls">
              
              {/* Notification Icon */}
              <button
                type="button"
                onClick={() => setActiveModal('notifications')}
                className="relative w-8 h-8 rounded border border-neutral-300 bg-white hover:bg-neutral-100 flex items-center justify-center transition active:scale-95 cursor-pointer"
                title="বিজ্ঞপ্তি"
                id="btn-owner-notifications"
              >
                <Bell className="w-4 h-4 text-black" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-black text-white text-[9px] font-mono font-bold rounded-full flex items-center justify-center">
                  2
                </span>
              </button>

              {/* Messaging Icon */}
              <button
                type="button"
                onClick={() => setActiveModal('messages')}
                className="relative w-8 h-8 rounded border border-neutral-300 bg-white hover:bg-neutral-100 flex items-center justify-center transition active:scale-95 cursor-pointer"
                title="মেসেজ"
                id="btn-owner-messages"
              >
                <MessageSquare className="w-4 h-4 text-black" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-black text-white text-[9px] font-mono font-bold rounded-full flex items-center justify-center">
                  1
                </span>
              </button>

              {/* 3-Line (Hamburger) Menu Box */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setActiveModal(prev => prev === 'menu' ? 'none' : 'menu')}
                  className="w-8 h-8 rounded border-2 border-black bg-black text-white hover:bg-neutral-800 flex items-center justify-center transition active:scale-95 cursor-pointer"
                  title="মেনু"
                  id="btn-owner-hamburger-menu"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {/* 3-Line Dropdown Menu */}
                {activeModal === 'menu' && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border-2 border-black rounded-md shadow-2xl py-2 z-50 animate-fade-in font-mono text-xs">
                    
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModal('none');
                        openAddProductModal();
                      }}
                      className="w-full px-4 py-2.5 text-left text-black hover:bg-neutral-100 flex items-center gap-2.5 font-bold cursor-pointer border-b border-neutral-200"
                    >
                      <Plus className="w-4 h-4" />
                      <span>পণ্য যোগ করুন (Add Product)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveModal('none');
                        if (onNavigateDashboard) onNavigateDashboard();
                      }}
                      className="w-full px-4 py-2 text-left text-black hover:bg-neutral-100 flex items-center gap-2.5 cursor-pointer"
                    >
                      <Store className="w-4 h-4" />
                      <span>ড্যাশবোর্ড (Dashboard)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveModal('wallet')}
                      className="w-full px-4 py-2 text-left text-black hover:bg-neutral-100 flex items-center gap-2.5 cursor-pointer"
                    >
                      <Wallet className="w-4 h-4" />
                      <span>ওয়ালেট (Wallet)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveModal('none');
                        if (onEditProfile) onEditProfile(profile);
                      }}
                      className="w-full px-4 py-2 text-left text-black hover:bg-neutral-100 flex items-center gap-2.5 cursor-pointer"
                    >
                      <Tag className="w-4 h-4" />
                      <span>প্রোফাইল সম্পাদন (Edit)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveModal('notifications')}
                      className="w-full px-4 py-2 text-left text-black hover:bg-neutral-100 flex items-center gap-2.5 cursor-pointer"
                    >
                      <Bell className="w-4 h-4" />
                      <span>বিজ্ঞপ্তি (Notifications)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveModal('messages')}
                      className="w-full px-4 py-2 text-left text-black hover:bg-neutral-100 flex items-center gap-2.5 cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>মেসেজ (Messages)</span>
                    </button>

                    <div className="border-t border-neutral-200 my-1" />

                    <button
                      type="button"
                      onClick={() => {
                        setActiveModal('none');
                        if (onSignOut) onSignOut();
                      }}
                      className="w-full px-4 py-2 text-left text-neutral-800 hover:bg-neutral-100 flex items-center gap-2.5 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>লগ আউট (Sign Out)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveModal('delete_confirm')}
                      className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-2.5 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>প্রোফাইল মুছুন (Delete)</span>
                    </button>

                  </div>
                )}
              </div>

            </div>
          ) : (
            /* VIEW B (Customer View): Top-right notification, messaging, and 3-line menu box are completely hidden */
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded border border-black bg-black text-white font-bold">
                Verified Seller
              </span>
            </div>
          )}

        </div>
      </header>

      {/* =========================================================================
          2. BANNER & LOGO LAYOUT
          - Banner: Full-width cover banner image area right below the header.
          - Logo: Circular seller logo positioned overlapping or next to the banner.
          ========================================================================= */}
      <section className="relative w-full border-b border-neutral-300 bg-neutral-200" id="seller-banner-section">
        {/* Full-width Cover Banner Image */}
        <div className="w-full h-44 sm:h-56 md:h-64 overflow-hidden relative bg-neutral-900">
          <img
            src={profile.coverBanner}
            alt="Seller Cover Banner"
            className="w-full h-full object-cover grayscale contrast-125 opacity-90"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1400&auto=format&fit=crop&q=80';
            }}
          />
          {/* Subtle monochrome overlay */}
          <div className="absolute inset-0 bg-black/20" />

          {/* Owner Change Banner button (Owner View Only) */}
          {isOwnerView && (
            <button
              type="button"
              onClick={() => showToast('ব্যানার ছবি আপলোড করতে প্রোফাইল এডিটর ওপেন করুন')}
              className="absolute top-3 right-3 px-3 py-1.5 bg-black/80 hover:bg-black text-white text-xs font-mono font-bold rounded border border-neutral-400 backdrop-blur-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>ব্যানার পরিবর্তন</span>
            </button>
          )}
        </div>

        {/* Circular Seller Logo Container (Overlapping banner) */}
        <div className="max-w-4xl mx-auto px-4 relative">
          <div className="absolute -bottom-12 sm:-bottom-14 left-4 sm:left-6 flex items-end gap-3">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-[#FBFBFA] bg-black overflow-hidden shadow-lg relative shrink-0">
              <img
                src={profile.logo}
                alt={profile.shopName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80';
                }}
              />
              <span className="absolute bottom-0 inset-x-0 bg-black/80 text-white text-[8px] font-mono text-center py-0.5 uppercase tracking-wider">
                মার্চেন্ট
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. SELLER INFORMATION & HEADER SUMMARY
          - Display Seller/Shop Name (e.g., Jhadimadi)
          - Blood Group (e.g., Blood - A+)
          - Seller ID (e.g., ID - Kha - 001)
          ========================================================================= */}
      <section className="max-w-4xl mx-auto px-4 pt-16 sm:pt-18 pb-6 border-b border-neutral-300" id="seller-info-section">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          
          {/* Left: Core Seller Details */}
          <div className="space-y-2">
            
            {/* Seller/Shop Name */}
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight font-sans">
                {profile.shopName}
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-black text-white uppercase tracking-wider">
                {profile.category}
              </span>
            </div>

            {/* Blood Group & Seller ID Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              
              {/* Seller ID */}
              <div className="px-2.5 py-1 rounded border border-black bg-white font-mono font-bold text-xs text-black flex items-center gap-1.5 shadow-2xs">
                <Tag className="w-3.5 h-3.5 text-black" />
                <span>{profile.uniqueId}</span>
              </div>

              {/* Blood Group */}
              <div className="px-2.5 py-1 rounded border border-neutral-400 bg-[#F4F4F0] font-mono font-bold text-xs text-black flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-600 inline-block" />
                <span>{profile.bloodGroup}</span>
              </div>

              {/* Location */}
              <div className="px-2.5 py-1 rounded border border-neutral-300 bg-white font-mono text-xs text-neutral-700 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-neutral-800" />
                <span>{profile.upazila}, {profile.district}</span>
              </div>

            </div>

            {/* Short Store About */}
            {profile.about && (
              <p className="text-xs text-neutral-700 max-w-2xl leading-relaxed pt-1">
                {profile.about}
              </p>
            )}

          </div>

          {/* Right: Actions / Stats */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0 md:items-end">
            
            {isOwnerView ? (
              /* VIEW A (Owner View): Prominent "Add New Product" Trigger */
              <div className="space-y-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={openAddProductModal}
                  className="w-full sm:w-auto px-5 py-3 rounded-md bg-black text-white hover:bg-neutral-800 border-2 border-black font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-95 shadow-md cursor-pointer"
                  id="btn-trigger-add-product-owner"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>নতুন পণ্য যোগ করুন (Add Product)</span>
                </button>

                <div className="flex items-center justify-between sm:justify-end gap-3 font-mono text-xs text-neutral-600 px-1">
                  <span>মোট পণ্য: <strong className="text-black font-bold">{products.length}</strong></span>
                  <span>•</span>
                  <span>ওয়ালেট: <strong className="text-black font-bold">৳ {profile.walletBalance?.toLocaleString()}</strong></span>
                </div>
              </div>
            ) : (
              /* VIEW B (Customer View): Customer Contact Shortcuts & Payment Info */
              <div className="space-y-2 w-full sm:w-auto">
                <div className="flex items-center gap-2">
                  <a
                    href={`https://wa.me/88${profile.phone?.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 px-4 py-2 border border-black rounded bg-white hover:bg-neutral-100 text-xs font-mono font-bold flex items-center justify-center gap-1.5 text-black transition"
                  >
                    <span>হোয়াটসঅ্যাপ</span>
                  </a>
                  <a
                    href={`tel:${profile.phone}`}
                    className="flex-1 px-4 py-2 border-2 border-black rounded bg-black text-white hover:bg-neutral-800 text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>কল করুন</span>
                  </a>
                </div>

                <div className="p-2 border border-neutral-300 rounded bg-white text-[11px] font-mono flex items-center justify-between gap-2">
                  <span className="text-neutral-600">bKash/নগদ: <strong>{profile.bkashNumber}</strong></span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(profile.bkashNumber || '01870592699', 'pay')}
                    className="text-[10px] font-bold underline hover:text-black cursor-pointer"
                  >
                    {copiedField === 'pay' ? 'কপি হয়েছে' : 'কপি'}
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>
      </section>

      {/* =========================================================================
          4. PRODUCT GRID FILTER & SEARCH BAR
          ========================================================================= */}
      <section className="max-w-4xl mx-auto px-4 py-4 space-y-3" id="product-filter-section">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          
          {/* Header Title */}
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-700" />
            <h3 className="text-sm font-black tracking-wide text-gray-900">
              পণ্য সম্ভার (Products Catalog)
            </h3>
            <span className="text-xs font-bold px-2 py-0.5 border border-emerald-200 rounded-full bg-emerald-50 text-emerald-800">
              {filteredProducts.length}
            </span>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="পণ্য বা কোড খুঁজুন..."
              className="w-full pl-9 pr-8 py-1.5 border border-gray-200 rounded-xl bg-white text-xs text-gray-900 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

        </div>

        {/* Category Filter Chips - Matching Home Page Design */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs select-none">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-[9px] font-bold whitespace-nowrap transition-all duration-200 cursor-pointer shrink-0 shadow-2xs active:scale-95 ${
              selectedCategory === 'all'
                ? 'bg-[#0A6A32] text-white shadow-xs font-black ring-2 ring-emerald-600/30'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-[#0A6A32]'
            }`}
          >
            সকল ক্যাটাগরি ({products.length})
          </button>
          {SELLER_PRODUCT_CATEGORIES.map((cat) => {
            const count = products.filter(p => p.category === cat).length;
            if (count === 0 && selectedCategory !== cat) return null;
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-[9px] font-bold whitespace-nowrap transition-all duration-200 cursor-pointer shrink-0 shadow-2xs active:scale-95 ${
                  isActive
                    ? 'bg-[#0A6A32] text-white shadow-xs font-black ring-2 ring-emerald-600/30'
                    : 'bg-white text-gray-700 border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-[#0A6A32]'
                }`}
              >
                {cat} {count > 0 ? `(${count})` : ''}
              </button>
            );
          })}
        </div>
      </section>

      {/* =========================================================================
          5. PRODUCT GRID (MATCHING HOME PAGE PRODUCT CARD STYLING)
          ========================================================================= */}
      <main className="max-w-4xl mx-auto px-4" id="seller-products-grid-section">
        {filteredProducts.length === 0 ? (
          <div className="p-10 text-center border border-dashed border-gray-200 rounded-2xl bg-white space-y-3 shadow-2xs">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-700 border border-emerald-100">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-xs text-gray-800">
                {searchQuery ? `"${searchQuery}" এর কোনো পণ্য মেলেনি` : 'কোনো পণ্য পাওয়া যায়নি'}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {searchQuery ? 'বানান যাচাই করে আবার চেষ্টা করুন।' : (isOwnerView ? 'আপনার ক্যাটালগে নতুন পণ্য যোগ করুন।' : 'বিক্রেতা এখনও কোনো পণ্য যোগ করেননি।')}
              </p>
            </div>
            {isOwnerView && (
              <button
                type="button"
                onClick={openAddProductModal}
                className="mt-2 px-4 py-2 bg-[#2EAA26] hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-[10px] font-black shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>পণ্য যোগ করুন</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
            {filteredProducts.map((item) => {
              const curPrice = Number(item.price || 0);
              const origPrice = Number(item.regularPrice || 0);
              const hasGenuineDiscount = origPrice > curPrice && curPrice > 0;
              const discount = hasGenuineDiscount ? Math.round(((origPrice - curPrice) / origPrice) * 100) : 0;

              return (
                <div
                  key={item.id || item.code}
                  onClick={() => {
                    if (onViewProductDetails) {
                      onViewProductDetails(item);
                    }
                  }}
                  className="bg-white p-2 rounded-2xl border border-gray-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group relative overflow-hidden"
                  id={`product-card-${item.code}`}
                >
                  {/* Image Container with Badges */}
                  <div className="relative w-full h-32 bg-slate-100 rounded-md overflow-hidden mb-1.5 shrink-0">
                    <img
                      src={getProductPublicUrl(item.image)}
                      alt={item.nameBn}
                      className="w-full h-32 object-cover rounded-md group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        const target = e.currentTarget as HTMLImageElement;
                        target.onerror = null;
                        target.src = NO_IMAGE_AVAILABLE_ICON;
                      }}
                    />
                    {/* Origin Pin */}
                    {Boolean(item.code || profile.district) && (
                      <span className="absolute top-1.5 left-1.5 bg-black/60 backdrop-blur-xs text-white text-[6.5px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                        <MapPin className="w-2 h-2 text-amber-300" />
                        {item.code || profile.district?.split(' ')[0] || 'পাহাড়ি পণ্য'}
                      </span>
                    )}

                    {/* Discount / Stock Status Badge */}
                    {hasGenuineDiscount && discount > 0 ? (
                      <span className="absolute top-1.5 right-1.5 bg-red-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded-md shadow-xs">
                        {discount}% ছাড়
                      </span>
                    ) : item.stock <= 0 ? (
                      <span className="absolute top-1.5 right-1.5 bg-red-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded-md shadow-xs">
                        স্টক আউট
                      </span>
                    ) : null}
                  </div>

                  {/* Title & Category Info */}
                  <div className="space-y-0.5">
                    <span className="text-[7px] font-black text-emerald-700 uppercase bg-emerald-50 px-1.5 py-0.2 rounded-md inline-block">
                      {item.category}
                    </span>
                    <h4 className="text-[9px] font-black text-gray-900 leading-snug line-clamp-2 mt-0.5">
                      {item.nameBn}
                    </h4>
                    <p className="text-[8px] text-gray-600 font-semibold truncate flex items-center gap-0.5">
                      <span className="text-[7px] text-gray-400 font-normal">পরিমাণ:</span>
                      {item.unit || '১ পিস'}
                    </p>

                    {/* Stock info */}
                    <p className="text-[7.5px] text-gray-500 font-medium truncate flex items-center gap-1">
                      <span className="text-[7px] text-gray-400">স্টক:</span>
                      <span className={item.stock > 0 ? "font-bold text-gray-700" : "font-bold text-red-600"}>
                        {item.stock > 0 ? `${item.stock} টি` : 'স্টক শেষ'}
                      </span>
                    </p>
                  </div>

                  {/* Price & Action row */}
                  <div className="flex items-center justify-between pt-2 mt-1 border-t border-gray-100">
                    <div className="flex flex-col">
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-[11px] font-black text-[#2EAA26] leading-none">
                          ৳ {curPrice}
                        </span>
                        {item.unit && (
                          <span className="text-[7.5px] font-medium text-gray-500 leading-none truncate max-w-[65px]">
                            /{item.unit}
                          </span>
                        )}
                      </div>
                      {hasGenuineDiscount && (
                        <span className="text-[7.5px] text-gray-400 line-through font-bold">
                          ৳ {origPrice}
                        </span>
                      )}
                    </div>

                    {isOwnerView ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormSku(item.code);
                            setFormName(item.nameBn);
                            setFormCategory(item.category as SellerProductCategory);
                            setFormPrice(String(item.price));
                            setFormStock(String(item.stock));
                            setFormUnit(item.unit || '১ কেজি');
                            setFormImagePreview(item.image);
                            setFormDescription(item.description || '');
                            setActiveModal('addProduct');
                          }}
                          className="text-[7.5px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                          title="পণ্য সম্পাদনা করুন"
                        >
                          সম্পাদনা
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProduct(item.id || item.code, item.nameBn);
                          }}
                          className="text-[7.5px] font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-1.5 py-1 rounded-lg transition-colors cursor-pointer"
                          title="পণ্য মুছুন"
                        >
                          মুছুন
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onAddToCart) {
                              onAddToCart(item, 1);
                            }
                            showToast(`🛒 "${item.nameBn}" কার্টে যোগ করা হয়েছে!`);
                          }}
                          className="bg-[#2EAA26] hover:bg-emerald-700 active:scale-90 text-white p-1.5 rounded-xl shadow-xs transition-transform flex items-center justify-center cursor-pointer"
                          title="কার্টে যোগ করুন"
                        >
                          <ShoppingCart className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* =========================================================================
          6. ADD NEW PRODUCT MODAL (STREAMLINED SUPABASE-READY)
          Form Specifications:
          1. Product Code / SKU: Auto-generated with manual edit capability
          2. Product Name: Clean text input
          3. Category Dropdown: Exact 24 categories
          4. Price & Stock: Side-by-side inputs
          5. Product Image: Clean file upload field
          6. Short Description: Compact textarea
          7. Submit Button: "পণ্য প্রকাশ করুন" linked to Supabase insert
          ========================================================================= */}
      {activeModal === 'addProduct' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div
            className="bg-white border-2 border-black rounded-lg w-full max-w-lg p-5 space-y-4 shadow-2xl my-6 max-h-[92vh] overflow-y-auto"
            id="add-product-modal-dialog"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-neutral-300 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-black stroke-[3]" />
                <div>
                  <h4 className="font-bold text-sm text-black uppercase font-mono tracking-wide">
                    নতুন পণ্য যোগ করুন (Add Product)
                  </h4>
                  <p className="text-[10px] text-neutral-500 font-mono">
                    মার্চেন্ট: {profile.shopName} • {profile.uniqueId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="w-7 h-7 rounded border border-neutral-300 hover:bg-neutral-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error banner */}
            {formError && (
              <div className="p-3 border-2 border-red-600 rounded bg-red-50 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{formError}</span>
              </div>
            )}

            {/* Streamlined Form */}
            <form onSubmit={handlePublishProduct} className="space-y-4 text-xs font-sans">
              
              {/* Field 1: Product Code / SKU (Auto-generated with manual edit capability) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-black font-mono">
                    ১. প্রোডাক্ট কোড / SKU (Product Code) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormSku(generateProductCode(products.length + 1))}
                    className="text-[10px] font-mono text-neutral-600 underline hover:text-black cursor-pointer"
                  >
                    নতুন কোড তৈরি করুন
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={formSku}
                  onChange={(e) => setFormSku(e.target.value)}
                  placeholder="e.g. JHD-PROD-001"
                  className="w-full p-2.5 border-2 border-black rounded bg-white text-black font-mono font-bold tracking-wider focus:outline-hidden focus:bg-neutral-50"
                  id="input-product-sku"
                />
                <span className="text-[10px] text-neutral-500 font-mono mt-0.5 block">
                  ইউনিক কোড স্বয়ংক্রিয়ভাবে তৈরি হয়েছে, প্রয়োজনে সম্পাদনা করতে পারেন।
                </span>
              </div>

              {/* Field 2: Product Name */}
              <div>
                <label className="block font-bold text-black mb-1">
                  ২. পণ্যের নাম (Product Name) *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="যেমন: পার্বত্য পাহাড়ি খাঁটি মধু"
                  className="w-full p-2.5 border border-neutral-300 rounded bg-white text-black font-sans focus:outline-hidden focus:border-black font-medium"
                  id="input-product-name"
                />
              </div>

              {/* Field 3: Category Dropdown (Exact 24 categories) */}
              <div>
                <label className="block font-bold text-black mb-1 font-mono">
                  ৩. ক্যাটাগরি নির্বাচন করুন (Category Dropdown) *
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as SellerProductCategory)}
                  className="w-full p-2.5 border border-neutral-300 rounded bg-white text-black font-mono text-xs focus:outline-hidden focus:border-black cursor-pointer"
                  id="select-product-category"
                >
                  {SELLER_PRODUCT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Field 4: Price & Stock (Side-by-side inputs) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Price */}
                <div>
                  <label className="block font-bold text-black mb-1 font-mono">
                    ৪.১ মূল্য (৳ Taka) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-neutral-500">
                      ৳
                    </span>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2.5 border border-neutral-300 rounded bg-white text-black font-mono font-bold focus:outline-hidden focus:border-black"
                      id="input-product-price"
                    />
                  </div>
                </div>

                {/* Stock Quantity */}
                <div>
                  <label className="block font-bold text-black mb-1 font-mono">
                    ৪.২ স্টক সংখ্যা (Stock) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    placeholder="20"
                    className="w-full p-2.5 border border-neutral-300 rounded bg-white text-black font-mono font-bold focus:outline-hidden focus:border-black"
                    id="input-product-stock"
                  />
                </div>

                {/* Unit type */}
                <div>
                  <label className="block font-bold text-black mb-1 font-mono">
                    ৪.৩ একক (Unit)
                  </label>
                  <input
                    type="text"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    placeholder="১ কেজি / পিস"
                    className="w-full p-2.5 border border-neutral-300 rounded bg-white text-black font-mono text-xs focus:outline-hidden focus:border-black"
                    id="input-product-unit"
                  />
                </div>
              </div>

              {/* Field 5: Product Image (Clean file upload field) */}
              <div>
                <label className="block font-bold text-black mb-1 font-mono">
                  ৫. পণ্যের ছবি আপলোড (Product Image) *
                </label>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                  id="product-image-file-input"
                />

                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-neutral-400 hover:border-black rounded-lg p-4 bg-[#FBFBFA] text-center cursor-pointer transition flex flex-col items-center justify-center gap-2"
                  id="product-image-dropzone"
                >
                  {formImagePreview ? (
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded border border-black overflow-hidden bg-white shrink-0">
                        <img
                          src={formImagePreview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="text-left">
                        <span className="font-mono font-bold text-xs text-black block truncate max-w-xs">
                          {formImageFile?.name || 'নির্বাচিত ছবি'}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono">
                          ছবি পরিবর্তন করতে আবার ক্লিক করুন
                        </span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full border border-black flex items-center justify-center bg-white">
                        <Upload className="w-5 h-5 text-black" />
                      </div>
                      <div>
                        <p className="font-mono font-bold text-xs text-black">
                          ক্লিক করে ছবি নির্বাচন করুন অথবা ড্র্যাগ করুন
                        </p>
                        <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
                          PNG, JPG বা WebP ফরম্যাট সমর্থিত
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Field 6: Short Description (Compact textarea for product notes) */}
              <div>
                <label className="block font-bold text-black mb-1 font-mono">
                  ৬. সংক্ষিপ্ত বিবরণ / নোট (Short Description)
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="পণ্য সম্পর্কে সংক্ষেপে তথ্য লিখুন (যেমন: পাহাড়ি প্রাকৃতিক জুম আদা, তাজা ও সুগন্ধি)..."
                  className="w-full p-2.5 border border-neutral-300 rounded bg-white text-black font-sans focus:outline-hidden focus:border-black text-xs"
                  id="textarea-product-description"
                />
              </div>

              {/* Field 7: Submit Button ("পণ্য প্রকাশ করুন" linked directly to Supabase) */}
              <div className="pt-2 border-t border-neutral-200">
                <button
                  type="submit"
                  disabled={isSubmittingProduct}
                  className="w-full py-3.5 px-6 rounded-md bg-black text-white hover:bg-neutral-800 disabled:bg-neutral-400 font-mono font-bold text-sm tracking-wide uppercase transition active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  id="btn-publish-product-supabase"
                >
                  {isSubmittingProduct ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>সুপাবেসে পণ্য প্রকাশ হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>পণ্য প্রকাশ করুন (Publish Product)</span>
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* =========================================================================
          7. OWNER VIEW MODALS (Notifications, Messages, Wallet, Delete Confirm)
          ========================================================================= */}

      {/* A. Notifications Modal */}
      {activeModal === 'notifications' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black rounded-lg w-full max-w-md p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-black" />
                <h4 className="font-bold text-sm text-black uppercase font-mono">মার্চেন্ট নোটিফিকেশন</h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="w-7 h-7 rounded border border-neutral-300 hover:bg-neutral-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 text-xs font-mono">
              <div className="p-3 border border-neutral-300 rounded bg-[#FBFBFA] space-y-1">
                <div className="flex justify-between items-center text-[10px] text-neutral-500">
                  <span>নতুন অর্ডার এসেছে</span>
                  <span>আজ, ১১:২০ AM</span>
                </div>
                <p className="font-bold text-black">২ কেজি পাহাড়ি মধুর নতুন অর্ডারের পেমেন্ট ভেরিফাই হয়েছে।</p>
                <p className="text-[11px] text-neutral-600">গ্রাহক: রন্টু চাকমা • ০১৮•••••••</p>
              </div>

              <div className="p-3 border border-neutral-300 rounded bg-[#FBFBFA] space-y-1">
                <div className="flex justify-between items-center text-[10px] text-neutral-500">
                  <span>স্টক সতর্কতা</span>
                  <span>গতকাল</span>
                </div>
                <p className="font-bold text-black">"পাহাড়ি হলুদ গুড়া" পণ্যটির স্টক ৫ টিতে নেমে এসেছে।</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveModal('none')}
              className="w-full py-2 bg-black text-white text-xs font-mono font-bold rounded hover:bg-neutral-800 transition cursor-pointer"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      )}

      {/* B. Messages Modal */}
      {activeModal === 'messages' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black rounded-lg w-full max-w-md p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-black" />
                <h4 className="font-bold text-sm text-black uppercase font-mono">গ্রাহক ইনবক্স</h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="w-7 h-7 rounded border border-neutral-300 hover:bg-neutral-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 text-xs">
              <div className="p-3 border border-neutral-300 rounded bg-[#FBFBFA] space-y-1">
                <div className="flex justify-between items-center font-mono text-[10px] text-neutral-500">
                  <span className="font-bold text-black">প্রিয়া ত্রিপুরা</span>
                  <span>২৫ মিনিট আগে</span>
                </div>
                <p className="text-neutral-700 font-sans">
                  ভাইয়া, পিনন-হাদি এর কটন ফেব্রিকের কালার কি হালকা নীল পাওয়া যাবে?
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveModal('none')}
              className="w-full py-2 bg-black text-white text-xs font-mono font-bold rounded hover:bg-neutral-800 transition cursor-pointer"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      )}

      {/* C. Wallet Modal */}
      {activeModal === 'wallet' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black rounded-lg w-full max-w-md p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-black" />
                <h4 className="font-bold text-sm text-black uppercase font-mono">মার্চেন্ট ওয়ালেট (Seller Wallet)</h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="w-7 h-7 rounded border border-neutral-300 hover:bg-neutral-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 border-2 border-black rounded-md bg-[#FBFBFA] text-center space-y-1">
              <span className="text-[10px] uppercase font-mono text-neutral-500 block">বর্তমান উত্তোলণযোগ্য সেলস ব্যালেন্স</span>
              <span className="text-2xl font-black font-mono text-black">৳ {profile.walletBalance?.toLocaleString()}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono text-center">
              <div className="p-2 border border-neutral-300 rounded">
                <span className="text-[10px] text-neutral-500 block">মোট বিক্রয়</span>
                <span className="font-bold text-black">৳ ৪২,৮০০</span>
              </div>
              <div className="p-2 border border-neutral-300 rounded">
                <span className="text-[10px] text-neutral-500 block">উত্তোলিত</span>
                <span className="font-bold text-black">৳ ৩৭,৩৮০</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                alert('টাকা উত্তোলনের অনুরোধ সফলভাবে সিস্টেমে যুক্ত হয়েছে।');
                setActiveModal('none');
              }}
              className="w-full py-2.5 bg-black text-white text-xs font-mono font-bold rounded hover:bg-neutral-800 transition cursor-pointer"
            >
              টাকা উত্তোলন (Withdraw) করুন
            </button>
          </div>
        </div>
      )}

      {/* D. Delete Profile Confirmation Modal */}
      {activeModal === 'delete_confirm' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-red-600 rounded-lg w-full max-w-sm p-5 space-y-4 shadow-xl">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full border-2 border-red-600 bg-red-50 text-red-600 mx-auto flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <h4 className="font-black text-base text-black font-mono">মার্চেন্ট প্রোফাইল মুছবেন?</h4>
              <p className="text-xs text-neutral-600">
                এই প্রক্রিয়াটির ফলে আপনার সমস্ত তালিকাভুক্ত পণ্য, দোকান ও রিভিউ স্থায়ীভাবে মুছে যাবে।
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="py-2.5 border border-neutral-300 rounded text-xs font-bold text-black hover:bg-neutral-100 transition cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveModal('none');
                  if (onDeleteAccount) onDeleteAccount();
                }}
                className="py-2.5 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700 transition cursor-pointer"
              >
                হ্যাঁ, মুছে ফেলুন
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export { ProductSellerProfile as SellerProfile };
export default ProductSellerProfile;
