import os
from datetime import datetime
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, FSInputFile
from aiogram.filters import CommandStart, Command

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
        f"🏰 <b>Добро пожаловать в АРКАИМ VPN, {full_name}!</b>\n\n"
        f"Непробиваемая цифровая крепость вашей свободы.\n"
        f"• Скорость до 10 Гбит/с\n"
        f"• Протоколы VLESS + Reality (обход всех видов блокировок)\n"
        f"• Полная анонимность без ведения логов\n\n"
        f"Используйте меню ниже для выбора тарифа или получения ключа:"
    )

    media_photo_path = os.path.join(os.path.dirname(__file__), "..", "аркаим.jpg")
    if os.path.exists(media_photo_path):
        try:
            photo = FSInputFile(media_photo_path)
            await message.answer_photo(photo=photo, caption=welcome_text, reply_markup=main_menu_keyboard(), parse_mode="HTML")
            return
        except Exception as e:
            print(f"Photo error: {e}")

    await message.answer(welcome_text, reply_markup=main_menu_keyboard(), parse_mode="HTML")

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
        status_str = f"✅ <b>АКТИВЕН</b> (До: <code>{sub_expires}</code>)"
        key_block = (
            f"🔑 <b>Ваш VLESS ключ доступа:</b>\n"
            f"<code>{vless_key}</code>\n\n"
            f"<i>Нажмите на текст ключа выше, чтобы скопировать его в буфер обмена.</i>"
        )
    else:
        status_str = "❌ <b>Не активен</b>"
        key_block = "У вас пока нет активной подписки. Нажмите <b>«💳 Купить VPN / Продлить»</b> для подключения."

    profile_text = (
        f"👤 <b>Профиль пользователя:</b> <code>{user_id}</code>\n"
        f"Статус защиты: {status_str}\n\n"
        f"{key_block}"
    )

    await message.answer(profile_text, parse_mode="HTML")

@router.message(F.text == "💳 Купить VPN / Продлить")
async def buy_handler(message: Message):
    text = (
        "👑 <b>Выберите подходящий тариф крепости АРКАИМ:</b>\n\n"
        "🗡️ <b>Разведчик (1 мес)</b> — 149 ₽\n"
        "• 3 устройства | Скорость до 10 Гбит/с\n\n"
        "🏰 <b>Страж Аркаима (6 мес)</b> — 690 ₽ <i>(Скидка 25%)</i>\n"
        "• 5 устройств | Приоритетная поддержка\n\n"
        "👑 <b>Вождь (12 мес)</b> — 1 190 ₽ <i>(Выгода 35%)</i>\n"
        "• 10 устройств | Максимальный приоритет сети\n"
    )
    await message.answer(text, reply_markup=tariffs_keyboard(), parse_mode="HTML")

@router.callback_query(F.data.startswith("buy_"))
async def callback_select_tariff(callback: CallbackQuery):
    plan_code = callback.data.split("_")[1]
    info = TARIFFS.get(plan_code)
    if not info:
        await callback.answer("Тариф не найден.", show_alert=True)
        return

    pay_id = await db.create_payment(callback.from_user.id, plan_code, info["price_rub"])

    text = (
        f"💳 <b>Оформление подписки:</b> {info['name']}\n"
        f"Сумма к оплате: <b>{info['price_rub']} ₽</b>\n\n"
        f"ID заказа: <code>{pay_id}</code>\n"
        f"Выберите удобный способ оплаты ниже:"
    )

    await callback.message.edit_text(text, reply_markup=payment_methods_keyboard(pay_id), parse_mode="HTML")

@router.callback_query(F.data.startswith("pay_"))
async def callback_payment_method(callback: CallbackQuery):
    data = callback.data
    if data.startswith("confirm_pay_"):
        pay_id = data.split("_")[2]
        user_id = callback.from_user.id
        
        duration = 30
        expiry_str, key = await db.activate_subscription(user_id, duration)

        text = (
            "✅ <b>Оплата прошла успешно!</b>\n\n"
            f"Ваша цифровая крепость активирована до: <code>{expiry_str}</code>\n\n"
            f"🔑 <b>Ваш VLESS ключ доступа:</b>\n"
            f"<code>{key}</code>\n\n"
            "Перейдите в раздел <b>«📲 Инструкции по настройке»</b> для подключения на вашем устройстве."
        )
        await callback.message.edit_text(text, parse_mode="HTML")
        await callback.answer("Платёж подтверждён! Ключ сгенерирован.", show_alert=True)
    else:
        await callback.answer("Для демо нажмите «✅ Проверить и получить ключ»!", show_alert=True)

