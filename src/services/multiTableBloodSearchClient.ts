/**
 * Client service for Multi-Table Blood Search & Registration Verification
 * 
 * Rules:
 * 1. Search across all four registration tables simultaneously:
 *    - product_sellers
 *    - service_providers
 *    - permanent_members
 *    - blood_donors
 * 2. Filter by both blood group AND location (district + upazila).
 * 3. Verify user's mobile number exists in any of the 4 tables before showing results.
 *    If not found: prompt "আপনার মোবাইল নম্বরটি রেজিস্ট্রেশন করা নেই, দয়া করে রেজিস্ট্রেশন করুন" with "যুক্ত হোন" button.
 */

import { supabase } from '../lib/supabaseClient';

export interface BloodDonorResultItem {
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

export interface BloodSearchResponse {
  success: boolean;
  isRegistered: boolean;
  message: string;
  searcher?: {
    phone?: string;
    name?: string;
    table?: string;
  };
  matchedCount: number;
  results: BloodDonorResultItem[];
}

export function normalizeDigits(raw: string | number | undefined | null): string {
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

export function phonesEqual(p1: string | number | undefined, p2: string | number | undefined): boolean {
  const n1 = normalizeDigits(p1);
  const n2 = normalizeDigits(p2);
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;
  const s1 = n1.slice(-10);
  const s2 = n2.slice(-10);
  return s1.length === 10 && s1 === s2;
}

export async function verifyAndSearchBloodDonors(params: {
  searcherMobile: string;
  bloodGroup?: string;
  district?: string;
  upazila?: string;
  query?: string;
  localFallbackContext?: {
    bloodDonors?: any[];
    professionals?: any[];
    users?: any[];
    sellers?: any[];
  };
}): Promise<BloodSearchResponse> {
  const { searcherMobile, bloodGroup = '', district = '', upazila = '', query = '', localFallbackContext } = params;
  const cleanMobile = normalizeDigits(searcherMobile);

  // 1. If mobile is completely missing or under 10 digits, prompt immediately
  if (!cleanMobile || cleanMobile.length < 10) {
    return {
      success: false,
      isRegistered: false,
      message: 'রক্তদাতা নিবন্ধন আবশ্যক। রক্ত খুঁজতে হলে আপনাকেও নিবন্ধিত থাকতে হবে...',
      matchedCount: 0,
      results: []
    };
  }

  // 2. Call backend endpoint: POST /api/blood-search/verify-and-search
  try {
    const res = await fetch('/api/blood-search/verify-and-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        searcherMobile: cleanMobile,
        bloodGroup,
        district,
        upazila,
        query
      })
    });

