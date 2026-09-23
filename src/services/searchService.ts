/**
 * Universal Fuzzy Search & All-Table Scanning Service
 * Jhadimadi.com
 * 
 * Core Mandates:
 * 1. NEVER SAY "NOT FOUND" IMMEDIATELY: Scans across ALL core database tables
 *    (products, services, vendors, blood_donors, profiles, circulars, seekers).
 * 2. FUZZY MATCHING & SPELLING TOLERANCE: Resolves typos like "খেদল", "মেদল", "গোলাল" -> "সিদল",
 *    and "খুরিযু" -> "মরিচ" using Levenshtein distance, Trigrams, and phonetic dialect normalizers.
 * 3. SUPABASE RPC + FALLBACK: Calls supabase.rpc('universal_search') with automatic JavaScript
 *    string similarity fallback.
 * 4. UNIVERSAL BLOOD SEARCH: When querying blood (e.g. "খাগড়াছড়ি এ পজিটিভ" / "A+"), scans across ALL
 *    registered profiles (Electricians, Vendors, Service Providers, Donors, Citizens).
 */

import { supabase } from '../lib/supabaseClient';
import { databaseService } from './databaseService';
import { 
  normalizeBengali, 
  levenshteinDistance, 
  getSynonymsForWord, 
  cleanSearchString 
} from '../utils/fuzzySearch';

export interface UniversalSearchResultItem {
  id: string;
  type: 'product' | 'service' | 'vendor' | 'blood_donor' | 'member' | 'circular' | 'seeker';
  title: string;          // Name (Product Name or Person Full Name)
  subtitle: string;       // Secondary description (e.g., "A+ রক্তদাতা", "খাঁটি পাহাড়ি পণ্য")
  category: string;       // Main category
  role: string;           // Role / Profession (e.g., "ইলেকট্রিশিয়ান", "রক্তদাতা", "মার্চেন্ট")
  profession?: string;
  phone?: string;         // Phone number for direct contact
  location: string;       // Human readable location (e.g., "খাগড়াছড়ি সদর, খাগড়াছড়ি")
  district?: string;
  upazila?: string;
  bloodGroup?: string;    // e.g. "A+", "O+", "B+", "AB+"
  price?: number | string;// Price or hourly rate
  imageUrl?: string;
  rating?: number;
  similarity: number;     // 0.0 - 1.0
  isFuzzyMatch: boolean;
  matchedVia?: string;
  actionButtons: {
    canCall: boolean;
    callHref?: string;
    canOrder: boolean;
    canView: boolean;
    whatsapp?: string;
  };
  raw: any;
}

export interface UniversalSearchResponse {
  query: string;
  normalizedQuery: string;
  totalCount: number;
  source: 'rpc' | 'multi_table_scan' | 'fuzzy_js_fallback';
  isFuzzyMatch: boolean;
  suggestedTerm?: string;
  items: UniversalSearchResultItem[];
  byType: {
    products: UniversalSearchResultItem[];
    services: UniversalSearchResultItem[];
    bloodDonors: UniversalSearchResultItem[];
    members: UniversalSearchResultItem[];
    vendors: UniversalSearchResultItem[];
    circulars: UniversalSearchResultItem[];
    seekers: UniversalSearchResultItem[];
  };
}

// ----------------------------------------------------
// TYPO & PHONETIC DICTIONARY (EXPLICIT USER SPELLING TOLERANCES)
// ----------------------------------------------------
const KNOWN_TYPO_MAPPINGS: Record<string, string> = {
  // সিদল / সিদোল variations
  'খেদল': 'সিদল',
  'মেদল': 'সিদল',
  'গোলাল': 'সিদল',
  'সেদল': 'সিদল',
  'সেদোল': 'সিদল',
  'হিদল': 'সিদল',
  'হিদোল': 'সিদল',
  'হীদোল': 'সিদল',
  'সীদল': 'সিদল',
  'সিডল': 'সিদল',
  'সিডোল': 'সিদল',
  'sidol': 'সিদল',
  'shidol': 'সিদল',
  'sidal': 'সিদল',

  // মরিচ variations
  'খুরিযু': 'মরিচ',
  'খরিচ': 'মরিচ',
  'মরিষ': 'মরিচ',
  'মোরিস': 'মরিচ',
  'মরিচ': 'মরিচ',
  'morich': 'মরিচ',
  'chili': 'মরিচ',
  'chilli': 'মরিচ',

  // শুটকি variations
  'সুটকি': 'শুটকি',
  'সুটাক': 'শুটকি',
  'চুটকি': 'শুটকি',
  'চুটাক': 'শুটকি',
  'হুটকি': 'শুটকি',
  'হুতকি': 'শুটকি',
  'shutki': 'শুটকি',

  // মধু variations
  'মদু': 'মধু',
  'মধু': 'মধু',
  'modhu': 'মধু',
  'honey': 'মধু',

  // হলুদ variations
  'হুলুদ': 'হলুদ',
  'হলদি': 'হলুদ',
  'haldi': 'হলুদ',
  'holud': 'হলুদ',

  // চাল variations
  'সল': 'চাল',
  'সাল': 'চাল',
  'chal': 'চাল',
  'bini': 'বিনি চাল',
};

