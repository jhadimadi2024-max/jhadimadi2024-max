import React, { useState, useEffect, useRef } from 'react';
import { 
  Loader2, Sparkles, ArrowRight, Upload, Video, 
  Tag, DollarSign, FileText, Barcode, Layers, Box, Percent, Search, CheckCircle2, AlertCircle, X,
  Trash2, Star, Image as ImageIcon, Plus, Scale
} from 'lucide-react';
import { supabase, supabaseUrl } from '../../supabase'; // Unified Supabase client
import { uploadFileToSupabaseStorage } from '../../utils/directSupabaseStorage';
import { smartSupabaseUpload, smartSupabaseInsert } from '../../utils/supabaseDataService';
import { databaseService } from '../../services/databaseService';

interface Product {
  id?: string;
  title_bn?: string;
  title_en?: string;
  name?: string;
  name_bn?: string;
  product_code?: string;
  code?: string;
  sku?: string;
  category?: string;
  category_bn?: string;
  category_label_bn?: string;
  unit_quantity?: string | number;
  unit_type?: string;
  unit?: string;
  unit_pack?: string;
  price?: number;
  original_price?: number;
  regular_price?: number;
  discount_percent?: number | string;
  discount_price?: number | string;
  stock_quantity?: number;
  stock?: number;
  status?: string;
  discount_offer?: string;
  image_url?: string;
  image?: string;
  images?: string[];
  products_photos?: any;
  youtube_url?: string;
  description?: string;
  [key: string]: any;
}

interface ModernAddProductFormProps {
  initialProduct?: Product | null;
  onSubmit?: (data: any) => void;
  onSuccess?: (product: any) => void;
  onCancel?: () => void;
}

const CATEGORIES = [
  'ফুড ও খাবার',
  'পাহাড়ী পণ্য সম্ভার',
  'পোশাক-আশাক / ড্রেস',
  'রিয়েল এস্টেট',
  'গাড়ি ও যানবাহন',
  'শুঁটকি',
  'খাবার / ফুডস',
  'মসলা',
  'ঔষধ',
  'ইলেকট্রনিক & ইলেকট্রিক্যাল',
  'গহনা ও অলংকার',
  'অটোমোবাইল',
  'হস্তশিল্প',
  'মোবাইল',
  'গাড়ি ও বাইক',
  'ফলমূল',
  'শাকসবজি',
  'মাছ / মাংস',
  'পোশাক আশাক',
  'কিডস আইটেম',
  'ব্যাগ ও জুতা',
  'কৃষিপণ্য',
  'আসবাবপত্র',
  'বই / পত্র',
  'পাহাড়ি পোশাক',
  'চাইনিজ জিনিস',
  'ভেষজ পণ্য'
];

