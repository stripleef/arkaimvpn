document.addEventListener('DOMContentLoaded', () => {
    // ===== 1. STARFIELD SYSTEM (Flying & Twinkling Stars) =====
    const pCanvas = document.getElementById('particles');
    if (pCanvas) {
        const pCtx = pCanvas.getContext('2d');
        let stars = [];
        let shootingStars = [];

        function resizeParticles() {
            pCanvas.width = window.innerWidth;
            pCanvas.height = window.innerHeight;
        }
        resizeParticles();
        window.addEventListener('resize', resizeParticles);

        class Star {
            constructor() { this.reset(); }
            reset() {
                this.x = Math.random() * pCanvas.width;
                this.y = Math.random() * pCanvas.height;
                this.size = Math.random() * 1.2 + 0.8; // Perfect balanced medium size (0.8px - 2.0px)
                this.speedX = (Math.random() - 0.5) * 0.3;
                this.speedY = (Math.random() - 0.5) * 0.18 - 0.05;
                this.alpha = Math.random() * 0.35 + 0.15; // Soft non-distracting opacity
                this.maxAlpha = Math.random() * 0.3 + 0.35;
                this.minAlpha = 0.12;
                this.twinkleSpeed = Math.random() * 0.01 + 0.004;
                this.twinkleDir = Math.random() > 0.5 ? 1 : -1;
                
                // Elegant warm gold, amber, and parchment tones
                const colors = ['#F0E6CC', '#E8B45A', '#C9A84C', '#D4934A', '#FFF8E7'];
                this.color = colors[Math.floor(Math.random() * colors.length)];
                this.isFourPoint = Math.random() > 0.35;
            }
            update() {
                this.x += this.speedX;
                this.y += this.speedY;

                this.alpha += this.twinkleSpeed * this.twinkleDir;
                if (this.alpha >= this.maxAlpha) {
                    this.alpha = this.maxAlpha;
                    this.twinkleDir = -1;
                } else if (this.alpha <= this.minAlpha) {
                    this.alpha = this.minAlpha;
                    this.twinkleDir = 1;
                }

                if (this.x < -12) this.x = pCanvas.width + 12;
                if (this.x > pCanvas.width + 12) this.x = -12;
                if (this.y < -12) this.y = pCanvas.height + 12;
                if (this.y > pCanvas.height + 12) this.y = -12;
            }
            draw() {
                pCtx.save();
                pCtx.translate(this.x, this.y);

                // Subtle soft halo
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

        class ShootingStar {
            constructor() { this.reset(); }
            reset() {
                this.x = Math.random() * pCanvas.width * 1.2 - pCanvas.width * 0.1;
                this.y = Math.random() * pCanvas.height * 0.4;
                this.length = Math.random() * 70 + 45;
                this.speed = Math.random() * 7 + 4;
                this.angle = Math.PI / 4 + (Math.random() - 0.5) * 0.2;
                this.alpha = 0.55;
                this.active = false;
                this.timer = Math.random() * 400 + 120;
            }
            update() {
                if (!this.active) {
                    this.timer--;
                    if (this.timer <= 0) {
                        this.active = true;
                    }
                    return;
                }
                this.x += Math.cos(this.angle) * this.speed;
                this.y += Math.sin(this.angle) * this.speed;
                this.alpha -= 0.01;

                if (this.alpha <= 0 || this.x > pCanvas.width || this.y > pCanvas.height) {
                    this.reset();
                }
            }
            draw() {
                if (!this.active || this.alpha <= 0) return;
                pCtx.save();
                pCtx.globalAlpha = this.alpha;

                const tailX = this.x - Math.cos(this.angle) * this.length;
                const tailY = this.y - Math.sin(this.angle) * this.length;

                const grad = pCtx.createLinearGradient(this.x, this.y, tailX, tailY);
                grad.addColorStop(0, '#FFF8E7');
                grad.addColorStop(0.35, '#E8B45A');
                grad.addColorStop(1, 'transparent');

                pCtx.strokeStyle = grad;
                pCtx.lineWidth = 1.2;
                pCtx.beginPath();
                pCtx.moveTo(this.x, this.y);
                pCtx.lineTo(tailX, tailY);
                pCtx.stroke();

                pCtx.restore();
            }
        }

        for (let i = 0; i < 100; i++) stars.push(new Star());
        for (let i = 0; i < 3; i++) shootingStars.push(new ShootingStar());

        function animateParticles() {
            pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
            stars.forEach(s => { s.update(); s.draw(); });
            shootingStars.forEach(ss => { ss.update(); ss.draw(); });
            requestAnimationFrame(animateParticles);
        }
        animateParticles();
    }

    // ===== 2. ULTRA-SMOOTH LERP MAGNETIC BUTTONS =====
    document.querySelectorAll('.magnetic').forEach(btn => {
        let currentX = 0, currentY = 0;
        let targetX = 0, targetY = 0;
        let isHovered = false;

        function updateMagnetic() {
            currentX += (targetX - currentX) * 0.1;
            currentY += (targetY - currentY) * 0.1;
            btn.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;

            if (isHovered || Math.abs(currentX) > 0.08 || Math.abs(currentY) > 0.08) {
                requestAnimationFrame(updateMagnetic);
            } else {
                btn.style.transform = 'translate3d(0, 0, 0)';
            }
        }

        btn.addEventListener('mousemove', e => {
            const rect = btn.getBoundingClientRect();
            targetX = (e.clientX - rect.left - rect.width / 2) * 0.22;
            targetY = (e.clientY - rect.top - rect.height / 2) * 0.22;
            if (!isHovered) {
                isHovered = true;
                requestAnimationFrame(updateMagnetic);
            }
        });

        btn.addEventListener('mouseleave', () => {
            targetX = 0;
            targetY = 0;
            isHovered = false;
        });
    });

    // ===== 3. TYPING EFFECT =====
    const typedEl = document.getElementById('typed-text');
    if (typedEl) {
        const phrases = [
            'Непробиваемая защита вашей цифровой свободы.',
            'Скорость до 10 Гбит/с без лагов и задержек.',
            'Обход всех видов блокировок в РФ по протоколам VLESS + Reality.',
            'Входите в древнюю крепость цифрового иммунитета.'
        ];
        let phraseIdx = 0, charIdx = 0, isDeleting = false;

        function typeLoop() {
            const current = phrases[phraseIdx];
            if (!isDeleting) {
                typedEl.textContent = current.substring(0, charIdx + 1);
                charIdx++;
                if (charIdx === current.length) {
                    isDeleting = true;
                    setTimeout(typeLoop, 2200);
                    return;
                }
                setTimeout(typeLoop, 45);
            } else {
                typedEl.textContent = current.substring(0, charIdx - 1);
                charIdx--;
                if (charIdx === 0) {
                    isDeleting = false;
                    phraseIdx = (phraseIdx + 1) % phrases.length;
                    setTimeout(typeLoop, 400);
                    return;
                }
                setTimeout(typeLoop, 25);
            }
        }
        typeLoop();
    }

    // ===== 4. SCROLL REVEAL =====
    const reveals = document.querySelectorAll('.reveal');
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.12 });
    reveals.forEach(el => revealObserver.observe(el));

    // ===== 5. COUNTER ANIMATION =====
    const counters = document.querySelectorAll('.counter');
    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const target = parseInt(el.dataset.target);
                if (el.dataset.counted) return;
                el.dataset.counted = 'true';
                let current = 0;
                const increment = Math.max(1, Math.floor(target / 50));
                const timer = setInterval(() => {
                    current += increment;
                    if (current >= target) {
                        current = target;
                        clearInterval(timer);
                    }
                    el.textContent = target >= 1000 ? (current / 1000).toFixed(current >= target ? 0 : 1) + 'K+' : current;
                }, 30);
            }
        });
    }, { threshold: 0.5 });
    counters.forEach(el => counterObserver.observe(el));

    // ===== 6. FAQ ACCORDION =====
    document.querySelectorAll('.faq-item').forEach(item => {
        const q = item.querySelector('.faq-q');
        if (q) {
            q.addEventListener('click', () => {
                const isActive = item.classList.contains('active');
                document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
                if (!isActive) item.classList.add('active');
            });
        }
    });

    // ===== 7. SETUP TABS =====
    document.querySelectorAll('.stab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.stab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.spane').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            const pane = document.getElementById('p-' + btn.dataset.tab);
            if (pane) pane.classList.add('active');
        });
    });

    // ===== 8. MOBILE NAVIGATION =====
    const burger = document.getElementById('burger');
    const navOverlay = document.getElementById('nav-overlay');
    const navClose = document.getElementById('nav-close');

    if (burger && navOverlay) {
        burger.addEventListener('click', () => {
            navOverlay.classList.add('active');
        });
    }

    if (navClose && navOverlay) {
        navClose.addEventListener('click', () => {
            navOverlay.classList.remove('active');
        });
    }

    window.closeNav = function() {
        if (navOverlay) navOverlay.classList.remove('active');
    };

    // ===== 9. PAYMENT MODAL =====
    const modalOverlay = document.getElementById('modal-overlay');
    const modalClose = document.getElementById('modal-close');
    const modalPlanLabel = document.getElementById('modal-plan-label');
    const mstep1 = document.getElementById('mstep-1');
    const mstep2 = document.getElementById('mstep-2');
    const mstep3 = document.getElementById('mstep-3');
    const payConfirmBtn = document.getElementById('pay-confirm');
    const keyDisplay = document.getElementById('key-display');
    const copyKeyBtn = document.getElementById('copy-key');

    let selectedMethod = 'СБП';

    document.querySelectorAll('.open-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const planName = btn.dataset.plan || 'Доступ к Крепости';
            const price = btn.dataset.price || '149 ₽';
            if (modalPlanLabel) modalPlanLabel.textContent = `Тариф: ${planName} — ${price}`;
            
            if (mstep1) mstep1.classList.add('active');
            if (mstep2) mstep2.classList.remove('active');
            if (mstep3) mstep3.classList.remove('active');
            
            if (modalOverlay) modalOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    });

    function closeModal() {
        if (modalOverlay) modalOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    if (modalClose) modalClose.addEventListener('click', closeModal);
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });
    }

    document.querySelectorAll('.pay-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.pay-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            selectedMethod = item.dataset.method || 'СБП';
        });
    });

    if (payConfirmBtn) {
        payConfirmBtn.addEventListener('click', () => {
            if (mstep1) mstep1.classList.remove('active');
            if (mstep2) mstep2.classList.add('active');

            setTimeout(() => {
                const randomHash = Math.random().toString(36).substring(2, 14);
                const generatedVlessKey = `vless://${randomHash}@node1.arkaim-vpn.net:443?security=reality&type=grpc&sni=gateway.arkaim.ru#АРКАИМ_VPN_Ключ`;
                if (keyDisplay) keyDisplay.textContent = generatedVlessKey;

                if (mstep2) mstep2.classList.remove('active');
                if (mstep3) mstep3.classList.add('active');
            }, 1800);
        });
    }

    if (copyKeyBtn) {
        copyKeyBtn.addEventListener('click', () => {
            if (keyDisplay) {
                const keyText = keyDisplay.textContent;
                navigator.clipboard.writeText(keyText).then(() => {
                    const origText = copyKeyBtn.textContent;
                    copyKeyBtn.textContent = '✓ Ключ скопирован в буфер!';
                    copyKeyBtn.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)';
                    setTimeout(() => {
                        copyKeyBtn.textContent = origText;
                        copyKeyBtn.style.background = '';
                    }, 2500);
                }).catch(() => {
                    alert('Скопируйте ключ вручную: ' + keyText);
                });
            }
        });
    }

    // ===== 10. SMOOTH SCROLL =====
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', e => {
            const href = a.getAttribute('href');
            if (href === '#' || !href) return;
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth' });
                if (navOverlay) navOverlay.classList.remove('active');
            }
        });
    });

    // ===== 11. HEADER SCROLL BACKGROUND =====
    const header = document.getElementById('header');
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 80) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }
});
