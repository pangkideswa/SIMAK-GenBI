-- ==========================================================
-- SIMAK GENBI Database Schema (Supabase / PostgreSQL)
-- Sistem Informasi Manajemen & Keaktifan GenBI
-- Komisariat Universitas Majalengka (UNMA)
-- FULL IDEMPOTENT SETUP SCRIPT (Bisa dijalankan berulang kali tanpa error)
-- ==========================================================

-- 1. EKSTENSI CRYPTO
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABEL PROFILES (Daftar Pengguna Aktif)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  npm TEXT UNIQUE,
  nim TEXT UNIQUE,
  email TEXT UNIQUE,
  full_name TEXT NOT NULL,
  division TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  phone TEXT,
  study_program TEXT,
  avatar_url TEXT,
  bio TEXT,
  is_activated BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pastikan seluruh kolom profiles tersedia jika tabel sebelumnya dibuat dengan skema lama
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS npm TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nim TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS study_program TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_activated BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';

-- Sinkronkan nilai npm dan nim
UPDATE public.profiles SET npm = COALESCE(npm, nim);
UPDATE public.profiles SET nim = COALESCE(nim, npm);

-- Perbarui Check Constraint Divisi & Role pada tabel profiles (Hapus versi lama jika berbeda)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_division_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

UPDATE public.profiles SET division = 'Publikasi dan Sosialisasi' WHERE division IN ('Kominfo', 'Publikasi & Sosialisasi');
UPDATE public.profiles SET division = 'Pengabdian Masyarakat' WHERE division IN ('Sosial Masyarakat', 'Pengmas');

ALTER TABLE public.profiles ADD CONSTRAINT profiles_division_check CHECK (
  division IN (
    'Publikasi dan Sosialisasi',
    'Kominfo',
    'Lingkungan Hidup',
    'Pendidikan',
    'Pengabdian Masyarakat',
    'Sosial Masyarakat',
    'Kewirausahaan',
    'BPH'
  )
);

ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (
  role IN ('admin', 'kadiv', 'member')
);

CREATE INDEX IF NOT EXISTS idx_profiles_npm ON public.profiles(npm);
CREATE INDEX IF NOT EXISTS idx_profiles_nim ON public.profiles(nim);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_division ON public.profiles(division);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 3. TABEL AUTHORIZED_MEMBERS (Whitelist Anggota SK Resmi dari Admin)
CREATE TABLE IF NOT EXISTS public.authorized_members (
  npm TEXT PRIMARY KEY,
  nim TEXT,
  full_name TEXT NOT NULL,
  division TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  is_claimed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pastikan kolom authorized_members tersedia
ALTER TABLE public.authorized_members ADD COLUMN IF NOT EXISTS npm TEXT;
ALTER TABLE public.authorized_members ADD COLUMN IF NOT EXISTS nim TEXT;
ALTER TABLE public.authorized_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';
ALTER TABLE public.authorized_members ADD COLUMN IF NOT EXISTS is_claimed BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.authorized_members SET npm = COALESCE(npm, nim);
UPDATE public.authorized_members SET nim = COALESCE(nim, npm);

-- Perbarui Check Constraint Divisi & Role pada authorized_members
ALTER TABLE public.authorized_members DROP CONSTRAINT IF EXISTS authorized_members_division_check;
ALTER TABLE public.authorized_members DROP CONSTRAINT IF EXISTS authorized_members_role_check;

UPDATE public.authorized_members SET division = 'Publikasi dan Sosialisasi' WHERE division IN ('Kominfo', 'Publikasi & Sosialisasi');
UPDATE public.authorized_members SET division = 'Pengabdian Masyarakat' WHERE division IN ('Sosial Masyarakat', 'Pengmas');

ALTER TABLE public.authorized_members ADD CONSTRAINT authorized_members_division_check CHECK (
  division IN (
    'Publikasi dan Sosialisasi',
    'Kominfo',
    'Lingkungan Hidup',
    'Pendidikan',
    'Pengabdian Masyarakat',
    'Sosial Masyarakat',
    'Kewirausahaan',
    'BPH'
  )
);

ALTER TABLE public.authorized_members ADD CONSTRAINT authorized_members_role_check CHECK (
  role IN ('admin', 'kadiv', 'member')
);

-- 4. TABEL EVENTS
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  points INTEGER NOT NULL DEFAULT 10,
  qr_token TEXT UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  require_location BOOLEAN NOT NULL DEFAULT FALSE,
  target_lat DOUBLE PRECISION DEFAULT -6.8362,
  target_lng DOUBLE PRECISION DEFAULT 108.2275,
  radius_meters INTEGER NOT NULL DEFAULT 250,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pastikan kolom events tersedia
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS require_location BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS target_lat DOUBLE PRECISION DEFAULT -6.8362;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS target_lng DOUBLE PRECISION DEFAULT 108.2275;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS radius_meters INTEGER NOT NULL DEFAULT 250;

-- 5. TABEL ATTENDANCES
CREATE TABLE IF NOT EXISTS public.attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  proof_url TEXT,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  rejection_reason TEXT,
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_event_user UNIQUE (event_id, user_id)
);