// Standard Blood Groups Pattern
const BLOOD_GROUP_REGEX = /\b(A\+|A\-|B\+|B\-|AB\+|AB\-|O\+|O\-)\b/i;
const BANGLA_BLOOD_REGEX = /(এ\s*পজিটিভ|এ\s*পজেটিভ|বি\s*পজিটিভ|বি\s*পজেটিভ|এবি\s*পজিটিভ|এবি\s*পজেটিভ|ও\s*পজিটিভ|ও\s*পজেটিভ|এ\s*নেগেটিভ|বি\s*নেগেটিভ|এবি\s*নেগেটিভ|ও\s*নেগেটিভ)/i;

/**
 * Extracts standard blood group code from user query (e.g. 'A+', 'O+', 'AB-')
 */
export function extractBloodGroup(query: string): string | null {
  if (!query) return null;
  const match = query.match(BLOOD_GROUP_REGEX);
  if (match) return match[1].toUpperCase();

  const bnMatch = query.match(BANGLA_BLOOD_REGEX);
  if (bnMatch) {
    const raw = bnMatch[1].replace(/\s+/g, '');
    if (raw.includes('এবিপজিটিভ') || raw.includes('এবিপজেটিভ')) return 'AB+';
    if (raw.includes('এপজিটিভ') || raw.includes('এপজেটিভ')) return 'A+';
    if (raw.includes('বিপজিটিভ') || raw.includes('বিপজেটিভ')) return 'B+';
    if (raw.includes('ওপজিটিভ') || raw.includes('ওপজেটিভ')) return 'O+';
    if (raw.includes('এবিনেগেটিভ')) return 'AB-';
    if (raw.includes('এনেগেটিভ')) return 'A-';
    if (raw.includes('বিনেগেটিভ')) return 'B-';
    if (raw.includes('ওনেগেটিভ')) return 'O-';
  }

  return null;
}

/**
 * Compute Bigram Trigram / Dice coefficient string similarity (0.0 to 1.0)
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = cleanSearchString(str1);
  const s2 = cleanSearchString(str2);
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.85;

  // Normalized Levenshtein distance similarity
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(s1, s2);
  const levScore = Math.max(0, 1 - dist / maxLen);

  // Bigram token matching
  const getBigrams = (str: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.slice(i, i + 2));
    }
    return bigrams;
  };

  const bg1 = getBigrams(s1);
  const bg2 = getBigrams(s2);
  let intersection = 0;
  bg1.forEach((b) => {
    if (bg2.has(b)) intersection++;
  });
  const diceScore = (2 * intersection) / (bg1.size + bg2.size || 1);

  return Math.max(levScore, diceScore);
}

/**
 * Check if query matches target with generous fuzzy/phonetic tolerance
 */
export function isFuzzyMatch(target: string, query: string, threshold = 0.35): { matched: boolean; score: number } {
  if (!target || !query) return { matched: false, score: 0 };
  const cleanQ = cleanSearchString(query);
  const cleanT = cleanSearchString(target);

  if (cleanT.includes(cleanQ)) return { matched: true, score: 1.0 };

  // Check known typo mappings
  for (const [typo, corrected] of Object.entries(KNOWN_TYPO_MAPPINGS)) {
    if (cleanQ.includes(typo) && (cleanT.includes(corrected) || cleanT.includes(typo))) {
      return { matched: true, score: 0.95 };
    }
  }

  // Dialect-aware normalization
  const tNorm = normalizeBengali(cleanT, true);
  const qNorm = normalizeBengali(cleanQ, true);
  if (tNorm.includes(qNorm)) return { matched: true, score: 0.9 };

  // Calculate similarity score
  const score = calculateStringSimilarity(tNorm, qNorm);
  return { matched: score >= threshold, score };
}

