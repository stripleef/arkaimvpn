import asyncio
import logging
import os
import sys
from aiogram import Bot, Dispatcher
from aiogram.client.session.aiohttp import AiohttpSession

from config import BOT_TOKEN
from database import init_db
from handlers import router

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

async def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
        stream=sys.stdout
    )

    await init_db()

    # Поддержка прокси при необходимости (TELEGRAM_PROXY или HTTPS_PROXY)
    proxy = os.getenv("TELEGRAM_PROXY") or os.getenv("HTTPS_PROXY") or os.getenv("HTTP_PROXY")
    session = AiohttpSession(proxy=proxy) if proxy else None

    bot = Bot(token=BOT_TOKEN, session=session) if session else Bot(token=BOT_TOKEN)
    dp = Dispatcher()
    dp.include_router(router)

    print("🚀 Бот АРКАИМ VPN запущен!")
    
    while True:
        try:
            await dp.start_polling(bot)
        except Exception as e:
            print(f"Подключение к Telegram API ({e}). Повторная попытка через 5 сек...")
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(main())