-- Pastikan kolom attendances tersedia
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS user_lat DOUBLE PRECISION;
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS user_lng DOUBLE PRECISION;
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS proof_url TEXT;

CREATE INDEX IF NOT EXISTS idx_attendances_user_id ON public.attendances(user_id);
CREATE INDEX IF NOT EXISTS idx_attendances_event_id ON public.attendances(event_id);
CREATE INDEX IF NOT EXISTS idx_events_is_active ON public.events(is_active);

-- 6. VIEW MEMBER EVALUATIONS (Leaderboard & Evaluasi Otomatis)
DROP VIEW IF EXISTS public.member_evaluations CASCADE;
CREATE VIEW public.member_evaluations AS
WITH event_counts AS (
  SELECT COUNT(*)::NUMERIC AS total_active_events
  FROM public.events
  WHERE is_active = TRUE
),
user_stats AS (
  SELECT
    p.id AS user_id,
    COALESCE(p.npm, p.nim, '-') AS npm,
    COALESCE(p.nim, p.npm, '-') AS nim,
    p.email,
    p.full_name,
    p.division,
    p.role,
    p.avatar_url,
    COALESCE(SUM(CASE 
      WHEN a.status = 'hadir' AND a.verified = TRUE THEN e.points 
      WHEN a.status = 'delegasi' AND a.verified = TRUE THEN 30 
      ELSE 0 
    END), 0)::INTEGER AS total_points,
    COUNT(CASE WHEN a.status IN ('hadir', 'delegasi') AND a.verified = TRUE THEN 1 END) AS total_hadir,
    COUNT(CASE WHEN a.status = 'izin' AND a.verified = TRUE THEN 1 END) AS total_izin,
    COUNT(CASE WHEN a.status = 'alfa' THEN 1 END) AS total_alfa,
    COUNT(a.id) AS total_recorded
  FROM public.profiles p
  LEFT JOIN public.attendances a ON p.id = a.user_id
  LEFT JOIN public.events e ON a.event_id = e.id
  GROUP BY p.id, p.npm, p.nim, p.email, p.full_name, p.division, p.role, p.avatar_url
)
SELECT
  s.user_id,
  s.npm,
  s.nim,
  s.email,
  s.full_name,
  s.division,
  s.role,
  s.avatar_url,
  s.total_points,
  s.total_hadir,
  s.total_izin,
  s.total_alfa,
  CASE
    WHEN ec.total_active_events > 0 THEN
      ROUND((s.total_hadir::NUMERIC / ec.total_active_events) * 100, 1)
    WHEN s.total_recorded > 0 THEN
      ROUND((s.total_hadir::NUMERIC / s.total_recorded) * 100, 1)
    ELSE 0.0
  END AS attendance_percentage,
  CASE
    WHEN s.total_points >= 80 THEN 'Sangat Aktif'
    WHEN s.total_points >= 60 THEN 'Aktif'
    ELSE 'Perlu Pembinaan'
  END AS predicate
FROM user_stats s
CROSS JOIN event_counts ec;

