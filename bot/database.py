import aiosqlite
import os
import uuid
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), "arkaim_vpn.db")

async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY,
                username TEXT,
                full_name TEXT,
                registered_at TEXT,
                sub_expires_at TEXT,
                vless_key TEXT
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS payments (
                payment_id TEXT PRIMARY KEY,
                user_id INTEGER,
                plan_code TEXT,
                amount INTEGER,
                status TEXT,
                created_at TEXT
            )
        """)
        await db.commit()

async def get_user(user_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM users WHERE user_id = ?", (user_id,)) as cursor:
            return await cursor.fetchone()

async def register_user(user_id: int, username: str, full_name: str):
    async with aiosqlite.connect(DB_PATH) as db:
        existing = await get_user(user_id)
        if not existing:
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            await db.execute(
                "INSERT INTO users (user_id, username, full_name, registered_at) VALUES (?, ?, ?, ?)",
                (user_id, username, full_name, now_str)
            )
            await db.commit()

async def create_payment(user_id: int, plan_code: str, amount: int):
    pay_id = str(uuid.uuid4())[:8].upper()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO payments (payment_id, user_id, plan_code, amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (pay_id, user_id, plan_code, amount, "pending", now_str)
        )
        await db.commit()
    return pay_id

async def activate_subscription(user_id: int, duration_days: int):
    user = await get_user(user_id)
    now = datetime.now()
    
    current_expiry = None
    if user and user["sub_expires_at"]:
        try:
            current_expiry = datetime.strptime(user["sub_expires_at"], "%Y-%m-%d %H:%M:%S")
        except ValueError:
            pass

    if current_expiry and current_expiry > now:
        new_expiry = current_expiry + timedelta(days=duration_days)
    else:
        new_expiry = now + timedelta(days=duration_days)
        
    expiry_str = new_expiry.strftime("%Y-%m-%d %H:%M:%S")
    
    # Generate VLESS key if user doesn't have one
    user_key = user["vless_key"] if user and user["vless_key"] else None
    if not user_key:
        random_hash = str(uuid.uuid4()).replace("-", "")[:12]
        user_key = f"vless://{random_hash}@node1.arkaim-vpn.net:443?security=reality&type=grpc&sni=gateway.arkaim.ru#АРКАИМ_VPN_Ключ"

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE users SET sub_expires_at = ?, vless_key = ? WHERE user_id = ?",
            (expiry_str, user_key, user_id)
        )
        await db.commit()

    return expiry_str, user_key