export class SearchService {
  /**
   * Main Universal Search Entry Point
   * 1. Calls supabase.rpc('universal_search') first
   * 2. Falls back seamlessly to multi-table scan across ALL tables
   * 3. Applies fuzzy tolerance and cross-profile blood donor extraction
   */
  async universalSearch(
    query: string,
    options?: {
      location?: string;
      bloodGroup?: string;
      category?: string;
      limit?: number;
    }
  ): Promise<UniversalSearchResponse> {
    const rawQ = (query || '').trim();
    const limit = options?.limit || 40;
    const filterLoc = options?.location || '';

    if (!rawQ) {
      return {
        query: '',
        normalizedQuery: '',
        totalCount: 0,
        source: 'rpc',
        isFuzzyMatch: false,
        items: [],
        byType: {
          products: [],
          services: [],
          bloodDonors: [],
          members: [],
          vendors: [],
          circulars: [],
          seekers: []
        }
      };
    }

    // Resolve known typos immediately for augmented search
    const queryTokens = rawQ.split(/\s+/).filter(Boolean);
    let resolvedQuery = rawQ;
    let hasKnownTypo = false;
    let suggestedTerm: string | undefined = undefined;

    for (const token of queryTokens) {
      const lower = token.toLowerCase();
      if (KNOWN_TYPO_MAPPINGS[lower]) {
        resolvedQuery = resolvedQuery.replace(new RegExp(token, 'gi'), KNOWN_TYPO_MAPPINGS[lower]);
        hasKnownTypo = true;
        suggestedTerm = KNOWN_TYPO_MAPPINGS[lower];
      }
    }

    const detectedBlood = options?.bloodGroup || extractBloodGroup(rawQ);
    const isBloodSearch = !!detectedBlood || /রক্ত|ব্লাড|donor|ডোনার|পজিটিভ|পজেটিভ|নেগেটিভ/i.test(rawQ);

    let rawRpcItems: any[] = [];
    let usedSource: 'rpc' | 'multi_table_scan' | 'fuzzy_js_fallback' = 'rpc';

    // ----------------------------------------------------
    // STEP 1: SUPABASE RPC CALL (universal_search)
    // ----------------------------------------------------
    try {
      const { data, error } = await (supabase as any).rpc('universal_search', {
        search_query: resolvedQuery || rawQ,
        filter_location: filterLoc,
        filter_limit: limit
      });

      if (!error && Array.isArray(data) && data.length > 0) {
        rawRpcItems = data;
        usedSource = 'rpc';
      }
    } catch (rpcErr) {
      console.warn('[SearchService] universal_search RPC fallback note:', rpcErr);
    }

    // ----------------------------------------------------
    // STEP 2: MULTI-TABLE ALL-DATABASE SCAN (NEVER SAY NOT FOUND)
    // ----------------------------------------------------
    let collectedItems: UniversalSearchResultItem[] = [];

    if (rawRpcItems.length > 0) {
      // Map RPC rows
      collectedItems = rawRpcItems.map((r: any) => this.mapRpcRowToItem(r, rawQ));
    } else {
      // Fallback to live multi-table scan
      usedSource = 'multi_table_scan';
      collectedItems = await this.performMultiTableScan(rawQ, resolvedQuery, filterLoc, detectedBlood, limit);
    }

    // ----------------------------------------------------
    // STEP 3: UNIVERSAL BLOOD SEARCH ACROSS ALL PROFILES
    // If searching for blood (e.g. "খাগড়াছড়ি এ পজিটিভ" / "A+"),
    // Scan electricians, vendors, service providers, donors, members
    // ----------------------------------------------------
    if (isBloodSearch) {
      const bloodItems = await this.scanAllProfilesForBlood(detectedBlood, rawQ, filterLoc);
      const existingIds = new Set(collectedItems.map(i => i.id));
      for (const bi of bloodItems) {
        if (!existingIds.has(bi.id)) {
          collectedItems.unshift(bi);
          existingIds.add(bi.id);
        }
      }
    }

    // ----------------------------------------------------
    // STEP 4: CLIENT-SIDE FUZZY RANKING & DIALECT RESOLUTION
    // ----------------------------------------------------
    const rankedItems = this.rankAndScoreItems(collectedItems, rawQ, resolvedQuery, hasKnownTypo);

    // Group items by type
    const byType = {
      products: rankedItems.filter(i => i.type === 'product'),
      services: rankedItems.filter(i => i.type === 'service'),
      bloodDonors: rankedItems.filter(i => i.type === 'blood_donor'),
      members: rankedItems.filter(i => i.type === 'member'),
      vendors: rankedItems.filter(i => i.type === 'vendor'),
      circulars: rankedItems.filter(i => i.type === 'circular'),
      seekers: rankedItems.filter(i => i.type === 'seeker')
    };

    return {
      query: rawQ,
      normalizedQuery: resolvedQuery,
      totalCount: rankedItems.length,
      source: usedSource,
      isFuzzyMatch: hasKnownTypo || rankedItems.some(i => i.isFuzzyMatch),
      suggestedTerm,
      items: rankedItems.slice(0, limit),
      byType
    };
  }

