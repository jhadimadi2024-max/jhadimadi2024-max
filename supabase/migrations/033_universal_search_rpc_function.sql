-- Migration 033: Universal Fuzzy Search & All-Table Scanning RPC Function
-- Supports phonetic matching, typo tolerance, multi-table union (products, service_providers, blood_donors, profiles, job_circulars, job_seekers)
-- Enables supabase.rpc('universal_search', { search_query: query })

CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Helper function to normalize Bengali search strings in PostgreSQL
CREATE OR REPLACE FUNCTION public.normalize_bengali_search(input_text TEXT)
RETURNS TEXT AS $$
DECLARE
  cleaned TEXT;
BEGIN
  IF input_text IS NULL THEN
    RETURN '';
  END IF;

  cleaned := lower(trim(input_text));
  -- Strip invisible formatting characters
  cleaned := regexp_replace(cleaned, '[\u200B-\u200D\uFEFF]', '', 'g');
  
  -- Handle specific typo mappings requested
  cleaned := regexp_replace(cleaned, '\m(খেদল|মেদল|গোলাল|সেদল|সেদোল|হিদল|হিদোল|সীদল|সিডল)\M', 'সিদল', 'gi');
  cleaned := regexp_replace(cleaned, '\m(খুরিযু|খরিচ|মরিষ|মোরিস)\M', 'মরিচ', 'gi');
  cleaned := regexp_replace(cleaned, '\m(সুটকি|চুটকি|চুটাক|শুটাক|হুটকি)\M', 'শুটকি', 'gi');
  cleaned := regexp_replace(cleaned, '\m(মদু)\M', 'মধু', 'gi');

  -- Orthographic diacritic normalizations
  cleaned := replace(cleaned, 'ী', 'ি');
  cleaned := replace(cleaned, 'ঈ', 'ই');
  cleaned := replace(cleaned, 'ূ', 'ু');
  cleaned := replace(cleaned, 'ঊ', 'উ');
  cleaned := replace(cleaned, 'ণ', 'ন');
  cleaned := replace(cleaned, 'ড়', 'র');
  cleaned := replace(cleaned, 'ঢ়', 'র');
  cleaned := replace(cleaned, 'ৎ', 'ত');
  cleaned := regexp_replace(cleaned, '[শষ]', 'স', 'g');
  cleaned := regexp_replace(cleaned, '[ঁ়]', '', 'g');

  RETURN cleaned;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Drop function if already exists with old signature
DROP FUNCTION IF EXISTS public.universal_search(TEXT, TEXT, INT);
DROP FUNCTION IF EXISTS public.universal_search(TEXT);

CREATE OR REPLACE FUNCTION public.universal_search(
  search_query TEXT,
  filter_location TEXT DEFAULT '',
  filter_limit INT DEFAULT 40
)
RETURNS TABLE (
  id TEXT,
  item_type TEXT,
  title TEXT,
  subtitle TEXT,
  category TEXT,
  role TEXT,
  profession TEXT,
  phone TEXT,
  district TEXT,
  upazila TEXT,
  blood_group TEXT,
  price NUMERIC,
  image_url TEXT,
  similarity_score DOUBLE PRECISION,
  tags TEXT[],
  metadata JSONB
) AS $$
DECLARE
  clean_q TEXT;
  norm_q TEXT;
  is_blood_q BOOLEAN;
  detected_blood TEXT;
