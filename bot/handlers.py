from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.filters import CommandStart, Command
from datetime import datetime

import database as db
from config import TARIFFS, SUPPORT_USERNAME
from keyboards import (
    main_menu_keyboard,
    tariffs_keyboard,
    payment_methods_keyboard,
    setup_os_keyboard,
    back_to_main_inline
)

router = Router()

@router.message(CommandStart())
async def cmd_start(message: Message):
    user_id = message.from_user.id
    username = message.from_user.username or ""
    full_name = message.from_user.full_name or "Путешественник"

    await db.register_user(user_id, username, full_name)

    welcome_text = (
        f"🏰 **Добро пожаловать в АРКАИМ VPN, {full_name}!**\n\n"
        f"Непробиваемая цифровая крепость вашей свободы.\n"
        f"• Скорость до 10 Гбит/с\n"
        f"• Протоколы VLESS + Reality (обход любых блокировок ТСПУ)\n"
        f"• Полная анонимность No-Log\n\n"
        f"Используйте меню ниже для выбора тарифа или проверки ключа:"
    )

    await message.answer(welcome_text, reply_markup=main_menu_keyboard(), parse_mode="Markdown")

@router.message(F.text == "🛡️ Мой профиль / Ключ")
async def profile_handler(message: Message):
    user_id = message.from_user.id
    user = await db.get_user(user_id)

    if not user:
        await message.answer("Пользователь не найден. Введите /start.")
        return

    now = datetime.now()
    sub_expires = user["sub_expires_at"]
    vless_key = user["vless_key"]

    is_active = False
    if sub_expires:
        try:
            exp_date = datetime.strptime(sub_expires, "%Y-%m-%d %H:%M:%S")
            if exp_date > now:
                is_active = True
        except ValueError:
            pass

    if is_active and vless_key:
        status_str = f"✅ **АКТИВЕН** (До: `{sub_expires}`)"
        key_block = (
            f"🔑 **Ваш VLESS ключ доступа:**\n"
            f"```\n{vless_key}\n```\n"
            f"_Нажмите на текст ключа выше, чтобы скопировать в буфер обмена._"
        )
    else:
        status_str = "❌ **Не активен**"
        key_block = "У вас пока нет активной подписки. Нажмите **«💳 Купить VPN / Продлить»** для подключения."

    profile_text = (
        f"👤 **Профиль пользователя:** `{user_id}`\n"
        f"Статус защиты: {status_str}\n\n"
        f"{key_block}"
    )

    await message.answer(profile_text, parse_mode="Markdown")

@router.message(F.text == "💳 Купить VPN / Продлить")
async def buy_handler(message: Message):
    text = (
        "👑 **Выберите подходящий тариф крепости АРКАИМ:**\n\n"
        "🗡️ **Разведчик (1 мес)** — 149 ₽\n"
        "• 3 устройства | Скорость до 10 Гбит/с\n\n"
        "🏰 **Страж Аркаима (6 мес)** — 690 ₽ *(Скидка 25%)*\n"
        "• 5 устройств | Приоритетная поддержка\n\n"
        "👑 **Вождь (12 мес)** — 1 190 ₽ *(Выгода 35%)*\n"
        "• 10 устройств | Максимальный приоритет сети\n"
    )
    await message.answer(text, reply_markup=tariffs_keyboard(), parse_mode="Markdown")

@router.callback_query(F.data.startswith("buy_"))
async def callback_select_tariff(callback: CallbackQuery):
    plan_code = callback.data.split("_")[1]
    info = TARIFFS.get(plan_code)
    if not info:
        await callback.answer("Тариф не найден.", show_alert=True)
        return

    pay_id = await db.create_payment(callback.from_user.id, plan_code, info["price_rub"])

    text = (
        f"💳 **Оформление подписки:** {info['name']}\n"
        f"Сумма к оплате: **{info['price_rub']} ₽**\n\n"
        f"ID заказа: `{pay_id}`\n"
        f"Выберите удобный способ оплаты ниже:"
    )

    await callback.message.edit_text(text, reply_markup=payment_methods_keyboard(pay_id), parse_mode="Markdown")

@router.callback_query(F.data.startswith("pay_"))
async def callback_payment_method(callback: CallbackQuery):
    data = callback.data
    if data.startswith("confirm_pay_"):
        pay_id = data.split("_")[2]
        # Simulate successful payment activation
        user_id = callback.from_user.id
        
        # Get payment plan (default 30 days if scout)
        duration = 30
        expiry_str, key = await db.activate_subscription(user_id, duration)

        text = (
            "✅ **Оплата прошла успешно!**\n\n"
            f"Ваша цифровая крепость активирована до: `{expiry_str}`\n\n"
            f"🔑 **Ваш VLESS ключ доступа:**\n"
            f"```\n{key}\n```\n"
            "Перейдите в раздел **«📲 Инструкции по настройке»** для подключения на вашем устройстве."
        )
        await callback.message.edit_text(text, parse_mode="Markdown")
        await callback.answer("Платёж подтверждён! Ключ сгенерирован.", show_alert=True)
    else:
        await callback.answer("Для демо нажмите «✅ Проверить и получить ключ»!", show_alert=True)