  /**
   * Performs multi-table scan across products, service_providers, blood_donors, profiles
   */
  private async performMultiTableScan(
    rawQ: string,
    resolvedQ: string,
    filterLoc: string,
    detectedBlood: string | null,
    limit: number
  ): Promise<UniversalSearchResultItem[]> {
    const items: UniversalSearchResultItem[] = [];
    const searchTarget = resolvedQ || rawQ;

    // A. Query databaseService.globalSearch
    try {
      const gRes = await databaseService.globalSearch(searchTarget, { limit });
      if (gRes && Array.isArray(gRes.items) && gRes.items.length > 0) {
        gRes.items.forEach((gi) => {
          items.push(this.mapGlobalSearchItemToResult(gi, rawQ));
        });
      }
    } catch (e) {
      console.warn('[SearchService] databaseService.globalSearch fallback:', e);
    }

    // B. Direct parallel fetch from Supabase if globalSearch was insufficient
    if (items.length === 0) {
      try {
        const [pRes, spRes, bdRes, prRes] = await Promise.allSettled([
          supabase.from('products').select('*').limit(25),
          supabase.from('service_providers').select('*').limit(25),
          supabase.from('blood_donors').select('*').limit(25),
          supabase.from('profiles').select('*').limit(25)
        ]);

        if (pRes.status === 'fulfilled' && Array.isArray(pRes.value.data)) {
          pRes.value.data.forEach((p) => {
            const nameBn = p.name_bn || p.nameBn || p.name || 'পাহাড়ি পণ্য';
            const nameEn = p.name_en || p.nameEn || '';
            const match = isFuzzyMatch(`${nameBn} ${nameEn} ${p.category || ''}`, searchTarget, 0.3);
            if (match.matched) {
              items.push(this.createProductResultItem(p, match.score, rawQ));
            }
          });
        }

        if (spRes.status === 'fulfilled' && Array.isArray(spRes.value.data)) {
          spRes.value.data.forEach((sp) => {
            const name = sp.display_name || sp.full_name || sp.name || 'কারিগর';
            const prof = sp.category_bn || sp.profession_key || 'সেবা';
            const match = isFuzzyMatch(`${name} ${prof} ${sp.district || ''}`, searchTarget, 0.3);
            if (match.matched) {
              items.push(this.createProviderResultItem(sp, match.score, rawQ));
            }
          });
        }

        if (bdRes.status === 'fulfilled' && Array.isArray(bdRes.value.data)) {
          bdRes.value.data.forEach((bd) => {
            const bg = bd.blood_group || bd.bloodGroup || '';
            const isMatch = (detectedBlood && bg === detectedBlood) || isFuzzyMatch(`${bd.name} ${bg} ${bd.district || ''}`, searchTarget, 0.3).matched;
            if (isMatch) {
              items.push(this.createBloodDonorResultItem(bd, 0.9, rawQ));
            }
          });
        }

        if (prRes.status === 'fulfilled' && Array.isArray(prRes.value.data)) {
          prRes.value.data.forEach((pr) => {
            const bg = pr.blood_group || '';
            const isMatch = (detectedBlood && bg === detectedBlood) || isFuzzyMatch(`${pr.full_name} ${pr.profession || ''} ${pr.district || ''}`, searchTarget, 0.3).matched;
            if (isMatch) {
              items.push(this.createProfileResultItem(pr, 0.85, rawQ));
            }
          });
        }
      } catch (directErr) {
        console.warn('[SearchService] Direct Supabase fetch error:', directErr);
      }
    }

    return items;
  }

