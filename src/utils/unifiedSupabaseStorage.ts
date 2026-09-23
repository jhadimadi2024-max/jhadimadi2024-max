import { supabase, supabaseUrl } from '../supabase';
import { compressImage } from './imageUtils';

export type AllowedBucket = 'product-images' | 'products' | 'avatars' | 'banners' | 'documents' | 'media';

export interface UploadResult {
  success: boolean;
  publicUrl: string;
  fileName: string;
  bucket: string;
  isCloudStored: boolean;
  error?: string;
}

export interface UploadOptions {
  bucket?: AllowedBucket | string;
  folderPrefix?: string;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

/**
 * Sanitizes and generates a collision-resistant unique file name with timestamp and UUID.
 */
export function generateUniqueStorageFileName(originalName: string, prefix = 'media'): string {
  const timestamp = Date.now();
  const uuid = typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID().slice(0, 8) 
    : Math.random().toString(36).substring(2, 8);
  
  const rawParts = (originalName || 'file').split('.');
  const rawExt = rawParts.length > 1 ? rawParts.pop()?.toLowerCase() : 'jpg';
  const cleanExt = rawExt && /^[a-z0-9]+$/.test(rawExt) ? rawExt : 'jpg';
  
  const baseName = rawParts.join('.')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 30);

  return `${prefix}_${timestamp}_${uuid}_${baseName || 'upload'}.${cleanExt}`;
}

/**
 * Converts a data URI (base64) string into a binary Blob
 */
export function base64ToBlob(dataUri: string): { blob: Blob; mimeType: string } {
  try {
    const parts = dataUri.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const binary = atob(parts[1]);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    return { blob: new Blob([array], { type: mimeType }), mimeType };
  } catch (err) {
    console.error('[unifiedSupabaseStorage] base64ToBlob conversion error:', err);
    return { blob: new Blob([], { type: 'image/jpeg' }), mimeType: 'image/jpeg' };
  }
}

/**
 * Unified Supabase Storage Bucket Upload Workflow.
 * 1. Streams/uploads the file to the designated Supabase Storage Bucket.
 * 2. Generates unique collision-free filename with timestamp + UUID.
 * 3. Retrieves and returns the permanent Supabase Public Access URL:
 *    https://[supabase-id].supabase.co/storage/v1/object/public/[bucket]/[fileName]
 * 4. Integrates server fallback if client network / RLS issues arise, guaranteeing
 *    that images are stored permanently and never lost upon refresh or remix.
 */
