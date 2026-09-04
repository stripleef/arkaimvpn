from aiogram.types import ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardMarkup, InlineKeyboardButton
from config import TARIFFS

# Главное меню (Reply Keyboard)
def main_menu_keyboard():
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="🛡️ Мой профиль / Ключ"), KeyboardButton(text="💳 Купить VPN / Продлить")],
            [KeyboardButton(text="📲 Инструкции по настройке"), KeyboardButton(text="⚡ Статус серверов")],
            [KeyboardButton(text="❓ FAQ и Поддержка")]
        ],
        resize_keyboard=True
    )

# Клавиатура выбора тарифа
def tariffs_keyboard():
    buttons = []
    for code, info in TARIFFS.items():
        buttons.append([
            InlineKeyboardButton(
                text=f"{info['name']} — {info['price_rub']} ₽",
                callback_data=f"buy_{code}"
            )
        ])
    return InlineKeyboardMarkup(inline_keyboard=buttons)

# Клавиатура выбора метода оплаты
def payment_methods_keyboard(pay_id: str):
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="🏦 СБП (Быстрый платёж)", callback_data=f"pay_sbp_{pay_id}"),
                InlineKeyboardButton(text="💳 Т-Пэй / Карта", callback_data=f"pay_card_{pay_id}")
            ],
            [
                InlineKeyboardButton(text="₿ Криптовалюта (USDT)", callback_data=f"pay_crypto_{pay_id}"),
                InlineKeyboardButton(text="✈️ Telegram Stars", callback_data=f"pay_stars_{pay_id}")
            ],
            [
                InlineKeyboardButton(text="✅ Проверить и получить ключ", callback_data=f"confirm_pay_{pay_id}")
            ]
        ]
    )

# Клавиатура выбора ОС для инструкций
def setup_os_keyboard():
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="🍏 iOS / iPhone", callback_data="setup_ios"),
                InlineKeyboardButton(text="🤖 Android", callback_data="setup_android")
            ],
            [
                InlineKeyboardButton(text="🪟 Windows", callback_data="setup_windows"),
                InlineKeyboardButton(text="🍏 macOS", callback_data="setup_macos")
            ]
        ]
    )

# Кнопка скопировать / назад
def back_to_main_inline():
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="« Вернуться в главное меню", callback_data="back_main")]
        ]
    )
