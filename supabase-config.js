// =========================================================================
// АРКАИМ VPN — Supabase Client Configuration & Database Helpers
// =========================================================================

const SUPABASE_URL = 'https://cvozbqrjihhsdhgwlynx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_f9L9aJ4uY3jH0HeorKdRVw_bqEtSV5A';

// Helper to initialize or retrieve Supabase client instance
function getSupabase() {
    if (!window._supabaseInstance && window.supabase && typeof window.supabase.createClient === 'function') {
        window._supabaseInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
    }
    return window._supabaseInstance || null;
}

// Global reference
const supabaseClient = getSupabase();
window.supabaseClient = supabaseClient;

// =========================================================================
// DATABASE SCHEMA (3 таблицы PostgreSQL):
// 1. PROFILES (profiles) — профиль пользователя (id, email, display_name, plan, avatar_color, created_at, last_login)
// 2. SUBSCRIPTIONS (subscriptions) — подписки (id, user_id, plan, plan_label, status, vpn_key, start_date, end_date, devices_limit, created_at)
// 3. PAYMENTS (payments) — история платежей (id, user_id, subscription_id, amount, currency, method, status, description, created_at)
// =========================================================================

// Helper: Generate a VLESS key
function generateVlessKey() {
    const chars = 'abcdef0123456789';
    let uuid = '';
    const pattern = [8, 4, 4, 4, 12];
    pattern.forEach((len, idx) => {
        for (let i = 0; i < len; i++) uuid += chars[Math.floor(Math.random() * chars.length)];
        if (idx < pattern.length - 1) uuid += '-';
    });
    return `vless://${uuid}@node1.arkaim-vpn.net:443?encryption=none&security=reality&sni=gateway.arkaim.ru&type=grpc&serviceName=vless-grpc&fp=chrome#АРКАИМ_VPN`;
}

// =========================================================================
// AUTH FUNCTIONS
// =========================================================================

async function getCurrentUser() {
    const sb = getSupabase();
    if (!sb) return null;
    try {
        const { data: { user }, error } = await sb.auth.getUser();
        if (error || !user) return null;
        return user;
    } catch (e) {
        return null;
    }
}

async function registerUser(email, password, displayName) {
    const sb = getSupabase();
    if (!sb) return { success: false, error: 'Подключение к базе данных Supabase не готово' };

    try {
        const { data, error } = await sb.auth.signUp({
            email: email,
            password: password,
            options: {
                data: { display_name: displayName }
            }
        });

        if (error) return { success: false, error: getAuthErrorMessage(error.message) };

        if (data?.user) {
            // Гарантируем создание записи в profiles
            try {
                await sb.from('profiles').upsert({
                    id: data.user.id,
                    email: data.user.email,
                    display_name: displayName || data.user.email.split('@')[0],
                    plan: 'free',
                    avatar_color: '#B87333'
                }, { onConflict: 'id' });
            } catch (pErr) {
                console.warn('Profile upsert note:', pErr);
            }
        }

        return { success: true, user: data.user, session: data.session };
    } catch (err) {
        return { success: false, error: 'Произошла ошибка при регистрации. Попробуйте снова' };
    }
}

async function loginUser(email, password) {
    const sb = getSupabase();
    if (!sb) return { success: false, error: 'Подключение к базе данных Supabase не готово' };

    try {
        const { data, error } = await sb.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) return { success: false, error: getAuthErrorMessage(error.message) };

        if (data?.user) {
            try {
                await sb.from('profiles').update({
                    last_login: new Date().toISOString()
                }).eq('id', data.user.id);
            } catch (e) {}
        }

        return { success: true, user: data.user, session: data.session };
    } catch (err) {
        return { success: false, error: 'Произошла ошибка при входе. Попробуйте снова' };
    }
}