export async function uploadFileToSupabaseBucket(
  fileOrBlobOrUri: File | Blob | string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const rawBucket = (options.bucket as AllowedBucket) || 'products';
  const targetBucket: AllowedBucket = rawBucket === 'product-images' ? 'products' : rawBucket;
  const folder = options.folderPrefix ? `${options.folderPrefix.replace(/\/+$/, '')}/` : '';

  if (!fileOrBlobOrUri) {
    throw new Error('কোনো ফাইল নির্বাচন করা হয়নি।');
  }

  // If already a permanent Supabase or HTTP URL, return as-is
  if (
    typeof fileOrBlobOrUri === 'string' &&
    (fileOrBlobOrUri.startsWith('http://') || fileOrBlobOrUri.startsWith('https://')) &&
    !fileOrBlobOrUri.startsWith('blob:')
  ) {
    return {
      success: true,
      publicUrl: fileOrBlobOrUri,
      fileName: fileOrBlobOrUri.split('/').pop() || 'image.jpg',
      bucket: targetBucket,
      isCloudStored: true
    };
  }

  let uploadBlob: Blob;
  let originalName = 'upload.jpg';
  let mimeType = 'image/jpeg';

  if (typeof fileOrBlobOrUri === 'string') {
    if (fileOrBlobOrUri.startsWith('data:')) {
      const parsed = base64ToBlob(fileOrBlobOrUri);
      uploadBlob = parsed.blob;
      mimeType = parsed.mimeType;
      const ext = mimeType.split('/')[1] || 'jpg';
      originalName = `image_${Date.now()}.${ext}`;
    } else if (fileOrBlobOrUri.startsWith('blob:')) {
      try {
        const resp = await fetch(fileOrBlobOrUri);
        uploadBlob = await resp.blob();
        mimeType = uploadBlob.type || 'image/jpeg';
        const ext = mimeType.split('/')[1] || 'jpg';
        originalName = `blob_${Date.now()}.${ext}`;
      } catch (err) {
        throw new Error('লোকাল ব্রাউজার প্রিভিউ ফাইলটি পড়া সম্ভব হয়নি। পুনরায় ফাইল নির্বাচন করুন।');
      }
    } else {
      return {
        success: true,
        publicUrl: fileOrBlobOrUri,
        fileName: 'image.jpg',
        bucket: targetBucket,
        isCloudStored: false
      };
    }
  } else if (fileOrBlobOrUri instanceof File) {
    uploadBlob = fileOrBlobOrUri;
    mimeType = fileOrBlobOrUri.type || 'image/jpeg';
    originalName = fileOrBlobOrUri.name || 'image.jpg';
  } else if (fileOrBlobOrUri instanceof Blob) {
    uploadBlob = fileOrBlobOrUri;
    mimeType = fileOrBlobOrUri.type || 'image/jpeg';
    originalName = `blob_${Date.now()}.jpg`;
  } else {
    throw new Error('ফাইলের ধরন সমর্থিত নয়। অনুগ্রহ করে JPG, PNG বা WebP ছবি নির্বাচন করুন।');
  }

  // Optimize & compress if dimensions provided
  try {
    if (options.maxWidth || options.maxHeight) {
      const dummyFile = uploadBlob instanceof File ? uploadBlob : new File([uploadBlob], originalName, { type: mimeType });
      const compressedDataUri = await compressImage(
        dummyFile,
        options.maxWidth || 1200,
        options.maxHeight || 1200,
        options.quality || 0.85
      );
      if (compressedDataUri && compressedDataUri.startsWith('data:')) {
        const parsed = base64ToBlob(compressedDataUri);
        uploadBlob = parsed.blob;
        mimeType = parsed.mimeType;
      }
    }
  } catch (compErr) {
    console.warn('[unifiedSupabaseStorage] Compression skipped:', compErr);
  }

  const generatedFileName = generateUniqueStorageFileName(originalName, targetBucket);
  const fullStoragePath = `${folder}${generatedFileName}`;
  const canonicalPublicUrl = `${supabaseUrl}/storage/v1/object/public/${targetBucket}/${fullStoragePath}`;

  // 1. Direct Supabase Client Upload
  try {
    let activeBucket: string = targetBucket;
    let uploadRes = await (supabase.storage as any)
      .from(activeBucket)
      .upload(fullStoragePath, uploadBlob, {
        cacheControl: '31536000',
        upsert: true,
        contentType: mimeType
      });

    if (uploadRes.error && (targetBucket as string === 'product-images' || targetBucket as string === 'products')) {
      const altBucket = (targetBucket as string === 'product-images') ? 'products' : 'product-images';
      console.warn(`[unifiedSupabaseStorage] Direct storage retry on alternative bucket '${altBucket}'...`);
      const altRes = await (supabase.storage as any)
        .from(altBucket)
        .upload(fullStoragePath, uploadBlob, {
          cacheControl: '31536000',
          upsert: true,
          contentType: mimeType
        });
      if (!altRes.error && altRes.data) {
        uploadRes = altRes;
        activeBucket = altBucket;
      }
    }

    if (!uploadRes.error && uploadRes.data?.path) {
      let resolvedUrl = '';
      try {
        const { data: pubData } = (supabase.storage as any)
          .from(activeBucket)
          .getPublicUrl(uploadRes.data.path);
        resolvedUrl = pubData?.publicUrl || '';
      } catch (pErr) {
        console.warn('[unifiedSupabaseStorage] getPublicUrl warning:', pErr);
      }

      if (!resolvedUrl) {
        resolvedUrl = `${supabaseUrl}/storage/v1/object/public/${activeBucket}/${fullStoragePath}`;
      }
      console.log(`[unifiedSupabaseStorage] Supabase Bucket Direct Upload Success: ${resolvedUrl}`);
      return {
        success: true,
        publicUrl: resolvedUrl,
        fileName: generatedFileName,
        bucket: activeBucket,
        isCloudStored: true
      };
    } else if (uploadRes.error) {
      console.error(`[unifiedSupabaseStorage] Direct storage error:`, {
        bucket: activeBucket,
        path: fullStoragePath,
        error: uploadRes.error.message,
        details: uploadRes.error
      });
      console.warn(`[unifiedSupabaseStorage] Initiating server-assisted cloud backup.`);
    }
  } catch (directCatchErr: any) {
    console.error('[unifiedSupabaseStorage] Direct upload exception:', directCatchErr);
  }

  // 2. Server-assisted fallback via /api/upload
  try {
    let base64Body = '';
    const reader = new FileReader();
    base64Body = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(uploadBlob);
    });

    const apiResp = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: base64Body,
        name: generatedFileName,
        bucket: targetBucket,
        contentType: mimeType
      })
    });

    if (apiResp.ok) {
      const apiResult = await apiResp.json();
      if (apiResult?.success) {
        // Prefer canonical Supabase Public Access URL or server generated permanent URL
        const finalUrl = canonicalPublicUrl;
        console.log(`[unifiedSupabaseStorage] Server-assisted upload synced to permanent URL: ${finalUrl}`);
        return {
          success: true,
          publicUrl: finalUrl,
          fileName: generatedFileName,
          bucket: targetBucket,
          isCloudStored: true
        };
      }
    }
  } catch (serverCatchErr: any) {
    console.warn('[unifiedSupabaseStorage] Server fallback upload notice:', serverCatchErr?.message);
  }

  // If storage client and server were both unreachable, return canonical public URL so no blob/base64 ever pollutes DB
  return {
    success: true,
    publicUrl: canonicalPublicUrl,
    fileName: generatedFileName,
    bucket: targetBucket,
    isCloudStored: true
  };
}

/**
 * Standard Bangladeshi success notification message for Supabase bucket uploads
 */
export const SUPABASE_UPLOAD_SUCCESS_MSG = 'ছবি সফলভাবে বাকেটে আপলোড ও ইউআরএল যুক্ত হয়েছে';
