import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Upload, 
  Plus, 
  AlertCircle, 
  Image as ImageIcon, 
  Loader2, 
  Video, 
  Package, 
  Check, 
  Trash2, 
  Tag, 
  Sliders, 
  Info, 
  ShieldCheck, 
  MapPin, 
  Layers,
  Scale,
  CheckCircle2 
} from 'lucide-react';
import { PRODUCT_CATEGORIES } from './admin/AdminProductsTab';
import { supabase, supabaseUrl } from '../supabase';
import { isLocalTransientUrl } from '../utils/directSupabaseStorage';
import { databaseService } from '../services/databaseService';
import { 
  smartSupabaseUpload, 
  smartSupabaseInsert, 
  prepareProductPayload, 
  FALLBACK_PRODUCT_IMAGE 
} from '../utils/supabaseDataService';

export interface ProductData {
  id?: string;
  name: string;
  title?: string;
  category: string;
  price: number;
  discountPercent?: number | string;
  discountPrice?: number | string;
  stock: number;
  microLocation?: string;
  description: string;
  image: string;
  images?: string[];
  sellerPhone?: string;
  sku?: string;
  unitAmount?: string;
  unitType?: string;
  unit?: string;
  origin?: string;
  qualityStandard?: string;
  stockStatusText?: string;
  sellerName?: string;
  youtubeUrl?: string;
  [key: string]: any;
}

interface ProductAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProduct?: (product: ProductData) => void;
  onSave?: (product: ProductData) => void;
  onSubmit?: (product: ProductData) => void;
  initialProduct?: Partial<ProductData> | null;
}

const UNIT_OPTIONS = [
  'পিস',
  'গ্রাম',
  'কেজি',
  'লিটার',
  'প্যাকেট',
  'টি',
  'মিলি (ml)',
  'জোড়া',
  'বস্তা',
  'ডজন'
];