@router.message(F.text == "📲 Инструкции по настройке")
async def setup_handler(message: Message):
    text = (
        "📲 **Выберите операционную систему вашего устройства:**\n\n"
        "Мы поддерживаем удобные приложения **v2rayNG / Hiddify / Streisand / Shadowrocket** с автоматической вставкой ключа в 1 клик."
    )
    await message.answer(text, reply_markup=setup_os_keyboard(), parse_mode="Markdown")

@router.callback_query(F.data.startswith("setup_"))
async def callback_setup_os(callback: CallbackQuery):
    os_code = callback.data.split("_")[1]
    
    guides = {
        "ios": (
            "🍏 **Инструкция для iOS (iPhone / iPad):**\n\n"
            "1. Установите бесплатное приложение **Hiddify** или **Streisand** из App Store.\n"
            "2. Скопируйте ваш VLESS ключ из раздела «Мой профиль».\n"
            "3. Откройте приложение и нажмите **«Импортировать из буфера» (+)**.\n"
            "4. Включите переключатель защиты. Готово!"
        ),
        "android": (
            "🤖 **Инструкция для Android:**\n\n"
            "1. Установите приложение **v2rayNG** или **Hiddify** из Google Play.\n"
            "2. Скопируйте ваш VLESS ключ из раздела «Мой профиль».\n"
            "3. В v2rayNG нажмите значок **«+»** вверху $\rightarrow$ **«Импорт профиля из буфера обмена»**.\n"
            "4. Нажмите нижнюю кнопку V2Ray для подключения."
        ),
        "windows": (
            "🪟 **Инструкция для Windows:**\n\n"
            "1. Скачайте программу **v2rayN** или **Hiddify Desktop**.\n"
            "2. Скопируйте ваш VLESS ключ.\n"
            "3. Откройте программу $\rightarrow$ нажмите **Ctrl+V** для вставки ключа.\n"
            "4. Нажмите **Connect**."
        ),
        "macos": (
            "🍏 **Инструкция для macOS:**\n\n"
            "1. Установите **Hiddify** или **V2Box** из Mac App Store.\n"
            "2. Скопируйте VLESS ключ из бота.\n"
            "3. Импортируйте ключ через клик по иконке в строке меню.\n"
            "4. Активируйте защиту."
        )
    }

    guide_text = guides.get(os_code, "Инструкция в разработке.")
    await callback.message.edit_text(guide_text, reply_markup=back_to_main_inline(), parse_mode="Markdown")

@router.callback_query(F.data == "back_main")
async def callback_back_main(callback: CallbackQuery):
    await callback.message.delete()
    await callback.message.answer("Главное меню:", reply_markup=main_menu_keyboard())

@router.message(F.text == "⚡ Статус серверов")
async def status_handler(message: Message):
    text = (
        "⚡ **Состояние нод АРКАИМ VPN:**\n\n"
        "🟢 **Москва, RU** — Ping: 12 ms | Загрузка: 18%\n"
        "🟢 **Франкфурт, DE** — Ping: 38 ms | Загрузка: 24%\n"
        "🟢 **Амстердам, NL** — Ping: 42 ms | Загрузка: 15%\n"
        "🟢 **Хельсинки, FI** — Ping: 22 ms | Загрузка: 11%\n\n"
        "📊 **Аптайм сети:** `99.99%` | **Скорость:** `До 10 Гбит/с`"
    )
    await message.answer(text, parse_mode="Markdown")

@router.message(F.text == "❓ FAQ и Поддержка")
async def faq_handler(message: Message):
    text = (
        "❓ **Часто задаваемые вопросы:**\n\n"
        "Q: **Работает ли VPN при блокировках ТСПУ/DPI?**\n"
        "A: Да! Мы используем протоколы VLESS + Reality, маскирующие трафик под обычное посещение сайтов.\n\n"
        "Q: **Работают ли Сбербанк и Госуслуги?**\n"
        "A: Да, в приложении можно настроить белые списки для прямых запросов к банкам.\n\n"
        "Q: **Нужны ли логи?**\n"
        "A: Серверы работают в режиме No-Log, записи не ведутся.\n\n"
        "💬 **Служба поддержки:** Напишите администратору " + SUPPORT_USERNAME
    )
    await message.answer(text, parse_mode="Markdown")