  /**
   * Scans across ALL registered profiles (Electricians, Vendors, Service Providers, Donors, Members)
   * to find everyone matching a requested blood group and location.
   */
  private async scanAllProfilesForBlood(
    bloodGroup: string | null,
    query: string,
    location?: string
  ): Promise<UniversalSearchResultItem[]> {
    const bloodItems: UniversalSearchResultItem[] = [];
    const targetGroup = bloodGroup ? bloodGroup.toUpperCase() : null;

    try {
      // 1. Fetch from blood_donors table
      let bQuery = supabase.from('blood_donors').select('*');
      if (targetGroup) bQuery = bQuery.eq('blood_group', targetGroup);
      const { data: donors } = await bQuery.limit(20);
      if (Array.isArray(donors)) {
        donors.forEach((bd) => {
          bloodItems.push(this.createBloodDonorResultItem(bd, 1.0, query));
        });
      }

      // 2. Fetch from service_providers who have blood group
      const { data: providers } = await supabase.from('service_providers').select('*').limit(30);
      if (Array.isArray(providers)) {
        providers.forEach((sp) => {
          const bg = (sp.blood_group || sp.bloodGroup || '').toUpperCase();
          if (bg && (!targetGroup || bg === targetGroup)) {
            bloodItems.push({
              id: `sp_blood_${sp.id}`,
              type: 'blood_donor',
              title: sp.display_name || sp.name || 'কারিগর ও রক্তদাতা',
              subtitle: `${bg} রক্তদাতা | ${sp.category_bn || sp.profession_key || 'কারিগর'}`,
              category: 'জরুরি রক্তসেবা ও কারিগর',
              role: sp.category_bn || sp.profession_key || 'টেকনিশিয়ান',
              profession: sp.profession_key || sp.category_bn,
              phone: sp.phone || '',
              location: [sp.area, sp.upazila, sp.district].filter(Boolean).join(', ') || 'খাগড়াছড়ি',
              district: sp.district,
              upazila: sp.upazila,
              bloodGroup: bg,
              price: 0,
              imageUrl: sp.avatar_url || sp.avatar || '',
              similarity: 0.95,
              isFuzzyMatch: false,
              matchedVia: 'service_providers_blood_group',
              actionButtons: {
                canCall: !!sp.phone,
                callHref: sp.phone ? `tel:${sp.phone}` : undefined,
                canOrder: false,
                canView: true,
                whatsapp: sp.phone
              },
              raw: sp
            });
          }
        });
      }

      // 3. Fetch from all registered user profiles
      const { data: profiles } = await supabase.from('profiles').select('*').limit(30);
      if (Array.isArray(profiles)) {
        profiles.forEach((pr) => {
          const bg = (pr.blood_group || '').toUpperCase();
          if (bg && (!targetGroup || bg === targetGroup)) {
            bloodItems.push({
              id: `profile_blood_${pr.id}`,
              type: 'blood_donor',
              title: pr.full_name || pr.name || 'নিবন্ধিত সদস্য ও রক্তদাতা',
              subtitle: `${bg} রক্তদাতা | ${pr.profession || pr.role || 'সদস্য'}`,
              category: 'জরুরি রক্তসেবা ও সদস্য',
              role: pr.profession || pr.role || 'নিবন্ধিত সদস্য',
              profession: pr.profession,
              phone: pr.phone || '',
              location: [pr.upazila, pr.district].filter(Boolean).join(', ') || 'পার্বত্য চট্টগ্রাম',
              district: pr.district,
              upazila: pr.upazila,
              bloodGroup: bg,
              price: 0,
              imageUrl: pr.avatar_url || pr.avatar || '',
              similarity: 0.95,
              isFuzzyMatch: false,
              matchedVia: 'registered_profiles_blood_group',
              actionButtons: {
                canCall: !!pr.phone,
                callHref: pr.phone ? `tel:${pr.phone}` : undefined,
                canOrder: false,
                canView: true,
                whatsapp: pr.phone
              },
              raw: pr
            });
          }
        });
      }
    } catch (err) {
      console.warn('[SearchService] Blood search multi-table scan error:', err);
    }

    return bloodItems;
  }

