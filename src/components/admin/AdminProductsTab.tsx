import React, { useState, useEffect, useRef } from 'react';
import { 
  Package, Plus, Search, Edit3, Trash2, X, UploadCloud, 
  Image as ImageIcon, Check, Loader2, Scale, Tag, ChevronRight, ChevronLeft, 
  Database, AlertCircle, Star, Video, Link2, Percent, CheckCircle2, 
  ShieldCheck, MapPin, Building, ArrowUpDown, RefreshCw, Save, Layers
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { StoreProduct } from '../../data/productsData';
import { SupabaseMediaPickerModal } from './SupabaseMediaPickerModal';
import { supabaseMediaService } from '../../services/supabaseMediaService';
import { supabase, supabaseUrl } from '../../supabase';
import { resilientSupabaseDelete } from '../../services/supabaseDbHelper';
import { prepareProductPayload, smartSupabaseInsert } from '../../utils/supabaseDataService';
import { databaseService, ALL_27_PRODUCT_CATEGORIES } from '../../services/databaseService';
import { formatProductQuantityDisplay, getProductUnitSuffix, getProductUnitKind } from '../../utils/productQuantitySteps';

interface AdminProductsTabProps {
  onShowToast: (msg: string) => void;
  onPreviewProduct?: (prod: StoreProduct) => void;
  initialImageUrl?: string;
  onClearInitialImage?: () => void;
}

// Categories list matching Supabase schema
export const PRODUCT_CATEGORIES = ALL_27_PRODUCT_CATEGORIES;

export const getCategoryLabel = (catValue: string): string => {
  if (!catValue) return 'ফুড ও খাবার';
  const found = PRODUCT_CATEGORIES.find(c => c.value === catValue || c.labelBn === catValue);
  if (found) return found.labelBn;
  return catValue;
};

export const generateNextProductCode = (allProducts: StoreProduct[]): string => {
  let highestNum = 0;
  for (const p of allProducts) {
    if (p.code) {
      const match = p.code.match(/\d+/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (!isNaN(num) && num > highestNum) {
          highestNum = num;
        }
      }
    }
  }
  const nextNum = highestNum > 0 ? highestNum + 1 : (allProducts.length + 1);
  return String(nextNum).padStart(3, '0');
};

export const AdminProductsTab: React.FC<AdminProductsTabProps> = ({ 
  onShowToast,
  onPreviewProduct,
  initialImageUrl,
  onClearInitialImage
}) => {
  const { 
    products, 
    addProduct, 
    updateProduct, 
    deleteProduct, 
    toggleProductPublishStatus,
    setActiveDraftPreview,
    refreshProducts
  } = useData();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);

  // Inline Quick Edit state for table rows
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlinePrice, setInlinePrice] = useState<number>(0);
  const [inlineStock, setInlineStock] = useState<number>(0);
  const [inlineSaving, setInlineSaving] = useState<boolean>(false);

  // Categories state dynamically loaded from Supabase categories table
  const [categoriesList, setCategoriesList] = useState<{ value: string; labelBn: string }[]>(PRODUCT_CATEGORIES);

  useEffect(() => {
    let isMounted = true;
    databaseService.fetchCategoriesFromDatabase().then(cats => {
      if (isMounted && Array.isArray(cats) && cats.length > 0) {
        const mapped = cats.map(c => ({
          value: c.nameEn || c.id || c.nameBn,
          labelBn: c.nameBn || c.nameEn
        }));
        const existingBns = new Set(mapped.map(m => m.labelBn.trim()));
        for (const base of PRODUCT_CATEGORIES) {
          if (!existingBns.has(base.labelBn.trim())) {
            mapped.push(base);
          }
        }
        setCategoriesList(mapped);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  // Form media inputs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef<boolean>(false);
  const isUploadingRef = useRef<boolean>(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [directImageUrlInput, setDirectImageUrlInput] = useState<string>('');

  // Quantity inputs
  const [quantityNum, setQuantityNum] = useState<string>('250');
  const [quantityUnit, setQuantityUnit] = useState<string>('গ্রাম (g)');

  // Main Product Form State
  const [productForm, setProductForm] = useState<{
    code: string;
    sku: string;
    title_bn: string;
    badge: string;
    category: string;
    categoryLabelBn: string;
    price: number;
    discount_percent: number;
    discount_price: number;
    originalPrice: number;
    unit_pack: string;
    stock_quantity: number;
    origin: string;
    supplier_name: string;
    quality_standard: string;
    image: string;
    images: string[];
    youtube_url: string;
    descriptionBn: string;
  }>({
    code: '001',
    sku: 'JDM-001',
    title_bn: '',
    badge: '',
    category: 'Food',
    categoryLabelBn: 'ফুড ও খাবার',
    price: 0,
    discount_percent: 0,
    discount_price: 0,
    originalPrice: 0,
    unit_pack: '২৫০ গ্রাম',
    stock_quantity: 50,
    origin: 'পার্বত্য চট্টগ্রাম',
    supplier_name: 'ঝাদিমাদি ভেরিফাইড মার্চেন্ট নেটওয়ার্ক',
    quality_standard: '১০০% বিশুদ্ধ ও পরীক্ষিত',
    image: '',
    images: [],
    youtube_url: '',
    descriptionBn: ''
  });

  useEffect(() => {
    if (initialImageUrl && initialImageUrl.trim()) {
      startNewProduct();
      setProductForm(prev => ({
        ...prev,
        image: initialImageUrl.trim(),
        images: [initialImageUrl.trim()]
      }));
      if (onClearInitialImage) {
        onClearInitialImage();
      }
    }
  }, [initialImageUrl]);

  const startNewProduct = (categoryKey?: string) => {
    setEditingProduct(null);
    const nextCode = generateNextProductCode(products);
    const cat = categoryKey || 'Food';
    const catLabel = getCategoryLabel(cat);

    setQuantityNum('১');
    setQuantityUnit('পিস (Pcs)');
    setDirectImageUrlInput('');

    setProductForm({
      code: nextCode,
      sku: `JDM-${nextCode}`,
      title_bn: '',
      badge: '',
      category: cat,
      categoryLabelBn: catLabel,
      price: 0,
      discount_percent: 0,
      discount_price: 0,
      originalPrice: 0,
      unit_pack: '১ পিস',
      stock_quantity: 50,
      origin: 'পার্বত্য চট্টগ্রাম',
      supplier_name: 'ঝাদিমাদি ভেরিফাইড মার্চেন্ট নেটওয়ার্ক',
      quality_standard: '১০০% বিশুদ্ধ ও পরীক্ষিত',
      image: '',
      images: [],
      youtube_url: '',
      descriptionBn: ''
    });
    setUploadError(null);
    setIsCreating(true);
  };

  const startEditProduct = (prod: StoreProduct) => {
    setEditingProduct(prod);
    const prodIndex = products.findIndex(p => p.id === prod.id);
    const currentCode = prod.code || (prodIndex >= 0 ? String(prodIndex + 1).padStart(3, '0') : '001');

    const existingImages = Array.isArray(prod.images) && prod.images.length > 0 
      ? prod.images.filter(Boolean)
      : (prod.image ? [prod.image] : []);

    const fullUnit = prod.unit_pack || prod.unit || '১ পিস';
    const parts = fullUnit.split(' ');
    setQuantityNum(parts[0] || '১');
    setQuantityUnit(parts.slice(1).join(' ') || 'পিস (Pcs)');

    const regularPrice = prod.originalPrice || prod.price || 0;
    const discountedPrice = prod.discount_price ?? prod.discountPrice ?? 0;
    let discPercent = 0;
    if (regularPrice > 0 && discountedPrice > 0 && discountedPrice < regularPrice) {
      discPercent = Math.round(((regularPrice - discountedPrice) / regularPrice) * 100);
    }

    setDirectImageUrlInput('');
    setProductForm({
      code: currentCode,
      sku: prod.sku || prod.code || `JDM-${currentCode}`,
      title_bn: prod.nameBn || prod.title_bn || '',
      badge: prod.badge || (prod as any).badge || '',
      category: prod.category || 'Food',
      categoryLabelBn: prod.categoryLabelBn || getCategoryLabel(prod.category || 'Food'),
      price: regularPrice,
      discount_percent: discPercent,
      discount_price: discountedPrice,
      originalPrice: regularPrice,
      unit_pack: fullUnit,
      stock_quantity: prod.stock_quantity ?? prod.stock ?? 0,
      origin: prod.origin || 'পার্বত্য চট্টগ্রাম',
      supplier_name: prod.sellerName || (prod as any).seller_name || 'ঝাদিমাদি ভেরিফাইড মার্চেন্ট নেটওয়ার্ক',
      quality_standard: prod.quality_standard || (prod as any).qualityStandard || '১০০% বিশুদ্ধ ও পরীক্ষিত',
      image: prod.image || (existingImages[0] || ''),
      images: existingImages,
      youtube_url: prod.youtubeUrl || prod.videoUrl || (prod as any).youtube_url || '',
      descriptionBn: prod.descriptionBn || prod.description || ''
    });
    setUploadError(null);
    setIsCreating(true);
  };

  const cancelForm = () => {
    setIsCreating(false);
    setEditingProduct(null);
    setUploadError(null);
    setDirectImageUrlInput('');
    const nextCode = generateNextProductCode(products);
    setQuantityNum('১');
    setQuantityUnit('পিস (Pcs)');
    setProductForm({
      code: nextCode,
      sku: `JDM-${nextCode}`,
      title_bn: '',
      badge: '',
      category: 'Food',
      categoryLabelBn: getCategoryLabel('Food'),
      price: 0,
      discount_percent: 0,
      discount_price: 0,
      originalPrice: 0,
      unit_pack: '১ পিস',
      stock_quantity: 50,
      origin: 'পার্বত্য চট্টগ্রাম',
      supplier_name: 'ঝাদিমাদি ভেরিফাইড মার্চেন্ট নেটওয়ার্ক',
      quality_standard: '১০০% বিশুদ্ধ ও পরীক্ষিত',
      image: '',
      images: [],
      youtube_url: '',
      descriptionBn: ''
    });
  };

  // Multiple product images upload handler (Up to 10 photos directly to Supabase storage)
  const handleFilesSelected = async (files: FileList | File[]) => {
    if (isUploadingRef.current || isUploadingImages) return;
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const currentCount = productForm.images.length;
    if (currentCount >= 10) {
      onShowToast('⚠️ সর্বোচ্চ ১০টি ছবি যোগ করা যাবে। নতুন ছবি যোগ করতে পূর্বের ছবি মুছুন।');
      return;
    }

    const availableSlots = 10 - currentCount;
    const filesToUpload = fileArray.slice(0, availableSlots);

    isUploadingRef.current = true;
    setIsUploadingImages(true);
    setUploadError(null);

    onShowToast('ছবি সুপাবেজ বাকেটে আপলোড করা হচ্ছে...');

    const processedUrls: string[] = [];
    let uploadFailed = false;

    for (let idx = 0; idx < filesToUpload.length; idx++) {
      const file = filesToUpload[idx];
      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${cleanName}`;
      const filePath = `products/${uniqueSuffix}`;

      let uploadSuccess = false;
      let resolvedPublicUrl = '';

      // 1. Direct upload to primary 'products' bucket
      try {
        const { data: primaryData, error: primaryError } = await supabase.storage
          .from('products')
          .upload(filePath, file, { cacheControl: '3600', upsert: true, contentType: file.type || 'image/jpeg' });

        if (!primaryError && primaryData?.path) {
          try {
            const { data: pubData } = supabase.storage.from('products').getPublicUrl(primaryData.path);
            if (pubData?.publicUrl) resolvedPublicUrl = pubData.publicUrl;
          } catch (pErr) {
            console.warn('[AdminProductsTab] products getPublicUrl safe notice:', pErr);
          }
          if (!resolvedPublicUrl) {
            resolvedPublicUrl = `${supabaseUrl}/storage/v1/object/public/products/${primaryData.path}`;
          }
          uploadSuccess = true;
        } else if (primaryError) {
          console.error('[AdminProductsTab Storage Error - Bucket "products"]:', {
            bucket: 'products',
            path: filePath,
            fileName: file.name,
            errorMessage: primaryError.message,
            errorDetails: primaryError,
            statusCode: (primaryError as any)?.statusCode || (primaryError as any)?.status,
          });
        }
      } catch (err: any) {
        console.error('[AdminProductsTab Storage Exception - Bucket "products"]:', {
          bucket: 'products',
          path: filePath,
          fileName: file.name,
          exception: err?.message || err,
        });
      }

      // 2. Fallback to 'product-images' bucket
      if (!uploadSuccess) {
        try {
          console.warn('[AdminProductsTab] Retrying upload with fallback bucket "product-images"...');
          const { data: fallbackData, error: fallbackError } = await supabase.storage
            .from('product-images')
            .upload(filePath, file, { cacheControl: '3600', upsert: true, contentType: file.type || 'image/jpeg' });

          if (!fallbackError && fallbackData?.path) {
            try {
              const { data: pubData } = supabase.storage.from('product-images').getPublicUrl(fallbackData.path);
              if (pubData?.publicUrl) resolvedPublicUrl = pubData.publicUrl;
            } catch (pErr) {
              console.warn('[AdminProductsTab] product-images getPublicUrl safe notice:', pErr);
            }
            if (!resolvedPublicUrl) {
              resolvedPublicUrl = `${supabaseUrl}/storage/v1/object/public/product-images/${fallbackData.path}`;
            }
            uploadSuccess = true;
          } else if (fallbackError) {
            console.error('[AdminProductsTab Storage Error - Fallback "product-images"]:', {
              bucket: 'product-images',
              path: filePath,
              fileName: file.name,
              errorMessage: fallbackError.message,
              errorDetails: fallbackError,
            });
          }
        } catch (fbErr: any) {
          console.error('[AdminProductsTab Storage Exception - Fallback "product-images"]:', fbErr);
        }
      }

      // 3. Fallback to /api/upload
      if (!uploadSuccess) {
        try {
          console.warn('[AdminProductsTab] Attempting server-assisted upload via /api/upload...');
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
            console.error('[AdminProductsTab Server Fallback Error]:', apiData?.error);
          }
        } catch (srvErr) {
          console.error('[AdminProductsTab Server Fallback Exception]:', srvErr);
        }
      }

      if (uploadSuccess && resolvedPublicUrl) {
        processedUrls.push(resolvedPublicUrl);
      } else {
        uploadFailed = true;
        console.error('[AdminProductsTab Storage Fatal Failure]: Could not upload product image:', {
          fileName: file.name,
          fileSize: file.size,
          primaryBucket: 'products',
          fallbackBucket: 'product-images'
        });
      }
    }

    if (processedUrls.length > 0) {
      setProductForm(prev => {
        const updatedList = Array.from(new Set([...prev.images, ...processedUrls])).slice(0, 10);
        return {
          ...prev,
          images: updatedList,
          image: prev.image && updatedList.includes(prev.image) ? prev.image : updatedList[0]
        };
      });
      setDirectImageUrlInput(processedUrls[0]);
      onShowToast(`⚡ ${processedUrls.length}টি ছবি 'products' বাকেটে সফলভাবে আপলোড হয়েছে!`);
    }

    if (uploadFailed || (filesToUpload.length > 0 && processedUrls.length === 0)) {
      const explicitErrorToast = 'ছবি বাকেটে আপলোড ব্যর্থ হয়েছে! অনুগ্রহ করে Supabase Storage Bucket পারমিশন পরীক্ষা করুন।';
      setUploadError(explicitErrorToast);
      onShowToast(`❌ ${explicitErrorToast}`);
    }

    isUploadingRef.current = false;
    setIsUploadingImages(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddDirectImageUrl = () => {
    const url = directImageUrlInput.trim();
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      onShowToast('❌ সঠিক ইমেজ URL প্রদান করুন (http:// বা https:// দিয়ে শুরু হতে হবে)');
      return;
    }
    if (productForm.images.length >= 10) {
      onShowToast('⚠️ সর্বোচ্চ ১০টি ছবি যোগ করা যাবে।');
      return;
    }
    setProductForm(prev => {
      const updatedList = [...prev.images, url].slice(0, 10);
      return {
        ...prev,
        images: updatedList,
        image: prev.image || updatedList[0]
      };
    });
    setDirectImageUrlInput('');
    onShowToast('✅ ইমেজ URL গ্যালারিতে যোগ করা হয়েছে!');
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setProductForm(prev => {
      const updatedList = prev.images.filter((_, idx) => idx !== indexToRemove);
      const isRemovingPrimary = prev.image === prev.images[indexToRemove];
      return {
        ...prev,
        images: updatedList,
        image: isRemovingPrimary ? (updatedList[0] || '') : prev.image
      };
    });
  };

  const handleSetPrimaryImage = (imgUrl: string) => {
    setProductForm(prev => ({
      ...prev,
      image: imgUrl
    }));
    onShowToast('★ মূল ছবি হিসেবে নির্ধারণ করা হয়েছে!');
  };

  // Price calculation handlers
  const handlePriceChange = (val: number) => {
    const newPrice = Math.max(0, val);
    let newDiscountPrice = productForm.discount_price;
    if (productForm.discount_percent > 0) {
      newDiscountPrice = Math.round(newPrice * (1 - productForm.discount_percent / 100));
    }
    setProductForm(prev => ({
      ...prev,
      price: newPrice,
      originalPrice: newPrice,
      discount_price: newDiscountPrice
    }));
  };

  const handleDiscountPercentChange = (percent: number) => {
    const clampedPercent = Math.min(99, Math.max(0, percent));
    const newDiscountPrice = clampedPercent > 0 
      ? Math.round(productForm.price * (1 - clampedPercent / 100)) 
      : 0;
    setProductForm(prev => ({
      ...prev,
      discount_percent: clampedPercent,
      discount_price: newDiscountPrice
    }));
  };

  const handleDiscountPriceChange = (discPrice: number) => {
    const clampedDiscPrice = Math.max(0, discPrice);
    let calcPercent = 0;
    if (productForm.price > 0 && clampedDiscPrice < productForm.price) {
      calcPercent = Math.round(((productForm.price - clampedDiscPrice) / productForm.price) * 100);
    }
    setProductForm(prev => ({
      ...prev,
      discount_price: clampedDiscPrice,
      discount_percent: calcPercent
    }));
  };

  // Save / Submit product
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || isSaving) return;
    isSubmittingRef.current = true;
    setIsSaving(true);

    const toast = {
      error: (msg: string) => onShowToast(msg.startsWith('❌') ? msg : `❌ ${msg}`),
      success: (msg: string) => onShowToast(msg.startsWith('✅') ? msg : `✅ ${msg}`)
    };
    const closeModal = () => cancelForm();

    try {
      const finalTitleBn = productForm.title_bn.trim();
      if (!finalTitleBn) {
        toast.error('পণ্যের বাংলা নাম আবশ্যক!');
        return;
      }

      const primaryImg = productForm.image || productForm.images[0] || '';
      if (!primaryImg) {
        toast.error('অন্তত একটি ছবি আপলোড বা URL যোগ করুন!');
        return;
      }

      const rawImageList = productForm.images.length > 0 ? productForm.images : [primaryImg];
      const hasBase64OrBlob = rawImageList.some(img => 
        !img || 
        img.startsWith('data:') || 
        img.startsWith('blob:')
      );

      if (hasBase64OrBlob) {
        toast.error('সতর্কতা: Base64 বা Blob ফরম্যাটের ছবি ডাটাবেজে অনুমোদনযোগ্য নয়। শুধুমাত্র সুপাবেজ স্টোরেজের পাবলিক URL গ্রহণযোগ্য।');
        return;
      }

      const finalUnitPack = `${quantityNum.trim()} ${quantityUnit}`.trim();
      const finalSku = productForm.sku.trim() || `JDM-${productForm.code.trim() || Math.floor(100 + Math.random() * 900)}`;
      const finalPrice = Number(productForm.price) || 0;
      const categoryVal = productForm.categoryLabelBn || getCategoryLabel(productForm.category);

      let targetDbId = editingProduct?.id;
      if (!targetDbId) {
        targetDbId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `prod_${Date.now()}`;
      }

      const finalStock = Number(productForm.stock_quantity) >= 0 ? Number(productForm.stock_quantity) : 0;
      const isStockOut = finalStock <= 0;
      const statusVal = isStockOut ? 'Out of Stock' : 'In Stock';
      const stockStatusVal = isStockOut ? 'out_of_stock' : 'in_stock';

      const calcDiscountPercent = Math.min(99, Math.max(0, Number(productForm.discount_percent) || 0));
      const autoOfferPrice = calcDiscountPercent > 0 
        ? Math.round(finalPrice - (finalPrice * (calcDiscountPercent / 100))) 
        : (Number(productForm.discount_price) > 0 ? Number(productForm.discount_price) : finalPrice);

      const finalOrigin = productForm.origin.trim() || 'পার্বত্য চট্টগ্রাম';
      const finalSupplierName = productForm.supplier_name.trim() || 'ঝাদিমাদি ভেরিফাইড মার্চেন্ট নেটওয়ার্ক';
      const finalQualityStandard = productForm.quality_standard.trim() || '১০০% বিশুদ্ধ ও পরীক্ষিত';
      const finalYoutubeUrl = productForm.youtube_url.trim();
      const allImagesList = productForm.images.length > 0 ? productForm.images : [primaryImg];

      const productPayload = {
        name: finalTitleBn,
        category: categoryVal,
        price: finalPrice,
        discount_percent: calcDiscountPercent,
        offer_price: autoOfferPrice,
        stock_quantity: finalStock,
        unit_quantity: quantityNum.trim() || '১',
        unit_type: quantityUnit,
        product_code: productForm.code.trim() || finalSku,
        sku: finalSku,
        origin: finalOrigin,
        quality_grade: finalQualityStandard,
        supplier_name: finalSupplierName,
        badge: productForm.badge.trim() || undefined,
        images: allImagesList,
        image_url: primaryImg || (allImagesList.length > 0 ? allImagesList[0] : ''),
        youtube_url: finalYoutubeUrl,
        description: productForm.descriptionBn.trim()
      };

      const localStoreProduct: Partial<StoreProduct> = {
        id: targetDbId,
        code: productForm.code.trim() || finalSku,
        sku: finalSku,
        product_code: productForm.code.trim() || finalSku,
        nameBn: finalTitleBn,
        title_bn: finalTitleBn,
        nameEn: finalTitleBn,
        badge: productForm.badge.trim(),
        category: productForm.category,
        categoryLabelBn: categoryVal,
        price: autoOfferPrice > 0 && autoOfferPrice < finalPrice ? autoOfferPrice : finalPrice,
        originalPrice: finalPrice,
        discount_price: autoOfferPrice,
        discountPrice: autoOfferPrice,
        offer_price: autoOfferPrice,
        discount_percent: calcDiscountPercent,
        unit: finalUnitPack,
        unit_pack: finalUnitPack,
        unit_quantity: quantityNum.trim() || '১',
        unit_type: quantityUnit,
        stock: finalStock,
        stock_quantity: finalStock,
        status: statusVal,
        stock_status: stockStatusVal,
        inStock: !isStockOut,
        origin: finalOrigin,
        sellerName: finalSupplierName,
        supplier_name: finalSupplierName,
        quality_standard: finalQualityStandard,
        quality_grade: finalQualityStandard,
        youtubeUrl: finalYoutubeUrl,
        videoUrl: finalYoutubeUrl,
        image: primaryImg,
        images: allImagesList,
        description: productForm.descriptionBn,
        descriptionBn: productForm.descriptionBn,
        isPublished: true,
      };

      if (editingProduct) {
        const { data, error } = await supabase
          .from('products')
          .update(productPayload)
          .eq('id', targetDbId);

        if (error) {
          console.error("Supabase Product Insert Error:", error.message);
          toast.error("পণ্য সেভ করতে ব্যর্থ হয়েছে: " + error.message);
        } else {
          await updateProduct(targetDbId, localStoreProduct);
          toast.success("পণ্য সফলভাবে আপডেট হয়েছে!");
          try {
            databaseService.notifyEntityChange('products');
            await databaseService.fetchProductsFromSupabase();
          } catch (_) {}
          if (refreshProducts) {
            await refreshProducts();
          }
          closeModal();
        }
      } else {
        const { data, error } = await supabase
          .from('products')
          .insert([productPayload]);

        if (error) {
          console.error("Supabase Product Insert Error:", error.message);
          const fallbackRes = await smartSupabaseInsert('products', productPayload);
          if (!fallbackRes.success) {
            toast.error("পণ্য সেভ করতে ব্যর্থ হয়েছে: " + error.message);
          } else {
            addProduct(localStoreProduct as StoreProduct);
            toast.success("পণ্য সফলভাবে যুক্ত হয়েছে!");
            try {
              databaseService.notifyEntityChange('products');
              await databaseService.fetchProductsFromSupabase();
            } catch (_) {}
            if (refreshProducts) {
              await refreshProducts();
            }
            closeModal();
          }
        } else {
          addProduct(localStoreProduct as StoreProduct);
          toast.success("পণ্য সফলভাবে যুক্ত হয়েছে!");
          try {
            databaseService.notifyEntityChange('products');
            await databaseService.fetchProductsFromSupabase();
          } catch (_) {}
          if (refreshProducts) {
            await refreshProducts();
          }
          closeModal();
        }
      }
    } catch (err: any) {
      console.error('[AdminProductsTab] Product save error:', err);
      toast.error("পণ্য সেভ করতে ব্যর্থ হয়েছে: " + (err?.message || 'অপ্রত্যাশিত সমস্যা'));
    } finally {
      isSubmittingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleSaveInlineEdit = async (prod: StoreProduct) => {
    if (inlineSaving) return;
    setInlineSaving(true);
    try {
      const finalPrice = Math.max(0, inlinePrice);
      const finalStock = Math.max(0, inlineStock);
      const isStockOut = finalStock <= 0;
      const statusVal = isStockOut ? 'Out of Stock' : 'In Stock';
      const stockStatusVal = isStockOut ? 'out_of_stock' : 'in_stock';

      await updateProduct(prod.id, {
        price: finalPrice,
        originalPrice: finalPrice,
        stock: finalStock,
        stock_quantity: finalStock,
        status: statusVal,
        stock_status: stockStatusVal,
        inStock: !isStockOut
      });

      await supabase.from('products').update({
        price: finalPrice,
        stock: finalStock,
        stock_quantity: finalStock,
        status: statusVal,
        stock_status: stockStatusVal
      }).eq('id', prod.id);

      onShowToast(`✅ ${prod.nameBn || prod.title_bn} মূল্য ও স্টক আপডেট করা হয়েছে!`);
      setInlineEditingId(null);
      await refreshProducts();
    } catch (err: any) {
      onShowToast('❌ দ্রুত সংরক্ষণ ব্যর্থ হয়েছে');
    } finally {
      setInlineSaving(false);
    }
  };

  const handleDeleteProduct = async (prodId: string) => {
    if (!window.confirm('নিশ্চিত এই পণ্যটি মুছে ফেলতে চান?')) return;
    try {
      await resilientSupabaseDelete('products', { id: prodId });
      try {
        await databaseService.deleteProductFromDatabase(prodId);
      } catch (_) {}
      deleteProduct(prodId);
      databaseService.notifyEntityChange('products');
      onShowToast('🗑️ পণ্য সফলভাবে মুছে ফেলা হয়েছে!');
      if (refreshProducts) {
        await refreshProducts();
      }
    } catch (err: any) {
      console.error('[AdminProductsTab] Delete product error:', err);
      onShowToast(`❌ মুছতে সমস্যা হয়েছে: ${err?.message || ''}`);
    }
  };

  const filteredProducts = products.filter(p => {
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch = !q || (
      (p.nameBn || p.title_bn || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      (p.code || '').toLowerCase().includes(q) ||
      (p.id || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q) ||
      (p.categoryLabelBn || '').toLowerCase().includes(q)
    );
    const matchesCat = selectedCategoryFilter === 'all' || p.category === selectedCategoryFilter;
    return matchesSearch && matchesCat;
  });

  const inStockCount = products.filter(p => (p.stock_quantity ?? p.stock ?? 0) > 0).length;
  const outOfStockCount = products.length - inStockCount;

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* Header Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-600" />
            পণ্য ও স্টক ম্যানেজমেন্ট ({products.length})
          </h2>
          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
            <span className="flex items-center gap-1 font-semibold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              স্টকে আছে: {inStockCount}টি
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1 font-semibold text-rose-600">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              স্টক শেষ: {outOfStockCount}টি
            </span>
          </div>
        </div>

        {!isCreating && (
          <button
            onClick={() => startNewProduct('Food')}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> নতুন পণ্য যোগ করুন
          </button>
        )}
      </div>

      {/* Modal Popup Form */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-white rounded-3xl border border-emerald-300 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white p-5 px-6 flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-xs border border-white/20">
                  <Package className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-wide">
                    {editingProduct ? 'পণ্য সংশোধন করুন' : 'নতুন পণ্য রেজিস্ট্রেশন ফর্ম'}
                  </h3>
                  <p className="text-[11px] text-emerald-200">
                    ঝাদিমাদি মার্চেন্ট ক্যাটালগ ও লাইভ হোমপেজ ফিড
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-block px-3 py-1 bg-white/10 rounded-full text-[11px] font-mono font-bold text-emerald-200 border border-white/15">
                  SKU: {productForm.sku}
                </span>
                <button 
                  type="button"
                  onClick={cancelForm} 
                  className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveProduct} className="overflow-y-auto p-5 sm:p-7 space-y-6 flex-1 text-gray-800 bg-gray-50/60">
              {uploadError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-sm font-bold text-red-700">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* 1. Basic Info */}
              <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-xs space-y-5">
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2 uppercase tracking-wider border-b border-gray-100 pb-3">
                  <Tag className="w-5 h-5 text-emerald-600" />
                  ১. পণ্যের সাধারণ তথ্য
                </h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-base font-semibold text-gray-800 mb-1.5">
                      পণ্যের বাংলা নাম <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="text"
                      value={productForm.title_bn}
                      onChange={e => setProductForm({ ...productForm, title_bn: e.target.value })}
                      placeholder="যেমন: খাঁটি পাহাড়ি জুমিয়া মধু"
                      required
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-medium transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      পণ্যের ক্যাটাগরি <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={productForm.category}
                      onChange={e => {
                        const val = e.target.value;
                        const catLabel = getCategoryLabel(val);
                        setProductForm({
                          ...productForm,
                          category: val,
                          categoryLabelBn: catLabel
                        });
                      }}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-medium transition cursor-pointer"
                    >
                      {categoriesList.map((cat, i) => (
                        <option key={i} value={cat.value}>
                          {cat.labelBn}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      পণ্যের ব্যাজ (Badge)
                    </label>
                    <input 
                      type="text"
                      value={productForm.badge}
                      onChange={e => setProductForm({ ...productForm, badge: e.target.value })}
                      placeholder="যেমন: ১০০০ গ্রাম ১ ফাইল, প্রিমিয়াম জুম"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-medium transition"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Price, Unit & Stock */}
              <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-xs space-y-5">
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2 uppercase tracking-wider border-b border-gray-100 pb-3">
                  <Scale className="w-5 h-5 text-emerald-600" />
                  ২. মূল্য, পরিমাণ ও স্টক
                </h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      রেগুলার মূল্য (৳) <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="number"
                      min="0"
                      value={productForm.price || ''}
                      onChange={e => handlePriceChange(parseFloat(e.target.value) || 0)}
                      placeholder="যেমন: ৫০০"
                      required
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 text-sm font-semibold text-gray-900 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      ডিসকাউন্ট (%)
                    </label>
                    <input 
                      type="number"
                      min="0"
                      max="99"
                      value={productForm.discount_percent || ''}
                      onChange={e => handleDiscountPercentChange(parseFloat(e.target.value) || 0)}
                      placeholder="যেমন: ১০"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 text-sm font-medium transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      অফার মূল্য (৳)
                    </label>
                    <input 
                      type="number"
                      min="0"
                      value={productForm.discount_price || ''}
                      onChange={e => handleDiscountPriceChange(parseFloat(e.target.value) || 0)}
                      placeholder="যেমন: ৪৫০"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 text-sm font-bold text-emerald-700 transition"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        পরিমাণ / সংখ্যা
                      </label>
                      <input 
                        type="text"
                        value={quantityNum}
                        onChange={e => setQuantityNum(e.target.value)}
                        placeholder="যেমন: ২৫০ বা ১"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 text-sm font-medium transition"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        একক (Unit)
                      </label>
                      <select 
                        value={quantityUnit}
                        onChange={e => setQuantityUnit(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 text-sm font-medium transition cursor-pointer"
                      >
                        <option value="গ্রাম (g)">গ্রাম (g)</option>
                        <option value="কেজি (kg)">কেজি (kg)</option>
                        <option value="পিস (Pcs)">পিস (Pcs)</option>
                        <option value="এমএল (ml)">এমএল (ml)</option>
                        <option value="লিটার (L)">লিটার (L)</option>
                        <option value="প্যাক (Pack)">প্যাক (Pack)</option>
                        <option value="ফাইল (File)">ফাইল (File)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      স্টকের পরিমাণ (টি)
                    </label>
                    <input 
                      type="number"
                      min="0"
                      value={productForm.stock_quantity}
                      onChange={e => setProductForm({ ...productForm, stock_quantity: parseInt(e.target.value, 10) || 0 })}
                      placeholder="৫০"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 text-sm font-medium transition"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Media & Gallery */}
              <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-xs space-y-5">
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2 uppercase tracking-wider border-b border-gray-100 pb-3">
                  <ImageIcon className="w-5 h-5 text-emerald-600" />
                  ৩. পণ্যের ছবি ও গ্যালাড়ী (সর্বোচ্চ ১০টি)
                </h4>

                <div className="space-y-4">
                  <div>
                    <input 
                      type="file"
                      ref={fileInputRef}
                      onChange={e => e.target.files && handleFilesSelected(e.target.files)}
                      multiple
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isUploadingImages}
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-4 px-6 border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/50 hover:bg-emerald-50 rounded-2xl flex flex-col items-center justify-center gap-2 text-emerald-800 font-bold text-sm transition cursor-pointer disabled:opacity-50"
                    >
                      {isUploadingImages ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                          <span>ছবি সুপাবেজ বাকেটে আপলোড করা হচ্ছে...</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-7 h-7 text-emerald-600" />
                          <span>ডিভাইস থেকে ছবি আপলোড করুন</span>
                          <span className="text-xs text-gray-500 font-normal">
                            একসাথে একাধিক ছবি সিলেক্ট করা যাবে (সর্বোচ্চ ১০টি)
                          </span>
                        </>
                      )}
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      অথবা সরাসরি ছবি URL লিঙ্ক
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="url"
                        value={directImageUrlInput}
                        onChange={e => setDirectImageUrlInput(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500 transition font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleAddDirectImageUrl}
                        className="px-4 py-2.5 bg-gray-800 hover:bg-black text-white rounded-xl text-xs font-bold transition shrink-0 cursor-pointer"
                      >
                        যোগ করুন
                      </button>
                    </div>
                  </div>

                  {productForm.images.length > 0 && (
                    <div>
                      <span className="block text-xs font-bold text-gray-700 mb-2">
                        সংযুক্ত ছবিসমূহ ({productForm.images.length}/১০):
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {productForm.images.map((img, idx) => {
                          const isPrimary = productForm.image === img || (idx === 0 && !productForm.image);
                          return (
                            <div 
                              key={idx} 
                              className={`relative group rounded-xl overflow-hidden border-2 aspect-square bg-gray-100 shadow-xs ${
                                isPrimary ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-gray-200'
                              }`}
                            >
                              <img 
                                src={img} 
                                alt={`Product ${idx}`} 
                                className="w-full h-full object-cover"
                              />
                              {isPrimary && (
                                <span className="absolute top-1 left-1 bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                                  মূল ছবি
                                </span>
                              )}
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 transition">
                                {!isPrimary && (
                                  <button
                                    type="button"
                                    onClick={() => handleSetPrimaryImage(img)}
                                    className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                                  >
                                    <Star className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveImage(idx)}
                                  className="p-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                      <Video className="w-4 h-4 text-rose-600" /> ইউটিউব ভিডিও লিঙ্ক (ঐচ্ছিক)
                    </label>
                    <input 
                      type="url"
                      value={productForm.youtube_url}
                      onChange={e => setProductForm({ ...productForm, youtube_url: e.target.value })}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500 transition font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Extra Sourcing Details */}
              <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-xs space-y-5">
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2 uppercase tracking-wider border-b border-gray-100 pb-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  ৪. উৎস ও বিস্তারিত বিবরণ
                </h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" /> উৎপত্তি/উৎসের স্থান
                    </label>
                    <input 
                      type="text"
                      value={productForm.origin}
                      onChange={e => setProductForm({ ...productForm, origin: e.target.value })}
                      placeholder="পার্বত্য চট্টগ্রাম"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                      <Building className="w-3.5 h-3.5 text-emerald-600" /> মার্চেন্ট / সরবরাহকারী
                    </label>
                    <input 
                      type="text"
                      value={productForm.supplier_name}
                      onChange={e => setProductForm({ ...productForm, supplier_name: e.target.value })}
                      placeholder="ঝাদিমাদি ভেরিফাইড মার্চেন্ট নেটওয়ার্ক"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      মান ও গুণাগুণ স্ট্যান্ডার্ড
                    </label>
                    <input 
                      type="text"
                      value={productForm.quality_standard}
                      onChange={e => setProductForm({ ...productForm, quality_standard: e.target.value })}
                      placeholder="১০০% অর্গানিক ও ফ্রেশ"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      পণ্যের বিস্তারিত বাংলা বিবরণ
                    </label>
                    <textarea 
                      rows={4}
                      value={productForm.descriptionBn}
                      onChange={e => setProductForm({ ...productForm, descriptionBn: e.target.value })}
                      placeholder="পণ্যের উপকারিতা, খাওয়ার নিয়ম ও বিস্তারিত তথ্য লিখুন..."
                      className="w-full p-4 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-2 flex items-center justify-end gap-3 sticky bottom-0 bg-white p-4 border-t border-gray-200 rounded-b-2xl shadow-lg">
                <button
                  type="button"
                  onClick={cancelForm}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-7 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-md shadow-emerald-600/30 transition cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>সংরক্ষণ হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>{editingProduct ? 'আপডেট পরিবর্তনসমূহ' : 'পণ্য প্রকাশ করুন'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filter and Search Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="নাম, SKU, কোড বা ক্যাটাগরি দিয়ে খুঁজুন..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-600 shrink-0">ফিল্টার:</span>
          <select
            value={selectedCategoryFilter}
            onChange={e => setSelectedCategoryFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 transition cursor-pointer"
          >
            <option value="all">সকল ক্যাটাগরি ({products.length})</option>
            {categoriesList.map((cat, i) => (
              <option key={i} value={cat.value}>
                {cat.labelBn}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Product Catalog Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold tracking-wider">
              <tr>
                <th className="py-3.5 px-4">পণ্য</th>
                <th className="py-3.5 px-4">ক্যাটাগরি</th>
                <th className="py-3.5 px-4">মূল্য (৳)</th>
                <th className="py-3.5 px-4">স্টক</th>
                <th className="py-3.5 px-4">অবস্থা</th>
                <th className="py-3.5 px-4 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="font-semibold text-sm">কোন পণ্য পাওয়া যায়নি</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((prod) => {
                  const isInlineEditing = inlineEditingId === prod.id;
                  const currentStock = prod.stock_quantity ?? prod.stock ?? 0;
                  const isOut = currentStock <= 0;
                  const mainImg = prod.image || (prod.images && prod.images[0]) || '';

                  return (
                    <tr key={prod.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img 
                            src={mainImg || 'https://via.placeholder.com/80'} 
                            alt={prod.nameBn || prod.title_bn} 
                            className="w-10 h-10 rounded-xl object-cover bg-slate-100 border border-slate-200 shrink-0"
                          />
                          <div>
                            <span className="font-bold text-slate-900 block line-clamp-1">
                              {prod.nameBn || prod.title_bn}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              SKU: {prod.sku || prod.code || prod.id} | {prod.unit_pack || prod.unit || ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-medium text-slate-600">
                        {prod.categoryLabelBn || getCategoryLabel(prod.category || '')}
                      </td>

                      <td className="py-3 px-4">
                        {isInlineEditing ? (
                          <input 
                            type="number"
                            value={inlinePrice}
                            onChange={e => setInlinePrice(parseFloat(e.target.value) || 0)}
                            className="w-20 px-2 py-1 bg-white border border-emerald-400 rounded text-xs font-bold"
                          />
                        ) : (
                          <div>
                            <span className="font-bold text-emerald-700">
                              ৳{prod.discount_price || prod.price}
                            </span>
                            {prod.originalPrice && prod.originalPrice > (prod.discount_price || prod.price) && (
                              <span className="text-[10px] text-slate-400 line-through block">
                                ৳{prod.originalPrice}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {isInlineEditing ? (
                          <input 
                            type="number"
                            value={inlineStock}
                            onChange={e => setInlineStock(parseInt(e.target.value, 10) || 0)}
                            className="w-16 px-2 py-1 bg-white border border-emerald-400 rounded text-xs font-bold"
                          />
                        ) : (
                          <span className={`font-bold ${isOut ? 'text-rose-600' : 'text-slate-700'}`}>
                            {currentStock} টি
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isOut ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {isOut ? 'Out of Stock' : 'In Stock'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isInlineEditing ? (
                            <>
                              <button
                                onClick={() => handleSaveInlineEdit(prod)}
                                disabled={inlineSaving}
                                className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                              >
                                <Save className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setInlineEditingId(null)}
                                className="p-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setInlineEditingId(prod.id);
                                  setInlinePrice(prod.price || 0);
                                  setInlineStock(currentStock);
                                }}
                                className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition"
                                title="দ্রুত এডিট"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => startEditProduct(prod)}
                                className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition"
                                title="সম্পাদনা"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(prod.id)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition"
                                title="মুছে ফেলুন"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};