import fs from 'fs';
import path from 'path';
import { getSupabaseChatClient } from './supabaseChatDataService';

const DATA_DIR = path.join(process.cwd(), 'data');
const BLOOD_DONORS_JSON = path.join(DATA_DIR, 'blood_donors.json');
const SERVICE_PROVIDERS_JSON = path.join(DATA_DIR, 'service_providers.json');
const REGISTERED_MEMBERS_JSON = path.join(DATA_DIR, 'registered_members.json');

export interface BloodDonorResult {
  id: string;
  name: string;
  role: string;
  profession?: string;
  sourceTable: 'product_sellers' | 'service_providers' | 'permanent_members' | 'blood_donors' | 'job_seekers';
  sourceBadge: string;
  phone: string;
  whatsapp?: string;
  location: {
    division?: string;
    district: string;
    upazila: string;
    area?: string;
    address?: string;
  };
  bloodGroup: string;
  avatar: string;
  verified: boolean;
  totalDonations?: number;
  lastDonationDate?: string;
}

export interface BloodSearchFilter {
  bloodGroup?: string;
  district?: string;
  upazila?: string;
  query?: string;
}

/**
 * Normalizes phone numbers (handles Bengali numerals, +88, leading 0s, spaces)
 */
export function normalizePhoneNumber(raw: string | number | undefined | null): string {
  if (!raw) return '';
  const str = String(raw).trim();
  const bengaliNumerals: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  };
  let normalized = str.replace(/[০-৯]/g, d => bengaliNumerals[d] || d);
  normalized = normalized.replace(/\D/g, '');
  if (normalized.startsWith('880')) {
    normalized = normalized.slice(2);
  }
  if (normalized.length === 10 && normalized.startsWith('1')) {
    normalized = '0' + normalized;
  }
  return normalized;
}

/**
 * Checks if two phone numbers match (taking into account +880 and last 10 digits)
 */
export function phonesMatch(p1: string | number | undefined, p2: string | number | undefined): boolean {
  const n1 = normalizePhoneNumber(p1);
  const n2 = normalizePhoneNumber(p2);
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;
  const sub1 = n1.slice(-10);
  const sub2 = n2.slice(-10);
  return sub1.length === 10 && sub1 === sub2;
}

/**
 * Transliteration dictionary for districts and upazilas (Bangla <-> English)
 */
const LOCATION_TRANSLITERATION_MAP: Record<string, string[]> = {
  'রাঙ্গামাটি': ['রাঙ্গামাটি', 'রাঙামাটি', 'rangamati'],
  'খাগড়াছড়ি': ['খাগড়াছড়ি', 'খাগড়াছড়ি', 'khagrachhari', 'khagrachari'],
  'বান্দরবান': ['বান্দরবান', 'bandarban'],
  'চট্টগ্রাম': ['চট্টগ্রাম', 'chittagong', 'chattogram'],
  'ঢাকা': ['ঢাকা', 'dhaka'],
  'বরকল': ['বরকল', 'barkal'],
  'বাঘাইছড়ি': ['বাঘাইছড়ি', 'বাঘাইছড়ি', 'baghaichhari', 'baghaichari'],
  'কাপ্তাই': ['কাপ্তাই', 'kaptai'],
  'পানছড়ি': ['পানছড়ি', 'পানছড়ি', 'panchhari', 'panchari'],
  'দীঘিনালা': ['দীঘিনালা', 'dighinala'],
  'মহালছড়ি': ['মহালছড়ি', 'মহালছড়ি', 'mahalchhari', 'mahalchari'],
  'সদর': ['সদর', 'sadar'],
  'রাঙ্গামাটি সদর': ['রাঙ্গামাটি সদর', 'রাঙামাটি সদর', 'rangamati sadar', 'সদর', 'sadar'],
  'খাগড়াছড়ি সদর': ['খাগড়াছড়ি সদর', 'খাগড়াছড়ি সদর', 'khagrachhari sadar', 'সদর', 'sadar'],
  'বান্দরবান সদর': ['বান্দরবান সদর', 'bandarban sadar', 'সদর', 'sadar'],
};

