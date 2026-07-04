import sqlite3
import uuid
import json
import subprocess
import asyncio
import base64
import requests
import urllib.parse

from datetime import datetime, timedelta
from aiogram import Bot, Dispatcher, types
from aiogram.types import (
    ReplyKeyboardMarkup, KeyboardButton,
    InlineKeyboardMarkup, InlineKeyboardButton, InputFile
)
from aiogram.utils import executor

BOT_TOKEN = "8685971935:AAFIhD6_vb3ORwWmc6iK4Pm06pu7UB0x_WI"
ADMIN_ID = 835952531

SERVER_IP = "178.104.102.83"
PUBLIC_KEY = "GbIclUNoFQFXCOsY2OSZZSXMRtIyH4ZYLKOmZ9l4QgE"
SNI = "www.cloudflare.com"
SHORT_ID = "abcd1234"

IBAN = "TR090015700000000143775684"
CARD_HOLDER = "AZIZBEK YULDOSHEV"

PRICES = {1: 99, 3: 199, 6: 399}


bot = Bot(token=BOT_TOKEN)
dp = Dispatcher(bot)

# ================= DB =================
conn = sqlite3.connect("vpn.db")
cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    uuid TEXT,
    expire_date TEXT,
    trial_used INTEGER DEFAULT 0
)
""")

conn.commit()

# ================= XRAY =================
def add_user(uuid_):
    path = "/usr/local/etc/xray/config.json"
    with open(path) as f:
        data = json.load(f)

    clients = data["inbounds"][0]["settings"]["clients"]
    clients.append({"id": uuid_, "flow": "xtls-rprx-vision"})

    with open(path, "w") as f:
        json.dump(data, f, indent=2)

    subprocess.run(["systemctl", "restart", "xray"])


def remove_user(uuid_):
    path = "/usr/local/etc/xray/config.json"
    with open(path) as f:
        data = json.load(f)

    clients = data["inbounds"][0]["settings"]["clients"]
    data["inbounds"][0]["settings"]["clients"] = [
        c for c in clients if c["id"] != uuid_
    ]

    with open(path, "w") as f:
        json.dump(data, f, indent=2)

    subprocess.run(["systemctl", "restart", "xray"])

# ================= LINK =================
def make_vless(uuid_):
    return f"vless://{uuid_}@{SERVER_IP}:8443?type=tcp&security=reality&pbk={PUBLIC_KEY}&sni={SNI}&sid={SHORT_ID}&flow=xtls-rprx-vision&encryption=none#TKM Fastest ⚡"


def make_v2raytun(vless):
    encoded = base64.urlsafe_b64encode(vless.encode()).decode()
    return f"v2raytun://import/{encoded}"


def shorten(url):
    try:
        return requests.get(f"http://tinyurl.com/api-create.php?url={url}", timeout=5).text
    except:
        return url

# ================= UI =================
kb = ReplyKeyboardMarkup(resize_keyboard=True)
kb.add("🚀 Получить VPN")
kb.add("💳 Купить подписку")
kb.add("📅 Моя подписка")

# ================= START =================
@dp.message_handler(commands=['start'])
async def start(msg: types.Message):

    await msg.answer_photo(photo=InputFile("main.png"),caption=
    "Нажмите 'Получить VPN' чтобы получить пробную подписку 👀!",
    parse_mode="HTML", reply_markup=kb)

# ================= BUY =================
@dp.message_handler(lambda m: m.text == "💳 Купить подписку")
async def buy(msg: types.Message):
    kb_plans = InlineKeyboardMarkup(row_width=1)
    kb_plans.add(
            InlineKeyboardButton("1 месяц — 99 TRY", callback_data="plan_1"),
            InlineKeyboardButton("3 месяца — 199 TRY (-33%)", callback_data="plan_3"),
            InlineKeyboardButton("6 месяцев — 399 TRY (-33%)", callback_data="plan_6")
    )
    await msg.answer("📌 Тарифы:", reply_markup=kb_plans)
    return

# ================= GET VPN =================
@dp.message_handler(lambda m: m.text == "🚀 Получить VPN")
async def get_vpn(msg: types.Message):
    user_id = msg.from_user.id

    cursor.execute("SELECT uuid, expire_date, trial_used FROM users WHERE user_id=?", (user_id,))
    user = cursor.fetchone()

    # ================= НЕТ ПОЛЬЗОВАТЕЛЯ =================
    if not user:
        user_uuid = str(uuid.uuid4())
        add_user(user_uuid)

        expire_date = (datetime.now() + timedelta(days=3)).strftime("%d-%m-%Y %H:%M:%S")

        cursor.execute(
            "INSERT INTO users (user_id, uuid, expire_date, trial_used) VALUES (?, ?, ?, ?)",
            (user_id, user_uuid, expire_date, 1)
        )
        conn.commit()

        await msg.answer_photo(
            photo=InputFile("gift.png"),
            caption="🎁 Вам выдан пробный доступ на 3 дня!\nТеперь нажмите 'Получить VPN' ещё раз",
            reply_markup=kb
        )
        return

    user_uuid, expire, trial_used = user

    # ================= ЕСЛИ ПРОСРОЧЕН =================
    if expire == "expired":
        await msg.answer("❌ Пробный период уже использован. Купите подписку.")
        return

    # ================= ПАРС ДАТЫ =================
    try:
        expire_date = datetime.strptime(expire, "%d-%m-%Y %H:%M:%S")
    except:
        expire_date = datetime.strptime(expire, "%d-%m-%Y")

    # ================= ПРОВЕРКА АКТИВНОСТИ =================
    if datetime.now() > expire_date:
        await msg.answer_photo(
            photo=InputFile("nosub.png"),
            caption="❌ Подписка истекла",
            reply_markup=kb
        )
        return

    # ================= ВЫДАЧА VPN =================
    vless = make_vless(user_uuid)

    encoded = base64.b64encode(vless.encode()).decode()
    encoded = urllib.parse.quote(encoded)

    link = f"https://cspn.site/connect?cfg={encoded}"

    kb_vpn = InlineKeyboardMarkup(row_width=1)
    kb_vpn.add(
        InlineKeyboardButton("🚀 Подключить VPN", url=link),
        InlineKeyboardButton("📥 Скачать Android", url="https://play.google.com/store/apps/details?id=com.v2raytun.android"),
        InlineKeyboardButton("📥 Скачать iPhone", url="https://apps.apple.com/us/app/v2raytun/id6476628951")
    )

    await msg.answer(
        "🚀 Подключение VPN:\n\n"
        "Если не открывается ⚠\nУстановите приложение ниже 👇",
        reply_markup=kb_vpn
    )

# ================= BUY_BUTTONS =================
@dp.callback_query_handler(lambda c: c.data.startswith("plan_"))
async def select_plan(call: types.CallbackQuery):
    months = int(call.data.split("_")[1])
    price = PRICES[months]

    await call.answer()  # 🔥 ВАЖНО

    await call.message.answer(f"""
