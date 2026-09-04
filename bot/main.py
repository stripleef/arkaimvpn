import asyncio
import logging
import sys
from aiogram import Bot, Dispatcher

from config import BOT_TOKEN
from database import init_db
from handlers import router

async def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
        stream=sys.stdout
    )

    if BOT_TOKEN == "YOUR_BOT_TOKEN_HERE" or not BOT_TOKEN:
        print("\n" + "="*70)
        print("⚠️ ВНИМАНИЕ: Не забудьте указать BOT_TOKEN в файле bot/config.py!")
        print("Получите ваш токен бесплатно у бота @BotFather в Telegram.")
        print("="*70 + "\n")

    # Инициализация базы данных
    await init_db()

    bot = Bot(token=BOT_TOKEN)
    dp = Dispatcher()
    dp.include_router(router)

    print("🚀 Бот АРКАИМ VPN готов к запуску!")
    
    try:
        await dp.start_polling(bot)
    except Exception as e:
        print(f"Ошибка запуска бота: {e}")
    finally:
        await bot.session.close()

if __name__ == "__main__":
    asyncio.run(main())
