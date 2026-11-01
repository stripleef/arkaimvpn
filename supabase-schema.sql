-- =========================================================================
-- АРКАИМ VPN — Supabase SQL: Создание таблиц, индексов и политик безопасности (RLS)
-- Выполните этот скрипт в Supabase Dashboard:
-- https://supabase.com/dashboard/project/cvozbqrjihhsdhgwlynx/sql/new
-- Нажмите "Run" для применения.
-- =========================================================================

-- Включаем расширение для генерации UUID, если оно ещё не включено
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===== ТАБЛИЦА 1: profiles (профили пользователей) =====
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    display_name TEXT,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'warrior', 'boss')),
    avatar_color TEXT DEFAULT '#B87333',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ DEFAULT NOW()
);

-- ===== ТАБЛИЦА 2: subscriptions (подписки) =====
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    plan TEXT NOT NULL CHECK (plan IN ('warrior', 'boss')),
    plan_label TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    vpn_key TEXT,
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ NOT NULL,
    devices_limit INTEGER DEFAULT 2,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== ТАБЛИЦА 3: payments (история платежей) =====
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    amount NUMERIC(10,2) NOT NULL,
    currency TEXT DEFAULT 'RUB',
    method TEXT CHECK (method IN ('СБП', 'Т-Пэй', 'Крипта', 'Telegram')),
    status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'failed', 'refunded')),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== ИНДЕКСЫ для ускорения выборок =====
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);

-- ===== ROW LEVEL SECURITY (RLS) =====
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики, если они существовали (чтобы избежать ошибок при повторном запуске)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.subscriptions;

DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can insert own payments" ON public.payments;

-- Profiles: пользователь видит, редактирует и создает свой профиль
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Subscriptions: пользователь управляет только своими подписками
CREATE POLICY "Users can view own subscriptions"
    ON public.subscriptions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
    ON public.subscriptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
    ON public.subscriptions FOR UPDATE
    USING (auth.uid() = user_id);

-- Payments: пользователь видит и вставляет свои платежи
CREATE POLICY "Users can view own payments"
    ON public.payments FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payments"
    ON public.payments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ===== ПРАВА ДОСТУПА ДЛЯ REST API =====
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.subscriptions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.payments TO anon, authenticated, service_role;

-- ===== АВТОМАТИЧЕСКОЕ СОЗДАНИЕ ПРОФИЛЯ ПРИ РЕГИСТРАЦИИ =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name, avatar_color)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
        (ARRAY['#B87333', '#C9A84C', '#E8B45A', '#D4934A', '#8B6914', '#A0522D', '#CD853F'])[floor(random() * 7 + 1)]
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Пересоздание триггера
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ===== АВТОМАТИЧЕСКОЕ ПОДТВЕРЖДЕНИЕ EMAIL ДЛЯ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ =====
-- Позволяет входить сразу после регистрации без ожидания письма
UPDATE auth.users SET email_confirmed_at = NOW() WHERE email_confirmed_at IS NULL;

CREATE OR REPLACE FUNCTION public.auto_confirm_new_user()
RETURNS TRIGGER AS $$
BEGIN
    NEW.email_confirmed_at = COALESCE(NEW.email_confirmed_at, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_auto_confirm
    BEFORE INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_new_user();

-- ===== СОЗДАНИЕ ТЕСТОВОГО ПОЛЬЗОВАТЕЛЯ Veb-tec (ПАРОЛЬ 1212) =====
DO $$
DECLARE
    new_user_id UUID := gen_random_uuid();
BEGIN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'veb-tec@arkaim-vpn.net') THEN
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password,
            email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
            created_at, updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            new_user_id,
            'authenticated',
            'authenticated',
            'veb-tec@arkaim-vpn.net',
            crypt('121200', gen_salt('bf')),
            NOW(),
            '{"provider":"email","providers":["email"]}',
            '{"display_name":"Veb-tec"}',
            NOW(),
            NOW()
        );

        INSERT INTO public.profiles (id, email, display_name, plan, avatar_color)
        VALUES (new_user_id, 'veb-tec@arkaim-vpn.net', 'Veb-tec', 'warrior', '#B87333')
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;
