import os

# Telegram Bot Token
BOT_TOKEN = os.getenv("BOT_TOKEN", "8937409444:AAG7HZ9xIuq0HRS9eXip9XLRfw_QX0rUzzs")

# Названия и настройки тарифов
TARIFFS = {
    "warrior": {
        "name": "⚔️ ВОИН",
        "duration_days": 30,
        "price_rub": 50,
        "desc": "1 месяц | 2 устройства | 1 сервер | VLESS + Reality"
    },
    "boss": {
        "name": "👑 БОСС",
        "duration_days": 365,
        "price_rub": 500,
        "desc": "1 год | 2 устройства | 1 сервер | Экономия 17%"
    }
}

# Поддержка и домен
SUPPORT_USERNAME = "@arkaim_support"
VPN_DOMAIN = "node1.arkaim-vpn.net"