export const ModernAddProductForm: React.FC<ModernAddProductFormProps> = ({
  initialProduct,
  onSubmit,
  onSuccess,
  onCancel,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriesList, setCategoriesList] = useState<string[]>(CATEGORIES);

  // Form States
  const [titleBn, setTitleBn] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [productCode, setProductCode] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [unitAmount, setUnitAmount] = useState('১');
  const [unitType, setUnitType] = useState('পিস');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountPrice, setDiscountPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('10');
  const [discountOffer, setDiscountOffer] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [description, setDescription] = useState('');
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch ALL categories directly from database on mount
  useEffect(() => {
    let isMounted = true;
    databaseService.fetchCategoriesFromDatabase().then(cats => {
      if (isMounted && Array.isArray(cats) && cats.length > 0) {
        const names = cats.map((c: any) => c.nameBn || c.nameEn || c.name).filter(Boolean);
        const uniqueNames = Array.from(new Set([...names, ...CATEGORIES]));
        setCategoriesList(uniqueNames);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (initialProduct) {
      setTitleBn(initialProduct.title_bn || initialProduct.name_bn || initialProduct.name || '');
      setTitleEn(initialProduct.title_en || '');
      setProductCode(initialProduct.product_code || initialProduct.code || initialProduct.sku || '');
      
      const rawCat = (initialProduct.category || initialProduct.category_bn || '').trim();
      if (rawCat) {
        setCategory(rawCat);
        setCategoriesList(prev => prev.includes(rawCat) ? prev : [rawCat, ...prev]);
      } else {
        setCategory(CATEGORIES[0]);
      }

      const fullUnit = initialProduct.unit_pack || initialProduct.unit || '';
      const parts = fullUnit.split(' ');
      const initAmount = initialProduct.unit_quantity ? String(initialProduct.unit_quantity) : (parts[0] || '১');
      const initType = initialProduct.unit_type || parts.slice(1).join(' ') || 'পিস';
      setUnitAmount(initAmount);
      setUnitType(initType);
      
      const p = initialProduct.price ? String(initialProduct.price) : '';
      setPrice(p);
      setOriginalPrice(initialProduct.original_price || initialProduct.regular_price ? String(initialProduct.original_price || initialProduct.regular_price) : '');
      
      const discP = initialProduct.discount_percent !== undefined ? String(initialProduct.discount_percent) : '';
      setDiscountPercent(discP);
      
      if (initialProduct.discount_price) {
        setDiscountPrice(String(initialProduct.discount_price));
      } else if (p && discP) {
        const calculated = Math.round(Number(p) * (1 - Number(discP) / 100));
        setDiscountPrice(calculated > 0 ? String(calculated) : '');
      }

      const existingStock = initialProduct.stock_quantity !== undefined ? initialProduct.stock_quantity : (initialProduct.stock !== undefined ? initialProduct.stock : 10);
      setStockQuantity(String(existingStock));
      setDiscountOffer(initialProduct.discount_offer || '');
      
      // Images normalization
      let imgList: string[] = [];
      if (Array.isArray(initialProduct.images) && initialProduct.images.length > 0) {
        imgList = initialProduct.images.filter(Boolean);
      } else if (Array.isArray(initialProduct.products_photos) && initialProduct.products_photos.length > 0) {
        imgList = initialProduct.products_photos.filter(Boolean);
      } else if (initialProduct.image_url) {
        imgList = [initialProduct.image_url];
      } else if (initialProduct.image) {
        imgList = [initialProduct.image];
      }
      setImages(imgList.slice(0, 10));
      
      setYoutubeUrl(initialProduct.youtube_url || '');
      setDescription(initialProduct.description || '');
    }
  }, [initialProduct]);

  // Handle Price Change with live discount sync
  const handlePriceChange = (val: string) => {
    setPrice(val);
    const p = parseFloat(val) || 0;
    const disc = parseFloat(discountPercent) || 0;
    if (disc > 0 && p > 0) {
      const dp = Math.round(p * (1 - disc / 100));
      setDiscountPrice(String(dp));
    } else {
      setDiscountPrice('');
    }
  };

  // Handle Discount Percent Change with live offer price sync
  const handleDiscountPercentChange = (val: string) => {
    const num = Math.min(99, Math.max(0, parseFloat(val) || 0));
    const strVal = val === '' ? '' : String(num);
    setDiscountPercent(strVal);
    
    const p = parseFloat(price) || 0;
    if (num > 0 && p > 0) {
      const dp = Math.round(p * (1 - num / 100));
      setDiscountPrice(String(dp));
      if (!discountOffer) {
        setDiscountOffer(`${num}% বিশেষ ছাড়`);
      }
    } else {
      setDiscountPrice('');
      if (discountOffer.includes('% বিশেষ ছাড়')) {
        setDiscountOffer('');
      }
    }
  };

  // Multiple files selection & direct Supabase Storage upload (Strictly No Base64 / No Blob)
  const handleMultipleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // 1. a) Immediately block local preview generation via FileReader/Blob.
    const fileList = Array.from(files);
    if (images.length >= 10) {
      setErrorMsg('সর্বোচ্চ ১০টি ছবি আপলোড করা যাবে।');
      return;
    }

    const availableSlots = 10 - images.length;
    const filesToUpload = fileList.slice(0, availableSlots);

    setIsUploading(true);
    setErrorMsg('');
    setSuccessMsg('');

    // 1. b) Show a visible uploading status indicator: "ছবি সুপাবেজ বাকেটে আপলোড করা হচ্ছে..."
    setUploadProgressText('ছবি সুপাবেজ বাকেটে আপলোড করা হচ্ছে...');

    const uploadedPublicUrls: string[] = [];
    let uploadFailed = false;

    for (let i = 0; i < filesToUpload.length; i++) {
      const selectedFile = filesToUpload[i];
      if (filesToUpload.length > 1) {
        setUploadProgressText(`ছবি (${i + 1}/${filesToUpload.length}) সুপাবেজ বাকেটে আপলোড করা হচ্ছে...`);
      }

      const fileExt = (selectedFile.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const cleanName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${cleanName}`;
      const filePath = `products/${uniqueSuffix}`;

      let uploadSuccess = false;
      let resolvedPublicUrl = '';
      let activeBucketUsed = 'products';

      // Step 1: Upload directly to canonical 'products' bucket
      try {
        const { data: primaryData, error: primaryError } = await supabase.storage
          .from('products')
          .upload(filePath, selectedFile, {
            cacheControl: '3600',
            upsert: true,
            contentType: selectedFile.type || 'image/jpeg'
          });

        if (!primaryError && primaryData?.path) {
          activeBucketUsed = 'products';
          // Public URL generation without throwing RLS errors
          try {
            const { data: pubData } = supabase.storage
              .from('products')
              .getPublicUrl(primaryData.path);
            if (pubData?.publicUrl) {
              resolvedPublicUrl = pubData.publicUrl;
            }
          } catch (pubErr) {
            console.warn('[Supabase Storage] products getPublicUrl safe notice:', pubErr);
          }
          if (!resolvedPublicUrl) {
            resolvedPublicUrl = `${supabaseUrl}/storage/v1/object/public/products/${primaryData.path}`;
          }
          uploadSuccess = true;
          console.log('[Supabase Storage] Successfully uploaded to "products" bucket:', resolvedPublicUrl);
        } else if (primaryError) {
          console.error('[Supabase Storage Upload Error - Bucket "products"]:', {
            bucket: 'products',
            path: filePath,
            fileName: selectedFile.name,
            fileSize: selectedFile.size,
            fileType: selectedFile.type,
            errorMessage: primaryError.message,
            errorDetails: primaryError,
            statusCode: (primaryError as any)?.statusCode || (primaryError as any)?.status,
          });
        }
      } catch (err: any) {
        console.error('[Supabase Storage Exception - Bucket "products"]:', {
          bucket: 'products',
          path: filePath,
          fileName: selectedFile.name,
          exception: err?.message || err,
          fullError: err,
        });
      }

      // Step 2: Fallback to alternative 'product-images' bucket if 'products' bucket upload failed
      if (!uploadSuccess) {
        try {
          console.warn('[Supabase Storage] Attempting fallback upload to "product-images" bucket...');
          const { data: fallbackData, error: fallbackError } = await supabase.storage
            .from('product-images')
            .upload(filePath, selectedFile, {
              cacheControl: '3600',
              upsert: true,
              contentType: selectedFile.type || 'image/jpeg'
            });

          if (!fallbackError && fallbackData?.path) {
            activeBucketUsed = 'product-images';
            try {
              const { data: pubData } = supabase.storage
                .from('product-images')
                .getPublicUrl(fallbackData.path);
              if (pubData?.publicUrl) {
                resolvedPublicUrl = pubData.publicUrl;
              }
            } catch (pubErr) {
              console.warn('[Supabase Storage] product-images getPublicUrl safe notice:', pubErr);
            }
            if (!resolvedPublicUrl) {
              resolvedPublicUrl = `${supabaseUrl}/storage/v1/object/public/product-images/${fallbackData.path}`;
            }
            uploadSuccess = true;
            console.log('[Supabase Storage] Fallback upload succeeded on "product-images":', resolvedPublicUrl);
          } else if (fallbackError) {
            console.error('[Supabase Storage Upload Error - Fallback Bucket "product-images"]:', {
              bucket: 'product-images',
              path: filePath,
              fileName: selectedFile.name,
              errorMessage: fallbackError.message,
              errorDetails: fallbackError,
              statusCode: (fallbackError as any)?.statusCode || (fallbackError as any)?.status,
            });
          }
        } catch (fbErr: any) {
          console.error('[Supabase Storage Exception - Fallback Bucket "product-images"]:', {
            bucket: 'product-images',
            path: filePath,
            fileName: selectedFile.name,
            exception: fbErr?.message || fbErr,
          });
        }
      }

      // Step 3: Server-side /api/upload fallback (bypasses browser client RLS restrictions if anon)
      if (!uploadSuccess) {
        try {
          console.warn('[Supabase Storage] Attempting server-assisted upload via /api/upload...');
          const reader = new FileReader();
          const base64Body = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(selectedFile);
          });

          const apiRes = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              data: base64Body,
              name: cleanName,
              bucket: 'products',
              contentType: selectedFile.type || 'image/jpeg'
            })
          });

          const apiData = await apiRes.json();
          if (apiData?.success && apiData?.url && !apiData.url.startsWith('data:')) {
            resolvedPublicUrl = apiData.url;
            uploadSuccess = true;
            console.log('[Supabase Storage] Server-assisted upload succeeded:', resolvedPublicUrl);
          } else {
            console.error('[Supabase Storage Server Fallback Error]:', {
              fileName: selectedFile.name,
              serverError: apiData?.error || 'Unknown server upload error',
              responseStatus: apiRes.status
            });
          }
        } catch (srvErr: any) {
          console.error('[Supabase Storage Server Fallback Exception]:', {
            fileName: selectedFile.name,
            exception: srvErr?.message || srvErr
          });
        }
      }

      if (uploadSuccess && resolvedPublicUrl) {
        uploadedPublicUrls.push(resolvedPublicUrl);
      } else {
        uploadFailed = true;
        console.error('[Supabase Storage Fatal Failure]: Could not upload product image through any channel:', {
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          fileType: selectedFile.type,
          primaryBucket: 'products',
          fallbackBucket: 'product-images'
        });
      }
    }

    if (uploadedPublicUrls.length > 0) {
      const newImagesList = Array.from(new Set([...images, ...uploadedPublicUrls])).slice(0, 10);
      setImages(newImagesList);
      
      // Set state and automatically update the input field "সরাসরি ছবি URL লিংক যুক্ত করুন" (image_url) with this EXACT publicUrl
      const primaryPublicUrl = uploadedPublicUrls[0];
      setImageUrlInput(primaryPublicUrl);
      setSuccessMsg(`সফলভাবে ${uploadedPublicUrls.length}টি ছবি 'products' স্টোরেজে আপলোড ও সরাসরি লিংক যুক্ত হয়েছে!`);
    }

    // 4. ERROR HANDLING:
    // If Supabase bucket upload fails, display an explicit toast error:
    if (uploadFailed || (filesToUpload.length > 0 && uploadedPublicUrls.length === 0)) {
      setErrorMsg('ছবি বাকেটে আপলোড ব্যর্থ হয়েছে! অনুগ্রহ করে কনসোল লগ ও Supabase Storage Bucket পারমিশন পরীক্ষা করুন।');
    }

    setIsUploading(false);
    setUploadProgressText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Add image by direct URL
  const handleAddImageUrl = () => {
    if (!imageUrlInput.trim()) return;
    if (images.length >= 10) {
      setErrorMsg('সর্বোচ্চ ১০টি ছবি যুক্ত করা যাবে।');
      return;
    }
    setImages(prev => [...prev, imageUrlInput.trim()].slice(0, 10));
    setImageUrlInput('');
    setSuccessMsg('ছবির লিংক যুক্ত করা হয়েছে!');
  };

  // Remove an image from gallery
  const handleRemoveImage = (indexToRemove: number) => {
    setImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Set image as primary (move to index 0)
  const handleSetPrimaryImage = (indexToPrimary: number) => {
    setImages(prev => {
      const selected = prev[indexToPrimary];
      const others = prev.filter((_, idx) => idx !== indexToPrimary);
      return [selected, ...others];
    });
  };

  // পাবলিশ / সাবমিট হ্যান্ডলার (সরাসরি Supabase-এ ডাটা আপডেট/ইনসার্ট করা)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If images array is empty but user has an auto-populated/entered URL in direct image input
    let finalImages = [...images];
    if (finalImages.length === 0 && imageUrlInput.trim()) {
      finalImages = [imageUrlInput.trim()];
      setImages(finalImages);
    }

    // 3. STRICT VALIDATION: Verify that NO Base64 or Blob strings are allowed into the database under any condition
    const hasBase64OrBlob = finalImages.some(img => 
      !img || 
      img.startsWith('data:') || 
      img.startsWith('blob:')
    );

    if (hasBase64OrBlob) {
      setErrorMsg('সতর্কতা: Base64 বা Blob ফরম্যাটের ছবি ডাটাবেজে সংরক্ষণ করা যাবে না। শুধুমাত্র সুপাবেজ স্টোরেজের পাবলিক URL গ্রহণযোগ্য।');
      return;
    }

    // Filter to ensure only valid public URLs are saved
    finalImages = finalImages.filter(img => typeof img === 'string' && (img.startsWith('http://') || img.startsWith('https://')));

    if (finalImages.length === 0) {
      setErrorMsg('কমপক্ষে একটি ছবি আপলোড অথবা বৈধ সুপাবেজ স্টোরেজ পাবলিক URL লিংক যোগ করুন (সর্বোচ্চ ৮-১০টি)।');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    
    const stockNum = parseInt(stockQuantity, 10);
    const validStock = !isNaN(stockNum) && stockNum >= 0 ? stockNum : 0;
    // If stock_quantity > 0, automatically update status to "In Stock"
    const statusVal = validStock > 0 ? 'In Stock' : 'Out of Stock';

    const finalPrice = parseFloat(price) || 0;
    const finalOriginalPrice = parseFloat(originalPrice) || finalPrice;
    const finalDiscountPercent = parseFloat(discountPercent) || 0;
    const finalDiscountPrice = parseFloat(discountPrice) || (finalDiscountPercent > 0 ? Math.round(finalPrice * (1 - finalDiscountPercent / 100)) : 0);
    const primaryImage = finalImages[0] || '';

    const autoOfferPrice = finalDiscountPercent > 0 
      ? Math.round(finalPrice - (finalPrice * (finalDiscountPercent / 100))) 
      : (finalDiscountPrice > 0 ? finalDiscountPrice : finalPrice);

    const productPayload = {
      // 1. Exact Column Mapping
      name: titleBn.trim() || titleEn.trim(),
      category,
      price: finalPrice,
      discount_percent: finalDiscountPercent,
      offer_price: autoOfferPrice,
      stock_quantity: validStock,
      stock: validStock,
      unit_quantity: unitAmount.trim() || '১',
      unit_type: unitType.trim() || 'পিস',
      unit: `${unitAmount.trim()} ${unitType.trim()}`.trim(),
      unit_pack: `${unitAmount.trim()} ${unitType.trim()}`.trim(),
      product_code: productCode.trim(),
      sku: productCode.trim(),
      origin: 'পার্বত্য চট্টগ্রাম',
      quality_grade: '১০০% বিশুদ্ধ ও পরীক্ষিত',
      supplier_name: 'ঝাদিমাদি ভেরিফাইড মার্চেন্ট নেটওয়ার্ক',
      images: finalImages,
      image_url: primaryImage,
      youtube_url: youtubeUrl.trim(),
      description: description.trim(),

      // Compatibility properties
      title_bn: titleBn.trim(),
      title_en: titleEn.trim(),
      name_bn: titleBn.trim(),
      code: productCode.trim(),
      category_bn: category,
      original_price: finalOriginalPrice,
      regular_price: finalOriginalPrice,
      discount_price: autoOfferPrice,
      status: statusVal,
      stock_status: validStock > 0 ? 'in_stock' : 'out_of_stock',
      discount_offer: discountOffer.trim() || (finalDiscountPercent > 0 ? `${finalDiscountPercent}% ছাড়` : ''),
      image: primaryImage,
      products_photos: finalImages,
      description_bn: description.trim(),
      is_active: true,
      is_published: true,
    };

    try {
      if (initialProduct?.id && initialProduct.id !== 'new') {
        // আপডেট প্রোডাক্ট
        const { error } = await supabase
          .from('products')
          .update(productPayload)
          .eq('id', initialProduct.id);

        if (error) throw error;
        setSuccessMsg(`পণ্য সফলভাবে আপডেট করা হয়েছে! (ছবি: ${images.length}টি, স্ট্যাটাস: ${statusVal})`);
      } else {
        // নতুন প্রোডাক্ট ইনসার্ট: execute supabase.from('products').insert([productPayload])
        const { data, error } = await supabase
          .from('products')
          .insert([productPayload]);

        if (error) {
          console.error("Supabase Product Insert Error:", error.message);
          const smartRes = await smartSupabaseInsert('products', productPayload);
          if (!smartRes.success) throw smartRes.error || error;
        }

        setSuccessMsg('পণ্য সফলভাবে যুক্ত হয়েছে!');
        
        // ফর্ম রিসেট
        setTitleBn('');
        setTitleEn('');
        setProductCode('');
        setPrice('');
        setOriginalPrice('');
        setDiscountPercent('');
        setDiscountPrice('');
        setStockQuantity('10');
        setDiscountOffer('');
        setImages([]);
        setImageUrlInput('');
        setYoutubeUrl('');
        setDescription('');
      }

      try {
        databaseService.notifyEntityChange('products');
        await databaseService.fetchProductsFromSupabase();
      } catch (_) {}

      if (onSubmit) onSubmit(productPayload);
      if (onSuccess) onSuccess(productPayload);
    } catch (err: any) {
      console.error('Error saving product:', err);
      setErrorMsg('পণ্য সংরক্ষণ করতে সমস্যা হয়েছে: ' + (err.message || 'অজানা এরর'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-2xl shadow-sm border border-neutral-200 my-4 text-black font-sans">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b pb-4">
        <div>
          <h2 className="text-lg font-bold text-neutral-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            {initialProduct?.id && initialProduct.id !== 'new' ? 'পণ্য আপডেট করুন' : 'নতুন পণ্য রেজিস্ট্রেশন ফর্ম'}
          </h2>
          <p className="text-xs text-neutral-500 mt-1">৮-১০টি ছবি ও ডিসকাউন্ট পার্সেন্টেজসহ পণ্যের তথ্য পূরণ করুন।</p>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="পণ্য বা কোড খুঁজুন..."
            className="w-full pl-9 pr-3 py-1.5 bg-neutral-50 border border-neutral-300 rounded-lg text-xs text-black placeholder-neutral-400 focus:outline-none focus:border-black transition"
          />
        </div>
      </div>

      {/* ফিডব্যাক মেসেজ */}
      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-emerald-800 text-xs font-bold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg('')} className="text-emerald-600 hover:text-emerald-900 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded-xl flex items-center justify-between text-red-800 text-xs font-bold">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg('')} className="text-red-600 hover:text-red-900 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col space-y-5">
        
        {/* ১. পণ্যের বাংলা নাম */}
        <div>
          <label className="block text-base font-semibold text-neutral-800 mb-1.5 flex items-center gap-1.5">
            <Tag className="w-4 h-4 text-emerald-600" />
            <span>১. পণ্যের বাংলা নাম</span> <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={titleBn}
            onChange={(e) => setTitleBn(e.target.value)}
            placeholder="যেমন: প্রিমিয়াম পাহাড়ী মধু"
            className="w-full h-12 px-4 bg-white border border-gray-300 rounded-lg text-base text-black placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
          />
        </div>

        {/* ২. পণ্যের ইংরেজি নাম */}
        <div>
          <label className="block text-base font-semibold text-neutral-800 mb-1.5 flex items-center gap-1.5">
            <Tag className="w-4 h-4 text-emerald-600" />
            <span>২. পণ্যের ইংরেজি নাম (English Name)</span>
          </label>
          <input
            type="text"
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
            placeholder="Ex: Premium Organic Honey"
            className="w-full h-12 px-4 bg-white border border-gray-300 rounded-lg text-base text-black placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
          />
        </div>

        {/* ৩. প্রোডাক্ট কোড / SKU */}
        <div>
          <label className="block text-base font-semibold text-neutral-800 mb-1.5 flex items-center gap-1.5">
            <Barcode className="w-4 h-4 text-emerald-600" />
            <span>৩. প্রোডাক্ট কোড / SKU</span>
          </label>
          <input
            type="text"
            value={productCode}
            onChange={(e) => setProductCode(e.target.value)}
            placeholder="যেমন: HON-101"
            className="w-full h-12 px-4 bg-white border border-gray-300 rounded-lg text-base text-black placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
          />
        </div>

        {/* ৪. ক্যাটাগরি */}
        <div>
          <label className="block text-base font-semibold text-neutral-800 mb-1.5 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>৪. ক্যাটাগরি</span> <span className="text-red-500">*</span>
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full h-12 px-4 bg-white border border-gray-300 rounded-lg text-base text-gray-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition cursor-pointer"
          >
            {categoriesList.map((cat, index) => (
              <option key={index} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* ৫. পরিমাণ / সাইজ ও একক (Unit & Quantity) */}
        <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 space-y-3">
          <label className="block text-base font-semibold text-neutral-800 flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-emerald-600" />
            <span>৫. পরিমাণ / সাইজ ও একক</span> <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                একক টাইপ (Unit Type)
              </label>
              <select
                value={unitType}
                onChange={(e) => {
                  const val = e.target.value;
                  setUnitType(val);
                  if (val === 'গ্রাম' && (!unitAmount || unitAmount === '১')) {
                    setUnitAmount('250');
                  } else if (val !== 'গ্রাম' && unitAmount === '250') {
                    setUnitAmount('১');
                  }
                }}
                className="w-full h-11 px-3 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-emerald-500 transition cursor-pointer"
              >
                <option value="গ্রাম">গ্রাম (ওজন ভিত্তিক: ২৫০ গ্রাম, ৫০০ গ্রাম, ৭৫০ গ্রাম, ১ কেজি...)</option>
                <option value="কেজি">কেজি (১ কেজি, ২ কেজি...)</option>
                <option value="লিটার">লিটার (১ লিটার, ২ লিটার...)</option>
                <option value="প্যাকেট">প্যাকেট (১ প্যাকেট, ২ প্যাকেট...)</option>
                <option value="পিস">পিস (১ পিস, ২ পিস...)</option>
                <option value="টি">টি (১টি, ২টি, ৩টি...)</option>
                <option value="মিলি">মিলি (ml)</option>
                <option value="জোড়া">জোড়া</option>
                <option value="বস্তা">বস্তা</option>
                <option value="ডজন">ডজন</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                পরিমাণ / সাইজ (সংখ্যা)
              </label>
              <input
                type="text"
                value={unitAmount}
                onChange={(e) => setUnitAmount(e.target.value)}
                placeholder="যেমন: 250 বা 1"
                className="w-full h-11 px-3 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-800 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>
          <p className="text-xs text-emerald-800 font-medium bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
            প্রদর্শিত হবে: <strong className="text-emerald-900 font-bold">{unitAmount} {unitType}</strong>
            {unitType === 'গ্রাম' && ' (কার্টে গ্রাহক ২৫০ গ্রাম, ৫০০ গ্রাম, ৭৫০ গ্রাম, ১ কেজি ইত্যাদি ধাপে কিনতে পারবেন)'}
          </p>
        </div>

        {/* ৬. স্টক পরিমাণ */}
        <div>
          <label className="block text-base font-semibold text-neutral-800 mb-1.5 flex items-center gap-1.5">
            <Box className="w-4 h-4 text-emerald-600" />
            <span>৫. স্টক পরিমাণ (Stock)</span> <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="0"
            required
            value={stockQuantity}
            onChange={(e) => setStockQuantity(e.target.value)}
            placeholder="যেমন: 50"
            className="w-full h-12 px-4 bg-white border border-gray-300 rounded-lg text-base text-black placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
          />
        </div>

        {/* ৬. বিক্রয় মূল্য */}
        <div>
          <label className="block text-base font-semibold text-neutral-800 mb-1.5 flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <span>৬. বিক্রয় মূল্য ৳</span> <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-gray-500">৳</span>
            <input
              type="number"
              min="0"
              required
              value={price}
              onChange={(e) => handlePriceChange(e.target.value)}
              placeholder="৳ 0.00"
              className="w-full h-12 pl-9 pr-4 bg-white border border-gray-300 rounded-lg text-base font-bold text-black placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
            />
          </div>
        </div>

        {/* ৭. ছাড় % */}
        <div>
          <label className="block text-base font-semibold text-neutral-800 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Percent className="w-4 h-4 text-emerald-600" />
              ৭. ছাড় % (Discount %)
            </span>
            {Number(discountPercent) > 0 && (
              <span className="text-xs text-emerald-600 font-extrabold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                {discountPercent}% ছাড়
              </span>
            )}
          </label>
          <div className="relative">
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-base font-bold text-emerald-600">%</span>
            <input
              type="number"
              min="0"
              max="99"
              value={discountPercent}
              onChange={(e) => handleDiscountPercentChange(e.target.value)}
              placeholder="যেমন: 15"
              className="w-full h-12 px-4 pr-10 bg-white border border-gray-300 rounded-lg text-base font-bold text-emerald-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
            />
          </div>
        </div>

        {/* ৮. অফার মূল্য */}
        <div>
          <label className="block text-base font-semibold text-neutral-800 mb-1.5 flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <span>৮. অফার মূল্য ৳ (Offer Price)</span>
          </label>
          <input
            type="number"
            min="0"
            value={discountPrice}
            onChange={(e) => setDiscountPrice(e.target.value)}
            placeholder="স্বয়ংক্রিয় হিসেব"
            className="w-full h-12 px-4 bg-white border border-gray-300 rounded-lg text-base font-bold text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
          />
        </div>

        {/* ৯. অফার ব্যানার টেক্সট */}
        <div>
          <label className="block text-base font-semibold text-neutral-800 mb-1.5 flex items-center gap-1.5">
            <Tag className="w-4 h-4 text-emerald-600" />
            <span>৯. অফার ব্যানার টেক্সট</span>
          </label>
          <input
            type="text"
            value={discountOffer}
            onChange={(e) => setDiscountOffer(e.target.value)}
            placeholder="যেমন: ঈদ ধামাকা অফার"
            className="w-full h-12 px-4 bg-white border border-gray-300 rounded-lg text-base text-black placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
          />
        </div>

        {/* ১০. মাল্টিপল ছবি আপলোড (৮-১০টি ছবি) ও গ্যালারি ম্যানেজমেন্ট */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <label className="text-base font-semibold text-neutral-800 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-emerald-600" />
              <span>১০. মাল্টিপল ছবি আপলোড (৮-১০টি ছবি)</span> <span className="text-red-500">*</span>
            </label>
            <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-bold">
              যুক্ত হয়েছে: {images.length}/১০টি
            </span>
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleMultipleImageUpload}
            className="hidden"
          />

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              disabled={isUploading || images.length >= 10}
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-12 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 text-white rounded-lg text-base font-bold shadow-xs transition cursor-pointer flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                  <span>{uploadProgressText || 'আপলোড হচ্ছে...'}</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  <span>ডিভাইস থেকে একাধিক ছবি যোগ করুন (৮-১০টি)</span>
                </>
              )}
            </button>

            {/* Direct URL Input fallback: সরাসরি ছবি URL লিংক যুক্ত করুন */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-neutral-800 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-emerald-600" />
                  <span>সরাসরি ছবি URL লিংক যুক্ত করুন</span>
                </label>
                {imageUrlInput && (
                  <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-mono">
                    স্বয়ংক্রিয়ভাবে যুক্ত লিংক
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="https://dwhsqftllkximhfvwqak.supabase.co/storage/v1/object/public/products/..."
                  className="flex-1 h-12 px-4 bg-white border border-gray-300 rounded-lg text-sm text-black placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition font-mono"
                />
                <button
                  type="button"
                  onClick={handleAddImageUrl}
                  disabled={!imageUrlInput.trim() || images.length >= 10}
                  className="h-12 px-5 bg-neutral-800 hover:bg-black text-white disabled:opacity-50 text-sm font-bold rounded-lg transition shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>যোগ করুন</span>
                </button>
              </div>
            </div>
          </div>

          {/* Image Previews Grid */}
          {images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 pt-2">
              {images.map((imgUrl, idx) => (
                <div 
                  key={idx}
                  className={`relative group rounded-xl overflow-hidden border-2 aspect-square bg-neutral-100 flex items-center justify-center ${
                    idx === 0 ? 'border-emerald-500 shadow-md ring-2 ring-emerald-500/20' : 'border-neutral-200'
                  }`}
                >
                  <img src={imgUrl} alt={`Product ${idx + 1}`} className="w-full h-full object-cover" />

                  {/* Primary Badge */}
                  {idx === 0 ? (
                    <span className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded-md shadow-xs flex items-center gap-1">
                      <Star className="w-2.5 h-2.5 fill-white" /> মূল ছবি
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSetPrimaryImage(idx)}
                      title="মূল ছবি বানান"
                      className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 px-1.5 py-0.5 bg-black/60 hover:bg-black/80 text-white text-[10px] rounded transition cursor-pointer"
                    >
                      মূল ছবি করুন
                    </button>
                  )}

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    title="ছবি মুছে ফেলুন"
                    className="absolute top-1.5 right-1.5 p-1 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow transition cursor-pointer opacity-90 hover:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/50 text-white text-[9px] font-mono rounded">
                    #{idx + 1}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ১১. ইউটিউব ভিডিও লিংক */}
        <div>
          <label className="block text-base font-semibold text-neutral-800 mb-1.5 flex items-center gap-1.5">
            <Video className="w-4 h-4 text-red-500" />
            <span>১১. ইউটিউব ভিডিও লিংক (YouTube URL)</span>
          </label>
          <input
            type="url"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full h-12 px-4 bg-white border border-gray-300 rounded-lg text-base text-black placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
          />
        </div>

        {/* ১২. বিবরণ */}
        <div>
          <label className="block text-base font-semibold text-neutral-800 mb-1.5 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-emerald-600" />
            <span>১২. পণ্যের বিস্তারিত বিবরণ (Description)</span>
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="পণ্যের উপাদান, ব্যবহারের নিয়ম বা বিশেষ বৈশিষ্ট্য লিখুন..."
            className="w-full p-4 bg-white border border-gray-300 rounded-lg text-base text-black placeholder-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition resize-y min-h-[110px]"
          />
        </div>

        {/* হাই ভিজিবিলিটি জিরো ট্রান্সপারেন্সি স্টিকি বটম বাটন */}
        <div className="sticky bottom-0 bg-white py-4 px-4 sm:px-6 border-t border-gray-200 z-20 flex items-center justify-end gap-3 shadow-md mt-6 rounded-b-2xl">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="border border-gray-300 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-bold text-sm transition cursor-pointer shadow-xs active:scale-95"
            >
              বাতিল
            </button>
          )}

          <button
            type="submit"
            disabled={isSubmitting || isUploading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2 rounded-lg shadow cursor-pointer flex items-center justify-center gap-2 transition disabled:opacity-50 active:scale-95"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-white" />
                <span>সংরক্ষণ করা হচ্ছে...</span>
              </>
            ) : (
              <>
                <span>{initialProduct?.id && initialProduct.id !== 'new' ? 'পরিবর্তন সংরক্ষণ করুন' : 'পণ্য সংরক্ষণ করুন / পোস্ট করুন'}</span>
                <ArrowRight className="w-5 h-5 text-white" />
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
};

export default ModernAddProductForm;