@router.message(F.text == "📲 Инструкции по настройке")
async def setup_handler(message: Message):
    text = (
        "📲 <b>Выберите операционную систему вашего устройства:</b>\n\n"
        "Мы поддерживаем удобные приложения <b>v2rayNG / Hiddify / Streisand / Shadowrocket</b> с автоматической вставкой ключа в 1 клик."
    )
    await message.answer(text, reply_markup=setup_os_keyboard(), parse_mode="HTML")

@router.callback_query(F.data.startswith("setup_"))
async def callback_setup_os(callback: CallbackQuery):
    os_code = callback.data.split("_")[1]
    
    guides = {
        "ios": (
            "🍏 <b>Инструкция для iOS (iPhone / iPad):</b>\n\n"
            "1. Установите бесплатное приложение <b>Hiddify</b> или <b>Streisand</b> из App Store.\n"
            "2. Скопируйте ваш VLESS ключ из раздела «Мой профиль».\n"
            "3. Откройте приложение и нажмите <b>«Импортировать из буфера» (+)</b>.\n"
            "4. Включите переключатель защиты. Готово!"
        ),
        "android": (
            "🤖 <b>Инструкция для Android:</b>\n\n"
            "1. Установите приложение <b>v2rayNG</b> или <b>Hiddify</b> из Google Play.\n"
            "2. Скопируйте ваш VLESS ключ из раздела «Мой профиль».\n"
            "3. В v2rayNG нажмите значок <b>«+»</b> вверху ➡️ <b>«Импорт профиля из буфера обмена»</b>.\n"
            "4. Нажмите нижнюю кнопку V2Ray для подключения."
        ),
        "windows": (
            "🪟 <b>Инструкция для Windows:</b>\n\n"
            "1. Скачайте программу <b>v2rayN</b> или <b>Hiddify Desktop</b>.\n"
            "2. Скопируйте ваш VLESS ключ.\n"
            "3. Откройте программу ➡️ нажмите <b>Ctrl+V</b> для вставки ключа.\n"
            "4. Нажмите <b>Connect</b>."
        ),
        "macos": (
            "🍏 <b>Инструкция для macOS:</b>\n\n"
            "1. Установите <b>Hiddify</b> или <b>V2Box</b> из Mac App Store.\n"
            "2. Скопируйте VLESS ключ из бота.\n"
            "3. Импортируйте ключ через клик по иконке в строке меню.\n"
            "4. Активируйте защиту."
        )
    }

    guide_text = guides.get(os_code, "Инструкция в разработке.")
    await callback.message.edit_text(guide_text, reply_markup=back_to_main_inline(), parse_mode="HTML")

@router.callback_query(F.data == "back_main")
async def callback_back_main(callback: CallbackQuery):
    await callback.message.delete()
    await callback.message.answer("Главное меню:", reply_markup=main_menu_keyboard())

@router.message(F.text == "⚡ Статус серверов")
async def status_handler(message: Message):
    text = (
        "⚡ <b>Состояние нод АРКАИМ VPN:</b>\n\n"
        "🟢 <b>Москва, RU</b> — Ping: 12 ms | Загрузка: 18%\n"
        "🟢 <b>Франкфурт, DE</b> — Ping: 38 ms | Загрузка: 24%\n"
        "🟢 <b>Амстердам, NL</b> — Ping: 42 ms | Загрузка: 15%\n"
        "🟢 <b>Хельсинки, FI</b> — Ping: 22 ms | Загрузка: 11%\n\n"
        "📊 <b>Аптайм сети:</b> <code>99.99%</code> | <b>Скорость:</b> <code>До 10 Гбит/с</code>"
    )
    await message.answer(text, parse_mode="HTML")

@router.message(F.text == "❓ FAQ и Поддержка")
async def faq_handler(message: Message):
    text = (
        "❓ <b>Часто задаваемые вопросы:</b>\n\n"
        "Q: <b>Работает ли VPN при блокировках ТСПУ/DPI?</b>\n"
        "A: Да! Мы используем протоколы VLESS + Reality, маскирующие трафик под обычное посещение сайтов.\n\n"
        "Q: <b>Работают ли Сбербанк и Госуслуги?</b>\n"
        "A: Да, в приложении можно настроить белые списки для прямых запросов к банкам.\n\n"
        "Q: <b>Ведутся ли логи?</b>\n"
        "A: Серверы работают в режиме No-Log, записи не ведутся.\n\n"
        f"💬 <b>Служба поддержки:</b> Напишите администратору {SUPPORT_USERNAME}"
    )
    await message.answer(text, parse_mode="HTML")

@router.message()
async def fallback_any_text_handler(message: Message):
    text = (
        "🏰 <b>Главное меню АРКАИМ VPN</b>\n\n"
        "Выберите нужный раздел на клавиатуре снизу:"
    )
    await message.answer(text, reply_markup=main_menu_keyboard(), parse_mode="HTML")