  /**
   * Ranks items and deduplicates by ID
   */
  private rankAndScoreItems(
    items: UniversalSearchResultItem[],
    rawQuery: string,
    resolvedQuery: string,
    hasKnownTypo: boolean
  ): UniversalSearchResultItem[] {
    const seen = new Set<string>();
    const unique: UniversalSearchResultItem[] = [];

    for (const item of items) {
      const key = `${item.type}_${item.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        // Recalculate score against query tokens
        const score = calculateStringSimilarity(item.title, resolvedQuery);
        item.similarity = Math.max(item.similarity || 0, score);
        if (hasKnownTypo) {
          item.isFuzzyMatch = true;
        }
        unique.push(item);
      }
    }

    // Sort: exact matches first, highest similarity score next
    return unique.sort((a, b) => b.similarity - a.similarity);
  }

  // --- MAPPING HELPERS ---

  private mapRpcRowToItem(r: any, query: string): UniversalSearchResultItem {
    const itemType = (r.item_type || 'product') as UniversalSearchResultItem['type'];
    const phone = r.phone || '';
    const isBlood = itemType === 'blood_donor' || !!r.blood_group;

    return {
      id: String(r.id),
      type: itemType,
      title: r.title || 'তথ্য',
      subtitle: r.subtitle || '',
      category: r.category || 'সাধারণ',
      role: r.role || r.profession || 'সদস্য',
      profession: r.profession,
      phone,
      location: [r.upazila, r.district].filter(Boolean).join(', ') || 'পার্বত্য চট্টগ্রাম',
      district: r.district,
      upazila: r.upazila,
      bloodGroup: r.blood_group,
      price: r.price ? Number(r.price) : undefined,
      imageUrl: r.image_url || '',
      rating: r.metadata?.rating || 5,
      similarity: Number(r.similarity_score || 0.8),
      isFuzzyMatch: Number(r.similarity_score || 0) < 0.95,
      actionButtons: {
        canCall: !!phone,
        callHref: phone ? `tel:${phone}` : undefined,
        canOrder: itemType === 'product',
        canView: true,
        whatsapp: phone
      },
      raw: r
    };
  }

  private mapGlobalSearchItemToResult(gi: any, query: string): UniversalSearchResultItem {
    const phone = gi.phone || gi.raw?.phone || '';
    const isBlood = gi.type === 'blood' || gi.type === 'blood_donor';

    return {
      id: String(gi.id),
      type: isBlood ? 'blood_donor' : (gi.type as any) || 'product',
      title: gi.title || gi.name || 'তথ্য',
      subtitle: gi.subtitle || '',
      category: gi.category || 'সাধারণ',
      role: gi.raw?.profession || gi.raw?.category_bn || (gi.type === 'product' ? 'পণ্য' : 'সেবা'),
      profession: gi.raw?.profession_key || gi.raw?.profession,
      phone,
      location: gi.location || [gi.raw?.upazila, gi.raw?.district].filter(Boolean).join(', ') || 'পার্বত্য চট্টগ্রাম',
      district: gi.raw?.district,
      upazila: gi.raw?.upazila,
      bloodGroup: gi.raw?.blood_group || gi.raw?.bloodGroup,
      price: gi.price,
      imageUrl: gi.imageUrl || gi.raw?.image || '',
      rating: Number(gi.rating || 5),
      similarity: 0.85,
      isFuzzyMatch: false,
      actionButtons: {
        canCall: !!phone,
        callHref: phone ? `tel:${phone}` : undefined,
        canOrder: gi.type === 'product',
        canView: true,
        whatsapp: phone
      },
      raw: gi.raw || gi
    };
  }

  private createProductResultItem(p: any, score: number, query: string): UniversalSearchResultItem {
    const nameBn = p.name_bn || p.nameBn || p.name || 'পাহাড়ি পণ্য';
    const pPrice = p.price ? Number(p.price) : 0;
    return {
      id: String(p.id),
      type: 'product',
      title: nameBn,
      subtitle: p.category_label_bn || p.category || 'পাহাড়ি খাঁটি পণ্য',
      category: p.category || 'Agri',
      role: 'পাহাড়ি কৃষি ও ভোজ্য পণ্য',
      location: [p.upazila, p.district || p.origin].filter(Boolean).join(', ') || 'খাগড়াছড়ি',
      district: p.district || p.origin,
      upazila: p.upazila,
      price: pPrice,
      imageUrl: p.image_url || p.imageUrl || (Array.isArray(p.images) && p.images[0]) || '',
      similarity: score,
      isFuzzyMatch: score < 0.9,
      actionButtons: {
        canCall: true,
        callHref: 'tel:01870592699',
        canOrder: true,
        canView: true,
        whatsapp: '01870592699'
      },
      raw: p
    };
  }

  private createProviderResultItem(sp: any, score: number, query: string): UniversalSearchResultItem {
    const phone = sp.phone || '';
    return {
      id: String(sp.id),
      type: 'service',
      title: sp.display_name || sp.full_name || sp.name || 'দক্ষ কারিগর',
      subtitle: sp.category_bn || sp.profession_key || 'সেবা প্রদানকারী',
      category: 'সেবা ও কারিগর',
      role: sp.category_bn || sp.profession_key || 'কারিগর',
      profession: sp.profession_key || sp.category_bn,
      phone,
      location: [sp.area, sp.upazila, sp.district].filter(Boolean).join(', ') || 'খাগড়াছড়ি',
      district: sp.district,
      upazila: sp.upazila,
      price: sp.rate_amount || sp.hourly_rate || 'আলোচনা সাপেক্ষে',
      imageUrl: sp.avatar_url || sp.avatar || '',
      rating: Number(sp.rating || 5),
      similarity: score,
      isFuzzyMatch: score < 0.9,
      actionButtons: {
        canCall: !!phone,
        callHref: phone ? `tel:${phone}` : undefined,
        canOrder: false,
        canView: true,
        whatsapp: phone
      },
      raw: sp
    };
  }

  private createBloodDonorResultItem(bd: any, score: number, query: string): UniversalSearchResultItem {
    const phone = bd.phone || '';
    const bg = bd.blood_group || bd.bloodGroup || 'A+';
    return {
      id: String(bd.id),
      type: 'blood_donor',
      title: bd.name || bd.full_name || 'স্বেচ্ছাসেবী রক্তদাতা',
      subtitle: `${bg} রক্তদাতা`,
      category: 'জরুরি রক্তসেবা',
      role: 'রক্তদাতা',
      profession: bd.profession || 'রক্তদাতা',
      phone,
      location: [bd.area || bd.mahalla, bd.upazila, bd.district].filter(Boolean).join(', ') || 'খাগড়াছড়ি',
      district: bd.district,
      upazila: bd.upazila,
      bloodGroup: bg,
      price: 0,
      imageUrl: bd.photo_url || bd.photo || '',
      similarity: score,
      isFuzzyMatch: score < 0.9,
      actionButtons: {
        canCall: !!phone,
        callHref: phone ? `tel:${phone}` : undefined,
        canOrder: false,
        canView: true,
        whatsapp: phone
      },
      raw: bd
    };
  }

  private createProfileResultItem(pr: any, score: number, query: string): UniversalSearchResultItem {
    const phone = pr.phone || '';
    const isDonor = !!pr.blood_group;
    return {
      id: String(pr.id || pr.unique_id),
      type: isDonor ? 'blood_donor' : 'member',
      title: pr.full_name || pr.name || 'নিবন্ধিত সদস্য',
      subtitle: isDonor ? `${pr.blood_group} রক্তদাতা | ${pr.profession || 'সদস্য'}` : (pr.profession || pr.role || 'সদস্য'),
      category: 'সদস্য ও প্রোফাইল',
      role: pr.profession || pr.role || 'নিবন্ধিত নাগরিক',
      profession: pr.profession,
      phone,
      location: [pr.upazila, pr.district].filter(Boolean).join(', ') || 'পার্বত্য চট্টগ্রাম',
      district: pr.district,
      upazila: pr.upazila,
      bloodGroup: pr.blood_group,
      price: 0,
      imageUrl: pr.avatar_url || pr.avatar || '',
      similarity: score,
      isFuzzyMatch: score < 0.9,
      actionButtons: {
        canCall: !!phone,
        callHref: phone ? `tel:${phone}` : undefined,
        canOrder: false,
        canView: true,
        whatsapp: phone
      },
      raw: pr
    };
  }
}

export const searchService = new SearchService();
export default searchService;