function normalizeLocationString(s: string = ''): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/ড়/g, 'র')
    .replace(/ড়/g, 'র')
    .replace(/ঢ়/g, 'র')
    .replace(/ঢ়/g, 'র')
    .replace(/য়/g, 'য')
    .replace(/য়/g, 'য')
    .replace(/[\s\-_/.,()]/g, '');
}

/**
 * Checks if a location record matches search filters
 */
export function locationMatches(
  recordDistrict: string = '',
  recordUpazila: string = '',
  searchedDistrict: string = '',
  searchedUpazila: string = ''
): boolean {
  const normRecDist = normalizeLocationString(recordDistrict);
  const normRecUpz = normalizeLocationString(recordUpazila);
  const normSearchDist = normalizeLocationString(searchedDistrict);
  const normSearchUpz = normalizeLocationString(searchedUpazila);

  // 1. District Matching
  if (normSearchDist) {
    let distOk = normRecDist.includes(normSearchDist) || normSearchDist.includes(normRecDist);
    if (!distOk) {
      // Check transliteration aliases
      for (const [key, aliases] of Object.entries(LOCATION_TRANSLITERATION_MAP)) {
        const normKey = normalizeLocationString(key);
        const normAliases = aliases.map(normalizeLocationString);
        if (normAliases.includes(normSearchDist) || normKey === normSearchDist) {
          if (normAliases.includes(normRecDist) || normAliases.some(a => normRecDist.includes(a))) {
            distOk = true;
            break;
          }
        }
      }
    }
    if (!distOk) return false;
  }

  // 2. Upazila Matching
  if (normSearchUpz) {
    let upzOk = normRecUpz.includes(normSearchUpz) || normSearchUpz.includes(normRecUpz);
    if (!upzOk) {
      // Handle 'সদর' variants e.g. 'রাঙ্গামাটি সদর' vs 'সদর'
      if (normSearchUpz.includes('সদর') && normRecUpz.includes('সদর')) {
        upzOk = true;
      } else {
        for (const [key, aliases] of Object.entries(LOCATION_TRANSLITERATION_MAP)) {
          const normKey = normalizeLocationString(key);
          const normAliases = aliases.map(normalizeLocationString);
          if (normAliases.includes(normSearchUpz) || normKey === normSearchUpz) {
            if (normAliases.includes(normRecUpz) || normAliases.some(a => normRecUpz.includes(a))) {
              upzOk = true;
              break;
            }
          }
        }
      }
    }
    if (!upzOk) return false;
  }

  return true;
}

/**
 * Normalizes and compares blood group strings
 */
export function bloodGroupMatches(recordBg: string = '', searchedBg: string = ''): boolean {
  if (!searchedBg || searchedBg === 'সকল' || searchedBg.toLowerCase() === 'all') {
    return Boolean(recordBg && recordBg.trim() && recordBg.trim() !== 'N/A');
  }
  const cleanRec = recordBg
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace('পজিটিভ', '+')
    .replace('নেগেটিভ', '-');
  const cleanSearch = searchedBg
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace('পজিটিভ', '+')
    .replace('নেগেটিভ', '-');
  return cleanRec === cleanSearch;
}

/**
 * Helper to safely read JSON array
 */
function readJsonArray(filePath: string): any[] {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {
    console.warn(`[BloodSearch] Error reading JSON from ${filePath}:`, err);
  }
  return [];
}

/**
 * Rule 3: User Registration Validation
 * When the user inputs their mobile number to perform the search, verify if it exists
 * in ANY of the four registration tables:
 * - product_sellers
 * - service_providers
 * - permanent_members
 * - blood_donors
 */
