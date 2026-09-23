-- =========================================================================
-- JHADIMADI.COM - MIGRATION 032: BANNERS TABLE SCHEMA & STORAGE BUCKET
-- =========================================================================

-- 1. Ensure banners table exists with exact required columns
CREATE TABLE IF NOT EXISTS public.banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT DEFAULT '',
  subtitle TEXT DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  badge TEXT DEFAULT 'স্পেশাল অফার',
  tag TEXT DEFAULT 'স্পেশাল অফার',
  placement TEXT DEFAULT 'হোমপেজ হিরো স্লাইডার',
  target_link TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 1,
  display_order INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add columns if table already existed without them
ALTER TABLE IF EXISTS public.banners
  ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS subtitle TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS badge TEXT DEFAULT 'স্পেশাল অফার',
  ADD COLUMN IF NOT EXISTS tag TEXT DEFAULT 'স্পেশাল অফার',
  ADD COLUMN IF NOT EXISTS placement TEXT DEFAULT 'হোমপেজ হিরো স্লাইডার',
  ADD COLUMN IF NOT EXISTS target_link TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Enable RLS and grant public access
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read banners" ON public.banners;
CREATE POLICY "Public read banners" ON public.banners FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow write to banners" ON public.banners;
CREATE POLICY "Allow write to banners" ON public.banners FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.banners TO anon, authenticated, service_role;

-- 4. Ensure Supabase Storage Bucket 'banners' exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'banners',
  'banners',
  true,
  15728640,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 5. Storage Policies for 'banners' bucket
DROP POLICY IF EXISTS "Public banners bucket read" ON storage.objects;
CREATE POLICY "Public banners bucket read" ON storage.objects FOR SELECT
  USING (bucket_id = 'banners');

DROP POLICY IF EXISTS "Public banners bucket insert" ON storage.objects;
CREATE POLICY "Public banners bucket insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'banners');

DROP POLICY IF EXISTS "Public banners bucket update" ON storage.objects;
CREATE POLICY "Public banners bucket update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'banners');

DROP POLICY IF EXISTS "Public banners bucket delete" ON storage.objects;
CREATE POLICY "Public banners bucket delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'banners');
