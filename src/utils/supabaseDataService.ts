import { supabase, isSupabaseConfigured, supabaseUrl } from '../supabase';
import { isNetworkError, notifyNetworkError } from './networkRetry';
import { compressImage } from './imageUtils';

/**
 * Universal Fallback Image URLs when Storage Upload fails or is unavailable
 */
export const FALLBACK_PRODUCT_IMAGE = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80';
export const FALLBACK_AVATAR_IMAGE = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80';
export const FALLBACK_CIRCULAR_IMAGE = 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&auto=format&fit=crop&q=80';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Converts a data URI (Base64) string into a binary Blob for direct Supabase Storage uploads.
 */
function dataUriToBlob(dataURI: string): Blob {
  try {
    const parts = dataURI.split(',');
    const mimeString = parts[0].split(':')[1]?.split(';')[0] || 'image/jpeg';
    const byteString = atob(parts[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  } catch (e) {
    console.warn('[dataUriToBlob] Parsing error, returning empty blob:', e);
    return new Blob([], { type: 'image/jpeg' });
  }
}

/**
 * Smart file/image uploader that uploads directly to Supabase Storage.
 * If the upload fails for ANY reason (network, missing bucket, permissions),
 * it logs the error, falls back to a graceful CDN URL, and NEVER saves raw Base64 to DB!
 */
export async function smartSupabaseUpload(
  bucketName: string,
  fileOrBlob: File | Blob | string,
  fileNamePrefix: string = 'media'
): Promise<{ url: string; isFallback: boolean; error?: string }> {
  // If already an external HTTP URL, return as-is
  if (typeof fileOrBlob === 'string' && fileOrBlob.startsWith('http') && !fileOrBlob.includes('blob:')) {
    return { url: fileOrBlob, isFallback: false };
  }

  const fallbackUrl = bucketName === 'avatars' ? FALLBACK_AVATAR_IMAGE : FALLBACK_PRODUCT_IMAGE;

  if (!isSupabaseConfigured || !supabase) {
    console.warn(`[Supabase Storage] Supabase not configured. Using fallback image for bucket '${bucketName}'.`);
    return { url: fallbackUrl, isFallback: true };
  }

  try {
    let uploadData: Blob | File;
    let contentType = 'image/jpeg';
    let fileExt = 'jpg';

    if (typeof fileOrBlob === 'string') {
      if (fileOrBlob.startsWith('data:')) {
        // Convert Base64 data URI directly to binary Blob
        uploadData = dataUriToBlob(fileOrBlob);
        contentType = uploadData.type || 'image/jpeg';
        if (contentType.includes('png')) fileExt = 'png';
        if (contentType.includes('webp')) fileExt = 'webp';
      } else {
        // Local blob URL (e.g. blob:http://...)
        try {
          const res = await fetch(fileOrBlob);
          uploadData = await res.blob();
          contentType = uploadData.type || 'image/jpeg';
          if (contentType.includes('png')) fileExt = 'png';
          if (contentType.includes('webp')) fileExt = 'webp';
        } catch (fetchErr: any) {
          console.error(`[Supabase Storage Upload Error] Failed to read blob string for ${bucketName}:`, fetchErr);
          return { url: fallbackUrl, isFallback: true, error: fetchErr?.message };
        }
      }
    } else {
      uploadData = fileOrBlob;
      contentType = fileOrBlob.type || 'image/jpeg';
      if (fileOrBlob instanceof File && fileOrBlob.name) {
        const parts = fileOrBlob.name.split('.');
        if (parts.length > 1) {
          fileExt = (parts.pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        }
      }
    }

    const uniqueId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Math.random().toString(36).substring(2, 10)}`;
    const uniqueFileName = `${fileNamePrefix}_${Date.now()}_${uniqueId}.${fileExt}`;

    const isProductBucket = bucketName === 'product-images' || bucketName === 'products';
    const primaryBucket = isProductBucket ? 'products' : bucketName;
    const fallbackBucket = isProductBucket ? 'product-images' : bucketName;

    let targetBucketUsed = primaryBucket;
    let { error: storageError } = await supabase.storage
      .from(primaryBucket)
      .upload(uniqueFileName, uploadData, {
        cacheControl: '3600',
        upsert: true,
        contentType
      });

    if (storageError && isProductBucket) {
      console.error(`[Supabase Storage] Upload to '${primaryBucket}' failed:`, {
        bucket: primaryBucket,
        file: uniqueFileName,
        error: storageError.message,
        details: storageError,
      });
      console.warn(`[Supabase Storage] Attempting fallback to '${fallbackBucket}'...`);
      const retryRes = await supabase.storage
        .from(fallbackBucket)
        .upload(uniqueFileName, uploadData, {
          cacheControl: '3600',
          upsert: true,
          contentType
        });
      if (!retryRes.error) {
        storageError = null;
        targetBucketUsed = fallbackBucket;
      } else {
        console.error(`[Supabase Storage] Fallback to '${fallbackBucket}' failed:`, {
          bucket: fallbackBucket,
          file: uniqueFileName,
          error: retryRes.error.message,
          details: retryRes.error,
        });
      }
    }

    if (storageError) {
      console.warn(`[Supabase Storage Upload Warning on bucket '${bucketName}']:`, storageError.message);
      // Return clean fallback URL — NEVER insert raw Base64 data into database columns!
      return {
        url: fallbackUrl,
        isFallback: true,
        error: storageError.message
      };
    }

    const { data: publicUrlData } = supabase.storage
      .from(targetBucketUsed)
      .getPublicUrl(uniqueFileName);

    const publicUrl = publicUrlData?.publicUrl || `${supabaseUrl}/storage/v1/object/public/${targetBucketUsed}/${uniqueFileName}`;
    console.info(`[Supabase Storage] Successfully uploaded to '${targetBucketUsed}':`, publicUrl);
    return { url: publicUrl, isFallback: false };
  } catch (err: any) {
    console.error(`[Supabase Storage Exception on bucket '${bucketName}']:`, err);
    return {
      url: fallbackUrl,
      isFallback: true,
      error: err?.message || 'Storage upload exception'
    };
  }
}

/**
 * Smart adaptive Supabase Insert:
 * 1. Checks and cleans up IDs (avoids passing string prefixes like 'prod_1' to PostgreSQL BIGINT columns).
 * 2. Attempts insertion with .select()
 * 3. If PostgREST returns PGRST204 ("Could not find the 'xyz' column of 'table' in the schema cache"),
 *    it dynamically extracts 'xyz', strips it from the payload, logs to console, and retries.
 * 4. If RLS returns 42501 (permission denied), it attempts a plain insert without .select(), and logs clear diagnostics.
 * 5. Guarantees visible console.error logging on every Supabase call!
 */
export async function smartSupabaseInsert<T = any>(
  tableName: string,
  rawPayload: Record<string, any>
): Promise<{ success: boolean; data?: T; error?: any; strippedColumns?: string[]; isNetworkError?: boolean; networkErrorMessage?: string; tableNotFound?: boolean; isDuplicate?: boolean; errorCode?: string; errorMessage?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    const err = new Error('Supabase client is not configured or offline');
    console.error(`[Supabase INSERT error on '${tableName}']:`, err);
    return { success: false, error: err };
  }

  const payload: Record<string, any> = { ...rawPayload };

  // For 'products' table, ALWAYS remove 'id' on insert so Supabase auto-generates a valid UUID via gen_random_uuid()!
  if (tableName === 'products') {
    delete payload.id;
    // Ensure seller_id and category_id are valid UUIDs or omitted (avoids invalid input syntax for type uuid)
    if (payload.seller_id && !UUID_REGEX.test(String(payload.seller_id).trim())) {
      console.info(`[smartSupabaseInsert] Omitted non-UUID seller_id: "${payload.seller_id}" for '${tableName}'.`);
      delete payload.seller_id;
    }
    if (payload.category_id && !UUID_REGEX.test(String(payload.category_id).trim())) {
      console.info(`[smartSupabaseInsert] Omitted non-UUID category_id: "${payload.category_id}" for '${tableName}'.`);
      delete payload.category_id;
    }
    // Strictly block Base64 and Blob strings under any condition
    if (typeof payload.image === 'string' && (payload.image.startsWith('data:') || payload.image.startsWith('blob:'))) {
      delete payload.image;
    }
    if (typeof payload.image_url === 'string' && (payload.image_url.startsWith('data:') || payload.image_url.startsWith('blob:'))) {
      delete payload.image_url;
    }
    if (Array.isArray(payload.images)) {
      payload.images = payload.images.filter((img: any) => typeof img === 'string' && !img.startsWith('data:') && !img.startsWith('blob:'));
      if (!payload.image_url && payload.images.length > 0) {
        payload.image_url = payload.images[0];
      }
    }
    if (Array.isArray(payload.products_photos)) {
      payload.products_photos = payload.products_photos.filter((img: any) => typeof img === 'string' && !img.startsWith('data:') && !img.startsWith('blob:'));
    }
    // Ensure published status by default
    if (!payload.status) {
      payload.status = 'published';
    }
  } else if (tableName === 'blood_donors') {
    // Proactive schema alignment for 'blood_donors':
    // Map ONLY valid existing columns: full_name, phone_number, whatsapp_number, blood_group, district, upazila, last_donation_date, password, latitude, longitude
    // Strip out non-existent columns: district_unique_id, division, is_available, verified, available, area, profession, etc.
    delete payload.district_unique_id;
    delete payload.unique_id;
    delete payload.division;
    delete payload.area;
    delete payload.is_available;
    delete payload.available;
    delete payload.verified;
    delete payload.consent_given;
    delete payload.profession;
    delete payload.total_donations;
    delete payload.emergency_contact;
    delete payload.age;
    delete payload.created_at;
    delete payload.updated_at;
    delete payload.status;
    delete payload.pass_word;

    // Ensure full_name and phone_number are populated
    if (!payload.full_name && payload.name) {
      payload.full_name = payload.name;
    }
    delete payload.name;

    if (!payload.phone_number && payload.phone) {
      payload.phone_number = payload.phone;
    }
    delete payload.phone;

    if (!payload.whatsapp_number) {
      payload.whatsapp_number = payload.phone_number || '';
    }
    delete payload.whatsapp;

    // Default blood group if missing
    if (!payload.blood_group) {
      payload.blood_group = payload.bloodGroup || 'O+';
    }
    delete payload.bloodGroup;

    // Format last_donation_date
    if (payload.lastDonationDate && !payload.last_donation_date) {
      payload.last_donation_date = payload.lastDonationDate;
    }
    delete payload.lastDonationDate;
    if (payload.last_donation_date === 'N/A' || payload.last_donation_date === '' || payload.last_donation_date === undefined) {
      payload.last_donation_date = null;
    }

    // Latitude & Longitude fallback: explicit null if missing, undefined, or string "N/A"
    if (payload.latitude === undefined || payload.latitude === null || payload.latitude === 'N/A' || payload.latitude === '') {
      payload.latitude = null;
    } else {
      const p = Number(payload.latitude);
      payload.latitude = !isNaN(p) ? p : null;
    }

    if (payload.longitude === undefined || payload.longitude === null || payload.longitude === 'N/A' || payload.longitude === '') {
      payload.longitude = null;
    } else {
      const p = Number(payload.longitude);
      payload.longitude = !isNaN(p) ? p : null;
    }

    // Clean string IDs if bigint serial
    if (
      payload.id !== undefined &&
      payload.id !== null &&
      (isNaN(Number(payload.id)) || (typeof payload.id === 'string' && (payload.id.includes('_') || payload.id.includes('-'))))
    ) {
      delete payload.id;
    }
  } else if (tableName !== 'profiles') {
    // If table uses auto-incrementing serial/bigint ID and payload has a non-numeric string ID or UUID,
    // delete payload.id so Postgres assigns the auto-generated serial ID!
    if (
      payload.id !== undefined &&
      payload.id !== null &&
      (isNaN(Number(payload.id)) || (typeof payload.id === 'string' && (payload.id.includes('_') || payload.id.includes('-') || payload.id.length > 15)))
    ) {
      delete payload.id;
    }
  } else {
    // For 'profiles' table, id must be a valid UUID
    if (!payload.id || !UUID_REGEX.test(String(payload.id))) {
      payload.id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0');
    }
  }

  const strippedColumns: string[] = [];
  const maxRetries = 15;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .insert([payload])
        .select();

      if (!error) {
        console.info(`[Supabase INSERT SUCCESS on '${tableName}']`, data && data[0] ? data[0] : payload);
        return {
          success: true,
          data: data && data.length > 0 ? (data[0] as T) : (payload as any),
          strippedColumns
        };
      }

      // Check for Unique Constraint Violation (PostgreSQL error code 23505)
      if (
        error.code === '23505' ||
        error.message?.includes('duplicate key') ||
        error.message?.toLowerCase().includes('unique constraint') ||
        error.details?.includes('already exists')
      ) {
        const duplicateMsg = tableName === 'blood_donors'
          ? 'এই ফোন নম্বরটি দিয়ে পূর্বেই রক্তদাতা হিসেবে রেজিস্ট্রেশন করা হয়েছে। অনুগ্রহ করে লগইন করুন অথবা অন্য নম্বর দিন।'
          : 'এই তথ্যটি (ফোন নম্বর/NID/ইমেইল) দিয়ে পূর্বেই রেজিস্ট্রেশন করা হয়েছে। অনুগ্রহ করে অন্য তথ্য দিন।';
        console.warn(`[Supabase Unique Constraint 23505 on '${tableName}']:`, error.message);
        return {
          success: false,
          error,
          isDuplicate: true,
          errorCode: '23505',
          errorMessage: duplicateMsg,
          strippedColumns
        };
      }

      // Handle NOT NULL constraint violations (PostgreSQL error code 23502)
      // e.g. 'null value in column "name" of relation "products" violates not-null constraint'
      if (
        error.code === '23502' ||
        error.message?.includes('violates not-null constraint') ||
        error.message?.includes('null value in column')
      ) {
        const notNullMatch = error.message.match(/null value in column "([^"]+)"/i);
        const colName = notNullMatch ? notNullMatch[1] : null;
        console.warn(`[Supabase Not-Null Constraint 23502 on '${tableName}']: Column '${colName || 'unknown'}' requires a non-null value.`);

        if (colName) {
          if (tableName === 'products') {
            const fallbackName = String(
              payload.name ||
              payload.product_name ||
              payload.products_name ||
              payload.name_bn ||
              payload.title ||
              payload.title_bn ||
              rawPayload.name ||
              rawPayload.nameBn ||
              rawPayload.product_name ||
              rawPayload.title ||
              'নতুন পণ্য'
            ).trim();

            if (['name', 'product_name', 'products_name', 'name_bn', 'title', 'title_bn'].includes(colName)) {
              payload[colName] = fallbackName;
              console.info(`[Supabase 23502 Fix] Set '${colName}' = '${fallbackName}', retrying insert...`);
              continue;
            }
            if (['price', 'regular_price', 'discount_price'].includes(colName)) {
              payload[colName] = Number(rawPayload[colName] ?? rawPayload.price ?? 0);
              console.info(`[Supabase 23502 Fix] Set '${colName}' = ${payload[colName]}, retrying insert...`);
              continue;
            }
            if (['unit', 'unit_pack'].includes(colName)) {
              payload[colName] = String(rawPayload.unit || rawPayload.unit_pack || '১ পিস').trim();
              console.info(`[Supabase 23502 Fix] Set '${colName}' = '${payload[colName]}', retrying insert...`);
              continue;
            }
            if (['stock', 'stock_quantity'].includes(colName)) {
              payload[colName] = Number(rawPayload.stock ?? rawPayload.stock_quantity ?? 10);
              console.info(`[Supabase 23502 Fix] Set '${colName}' = ${payload[colName]}, retrying insert...`);
              continue;
            }
            if (['category', 'category_bn'].includes(colName)) {
              payload[colName] = String(rawPayload.category || rawPayload.category_bn || 'অন্যান্য').trim();
              console.info(`[Supabase 23502 Fix] Set '${colName}' = '${payload[colName]}', retrying insert...`);
              continue;
            }
            if (['image_url', 'image', 'products_photos'].includes(colName)) {
              payload[colName] = String(rawPayload.image_url || rawPayload.image || rawPayload.products_photos || '/placeholder-product.svg').trim();
              console.info(`[Supabase 23502 Fix] Set '${colName}' = '${payload[colName]}', retrying insert...`);
              continue;
            }
          }
          // General fallback for any other not-null column
          payload[colName] = rawPayload[colName] || (typeof rawPayload[colName] === 'number' ? 0 : 'N/A');
          console.info(`[Supabase 23502 Fix] Set '${colName}' = '${payload[colName]}', retrying insert...`);
          continue;
        }
      }

      // Handle invalid UUID syntax (e.g. invalid input syntax for type uuid: "15")
      if (error.message?.includes('invalid input syntax for type uuid') || error.code === '22P02') {
        let repaired = false;
        if (payload.id) {
          delete payload.id;
          repaired = true;
          console.info(`[Supabase UUID Fix] Removed invalid 'id' from '${tableName}', retrying insert...`);
        }
        if (payload.seller_id && !UUID_REGEX.test(String(payload.seller_id).trim())) {
          delete payload.seller_id;
          repaired = true;
          console.info(`[Supabase UUID Fix] Removed invalid 'seller_id' from '${tableName}', retrying insert...`);
        }
        if (payload.category_id && !UUID_REGEX.test(String(payload.category_id).trim())) {
          delete payload.category_id;
          repaired = true;
          console.info(`[Supabase UUID Fix] Removed invalid 'category_id' from '${tableName}', retrying insert...`);
        }
        for (const key of Object.keys(payload)) {
          if ((key.endsWith('_id') || key.toLowerCase().includes('uuid')) && payload[key] && !UUID_REGEX.test(String(payload[key]).trim())) {
            delete payload[key];
            repaired = true;
            console.info(`[Supabase UUID Fix] Removed non-UUID '${key}' from '${tableName}', retrying insert...`);
          }
        }
        if (repaired) {
          continue;
        }
      }

      // If table itself is missing from database (PGRST205), stop immediately without burning retries
      if (error.code === 'PGRST205' || error.message.includes('Could not find the table')) {
        console.warn(`[Supabase Table Missing] Table '${tableName}' does not exist in Supabase database. Please create it or run migration.`);
        return { success: false, error, strippedColumns, tableNotFound: true };
      }

      console.error(`[Supabase INSERT error on '${tableName}'] (attempt ${attempt + 1}/${maxRetries}):`, error);

      // Handle missing schema column error (PGRST204)
      if (error.code === 'PGRST204' || error.message.includes('Could not find')) {
        const match = error.message.match(/Could not find the '([^']+)' column/i);
        if (match && match[1]) {
          const missingColumn = match[1];
          console.warn(`[Supabase Adaptive Schema] Column '${missingColumn}' not found in '${tableName}'. Stripping and retrying...`);
          delete payload[missingColumn];
          strippedColumns.push(missingColumn);
          continue;
        }
      }

      // Handle RLS permission denied (42501)
      if (error.code === '42501' || error.message.toLowerCase().includes('permission denied')) {
        console.warn(`[Supabase RLS Warning] Permission restricted (42501) on table '${tableName}'. Attempting plain insert without .select()...`);
        try {
          const { error: plainErr } = await supabase.from(tableName).insert([payload]);
          if (!plainErr) {
            console.info(`[Supabase INSERT SUCCESS via plain insert on '${tableName}']`);
            return { success: true, data: payload as any, strippedColumns };
          }
          if (
            plainErr.code === '23505' ||
            plainErr.message?.includes('duplicate key') ||
            plainErr.message?.toLowerCase().includes('unique constraint')
          ) {
            return {
              success: false,
              error: plainErr,
              isDuplicate: true,
              errorCode: '23505',
              errorMessage: 'এই তথ্যটি (ফোন নম্বর/NID/ইমেইল) দিয়ে পূর্বেই রেজিস্ট্রেশন করা হয়েছে। অনুগ্রহ করে অন্য তথ্য দিন।',
              strippedColumns
            };
          }
          console.error(`[Supabase RLS plain insert also failed on '${tableName}']:`, plainErr);
        } catch (plainEx: any) {
          if (
            plainEx?.code === '23505' ||
            plainEx?.message?.includes('duplicate key') ||
            plainEx?.message?.toLowerCase().includes('unique constraint')
          ) {
            return {
              success: false,
              error: plainEx,
              isDuplicate: true,
              errorCode: '23505',
              errorMessage: 'এই তথ্যটি (ফোন নম্বর/NID/ইমেইল) দিয়ে পূর্বেই রেজিস্ট্রেশন করা হয়েছে। অনুগ্রহ করে অন্য তথ্য দিন।',
              strippedColumns
            };
          }
          console.error(`[Supabase RLS retry exception on '${tableName}']:`, plainEx);
        }
      }

      if (isNetworkError(error)) {
        console.warn(`[Supabase Network Disconnected on '${tableName}']`, error);
        notifyNetworkError({
          message: 'Network error. Please reconnect to the internet and try again.',
          source: tableName,
          originalError: error,
        });
        return { success: false, error, strippedColumns, isNetworkError: true };
      }

      return { success: false, error, strippedColumns };
    } catch (ex: any) {
      if (
        ex?.code === '23505' ||
        ex?.message?.includes('duplicate key') ||
        ex?.message?.toLowerCase().includes('unique constraint')
      ) {
        return {
          success: false,
          error: ex,
          isDuplicate: true,
          errorCode: '23505',
          errorMessage: 'এই তথ্যটি (ফোন নম্বর/NID/ইমেইল) দিয়ে পূর্বেই রেজিস্ট্রেশন করা হয়েছে। অনুগ্রহ করে অন্য তথ্য দিন।',
          strippedColumns
        };
      }
      console.error(`[Supabase INSERT Exception on '${tableName}']:`, ex);
      if (isNetworkError(ex)) {
        notifyNetworkError({
          message: 'Network error. Please reconnect to the internet and try again.',
          source: tableName,
          originalError: ex,
        });
        return { success: false, error: ex, strippedColumns, isNetworkError: true };
      }
      return { success: false, error: ex, strippedColumns };
    }
  }

  const overflowErr = new Error(`Too many missing columns stripped on table '${tableName}'`);
  console.error(`[Supabase INSERT error on '${tableName}']:`, overflowErr);
  return { success: false, error: overflowErr, strippedColumns };
}

/**
 * Smart Supabase Delete:
 * Handles numeric and BIGINT ID constraints cleanly.
 * If given string like 'prod_4', extracts the numeric ID.
 * Returns true if successful and logs any error to console.
 */
export async function smartSupabaseDelete(
  tableName: string,
  id: string | number
): Promise<{ success: boolean; error?: any; isNetworkError?: boolean }> {
  if (!isSupabaseConfigured || !supabase) {
    const err = new Error('Supabase client is not configured or offline');
    console.error(`[Supabase DELETE error on '${tableName}']:`, err);
    return { success: false, error: err };
  }

  try {
    // 1. If ID is already a number or numeric string
    if (!isNaN(Number(id))) {
      const { error } = await supabase.from(tableName).delete().eq('id', Number(id));
      if (!error) {
        console.info(`[Supabase DELETE SUCCESS on '${tableName}' for numeric id ${id}]`);
        return { success: true };
      }
      if (isNetworkError(error)) {
        notifyNetworkError({
          message: 'Network error. Please reconnect to the internet and try again.',
          source: tableName,
          originalError: error,
        });
        return { success: false, error, isNetworkError: true };
      }
      console.error(`[Supabase DELETE error with numeric id on '${tableName}']:`, error);
    }

    // 2. If ID has format like 'prod_123' or 'bld_45'
    const digitsOnly = String(id).replace(/\D/g, '');
    if (digitsOnly && digitsOnly.length < 15) {
      const { error } = await supabase.from(tableName).delete().eq('id', Number(digitsOnly));
      if (!error) {
        console.info(`[Supabase DELETE SUCCESS on '${tableName}' for extracted id ${digitsOnly}]`);
        return { success: true };
      }
      if (isNetworkError(error)) {
        notifyNetworkError({
          message: 'Network error. Please reconnect to the internet and try again.',
          source: tableName,
          originalError: error,
        });
        return { success: false, error, isNetworkError: true };
      }
      console.error(`[Supabase DELETE error with extracted digits on '${tableName}']:`, error);
    }

    // 3. Fallback: try raw ID string (for UUID or text id columns)
    const { error: rawErr } = await supabase.from(tableName).delete().eq('id', String(id));
    if (!rawErr) {
      console.info(`[Supabase DELETE SUCCESS on '${tableName}' for string id ${id}]`);
      return { success: true };
    }
    if (isNetworkError(rawErr)) {
      notifyNetworkError({
        message: 'Network error. Please reconnect to the internet and try again.',
        source: tableName,
        originalError: rawErr,
      });
      return { success: false, error: rawErr, isNetworkError: true };
    }

    console.error(`[Supabase DELETE error on '${tableName}']:`, rawErr);
    return { success: false, error: rawErr };
  } catch (err: any) {
    console.error(`[Supabase DELETE Exception on '${tableName}']:`, err);
    if (isNetworkError(err)) {
      notifyNetworkError({
        message: 'Network error. Please reconnect to the internet and try again.',
        source: tableName,
        originalError: err,
      });
      return { success: false, error: err, isNetworkError: true };
    }
    return { success: false, error: err };
  }
}

/**
 * Payload preparers that align fields with the live Supabase schema,
 * while including backward-compatible aliases.
 */

export function prepareProductPayload(raw: Record<string, any>): Record<string, any> {
  const name = String(raw.name || raw.product_name || raw.products_name || raw.name_bn || raw.title || raw.title_bn || raw.nameBn || 'নতুন পণ্য').trim();
  const price = Number(raw.price ?? raw.regular_price ?? raw.unit_price ?? 0);
  
  // Guard against raw Base64 data strings inserted directly into database columns
  let imageUrl = String(raw.image_url || raw.products_photos || raw.image || raw.photo || '').trim();
  if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
    console.warn('[prepareProductPayload] Detected raw base64/blob image in payload; substituting safe fallback image URL to prevent DB bloat.');
    imageUrl = FALLBACK_PRODUCT_IMAGE;
  }

  const category = String(raw.category || raw.category_bn || 'অন্যান্য').trim();
  const desc = String(raw.description || raw.description_bn || raw.short_description || `${name} - তাজা ও নির্ভেজাল পাহাড়ি পণ্য`).trim();
  const rawStock = raw.stock_quantity ?? raw.stock ?? raw.quantity;
  const stock = rawStock !== undefined && rawStock !== null && !isNaN(Number(rawStock)) ? Math.max(0, Number(rawStock)) : 10;
  const unit = String(raw.unit || raw.unit_pack || '১ পিস').trim();
  const badges = Array.isArray(raw.badges) ? raw.badges : (raw.badge ? [String(raw.badge)] : []);
  const keyHighlights = Array.isArray(raw.key_highlights) ? raw.key_highlights : (Array.isArray(raw.features) ? raw.features : []);

  const discountPercent = Number(raw.discount_percent ?? raw.discountPercent ?? 0);
  // Automatically calculate offer_price: offer_price = price - (price * (discount_percent / 100))
  let offerPrice = Number(raw.offer_price ?? raw.discount_price ?? raw.discountPrice ?? 0);
  if (discountPercent > 0 && price > 0) {
    offerPrice = Math.round(price - (price * (discountPercent / 100)));
  } else if (!offerPrice) {
    offerPrice = price;
  }

  const imagesList = Array.isArray(raw.images) && raw.images.length > 0
    ? raw.images.filter((img: any) => typeof img === 'string' && img.trim().length > 0)
    : (imageUrl ? [imageUrl] : []);

  const primaryImage = imageUrl || (imagesList.length > 0 ? imagesList[0] : FALLBACK_PRODUCT_IMAGE);
  const supplierName = String(raw.supplier_name || raw.seller_name || raw.sellerName || 'ঝাদিমাদি ভেরিফাইড মার্চেন্ট নেটওয়ার্ক').trim();
  const qualityGrade = String(raw.quality_grade || raw.quality_standard || raw.qualityStandard || '১০০% বিশুদ্ধ ও পরীক্ষিত').trim();
  const unitQuantity = String(raw.unit_quantity || raw.unitAmount || raw.quantityNum || '১').trim();
  const unitType = String(raw.unit_type || raw.unitType || raw.quantityUnit || 'পিস (Pcs)').trim();
  const youtubeUrl = String(raw.youtube_url || raw.youtubeUrl || raw.video_url || raw.videoUrl || '').trim();

  const rawProductCode = String(raw.product_code || raw.code || raw.sku || '').trim();
  const rawSku = String(raw.sku || raw.product_code || raw.code || '').trim();
  const productCode = rawProductCode || rawSku || 'JHD-001';
  const sku = rawSku || rawProductCode || 'JHD-001';

  const payload: Record<string, any> = {
    // 1. Form Input to Database Column Mapping (Exact):
    name: name,
    category: category,
    price: price,
    discount_percent: discountPercent,
    offer_price: offerPrice,
    stock_quantity: stock,
    unit_quantity: unitQuantity,
    unit_type: unitType,
    product_code: productCode,
    sku: sku,
    origin: raw.origin || 'পার্বত্য চট্টগ্রাম',
    quality_grade: qualityGrade,
    supplier_name: supplierName,
    images: imagesList,
    image_url: imagesList.length > 0 ? imagesList[0] : primaryImage,
    youtube_url: youtubeUrl,
    description: desc,

    // 2. Resilient schema aliases for backward compatibility across database versions:
    stock: stock,
    product_name: name,
    products_name: name,
    name_bn: name,
    title: name,
    title_bn: name,
    regular_price: price,
    discount_price: offerPrice,
    unit: unit,
    unit_pack: unit,
    stock_status: stock > 0 ? 'in_stock' : 'out_of_stock',
    status: stock > 0 ? 'In Stock' : 'Out of Stock',
    short_description: desc,
    description_bn: desc,
    image: primaryImage,
    products_photos: primaryImage,
    category_bn: category,
    seller_name: supplierName,
    quality_standard: qualityGrade,
    video_url: youtubeUrl,
    is_active: true,
    is_published: true,
    district: raw.district || 'খাগড়াছড়ি',
    upazila: raw.upazila || 'খাগড়াছড়ি সদর',
    badges: badges,
    key_highlights: keyHighlights
  };

  // NEVER include 'id' in product creation payload so Supabase auto-generates a valid UUID via gen_random_uuid()
  delete (payload as any).id;

  if (sku) {
    payload.sku = sku;
    payload.code = sku;
    payload.product_code = sku;
  }
  if (raw.seller_id) {
    const sId = String(raw.seller_id).trim();
    if (UUID_REGEX.test(sId)) {
      payload.seller_id = sId;
    } else {
      console.info(`[prepareProductPayload] Omitted non-UUID seller_id "${sId}" to avoid invalid input syntax for type uuid.`);
    }
  }
  if (raw.category_id) {
    const cId = String(raw.category_id).trim();
    if (UUID_REGEX.test(cId)) {
      payload.category_id = cId;
    } else {
      console.info(`[prepareProductPayload] Omitted non-UUID category_id "${cId}" to avoid invalid input syntax for type uuid.`);
    }
  }
  if (raw.seller_name) {
    payload.seller_name = String(raw.seller_name).trim();
  }
  if (raw.seller_phone || raw.phone) {
    payload.seller_phone = String(raw.seller_phone || raw.phone).trim();
  }
  if (raw.video_url || raw.videoUrl) {
    payload.video_url = String(raw.video_url || raw.videoUrl).trim();
  }
  if (raw.products_name_en || raw.name_en) {
    payload.products_name_en = String(raw.products_name_en || raw.name_en).trim();
  }

  return payload;
}

export function prepareBloodDonorPayload(raw: Record<string, any>): Record<string, any> {
  const fullName = String(raw.full_name || raw.name || raw.fullName || 'স্বেচ্ছাসেবী রক্তদাতা').trim();
  const phone = String(raw.phone_number || raw.phone || raw.mobile || '').replace(/[^0-9]/g, '');
  const whatsapp = String(raw.whatsapp_number || raw.whatsapp || raw.phone_number || raw.phone || phone).replace(/[^0-9]/g, '');
  const bloodGroup = String(raw.blood_group || raw.bloodGroup || 'O+').trim();
  const district = String(raw.district || 'খাগড়াছড়ি').trim();
  const upazila = String(raw.upazila || raw.thana || 'খাগড়াছড়ি সদর').trim();
  const rawDate = raw.last_donation_date || raw.lastDonationDate;
  const lastDonationDate = (rawDate && String(rawDate).trim() && String(rawDate).trim() !== 'N/A')
    ? String(rawDate).trim()
    : null;
  const password = String(raw.password || raw.pass_word || '123456').trim();

  // If latitude or longitude is missing or unavailable, pass explicitly as null (not string "N/A" or undefined)
  let latitude: number | null = null;
  if (raw.latitude !== undefined && raw.latitude !== null && raw.latitude !== 'N/A' && raw.latitude !== '') {
    const pLat = Number(raw.latitude);
    latitude = !isNaN(pLat) ? pLat : null;
  }

  let longitude: number | null = null;
  if (raw.longitude !== undefined && raw.longitude !== null && raw.longitude !== 'N/A' && raw.longitude !== '') {
    const pLng = Number(raw.longitude);
    longitude = !isNaN(pLng) ? pLng : null;
  }

  return {
    full_name: fullName,
    phone_number: phone,
    whatsapp_number: whatsapp,
    blood_group: bloodGroup,
    district: district,
    upazila: upazila,
    last_donation_date: lastDonationDate,
    password: password,
    latitude: latitude,
    longitude: longitude
  };
}

export function prepareJobCircularPayload(raw: Record<string, any>): Record<string, any> {
  const title = String(raw.title || raw.job_title || raw.title_bn || 'চাকরির সার্কুলার').trim();
  const company = String(raw.company || raw.company_name || raw.company_or_poster || 'প্রতিষ্ঠান').trim();
  const description = String(raw.description || raw.job_description || `${company}-এ ${title} পদে কর্মী প্রয়োজন।`).trim();
  const phone = String(raw.phone || raw.contact_phone || raw.phone_number || '').trim();
  const circularFile = raw.circular_file || raw.photos || raw.circularUrl || null;
  const deadline = raw.deadline || raw.application_deadline ? String(raw.deadline || raw.application_deadline).split('T')[0] : null;

  return {
    // Primary live columns
    title: title,
    company: company,
    description: description,
    phone: phone,
    phone_number: phone,
    // Alternate schema column aliases
    job_title: title,
    company_name: company,
    company_or_poster: company,
    category: raw.category ? String(raw.category).trim() : 'সাধারণ',
    job_type: raw.job_type || raw.jobType || 'Full-time',
    district: raw.district ? String(raw.district).trim() : 'খাগড়াছড়ি',
    upazila: raw.upazila ? String(raw.upazila).trim() : 'সদর',
    salary: raw.salary || raw.basic_salary || raw.salary_range || 'আলোচনা সাপেক্ষে',
    salary_range: raw.salary_range || raw.salary || raw.basic_salary || 'আলোচনা সাপেক্ষে',
    deadline: deadline,
    application_deadline: deadline,
    requirements: Array.isArray(raw.requirements) ? raw.requirements.join('\n') : (raw.requirements || ''),
    circular_file: circularFile,
    photos: circularFile,
    status: raw.status || 'active'
  };
}

export function prepareServiceProviderPayload(raw: Record<string, any>): Record<string, any> {
  const name = String(raw.name || raw.display_name || raw.fullName || raw.full_name || 'কারিগর').trim();
  const serviceType = String(raw.service_type || raw.profession || raw.profession_key || raw.category || 'পেশাজীবী সেবাদাতা').trim();
  const phone = String(raw.phone || raw.phone_number || raw.mobile || '').replace(/[^0-9]/g, '');

  return {
    name: name,
    service_type: serviceType,
    phone: phone
  };
}

export function prepareJobSeekerPayload(raw: Record<string, any>): Record<string, any> {
  const name = String(raw.name || raw.full_name || raw.fullName || 'চাকরিপ্রার্থী').trim();
  const phone = String(raw.phone || raw.phone_number || raw.mobile || '').replace(/[^0-9]/g, '');
  const skills = String(raw.skills_or_job_type || raw.desired_post || raw.desiredJobTitle || (Array.isArray(raw.skills) ? raw.skills.join(', ') : raw.skills) || 'সাধারণ কর্মী').trim();
  const district = String(raw.district || 'খাগড়াছড়ি').trim();
  const upazila = String(raw.upazila || raw.thana || 'সদর').trim();
  const education = String(raw.education || raw.highest_education || 'স্নাতক (Bachelor)').trim();
  const experience = String(raw.experience || raw.experience_years || '১-২ বছর').trim();
  const photoUrl = raw.photo_url || raw.photo || raw.avatar || null;
  const cvUrl = raw.cv_url || raw.resume_url || raw.cvUrl || raw.resumeUrl || null;

  return {
    name: name,
    full_name: name,
    phone: phone,
    phone_number: phone,
    email: raw.email ? String(raw.email).trim() : null,
    skills_or_job_type: skills,
    desired_job_title: skills,
    skills: Array.isArray(raw.skills) ? raw.skills : [skills],
    gender: raw.gender || 'পুরুষ',
    district: district,
    upazila: upazila,
    area: raw.area ? String(raw.area).trim() : upazila,
    education: education,
    highest_education: education,
    experience: experience,
    selary: raw.selary || raw.expected_salary || raw.expectedSalary || 'আলোচনা সাপেক্ষে',
    expected_salary: raw.expected_salary || raw.expectedSalary || raw.selary || 'আলোচনা সাপেক্ষে',
    photo_url: photoUrl,
    cv_url: cvUrl,
    resume_url: cvUrl,
    photos_cv: cvUrl || photoUrl,
    unique_id: raw.unique_id || null,
    status: raw.status || 'available'
  };
}

export function prepareSellerPayload(raw: Record<string, any>): Record<string, any> {
  const fullName = String(raw.full_name || raw.fullName || raw.name || 'বিক্রেতা').trim();
  const phone = String(raw.phone || raw.phone_number || raw.mobile || '').replace(/[^0-9]/g, '');
  const shopName = String(raw.shop_name || raw.shopName || raw.businessName || raw.business_name || '').trim();
  const district = String(raw.district || 'খাগড়াছড়ি').trim();
  const upazila = String(raw.upazila || raw.thana || 'সদর').trim();
  const address = String(raw.address || raw.detailedAddress || raw.shopAddress || `${upazila}, ${district}`).trim();

  return {
    full_name: fullName,
    name: fullName,
    shop_name: shopName,
    business_name: shopName,
    phone: phone,
    phone_number: phone,
    email: raw.email ? String(raw.email).trim() : null,
    address: address,
    district: district,
    upazila: upazila,
    area: raw.area || raw.mahalla || '',
    nid_number: raw.nid_number || raw.nidNumber || raw.tradeLicenseOrNid || null,
    trade_license: raw.trade_license || raw.tradeLicense || raw.tradeLicenseOrNid || null,
    product_category: raw.product_category || raw.category || raw.businessCategory || 'Food',
    description: raw.description || raw.productDesc || `${shopName || fullName} - ঝাদিমাদি রেজিস্টার্ড বিক্রেতা`,
    image_url: raw.image_url || raw.shopBannerUrl || raw.products_photos || null,
    products_photos: raw.products_photos || raw.image_url || raw.shopBannerUrl || null,
    status: raw.status || 'pending'
  };
}

export function prepareProductSellerPayload(raw: Record<string, any>): Record<string, any> {
  const phone = String(raw.phone || raw.phone_number || raw.mobile || '').replace(/[^0-9]/g, '');
  const productName = String(raw.products_name || raw.product_name || raw.productNameOrBusiness || raw.shop_name || raw.full_name || 'পাহাড়ি পণ্য বিক্রেতা').trim();
  const district = String(raw.district || 'খাগড়াছড়ি').trim();
  const upazila = String(raw.upazila || raw.thana || 'সদর').trim();

  return {
    products_name: productName,
    phone_number: phone,
    district: district,
    upazila: upazila
  };
}

export function prepareJobPayload(raw: Record<string, any>): Record<string, any> {
  const title = String(raw.title || raw.job_title || 'চাকরির পদ').trim();
  const companyName = String(raw.company_name || raw.company || raw.companyName || 'প্রতিষ্ঠান').trim();

  return {
    title: title,
    company_name: companyName,
    job_type: raw.job_type || raw.jobType || 'Full-time',
    vacancy: Number(raw.vacancy ?? raw.vacanciesCount ?? 1),
    location: raw.location || raw.address || `${raw.upazila || 'সদর'}, ${raw.district || 'খাগড়াছড়ি'}`,
    salary_range: raw.salary_range || raw.salary || raw.basic_salary || 'আলোচনা সাপেক্ষে',
    deadline: raw.deadline ? String(raw.deadline).split('T')[0] : null,
    description: raw.description || `${companyName}-এ ${title} পদে কর্মী আবশ্যক।`,
    requirements: Array.isArray(raw.requirements) ? raw.requirements.join('\n') : (raw.requirements || ''),
    status: raw.status || 'active'
  };
}

export function prepareJobApplicationPayload(raw: Record<string, any>): Record<string, any> {
  const applicantName = String(raw.applicant_name || raw.applicantName || raw.name || raw.full_name || 'আবেদনকারী').trim();
  const phone = String(raw.phone || raw.phone_number || raw.mobile || '').replace(/[^0-9]/g, '');

  return {
    job_id: raw.job_id || raw.jobId || null,
    applicant_name: applicantName,
    phone: phone,
    email: raw.email ? String(raw.email).trim() : null,
    resume_url: raw.resume_url || raw.resumeUrl || null,
    experience_summary: raw.experience_summary || raw.cover_letter || raw.coverLetter || raw.experience || '',
    status: raw.status || 'applied',
    candidate_id: raw.candidate_id || raw.candidateId || null,
    job_title: raw.job_title || raw.jobTitle || null,
    company_name: raw.company_name || raw.companyName || null,
    cover_letter: raw.cover_letter || raw.coverLetter || null
  };
}

export function prepareMemberPayload(raw: Record<string, any>): Record<string, any> {
  const fullName = String(raw.full_name || raw.fullName || raw.name || 'সদস্য').trim();
  const phone = String(raw.phone || raw.phone_number || raw.mobile || '').replace(/[^0-9]/g, '');
  const district = String(raw.district || 'খাগড়াছড়ি').trim();
  const upazila = String(raw.upazila || raw.thana || 'সদর').trim();
  const address = String(raw.address || raw.detailedAddress || raw.presentAddress || `${upazila}, ${district}`).trim();

  return {
    full_name: fullName,
    name: fullName,
    phone: phone,
    phone_number: phone,
    email: raw.email ? String(raw.email).trim() : null,
    nid_number: raw.nid_number || raw.nidNumber || null,
    blood_group: raw.blood_group || raw.bloodGroup || null,
    district: district,
    upazila: upazila,
    address: address,
    present_address: address,
    permanent_address: raw.permanent_address || raw.permanentAddress || address,
    photo_url: raw.photo_url || raw.photoUrl || raw.avatar || null,
    membership_type: raw.membership_type || 'permanent',
    status: raw.status || 'pending',
    education: raw.education || raw.educational_qualification || null
  };
}

export function preparePermanentMemberPayload(raw: Record<string, any>): Record<string, any> {
  const name = String(raw.name || raw.full_name || raw.fullName || 'স্থায়ী সদস্য').trim();
  const phone = String(raw.phone || raw.phone_number || raw.mobile || '').replace(/[^0-9]/g, '');
  const district = String(raw.district || 'খাগড়াছড়ি').trim();
  const upazila = String(raw.upazila || raw.thana || 'সদর').trim();
  const address = String(raw.address || raw.present_address || raw.presentAddress || `${upazila}, ${district}`).trim();
  const password = String(raw.pass_word || raw.password || '123456').trim();

  return {
    name: name,
    phone_number: phone,
    phone: phone,
    blood_group: raw.blood_group || raw.bloodGroup || '',
    district: district,
    upazila: upazila,
    present_address: address,
    permanent_address: raw.permanent_address || raw.permanentAddress || address,
    education: raw.education || 'স্নাতক',
    nid_number: raw.nid_number || raw.nidNumber || '',
    photos_cv: raw.photo_url || raw.photos_cv || raw.photoUrl || raw.avatar || '',
    pass_word: password,
    password: password
  };
}

export function prepareBannerPayload(raw: Record<string, any>): Record<string, any> {
  const title = String(raw.title || raw.altText || raw.alt_text || 'ঝাদিমাদি ব্যানার').trim();
  const imageUrl = String(raw.image_url || raw.imageUrl || '').trim();
  const link = String(raw.link || raw.target_link || raw.targetLink || raw.actionUrl || raw.action_url || raw.link_url || raw.linkUrl || '/').trim();
  const placement = String(raw.placement || raw.position || 'homepage_hero').trim();
  const orderNum = Number(raw.sort_order ?? raw.order ?? raw.display_order ?? 1);
  const subtitle = raw.subtitle ? String(raw.subtitle).trim() : null;
  const badge = raw.badge ? String(raw.badge).trim() : (raw.tag ? String(raw.tag).trim() : null);

  return {
    title: title,
    image_url: imageUrl,
    link: link,
    subtitle: subtitle,
    badge: badge,
    placement: placement,
    sort_order: orderNum
  };
}


