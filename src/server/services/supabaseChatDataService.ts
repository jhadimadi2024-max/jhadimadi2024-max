import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { normalizeBengaliDiacritics, damerauLevenshteinDistance, ngramDiceSimilarity } from './bengaliSearchEngine';

const DATA_DIR = path.join(process.cwd(), 'data');
const PRODUCTS_JSON = path.join(DATA_DIR, 'products.json');
const BANNERS_JSON = path.join(DATA_DIR, 'banners.json');
const SERVICE_PROVIDERS_JSON = path.join(DATA_DIR, 'service_providers.json');
const REGISTERED_MEMBERS_JSON = path.join(DATA_DIR, 'registered_members.json');
const BLOOD_DONORS_JSON = path.join(DATA_DIR, 'blood_donors.json');

const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3aHNxZnRsbGt4aW1oZnZ3cWFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3MzAyNzEsImV4cCI6MjEwNTMwNjI3MX0.GbceleQmKhRfSzE-c_Bq3fh-YA7I4oZI1fGCsU-SaPI';
const DEFAULT_SUPABASE_URL = 'https://dwhsqftllkximhfvwqak.supabase.co';

let supabaseClient: any = null;

export function getSupabaseChatClient() {
  if (supabaseClient) return supabaseClient;
  try {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY;
    supabaseClient = createClient(url, key, {
      auth: { persistSession: false },
      global: {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`
        }
      }
    });
  } catch (err) {
    console.warn('[Supabase Chat Client] Init fallback:', err);
    supabaseClient = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY, {
      auth: { persistSession: false }
    });
  }
  return supabaseClient;
}

export interface LiveChatProduct {
  id: string;
  code?: string;
  nameBn: string;
  nameEn: string;
  price: number;
  originalPrice?: number;
  discountPrice?: number;
  stock: number;
  inStock: boolean;
  unit: string;
  image: string;
  images?: string[];
  category: string;
  origin: string;
  qualityStandard: string;
  description: string;
  sellerInfo?: string;
  badges?: string[];
}

export interface LiveChatBanner {
  id: string | number;
  title: string;
  subtitle?: string;
  badge?: string;
  imageUrl?: string;
  targetLink?: string;
  isActive: boolean;
}

export interface LiveChatVendor {
  id: string;
  shopName: string;
  ownerName: string;
  phone?: string;
  bloodGroup?: string;
  sellerId?: string;
  district?: string;
  rating?: number;
  productsSummary?: string;
}

export interface LiveChatService {
  id: string;
  name: string;
  profession: string;
  skills?: string[];
  hourlyRate?: number;
  rating?: number;
  phone?: string;
  district?: string;
  upazila?: string;
  available?: boolean;
}

export interface LiveChatBloodDonor {
  id: string;
  name: string;
  bloodGroup: string;
  phone?: string;
  district?: string;
  upazila?: string;
  area?: string;
  profession?: string;
  isAvailable?: boolean;
}

export interface LiveChatMember {
  id: string;
  name: string;
  role: string;
  profession?: string;
  bloodGroup?: string;
  phone?: string;
  district?: string;
  upazila?: string;
  uniqueId?: string;
}

// ----------------------------------------------------
// 1. FETCH PRODUCTS (SUPABASE + LOCAL FALLBACK)
// ----------------------------------------------------
export async function fetchLiveSupabaseProducts(): Promise<LiveChatProduct[]> {
  const client = getSupabaseChatClient();
  let supabaseProducts: any[] = [];

  try {
    const { data, error } = await client.from('products').select('*');
    if (!error && Array.isArray(data) && data.length > 0) {
      supabaseProducts = data;
    }
  } catch (e: any) {
    console.warn('[Supabase Products] Fetch error:', e.message);
  }

  // Load local backup products from data/products.json
  let localProducts: any[] = [];
  try {
    if (fs.existsSync(PRODUCTS_JSON)) {
      const fileData = JSON.parse(fs.readFileSync(PRODUCTS_JSON, 'utf-8'));
      if (Array.isArray(fileData)) localProducts = fileData;
    }
  } catch (_) {}

  const mergedMap = new Map<string, LiveChatProduct>();

  // Map Supabase rows
  for (const row of supabaseProducts) {
    const nameBn = row.name_bn || row.name || row.title || row.title_bn || 'পাহাড়ি পণ্য';
    const nameEn = row.name_en || row.name || row.title_en || nameBn;
    const price = Number(row.price) || 0;
    const originalPrice = Number(row.original_price || row.originalPrice) || price;
    const stockVal = row.stock !== undefined ? Number(row.stock) : (row.stock_quantity !== undefined ? Number(row.stock_quantity) : 10);
    const inStock = stockVal > 0;
    const unit = row.unit || row.quantity_unit || row.unit_pack || '১ প্যাক';
    const image = row.image_url || row.image || (Array.isArray(row.images) && row.images[0]) || '';
    const origin = row.origin || row.production_origin || 'পার্বত্য চট্টগ্রাম';
    const qualityStandard = row.quality_standard || row.qualityStandards || '১০০% বিশুদ্ধ ও প্রাকৃতিক';
    const description = row.description_bn || row.description || row.description_en || 'পার্বত্য চট্টগ্রামের খাঁটি অর্গানিক পণ্য।';

    const item: LiveChatProduct = {
      id: String(row.id),
      code: row.sku || row.code || row.product_code || String(row.id).slice(0, 6),
      nameBn,
      nameEn,
      price,
      originalPrice: originalPrice > price ? originalPrice : undefined,
      stock: stockVal,
      inStock,
      unit,
      image,
      images: Array.isArray(row.images) ? row.images : (image ? [image] : []),
      category: row.category || 'Food',
      origin,
      qualityStandard,
      description,
      sellerInfo: row.seller_info || row.sellerName || 'ঝাদিমাদি ভেরিফাইড মার্চেন্ট নেটওয়ার্ক',
      badges: Array.isArray(row.badges) ? row.badges : ['১০০% খাঁটি ও পরীক্ষিত']
    };
    mergedMap.set(item.id, item);
  }

  // Merge local backup products (ensuring items like সিদোল, পাহাড়ি মধু are always present)
  for (const lp of localProducts) {
    const key = String(lp.id);
    if (!mergedMap.has(key)) {
      const price = Number(lp.price) || 0;
      const stockVal = lp.stock !== undefined ? Number(lp.stock) : 10;
      mergedMap.set(key, {
        id: key,
        code: lp.code || lp.id,
        nameBn: lp.nameBn || lp.title_bn || 'পাহাড়ি পণ্য',
        nameEn: lp.nameEn || lp.title_en || 'Hill Product',
        price,
        originalPrice: Number(lp.originalPrice) > price ? Number(lp.originalPrice) : undefined,
        stock: stockVal,
        inStock: stockVal > 0,
        unit: lp.unit || lp.unit_pack || '১ পিস',
        image: lp.image || (Array.isArray(lp.images) && lp.images[0]) || '',
        images: Array.isArray(lp.images) ? lp.images : (lp.image ? [lp.image] : []),
        category: lp.category || 'Food',
        origin: lp.origin || 'পার্বত্য চট্টগ্রাম',
        qualityStandard: lp.quality_standard || '১০০% বিশুদ্ধ ও পরীক্ষিত',
        description: lp.descriptionBn || lp.description || '১০০% খাঁটি পণ্য',
        sellerInfo: lp.seller_info || lp.sellerName || 'ঝাদিমাদি ভেরিফাইড মার্চেন্ট নেটওয়ার্ক',
        badges: Array.isArray(lp.badges) ? lp.badges : ['১০০% খাঁটি']
      });
    }
  }

  return Array.from(mergedMap.values());
}

// ----------------------------------------------------
// 2. FETCH BANNERS (SUPABASE + LOCAL FALLBACK)
// ----------------------------------------------------
export async function fetchLiveSupabaseBanners(): Promise<LiveChatBanner[]> {
  const client = getSupabaseChatClient();
  let banners: LiveChatBanner[] = [];

  try {
    const { data, error } = await client.from('banners').select('*').eq('is_active', true);
    if (!error && Array.isArray(data) && data.length > 0) {
      banners = data.map((b: any) => ({
        id: b.id,
        title: b.title || 'ঝাদিমাদি স্পেশাল অফার',
        subtitle: b.subtitle || 'পাহাড়ের খাঁটি পণ্য কিনুন সাশ্রয়ী মূল্যে',
        badge: b.badge || 'স্পেশাল অফার',
        imageUrl: b.image_url || b.image || '',
        targetLink: b.target_link || '',
        isActive: b.is_active !== false
      }));
    }
  } catch (_) {}

  if (banners.length === 0) {
    try {
      if (fs.existsSync(BANNERS_JSON)) {
        const fileData = JSON.parse(fs.readFileSync(BANNERS_JSON, 'utf-8'));
        if (Array.isArray(fileData)) {
          banners = fileData.map((b: any, idx: number) => ({
            id: b.id || idx + 1,
            title: b.title || 'ঝাদিমাদি পাহাড়ি মেগা অফার',
            subtitle: b.subtitle || 'পাহাড়ের সেরা পণ্য ঘরে বসেই অর্ডার করুন',
            badge: b.badge || 'বিশেষ ছাড়',
            imageUrl: b.image_url || b.image || '',
            targetLink: b.target_link || '',
            isActive: true
          }));
        }
      }
    } catch (_) {}
  }

  return banners;
}

// ----------------------------------------------------
// 3. FETCH VENDORS (SUPABASE + LOCAL FALLBACK)
// ----------------------------------------------------
export async function fetchLiveSupabaseVendors(): Promise<LiveChatVendor[]> {
  const client = getSupabaseChatClient();
  let vendors: LiveChatVendor[] = [];

  try {
    // Try 'vendors' or 'product_sellers'
    let { data, error } = await client.from('vendors').select('*');
    if (error || !data || data.length === 0) {
      const res = await client.from('product_sellers').select('*');
      data = res.data;
    }
    if (data && Array.isArray(data) && data.length > 0) {
      vendors = data.map((v: any) => ({
        id: String(v.id),
        shopName: v.shop_name || v.shopName || v.business_name || 'ঝাদিমাদি ভেন্ডর শপ',
        ownerName: v.owner_name || v.name || v.full_name || 'প্রোপাইটর',
        phone: v.phone || v.phone_number || '',
        bloodGroup: v.blood_group || v.bloodGroup || '',
        sellerId: v.seller_id || v.sellerId || `ID-Kha-${String(v.id).slice(0, 3)}`,
        district: v.district || 'খাগড়াছড়ি',
        rating: Number(v.rating) || 4.9,
        productsSummary: v.products_summary || v.categories || 'পাহাড়ি অর্গানিক পণ্য'
      }));
    }
  } catch (_) {}

  // Fallback to local registered_members with seller role
  if (vendors.length === 0) {
    try {
      if (fs.existsSync(REGISTERED_MEMBERS_JSON)) {
        const fileData = JSON.parse(fs.readFileSync(REGISTERED_MEMBERS_JSON, 'utf-8'));
        if (Array.isArray(fileData)) {
          const sellerMembers = fileData.filter((m: any) => m.role === 'seller' || m.role === 'product_seller' || m.roleLabelBn?.includes('বিক্রেতা') || m.roleLabelBn?.includes('মার্চেন্ট'));
          if (sellerMembers.length > 0) {
            vendors = sellerMembers.map((m: any) => ({
              id: String(m.id),
              shopName: m.shopName || `${m.name}-এর স্টোর`,
              ownerName: m.name,
              phone: m.phone || '',
              bloodGroup: m.bloodGroup || '',
              sellerId: m.districtUniqueId || 'ID-Kha-001',
              district: m.district || 'খাগড়াছড়ি',
              rating: 5.0,
              productsSummary: 'সিদোল, শুটকি ও পাহাড়ি খাদ্যপণ্য'
            }));
          }
        }
      }
    } catch (_) {}
  }

  // Default flagship store if empty
  if (vendors.length === 0) {
    vendors = [
      {
        id: 'flagship_1',
        shopName: 'ঝাদিমাদি অর্গানিক সেন্ট্রাল শপ',
        ownerName: 'নয়ন চাকমা (প্রতিষ্ঠাতা)',
        phone: '01870592699',
        bloodGroup: 'Blood - A+',
        sellerId: 'ID - Kha - 001',
        district: 'খাগড়াছড়ি সদর, পার্বত্য চট্টগ্রাম',
        rating: 5.0,
        productsSummary: 'খাঁটি পাহাড়ি সিদোল, বুনো মধু, কাপ্তাই শুটকি ও জুমের মসলা'
      }
    ];
  }

  return vendors;
}

// ----------------------------------------------------
// 4. FETCH SERVICES (SUPABASE + LOCAL FALLBACK)
// ----------------------------------------------------
export async function fetchLiveSupabaseServices(): Promise<LiveChatService[]> {
  const client = getSupabaseChatClient();
  let services: LiveChatService[] = [];

  try {
    let { data, error } = await client.from('services').select('*');
    if (error || !data || data.length === 0) {
      const res = await client.from('service_providers').select('*');
      data = res.data;
    }
    if (data && Array.isArray(data) && data.length > 0) {
      services = data.map((s: any) => ({
        id: String(s.id),
        name: s.name || s.provider_name || 'দক্ষ টেকনিশিয়ান',
        profession: s.profession || s.service_name || s.category_bn || 'সার্ভিস মিস্ত্রি',
        skills: Array.isArray(s.skills) ? s.skills : [s.profession],
        hourlyRate: Number(s.hourly_rate || s.hourlyRate) || 350,
        rating: Number(s.rating) || 4.8,
        phone: s.phone || '',
        district: s.district || 'খাগড়াছড়ি',
        upazila: s.upazila || '',
        available: s.available !== false
      }));
    }
  } catch (_) {}

  if (services.length === 0) {
    try {
      if (fs.existsSync(SERVICE_PROVIDERS_JSON)) {
        const fileData = JSON.parse(fs.readFileSync(SERVICE_PROVIDERS_JSON, 'utf-8'));
        if (Array.isArray(fileData)) {
          services = fileData.map((s: any) => ({
            id: String(s.id),
            name: s.name,
            profession: s.profession,
            skills: s.skills || [],
            hourlyRate: s.hourlyRate || 350,
            rating: s.rating || 4.8,
            phone: s.phone || '',
            district: s.district || 'খাগড়াছড়ি',
            upazila: s.upazila || '',
            available: s.available !== false
          }));
        }
      }
    } catch (_) {}
  }

  return services;
}

// ----------------------------------------------------
// 4b. FETCH BLOOD DONORS (SUPABASE + LOCAL FALLBACK)
// ----------------------------------------------------
export async function fetchLiveSupabaseBloodDonors(): Promise<LiveChatBloodDonor[]> {
  const client = getSupabaseChatClient();
  let donors: LiveChatBloodDonor[] = [];

  try {
    const { data, error } = await client.from('blood_donors').select('*').limit(40);
    if (!error && Array.isArray(data) && data.length > 0) {
      donors = data.map((b: any) => ({
        id: String(b.id),
        name: b.name || b.full_name || 'রক্তদাতা',
        bloodGroup: b.blood_group || b.bloodGroup || 'A+',
        phone: b.phone || '',
        district: b.district || 'খাগড়াছড়ি',
        upazila: b.upazila || '',
        area: b.area || b.mahalla || '',
        profession: b.profession || 'স্বেচ্ছাসেবী',
        isAvailable: b.is_available !== false
      }));
    }
  } catch (_) {}

  if (donors.length === 0) {
    try {
      if (fs.existsSync(BLOOD_DONORS_JSON)) {
        const fileData = JSON.parse(fs.readFileSync(BLOOD_DONORS_JSON, 'utf-8'));
        if (Array.isArray(fileData)) {
          donors = fileData.map((b: any) => ({
            id: String(b.id),
            name: b.name || b.fullName,
            bloodGroup: b.bloodGroup || b.blood_group,
            phone: b.phone,
            district: b.district || 'খাগড়াছড়ি',
            upazila: b.upazila || '',
            area: b.area || '',
            profession: b.profession || 'স্বেচ্ছাসেবী',
            isAvailable: b.isAvailable !== false
          }));
        }
      }
    } catch (_) {}
  }

  return donors;
}

// ----------------------------------------------------
// 4c. FETCH MEMBERS & PROFILES (SUPABASE + LOCAL FALLBACK)
// ----------------------------------------------------
export async function fetchLiveSupabaseMembers(): Promise<LiveChatMember[]> {
  const client = getSupabaseChatClient();
  let members: LiveChatMember[] = [];

  try {
    const { data, error } = await client.from('profiles').select('*').limit(40);
    if (!error && Array.isArray(data) && data.length > 0) {
      members = data.map((m: any) => ({
        id: String(m.id || m.unique_id),
        name: m.full_name || m.name || 'সদস্য',
        role: m.role || 'member',
        profession: m.profession || 'নিবন্ধিত নাগরিক',
        bloodGroup: m.blood_group || m.bloodGroup || '',
        phone: m.phone || '',
        district: m.district || 'খাগড়াছড়ি',
        upazila: m.upazila || '',
        uniqueId: m.unique_id || ''
      }));
    }
  } catch (_) {}

  if (members.length === 0) {
    try {
      if (fs.existsSync(REGISTERED_MEMBERS_JSON)) {
        const fileData = JSON.parse(fs.readFileSync(REGISTERED_MEMBERS_JSON, 'utf-8'));
        if (Array.isArray(fileData)) {
          members = fileData.map((m: any) => ({
            id: String(m.id),
            name: m.name,
            role: m.role || 'member',
            profession: m.profession || m.roleLabelBn || 'সদস্য',
            bloodGroup: m.bloodGroup || '',
            phone: m.phone || '',
            district: m.district || 'খাগড়াছড়ি',
            upazila: m.upazila || '',
            uniqueId: m.districtUniqueId || ''
          }));
        }
      }
    } catch (_) {}
  }

  return members;
}

// ----------------------------------------------------
// 5. QUERY DATABASE & ASSEMBLE SALES ASSISTANT CONTEXT (MULTI-TABLE FUZZY SCAN)
// ----------------------------------------------------
export async function queryLiveDatabaseForChat(userQuery: string, location?: string) {
  const qClean = (userQuery || '').toLowerCase().trim();

  // Run live queries across ALL database tables in parallel
  const [products, banners, vendors, services, bloodDonors, members] = await Promise.all([
    fetchLiveSupabaseProducts(),
    fetchLiveSupabaseBanners(),
    fetchLiveSupabaseVendors(),
    fetchLiveSupabaseServices(),
    fetchLiveSupabaseBloodDonors(),
    fetchLiveSupabaseMembers()
  ]);

  // Specific Typo and Synonym Detections requested by user:
  // Typos: "খেদল", "মেদল", "গোলাল", "সেদল", "হিদল" -> সিদল
  const isSidol = /সিদল|সিদোল|সেদল|সেদোল|হিঁদল|হিদল|হিদোল|সীদল|সিডল|সিডোল|খেদল|মেদল|গোলাল|sidol|shidol|sidal/i.test(qClean);
  // Typos: "খুরিযু", "খরিচ", "মরিষ", "মোরিস" -> মরিচ
  const isChili = /মরিচ|মরিচের|ঝাল|খুরিযু|খরিচ|মরিষ|মোরিস|morich|chili|chilli/i.test(qClean);
  const isHoney = /মধু|মদু|পাহাড়ি মধু|বুনো মধু|honey|modhu/i.test(qClean);
  const isChingri = /চিংড়ি|চিংরি|চিংড়ি শুটকি|চিংড়ি শুটাক|chingri|shrimp/i.test(qClean);
  const isShuri = /শুড়ি|সুরি|শুঁড়ি|শুড়ি শুটকি|shuri/i.test(qClean);
  const isShutkiGeneral = /শুটকি|শুঁটকি|সুটকি|চুটকি|চুটাক|শুটাক|হুটকি|হুতকি|dry fish|dried fish/i.test(qClean);
  const isTurmeric = /হলুদ|হলুদের|জুম হলুদ|হুলুদ|হলদি|turmeric|haldi/i.test(qClean);
  const isOil = /সরিষা|সরিষার|তেল|তৈল|mustard oil|oil/i.test(qClean);
  const isJaggery = /গুড়|গুড়|আখের গুড়|পাটালি|ঝুলা গুড়|jaggery/i.test(qClean);
  const isRice = /চাল|বিনি চাল|জুম চাল|ধান|rice|bini/i.test(qClean);

  let matchedProducts: LiveChatProduct[] = [];
  let isFuzzyMatch = false;
  let fuzzyMatchedName = '';

  if (isSidol) {
    matchedProducts.push(...products.filter(p => /সিদল|সিদোল|sidol/i.test(p.nameBn + p.nameEn)));
    if (/খেদল|মেদল|গোলাল/i.test(qClean)) {
      isFuzzyMatch = true;
      fuzzyMatchedName = 'সিদোল';
    }
  }
  if (isChili) {
    matchedProducts.push(...products.filter(p => /মরিচ|chili/i.test(p.nameBn + p.nameEn)));
    if (/খুরিযু|খরিচ|মরিষ|মোরিস/i.test(qClean)) {
      isFuzzyMatch = true;
      fuzzyMatchedName = 'মরিচ';
    }
  }
  if (isHoney) {
    matchedProducts.push(...products.filter(p => /মধু|honey/i.test(p.nameBn + p.nameEn)));
  }
  if (isChingri) {
    matchedProducts.push(...products.filter(p => /চিংড়ি|chingri/i.test(p.nameBn + p.nameEn)));
  }
  if (isShuri) {
    matchedProducts.push(...products.filter(p => /শুড়ি|shuri/i.test(p.nameBn + p.nameEn)));
  }
  if (isShutkiGeneral && !isChingri && !isShuri) {
    matchedProducts.push(...products.filter(p => /শুটকি|শুটাক|শুড়ি|চিংড়ি|shutki/i.test(p.nameBn + p.nameEn)));
  }
  if (isTurmeric) {
    matchedProducts.push(...products.filter(p => /হলুদ|turmeric/i.test(p.nameBn + p.nameEn)));
  }
  if (isOil) {
    matchedProducts.push(...products.filter(p => /সরিষা|তেল|oil/i.test(p.nameBn + p.nameEn)));
  }
  if (isJaggery) {
    matchedProducts.push(...products.filter(p => /গুড়|গুড়|jaggery/i.test(p.nameBn + p.nameEn)));
  }
  if (isRice) {
    matchedProducts.push(...products.filter(p => /চাল|বিনি|rice/i.test(p.nameBn + p.nameEn)));
  }

  // Check list inquiry (পণ্য তালিকা / প্রোডাক্ট লিস্ট)
  const isListInquiry = /প্রোডাক্ট লিস্ট|পণ্য তালিকা|লিস্ট দেখাও|কি কি পণ্য|পণ্য দেখাও|সব পণ্য|পণ্যসমূহ|all products|product list|catalogue|ক্যাটালগ|আইটেম/i.test(qClean);
  if (isListInquiry) {
    matchedProducts.push(...products.filter(p => p.inStock));
  }

  // Check offers / banners inquiry
  const isOfferQuery = /অফার|ডিসকাউন্ট|ছাড়|আজকের অফার|ব্যানার|বোনাস|campaign|offer|discount|স্পেশাল/i.test(qClean);
  const activeBanners = banners.filter(b => b.isActive);
  if (isOfferQuery) {
    const discounted = products.filter(p => p.originalPrice && p.originalPrice > p.price);
    matchedProducts.push(...discounted);
    if (matchedProducts.length === 0) {
      matchedProducts.push(...products.slice(0, 3));
    }
  }

  // Generic keyword match if not matched by specific filters
  if (matchedProducts.length === 0) {
    const tokens = qClean.split(/[\s,?!]+/).filter(t => t.length > 2);
    matchedProducts = products.filter(p => {
      const searchTarget = `${p.nameBn} ${p.nameEn} ${p.category} ${p.description} ${p.origin}`.toLowerCase();
      return tokens.some(t => searchTarget.includes(t));
    });
  }

  // Fallback: Advanced Damerau-Levenshtein & N-gram Diacritic Fuzzy Search
  // NEVER SAY "NOT FOUND" without testing phonetic / edit distance match
  if (matchedProducts.length === 0 && qClean.length >= 2) {
    const normQ = normalizeBengaliDiacritics(qClean);
    for (const p of products) {
      const normP = normalizeBengaliDiacritics(p.nameBn);
      const dice = ngramDiceSimilarity(normP, normQ, 2);
      const dist = damerauLevenshteinDistance(normP, normQ);
      const maxLen = Math.max(normP.length, normQ.length);
      const levScore = 1 - (dist / (maxLen || 1));

      if (dice >= 0.3 || levScore >= 0.4 || normP.includes(normQ) || normQ.includes(normP)) {
        matchedProducts.push(p);
        isFuzzyMatch = true;
        fuzzyMatchedName = p.nameBn;
      }
    }
  }

  // Deduplicate matched products
  const uniqueMatchedProducts = Array.from(new Map(matchedProducts.map(p => [p.id, p])).values());

  // Check vendor inquiry
  const isVendorQuery = /ভেন্ডর|সেলার|বিক্রেতা|দোকান|মার্চেন্ট|দোকানদার|vendor|seller|shop/i.test(qClean);
  let matchedVendors: LiveChatVendor[] = [];
  if (isVendorQuery) {
    matchedVendors = vendors;
  }

  // Check service inquiry
  const isServiceQuery = /মিস্ত্রি|সার্ভিস|ইলেকট্রিশিয়ান|প্লাম্বার|মেকানিক|টেকনিশিয়ান|সার্ভিসিং|সেবা|service|plumber|electrician/i.test(qClean);
  let matchedServices: LiveChatService[] = [];
  if (isServiceQuery) {
    const sTokens = qClean.split(/[\s,?!]+/).filter(t => t.length > 2);
    matchedServices = services.filter(s => {
      const target = `${s.profession} ${s.name} ${s.district} ${s.skills?.join(' ')}`.toLowerCase();
      return sTokens.some(t => target.includes(t)) || s.profession.toLowerCase().includes(qClean);
    });
    if (matchedServices.length === 0) matchedServices = services.slice(0, 3);
  }

  // Universal Blood Search across ALL tables & profiles:
  // If user asks for blood or mentions a blood group (e.g. "খাগড়াছড়ি এ পজিটিভ" / "A+")
  const isBloodQuery = /রক্ত|ব্লাড|donor|ডোনার|পজিটিভ|পজেটিভ|নেগেটিভ|\b(?:a|b|ab|o)[+-]\b/i.test(qClean);
  let detectedBloodGroup: string | null = null;
  const bMatch = qClean.match(/\b(a\+|a\-|b\+|b\-|ab\+|ab\-|o\+|o\-)\b/i);
  if (bMatch) detectedBloodGroup = bMatch[1].toUpperCase();
  else if (/এবি\s*পজিটিভ|এবি\s*পজেটিভ/i.test(qClean)) detectedBloodGroup = 'AB+';
  else if (/এ\s*পজিটিভ|এ\s*পজেটিভ/i.test(qClean)) detectedBloodGroup = 'A+';
  else if (/বি\s*পজিটিভ|বি\s*পজেটিভ/i.test(qClean)) detectedBloodGroup = 'B+';
  else if (/ও\s*পজিটিভ|ও\s*পজেটিভ/i.test(qClean)) detectedBloodGroup = 'O+';
  else if (/এ\s*নেগেটিভ/i.test(qClean)) detectedBloodGroup = 'A-';
  else if (/বি\s*নেগেটিভ/i.test(qClean)) detectedBloodGroup = 'B-';
  else if (/এবি\s*নেগেটিভ/i.test(qClean)) detectedBloodGroup = 'AB-';
  else if (/ও\s*নেগেটিভ/i.test(qClean)) detectedBloodGroup = 'O-';

  let matchedBloodDonors: Array<{
    name: string;
    bloodGroup: string;
    role: string;
    profession: string;
    phone: string;
    location: string;
  }> = [];

  if (isBloodQuery) {
    // 1. From dedicated blood_donors table
    bloodDonors.forEach(b => {
      if (!detectedBloodGroup || b.bloodGroup.toUpperCase() === detectedBloodGroup) {
        matchedBloodDonors.push({
          name: b.name,
          bloodGroup: b.bloodGroup,
          role: 'স্বেচ্ছাসেবী রক্তদাতা',
          profession: b.profession || 'রক্তদাতা',
          phone: b.phone || '',
          location: [b.area, b.upazila, b.district].filter(Boolean).join(', ') || 'খাগড়াছড়ি'
        });
      }
    });

    // 2. From service providers who registered blood group (e.g. Electricians, Plumbers)
    services.forEach(s => {
      const sAny = s as any;
      const bg = sAny.blood_group || sAny.bloodGroup;
      if (bg && (!detectedBloodGroup || bg.toUpperCase() === detectedBloodGroup)) {
        matchedBloodDonors.push({
          name: s.name,
          bloodGroup: bg,
          role: `দক্ষ কারিগর (${s.profession}) ও রক্তদাতা`,
          profession: s.profession,
          phone: s.phone || '',
          location: [s.upazila, s.district].filter(Boolean).join(', ') || 'খাগড়াছড়ি'
        });
      }
    });

    // 3. From vendors who registered blood group
    vendors.forEach(v => {
      const bg = v.bloodGroup?.replace(/Blood\s*-\s*/i, '').trim();
      if (bg && (!detectedBloodGroup || bg.toUpperCase() === detectedBloodGroup)) {
        matchedBloodDonors.push({
          name: v.ownerName,
          bloodGroup: bg,
          role: `মার্চেন্ট (${v.shopName}) ও রক্তদাতা`,
          profession: 'ভেন্ডর',
          phone: v.phone || '',
          location: v.district || 'খাগড়াছড়ি'
        });
      }
    });

    // 4. From registered members/citizens who have blood group
    members.forEach(m => {
      const bg = m.bloodGroup;
      if (bg && (!detectedBloodGroup || bg.toUpperCase() === detectedBloodGroup)) {
        matchedBloodDonors.push({
          name: m.name,
          bloodGroup: bg,
          role: `নিবন্ধিত সদস্য (${m.profession || m.role}) ও রক্তদাতা`,
          profession: m.profession || 'নাগরিক',
          phone: m.phone || '',
          location: [m.upazila, m.district].filter(Boolean).join(', ') || 'খাগড়াছড়ি'
        });
      }
    });
  }

  // Format Matched Blood Donors Context
  const matchedBloodDonorsText = matchedBloodDonors.length > 0
    ? matchedBloodDonors.slice(0, 5).map((bd, idx) => `
[SUPABASE ALL-PROFILES BLOOD DONOR #${idx + 1}]
- নাম: ${bd.name}
- রক্তের গ্রুপ: ${bd.bloodGroup}
- পদবী / ভূমিকা: ${bd.role}
- পেশা: ${bd.profession}
- এলাকা / অবস্থান: ${bd.location}
- যোগাযোগের লিংক: ${bd.phone ? `<a href="tel:${bd.phone}">কল করুন</a>` : 'প্রোফাইলে সংরক্ষিত'}
`).join('\n')
    : 'N/A';

  // Delivery & Courier Policy
  const deliveryPolicyText = `
[JHADIMADI OFFICIAL DELIVERY & PAYMENT POLICY]
- ডেলিভারি পদ্ধতি: ক্যাশ অন ডেলিভারি (Cash on Delivery) সারাদেশে উপলব্ধ। পণ্য হাতে পেয়ে মূল্য পরিশোধের সুবিধা রয়েছে।
- কুরিয়ার সার্ভিস: সুন্দরবন কুরিয়ার, এসএ পরিবহন, পাঠাও, রেডেক্স ও অনুমোদিত এক্সপ্রেস কুরিয়ারে নিরাপদে পাঠানো হয়।
- ডেলিভারি চার্জ: ডেলিভারি চার্জ নির্ধারিত হবে সংশ্লিষ্ট কুরিয়ারের বর্তমান অফিশিয়াল চার্জ অনুযায়ী।
- ডেলিভারির সময়: খাগড়াছড়ি ও পাহাড়ি অঞ্চলে দ্রুততম সময়ে এবং ঢাকা, চট্টগ্রাম ও সারাদেশে ৩-৫ কার্যদিবসের মধ্যে ডেলিভারি সম্পন্ন হয়।
- পেমেন্ট সুবিধা: ক্যাশ অন ডেলিভারি (COD), বিকাশ (bKash) ও নগদ (Nagad)।
`;

  // Physical Location & Contact Info
  const storeContactText = `
[JHADIMADI OFFICIAL STORE & CONTACT INFORMATION]
- কেন্দ্রীয় স্টোরের নাম: ঝাদিমাদি অর্গানিক সেন্ট্রাল শপ (Jhadimadi Organic Central Shop)
- শারীরিক ঠিকানা: খাগড়াছড়ি সদর, পার্বত্য চট্টগ্রাম, বাংলাদেশ।
- প্রতিষ্ঠাতা: নয়ন চাকমা (Nayan Chakma)
- হটলাইন / ফোন / WhatsApp: 01870592699
- কল লিংক: <a href="tel:01870592699">01870592699</a>
- প্ল্যাটফর্মের উদ্দেশ্য: পাহাড়ের খাঁটি প্রাকৃতিক কৃষি ও ভোজ্য পণ্য ন্যায্য মূল্যে সরাসরি গ্রাহকদের কাছে পৌঁছে দেওয়া এবং লোকাল ভেরিফাইড কারিগরি সার্ভিস নেটওয়ার্ক প্রদান।
`;

  // Explicit Phonetic / Fuzzy Match Guidance Notice for Gemini AI
  const fuzzyMatchNotice = isFuzzyMatch && uniqueMatchedProducts.length > 0
    ? `
[PHONETIC & FUZZY MATCH GUIDANCE]
ব্যবহারকারী বানান বিভ্রাট বা টাইপো "${userQuery}" অনুসন্ধান করেছেন। ডাটাবেজের মাল্টি-টেবিল স্ক্যানে এর অত্যন্ত কাছাকাছি ধ্বনিতাত্ত্বিক ও প্রাসঙ্গিক ফলাফল হিসেবে "${uniqueMatchedProducts[0].nameBn}" পাওয়া গেছে।
নির্দেশনা: সরাসরি "তথ্য নেই" বলবেন না! বিনীতভাবে জানান: "আপনার কাঙ্ক্ষিত '${userQuery}' বানানের সরাসরি মিল না পাওয়া গেলেও কাছাকাছি '${uniqueMatchedProducts[0].nameBn}'-এর তথ্য পাওয়া গেছে..." এবং এর দাম (৳ ${uniqueMatchedProducts[0].price}), স্টক ও গুণগত মান বিস্তারিত তুলে ধরুন!
`
    : '';

  // Format Matched Products Context
  const matchedProductsText = uniqueMatchedProducts.length > 0
    ? uniqueMatchedProducts.map((p, idx) => `
[SUPABASE LIVE PRODUCT #${idx + 1}]
- প্রোডাক্ট কোড / ID: ${p.code || p.id}
- পণ্যের নাম (বাংলা): ${p.nameBn}
- Name (English): ${p.nameEn}
- বর্তমান লাইভ মূল্য: ৳ ${p.price} (${p.unit})
${p.originalPrice ? `- পূর্বের / নিয়মিত মূল্য: ৳ ${p.originalPrice} (ডিসকাউন্ট অফার চলমান)` : ''}
- স্টক স্ট্যাটাস (লাইভ ডাটাবেজ): ${p.inStock ? `স্টকে রয়েছে (${p.stock} টি উপলব্ধ)` : 'স্টক শেষ (Out of Stock)'}
- ওজন / প্যাকেজিং: ${p.unit}
- উৎপত্তি ও সংগ্রহস্থল: ${p.origin}
- গুণগত মান ও বৈশিষ্ট্য: ${p.qualityStandard}
- ছবি (Image URL): ${p.image}
- সরবরাহকারী: ${p.sellerInfo || 'ঝাদিমাদি মার্চেন্ট'}
- বিবরণ: ${p.description}
`).join('\n')
    : 'নির্দিষ্ট কোনো একক পণ্যের হুবহু মিল পাওয়া যায়নি।';

  // Format Active Banners Context
  const activeBannersText = activeBanners.length > 0
    ? activeBanners.map((b, idx) => `
[SUPABASE LIVE BANNER / CAMPAIGN #${idx + 1}]
- অফার শিরোনাম: ${b.title}
- সাব-টাইটেল: ${b.subtitle || 'পাহাড়ের খাঁটি পণ্যে বিশেষ ছাড়'}
- ব্যাজ / ট্যাগ: ${b.badge || 'স্পেশাল অফার'}
- ছবি: ${b.imageUrl || 'N/A'}
- সক্রিয় অবস্থা: লাইভ
`).join('\n')
    : 'বর্তমানে কোনো নির্দিষ্ট ক্যাম্পেইন ব্যানার নেই।';

  // Format Vendors Context
  const matchedVendorsText = matchedVendors.length > 0
    ? matchedVendors.map((v, idx) => `
[SUPABASE LIVE VENDOR #${idx + 1}]
- শপ / স্টোরের নাম: ${v.shopName}
- বিক্রেতা / মালিকের নাম: ${v.ownerName}
- সেলার আইডি: ${v.sellerId}
- রক্তের গ্রুপ: ${v.bloodGroup || 'N/A'}
- জেলা / অবস্থান: ${v.district}
- রেটিং: ${v.rating} ⭐
- বিক্রিত পণ্যসমূহ: ${v.productsSummary}
`).join('\n')
    : 'N/A';

  // Format Services Context
  const matchedServicesText = matchedServices.length > 0
    ? matchedServices.map((s, idx) => `
[SUPABASE LIVE SERVICE PROVIDER #${idx + 1}]
- টেকনিশিয়ান / সেবাদাতার নাম: ${s.name}
- পেশা / সেবা: ${s.profession}
- সার্ভিস চার্জ: ৳ ${s.hourlyRate || 350} / ঘণ্টা
- রেটিং: ${s.rating} ⭐
- এলাকা: ${s.district}${s.upazila ? ', ' + s.upazila : ''}
- প্রাপ্যতা: ${s.available ? 'উপলব্ধ (Available)' : 'ব্যস্ত'}
`).join('\n')
    : 'N/A';

  // Format Full Store Catalog Summary for AI awareness
  const catalogSummary = products.map(p => 
    `• ${p.nameBn} (${p.unit}): ৳${p.price} | স্টক: ${p.inStock ? `${p.stock} টি` : 'স্টক শেষ'} | ছবি: ${p.image ? 'হ্যাঁ' : 'না'}`
  ).join('\n');

  // Dynamic Suggestion Chips based on live data and user intent
  const suggestedChips: string[] = [];
  suggestedChips.push('আজকের অফার কী?', 'প্রোডাক্ট লিস্ট দেখাও', 'ডেলিভারি চার্জ কত?');
  if (products.some(p => /মধু|honey/i.test(p.nameBn + p.nameEn))) {
    suggestedChips.push('পাহাড়ি মধু এর দাম কত?');
  }
  if (products.some(p => /সিদল|সিদোল|sidol/i.test(p.nameBn + p.nameEn))) {
    suggestedChips.push('সিদল আছে কি?');
  }
  suggestedChips.push('দোকানের ঠিকানা ও যোগাযোগ', 'সরাসরি অর্ডার');

  return {
    matchedProducts: uniqueMatchedProducts,
    allProducts: products,
    activeBanners,
    matchedVendors,
    matchedServices,
    matchedBloodDonors,
    matchedBloodDonorsText,
    matchedProductsText,
    activeBannersText,
    matchedVendorsText,
    matchedServicesText,
    catalogSummary,
    deliveryPolicyText,
    storeContactText,
    isFuzzyMatch,
    fuzzyMatchedName,
    fuzzyMatchNotice,
    suggestedChips: Array.from(new Set(suggestedChips)).slice(0, 6)
  };
}