💳 Оплата

Сумма: {price} TRY
Срок: {months} мес

IBAN:
{IBAN}

Получатель:
{CARD_HOLDER}

Enpara

После оплаты отправьте чек 📸
""")

# ================= MY SUBSCRIPTION =================
@dp.message_handler(lambda m: m.text == "📅 Моя подписка")
async def sub(msg: types.Message):
    try:
        user_id = msg.from_user.id

        cursor.execute("SELECT uuid, expire_date, trial_used FROM users WHERE user_id=?", (user_id,))
        user = cursor.fetchone()

        print("SUB USER:", user)

        if not user:
            await msg.answer("❌ У вас нет активной подписки.")
            return

        user_uuid, expire, trial_used = user

        # ❗ КРИТИЧНО: проверка expired
        if expire == "expired" or not expire:
            await msg.answer("❌ Подписка отсутствует")
            return

        # парсим дату
        try:
            expire_date = datetime.strptime(expire, "%d-%m-%Y %H:%M:%S")
        except:
            expire_date = datetime.strptime(expire, "%d-%m-%Y")

        now = datetime.now()

        if now > expire_date:
            await msg.answer_photo(
                photo=InputFile("nosub.png"),
                caption="❌ Подписка истекла",
                reply_markup=kb
            )
            return

        delta = expire_date - now
        days = delta.days
        hours = delta.seconds // 3600

        sub_type = "🎁 Пробный период" if trial_used == 1 else "💎 Подписка"

        await msg.answer_photo(
            photo=InputFile("sub.png"),
            caption=(
                f"{sub_type}\n\n"
                f"⏳ Осталось: {days} дн. {hours} ч.\n"
                f"📅 До: {expire}"
            ),
            reply_markup=kb
        )

    except Exception as e:
        print("SUB ERROR:", e)
        await msg.answer(f"Ошибка: {e}")

# ================= RECEIPT (ANY FILE) =================
@dp.message_handler(content_types=['photo', 'document'])
async def receipt(msg: types.Message):
    # не реагируем на команды и кнопки
    if msg.text and msg.text.startswith("/"):
        return

    user = msg.from_user
    user_id = user.id

    # ссылка на пользователя
    if user.username:
        user_link = f"@{user.username}"
    else:
        user_link = f"<a href='tg://user?id={user.id}'>профиль</a>"

    kb_admin = InlineKeyboardMarkup(row_width=3)
    kb_admin.add(
        InlineKeyboardButton("1 мес", callback_data=f"ok_1_{user_id}"),
        InlineKeyboardButton("3 мес", callback_data=f"ok_3_{user_id}"),
        InlineKeyboardButton("6 мес", callback_data=f"ok_6_{user_id}")
    )
    kb_admin.add(
        InlineKeyboardButton("❌ Неверно", callback_data=f"no_{user_id}")
    )

    try:
        # фото
        if msg.photo:
            await bot.send_photo(
                ADMIN_ID,
                msg.photo[-1].file_id,
                caption=f"Чек от {user_link}",
                reply_markup=kb_admin,
                parse_mode="HTML"
            )

        # документ / файл
        elif msg.document:
            await bot.send_document(
                ADMIN_ID,
                msg.document.file_id,
                caption=f"Чек от {user_link}",
                reply_markup=kb_admin,
                parse_mode="HTML"
            )

        # fallback (если что-то другое)
        else:
            await bot.forward_message(
                ADMIN_ID,
                msg.chat.id,
                msg.message_id
            )
            await bot.send_message(
                ADMIN_ID,
                f"Чек от {user_link}",
                reply_markup=kb_admin,
                parse_mode="HTML"
            )

    except Exception as e:
        print("SEND ERROR:", e)

    await msg.answer("Чек отправлен на проверку ⏳")

# ================= APPROVE =================
@dp.callback_query_handler(lambda c: c.data.startswith("ok_"))
async def approve(call: types.CallbackQuery):
    if call.from_user.id != ADMIN_ID:
        return
    try:
        await call.message.edit_reply_markup(reply_markup=None)
    except:
        return

    _, months, user_id = call.data.split("_")
    user_id = int(user_id)
    months = int(months)

    user_uuid = str(uuid.uuid4())
    add_user(user_uuid)

    expire_date = (datetime.now() + timedelta(days=30*months)).strftime("%d-%m-%Y")

    user = await bot.get_chat(user_id)
    cursor.execute(
        "INSERT OR REPLACE INTO users (user_id, uuid, expire_date, trial_used, username, full_name) VALUES (?, ?, ?, ?, ?, ?)",
        (
            user_id,
            user_uuid,
            expire_date,
            0,
            user.username,
            user.full_name
        )
    )
    conn.commit()

    await bot.send_message(user_id, "✅ Оплата подтверждена!\nТеперь нажмите 'Получить VPN'")
    await call.answer("OK")


# ================= DECLINE =================
@dp.callback_query_handler(lambda c: c.data.startswith("no_"))
async def decline(call: types.CallbackQuery):
    if call.from_user.id != ADMIN_ID:
        return

    await call.answer("Отклонено")  # чтобы Telegram не висел

    user_id = int(call.data.split("_")[1])

    # удаляем кнопки
    try:
        await call.message.edit_reply_markup(reply_markup=None)
    except:
        pass

    # сообщение клиенту
    try:
        await bot.send_message(
            user_id,
            "❌ Платеж не принят\nПроверьте перевод и попробуйте снова"
        )
    except:
        pass

# ================= EXPIRE CHECK =================
async def check_expire():
    while True:
        cursor.execute("SELECT user_id, uuid, expire_date, trial_used FROM users")
        users = cursor.fetchall()

        for user_id, uuid_, expire, trial_used in users:
            if expire == "expired":
                continue

            try:
                expire_date = datetime.strptime(expire, "%d-%m-%Y %H:%M:%S")
            except:
                expire_date = datetime.strptime(expire, "%d-%m-%Y")

            if datetime.now() > expire_date:
                remove_user(uuid_)

                # ❗ НЕ УДАЛЯЕМ, а помечаем
                cursor.execute(
                    "UPDATE users SET expire_date=?, uuid=? WHERE user_id=?",
                    ("expired", None, user_id)
                )
                conn.commit()

                try:
                    await bot.send_message(user_id, "❌ Подписка истекла")
                except:
                    pass

        await asyncio.sleep(60)

# ================= USERS COUNT =================
@dp.message_handler(commands=['us'])
async def users_count(msg: types.Message):
    if msg.from_user.id != ADMIN_ID:
        return

    cursor.execute("SELECT uuid, expire_date FROM users")
    users = cursor.fetchall()

    total = len(users)
    active = 0
    expired = 0
    soon = 0
    test = 0

    now = datetime.now()

    for _, expire in users:
        try:
            expire_date = datetime.strptime(expire, "%d-%m-%Y %H:%M:%S")
            is_test = True
        except:
            expire_date = datetime.strptime(expire, "%d-%m-%Y")
            is_test = False

        if now > expire_date:
            expired += 1
        else:
            active += 1

            # скоро истекает (24 часа)
            if (expire_date - now).total_seconds() < 86400:
                soon += 1

            if is_test:
                test += 1

    await msg.answer(
        f"""