async function logoutUser() {
    const sb = getSupabase();
    if (!sb) return { success: false };
    try {
        const { error } = await sb.auth.signOut();
        if (error) return { success: false, error: error.message };
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function resetPassword(email) {
    const sb = getSupabase();
    if (!sb) return { success: false, error: 'Подключение к базе данных не готово' };
    try {
        const redirectUrl = window.location.origin + window.location.pathname;
        const { error } = await sb.auth.resetPasswordForEmail(email, {
            redirectTo: redirectUrl
        });
        if (error) return { success: false, error: getAuthErrorMessage(error.message) };
        return { success: true };
    } catch (err) {
        return { success: false, error: 'Произошла ошибка. Попробуйте снова' };
    }
}

// =========================================================================
// PROFILES (ТАБЛИЦА 1)
// =========================================================================

async function getUserProfile(userId) {
    const sb = getSupabase();
    if (!sb || !userId) return null;
    try {
        const { data, error } = await sb
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (error) {
            console.warn('Ошибка получения профиля:', error);
            return null;
        }
        return data;
    } catch (err) {
        console.warn('Исключение при получении профиля:', err);
        return null;
    }
}

async function updateUserProfile(userId, updates) {
    const sb = getSupabase();
    if (!sb || !userId) return false;
    try {
        const { error } = await sb
            .from('profiles')
            .update(updates)
            .eq('id', userId);

        return !error;
    } catch (err) {
        console.warn('Исключение при обновлении профиля:', err);
        return false;
    }
}

// =========================================================================
// SUBSCRIPTIONS & PAYMENTS (ТАБЛИЦЫ 2 & 3) — ДОБАВЛЕНИЕ В БД
// =========================================================================

async function createSubscription(userId, rawPlan, method) {
    const sb = getSupabase();
    if (!sb) throw new Error('Supabase клиент не инициализирован');
    if (!userId) throw new Error('Необходимо войти в аккаунт');

    // Определяем тариф: 'warrior' или 'boss'
    const planStr = String(rawPlan || '').toLowerCase();
    const plan = (planStr.includes('boss') || planStr.includes('босс')) ? 'boss' : 'warrior';

    const planDetails = {
        warrior: { label: 'ВОИН — 50 ₽/мес', amount: 50, durationDays: 30 },
        boss:    { label: 'БОСС — 500 ₽/год', amount: 500, durationDays: 365 }
    };

    const details = planDetails[plan];
    const now = new Date();
    const endDate = new Date(now.getTime() + details.durationDays * 24 * 60 * 60 * 1000);
    const vpnKey = generateVlessKey();

    // 1. Убеждаемся, что профиль пользователя существует в profiles
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
        await sb.from('profiles').upsert({
            id: userId,
            email: user.email,
            display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'Воин',
            plan: plan
        }, { onConflict: 'id' });
    }

    // 2. Вставка записи в таблицу subscriptions
    const { data: subData, error: subError } = await sb
        .from('subscriptions')
        .insert({
            user_id: userId,
            plan: plan,
            plan_label: details.label,
            status: 'active',
            vpn_key: vpnKey,
            start_date: now.toISOString(),
            end_date: endDate.toISOString(),
            devices_limit: 2
        })
        .select()
        .single();

    if (subError) {
        console.error('Ошибка добавления подписки в subscriptions:', subError);
        throw subError;
    }

    // 3. Вставка записи в таблицу payments
    const safeMethod = ['СБП', 'Т-Пэй', 'Крипта', 'Telegram'].includes(method) ? method : 'СБП';
    const { error: payError } = await sb
        .from('payments')
        .insert({
            user_id: userId,
            subscription_id: subData.id,
            amount: details.amount,
            currency: 'RUB',
            method: safeMethod,
            status: 'completed',
            description: `Оплата тарифа "${details.label}"`
        });

    if (payError) {
        console.warn('Ошибка добавления записи в payments:', payError);
    }

    // 4. Обновление тарифа в profiles
    await sb
        .from('profiles')
        .update({ plan: plan })
        .eq('id', userId);

    return {
        subscription: subData,
        subscriptionId: subData.id,
        vpnKey: vpnKey,
        endDate: endDate,
        planLabel: details.label,
        amount: details.amount
    };
}

async function getUserSubscriptions(userId) {
    const sb = getSupabase();
    if (!sb || !userId) return [];
    try {
        const { data, error } = await sb
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.warn('Ошибка получения подписок:', error);
            return [];
        }
        return data || [];
    } catch (err) {
        console.warn('Исключение при получении подписок:', err);
        return [];
    }
}

async function getActiveSubscription(userId) {
    const sb = getSupabase();
    if (!sb || !userId) return null;
    try {
        const { data, error } = await sb
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) return null;
        return data || null;
    } catch (err) {
        return null;
    }
}

async function getUserPayments(userId) {
    const sb = getSupabase();
    if (!sb || !userId) return [];
    try {
        const { data, error } = await sb
            .from('payments')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.warn('Ошибка получения платежей:', error);
            return [];
        }
        return data || [];
    } catch (err) {
        console.warn('Исключение при получении платежей:', err);
        return [];
    }
}

// =========================================================================
// ERROR MESSAGES
// =========================================================================

function getAuthErrorMessage(msg) {
    if (!msg) return 'Произошла ошибка. Попробуйте снова';
    const lower = msg.toLowerCase();
    if (lower.includes('invalid login credentials') || lower.includes('invalid grant')) return 'Неверный email или пароль';
    if (lower.includes('email not confirmed')) return 'Email не подтверждён. Проверьте почту или отключите Confirm Email в настройках Supabase Auth';
    if (lower.includes('user already registered') || lower.includes('already exists')) return 'Пользователь с таким email уже зарегистрирован';
    if (lower.includes('invalid email')) return 'Некорректный формат email';
    if (lower.includes('weak password') || lower.includes('at least')) return 'Пароль слишком простой (минимум 6 символов)';
    if (lower.includes('rate limit')) return 'Слишком много запросов. Подождите немного и повторите';
    if (lower.includes('network') || lower.includes('fetch')) return 'Ошибка сети. Проверьте подключение к интернету';
    return msg;
}