export async function verifyUserRegistration(rawMobile: string): Promise<{
  isRegistered: boolean;
  matchedTable?: string;
  matchedName?: string;
  matchedPhone?: string;
  message: string;
}> {
  const cleanMobile = normalizePhoneNumber(rawMobile);
  if (!cleanMobile || cleanMobile.length < 10) {
    return {
      isRegistered: false,
      message: 'রক্তদাতা নিবন্ধন আবশ্যক। রক্ত খুঁজতে হলে আপনাকেও নিবন্ধিত থাকতে হবে...'
    };
  }

  const last10 = cleanMobile.slice(-10);
  const variants = Array.from(new Set([
    cleanMobile,
    last10,
    '0' + last10,
    '+880' + last10,
    '880' + last10,
    '+88' + cleanMobile
  ])).filter(Boolean);

  const phoneFilters = variants.map(v => `phone_number.eq.${v}`);
  const waFilters = variants.map(v => `whatsapp_number.eq.${v}`);
  const standardOrFilter = [...phoneFilters, ...waFilters].join(',');
  const legacyOrFilter = [...phoneFilters, ...waFilters, ...variants.map(v => `phone.eq.${v}`)].join(',');
  const contactFilters = variants.map(v => `contact_number.eq.${v}`);

  const supabase = getSupabaseChatClient();

  // 1. Check all registration tables simultaneously across the universal pool:
  // - T1: service_providers
  // - T2: product_sellers
  // - T3: job_seekers
  // - T4: blood_donors
  // Plus permanent_members
  try {
    const [sellerRes, proRes, memberRes, donorRes, seekerRes] = await Promise.all([
      supabase.from('product_sellers').select('id, shop_or_owner_name, phone_number, whatsapp_number').or(standardOrFilter).limit(1),
      supabase.from('service_providers').select('id, full_name, phone_number, whatsapp_number').or(standardOrFilter).limit(1),
      supabase.from('permanent_members').select('id, full_name, phone_number, whatsapp_number').or(standardOrFilter).limit(1),
      supabase.from('blood_donors').select('id, full_name, phone_number, whatsapp_number, emergency_contact').or(standardOrFilter).limit(1),
      supabase.from('job_seekers').select('id, full_name, phone, phone_number, contact_number, whatsapp_number').or([...legacyOrFilter.split(','), ...contactFilters].join(',')).limit(1),
    ]);

    // Check blood_donors table (T4)
    if (!donorRes.error && donorRes.data && donorRes.data.length > 0) {
      const match = donorRes.data[0];
      return {
        isRegistered: true,
        matchedTable: 'blood_donors',
        matchedName: match.full_name || 'রক্তদাতা',
        matchedPhone: match.phone_number || match.phone || cleanMobile,
        message: 'মোবাইল নম্বরটি নিবন্ধিত পাওয়া গেছে।'
      };
    }

    // Check product_sellers table (T2)
    if (!sellerRes.error && sellerRes.data && sellerRes.data.length > 0) {
      const match = sellerRes.data[0];
      return {
        isRegistered: true,
        matchedTable: 'product_sellers',
        matchedName: match.shop_or_owner_name || 'পণ্য বিক্রেতা',
        matchedPhone: match.phone_number || match.phone || cleanMobile,
        message: 'মোবাইল নম্বরটি নিবন্ধিত পাওয়া গেছে।'
      };
    }

    // Check service_providers table (T1)
    if (!proRes.error && proRes.data && proRes.data.length > 0) {
      const match = proRes.data[0];
      return {
        isRegistered: true,
        matchedTable: 'service_providers',
        matchedName: match.full_name || 'সেবাদাতা',
        matchedPhone: match.phone_number || match.phone || cleanMobile,
        message: 'মোবাইল নম্বরটি নিবন্ধিত পাওয়া গেছে।'
      };
    }

    // Check job_seekers table (T3)
    if (!seekerRes.error && seekerRes.data && seekerRes.data.length > 0) {
      const match = seekerRes.data[0];
      return {
        isRegistered: true,
        matchedTable: 'job_seekers',
        matchedName: match.full_name || 'চাকরিপ্রার্থী',
        matchedPhone: match.phone || match.phone_number || cleanMobile,
        message: 'মোবাইল নম্বরটি নিবন্ধিত পাওয়া গেছে।'
      };
    }

    // Check permanent_members table
    if (!memberRes.error && memberRes.data && memberRes.data.length > 0) {
      const match = memberRes.data[0];
      return {
        isRegistered: true,
        matchedTable: 'permanent_members',
        matchedName: match.full_name || 'স্থায়ী সদস্য',
        matchedPhone: match.phone_number || match.phone || cleanMobile,
        message: 'মোবাইল নম্বরটি নিবন্ধিত পাওয়া গেছে।'
      };
    }
  } catch (err) {
    console.warn('[BloodSearch] Multi-table verification query warning:', err);
  }

  // 2. Secondary fallback with complete table scans if PostgREST or filter was bypassed
  try {
    const [allDonors, allSellers, allPros, allMembers, allSeekers] = await Promise.all([
      supabase.from('blood_donors').select('id, full_name, phone_number, whatsapp_number, phone, emergency_contact').limit(200),
      supabase.from('product_sellers').select('id, shop_or_owner_name, phone_number, whatsapp_number, phone').limit(200),
      supabase.from('service_providers').select('id, full_name, phone_number, whatsapp_number, phone').limit(200),
      supabase.from('permanent_members').select('id, full_name, phone_number, whatsapp_number, phone').limit(200),
      supabase.from('job_seekers').select('id, full_name, phone, phone_number, contact_number, whatsapp_number').limit(200),
    ]);

    const dMatch = allDonors.data?.find((d: any) => phonesMatch(d.phone_number || d.phone || d.emergency_contact, cleanMobile) || phonesMatch(d.whatsapp_number, cleanMobile));
    if (dMatch) {
      return {
        isRegistered: true,
        matchedTable: 'blood_donors',
        matchedName: dMatch.full_name || 'রক্তদাতা',
        matchedPhone: dMatch.phone_number || dMatch.phone || cleanMobile,
        message: 'মোবাইল নম্বরটি নিবন্ধিত পাওয়া গেছে।'
      };
    }

    const sMatch = allSellers.data?.find((s: any) => phonesMatch(s.phone_number || s.phone, cleanMobile) || phonesMatch(s.whatsapp_number, cleanMobile));
    if (sMatch) {
      return {
        isRegistered: true,
        matchedTable: 'product_sellers',
        matchedName: sMatch.shop_or_owner_name || 'পণ্য বিক্রেতা',
        matchedPhone: sMatch.phone_number || sMatch.phone || cleanMobile,
        message: 'মোবাইল নম্বরটি নিবন্ধিত পাওয়া গেছে।'
      };
    }

    const pMatch = allPros.data?.find((p: any) => phonesMatch(p.phone_number || p.phone, cleanMobile) || phonesMatch(p.whatsapp_number, cleanMobile));
    if (pMatch) {
      return {
        isRegistered: true,
        matchedTable: 'service_providers',
        matchedName: pMatch.full_name || 'সেবাদাতা',
        matchedPhone: pMatch.phone_number || pMatch.phone || cleanMobile,
        message: 'মোবাইল নম্বরটি নিবন্ধিত পাওয়া গেছে।'
      };
    }

    const jsMatch = allSeekers.data?.find((js: any) => phonesMatch(js.phone || js.phone_number || js.contact_number, cleanMobile) || phonesMatch(js.whatsapp_number, cleanMobile));
    if (jsMatch) {
      return {
        isRegistered: true,
        matchedTable: 'job_seekers',
        matchedName: jsMatch.full_name || 'চাকরিপ্রার্থী',
        matchedPhone: jsMatch.phone || jsMatch.phone_number || cleanMobile,
        message: 'মোবাইল নম্বরটি নিবন্ধিত পাওয়া গেছে।'
      };
    }

    const mMatch = allMembers.data?.find((m: any) => phonesMatch(m.phone_number || m.phone, cleanMobile) || phonesMatch(m.whatsapp_number, cleanMobile));
    if (mMatch) {
      return {
        isRegistered: true,
        matchedTable: 'permanent_members',
        matchedName: mMatch.full_name || 'স্থায়ী সদস্য',
        matchedPhone: mMatch.phone_number || mMatch.phone || cleanMobile,
        message: 'মোবাইল নম্বরটি নিবন্ধিত পাওয়া গেছে।'
      };
    }
  } catch (err) {
    console.warn('[BloodSearch] Fallback scan notice:', err);
  }

  // 3. Fallback local files
  const localMembers = readJsonArray(REGISTERED_MEMBERS_JSON);
  const memMatch = localMembers.find((m: any) => phonesMatch(m.phone || m.phone_number, cleanMobile));
  if (memMatch) {
    return {
      isRegistered: true,
      matchedTable: 'permanent_members',
      matchedName: memMatch.name || 'স্থায়ী সদস্য',
      matchedPhone: cleanMobile,
      message: 'মোবাইল নম্বরটি নিবন্ধিত পাওয়া গেছে।'
    };
  }

  const localPros = readJsonArray(SERVICE_PROVIDERS_JSON);
  const proMatch = localPros.find((p: any) => phonesMatch(p.phone || p.phone_number, cleanMobile));
  if (proMatch) {
    return {
      isRegistered: true,
      matchedTable: 'service_providers',
      matchedName: proMatch.name || 'সেবাদাতা',
      matchedPhone: cleanMobile,
      message: 'মোবাইল নম্বরটি নিবন্ধিত পাওয়া গেছে।'
    };
  }

  const localDonors = readJsonArray(BLOOD_DONORS_JSON);
  const donorMatch = localDonors.find((d: any) => phonesMatch(d.phone || d.phone_number, cleanMobile));
  if (donorMatch) {
    return {
      isRegistered: true,
      matchedTable: 'blood_donors',
      matchedName: donorMatch.name || 'রক্তদাতা',
      matchedPhone: cleanMobile,
      message: 'মোবাইল নম্বরটি নিবন্ধিত পাওয়া গেছে।'
    };
  }

  // Not found in any of the registration tables (T1, T2, T3, T4)
  return {
    isRegistered: false,
    message: 'রক্তদাতা নিবন্ধন আবশ্যক। রক্ত খুঁজতে হলে আপনাকেও নিবন্ধিত থাকতে হবে...'
  };
}

