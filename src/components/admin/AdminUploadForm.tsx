import React, { useState, useEffect, useRef } from 'react';
import { Upload, AlertCircle, Loader2, Star, Trash2, Video, Percent, CheckCircle2 } from 'lucide-react';
import { 
  smartSupabaseUpload, 
  smartSupabaseInsert, 
  prepareProductPayload, 
  FALLBACK_PRODUCT_IMAGE 
} from '../../utils/supabaseDataService';
import { databaseService } from '../../services/databaseService';
import { isLocalTransientUrl } from '../../utils/directSupabaseStorage';
import { PRODUCT_CATEGORIES } from './AdminProductsTab';
import { supabase, supabaseUrl } from '../../supabase';

export interface ProductData {
  id?: string;
  title: string;
  category: string;
  sku: string;
  stock: number | string;
  unitAmount?: string;
  unitType?: string;
  price: number | string;
  discountPercent?: number | string;
  discountPrice?: number | string;
  description?: string;
  image: string;
  images?: string[];
  youtubeUrl?: string;
  sellerPhone?: string;
  origin?: string;
  qualityStandard?: string;
  stockStatusText?: string;
  sellerName?: string;
  [key: string]: any;
}

interface AdminUploadFormProps {
  initialProduct?: ProductData | null;
  productToEdit?: ProductData | null;
  mode?: string;
  onUploadSuccess?: (url: any) => void;
  onSave?: (product: ProductData) => void;
  onSubmit?: (product: ProductData) => void;
  onCancel?: () => void;
}

const UNIT_OPTIONS = [
  'গ্রাম', 
  'কেজি', 
  'লিটার', 
  'প্যাকেট', 
  'পিস', 
  'টি',
  'মিলি (ml)', 
  'জোড়া', 
  'বস্তা', 
  'ডজন'
];