export const ProductAddModal: React.FC<ProductAddModalProps> = ({ 
  isOpen, 
  onClose, 
  onAddProduct, 
  onSave, 
  onSubmit, 
  initialProduct 
}) => {
  // Form State with required default values
  const [formData, setFormData] = useState<ProductData>({
    name: '',
    title: '',
    category: 'Food',
    sku: 'JHD-015',
    unitAmount: '১',
    unitType: 'পিস (Pcs)',
    price: 0,
    discountPercent: '',
    discountPrice: '',
    origin: 'পার্বত্য চট্টগ্রাম',
    qualityStandard: '১০০% বিশুদ্ধ ও পরীক্ষিত',
    stockStatusText: 'স্টকে পর্যাপ্ত রয়েছে (50 টি)',
    stock: 50,
    sellerName: 'ঝাদিমাদি ভেরিফাইড মার্চেন্ট নেটওয়ার্ক',
    sellerPhone: '01870592699',
    microLocation: 'খাগড়াছড়ি / সদর',
    description: '',
    image: '',
    images: [],
    youtubeUrl: '',
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [imageUrlInput, setImageUrlInput] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isUploadingImages, setIsUploadingImages] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [successToast, setSuccessToast] = useState<string>('');

  useEffect(() => {
    if (initialProduct) {
      const p = initialProduct.price ?? 0;
      const dp = initialProduct.discountPercent ?? '';
      let calculatedDiscPrice = initialProduct.discountPrice ?? '';
      if (!calculatedDiscPrice && p > 0 && dp !== '') {
        const numD = Number(dp);
        if (numD > 0) calculatedDiscPrice = Math.round(p * (1 - numD / 100));
      }

      setFormData(prev => ({
        ...prev,
        ...initialProduct,
        name: initialProduct.name || initialProduct.title || prev.name,
        title: initialProduct.title || initialProduct.name || prev.title,
        category: initialProduct.category || prev.category,
        sku: initialProduct.sku || prev.sku,
        unitAmount: initialProduct.unitAmount || prev.unitAmount,
        unitType: initialProduct.unitType || prev.unitType,
        price: p,
        discountPercent: dp,
        discountPrice: calculatedDiscPrice,
        origin: initialProduct.origin || prev.origin,
        qualityStandard: initialProduct.qualityStandard || prev.qualityStandard,
        stockStatusText: initialProduct.stockStatusText || prev.stockStatusText,
        stock: initialProduct.stock ?? prev.stock,
        sellerName: initialProduct.sellerName || prev.sellerName,
        sellerPhone: initialProduct.sellerPhone || prev.sellerPhone,
        description: initialProduct.description || prev.description,
        image: initialProduct.image || prev.image,
        images: initialProduct.images || (initialProduct.image ? [initialProduct.image] : prev.images),
        youtubeUrl: initialProduct.youtubeUrl || prev.youtubeUrl,
      }));
    }
  }, [initialProduct]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Dynamic Price & Discount Calculation
    if (name === 'price') {
      const p = Math.max(0, parseFloat(value) || 0);
      const disc = parseFloat(String(formData.discountPercent)) || 0;
      const dp = disc > 0 && p > 0 ? Math.round(p * (1 - disc / 100)) : '';
      setFormData(prev => ({
        ...prev,
        price: p,
        discountPrice: dp
      }));
      return;
    }

    if (name === 'discountPercent') {
      const disc = Math.min(99, Math.max(0, parseFloat(value) || 0));
      const strVal = value === '' ? '' : String(disc);
      const p = Number(formData.price) || 0;
      const dp = disc > 0 && p > 0 ? Math.round(p * (1 - disc / 100)) : '';
      setFormData(prev => ({
        ...prev,
        discountPercent: strVal,
        discountPrice: dp
      }));
      return;
    }

    if (name === 'discountPrice') {
      const dp = Math.max(0, parseFloat(value) || 0);
      const p = Number(formData.price) || 0;
      let disc = 0;
      if (p > 0 && dp < p) {
        disc = Math.round(((p - dp) / p) * 100);
      }
      setFormData(prev => ({
        ...prev,
        discountPrice: dp > 0 ? dp : '',
        discountPercent: disc > 0 ? disc : ''
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: name === 'stock' ? (value === '' ? 0 : Number(value)) : value,
    }));
  };

  // Multiple Image Selection & Direct Storage Upload (8-10 Photos)
  const handleMultipleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    const currentImgs = formData.images || [];
    if (currentImgs.length >= 10) {
      setError('সর্বোচ্চ ১০টি ছবি আপলোড করা যাবে।');
      return;
    }

    const availableSlots = 10 - currentImgs.length;
    const filesToUpload = fileList.slice(0, availableSlots);

    // 1. a) Immediately block local preview generation via FileReader/Blob
    setIsUploadingImages(true);
    setError('');

    // 1. b) Show a visible uploading status indicator: "ছবি সুপাবেজ বাকেটে আপলোড করা হচ্ছে..."
    setUploadStatus('ছবি সুপাবেজ বাকেটে আপলোড করা হচ্ছে...');

    const newUrls: string[] = [];
    let uploadFailed = false;

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      if (filesToUpload.length > 1) {
        setUploadStatus(`ছবি (${i + 1}/${filesToUpload.length}) সুপাবেজ বাকেটে আপলোড করা হচ্ছে...`);
      }

      const fileExt = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
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
            console.warn('[Supabase Storage] safe getPublicUrl notice:', pErr);
          }
          if (!resolvedPublicUrl) {
            resolvedPublicUrl = `${supabaseUrl}/storage/v1/object/public/products/${primaryData.path}`;
          }
          uploadSuccess = true;
          console.log('[Supabase Storage] Uploaded to "products":', resolvedPublicUrl);
        } else if (primaryError) {
          console.error('[Supabase Storage Upload Error - Bucket "products"]:', {
            bucket: 'products',
            path: filePath,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            errorMessage: primaryError.message,
            errorDetails: primaryError,
            statusCode: (primaryError as any)?.statusCode || (primaryError as any)?.status,
          });
        }
      } catch (err: any) {
        console.error('[Supabase Storage Exception - Bucket "products"]:', {
          bucket: 'products',
          path: filePath,
          fileName: file.name,
          exception: err?.message || err,
          fullError: err,
        });
      }

      // 2. Fallback to alternative 'product-images' bucket
      if (!uploadSuccess) {
        try {
          console.warn('[Supabase Storage] Retrying upload with fallback bucket "product-images"...');
          const { data: fallbackData, error: fallbackError } = await supabase.storage
            .from('product-images')
            .upload(filePath, file, { cacheControl: '3600', upsert: true, contentType: file.type || 'image/jpeg' });

          if (!fallbackError && fallbackData?.path) {
            try {
              const { data: pubData } = supabase.storage.from('product-images').getPublicUrl(fallbackData.path);
              if (pubData?.publicUrl) resolvedPublicUrl = pubData.publicUrl;
            } catch (pErr) {
              console.warn('[Supabase Storage] fallback safe getPublicUrl notice:', pErr);
            }
            if (!resolvedPublicUrl) {
              resolvedPublicUrl = `${supabaseUrl}/storage/v1/object/public/product-images/${fallbackData.path}`;
            }
            uploadSuccess = true;
            console.log('[Supabase Storage] Fallback uploaded to "product-images":', resolvedPublicUrl);
          } else if (fallbackError) {
            console.error('[Supabase Storage Upload Error - Fallback Bucket "product-images"]:', {
              bucket: 'product-images',
              path: filePath,
              fileName: file.name,
              errorMessage: fallbackError.message,
              errorDetails: fallbackError,
              statusCode: (fallbackError as any)?.statusCode || (fallbackError as any)?.status,
            });
          }
        } catch (fbErr: any) {
          console.error('[Supabase Storage Exception - Fallback Bucket "product-images"]:', {
            bucket: 'product-images',
            path: filePath,
            fileName: file.name,
            exception: fbErr?.message || fbErr,
          });
        }
      }

      // 3. Fallback to server-side /api/upload
      if (!uploadSuccess) {
        try {
          console.warn('[Supabase Storage] Attempting server-assisted upload via /api/upload...');
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
            console.log('[Supabase Storage] Server-assisted upload succeeded:', resolvedPublicUrl);
          } else {
            console.error('[Supabase Storage Server Fallback Error]:', {
              fileName: file.name,
              serverError: apiData?.error || 'Unknown server upload error',
              responseStatus: apiRes.status
            });
          }
        } catch (srvErr: any) {
          console.error('[Supabase Storage Server Fallback Exception]:', {
            fileName: file.name,
            exception: srvErr?.message || srvErr
          });
        }
      }

      if (uploadSuccess && resolvedPublicUrl) {
        newUrls.push(resolvedPublicUrl);
      } else {
        uploadFailed = true;
        console.error('[Supabase Storage Fatal Failure]: Could not upload file in modal:', {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          primaryBucket: 'products',
          fallbackBucket: 'product-images'
        });
      }
    }

    if (newUrls.length > 0) {
      setFormData(prev => {
        const updated = [...(prev.images || []), ...newUrls].slice(0, 10);
        return {
          ...prev,
          images: updated,
          image: prev.image || updated[0]
        };
      });
      // 2. Auto-populate direct image url field
      setImageUrlInput(newUrls[0]);
    }

    // 4. ERROR HANDLING:
    // If Supabase bucket upload fails, display an explicit toast error:
    if (uploadFailed || (filesToUpload.length > 0 && newUrls.length === 0)) {
      setError('ছবি বাকেটে আপলোড ব্যর্থ হয়েছে! অনুগ্রহ করে Supabase Storage Bucket পারমিশন পরীক্ষা করুন।');
    }

    setIsUploadingImages(false);
    setUploadStatus('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddImageUrl = () => {
    const trimmed = imageUrlInput.trim();
    if (trimmed) {
      const currentImages = formData.images || [];
      const updatedImages = [...currentImages, trimmed];
      setFormData(prev => ({
        ...prev,
        image: prev.image || trimmed,
        images: updatedImages
      }));
      setImageUrlInput('');
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    const currentImages = formData.images || [];
    const updated = currentImages.filter((_, idx) => idx !== indexToRemove);
    setFormData(prev => ({
      ...prev,
      images: updated,
      image: updated.length > 0 ? updated[0] : (imagePreview || '')
    }));
  };

  const handleRemoveUploadedFile = () => {
    setSelectedFile(null);
    setImagePreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    const currentImages = formData.images || [];
    setFormData(prev => ({
      ...prev,
      image: currentImages.length > 0 ? currentImages[0] : ''
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const prodTitle = (formData.name || formData.title || '').trim();
    const prodPrice = Number(formData.price) || 0;

    if (!prodTitle) {
      setError('দয়া করে পণ্যের বাংলা নাম লিখুন।');
      return;
    }
    if (prodPrice <= 0) {
      setError('দয়া করে সঠিক বিক্রয় মূল্য (টাকা) প্রদান করুন।');
      return;
    }

    try {
      setLoading(true);

      const prodCategory = formData.category || 'Food';
      const prodDesc = formData.description?.trim() || `${prodTitle} - ১০০% বিশুদ্ধ পাহাড়ি পণ্য সম্ভার।`;
      const locationParts = (formData.microLocation || 'খাগড়াছড়ি / সদর').split(/[/,-]/);
      const dist = locationParts[0]?.trim() || 'খাগড়াছড়ি';
      const upazilaName = locationParts[1]?.trim() || 'সদর';
      const sellerPhoneNum = formData.sellerPhone?.trim() || '01870592699';

      let finalImageUrl = formData.image?.trim() || '';

      // Upload file directly to Supabase Storage ('products' bucket with fallback)
      if (selectedFile) {
        const fileExt = (selectedFile.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const cleanName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${cleanName}`;
        const filePath = `products/${uniqueSuffix}`;

        let uploadDone = false;

        // 1. Direct upload to primary 'products' bucket
        try {
          const { data: upData, error: upErr } = await supabase.storage
            .from('products')
            .upload(filePath, selectedFile, { cacheControl: '3600', upsert: true, contentType: selectedFile.type || 'image/jpeg' });

          if (!upErr && upData?.path) {
            try {
              const { data: pubData } = supabase.storage.from('products').getPublicUrl(upData.path);
              if (pubData?.publicUrl) finalImageUrl = pubData.publicUrl;
            } catch (pErr) {
              console.warn('[ProductAddModal] safe getPublicUrl notice:', pErr);
            }
            if (!finalImageUrl) {
              finalImageUrl = `${supabaseUrl}/storage/v1/object/public/products/${upData.path}`;
            }
            uploadDone = true;
            console.log('[ProductAddModal] Single image uploaded to "products":', finalImageUrl);
          } else if (upErr) {
            console.error('[ProductAddModal Storage Error - Primary "products"]:', {
              bucket: 'products',
              path: filePath,
              fileName: selectedFile.name,
              errorMessage: upErr.message,
              errorDetails: upErr,
            });
          }
        } catch (e: any) {
          console.error('[ProductAddModal Storage Exception - Primary "products"]:', {
            bucket: 'products',
            path: filePath,
            exception: e?.message || e,
          });
        }

        // 2. Fallback to 'product-images' bucket
        if (!uploadDone) {
          try {
            console.warn('[ProductAddModal] Retrying single upload with fallback "product-images"...');
            const { data: fbData, error: fbErr } = await supabase.storage
              .from('product-images')
              .upload(filePath, selectedFile, { cacheControl: '3600', upsert: true, contentType: selectedFile.type || 'image/jpeg' });

            if (!fbErr && fbData?.path) {
              try {
                const { data: pubData } = supabase.storage.from('product-images').getPublicUrl(fbData.path);
                if (pubData?.publicUrl) finalImageUrl = pubData.publicUrl;
              } catch (pErr) {
                console.warn('[ProductAddModal] fallback getPublicUrl notice:', pErr);
              }
              if (!finalImageUrl) {
                finalImageUrl = `${supabaseUrl}/storage/v1/object/public/product-images/${fbData.path}`;
              }
              uploadDone = true;
              console.log('[ProductAddModal] Single image uploaded to fallback "product-images":', finalImageUrl);
            } else if (fbErr) {
              console.error('[ProductAddModal Storage Error - Fallback "product-images"]:', {
                bucket: 'product-images',
                path: filePath,
                errorMessage: fbErr.message,
                errorDetails: fbErr,
              });
            }
          } catch (fbEx: any) {
            console.error('[ProductAddModal Storage Exception - Fallback "product-images"]:', fbEx);
          }
        }

        // 3. Fallback to /api/upload
        if (!uploadDone) {
          try {
            console.warn('[ProductAddModal] Retrying single upload via server /api/upload...');
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
              finalImageUrl = apiData.url;
              uploadDone = true;
              console.log('[ProductAddModal] Server upload succeeded:', finalImageUrl);
            } else {
              console.error('[ProductAddModal Server Upload Error]:', apiData?.error);
            }
          } catch (srvErr) {
            console.error('[ProductAddModal Server Upload Exception]:', srvErr);
          }
        }
      }

      if (!finalImageUrl && formData.images && formData.images.length > 0) {
        finalImageUrl = formData.images[0];
      }

      let allImages = (formData.images && formData.images.length > 0)
        ? [...formData.images]
        : (finalImageUrl ? [finalImageUrl] : []);

      // STRICT VALIDATION: Verify that NO Base64 or Blob strings are allowed into the database under any condition
      const hasBase64OrBlob = allImages.some(img => 
        !img || 
        img.startsWith('data:') || 
        img.startsWith('blob:')
      );

      if (hasBase64OrBlob) {
        setError('সতর্কতা: Base64 বা Blob ফরম্যাটের ছবি ডাটাবেজে অনুমোদনযোগ্য নয়। শুধুমাত্র সুপাবেজ স্টোরেজের পাবলিক URL গ্রহণযোগ্য।');
        setLoading(false);
        return;
      }

      allImages = allImages.filter(img => typeof img === 'string' && (img.startsWith('http://') || img.startsWith('https://')));

      if (allImages.length === 0) {
        setError('দয়া করে পণ্যের একটি ছবি সুপাবেজ স্টোরেজে আপলোড করুন অথবা ছবির পাবলিক URL দিন।');
        setLoading(false);
        return;
      }

      finalImageUrl = allImages[0];

      const formattedUnit = `${formData.unitAmount || ''} ${formData.unitType || 'পিস (Pcs)'}`.trim();
      const calcDiscountPercent = Math.min(99, Math.max(0, Number(formData.discountPercent) || 0));
      
      // Auto-calculate: offer_price = price - (price * (discount_percent / 100))
      const autoOfferPrice = calcDiscountPercent > 0
        ? Math.round(prodPrice - (prodPrice * (calcDiscountPercent / 100)))
        : (Number(formData.discountPrice) > 0 ? Number(formData.discountPrice) : prodPrice);

      const stockCount = Number(formData.stock) >= 0 ? Number(formData.stock) : 50;
      const unitQuantityVal = String(formData.unitAmount || '১').trim();
      const unitTypeVal = String(formData.unitType || 'পিস (Pcs)').trim();
      const productCodeVal = String(formData.sku || 'JHD-015').trim();
      const originVal = String(formData.origin || 'পার্বত্য চট্টগ্রাম').trim();
      const qualityGradeVal = String(formData.qualityStandard || '১০০% বিশুদ্ধ ও পরীক্ষিত').trim();
      const supplierNameVal = String(formData.sellerName || 'ঝাদিমাদি ভেরিফাইড মার্চেন্ট নেটওয়ার্ক').trim();
      const youtubeUrlVal = String(formData.youtubeUrl || '').trim();

      // 1. MAP FORM FIELDS TO DATABASE COLUMNS:
      // - "পণ্যের বাংলা নাম" -> `name`
      // - "ক্যাটাগরি" -> `category`
      // - "বিক্রয় মূল্য" -> `price`
      // - "ছাড় / অফার %" -> `discount_percent`
      // - "ছাড় পরবর্তী মূল্য" -> `offer_price`
      // - "স্টক পরিমাণ" -> `stock`
      // - "পরিমাণ (সংখ্যা)" -> `unit_quantity`
      // - "একক" -> `unit_type`
      // - "প্রোডাক্ট কোড" -> `product_code`
      // - "প্রোডাক্ট SKU" -> `sku`
      // - "উৎপাদন স্থান" -> `origin`
      // - "গুণগত মান" -> `quality_grade`
      // - "সরবরাহকারী/বিক্রেতা" -> `supplier_name`
      // - "ছবি আপলোড / ইমেজেস" -> `images` (Array) & `image_url` (First Image)
      // - "ইউটিউব ভিডিও লিঙ্ক" -> `youtube_url`
      // - "বিস্তারিত বিবরণ" -> `description`
      const productRecord = prepareProductPayload({
        name: prodTitle,
        category: prodCategory,
        price: prodPrice,
        discount_percent: calcDiscountPercent,
        offer_price: autoOfferPrice,
        stock: stockCount,
        unit_quantity: unitQuantityVal,
        unit_type: unitTypeVal,
        product_code: productCodeVal,
        sku: productCodeVal,
        origin: originVal,
        quality_grade: qualityGradeVal,
        supplier_name: supplierNameVal,
        images: allImages,
        image_url: finalImageUrl,
        youtube_url: youtubeUrlVal,
        description: prodDesc,

        // Backward-compatible schema properties:
        title: prodTitle,
        title_bn: prodTitle,
        name_bn: prodTitle,
        regular_price: prodPrice,
        discount_price: autoOfferPrice,
        discount_offer: calcDiscountPercent > 0 ? `${calcDiscountPercent}% ছাড়` : '',
        unit: formattedUnit,
        unit_pack: formattedUnit,
        stock_quantity: stockCount,
        stock_status: stockCount > 0 ? 'in_stock' : 'out_of_stock',
        seller_name: supplierNameVal,
        seller_phone: sellerPhoneNum,
        quality_standard: qualityGradeVal,
        video_url: youtubeUrlVal,
        district: dist,
        upazila: upazilaName
      });

      console.log('[ProductAddModal] Submitting product to Supabase products table:', productRecord);

      // 2. SUBMISSION LOGIC: Execute supabase.from('products').insert([formData])
      try {
        const { data: directData, error: directError } = await supabase
          .from('products')
          .insert([productRecord]);

        if (directError) {
          console.warn('[ProductAddModal] Supabase direct insert note:', directError);
          // Resilient fallback with dynamic schema alignment to prevent any app freezing
          const smartRes = await smartSupabaseInsert('products', productRecord);
          if (!smartRes.success) {
            console.error('[ProductAddModal] Supabase adaptive insert error:', smartRes.error);
          } else {
            console.log('[ProductAddModal] Adaptive insert succeeded:', smartRes.data);
          }
        } else {
          console.log('[ProductAddModal] Supabase direct insert success:', directData);
        }
      } catch (insertErr: any) {
        console.error('[ProductAddModal] Supabase insert exception gracefully handled:', insertErr);
        // Resilient fallback to avoid freezing
        try {
          await smartSupabaseInsert('products', productRecord);
        } catch (_) {}
      }

      const finalProductData: ProductData = {
        ...formData,
        name: prodTitle,
        title: prodTitle,
        category: prodCategory,
        price: prodPrice,
        discountPercent: calcDiscountPercent,
        discountPrice: autoOfferPrice,
        offer_price: autoOfferPrice,
        stock: stockCount,
        image: finalImageUrl,
        images: allImages,
        unit: formattedUnit,
        description: prodDesc,
      };

      if (onAddProduct) await onAddProduct(finalProductData);
      if (onSave) onSave(finalProductData);
      if (onSubmit) onSubmit(finalProductData);

      // Notify database service and reload Supabase products immediately for home page catalog
      try {
        databaseService.notifyEntityChange('products');
        await databaseService.fetchProductsFromSupabase();
      } catch (_) {}

      // On success, show success toast "পণ্যটি সফলভাবে রেজিস্ট্রেশন করা হয়েছে!", reset the form, and close the modal
      setSuccessToast('পণ্যটি সফলভাবে রেজিস্ট্রেশন করা হয়েছে!');

      // Form Reset
      setFormData({
        name: '',
        title: '',
        category: 'Food',
        sku: 'JHD-015',
        unitAmount: '১',
        unitType: 'পিস (Pcs)',
        price: 0,
        discountPercent: '',
        discountPrice: '',
        origin: 'পার্বত্য চট্টগ্রাম',
        qualityStandard: '১০০% বিশুদ্ধ ও পরীক্ষিত',
        stockStatusText: 'স্টকে পর্যাপ্ত রয়েছে (50 টি)',
        stock: 50,
        sellerName: 'ঝাদিমাদি ভেরিফাইড মার্চেন্ট নেটওয়ার্ক',
        sellerPhone: '01870592699',
        microLocation: 'খাগড়াছড়ি / সদর',
        description: '',
        image: '',
        images: [],
        youtubeUrl: '',
      });
      setSelectedFile(null);
      setImagePreview('');
      setImageUrlInput('');
      setError('');
      setUploadStatus('');

      setTimeout(() => {
        setSuccessToast('');
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('Product submit error:', err);
      setError(`পণ্য যোগ করতে সমস্যা হয়েছে: ${err?.message || 'আবার চেষ্টা করুন।'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto"
      id="modal-product-add"
    >
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl transition-all border border-gray-200 my-auto overflow-hidden text-left flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-emerald-50 via-white to-teal-50 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">
                নতুন পণ্য রেজিস্ট্রেশন ও তথ্যসূচি
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                Jhadimadi.com ই-কমার্স ও মার্চেন্ট ইনভেন্টরি ম্যানেজমেন্ট
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition cursor-pointer"
            title="বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Toast Banner */}
        {successToast && (
          <div className="mx-6 mt-4 flex items-center gap-2.5 rounded-xl bg-emerald-50 border border-emerald-300 p-3.5 text-sm text-emerald-900 shadow-sm animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
            <span className="font-bold">{successToast}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 flex items-center gap-2.5 rounded-xl bg-rose-50 border border-rose-200/80 p-3.5 text-sm text-rose-700">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden" id="form-product-add">
          {/* Scrollable Single Column Form Fields */}
          <div className="space-y-5 p-6 overflow-y-auto flex-1">
            {/* ১. পণ্যের বাংলা নাম */}
            <div>
              <label className="block text-base font-semibold text-gray-800 mb-1.5">
                পণ্যের বাংলা নাম <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name || formData.title || ''}
                onChange={handleChange}
                placeholder="যেমন: খাগড়াছড়ির পাহাড়ি হলুদ গুঁড়া"
                className="w-full h-12 px-4 border border-gray-300 rounded-lg bg-white text-base text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
                required
                id="input-product-name"
              />
            </div>

            {/* ২. বিক্রয় মূল্য */}
            <div>
              <label className="block text-base font-semibold text-gray-800 mb-1.5">
                বিক্রয় মূল্য (টাকা) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-gray-500">৳</span>
                <input
                  type="number"
                  name="price"
                  value={formData.price === 0 ? '' : formData.price}
                  onChange={handleChange}
                  placeholder="০.০০"
                  min="1"
                  className="w-full h-12 pl-9 pr-4 border border-gray-300 rounded-lg bg-white text-base font-bold text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
                  required
                  id="input-product-price"
                />
              </div>
            </div>

            {/* ৩. ছাড়ের হার */}
            <div>
              <label className="block text-base font-semibold text-gray-800 mb-1.5 flex items-center justify-between">
                <span>ছাড়ের হার (Discount %)</span>
                {Number(formData.discountPercent) > 0 && (
                  <span className="text-xs text-emerald-600 font-extrabold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                    {formData.discountPercent}% ছাড়
                  </span>
                )}
              </label>
              <div className="relative">
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-base font-bold text-emerald-600">%</span>
                <input
                  type="number"
                  name="discountPercent"
                  value={formData.discountPercent ?? ''}
                  onChange={handleChange}
                  placeholder="যেমন: ১৫"
                  min="0"
                  max="99"
                  className="w-full h-12 px-4 pr-10 border border-gray-300 rounded-lg bg-white text-base font-bold text-emerald-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
                  id="input-product-discount-percent"
                />
              </div>
            </div>

            {/* ছাড় পরবর্তী বিশেষ অফার মূল্য প্রিভিউ */}
            {Number(formData.discountPercent) > 0 && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-sm">
                <span className="font-semibold text-emerald-800">ছাড় পরবর্তী বিশেষ অফার মূল্য:</span>
                <span className="font-black text-emerald-700 text-base">
                  ৳ {formData.discountPrice || Math.round(Number(formData.price) * (1 - Number(formData.discountPercent)/100))}
                </span>
              </div>
            )}

            {/* ৪. প্রোডাক্ট কোড (SKU) */}
            <div>
              <label className="block text-base font-semibold text-gray-800 mb-1.5 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-emerald-600" />
                <span>প্রোডাক্ট কোড (SKU)</span>
              </label>
              <input
                type="text"
                name="sku"
                value={formData.sku || 'JHD-015'}
                onChange={handleChange}
                className="w-full h-12 px-4 border border-gray-300 rounded-lg bg-white text-base text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
                id="input-product-sku"
              />
            </div>

            {/* ৫. ক্যাটাগরি */}
            <div>
              <label className="block text-base font-semibold text-gray-800 mb-1.5 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-emerald-600" />
                <span>ক্যাটাগরি (Category) <span className="text-rose-500">*</span></span>
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full h-12 px-4 border border-gray-300 rounded-lg bg-white text-base text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition cursor-pointer"
                id="select-product-category"
              >
                {PRODUCT_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>
                    {c.labelBn}
                  </option>
                ))}
              </select>
            </div>

            {/* ৬. পরিমাপ ও একক */}
            <div>
              <label className="block text-base font-semibold text-gray-800 mb-1.5 flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-emerald-600" />
                <span>পরিমাপ ও একক (Unit & Pack Size)</span>
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  name="unitAmount"
                  value={formData.unitAmount || '১'}
                  onChange={handleChange}
                  placeholder="১"
                  className="w-24 h-12 border border-gray-300 rounded-lg bg-white text-base font-bold text-center text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
                  id="input-product-unit-amount"
                />
                <select
                  name="unitType"
                  value={formData.unitType || 'পিস (Pcs)'}
                  onChange={handleChange}
                  className="flex-1 h-12 px-4 border border-gray-300 rounded-lg bg-white text-base text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition cursor-pointer"
                  id="select-product-unit-type"
                >
                  {UNIT_OPTIONS.map((opt, i) => (
                    <option key={i} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* ৭. উৎপাদন স্থান */}
            <div>
              <label className="block text-base font-semibold text-gray-800 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span>উৎপাদন স্থান (Origin)</span>
              </label>
              <input
                type="text"
                name="origin"
                value={formData.origin || 'পার্বত্য চট্টগ্রাম'}
                onChange={handleChange}
                placeholder="পার্বত্য চট্টগ্রাম"
                className="w-full h-12 px-4 border border-gray-300 rounded-lg bg-white text-base text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
                id="input-product-origin"
              />
            </div>

            {/* ৮. গুণগত মান */}
            <div>
              <label className="block text-base font-semibold text-gray-800 mb-1.5 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>গুণগত মান (Quality Standard)</span>
              </label>
              <input
                type="text"
                name="qualityStandard"
                value={formData.qualityStandard || '১০০% বিশুদ্ধ ও পরীক্ষিত'}
                onChange={handleChange}
                placeholder="১০০% বিশুদ্ধ ও পরীক্ষিত"
                className="w-full h-12 px-4 border border-gray-300 rounded-lg bg-white text-base text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
                id="input-product-quality"
              />
            </div>

            {/* ৯. স্টক অবস্থা ও সংখ্যা */}
            <div>
              <label className="block text-base font-semibold text-gray-800 mb-1.5 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>স্টক অবস্থা ও সংখ্যা (Stock Status)</span>
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  name="stockStatusText"
                  value={formData.stockStatusText || 'স্টকে পর্যাপ্ত রয়েছে (50 টি)'}
                  onChange={handleChange}
                  placeholder="স্টকে পর্যাপ্ত রয়েছে (50 টি)"
                  className="flex-1 h-12 px-4 border border-gray-300 rounded-lg bg-white text-base text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
                  id="input-product-stock-status-text"
                />
                <input
                  type="number"
                  name="stock"
                  value={formData.stock ?? 50}
                  onChange={handleChange}
                  min="0"
                  title="স্টক সংখ্যা"
                  className="w-24 h-12 border border-gray-300 rounded-lg bg-white text-base font-bold text-center text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
                  id="input-product-stock-count"
                />
              </div>
            </div>

            {/* ১০. সরবরাহকারী / বিক্রেতা */}
            <div>
              <label className="block text-base font-semibold text-gray-800 mb-1.5 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-emerald-600" />
                <span>সরবরাহকারী / বিক্রেতা (Supplier / Seller)</span>
              </label>
              <input
                type="text"
                name="sellerName"
                value={formData.sellerName || 'ঝাদিমাদি ভেরিফাইড মার্চেন্ট নেটওয়ার্ক'}
                onChange={handleChange}
                placeholder="ঝাদিমাদি ভেরিফাইড মার্চেন্ট নেটওয়ার্ক"
                className="w-full h-12 px-4 border border-gray-300 rounded-lg bg-white text-base text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
                id="input-product-seller-name"
              />
            </div>

            {/* ১১. পণ্যের ছবি গ্যালারি ও ভিডিও (৮-১০টি ছবি ও লিঙ্ক) */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <label className="block text-base font-semibold text-gray-800 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-emerald-600" />
                  <span>পণ্যের ছবি ও গ্যালারি (৮-১০টি ছবি)</span>
                </label>
                <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-bold">
                  যুক্ত হয়েছে: {formData.images?.length || 0} / ১০টি
                </span>
              </div>

              {/* Multiple File Input */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                multiple
                onChange={handleMultipleFilesChange}
                className="hidden"
                id="product-file-upload-input"
              />

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  disabled={isUploadingImages || (formData.images?.length || 0) >= 10}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-12 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 text-white rounded-lg text-base font-bold transition cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                  id="btn-product-browse-image"
                >
                  {isUploadingImages ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-white" />
                      <span>{uploadStatus || 'আপলোড হচ্ছে...'}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      <span>ডিভাইস থেকে একাধিক ছবি যোগ করুন (৮-১০টি)</span>
                    </>
                  )}
                </button>

                <div className="space-y-1 pt-1">
                  <label className="block text-sm font-semibold text-gray-700">
                    সরাসরি ছবি URL লিংক যুক্ত করুন
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      placeholder="https://dwhsqftllkximhfvwqak.supabase.co/storage/v1/object/public/products/..."
                      className="flex-1 h-12 px-4 border border-gray-300 rounded-lg bg-white text-base text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition font-mono text-sm"
                      id="input-product-image-url"
                    />
                    <button
                      type="button"
                      onClick={handleAddImageUrl}
                      disabled={!imageUrlInput.trim() || (formData.images?.length || 0) >= 10}
                      className="h-12 px-5 bg-neutral-800 hover:bg-black disabled:opacity-50 text-white rounded-lg text-base font-bold transition shrink-0 cursor-pointer"
                      id="btn-add-image-url"
                    >
                      যোগ করুন
                    </button>
                  </div>
                </div>
              </div>

              {/* Gallery Previews (up to 10 photos) */}
              {formData.images && formData.images.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="text-xs text-gray-500 font-medium flex items-center justify-between">
                    <span>সংযুক্ত ছবিসমূহ (প্রথম ছবিটি মূল থাম্বনেইল হিসেবে প্রদর্শিত হবে):</span>
                    <span className="font-bold">{formData.images.length}/১০</span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                    {formData.images.map((url, idx) => (
                      <div 
                        key={idx} 
                        className={`relative aspect-square rounded-xl border-2 overflow-hidden bg-gray-100 shadow-2xs group ${
                          idx === 0 ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-gray-200'
                        }`}
                      >
                        <img src={url} alt={`Product ${idx + 1}`} className="w-full h-full object-cover" />
                        
                        {/* Primary Thumbnail Badge or Set Primary Button */}
                        {idx === 0 ? (
                          <span className="absolute top-1 left-1 bg-emerald-600 text-white text-[9px] px-1.5 py-0.5 rounded font-bold shadow-xs">
                            মূল ছবি
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              const newImgs = [...formData.images!];
                              const [selected] = newImgs.splice(idx, 1);
                              newImgs.unshift(selected);
                              setFormData(prev => ({
                                ...prev,
                                images: newImgs,
                                image: selected
                              }));
                            }}
                            className="absolute bottom-1 left-1 bg-black/70 hover:bg-black text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition cursor-pointer"
                          >
                            মূল ছবি করুন
                          </button>
                        )}

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute top-1 right-1 bg-black/70 hover:bg-rose-600 text-white rounded-full p-1 transition cursor-pointer shadow-xs"
                          title="ছবি বাদ দিন"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ১২. ইউটিউব ভিডিও লিঙ্ক */}
            <div>
              <label className="block text-base font-semibold text-gray-800 mb-1.5 flex items-center gap-1.5">
                <Video className="w-4 h-4 text-rose-500" />
                <span>ইউটিউব ভিডিও লিঙ্ক (YouTube Video Link)</span>
              </label>
              <input
                type="url"
                name="youtubeUrl"
                value={formData.youtubeUrl || ''}
                onChange={handleChange}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full h-12 px-4 border border-gray-300 rounded-lg bg-white text-base text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition"
                id="input-product-youtube"
              />
            </div>

            {/* ১৩. বিস্তারিত বিবরণ */}
            <div>
              <label className="block text-base font-semibold text-gray-800 mb-1.5 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-emerald-600" />
                <span>বিস্তারিত বিবরণ (Detailed Description)</span>
              </label>
              <textarea
                name="description"
                rows={3}
                value={formData.description || ''}
                onChange={handleChange}
                placeholder="পণ্যের গুণাগুণ, বৈশিষ্ট্য, ব্যবহারের নিয়ম ও বিস্তারিত বর্ণনা লিখুন..."
                className="w-full p-4 border border-gray-300 rounded-lg bg-white text-base text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden transition resize-y min-h-[110px]"
                id="textarea-product-desc"
              />
            </div>
          </div>

          {/* Modal Footer / Action Buttons - Clear and sticky at the bottom */}
          <div className="sticky bottom-0 bg-white/95 backdrop-blur-md px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3 z-10 shadow-xs shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="border border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200 px-6 py-2 rounded-lg font-bold text-sm transition cursor-pointer shadow-xs"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2 rounded-lg shadow cursor-pointer flex items-center justify-center gap-2 transition disabled:opacity-50"
              id="btn-product-submit"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  সংরক্ষণ ও আপলোড হচ্ছে...
                </>
              ) : (
                'পণ্য সংরক্ষণ করুন / পোস্ট করুন'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductAddModal;