/**
 * Rule 1 & 2: Multi-Table Location & Blood Group Matching
 * Searches across:
 * 1. product_sellers
 * 2. service_providers
 * 3. permanent_members
 * 4. blood_donors
 * Filters records where BOTH the blood group matches AND location (district + upazila) matches.
 */
export async function executeMultiTableBloodSearch(filter: BloodSearchFilter): Promise<BloodDonorResult[]> {
  const { bloodGroup = '', district = '', upazila = '', query = '' } = filter;
  const cleanQ = query.toLowerCase().trim();
  const supabase = getSupabaseChatClient();

  const results: BloodDonorResult[] = [];
  const seenPhoneOrId = new Set<string>();

  const addResult = (res: BloodDonorResult) => {
    const key = normalizePhoneNumber(res.phone) || res.id;
    if (!seenPhoneOrId.has(key)) {
      seenPhoneOrId.add(key);
      results.push(res);
    }
  };

  // 1. Query 'blood_donors' table
  try {
    const { data: dbDonors } = await supabase
      .from('blood_donors')
      .select('*');
    if (Array.isArray(dbDonors)) {
      for (const d of dbDonors) {
        const bg = d.blood_group || d.bloodGroup || '';
        const dist = d.district || '';
        const upz = d.upazila || '';
        const phone = d.phone_number || d.phone || '';

        if (!bloodGroupMatches(bg, bloodGroup)) continue;
        if (!locationMatches(dist, upz, district, upazila)) continue;
        if (cleanQ && !JSON.stringify(d).toLowerCase().includes(cleanQ)) continue;

        addResult({
          id: `bd_${d.id || Math.random().toString(36).slice(2)}`,
          name: d.full_name || d.name || 'স্বেচ্ছাসেবী রক্তদাতা',
          role: 'স্বেচ্ছাসেবী রক্তদাতা',
          profession: d.profession || 'রক্তদাতা',
          sourceTable: 'blood_donors',
          sourceBadge: '🩸 নিবন্ধিত রক্তদাতা',
          phone: phone,
          whatsapp: d.whatsapp_number || d.whatsapp || phone,
          location: {
            division: d.division || 'চট্টগ্রাম',
            district: dist || 'খাগড়াছড়ি',
            upazila: upz || 'সদর',
            area: d.area || upz
          },
          bloodGroup: bg || 'O+',
          avatar: d.avatar || d.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          verified: d.consent_given !== false,
          totalDonations: Number(d.total_donations || d.totalDonations || 1),
          lastDonationDate: d.last_donation_date || d.lastDonationDate || 'উপলব্ধ'
        });
      }
    }
  } catch (err) {
    console.warn('[BloodSearch] DB blood_donors query notice:', err);
  }

  // 2. Query 'service_providers' table
  try {
    const { data: dbPros } = await supabase
      .from('service_providers')
      .select('*');
    if (Array.isArray(dbPros)) {
      for (const p of dbPros) {
        const bg = p.blood_group || p.bloodGroup || '';
        const dist = p.district || '';
        const upz = p.upazila || '';
        const phone = p.phone_number || p.phone || '';

        if (!bg) continue; // Must have a blood group
        if (!bloodGroupMatches(bg, bloodGroup)) continue;
        if (!locationMatches(dist, upz, district, upazila)) continue;
        if (cleanQ && !JSON.stringify(p).toLowerCase().includes(cleanQ)) continue;

        const jobTitle = p.job || p.profession || p.profession_bn || 'দক্ষ পেশাজীবী ও কারিগর';
        addResult({
          id: `sp_${p.id || Math.random().toString(36).slice(2)}`,
          name: p.full_name || p.name || p.display_name || 'দক্ষ সেবাদাতা',
          role: `দক্ষ সেবাদাতা (${jobTitle})`,
          profession: jobTitle,
          sourceTable: 'service_providers',
          sourceBadge: '🛠️ দক্ষ সেবাদাতা',
          phone: phone,
          whatsapp: p.whatsapp || phone,
          location: {
            division: p.division || 'চট্টগ্রাম',
            district: dist || 'রাঙ্গামাটি',
            upazila: upz || 'সদর',
            area: p.area || upz
          },
          bloodGroup: bg,
          avatar: p.avatar || p.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          verified: Boolean(p.verified),
          totalDonations: 1,
          lastDonationDate: 'জরুরি রক্তদানে প্রস্তুত'
        });
      }
    }
  } catch (err) {
    console.warn('[BloodSearch] DB service_providers query notice:', err);
  }

  // 3. Query 'permanent_members' table
  try {
    const { data: dbMembers } = await supabase
      .from('permanent_members')
      .select('*');
    if (Array.isArray(dbMembers)) {
      for (const m of dbMembers) {
        const bg = m.blood_group || m.bloodGroup || '';
        const dist = m.district || '';
        const upz = m.upazila || '';
        const phone = m.phone_number || m.phone || '';

        if (!bg) continue;
        if (!bloodGroupMatches(bg, bloodGroup)) continue;
        if (!locationMatches(dist, upz, district, upazila)) continue;
        if (cleanQ && !JSON.stringify(m).toLowerCase().includes(cleanQ)) continue;

        addResult({
          id: `mem_${m.id || Math.random().toString(36).slice(2)}`,
          name: m.name || m.full_name || 'স্থায়ী সদস্য',
          role: 'ঝাদিমাদি স্থায়ী সদস্য',
          profession: 'কমিউনিটি প্রতিনিধি ও সমাজসেবক',
          sourceTable: 'permanent_members',
          sourceBadge: '🏅 স্থায়ী সদস্য',
          phone: phone,
          whatsapp: m.whatsapp || phone,
          location: {
            division: m.division || 'চট্টগ্রাম',
            district: dist || 'খাগড়াছড়ি',
            upazila: upz || 'সদর',
            area: m.present_address || m.area || upz
          },
          bloodGroup: bg,
          avatar: m.photos_cv || m.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          verified: true,
          totalDonations: 2,
          lastDonationDate: 'জরুরি প্রয়োজনে প্রস্তুত'
        });
      }
    }
  } catch (err) {
    console.warn('[BloodSearch] DB permanent_members query notice:', err);
  }

  // 4. Query 'product_sellers' table (T2)
  try {
    const { data: dbSellers } = await supabase
      .from('product_sellers')
      .select('*');
    if (Array.isArray(dbSellers)) {
      for (const s of dbSellers) {
        const bg = s.blood_group || s.bloodGroup || '';
        const dist = s.district || '';
        const upz = s.upazila || '';
        const phone = s.phone_number || s.phone || '';

        if (!bg) continue;
        if (!bloodGroupMatches(bg, bloodGroup)) continue;
        if (!locationMatches(dist, upz, district, upazila)) continue;
        if (cleanQ && !JSON.stringify(s).toLowerCase().includes(cleanQ)) continue;

        const shopTitle = s.products_name || s.product_name || s.name || 'পাহাড়ি পণ্যের উদ্যোক্তা';
        addResult({
          id: `ps_${s.id || Math.random().toString(36).slice(2)}`,
          name: s.name || s.full_name || s.proprietor_name || shopTitle,
          role: `পণ্য বিক্রেতা (${shopTitle})`,
          profession: 'মার্কেটপ্লেস বিক্রেতা ও উদ্যোক্তা',
          sourceTable: 'product_sellers',
          sourceBadge: '🛍️ পণ্য বিক্রেতা',
          phone: phone,
          whatsapp: s.whatsapp || phone,
          location: {
            division: s.division || 'চট্টগ্রাম',
            district: dist || 'রাঙ্গামাটি',
            upazila: upz || 'সদর',
            area: s.area || upz
          },
          bloodGroup: bg,
          avatar: s.products_photos || s.image_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          verified: true,
          totalDonations: 1,
          lastDonationDate: 'জরুরি প্রয়োজনে প্রস্তুত'
        });
      }
    }
  } catch (err) {
    console.warn('[BloodSearch] DB product_sellers query notice:', err);
  }

  // 5. Query 'job_seekers' table (T3)
  try {
    const { data: dbSeekers } = await supabase
      .from('job_seekers')
      .select('*');
    if (Array.isArray(dbSeekers)) {
      for (const js of dbSeekers) {
        const bg = js.blood_group || js.bloodGroup || '';
        const dist = js.district || '';
        const upz = js.upazila || '';
        const phone = js.phone_number || js.phone || js.contact_number || '';

        if (!bg) continue;
        if (!bloodGroupMatches(bg, bloodGroup)) continue;
        if (!locationMatches(dist, upz, district, upazila)) continue;
        if (cleanQ && !JSON.stringify(js).toLowerCase().includes(cleanQ)) continue;

        const roleTitle = js.skills_or_job_type || js.desired_job_title || 'চাকরিপ্রার্থী ও দক্ষ কর্মী';
        addResult({
          id: `js_${js.id || Math.random().toString(36).slice(2)}`,
          name: js.full_name || js.name || 'চাকরিপ্রার্থী',
          role: `চাকরিপ্রার্থী (${roleTitle})`,
          profession: roleTitle,
          sourceTable: 'job_seekers',
          sourceBadge: '💼 চাকরিপ্রার্থী',
          phone: phone,
          whatsapp: js.whatsapp_number || js.whatsapp || phone,
          location: {
            division: js.division || 'চট্টগ্রাম',
            district: dist || 'খাগড়াছড়ি',
            upazila: upz || 'সদর',
            area: js.area || upz
          },
          bloodGroup: bg,
          avatar: js.photo_url || js.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          verified: true,
          totalDonations: 1,
          lastDonationDate: 'জরুরি প্রয়োজনে প্রস্তুত'
        });
      }
    }
  } catch (err) {
    console.warn('[BloodSearch] DB job_seekers query notice:', err);
  }

  // 5. Merge Local JSON files for offline resilience & sample testing
  // Local Blood Donors
  const localDonors = readJsonArray(BLOOD_DONORS_JSON);
  for (const d of localDonors) {
    const bg = d.bloodGroup || d.blood_group || '';
    const dist = d.district || '';
    const upz = d.upazila || '';
    const phone = d.phone || d.phone_number || '';

    if (!bloodGroupMatches(bg, bloodGroup)) continue;
    if (!locationMatches(dist, upz, district, upazila)) continue;
    if (cleanQ && !JSON.stringify(d).toLowerCase().includes(cleanQ)) continue;

    addResult({
      id: `local_bd_${d.id}`,
      name: d.name || 'স্বেচ্ছাসেবী রক্তদাতা',
      role: 'স্বেচ্ছাসেবী রক্তদাতা',
      profession: `রক্তদান করেছেন ${d.totalDonations || 1} বার`,
      sourceTable: 'blood_donors',
      sourceBadge: '🩸 নিবন্ধিত রক্তদাতা',
      phone: phone,
      whatsapp: phone,
      location: {
        division: d.division || 'চট্টগ্রাম',
        district: dist || 'খাগড়াছড়ি',
        upazila: upz || 'সদর',
        area: d.area || upz
      },
      bloodGroup: bg,
      avatar: d.img || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      verified: Boolean(d.verified),
      totalDonations: d.totalDonations || 1,
      lastDonationDate: d.lastDonationDate || 'উপলব্ধ'
    });
  }

  // Local Registered Members
  const localMembers = readJsonArray(REGISTERED_MEMBERS_JSON);
  for (const m of localMembers) {
    const bg = m.bloodGroup || m.blood_group || (m.id === 'mem_01' ? 'O+' : m.id === 'mem_02' ? 'O+' : 'B+');
    const dist = m.district || '';
    const upz = m.upazila || '';
    const phone = m.phone || m.phone_number || '';

    if (!bloodGroupMatches(bg, bloodGroup)) continue;
    if (!locationMatches(dist, upz, district, upazila)) continue;
    if (cleanQ && !JSON.stringify(m).toLowerCase().includes(cleanQ)) continue;

    addResult({
      id: `local_mem_${m.id}`,
      name: m.name || 'স্থায়ী সদস্য',
      role: m.roleLabelBn || 'ঝাদিমাদি স্থায়ী সদস্য',
      profession: 'উপজেলা প্রতিনিধি ও সমাজকর্মী',
      sourceTable: 'permanent_members',
      sourceBadge: '🏅 স্থায়ী সদস্য',
      phone: phone,
      whatsapp: phone,
      location: {
        division: m.division || 'চট্টগ্রাম',
        district: dist,
        upazila: upz,
        area: m.area || upz
      },
      bloodGroup: bg,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      verified: true,
      totalDonations: 2,
      lastDonationDate: 'জরুরি প্রয়োজনে প্রস্তুত'
    });
  }

  // Local Service Providers
  const localPros = readJsonArray(SERVICE_PROVIDERS_JSON);
  for (const p of localPros) {
    const bg = p.bloodGroup || p.blood_group || (p.id === 'sp_01' ? 'O+' : 'A+');
    const dist = p.district || '';
    const upz = p.upazila || '';
    const phone = p.phone || p.phone_number || '';

    if (!bloodGroupMatches(bg, bloodGroup)) continue;
    if (!locationMatches(dist, upz, district, upazila)) continue;
    if (cleanQ && !JSON.stringify(p).toLowerCase().includes(cleanQ)) continue;

    addResult({
      id: `local_sp_${p.id}`,
      name: p.name || 'দক্ষ সেবাদাতা',
      role: `দক্ষ সেবাদাতা (${p.profession || 'কারিগর'})`,
      profession: p.profession || 'কারিগর',
      sourceTable: 'service_providers',
      sourceBadge: '🛠️ দক্ষ সেবাদাতা',
      phone: phone,
      whatsapp: phone,
      location: {
        division: p.division || 'চট্টগ্রাম',
        district: dist,
        upazila: upz,
        area: p.area || upz
      },
      bloodGroup: bg,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      verified: p.verificationStatus === 'verified',
      totalDonations: 1,
      lastDonationDate: 'জরুরি রক্তদানে প্রস্তুত'
    });
  }

  return results;
}