export const AdminUploadForm: React.FC<AdminUploadFormProps> = ({
  initialProduct,
  productToEdit,
  mode,
  onUploadSuccess,
  onSave,
  onSubmit,
  onCancel,
}) => {
  const activeProduct = initialProduct || productToEdit;

  // ডিফল্ট মানসহ ফর্ম স্টেট
  const [formData, setFormData] = useState<ProductData>({
    title: '',
    category: 'Food',
    sku: 'JDM-015',
    stock: '50',
    unitAmount: '১',
    unitType: 'পিস (Pcs)',
    price: '',
    discountPercent: '',
    discountPrice: '',
    description: '',
    image: '',
    images: [],
    youtubeUrl: '',
    sellerPhone: '01870592699',
    origin: 'পার্বত্য চট্টগ্রাম',
    qualityStandard: '১০০% বিশুদ্ধ ও পরীক্ষিত',
    stockStatusText: 'স্টকে পর্যাপ্ত রয়েছে',
    sellerName: 'ঝাদিমাদি ভেরিফাইড মার্চেন্ট নেটওয়ার্ক'
  });

  const [imageUrlInput, setImageUrlInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeProduct) {
      const stockNum = Number(activeProduct.stock ?? activeProduct.stock_quantity ?? 50);
      const isOut = stockNum <= 0;
      setFormData({
        ...activeProduct,
        title: activeProduct.title || activeProduct.name || '',
        category: activeProduct.category || 'Food',
        sku: activeProduct.sku || 'JDM-015',
        stock: String(stockNum),
        origin: activeProduct.origin || 'পার্বত্য চট্টগ্রাম',
        qualityStandard: activeProduct.qualityStandard || '১০০% বিশুদ্ধ ও পরীক্ষিত',
        stockStatusText: isOut ? 'স্টক সমাপ্ত (Out of Stock)' : (activeProduct.stockStatusText || 'স্টকে পর্যাপ্ত রয়েছে'),
        sellerName: activeProduct.sellerName || 'ঝাদিমাদি ভেরিফাইড মার্চেন্ট নেটওয়ার্ক',
        images: activeProduct.images || (activeProduct.image ? [activeProduct.image] : []),
        image: activeProduct.image || (activeProduct.images?.[0] || ''),
        discountPercent: activeProduct.discountPercent || '',
        discountPrice: activeProduct.discountPrice || '',
      });
    }
  }, [activeProduct]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Dynamic stock-out logic
    if (name === 'stock') {
      const stockVal = Number(value);
      const isOut = isNaN(stockVal) || stockVal <= 0;
      setFormData((prev) => ({
        ...prev,
        stock: value,
        stockStatusText: isOut ? 'স্টক সমাপ্ত (Out of Stock)' : 'স্টকে পর্যাপ্ত রয়েছে'
      }));
      return;
    }

    // Dynamic price & discount calculation
    if (name === 'price') {
      const p = parseFloat(value) || 0;
      const disc = parseFloat(String(formData.discountPercent)) || 0;
      const dp = disc > 0 ? Math.round(p * (1 - disc / 100)) : '';
      setFormData((prev) => ({
        ...prev,
        price: value,
        discountPrice: dp ? String(dp) : ''
      }));
      return;
    }

    if (name === 'discountPercent') {
      const disc = parseFloat(value) || 0;
      const p = parseFloat(String(formData.price)) || 0;
      const dp = disc > 0 && p > 0 ? Math.round(p * (1 - disc / 100)) : '';
      setFormData((prev) => ({
        ...prev,
        discountPercent: value,
        discountPrice: dp ? String(dp) : ''
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Multiple files selection & upload (Up to 10 photos)
  const handleMultipleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    const currentImages = formData.images || [];
    if (currentImages.length >= 10) {
      setError('সর্বোচ্চ ১০টি ছবি আপলোড করা যাবে।');
      return;
    }

    const availableSlots = 10 - currentImages.length;
    const filesToUpload = fileList.slice(0, availableSlots);

    // 1. a) Immediately block local preview generation via FileReader/Blob
    setIsUploading(true);
    setError('');

    // 1. b) Show a visible uploading status indicator: "ছবি সুপাবেজ বাকেটে আপলোড করা হচ্ছে..."
    const uploadedUrls: string[] = [];
    let uploadFailed = false;

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const fileExt = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${cleanName}`;
        const filePath = `products/${uniqueSuffix}`;

        let uploadSuccess = false;
        let resolvedPublicUrl = '';

        // 1. Upload to primary 'products' bucket
        try {
          const { data: primaryData, error: primaryError } = await supabase.storage
            .from('products')
            .upload(filePath, file, { cacheControl: '3600', upsert: true, contentType: file.type || 'image/jpeg' });

          if (!primaryError && primaryData?.path) {
            try {
              const { data: pubData } = supabase.storage.from('products').getPublicUrl(primaryData.path);
              if (pubData?.publicUrl) resolvedPublicUrl = pubData.publicUrl;
            } catch (pErr) {
              console.warn('[AdminUploadForm] products getPublicUrl safe notice:', pErr);
            }
            if (!resolvedPublicUrl) {
              resolvedPublicUrl = `${supabaseUrl}/storage/v1/object/public/products/${primaryData.path}`;
            }
            uploadSuccess = true;
          } else if (primaryError) {
            console.error('[AdminUploadForm Storage Error - Bucket "products"]:', {
              bucket: 'products',
              path: filePath,
              fileName: file.name,
              errorMessage: primaryError.message,
              errorDetails: primaryError,
              statusCode: (primaryError as any)?.statusCode || (primaryError as any)?.status,
            });
          }
        } catch (err: any) {
          console.error('[AdminUploadForm Storage Exception - Bucket "products"]:', {
            bucket: 'products',
            path: filePath,
            fileName: file.name,
            exception: err?.message || err,
          });
        }

        // 2. Fallback to 'product-images' bucket
        if (!uploadSuccess) {
          try {
            console.warn('[AdminUploadForm] Retrying upload with fallback bucket "product-images"...');
            const { data: fallbackData, error: fallbackError } = await supabase.storage
              .from('product-images')
              .upload(filePath, file, { cacheControl: '3600', upsert: true, contentType: file.type || 'image/jpeg' });

            if (!fallbackError && fallbackData?.path) {
              try {
                const { data: pubData } = supabase.storage.from('product-images').getPublicUrl(fallbackData.path);
                if (pubData?.publicUrl) resolvedPublicUrl = pubData.publicUrl;
              } catch (pErr) {
                console.warn('[AdminUploadForm] product-images getPublicUrl safe notice:', pErr);
              }
              if (!resolvedPublicUrl) {
                resolvedPublicUrl = `${supabaseUrl}/storage/v1/object/public/product-images/${fallbackData.path}`;
              }
              uploadSuccess = true;
            } else if (fallbackError) {
              console.error('[AdminUploadForm Storage Error - Fallback Bucket "product-images"]:', {
                bucket: 'product-images',
                path: filePath,
                fileName: file.name,
                errorMessage: fallbackError.message,
                errorDetails: fallbackError,
              });
            }
          } catch (fbErr: any) {
            console.error('[AdminUploadForm Storage Exception - Fallback Bucket "product-images"]:', fbErr);
          }
        }

        // 3. Fallback to /api/upload
        if (!uploadSuccess) {
          try {
            console.warn('[AdminUploadForm] Attempting server-assisted upload via /api/upload...');
            const reader = new FileReader();
            const base64Body = await new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });

            const apiRes = await fetch('/api/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                data: base64Body,
                name: cleanName,
                bucket: 'products',
                contentType: file.type || 'image/jpeg'
              })
            });

            const apiData = await apiRes.json();
            if (apiData?.success && apiData?.url && !apiData.url.startsWith('data:')) {
              resolvedPublicUrl = apiData.url;
              uploadSuccess = true;
            } else {
              console.error('[AdminUploadForm Server Fallback Error]:', apiData?.error);
            }
          } catch (srvErr) {
            console.error('[AdminUploadForm Server Fallback Exception]:', srvErr);
          }
        }

        if (uploadSuccess && resolvedPublicUrl) {
          uploadedUrls.push(resolvedPublicUrl);
        } else {
          uploadFailed = true;
          console.error('[AdminUploadForm Storage Fatal Failure]: Could not upload file:', {
            fileName: file.name,
            fileSize: file.size,
            primaryBucket: 'products',
            fallbackBucket: 'product-images'
          });
        }
      }

      if (uploadedUrls.length > 0) {
        setFormData((prev) => {
          const updated = [...(prev.images || []), ...uploadedUrls].slice(0, 10);
          return {
            ...prev,
            images: updated,
            image: prev.image || updated[0]
          };
        });
        // 2. Auto-populate direct image url field
        setImageUrlInput(uploadedUrls[0]);
      }

      // 4. ERROR HANDLING:
      // If Supabase bucket upload fails, display an explicit toast error:
      if (uploadFailed || (filesToUpload.length > 0 && uploadedUrls.length === 0)) {
        setError('ছবি বাকেটে আপলোড ব্যর্থ হয়েছে! অনুগ্রহ করে Supabase Storage Bucket পারমিশন পরীক্ষা করুন।');
      }
    } catch (err: any) {
      setError('ছবি বাকেটে আপলোড ব্যর্থ হয়েছে! অনুগ্রহ করে Supabase Storage Bucket পারমিশন পরীক্ষা করুন।');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddImage = () => {
    if (imageUrlInput.trim()) {
      const currentImages = formData.images || [];
      if (currentImages.length >= 10) {
        setError('সর্বোচ্চ ১০টি ছবি যোগ করা যাবে।');
        return;
      }
      const updatedImages = [...currentImages, imageUrlInput.trim()].slice(0, 10);
      setFormData((prev) => ({
        ...prev,
        image: prev.image || imageUrlInput.trim(),
        images: updatedImages,
      }));
      setImageUrlInput('');
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    const updatedImages = (formData.images || []).filter((_, i) => i !== indexToRemove);
    setFormData((prev) => ({
      ...prev,
      image: updatedImages.length > 0 ? updatedImages[0] : '',
      images: updatedImages,
    }));
  };

  const handleSetPrimary = (imgUrl: string) => {
    setFormData((prev) => ({
      ...prev,
      image: imgUrl
    }));
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.title || !formData.price) {
      setError('দয়া করে পণ্যের নাম এবং মূল্য পূরণ করুন।');
      return;
    }

    try {
      setLoading(true);

      const prodTitle = formData.title.trim();
      const prodCategory = formData.category;
      const prodPrice = Number(formData.price) || 0;
      const prodDiscountPrice = Number(formData.discountPrice) || 0;
      const stockNum = Number(formData.stock) >= 0 ? Number(formData.stock) : 0;
      const isStockOut = stockNum <= 0;

      const prodDesc = formData.description?.trim() || `${formData.title.trim()} - অত্যন্ত গুণসম্পন্ন পাহাড়ি পণ্য।`;

      let allImages = (formData.images && formData.images.length > 0)
        ? [...formData.images]
        : (formData.image ? [formData.image] : []);

      // STRICT VALIDATION: Verify that NO Base64 or Blob strings are allowed into the database under any condition
      const hasBase64OrBlob = allImages.some(img => 
        !img || 
        img.startsWith('data:') || 
        img.startsWith('blob:')
      );

      if (hasBase64OrBlob) {
        setError('সতর্কতা: Base64 বা Blob ফরম্যাটের ছবি ডাটাবেজে সংরক্ষণ করা যাবে না। শুধুমাত্র সুপাবেজ স্টোরেজের পাবলিক URL গ্রহণযোগ্য।');
        setLoading(false);
        return;
      }

      allImages = allImages.filter(img => typeof img === 'string' && (img.startsWith('http://') || img.startsWith('https://')));

      if (allImages.length === 0) {
        setError('দয়া করে অন্তত একটি ছবি সুপাবেজ স্টোরেজে আপলোড অথবা সঠিক পাবলিক URL যোগ করুন।');
        setLoading(false);
        return;
      }

      const finalImageUrl = allImages[0];
      const formattedUnit = `${formData.unitAmount || '১'} ${formData.unitType || 'পিস (Pcs)'}`.trim();

      const productRecord = prepareProductPayload({
        name: prodTitle,
        price: prodPrice,
        regular_price: prodPrice,
        discount_price: prodDiscountPrice,
        category: prodCategory,
        description: prodDesc,
        image_url: finalImageUrl,
        image: finalImageUrl,
        images: allImages,
        youtube_url: formData.youtubeUrl,
        unit: formattedUnit,
        sku: formData.sku,
        stock: stockNum,
        stock_quantity: stockNum,
        status: isStockOut ? 'Out of Stock' : 'In Stock',
        stock_status: isStockOut ? 'out_of_stock' : 'in_stock',
        stock_status_text: isStockOut ? 'স্টক সমাপ্ত (Out of Stock)' : `স্টকে পর্যাপ্ত রয়েছে (${stockNum} টি)`,
        seller_name: formData.sellerName || 'ঝাদিমাদি ভেরিফাইড মার্চেন্ট নেটওয়ার্ক',
        origin: formData.origin || 'পার্বত্য চট্টগ্রাম',
        quality_standard: formData.qualityStandard || '১০০% বিশুদ্ধ ও পরীক্ষিত',
        district: 'খাগড়াছড়ি',
        upazila: 'সদর',
        is_active: true,
        is_published: true
      });

      const insertRes = await smartSupabaseInsert('products', productRecord);

      if (!insertRes.success) {
        setError(`পণ্য ডেটাবেজে সংরক্ষণে সমস্যা: ${insertRes.error?.message || 'Database error'}`);
        setLoading(false);
        return;
      }

      const finalProductData: ProductData = {
        ...formData,
        stock: stockNum,
        image: finalImageUrl,
        images: allImages,
        finalUnit: formattedUnit,
        status: isStockOut ? 'Out of Stock' : 'In Stock'
      };

      if (onUploadSuccess) onUploadSuccess(finalImageUrl);
      if (onSave) onSave(finalProductData);
      if (onSubmit) onSubmit(finalProductData);

      try {
        databaseService.notifyEntityChange('products');
        databaseService.fetchProductsFromSupabase().catch(() => {});
      } catch (_) {}

    } catch (err: any) {
      setError(`পণ্য সেভ করতে সমস্যা হয়েছে: ${err?.message || 'আবার চেষ্টা করুন'}`);
    } finally {
      setLoading(false);
    }
  };

  const isStockOut = Number(formData.stock) <= 0;

  return (
    <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl max-w-4xl mx-auto border border-emerald-100 text-left">
      <div className="flex justify-between items-center mb-6 pb-3 border-b border-gray-200">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            {activeProduct ? 'পণ্য এডিট করুন' : 'নতুন পণ্য রেজিস্ট্রেশন ফর্ম'}
          </h2>
          <p className="text-xs text-gray-500">ঝাদিমাদি মার্চেন্ট ড্যাশবোর্ড</p>
        </div>
        {onCancel && (
          <button onClick={onCancel} type="button" className="text-gray-400 hover:text-gray-600 font-bold text-xl p-1 cursor-pointer">
            ✕
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmitForm} className="space-y-6">
        {/* ১. মৌলিক তথ্য */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">পণ্যের বাংলা নাম *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
              placeholder="যেমন: খাগড়াছড়ির পাহাড়ি মধু"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">ক্যাটাগরি (Category) *</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm bg-white"
            >
              {PRODUCT_CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.labelBn}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ২. মূল্য, ছাড় (Discount) ও স্টক */}
        <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 space-y-4">
          <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
            <Percent className="w-4 h-4 text-emerald-600" />
            মূল্য, ছাড় % এবং স্টক পরিমাণ
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">বিক্রয় মূল্য (PRICE ৳) *</label>
              <input
                type="number"
                name="price"
                min="0"
                value={formData.price}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm bg-white font-bold"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-emerald-900 mb-1">ছাড় / অফার % (Discount %)</label>
              <div className="relative">
                <input
                  type="number"
                  name="discountPercent"
                  min="0"
                  max="99"
                  value={formData.discountPercent}
                  onChange={handleChange}
                  className="w-full border border-emerald-300 p-2.5 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm bg-white font-bold pr-7"
                  placeholder="0"
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-emerald-600">%</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">ছাড় পরবর্তী মূল্য (Offer Price ৳)</label>
              <input
                type="number"
                name="discountPrice"
                value={formData.discountPrice}
                onChange={handleChange}
                className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white"
                placeholder="স্বয়ংক্রিয় বা কাস্টম"
              />
            </div>
          </div>

          {/* Dynamic Stock-Out */}
          <div className="pt-2 border-t border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold text-gray-700 mb-1">স্টক সংখ্যা (Stock Quantity)</label>
              <input
                type="number"
                name="stock"
                min="0"
                value={formData.stock}
                onChange={handleChange}
                className="w-full sm:w-40 border border-gray-300 p-2 rounded-lg text-sm bg-white font-bold"
              />
            </div>

            <div className="w-full sm:w-auto">
              {isStockOut ? (
                <div className="p-2.5 bg-rose-100 text-rose-800 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-rose-300">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  স্টক আউট (Stock Out) ফ্ল্যাগড — হোমপেজে "স্টক সমাপ্ত" দেখাবে
                </div>
              ) : (
                <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ইন স্টক (In Stock) — {formData.stock} টি উপলব্ধ
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ৩. পণ্য স্পেসিফিকেশন ও তথ্যসূচি */}
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 border-b border-gray-200 pb-2">
            স্পেসিফিকেশন ও পরিমাপ (Specifications)
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">প্রোডাক্ট কোড (SKU)</label>
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                className="w-full border border-gray-300 p-2 rounded-lg text-sm bg-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">একক / পরিমাপ (Unit / Pack)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="unitAmount"
                  value={formData.unitAmount}
                  onChange={handleChange}
                  className="w-20 border border-gray-300 p-2 rounded-lg text-sm bg-white"
                  placeholder="১"
                />
                <select
                  name="unitType"
                  value={formData.unitType}
                  onChange={handleChange}
                  className="flex-1 border border-gray-300 p-2 rounded-lg text-sm bg-white"
                >
                  {UNIT_OPTIONS.map((opt, i) => (
                    <option key={i} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">উৎপাদন স্থান (Origin)</label>
              <input
                type="text"
                name="origin"
                value={formData.origin}
                onChange={handleChange}
                className="w-full border border-gray-300 p-2 rounded-lg text-sm bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">গুণগত মান (Quality Standard)</label>
              <input
                type="text"
                name="qualityStandard"
                value={formData.qualityStandard}
                onChange={handleChange}
                className="w-full border border-gray-300 p-2 rounded-lg text-sm bg-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">সরবরাহকারী / বিক্রেতা (Supplier Name)</label>
              <input
                type="text"
                name="sellerName"
                value={formData.sellerName}
                onChange={handleChange}
                className="w-full border border-gray-300 p-2 rounded-lg text-sm bg-white"
              />
            </div>
          </div>
        </div>

        {/* ৪. পণ্যের ছবি (৮-১০টি ছবি) ও ইউটিউব লিঙ্ক */}
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
          <div className="flex justify-between items-center">
            <label className="block text-sm font-bold text-gray-800">
              পণ্যের ছবি ও মিডিয়া (৮-১০টি ছবি সাপোর্ট)
            </label>
            <span className="text-xs font-bold text-emerald-700">
              {formData.images?.length || 0}/১০ টি ছবি যুক্ত
            </span>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            multiple
            onChange={handleMultipleFiles}
            className="hidden"
          />

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              disabled={isUploading || (formData.images?.length || 0) >= 10}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg shrink-0 cursor-pointer"
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              ফোন/পিসি থেকে ছবি যোগ করুন
            </button>

            <div className="flex flex-1 gap-2">
              <input
                type="text"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                className="flex-1 border border-gray-300 p-2 rounded-lg text-sm bg-white"
                placeholder="ছবি URL যোগ করুন..."
              />
              <button
                type="button"
                onClick={handleAddImage}
                className="bg-slate-800 text-white text-sm px-4 py-2 rounded-lg shrink-0 cursor-pointer"
              >
                যোগ করুন
              </button>
            </div>
          </div>

          {/* Previews */}
          {formData.images && formData.images.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-2">
              {formData.images.map((imgUrl, idx) => {
                const isPrimary = (formData.image === imgUrl) || (!formData.image && idx === 0);
                return (
                  <div key={idx} className={`relative group rounded-lg overflow-hidden border-2 h-20 bg-white ${isPrimary ? 'border-emerald-500' : 'border-gray-200'}`}>
                    <img src={imgUrl} alt={`Product ${idx}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-md cursor-pointer hover:bg-red-700"
                      title="মুছুন"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    {!isPrimary && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(imgUrl)}
                        className="absolute bottom-1 left-1 right-1 bg-black/70 text-white text-[9px] py-0.5 rounded cursor-pointer text-center"
                      >
                        মূল ছবি
                      </button>
                    )}
                    {isPrimary && (
                      <span className="absolute bottom-1 left-1 bg-emerald-600 text-white text-[9px] font-bold px-1 rounded flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 fill-white" /> মূল
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
              <Video className="w-3.5 h-3.5 text-rose-600" />
              ইউটিউব ভিডিও লিঙ্ক (YouTube URL)
            </label>
            <input
              type="text"
              name="youtubeUrl"
              value={formData.youtubeUrl || ''}
              onChange={handleChange}
              className="w-full border border-gray-300 p-2 rounded-lg text-sm bg-white"
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </div>
        </div>

        {/* ৫. বিস্তারিত বিবরণ */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">বিস্তারিত বিবরণ</label>
          <textarea
            name="description"
            rows={3}
            value={formData.description}
            onChange={handleChange}
            className="w-full border border-gray-300 p-2.5 rounded-lg text-sm"
            placeholder="পণ্যের বৈশিষ্ট্য ও গুণাগুণ সম্পর্কে লিখুন..."
          />
        </div>

        {/* ৬. বাটনসমূহ */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="border border-gray-300 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-bold text-sm transition cursor-pointer shadow-xs"
            >
              বাতিল
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2 rounded-lg shadow cursor-pointer flex items-center gap-2 transition disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>সংরক্ষণ হচ্ছে...</span>
              </>
            ) : (
              'পণ্য সংরক্ষণ করুন / পোস্ট করুন'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminUploadForm;