-- 7. RPC: GET_EMAIL_BY_NPM (Mendukung NPM & NIM)
CREATE OR REPLACE FUNCTION public.get_email_by_npm(input_npm TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT email FROM public.profiles 
  WHERE LOWER(COALESCE(npm, '')) = LOWER(TRIM(input_npm)) 
     OR LOWER(COALESCE(nim, '')) = LOWER(TRIM(input_npm)) 
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_by_npm(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_email_by_nim(input_nim TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT public.get_email_by_npm(input_nim);
$$;

GRANT EXECUTE ON FUNCTION public.get_email_by_nim(TEXT) TO anon, authenticated;

-- 8. RPC: CHECK_AUTHORIZED_NPM (Validasi Whitelist SK oleh Admin)
CREATE OR REPLACE FUNCTION public.check_authorized_npm(input_npm TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_rec RECORD;
BEGIN
  SELECT COALESCE(npm, nim) as npm, full_name, division, role, is_claimed
  INTO v_rec
  FROM public.authorized_members
  WHERE LOWER(COALESCE(npm, '')) = LOWER(TRIM(input_npm))
     OR LOWER(COALESCE(nim, '')) = LOWER(TRIM(input_npm))
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT COALESCE(npm, nim) as npm, full_name, division, role, TRUE as is_claimed
    INTO v_rec
    FROM public.profiles
    WHERE LOWER(COALESCE(npm, '')) = LOWER(TRIM(input_npm))
       OR LOWER(COALESCE(nim, '')) = LOWER(TRIM(input_npm))
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN json_build_object('authorized', false);
  ELSE
    RETURN json_build_object(
      'authorized', true,
      'npm', v_rec.npm,
      'nim', v_rec.npm,
      'full_name', v_rec.full_name,
      'division', v_rec.division,
      'role', v_rec.role,
      'is_claimed', v_rec.is_claimed
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_authorized_npm(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_authorized_nim(input_nim TEXT)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT public.check_authorized_npm(input_nim);
$$;

GRANT EXECUTE ON FUNCTION public.check_authorized_nim(TEXT) TO anon, authenticated;

-- 9. TRIGGER: OTOMATIS SYNC DARI AUTH.USERS KE PUBLIC.PROFILES
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_npm TEXT;
BEGIN
  v_npm := COALESCE(NEW.raw_user_meta_data->>'npm', NEW.raw_user_meta_data->>'nim', 'NPM-' || SUBSTRING(NEW.id::TEXT, 1, 8));

  -- Hapus profil lama jika memiliki NPM/NIM yang sama tapi beda ID untuk menghindari duplicate key
  DELETE FROM public.profiles WHERE (npm = v_npm OR nim = v_npm) AND id <> NEW.id;

  INSERT INTO public.profiles (
    id,
    npm,
    nim,
    email,
    full_name,
    division,
    role,
    phone,
    study_program,
    bio,
    is_activated
  )
  VALUES (
    NEW.id,
    v_npm,
    v_npm,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Anggota GenBI'),
    COALESCE(NEW.raw_user_meta_data->>'division', 'Publikasi dan Sosialisasi'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'member'),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'study_program',
    NEW.raw_user_meta_data->>'bio',
    TRUE
  )
  ON CONFLICT (id) DO UPDATE SET
    npm = EXCLUDED.npm,
    nim = EXCLUDED.nim,
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;

  UPDATE public.authorized_members
  SET is_claimed = TRUE
  WHERE LOWER(COALESCE(npm, '')) = LOWER(v_npm)
     OR LOWER(COALESCE(nim, '')) = LOWER(v_npm);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 10. TRIGGER AUTO-CONFIRM EMAIL (Bypass "Email not confirmed")
CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.email_confirmed_at = COALESCE(NEW.email_confirmed_at, NOW());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_auto_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_user();

-- Konfirmasi seluruh akun yang saat ini terdaftar namun belum terkonfirmasi
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- 11. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authorized_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- RLS Policies
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
CREATE POLICY "profiles_insert_policy" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "authorized_members_select_policy" ON public.authorized_members;
CREATE POLICY "authorized_members_select_policy" ON public.authorized_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "authorized_members_all_policy" ON public.authorized_members;
CREATE POLICY "authorized_members_all_policy" ON public.authorized_members FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "events_select_policy" ON public.events;
CREATE POLICY "events_select_policy" ON public.events FOR SELECT USING (true);

DROP POLICY IF EXISTS "events_insert_policy" ON public.events;
CREATE POLICY "events_insert_policy" ON public.events FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "events_update_policy" ON public.events;
CREATE POLICY "events_update_policy" ON public.events FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "events_delete_policy" ON public.events;
CREATE POLICY "events_delete_policy" ON public.events FOR DELETE USING (true);

DROP POLICY IF EXISTS "events_all_policy" ON public.events;
CREATE POLICY "events_all_policy" ON public.events FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "attendances_select_policy" ON public.attendances;
CREATE POLICY "attendances_select_policy" ON public.attendances FOR SELECT USING (true);

DROP POLICY IF EXISTS "attendances_insert_policy" ON public.attendances;
CREATE POLICY "attendances_insert_policy" ON public.attendances FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "attendances_update_policy" ON public.attendances;
CREATE POLICY "attendances_update_policy" ON public.attendances FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "attendances_delete_policy" ON public.attendances;
CREATE POLICY "attendances_delete_policy" ON public.attendances FOR DELETE USING (true);

DROP POLICY IF EXISTS "attendances_all_policy" ON public.attendances;
CREATE POLICY "attendances_all_policy" ON public.attendances FOR ALL USING (true) WITH CHECK (true);

-- 12. SEED AGENDA KEGIATAN RESMI SUPABASE DENGAN UUID VALID
INSERT INTO public.events (id, title, category, event_date, points, qr_token, is_active, require_location, target_lat, target_lng, radius_meters)
VALUES
  ('e1111111-1111-1111-1111-111111111111', 'Sosialisasi Cinta Bangga Paham (CBP) Rupiah ke SMA Majalengka', 'Proker', NOW() + INTERVAL '2 days', 15, 'CBP-UNMA-2026', TRUE, FALSE, -6.8362, 108.2275, 250),
  ('e2222222-2222-2222-2222-222222222222', 'Leadership Camp & Penguatan Kapasitas Generasi Baru Indonesia Cirebon', 'Wajib', NOW() + INTERVAL '5 days', 25, 'LC-GENBI-2026', TRUE, TRUE, -6.8362, 108.2275, 300),
  ('e3333333-3333-3333-3333-333333333333', 'Rapat Pleno & Evaluasi Bulanan Divisi GenBI UNMA', 'Rutin', NOW() + INTERVAL '8 days', 10, 'PLENO-FEB-2026', TRUE, FALSE, -6.8362, 108.2275, 250),
  ('e4444444-4444-4444-4444-444444444444', 'Penugasan Delegasi Bank Indonesia (Wilayah 9 & 10 Ciayumajakuning)', 'Wajib', NOW() + INTERVAL '12 days', 30, 'DELEGASI-BI-2026', TRUE, FALSE, -6.7063, 108.5570, 50000)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  category = EXCLUDED.category,
  points = EXCLUDED.points,
  qr_token = EXCLUDED.qr_token,
  is_active = EXCLUDED.is_active;

-- 13. SEED WHITELIST SK ANGGOTA RESMI (Mendukung NPM & NIM)
INSERT INTO public.authorized_members (npm, nim, full_name, division, role, is_claimed)
VALUES
  ('2414101078', '2414101078', 'Ahmad Fauzi', 'BPH', 'admin', false),
  ('2214100010', '2214100010', 'Deden Kurniawan', 'Publikasi dan Sosialisasi', 'kadiv', false),
  ('2214100025', '2214100025', 'Siti Rahmawati', 'Pendidikan', 'kadiv', false),
  ('2214100033', '2214100033', 'Fajar Pratama', 'Lingkungan Hidup', 'kadiv', false),
  ('2214100048', '2214100048', 'Muhamad Fahmi', 'Publikasi dan Sosialisasi', 'member', false),
  ('2214100052', '2214100052', 'Rizky Ramadhan', 'Kewirausahaan', 'member', false),
  ('2214100067', '2214100067', 'Nadia Putri', 'Pengabdian Masyarakat', 'member', false)
ON CONFLICT (npm) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  division = EXCLUDED.division,
  role = EXCLUDED.role;

-- 14. SEED AKUN RESMI AUTH & PROFIL (BPH, Kadiv, Anggota - Password default: genbi123)
DELETE FROM auth.users 
WHERE email IN ('admin@genbi-unma.ac.id', 'deden@genbi-unma.ac.id', 'fahmi@genbi-unma.ac.id') 
   OR id IN ('a1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222', 'c3333333-3333-3333-3333-333333333333')
   OR id IN (
     SELECT id FROM public.profiles 
     WHERE npm IN ('2414101078', '2214100010', '2214100048') 
        OR nim IN ('2414101078', '2214100010', '2214100048')
   );

DELETE FROM public.profiles 
WHERE id IN ('a1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222', 'c3333333-3333-3333-3333-333333333333')
   OR email IN ('admin@genbi-unma.ac.id', 'deden@genbi-unma.ac.id', 'fahmi@genbi-unma.ac.id')
   OR npm IN ('2414101078', '2214100010', '2214100048')
   OR nim IN ('2414101078', '2214100010', '2214100048');

INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
VALUES
  ('a1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'admin@genbi-unma.ac.id', crypt('genbi123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"npm":"2414101078","nim":"2414101078","full_name":"Ahmad Fauzi","division":"BPH","role":"admin"}', NOW(), NOW(), 'authenticated', 'authenticated'),
  ('b2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'deden@genbi-unma.ac.id', crypt('genbi123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"npm":"2214100010","nim":"2214100010","full_name":"Deden Kurniawan","division":"Publikasi dan Sosialisasi","role":"kadiv"}', NOW(), NOW(), 'authenticated', 'authenticated'),
  ('c3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'fahmi@genbi-unma.ac.id', crypt('genbi123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"npm":"2214100048","nim":"2214100048","full_name":"Muhamad Fahmi","division":"Publikasi dan Sosialisasi","role":"member"}', NOW(), NOW(), 'authenticated', 'authenticated');

INSERT INTO public.profiles (id, npm, nim, email, full_name, division, role, study_program, is_activated)
VALUES
  ('a1111111-1111-1111-1111-111111111111', '2414101078', '2414101078', 'admin@genbi-unma.ac.id', 'Ahmad Fauzi', 'BPH', 'admin', 'Informatika', TRUE),
  ('b2222222-2222-2222-2222-222222222222', '2214100010', '2214100010', 'deden@genbi-unma.ac.id', 'Deden Kurniawan', 'Publikasi dan Sosialisasi', 'kadiv', 'Sistem Informasi', TRUE),
  ('c3333333-3333-3333-3333-333333333333', '2214100048', '2214100048', 'fahmi@genbi-unma.ac.id', 'Muhamad Fahmi', 'Publikasi dan Sosialisasi', 'member', 'Manajemen', TRUE)
ON CONFLICT (id) DO UPDATE SET
  npm = EXCLUDED.npm,
  nim = EXCLUDED.nim,
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  division = EXCLUDED.division,
  role = EXCLUDED.role;

-- Tandai status whitelist SK
UPDATE public.authorized_members SET is_claimed = TRUE WHERE npm IN ('2414101078', '2214100010', '2214100048');

-- D. Seed Kehadiran Awal untuk Leaderboard Real-Time
INSERT INTO public.attendances (event_id, user_id, status, verified, scanned_at)
VALUES
  ('e1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'hadir', TRUE, NOW() - INTERVAL '3 days'),
  ('e2222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111', 'hadir', TRUE, NOW() - INTERVAL '10 days'),
  ('e1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222', 'hadir', TRUE, NOW() - INTERVAL '3 days'),
  ('e2222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', 'hadir', TRUE, NOW() - INTERVAL '10 days'),
  ('e1111111-1111-1111-1111-111111111111', 'c3333333-3333-3333-3333-333333333333', 'hadir', TRUE, NOW() - INTERVAL '3 days')
ON CONFLICT (event_id, user_id) DO NOTHING;
