import os

# Telegram Bot Token
BOT_TOKEN = os.getenv("BOT_TOKEN", "8937409444:AAG7HZ9xIuq0HRS9eXip9XLRfw_QX0rUzzs")

# Названия и настройки тарифов
TARIFFS = {
    "scout": {
        "name": "🗡️ Разведчик",
        "duration_days": 30,
        "price_rub": 149,
        "desc": "1 месяц | До 10 Гбит/с | 3 устройства | VLESS + Reality"
    },
    "guardian": {
        "name": "🏰 Страж Аркаима",
        "duration_days": 180,
        "price_rub": 690,
        "desc": "6 месяцев | До 10 Гбит/с | 5 устройств | Экономия 25%"
    },
    "chief": {
        "name": "👑 Вождь",
        "duration_days": 365,
        "price_rub": 1190,
        "desc": "12 месяцев | До 10 Гбит/с | 10 устройств | Выгода 35%"
    }
}

# Поддержка и домен
SUPPORT_USERNAME = "@arkaim_support"
VPN_DOMAIN = "node1.arkaim-vpn.net"