BEGIN
  clean_q := trim(search_query);
  IF clean_q = '' OR clean_q IS NULL THEN
    RETURN;
  END IF;

  norm_q := public.normalize_bengali_search(clean_q);

  -- Detect if query is looking for a blood group
  is_blood_q := clean_q ~* '(রক্ত|ব্লাড|donor|ডোনার|পজিটিভ|পজেটিভ|নেগেটিভ|[a|b|ab|o][+-])';
  
  -- Extract blood group if present
  IF clean_q ~* '\y(o\+|o positive|ও পজিটিভ|ও পজেটিভ)\y' THEN
    detected_blood := 'O+';
  ELSIF clean_q ~* '\y(a\+|a positive|এ পজিটিভ|এ পজেটিভ)\y' THEN
    detected_blood := 'A+';
  ELSIF clean_q ~* '\y(b\+|b positive|বি পজিটিভ|বি পজেটিভ)\y' THEN
    detected_blood := 'B+';
  ELSIF clean_q ~* '\y(ab\+|ab positive|এবি পজিটিভ|এবি পজেটিভ)\y' THEN
    detected_blood := 'AB+';
  ELSIF clean_q ~* '\y(o\-|o negative|ও নেগেটিভ)\y' THEN
    detected_blood := 'O-';
  ELSIF clean_q ~* '\y(a\-|a negative|এ নেগেটিভ)\y' THEN
    detected_blood := 'A-';
  ELSIF clean_q ~* '\y(b\-|b negative|বি নেগেটিভ)\y' THEN
    detected_blood := 'B-';
  ELSIF clean_q ~* '\y(ab\-|ab negative|এবি নেগেটিভ)\y' THEN
    detected_blood := 'AB-';
  ELSE
    detected_blood := '';
  END IF;

  RETURN QUERY
  WITH all_matches AS (
    -- 1. PRODUCTS
    SELECT
      p.id::text AS id,
      'product'::text AS item_type,
      COALESCE(p.name_bn, p.name_en, 'পাহাড়ি পণ্য') AS title,
      COALESCE(p.category, 'পাহাড়ি খাঁটি পণ্য') AS subtitle,
      COALESCE(p.category, 'Agri') AS category,
      'বিক্রেতা / মার্চেন্ট'::text AS role,
      'পণ্য'::text AS profession,
      ''::text AS phone,
      COALESCE(p.origin, 'খাগড়াছড়ি') AS district,
      ''::text AS upazila,
      ''::text AS blood_group,
      COALESCE(p.price, 0)::numeric AS price,
      COALESCE(p.image_url, '') AS image_url,
      GREATEST(
        similarity(COALESCE(p.name_bn, ''), clean_q),
        similarity(COALESCE(p.name_en, ''), clean_q),
        similarity(public.normalize_bengali_search(COALESCE(p.name_bn, '')), norm_q),
        CASE 
          WHEN p.name_bn ILIKE '%' || clean_q || '%' OR p.name_en ILIKE '%' || clean_q || '%' THEN 1.0
          WHEN public.normalize_bengali_search(COALESCE(p.name_bn, '')) ILIKE '%' || norm_q || '%' THEN 0.95
          ELSE 0.0 
        END
      ) AS similarity_score,
      COALESCE(p.search_tags, '{}'::text[]) AS tags,
      jsonb_build_object(
        'table', 'products',
        'stock', p.stock,
        'unit', p.unit,
        'description', p.description_bn
      ) AS metadata
    FROM public.products p
    WHERE
      (p.name_bn ILIKE '%' || clean_q || '%' OR p.name_en ILIKE '%' || clean_q || '%' OR p.category ILIKE '%' || clean_q || '%' OR p.description_bn ILIKE '%' || clean_q || '%')
      OR public.normalize_bengali_search(COALESCE(p.name_bn, '')) ILIKE '%' || norm_q || '%'
      OR similarity(public.normalize_bengali_search(COALESCE(p.name_bn, '')), norm_q) > 0.15

    UNION ALL

    -- 2. SERVICE PROVIDERS (TECHNICIANS, ELECTRICIANS, PLUMBERS, ETC.)
    SELECT
      sp.id::text AS id,
      'service'::text AS item_type,
      COALESCE(sp.display_name, sp.full_name, 'দক্ষ কারিগর') AS title,
      COALESCE(sp.category_bn, sp.profession_key, 'সেবা প্রদানকারী') AS subtitle,
      'সেবা ও কারিগর'::text AS category,
      COALESCE(sp.category_bn, sp.profession_key, 'কারিগর') AS role,
      COALESCE(sp.profession_key, sp.category_bn, 'সেবা') AS profession,
      COALESCE(sp.phone, '') AS phone,
      COALESCE(sp.district, 'খাগড়াছড়ি') AS district,
      COALESCE(sp.upazila, '') AS upazila,
      ''::text AS blood_group,
      COALESCE(sp.rate_amount, 0)::numeric AS price,
      COALESCE(sp.avatar_url, '') AS image_url,
      GREATEST(
        similarity(COALESCE(sp.display_name, ''), clean_q),
        similarity(COALESCE(sp.category_bn, ''), clean_q),
        similarity(public.normalize_bengali_search(COALESCE(sp.display_name, '')), norm_q),
        CASE 
          WHEN sp.display_name ILIKE '%' || clean_q || '%' OR sp.category_bn ILIKE '%' || clean_q || '%' THEN 1.0
          WHEN public.normalize_bengali_search(COALESCE(sp.display_name, '')) ILIKE '%' || norm_q || '%' THEN 0.95
          ELSE 0.0 
        END
      ) AS similarity_score,
      COALESCE(sp.search_tags, '{}'::text[]) AS tags,
      jsonb_build_object(
        'table', 'service_providers',
        'rating', sp.rating,
        'completed_jobs', sp.completed_jobs,
        'hourly_rate', sp.hourly_rate
      ) AS metadata
    FROM public.service_providers sp
    WHERE
      (sp.display_name ILIKE '%' || clean_q || '%' OR sp.category_bn ILIKE '%' || clean_q || '%' OR sp.profession_key ILIKE '%' || clean_q || '%' OR sp.skills_details ILIKE '%' || clean_q || '%')
      OR public.normalize_bengali_search(COALESCE(sp.display_name, '')) ILIKE '%' || norm_q || '%'
      OR similarity(public.normalize_bengali_search(COALESCE(sp.display_name, '')), norm_q) > 0.15

    UNION ALL

    -- 3. BLOOD DONORS
    SELECT
      bd.id::text AS id,
      'blood_donor'::text AS item_type,
      COALESCE(bd.name, bd.full_name, 'স্বেচ্ছাসেবী রক্তদাতা') AS title,
      COALESCE(bd.blood_group, 'রক্তদাতা') || ' রক্তদাতা' AS subtitle,
      'জরুরি রক্তসেবা'::text AS category,
      'রক্তদাতা'::text AS role,
      COALESCE(bd.profession, 'রক্তদাতা') AS profession,
      COALESCE(bd.phone, '') AS phone,
      COALESCE(bd.district, 'খাগড়াছড়ি') AS district,
      COALESCE(bd.upazila, '') AS upazila,
      COALESCE(bd.blood_group, '') AS blood_group,
      0::numeric AS price,
      ''::text AS image_url,
      CASE
        WHEN detected_blood <> '' AND bd.blood_group = detected_blood THEN 1.0
        WHEN clean_q ~* bd.blood_group THEN 0.95
        WHEN bd.name ILIKE '%' || clean_q || '%' THEN 0.9
        WHEN bd.district ILIKE '%' || clean_q || '%' THEN 0.85
        ELSE 0.5
      END AS similarity_score,
      COALESCE(bd.search_tags, '{}'::text[]) AS tags,
      jsonb_build_object(
        'table', 'blood_donors',
        'total_donations', bd.total_donations,
        'is_available', bd.is_available,
        'last_donation_date', bd.last_donation_date
      ) AS metadata
    FROM public.blood_donors bd
    WHERE
      (is_blood_q AND (detected_blood = '' OR bd.blood_group = detected_blood))
      OR bd.name ILIKE '%' || clean_q || '%'
      OR bd.blood_group ILIKE '%' || clean_q || '%'
      OR bd.district ILIKE '%' || clean_q || '%'
      OR bd.upazila ILIKE '%' || clean_q || '%'

    UNION ALL

    -- 4. REGISTERED MEMBERS & ALL PROFILES (ELECTRICIANS, VENDORS, DONORS, CITIZENS)
    -- This guarantees that when searching for blood group + location, ALL registered profiles are checked!
    SELECT
      pr.id::text AS id,
      CASE
        WHEN pr.role = 'vendor' OR pr.role = 'seller' THEN 'vendor'
        WHEN is_blood_q AND pr.blood_group IS NOT NULL AND pr.blood_group <> '' THEN 'blood_donor'
        ELSE 'member'
      END AS item_type,
      COALESCE(pr.full_name, 'সদস্য') AS title,
      COALESCE(pr.profession, pr.role, 'নিবন্ধিত সদস্য') AS subtitle,
      'সদস্য ও প্রোফাইল'::text AS category,
      COALESCE(pr.role, 'সদস্য') AS role,
      COALESCE(pr.profession, 'পেশাজীবী') AS profession,
      COALESCE(pr.phone, '') AS phone,
      COALESCE(pr.district, 'খাগড়াছড়ি') AS district,
      COALESCE(pr.upazila, '') AS upazila,
      COALESCE(pr.blood_group, '') AS blood_group,
      0::numeric AS price,
      COALESCE(pr.avatar_url, '') AS image_url,
      CASE
        WHEN is_blood_q AND detected_blood <> '' AND pr.blood_group = detected_blood THEN 0.95
        WHEN pr.full_name ILIKE '%' || clean_q || '%' THEN 0.9
        WHEN pr.profession ILIKE '%' || clean_q || '%' THEN 0.85
        ELSE 0.5
      END AS similarity_score,
      '{}'::text[] AS tags,
      jsonb_build_object(
        'table', 'profiles',
        'unique_id', pr.unique_id,
        'role', pr.role,
        'blood_group', pr.blood_group
      ) AS metadata
    FROM public.profiles pr
    WHERE
      (is_blood_q AND (detected_blood = '' OR pr.blood_group = detected_blood) AND (filter_location = '' OR pr.district ILIKE '%' || filter_location || '%' OR pr.upazila ILIKE '%' || filter_location || '%'))
      OR pr.full_name ILIKE '%' || clean_q || '%'
      OR pr.profession ILIKE '%' || clean_q || '%'
      OR pr.unique_id ILIKE '%' || clean_q || '%'
      OR pr.district ILIKE '%' || clean_q || '%'

    UNION ALL

    -- 5. JOB CIRCULARS & VACANCIES
    SELECT
      jc.id::text AS id,
      'circular'::text AS item_type,
      COALESCE(jc.title, 'চাকরির নিয়োগ বিজ্ঞপ্তি') AS title,
      COALESCE(jc.company_name, 'নিয়োগকারী প্রতিষ্ঠান') AS subtitle,
      COALESCE(jc.category, 'চাকরি') AS category,
      'নিয়োগকর্তা'::text AS role,
      'চাকরি'::text AS profession,
      COALESCE(jc.contact_phone, '') AS phone,
      COALESCE(jc.district, 'বাংলাদেশ') AS district,
      COALESCE(jc.upazila, '') AS upazila,
      ''::text AS blood_group,
      0::numeric AS price,
      ''::text AS image_url,
      GREATEST(
        similarity(COALESCE(jc.title, ''), clean_q),
        CASE WHEN jc.title ILIKE '%' || clean_q || '%' THEN 1.0 ELSE 0.5 END
      ) AS similarity_score,
      COALESCE(jc.skills, '{}'::text[]) AS tags,
      jsonb_build_object(
        'table', 'job_circulars',
        'salary', jc.salary,
        'job_type', jc.job_type
      ) AS metadata
    FROM public.job_circulars jc
    WHERE
      jc.title ILIKE '%' || clean_q || '%'
      OR jc.company_name ILIKE '%' || clean_q || '%'
      OR jc.category ILIKE '%' || clean_q || '%'

    UNION ALL

    -- 6. JOB SEEKERS (CANDIDATES & RESUMES)
    SELECT
      js.id::text AS id,
      'seeker'::text AS item_type,
      COALESCE(js.name, 'চাকরিপ্রার্থী') AS title,
      COALESCE(js.desired_job_title, js.skills_or_job_type, 'প্রার্থী') AS subtitle,
      'চাকরিপ্রার্থী ও সিভি'::text AS category,
      'চাকরিপ্রার্থী'::text AS role,
      COALESCE(js.desired_job_title, 'প্রার্থী') AS profession,
      COALESCE(js.phone, '') AS phone,
      COALESCE(js.district, 'বাংলাদেশ') AS district,
      COALESCE(js.upazila, '') AS upazila,
      ''::text AS blood_group,
      0::numeric AS price,
      ''::text AS image_url,
      GREATEST(
        similarity(COALESCE(js.name, ''), clean_q),
        CASE WHEN js.name ILIKE '%' || clean_q || '%' THEN 1.0 ELSE 0.5 END
      ) AS similarity_score,
      COALESCE(js.skills, '{}'::text[]) AS tags,
      jsonb_build_object(
        'table', 'job_seekers',
        'skills', js.skills_or_job_type,
        'desired_job_title', js.desired_job_title
      ) AS metadata
    FROM public.job_seekers js
    WHERE
      js.name ILIKE '%' || clean_q || '%'
      OR js.skills_or_job_type ILIKE '%' || clean_q || '%'
      OR js.desired_job_title ILIKE '%' || clean_q || '%'
  )
  SELECT DISTINCT ON (m.id, m.item_type)
    m.id,
    m.item_type,
    m.title,
    m.subtitle,
    m.category,
    m.role,
    m.profession,
    m.phone,
    m.district,
    m.upazila,
    m.blood_group,
    m.price,
    m.image_url,
    m.similarity_score,
    m.tags,
    m.metadata
  FROM all_matches m
  WHERE
    filter_location = ''
    OR m.district ILIKE '%' || filter_location || '%'
    OR m.upazila ILIKE '%' || filter_location || '%'
  ORDER BY m.id, m.item_type, m.similarity_score DESC
  LIMIT filter_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execution to public and anon users
GRANT EXECUTE ON FUNCTION public.universal_search(TEXT, TEXT, INT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.normalize_bengali_search(TEXT) TO anon, authenticated, service_role;
