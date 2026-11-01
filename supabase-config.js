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
// HELPERS ДЛЯ УДОБСТВА: ЛОГИНЫ И ПАРОЛИ ЛЮБОЙ ДЛИНЫ
// =========================================================================

// Преобразует никнейм/логин без '@' в валидный email для Supabase Auth
function normalizeEmail(input) {
    let s = String(input || '').trim().toLowerCase();
    if (!s) return '';
    if (!s.includes('@')) {
        const clean = s.replace(/[^a-z0-9._-]/gi, '_');
        return `${clean || 'user'}@arkaim.ru`;
    }
    return s;
}

// Supabase требует пароль не менее 6 символов.
// Если пользователь вводит '1212', дополняем до 6 символов ('121212')
function normalizePassword(pwd) {
    let p = String(pwd || '');
    if (!p) return '';
    if (p.length < 6) {
        return p.repeat(Math.ceil(6 / p.length)).slice(0, 6);
    }
    return p;
}

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

async function registerUser(rawEmail, rawPassword, displayName) {
    const sb = getSupabase();
    if (!sb) return { success: false, error: 'Подключение к базе данных Supabase не готово' };

    const email = normalizeEmail(rawEmail);
    const password = normalizePassword(rawPassword);
    const finalName = String(displayName || '').trim() || String(rawEmail || '').trim() || 'Воин';

    try {
        const { data, error } = await sb.auth.signUp({
            email: email,
            password: password,
            options: {
                data: { display_name: finalName }
            }
        });

        if (error) {
            // Если пользователь уже зарегистрирован — сразу пробуем войти
            if (error.message.toLowerCase().includes('already registered')) {
                const autoLogin = await loginUser(rawEmail, rawPassword);
                if (autoLogin.success) {
                    return autoLogin;
                }
            }
            return { success: false, error: getAuthErrorMessage(error.message) };
        }

        // Гарантируем запись в profiles
        if (data?.user) {
            try {
                await sb.from('profiles').upsert({
                    id: data.user.id,
                    email: email,
                    display_name: finalName,
                    plan: 'free',
                    avatar_color: '#B87333'
                }, { onConflict: 'id' });
            } catch (pErr) {
                console.warn('Profile upsert note:', pErr);
            }
        }

        // Если сессия сразу выдана
        if (data?.session) {
            return { success: true, user: data.user, session: data.session };
        }

        // Пробуем войти
        const tryLogin = await loginUser(rawEmail, rawPassword);
        if (tryLogin.success) {
            return tryLogin;
        }

        return {
            success: true,
            user: data.user,
            needsConfirm: true,
            message: 'Пользователь успешно создан в базе Supabase!'
        };

    } catch (err) {
        return { success: false, error: err.message || 'Произошла ошибка при регистрации' };
    }
}

async function loginUser(rawEmail, rawPassword) {
    const sb = getSupabase();
    if (!sb) return { success: false, error: 'Подключение к базе данных Supabase не готово' };

    const p = String(rawPassword || '');
    const pwdCandidates = [];
    if (p.length < 6) {
        pwdCandidates.push(p.repeat(Math.ceil(6 / p.length)).slice(0, 6)); // '1212' -> '121212'
        pwdCandidates.push(p.padEnd(6, '0'));                             // '1212' -> '121200'
    }
    pwdCandidates.push(p);

    const raw = String(rawEmail || '').trim();
    const emailCandidates = [];
    if (raw.includes('@')) {
        emailCandidates.push(raw.toLowerCase());
    } else {
        const clean = raw.toLowerCase().replace(/[^a-z0-9._-]/gi, '_');
        emailCandidates.push(`${clean}@arkaim.ru`);
    }

    let lastError = null;

    // Перебираем варианты (логин Veb-tec как @arkaim.ru и пароль 1212 как 121212)
    for (const email of emailCandidates) {
        for (const pwd of pwdCandidates) {
            try {
                const { data, error } = await sb.auth.signInWithPassword({
                    email: email,
                    password: pwd
                });

                if (!error && data?.user) {
                    try {
                        await sb.from('profiles').update({
                            last_login: new Date().toISOString()
                        }).eq('id', data.user.id);
                    } catch (e) {}

                    return { success: true, user: data.user, session: data.session };
                }

                if (error) {
                    lastError = error;
                }
            } catch (err) {
                lastError = err;
            }
        }
    }

    return { success: false, error: getAuthErrorMessage(lastError?.message) };
}

async function logoutUser() {
    const sb = getSupabase();
    if (!sb) return { success: false };
    try {
        await sb.auth.signOut();
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function resetPassword(rawEmail) {
    const sb = getSupabase();
    if (!sb) return { success: false, error: 'Подключение к базе данных не готово' };
    try {
        const email = normalizeEmail(rawEmail);
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
    if (lower.includes('database error querying schema')) {
        return 'Ошибка сессии базы данных. Попробуйте обновить страницу (Ctrl+F5) или войти снова.';
    }
    if (lower.includes('email logins are disabled') || lower.includes('email signups are disabled') || lower.includes('email_provider_disabled')) {
        return '⚠️ В панели Supabase отключен провайдер Email! Зайдите в Authentication -> Providers -> Email и включите тумблер "Enable Email provider".';
    }
    if (lower.includes('rate limit')) {
        return '⚠️ Исчерпан лимит отправки email Supabase. Отключите "Confirm email" в панели Supabase (Authentication -> Providers -> Email), чтобы пользователи создавались мгновенно!';
    }
    if (lower.includes('email not confirmed')) {
        return '⚠️ Email не подтверждён. Отключите "Confirm email" в панели Supabase (Authentication -> Providers -> Email) или подтвердите почту.';
    }
    if (lower.includes('invalid login credentials') || lower.includes('invalid grant')) return 'Неверный логин или пароль';
    if (lower.includes('user already registered') || lower.includes('already exists')) return 'Пользователь с таким логином уже зарегистрирован. Попробуйте войти';
    if (lower.includes('invalid email')) return 'Некорректный формат логина или email';
    if (lower.includes('weak password') || lower.includes('at least')) return 'Пароль слишком простой';
    if (lower.includes('network') || lower.includes('fetch')) return 'Ошибка сети. Проверьте подключение к интернету';
    return msg;
}
