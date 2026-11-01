// =========================================================================
// АРКАИМ VPN — Личный кабинет (account.js)
// Интеграция с базой данных Supabase (PostgreSQL)
// =========================================================================

document.addEventListener('DOMContentLoaded', async () => {

    // ===== PARTICLES =====
    const pCanvas = document.getElementById('particles');
    if (pCanvas) {
        const pCtx = pCanvas.getContext('2d');
        let stars = [];

        function resizeP() {
            pCanvas.width = window.innerWidth;
            pCanvas.height = window.innerHeight;
        }
        resizeP();
        window.addEventListener('resize', resizeP);

        class Star {
            constructor() { this.reset(); }
            reset() {
                this.x = Math.random() * pCanvas.width;
                this.y = Math.random() * pCanvas.height;
                this.size = Math.random() * 1.2 + 0.8;
                this.speedX = (Math.random() - 0.5) * 0.3;
                this.speedY = (Math.random() - 0.5) * 0.18 - 0.05;
                this.alpha = Math.random() * 0.35 + 0.15;
                this.maxAlpha = Math.random() * 0.3 + 0.35;
                this.minAlpha = 0.12;
                this.twinkleSpeed = Math.random() * 0.01 + 0.004;
                this.twinkleDir = Math.random() > 0.5 ? 1 : -1;
                const colors = ['#F0E6CC', '#E8B45A', '#C9A84C', '#D4934A', '#FFF8E7'];
                this.color = colors[Math.floor(Math.random() * colors.length)];
                this.isFourPoint = Math.random() > 0.35;
            }
            update() {
                this.x += this.speedX;
                this.y += this.speedY;
                this.alpha += this.twinkleSpeed * this.twinkleDir;
                if (this.alpha >= this.maxAlpha) { this.alpha = this.maxAlpha; this.twinkleDir = -1; }
                else if (this.alpha <= this.minAlpha) { this.alpha = this.minAlpha; this.twinkleDir = 1; }
                if (this.x < -12) this.x = pCanvas.width + 12;
                if (this.x > pCanvas.width + 12) this.x = -12;
                if (this.y < -12) this.y = pCanvas.height + 12;
                if (this.y > pCanvas.height + 12) this.y = -12;
            }
            draw() {
                pCtx.save();
                pCtx.translate(this.x, this.y);
                pCtx.beginPath();
                pCtx.arc(0, 0, this.size * 2.0, 0, Math.PI * 2);
                pCtx.fillStyle = this.color;
                pCtx.globalAlpha = this.alpha * 0.22;
                pCtx.fill();
                pCtx.globalAlpha = this.alpha;
                pCtx.fillStyle = this.color;
                if (this.isFourPoint) {
                    const s = this.size;
                    pCtx.beginPath();
                    pCtx.moveTo(0, -s * 1.8);
                    pCtx.quadraticCurveTo(0, 0, s * 1.8, 0);
                    pCtx.quadraticCurveTo(0, 0, 0, s * 1.8);
                    pCtx.quadraticCurveTo(0, 0, -s * 1.8, 0);
                    pCtx.quadraticCurveTo(0, 0, 0, -s * 1.8);
                    pCtx.closePath();
                    pCtx.fill();
                } else {
                    pCtx.beginPath();
                    pCtx.arc(0, 0, this.size * 0.8, 0, Math.PI * 2);
                    pCtx.fill();
                }
                pCtx.restore();
            }
        }

        for (let i = 0; i < 70; i++) stars.push(new Star());
        function animate() {
            pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
            stars.forEach(s => { s.update(); s.draw(); });
            requestAnimationFrame(animate);
        }
        animate();
    }

    // ===== MOBILE NAV =====
    const burger = document.getElementById('burger');
    const navOverlay = document.getElementById('nav-overlay');
    const navClose = document.getElementById('nav-close');
    if (burger && navOverlay) burger.addEventListener('click', () => navOverlay.classList.add('active'));
    if (navClose && navOverlay) navClose.addEventListener('click', () => navOverlay.classList.remove('active'));
    window.closeNav = () => { if (navOverlay) navOverlay.classList.remove('active'); };

    // ===== ELEMENTS =====
    const authSection = document.getElementById('auth-section');
    const dashSection = document.getElementById('dashboard-section');
    const authLogin = document.getElementById('auth-login');
    const authRegister = document.getElementById('auth-register');
    const authForgot = document.getElementById('auth-forgot');

    let currentLoggedInUser = null;

    // Helper: Safely get Supabase
    const sb = window.supabaseClient || (typeof getSupabase === 'function' ? getSupabase() : null);

    // ===== AUTH STATE HANDLER =====
    async function handleAuthState(user) {
        currentLoggedInUser = user;
        if (user) {
            authSection.style.display = 'none';
            dashSection.style.display = 'block';
            await loadDashboard(user);

            // Проверяем URL параметры (например: account.html?plan=warrior)
            const urlParams = new URLSearchParams(window.location.search);
            const planParam = urlParams.get('plan');
            if (planParam) {
                openSubModal(planParam);
                // Очищаем параметр из URL без перезагрузки
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        } else {
            authSection.style.display = '';
            dashSection.style.display = 'none';
        }
    }

    // Проверяем существующую сессию при загрузке
    if (sb) {
        try {
            const { data: { session } } = await sb.auth.getSession();
            if (session?.user) {
                await handleAuthState(session.user);
            } else {
                await handleAuthState(null);
            }
        } catch (e) {
            console.warn('Session check note:', e);
            await handleAuthState(null);
        }

        // Подписываемся на события авторизации
        sb.auth.onAuthStateChange(async (event, session) => {
            const user = session?.user || null;
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
                if (user && (!currentLoggedInUser || currentLoggedInUser.id !== user.id)) {
                    await handleAuthState(user);
                }
            } else if (event === 'SIGNED_OUT') {
                await handleAuthState(null);
            }
        });
    }

    // ===== SWITCH AUTH FORMS =====
    function showAuthCard(card) {
        authLogin.style.display = 'none';
        authRegister.style.display = 'none';
        authForgot.style.display = 'none';
        card.style.display = '';
        document.querySelectorAll('.auth-alert').forEach(a => {
            a.className = 'auth-alert';
            a.textContent = '';
        });
    }

    document.getElementById('show-register')?.addEventListener('click', (e) => {
        e.preventDefault();
        showAuthCard(authRegister);
    });

    document.getElementById('show-login')?.addEventListener('click', (e) => {
        e.preventDefault();
        showAuthCard(authLogin);
    });

    document.getElementById('show-forgot')?.addEventListener('click', (e) => {
        e.preventDefault();
        showAuthCard(authForgot);
    });

    document.getElementById('show-login-from-forgot')?.addEventListener('click', (e) => {
        e.preventDefault();
        showAuthCard(authLogin);
    });

    // ===== PASSWORD TOGGLE =====
    window.togglePassword = function(inputId, btn) {
        const input = document.getElementById(inputId);
        if (input.type === 'password') {
            input.type = 'text';
            btn.textContent = '🙈';
        } else {
            input.type = 'password';
            btn.textContent = '👁️';
        }
    };

    // ===== LOGIN FORM =====
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const alert = document.getElementById('login-alert');
        const btn = document.getElementById('login-btn');
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        btn.classList.add('btn-loading');
        btn.textContent = 'Входим в крепость...';
        alert.className = 'auth-alert';

        const result = await loginUser(email, password);

        btn.classList.remove('btn-loading');
        btn.textContent = 'Войти';

        if (!result.success) {
            alert.className = 'auth-alert error';
            alert.textContent = result.error;
        } else if (result.user) {
            await handleAuthState(result.user);
        }
    });

    // ===== REGISTER FORM =====
    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const alert = document.getElementById('register-alert');
        const btn = document.getElementById('register-btn');
        const name = document.getElementById('register-name').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;
        const password2 = document.getElementById('register-password2').value;

        if (password !== password2) {
            alert.className = 'auth-alert error';
            alert.textContent = 'Пароли не совпадают';
            return;
        }

        btn.classList.add('btn-loading');
        btn.textContent = 'Создаём аккаунт...';
        alert.className = 'auth-alert';

        const result = await registerUser(email, password, name);

        btn.classList.remove('btn-loading');
        btn.textContent = 'Создать аккаунт';

        if (!result.success) {
            alert.className = 'auth-alert error';
            alert.textContent = result.error;
        } else if (result.session && result.user) {
            await handleAuthState(result.user);
        } else if (result.needsConfirm) {
            alert.className = 'auth-alert success';
            alert.textContent = result.message || 'Аккаунт успешно создан в базе Supabase!';
        } else if (result.user) {
            await handleAuthState(result.user);
        }
    });

    // ===== FORGOT PASSWORD FORM =====
    document.getElementById('forgot-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const alert = document.getElementById('forgot-alert');
        const btn = document.getElementById('forgot-btn');
        const email = document.getElementById('forgot-email').value.trim();

        btn.classList.add('btn-loading');
        btn.textContent = 'Отправляем...';
        alert.className = 'auth-alert';

        const result = await resetPassword(email);

        btn.classList.remove('btn-loading');
        btn.textContent = 'Отправить ссылку';

        if (result.success) {
            alert.className = 'auth-alert success';
            alert.textContent = 'Ссылка для сброса пароля отправлена на ваш email.';
        } else {
            alert.className = 'auth-alert error';
            alert.textContent = result.error;
        }
    });

    // ===== LOGOUT =====
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await logoutUser();
        await handleAuthState(null);
    });

    // ===== DASHBOARD NAVIGATION =====
    document.querySelectorAll('.dash-nav-item[data-panel]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.dash-nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const panelId = 'panel-' + btn.dataset.panel;
            document.querySelectorAll('.dash-panel').forEach(p => p.classList.remove('active'));
            const panel = document.getElementById(panelId);
            if (panel) panel.classList.add('active');
        });
    });

    // ===== LOAD DASHBOARD DATA (FROM SUPABASE) =====
    async function loadDashboard(user) {
        if (!user) return;
        try {
            // 1. Получаем профиль из таблицы profiles
            const profile = await getUserProfile(user.id);
            const displayName = profile?.display_name || user.user_metadata?.display_name || user.email?.split('@')[0] || 'Воин';
            const email = user.email || '';
            const avatarColor = profile?.avatar_color || '#B87333';
            const plan = profile?.plan || 'free';

            // Обновляем боковую панель
            const avatarEl = document.getElementById('dash-avatar');
            if (avatarEl) {
                avatarEl.textContent = displayName.charAt(0).toUpperCase();
                avatarEl.style.background = `linear-gradient(135deg, ${avatarColor}, ${adjustColor(avatarColor, -30)})`;
            }

            document.getElementById('dash-username').textContent = displayName;
            document.getElementById('dash-email').textContent = email;

            // Бейдж тарифа
            const planBadge = document.getElementById('dash-plan-badge');
            const planLabels = {
                free: { label: 'Без тарифа', class: 'plan-free', icon: '○' },
                warrior: { label: 'ВОИН', class: 'plan-warrior', icon: '⚔️' },
                boss: { label: 'БОСС', class: 'plan-boss', icon: '👑' }
            };
            const pInfo = planLabels[plan] || planLabels.free;
            if (planBadge) {
                planBadge.innerHTML = `<span class="${pInfo.class}">${pInfo.icon} ${pInfo.label}</span>`;
            }

            // 2. Получаем подписки и платежи из Supabase
            const subscriptions = await getUserSubscriptions(user.id);
            const payments = await getUserPayments(user.id);
            const activeSub = subscriptions.find(s => s.status === 'active') || null;

            // ---- ОБЗОР ----
            document.getElementById('stat-plan').textContent = pInfo.label;
            document.getElementById('stat-payments').textContent = payments.length;

            const overviewSubContent = document.getElementById('overview-sub-content');
            const overviewSubStatus = document.getElementById('overview-sub-status');

            if (activeSub) {
                const endDate = parseDate(activeSub.end_date || activeSub.endDate);
                const daysLeft = endDate ? Math.max(0, Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24))) : 0;
                document.getElementById('stat-expires').textContent = daysLeft;

                if (overviewSubStatus) overviewSubStatus.innerHTML = '<span class="sub-status active">Активна</span>';
                if (overviewSubContent) overviewSubContent.innerHTML = renderSubCard(activeSub);
            } else {
                document.getElementById('stat-expires').textContent = '—';
                if (overviewSubStatus) overviewSubStatus.innerHTML = '<span class="sub-status none">Нет подписки</span>';
                if (overviewSubContent) {
                    overviewSubContent.innerHTML = `
                        <div class="empty-state">
                            <div class="empty-state-icon">🛡️</div>
                            <div class="empty-state-title">Нет активной подписки</div>
                            <div class="empty-state-text">Оформите тариф для подключения к скоростным узлам АРКАИМ VPN</div>
                            <button class="btn-copper open-sub-modal-btn">Оформить подписку</button>
                        </div>`;
                }
            }

            // Последние платежи (до 3)
            const overviewPaymentsContent = document.getElementById('overview-payments-content');
            if (overviewPaymentsContent) {
                const recentPayments = payments.slice(0, 3);
                if (recentPayments.length > 0) {
                    overviewPaymentsContent.innerHTML = renderPaymentsTable(recentPayments);
                } else {
                    overviewPaymentsContent.innerHTML = `
                        <div class="empty-state">
                            <div class="empty-state-icon">💳</div>
                            <div class="empty-state-title">Нет платежей</div>
                            <div class="empty-state-text">Здесь будет отображаться история ваших платежей из базы Supabase</div>
                        </div>`;
                }
            }

            // ---- ПАНЕЛЬ ПОДПИСОК ----
            const subDetailStatus = document.getElementById('sub-detail-status');
            const subDetailContent = document.getElementById('sub-detail-content');

            if (activeSub) {
                if (subDetailStatus) subDetailStatus.innerHTML = '<span class="sub-status active">Активна</span>';
                if (subDetailContent) subDetailContent.innerHTML = renderSubDetailCard(activeSub);
            } else {
                if (subDetailStatus) subDetailStatus.innerHTML = '<span class="sub-status none">Нет подписки</span>';
                if (subDetailContent) {
                    subDetailContent.innerHTML = `
                        <div class="empty-state">
                            <div class="empty-state-icon">🏰</div>
                            <div class="empty-state-title">У вас нет активной подписки</div>
                            <div class="empty-state-text">Выберите тариф ВОИН (50 ₽/мес) или БОСС (500 ₽/год) для генерации ключа</div>
                            <button class="btn-copper open-sub-modal-btn">Оформить тариф</button>
                        </div>`;
                }
            }

            // История всех подписок
            const subHistoryContent = document.getElementById('sub-history-content');
            if (subHistoryContent) {
                if (subscriptions.length > 0) {
                    subHistoryContent.innerHTML = renderSubHistory(subscriptions);
                } else {
                    subHistoryContent.innerHTML = `
                        <div class="empty-state">
                            <div class="empty-state-icon">📜</div>
                            <div class="empty-state-title">История подписок пуста</div>
                            <div class="empty-state-text">Все оформленные подписки сохраняются в таблице subscriptions</div>
                        </div>`;
                }
            }

            // ---- ПАНЕЛЬ ПЛАТЕЖЕЙ ----
            const paymentsTableContent = document.getElementById('payments-table-content');
            if (paymentsTableContent) {
                if (payments.length > 0) {
                    paymentsTableContent.innerHTML = renderPaymentsTable(payments);
                } else {
                    paymentsTableContent.innerHTML = `
                        <div class="empty-state">
                            <div class="empty-state-icon">💰</div>
                            <div class="empty-state-title">Нет платежей</div>
                            <div class="empty-state-text">Здесь будет полная история ваших транзакций из таблицы payments</div>
                        </div>`;
                }
            }

            // ---- ПАНЕЛЬ ПРОФИЛЯ ----
            document.getElementById('profile-name').value = displayName;
            document.getElementById('profile-email').value = email;
            const createdAt = parseDate(profile?.created_at || user.created_at);
            document.getElementById('profile-created').value = createdAt ? formatDate(createdAt) : 'Неизвестно';

            // Навешиваем слушатели на кнопки вызова модального окна в dynamic content
            document.querySelectorAll('.open-sub-modal-btn').forEach(b => {
                b.addEventListener('click', () => openSubModal());
            });

        } catch (err) {
            console.error('Ошибка при загрузке кабинета:', err);
        }
    }

    // ===== PROFILE FORM SUBMIT =====
    document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentLoggedInUser) return;

        const newName = document.getElementById('profile-name').value.trim();
        const btn = document.getElementById('profile-save-btn');
        const msg = document.getElementById('profile-saved-msg');

        btn.classList.add('btn-loading');

        try {
            if (sb) {
                await sb.auth.updateUser({ data: { display_name: newName } });
            }
            await updateUserProfile(currentLoggedInUser.id, { display_name: newName });

            document.getElementById('dash-username').textContent = newName;
            document.getElementById('dash-avatar').textContent = newName.charAt(0).toUpperCase();

            msg.classList.add('visible');
            setTimeout(() => msg.classList.remove('visible'), 2500);
        } catch (err) {
            console.error('Ошибка обновления профиля:', err);
        }

        btn.classList.remove('btn-loading');
    });

    // ===== RESET PASSWORD BUTTON IN PROFILE =====
    document.getElementById('reset-password-btn')?.addEventListener('click', async () => {
        if (!currentLoggedInUser || !currentLoggedInUser.email) return;

        const result = await resetPassword(currentLoggedInUser.email);
        if (result.success) {
            alert('Ссылка для смены пароля отправлена на email: ' + currentLoggedInUser.email);
        } else {
            alert('Ошибка: ' + result.error);
        }
    });

    // =========================================================================
    // MODAL: ОФОРМЛЕНИЕ ПОДПИСКИ И ДОБАВЛЕНИЕ В БАЗУ SUPABASE
    // =========================================================================

    const subModalOverlay = document.getElementById('sub-modal-overlay');
    const subModalClose = document.getElementById('sub-modal-close');
    const subStep1 = document.getElementById('sub-step-1');
    const subStep2 = document.getElementById('sub-step-2');
    const subStep3 = document.getElementById('sub-step-3');
    const subModalPayBtn = document.getElementById('sub-modal-pay-btn');
    const subModalFinishBtn = document.getElementById('sub-modal-finish-btn');
    const subModalKeyDisplay = document.getElementById('sub-modal-key-display');
    const subModalCopyKeyBtn = document.getElementById('sub-modal-copy-key-btn');

    let selectedSubPlan = 'warrior';
    let selectedSubMethod = 'СБП';

    function openSubModal(preferredPlan) {
        if (preferredPlan) {
            const p = String(preferredPlan).toLowerCase();
            selectedSubPlan = (p.includes('boss') || p.includes('босс')) ? 'boss' : 'warrior';
        }

        // Подсвечиваем выбранный тариф в модалке
        document.querySelectorAll('#sub-step-1 [data-plan]').forEach(item => {
            if (item.dataset.plan === selectedSubPlan) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Сбрасываем шаги
        if (subStep1) subStep1.classList.add('active');
        if (subStep2) subStep2.classList.remove('active');
        if (subStep3) subStep3.classList.remove('active');

        if (subModalOverlay) subModalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeSubModal() {
        if (subModalOverlay) subModalOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    if (subModalClose) subModalClose.addEventListener('click', closeSubModal);
    if (subModalOverlay) {
        subModalOverlay.addEventListener('click', (e) => {
            if (e.target === subModalOverlay) closeSubModal();
        });
    }

    // Кнопки открытия модалки
    document.getElementById('overview-buy-btn')?.addEventListener('click', () => openSubModal());
    document.getElementById('sub-buy-btn')?.addEventListener('click', () => openSubModal());

    // Переключение тарифа в модалке
    document.querySelectorAll('#sub-step-1 [data-plan]').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('#sub-step-1 [data-plan]').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            selectedSubPlan = item.dataset.plan;
        });
    });

    // Переключение метода оплаты в модалке
    document.querySelectorAll('#sub-step-1 [data-method]').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('#sub-step-1 [data-method]').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            selectedSubMethod = item.dataset.method;
        });
    });

    // Кнопка оплаты в модалке -> Запись в Supabase!
    if (subModalPayBtn) {
        subModalPayBtn.addEventListener('click', async () => {
            if (!currentLoggedInUser) {
                alert('Пожалуйста, войдите в аккаунт');
                return;
            }

            // Переход на шаг ожидания
            if (subStep1) subStep1.classList.remove('active');
            if (subStep2) subStep2.classList.add('active');

            try {
                // ДОБАВЛЕНИЕ В БАЗУ ДАННЫХ SUPABASE (таблицы subscriptions и payments)
                const result = await createSubscription(currentLoggedInUser.id, selectedSubPlan, selectedSubMethod);

                if (subModalKeyDisplay) {
                    subModalKeyDisplay.textContent = result.vpnKey;
                }

                // Переход на шаг успеха
                if (subStep2) subStep2.classList.remove('active');
                if (subStep3) subStep3.classList.add('active');

                // Перезагружаем данные кабинета
                await loadDashboard(currentLoggedInUser);

            } catch (err) {
                console.error('Ошибка оформления подписки:', err);
                alert('Не удалось добавить подписку в базу данных: ' + (err.message || 'Проверьте соединение с Supabase'));
                if (subStep2) subStep2.classList.remove('active');
                if (subStep1) subStep1.classList.add('active');
            }
        });
    }

    // Скопировать ключ в модалке
    if (subModalCopyKeyBtn && subModalKeyDisplay) {
        subModalCopyKeyBtn.addEventListener('click', () => {
            window.copyVpnKey(subModalCopyKeyBtn, subModalKeyDisplay.textContent);
        });
    }

    // Завершить и закрыть модалку
    if (subModalFinishBtn) {
        subModalFinishBtn.addEventListener('click', () => {
            closeSubModal();
        });
    }

    // =========================================================================
    // RENDER HELPERS
    // =========================================================================

    function renderSubCard(sub) {
        const endDate = parseDate(sub.end_date || sub.endDate);
        const startDate = parseDate(sub.start_date || sub.startDate) || new Date();
        const daysLeft = endDate ? Math.max(0, Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24))) : 0;
        const totalDays = endDate ? Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))) : 30;
        const progress = Math.min(100, Math.max(0, ((totalDays - daysLeft) / totalDays) * 100));

        return `
            <div class="sub-details-grid">
                <div class="sub-detail-item">
                    <div class="sub-detail-label">Тариф</div>
                    <div class="sub-detail-value">${sub.plan_label || sub.planLabel || sub.plan}</div>
                </div>
                <div class="sub-detail-item">
                    <div class="sub-detail-label">Истекает</div>
                    <div class="sub-detail-value">${formatDate(endDate)}</div>
                </div>
            </div>
            <div class="sub-progress">
                <div class="sub-progress-label">
                    <span>Использовано ${Math.max(0, totalDays - daysLeft)} из ${totalDays} дней</span>
                    <span>${daysLeft} дн. осталось</span>
                </div>
                <div class="sub-progress-bar">
                    <div class="sub-progress-fill ${daysLeft <= 3 ? 'low' : ''}" style="width:${progress}%"></div>
                </div>
            </div>
            <div style="margin-top:16px; text-align:right">
                <button class="btn-outline open-sub-modal-btn" style="padding:6px 16px; font-size:0.78rem">Продлить подписку</button>
            </div>`;
    }

    function renderSubDetailCard(sub) {
        let html = renderSubCard(sub);
        const vpnKey = sub.vpn_key || sub.vpnKey || 'Ключ не найден';
        const startDate = parseDate(sub.start_date || sub.startDate);

        html += `
            <div style="margin-top:24px">
                <h4 style="font-family:var(--serif);font-size:0.95rem;font-weight:700;color:var(--parch);margin-bottom:12px">🔑 Ваш персональный VPN-ключ (VLESS + Reality)</h4>
                <div class="vpn-key-block">
                    <div class="vpn-key-text">${vpnKey}</div>
                    <button class="vpn-key-copy" onclick="copyVpnKey(this, '${vpnKey.replace(/'/g, "\\'")}')">Копировать</button>
                </div>
                <p style="font-size:0.78rem;color:var(--stone);margin-top:8px">Используйте этот ключ в приложении Incy для подключения к защищённому серверу</p>
            </div>
            <div class="sub-details-grid" style="margin-top:16px">
                <div class="sub-detail-item">
                    <div class="sub-detail-label">Лимит устройств</div>
                    <div class="sub-detail-value">${sub.devices_limit || sub.devicesLimit || 2} устройства</div>
                </div>
                <div class="sub-detail-item">
                    <div class="sub-detail-label">Дата активации</div>
                    <div class="sub-detail-value">${formatDate(startDate)}</div>
                </div>
            </div>`;
        return html;
    }

    function renderSubHistory(subs) {
        let html = '<div class="payments-table-wrap"><table class="payments-table"><thead><tr>';
        html += '<th>Тариф</th><th>Статус</th><th>Начало</th><th>Окончание</th><th>Устройств</th>';
        html += '</tr></thead><tbody>';

        subs.forEach(sub => {
            const startDate = parseDate(sub.start_date || sub.startDate);
            const endDate = parseDate(sub.end_date || sub.endDate);
            const statusClass = sub.status === 'active' ? 'completed' : (sub.status === 'expired' ? 'failed' : 'pending');
            const statusLabel = sub.status === 'active' ? 'Активна' : (sub.status === 'expired' ? 'Истекла' : 'Отменена');

            html += `<tr>
                <td><strong style="color:var(--parch)">${sub.plan_label || sub.planLabel || sub.plan}</strong></td>
                <td><span class="payment-status ${statusClass}">${statusLabel}</span></td>
                <td>${formatDate(startDate)}</td>
                <td>${formatDate(endDate)}</td>
                <td>${sub.devices_limit || 2}</td>
            </tr>`;
        });

        html += '</tbody></table></div>';
        return html;
    }

    function renderPaymentsTable(payments) {
        let html = '<div class="payments-table-wrap"><table class="payments-table"><thead><tr>';
        html += '<th>Дата</th><th>Описание</th><th>Метод</th><th>Сумма</th><th>Статус</th>';
        html += '</tr></thead><tbody>';

        payments.forEach(pay => {
            const date = parseDate(pay.created_at || pay.createdAt);
            const statusClass = pay.status === 'completed' ? 'completed' : (pay.status === 'pending' ? 'pending' : 'failed');
            const statusLabel = {
                completed: 'Оплачен',
                pending: 'В обработке',
                failed: 'Ошибка',
                refunded: 'Возврат'
            }[pay.status] || pay.status;

            const methodIcons = {
                'СБП': '🏦',
                'Т-Пэй': '💳',
                'Крипта': '₿',
                'Telegram': '✈️'
            };

            html += `<tr>
                <td>${formatDate(date)}</td>
                <td>${pay.description || 'Оплата тарифа'}</td>
                <td><span class="payment-method-badge">${methodIcons[pay.method] || '💳'} ${pay.method || '—'}</span></td>
                <td><span class="payment-amount">${pay.amount || 0} ₽</span></td>
                <td><span class="payment-status ${statusClass}">${statusLabel}</span></td>
            </tr>`;
        });

        html += '</tbody></table></div>';
        return html;
    }

    // ===== UTILITY FUNCTIONS =====

    function parseDate(val) {
        if (!val) return null;
        if (typeof val === 'object' && typeof val.toDate === 'function') return val.toDate();
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }

    function formatDate(date) {
        if (!date) return '—';
        const d = parseDate(date);
        if (!d) return '—';
        return d.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    function adjustColor(hex, amount) {
        let color = String(hex || '#B87333').replace('#', '');
        if (color.length === 3) color = color.split('').map(c => c + c).join('');
        const num = parseInt(color, 16);
        let r = Math.min(255, Math.max(0, (num >> 16) + amount));
        let g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
        let b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
        return '#' + (r << 16 | g << 8 | b).toString(16).padStart(6, '0');
    }

    // ===== COPY VPN KEY =====
    window.copyVpnKey = function(btn, key) {
        if (!key) return;
        navigator.clipboard.writeText(key).then(() => {
            btn.textContent = '✓ Скопировано';
            btn.classList.add('copied');
            setTimeout(() => {
                btn.textContent = 'Копировать';
                btn.classList.remove('copied');
            }, 2500);
        }).catch(() => {
            const textArea = document.createElement('textarea');
            textArea.value = key;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            btn.textContent = '✓ Скопировано';
            btn.classList.add('copied');
            setTimeout(() => {
                btn.textContent = 'Копировать';
                btn.classList.remove('copied');
            }, 2500);
        });
    };

});