    if (res.ok) {
      const data: BloodSearchResponse = await res.json();
      return data;
    }
  } catch (err) {
    console.warn('[BloodSearchClient] Backend call error, attempting direct Supabase query:', err);
  }

  // 3. Client-side direct Supabase check across all 4 tables without requiring login
  try {
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

    const [donorRes, sellerRes, proRes, memberRes, seekerRes] = await Promise.all([
      supabase.from('blood_donors').select('id, full_name, phone_number, whatsapp_number').or(standardOrFilter).limit(1),
      supabase.from('product_sellers').select('id, shop_or_owner_name, phone_number, whatsapp_number').or(standardOrFilter).limit(1),
      supabase.from('service_providers').select('id, full_name, phone_number, whatsapp_number').or(standardOrFilter).limit(1),
      supabase.from('permanent_members').select('id, full_name, phone_number, whatsapp_number').or(standardOrFilter).limit(1),
      supabase.from('job_seekers').select('id, full_name, phone, phone_number, contact_number, whatsapp_number').or([...legacyOrFilter.split(','), ...variants.map(v => `contact_number.eq.${v}`)].join(',')).limit(1),
    ]);

    const hasMatchInAnyTable = Boolean(
      (!donorRes.error && donorRes.data && donorRes.data.length > 0) ||
      (!sellerRes.error && sellerRes.data && sellerRes.data.length > 0) ||
      (!proRes.error && proRes.data && proRes.data.length > 0) ||
      (!memberRes.error && memberRes.data && memberRes.data.length > 0) ||
      (!seekerRes.error && seekerRes.data && seekerRes.data.length > 0)
    );

    if (hasMatchInAnyTable) {
      // User is verified in Supabase! Fetch from Universal Pool: T1, T2, T3, T4 + permanent_members
      const [dbDonorsRes, dbProsRes, dbSellersRes, dbSeekersRes, dbMembersRes] = await Promise.all([
        supabase.from('blood_donors').select('*'),
        supabase.from('service_providers').select('*'),
        supabase.from('product_sellers').select('*'),
        supabase.from('job_seekers').select('*'),
        supabase.from('permanent_members').select('*'),
      ]);

      const results: BloodDonorResultItem[] = [];
      const seen = new Set<string>();

      const cleanBg = (bg: string = '') => {
        return bg.toUpperCase().replace(/\s+/g, '').replace('পজিটিভ', '+').replace('নেগেটিভ', '-');
      };
      const cleanSearchBg = cleanBg(bloodGroup);

      const normLoc = (s: string = '') => s.toLowerCase().trim()
        .replace(/ড়/g, 'র').replace(/ড়/g, 'র')
        .replace(/ঢ়/g, 'র').replace(/ঢ়/g, 'র')
        .replace(/য়/g, 'য').replace(/য়/g, 'য')
        .replace(/[\s\-_/.,()]/g, '');

      const normSearchDist = normLoc(district);
      const normSearchUpz = normLoc(upazila);

      const matchesFilter = (bg: string, dist: string, upz: string) => {
        if (cleanSearchBg && cleanSearchBg !== 'সকল' && cleanSearchBg !== 'ALL') {
          if (cleanBg(bg) !== cleanSearchBg) return false;
        } else if (!bg || bg.trim() === '' || bg.trim() === 'N/A') {
          return false;
        }

        const normD = normLoc(dist);
        const normU = normLoc(upz);

        if (normSearchDist && !(normD.includes(normSearchDist) || normSearchDist.includes(normD))) return false;
        if (normSearchUpz && !(normU.includes(normSearchUpz) || normSearchUpz.includes(normU) || (normU.includes('সদর') && normSearchUpz.includes('সদর')))) return false;
        return true;
      };

      // T4: blood_donors
      for (const d of (dbDonorsRes.data || [])) {
        const bg = d.blood_group || '';
        const dist = d.district || '';
        const upz = d.upazila || '';
        if (!matchesFilter(bg, dist, upz)) continue;
        const ph = d.phone_number || d.phone || '';
        const key = normalizeDigits(ph) || d.id;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            id: `bd_${d.id}`,
            name: d.full_name || d.name || 'স্বেচ্ছাসেবী রক্তদাতা',
            role: 'স্বেচ্ছাসেবী রক্তদাতা',
            profession: d.profession || 'রক্তদাতা',
            sourceTable: 'blood_donors',
            sourceBadge: '🩸 নিবন্ধিত রক্তদাতা',
            phone: ph,
            whatsapp: d.whatsapp_number || ph,
            location: {
              district: dist || 'খাগড়াছড়ি',
              upazila: upz || 'সদর',
              area: d.area || upz
            },
            bloodGroup: bg || 'O+',
            avatar: d.avatar || d.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
            verified: d.consent_given !== false,
            totalDonations: d.total_donations || 1,
            lastDonationDate: d.last_donation_date || 'উপলব্ধ'
          });
        }
      }

      // T1: service_providers
      for (const p of (dbProsRes.data || [])) {
        const bg = p.blood_group || '';
        const dist = p.district || '';
        const upz = p.upazila || '';
        if (!matchesFilter(bg, dist, upz)) continue;
        const ph = p.phone_number || p.phone || '';
        const key = normalizeDigits(ph) || p.id;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            id: `sp_${p.id}`,
            name: p.full_name || p.display_name || p.name || 'দক্ষ সেবাদাতা',
            role: `দক্ষ সেবাদাতা (${p.job || p.profession || 'কারিগর'})`,
            profession: p.job || p.profession || 'কারিগর',
            sourceTable: 'service_providers',
            sourceBadge: '🛠️ দক্ষ সেবাদাতা',
            phone: ph,
            whatsapp: p.whatsapp || ph,
            location: {
              district: dist || 'রাঙ্গামাটি',
              upazila: upz || 'সদর',
              area: p.area || upz
            },
            bloodGroup: bg,
            avatar: p.avatar || p.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
            verified: Boolean(p.verified),
            totalDonations: 1,
            lastDonationDate: 'জরুরি প্রয়োজনে প্রস্তুত'
          });
        }
      }

      // T2: product_sellers
      for (const s of (dbSellersRes.data || [])) {
        const bg = s.blood_group || '';
        const dist = s.district || '';
        const upz = s.upazila || '';
        if (!matchesFilter(bg, dist, upz)) continue;
        const ph = s.phone_number || s.phone || '';
        const key = normalizeDigits(ph) || s.id;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            id: `ps_${s.id}`,
            name: s.name || s.full_name || s.proprietor_name || 'পণ্য বিক্রেতা',
            role: `পণ্য বিক্রেতা (${s.products_name || 'মার্কেটপ্লেস'})`,
            profession: 'মার্কেটপ্লেস বিক্রেতা',
            sourceTable: 'product_sellers',
            sourceBadge: '🛍️ পণ্য বিক্রেতা',
            phone: ph,
            whatsapp: s.whatsapp || ph,
            location: {
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

      // T3: job_seekers
      for (const js of (dbSeekersRes.data || [])) {
        const bg = js.blood_group || '';
        const dist = js.district || '';
        const upz = js.upazila || '';
        if (!matchesFilter(bg, dist, upz)) continue;
        const ph = js.phone_number || js.phone || js.contact_number || '';
        const key = normalizeDigits(ph) || js.id;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            id: `js_${js.id}`,
            name: js.full_name || js.name || 'চাকরিপ্রার্থী',
            role: `চাকরিপ্রার্থী (${js.skills_or_job_type || 'দক্ষ কর্মী'})`,
            profession: js.skills_or_job_type || 'চাকরিপ্রার্থী',
            sourceTable: 'job_seekers',
            sourceBadge: '💼 চাকরিপ্রার্থী',
            phone: ph,
            whatsapp: js.whatsapp_number || ph,
            location: {
              district: dist || 'খাগড়াছড়ি',
              upazila: upz || 'সদর',
              area: js.area || upz
            },
            bloodGroup: bg,
            avatar: js.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
            verified: true,
            totalDonations: 1,
            lastDonationDate: 'জরুরি প্রয়োজনে প্রস্তুত'
          });
        }
      }

      // permanent_members
      for (const m of (dbMembersRes.data || [])) {
        const bg = m.blood_group || '';
        const dist = m.district || '';
        const upz = m.upazila || '';
        if (!matchesFilter(bg, dist, upz)) continue;
        const ph = m.phone_number || m.phone || '';
        const key = normalizeDigits(ph) || m.id;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            id: `mem_${m.id}`,
            name: m.full_name || m.name || 'স্থায়ী সদস্য',
            role: 'স্থায়ী সদস্য',
            profession: 'কমিউনিটি প্রতিনিধি',
            sourceTable: 'permanent_members',
            sourceBadge: '🏅 স্থায়ী সদস্য',
            phone: ph,
            whatsapp: m.whatsapp || ph,
            location: {
              district: dist || 'খাগড়াছড়ি',
              upazila: upz || 'সদর',
              area: m.area || upz
            },
            bloodGroup: bg,
            avatar: m.photos_cv || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
            verified: true,
            totalDonations: 2,
            lastDonationDate: 'জরুরি প্রয়োজনে প্রস্তুত'
          });
        }
      }

      return {
        success: true,
        isRegistered: true,
        message: 'মোবাইল নম্বরটি নিবন্ধিত পাওয়া গেছে।',
        matchedCount: results.length,
        results
      };
    }
  } catch (err) {
    console.warn('[BloodSearchClient] Direct Supabase check notice:', err);
  }

  // 4. Client-side fallback if backend call failed or network issue
  if (localFallbackContext) {
    const { bloodDonors = [], professionals = [], users = [], sellers = [] } = localFallbackContext;

    // Check if phone exists in any registration collection
    const foundInDonors = bloodDonors.find((d: any) => phonesEqual(d.phone, cleanMobile));
    const foundInPros = professionals.find((p: any) => phonesEqual(p.phone, cleanMobile));
    const foundInUsers = users.find((u: any) => phonesEqual(u.phone, cleanMobile));
    const foundInSellers = sellers.find((s: any) => phonesEqual(s.phone, cleanMobile));

    const isReg = Boolean(foundInDonors || foundInPros || foundInUsers || foundInSellers);
    if (!isReg) {
      return {
        success: false,
        isRegistered: false,
        message: 'রক্তদাতা নিবন্ধন আবশ্যক। রক্ত খুঁজতে হলে আপনাকেও নিবন্ধিত থাকতে হবে...',
        matchedCount: 0,
        results: []
      };
    }

    // Filter matching donors across all 4 sets
    const results: BloodDonorResultItem[] = [];
    const seen = new Set<string>();

    const checkBlood = (bg: string) => {
      if (!bloodGroup) return Boolean(bg && bg.trim());
      const c1 = (bg || '').toUpperCase().replace(/\s+/g, '');
      const c2 = bloodGroup.toUpperCase().replace(/\s+/g, '');
      return c1 === c2;
    };

    const checkLoc = (recDist: string, recUpz: string) => {
      const d1 = (recDist || '').trim().toLowerCase();
      const d2 = district.trim().toLowerCase();
      const u1 = (recUpz || '').trim().toLowerCase();
      const u2 = upazila.trim().toLowerCase();

      if (d2 && !(d1.includes(d2) || d2.includes(d1))) return false;
      if (u2 && !(u1.includes(u2) || u2.includes(u1) || (u1.includes('সদর') && u2.includes('সদর')))) return false;
      return true;
    };

    // 1. blood_donors
    bloodDonors.forEach((d: any) => {
      if (checkBlood(d.bloodGroup) && checkLoc(d.district, d.upazila)) {
        const ph = d.phone || '';
        const key = normalizeDigits(ph) || d.id;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            id: `bd_${d.id}`,
            name: d.name || 'স্বেচ্ছাসেবী রক্তদাতা',
            role: 'স্বেচ্ছাসেবী রক্তদাতা',
            profession: `রক্তদান করেছেন ${d.totalDonations || 1} বার`,
            sourceTable: 'blood_donors',
            sourceBadge: '🩸 নিবন্ধিত রক্তদাতা',
            phone: ph,
            whatsapp: ph,
            location: {
              district: d.district || 'খাগড়াছড়ি',
              upazila: d.upazila || 'সদর',
              area: d.area || d.upazila || ''
            },
            bloodGroup: d.bloodGroup || 'O+',
            avatar: d.img || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
            verified: Boolean(d.verified),
            totalDonations: d.totalDonations || 1,
            lastDonationDate: d.lastDonationDate || 'উপলব্ধ'
          });
        }
      }
    });

    // 2. service_providers
    professionals.forEach((p: any) => {
      if (p.bloodGroup && checkBlood(p.bloodGroup) && checkLoc(p.district, p.upazila)) {
        const ph = p.phone || '';
        const key = normalizeDigits(ph) || p.id;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            id: `sp_${p.id}`,
            name: p.name || 'দক্ষ সেবাদাতা',
            role: `দক্ষ সেবাদাতা (${p.profession || 'কারিগর'})`,
            profession: p.profession || 'কারিগর',
            sourceTable: 'service_providers',
            sourceBadge: '🛠️ দক্ষ সেবাদাতা',
            phone: ph,
            whatsapp: ph,
            location: {
              district: p.district || 'রাঙ্গামাটি',
              upazila: p.upazila || 'সদর',
              area: p.area || p.upazila || ''
            },
            bloodGroup: p.bloodGroup,
            avatar: p.img || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
            verified: Boolean(p.verified),
            totalDonations: 1,
            lastDonationDate: 'জরুরি প্রয়োজনে প্রস্তুত'
          });
        }
      }
    });

    // 3. permanent_members / users
    users.forEach((u: any) => {
      const bg = u.bloodGroup || '';
      if (bg && checkBlood(bg) && checkLoc(u.district, u.upazila)) {
        const ph = u.phone || '';
        const key = normalizeDigits(ph) || u.id;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            id: `mem_${u.id}`,
            name: u.fullName || u.name || 'স্থায়ী সদস্য',
            role: 'ঝাদিমাদি স্থায়ী সদস্য',
            profession: 'কমিউনিটি প্রতিনিধি',
            sourceTable: 'permanent_members',
            sourceBadge: '🏅 স্থায়ী সদস্য',
            phone: ph,
            whatsapp: ph,
            location: {
              district: u.district || 'খাগড়াছড়ি',
              upazila: u.upazila || 'সদর',
              area: u.area || ''
            },
            bloodGroup: bg,
            avatar: u.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
            verified: true,
            totalDonations: 2,
            lastDonationDate: 'জরুরি প্রয়োজনে প্রস্তুত'
          });
        }
      }
    });

    return {
      success: true,
      isRegistered: true,
      message: 'সফলভাবে রক্তদাতা তালিকা পাওয়া গেছে।',
      matchedCount: results.length,
      results
    };
  }

  return {
    success: false,
    isRegistered: false,
    message: 'রক্তদাতা নিবন্ধন আবশ্যক। রক্ত খুঁজতে হলে আপনাকেও নিবন্ধিত থাকতে হবে...',
    matchedCount: 0,
    results: []
  };
}