📊 Статистика VPN:

👥 Всего: {total}
🟢 Активные: {active}
🔴 Истекшие: {expired}
⏳ Скоро истекут (<24ч): {soon}
🧪 Тестовые: {test}
"""
    )

# ================= USER IDS =================
@dp.message_handler(commands=['list'])
async def list_users(msg: types.Message):
    if msg.from_user.id != ADMIN_ID:
        return

    cursor.execute("SELECT user_id, uuid, expire_date, username, full_name FROM users")
    users = cursor.fetchall()

    if not users:
        await msg.answer("Нет пользователей")
        return

    text = "👥 Пользователи:\n\n"

    for user_id, uuid_, expire, username, full_name in users:

        if not username or not full_name:
            try:
                user = await bot.get_chat(user_id)
                username = user.username
                full_name = user.full_name

                # сохраняем обратно в БД
                cursor.execute(
                    "UPDATE users SET username=?, full_name=? WHERE user_id=?",
                    (username, full_name, user_id)
                )
                conn.commit()

            except:
                username = username or "no_username"
                full_name = full_name or "no_name"

        text += f"""👤 {full_name} (@{username})
    🆔 {user_id}
    🔑 {uuid_}
    📅 {expire}

    """

    await msg.answer(text)

# ================= REMOVE CLIENT =================
@dp.message_handler(commands=['del'])
async def delete_user_cmd(msg: types.Message):
    if msg.from_user.id != ADMIN_ID:
        return

    try:
        args = msg.text.split()

        if len(args) != 2:
            await msg.answer("Использование:\n/del UUID")
            return

        uuid_ = args[1]

        # удаляем из xray
        remove_user(uuid_)

        # удаляем из базы
        cursor.execute("DELETE FROM users WHERE uuid=?", (uuid_,))
        conn.commit()

        await msg.answer(f"✅ Пользователь удалён:\n{uuid_}")

    except Exception as e:
        await msg.answer(f"Ошибка: {e}")

# ================= RUN =================
async def on_startup(dp):
    asyncio.create_task(check_expire())

if __name__ == "__main__":
    executor.start_polling(dp, on_startup=on_startup)
