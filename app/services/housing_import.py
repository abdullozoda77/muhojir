import asyncio
import hashlib
import html
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta

import httpx
from sqlalchemy import select, update

from app.core.files import store_image
from app.db.types import utcnow
from app.models import Housing, HousingPhoto
from app.schemas.common import normalize_phone

CHANNELS = {
    "bezposrednikov_msk": "Москва",
    "arendamsk_mo": "Москва",
    "arenda_piter_spb1": "Санкт-Петербург",
    "bezposrednikov_kzn": "Казань",
    "kazanhome": "Казань",
    "bezposrednikov_novosib": "Новосибирск",
    "arenda_nsk_54": "Новосибирск",
    "ekatarenda": "Екатеринбург",
    "bezposrednikov_krd": "Краснодар",
    "bezposrednikov_samara": "Самара",
    "bezposrednikov_nn": "Нижний Новгород",
    "bezposrednikov_rnd": "Ростов-на-Дону",
}

PHOTOS = "housing"
FRESH_DAYS = 21
KEEP_DAYS = 30
PAGES = 4
MAX_PHOTOS = 3
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; MuhojirBot/1.0; housing for migrants)"}

BLOCK = re.compile(r'<div class="tgme_widget_message_wrap.*?(?=<div class="tgme_widget_message_wrap|\Z)', re.S)
POST = re.compile(r'data-post="([^"]+)"')
WHEN = re.compile(r'<time[^>]*datetime="([^"]+)"')
TEXT = re.compile(r'<div class="tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>', re.S)
PHOTO = re.compile(r"tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)")

FOOTERS = ("Вся информация и фотографии на сайте", "⚠️ Помните", "Источник:", "Добавлено пользователем", "Наше сообщество")
SEEKING = re.compile(r"^\W*(ищу|ищем|сниму|снимем|нужна|нужен|нужно)\b", re.I)
SPAM = re.compile(r"закрыт\w*\s+(telegram[\s-]*)?канал|подпис\w+\s+на|реклам|розыгрыш|inactive|курс\w*\s+для\s+риелтор|вакансия", re.I)
UNFAIR = re.compile(
    r"славян|граждан\w*\s+(рф|россии|российской)|гражданство\s+рф|только\s+(для\s+)?(русск|россиян|рф)"
    r"|без\s+(мигрант|иностран|азиат|снг|нерусск)|не\s+(рассматрива\w+|сда\w+)\s+(мигрант|иностран|азиат|снг)"
    r"|кавказ|нерусск|только\s+с\s+пропиской", re.I)
DAILY = re.compile(r"посуточно|за\s+сутки|в\s+сутки|/\s*сутки|за\s+ночь", re.I)
LONG = re.compile(r"длительн|долгосрочн|на\s+месяц|от\s+\d+\s+мес", re.I)

BED = re.compile(r"койко|койка", re.I)
HOSTEL = re.compile(r"хостел", re.I)
FLAT = re.compile(r"квартир|студи|апартамент|\b\d\s*[-–]?\s*(к|х)\b|\b\d\s*[-–]?\s*(к|х)?\s*комн|однокомнат|двухкомнат|двушк|трехкомнат|трёхкомнат|однушк|\bдом\b", re.I)
ROOM = re.compile(r"\bкомнат[ауы]\b|\bкомнату\b|подселени", re.I)
ROOMS = re.compile(r"\b(\d)\s*[-–]?\s*(?:х\s*)?(?:к\b|к\.|комн)", re.I)
ROOM_WORDS = {"однокомнат": 1, "однушк": 1, "студи": 1, "двухкомнат": 2, "двушк": 2, "трехкомнат": 3, "трёхкомнат": 3, "четырехкомнат": 4}

PRICE_LABEL = re.compile(
    r"(?:цена|стоимость(?:\s+аренды)?|арендная\s+плата|аренда|оплата|за\s+месяц)\s*[:\-–—]?\s*(?:от\s+)?(\d[\d\s.,]*)\s*(тыс\w*|т\.?\s?р|k\b|к\b)?", re.I)
PRICE_BARE = re.compile(r"(?<![\d.,])(\d{1,3}\s\d{3})(?![\d.,])()")
PRICE_SIGN = re.compile(r"(\d[\d\s.,]*\d|\d)\s*(тыс\w*|т\.?\s?р\.?|k\b)?\s*(?:₽|руб|р\.|рублей)", re.I)

METRO = re.compile(r"(?:\bм\.\s?|[Мм]етро\s*:\s*|[Мм]етро\s+)([А-ЯЁ][а-яё]+(?:[\s-][А-ЯЁа-яё][а-яё]+){0,2})")
NOT_METRO = {"Квартира", "Рядом", "До", "В", "Есть", "Дом", "Комната", "Студия", "Пешком", "Минут"}
STREET = re.compile(r"\b(ул|улица|пр-кт|пр-т|проспект|пр|мкр|микрорайон|пер|переулок|бульвар|б-р|шоссе|ш|проезд|наб|набережная|площадь|пл|тракт|тупик|аллея|кв-л|квартал)\b\.?", re.I)
ADDRESS = re.compile(r"(?:📍\s*)?Адрес\s*[:\-]\s*(.+)", re.I)
PHONE = re.compile(r"(?<![\d/])(?:\+7|8|7)[\s\-(]*\d{3}[\s\-)]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}(?!\d)")
WHATSAPP = re.compile(r"wa\.me/\+?(\d{10,15})")
TME = re.compile(r"t\.me/([A-Za-z][A-Za-z0-9_]{4,31})\b")
TELEGRAM = re.compile(r"(?<![\w./@])@([A-Za-z][A-Za-z0-9_]{4,31})\b")
SITE = re.compile(r"https?://\w+\.bezposrednikov\.ru/\S+")

REGISTRATION = re.compile(r"регистрац|прописк", re.I)
NO_REGISTRATION = re.compile(r"без\s+(регистрац|прописк)|регистраци\w*\s+нет|не\s+(дела\w+|да\w+|предоставля\w+)\s+(регистрац|прописк)", re.I)
UTILITIES = re.compile(r"вс[её]\s+включено|включая\s+(ку|к/у|коммунал|счетчик|счётчик)|коммунальн\w+(\s+услуги)?\s+включен|(ку|к/у)\s+включен|без\s+доплат", re.I)
EXTRA_BILLS = re.compile(r"\+\s*(ку|к/у|жкх|жку|квитанц|сч[её]тчик|коммунал)|плюс\s+(ку|коммунал|сч[её]тчик)|по\s+(сч[её]тчикам|квитанц)", re.I)
NO_DEPOSIT = re.compile(r"без\s+(залога|депозита)", re.I)
MEN = re.compile(r"(только|для)\s+(мужчин|парн|ребят)", re.I)
WOMEN = re.compile(r"(только|для)\s+(женщин|девушк|девочек)", re.I)
FAMILY = re.compile(r"(только|для)\s+(семь|семейн)|семейной\s+пар", re.I)
EMOJI = re.compile(r"[^\w\s.,:;!?()«»\"'/%№+\-–—²]")


@dataclass
class Post:
    channel: str
    path: str
    when: datetime
    text: str
    photos: list = field(default_factory=list)


def clean_text(raw):
    text = re.sub(r"<br\s*/?>", "\n", raw)
    text = re.sub(r"<[^>]+>", "", text)
    return html.unescape(text).replace("\xa0", " ").strip()


def parse_page(page, channel):
    posts = []
    for block in BLOCK.findall(page):
        path, when, text = POST.search(block), WHEN.search(block), TEXT.search(block)
        if not (path and when and text):
            continue
        try:
            moment = datetime.fromisoformat(when.group(1))
        except ValueError:
            continue
        posts.append(Post(channel, path.group(1), moment, clean_text(text.group(1)), PHOTO.findall(block)))
    return posts


def body(text):
    for footer in FOOTERS:
        text = text.split(footer)[0]
    return text.strip()


def to_int(number, thousands=None):
    number = number.strip().replace(" ", "")
    if re.fullmatch(r"\d{1,3}([.,]\d{3})+", number):
        number = re.sub(r"[.,]", "", number)
    else:
        number = re.split(r"[.,]", number)[0]
    if not number.isdigit():
        return None
    value = int(number)
    if thousands and value < 1000:
        value *= 1000
    return value


def find_price(text, daily):
    low, high = (300, 30000) if daily else (3000, 400000)
    for pattern in (PRICE_LABEL, PRICE_SIGN, PRICE_BARE):
        for found in pattern.finditer(text):
            value = to_int(found.group(1), found.group(2))
            if value and low <= value <= high:
                return value
    return None


def find_kind(text):
    head = "\n".join(text.splitlines()[:2])
    if BED.search(text):
        return "bed"
    if HOSTEL.search(head):
        return "hostel"
    for part in (head, text):
        if FLAT.search(part):
            return "flat"
        if ROOM.search(part):
            return "room"
    return None


def find_rooms(text, kind):
    if kind != "flat":
        return None
    head = text[:300].lower()
    found = ROOMS.search(head)
    if found and 1 <= int(found.group(1)) <= 6:
        return int(found.group(1))
    return next((n for word, n in ROOM_WORDS.items() if word in head), None)


def find_city(address, default):
    for part in [p.strip() for p in address.split(",")]:
        if not part or re.search(r"пригород|р-н|район|поселени|\d", part, re.I):
            continue
        if STREET.search(part):
            break
        if re.search(r"област|край|республик", part, re.I):
            return part
        if len(part) <= 30 and part[0].isupper():
            return part
        break
    return default


def phone(value):
    try:
        return normalize_phone(value)
    except ValueError:
        return ""


def title_of(text, kind, city):
    lines = text.splitlines()
    for line in [x for x in lines if BED.search(x) or HOSTEL.search(x) or FLAT.search(x) or ROOM.search(x)][:1] + lines:
        line = EMOJI.sub("", line)
        line = re.sub(r"^\s*(сдам без посредников|сда[мю]|аренда)\s*[:.!]\s*", "", line, flags=re.I).strip(" .,:;-–—")
        if len(line) >= 5:
            line = line[0].upper() + line[1:]
            return line if len(line) <= 120 else line[:117].rstrip() + "…"
    names = {"bed": "Койко-место", "room": "Комната", "flat": "Квартира", "hostel": "Хостел"}
    return f"{names[kind]}, {city}"


def parse_post(post, default_city):
    text = body(post.text)
    if len(text) < 30 or SEEKING.search(text) or SPAM.search(text) or UNFAIR.search(text):
        return None
    kind = find_kind(text)
    daily = bool(DAILY.search(text)) and not LONG.search(text)
    price = find_price(text, daily)
    if kind is None or price is None:
        return None
    address = ADDRESS.search(text)
    address = address.group(1).strip()[:255] if address else ""
    city = find_city(address, default_city) if address else default_city
    metro = next((m.group(1) for m in METRO.finditer(text) if m.group(1).split()[0] not in NOT_METRO), "")
    phones = [p for p in (phone(x) for x in PHONE.findall(post.text)) if p]
    whatsapp = WHATSAPP.search(post.text)
    names = TELEGRAM.findall(post.text) + [n for n in TME.findall(post.text) if n.lower() not in (post.channel.lower(), "joinchat")]
    telegram = [name for name in names if not name.lower().endswith("bot")]
    site = SITE.search(post.text)
    registration = bool(REGISTRATION.search(text)) and not NO_REGISTRATION.search(text)
    who = "men" if MEN.search(text) else "women" if WOMEN.search(text) else "family" if FAMILY.search(text) else "any"
    return {
        "kind": kind, "title": title_of(text, kind, city), "description": text[:3000], "city": city[:100], "address": address,
        "metro": metro[:100], "price": price, "period": "day" if daily else "month",
        "rooms": find_rooms(text, kind), "for_whom": who, "registration": registration,
        "utilities_included": bool(UTILITIES.search(text)) and not EXTRA_BILLS.search(text),
        "no_deposit": bool(NO_DEPOSIT.search(text)),
        "phone": phones[0] if phones else "", "whatsapp": phone(whatsapp.group(1)) if whatsapp else "",
        "telegram": telegram[0] if telegram else "",
        "source_url": site.group(0).rstrip(".,)") if site else f"https://t.me/{post.path}",
    }


def fingerprint(data):
    words = re.sub(r"\W+", " ", data["description"].lower())[:300]
    return hashlib.sha1(f"{data['city']}|{data['price']}|{words}".encode()).hexdigest()


async def fetch_channel(client, channel, since, pages=PAGES, pause=1.0):
    posts, before = [], None
    for _ in range(pages):
        url = f"https://t.me/s/{channel}" + (f"?before={before}" if before else "")
        response = await client.get(url)
        response.raise_for_status()
        page = parse_page(response.text, channel)
        if not page:
            break
        posts += [p for p in page if p.when >= since]
        before = min(int(p.path.rsplit("/", 1)[1]) for p in page)
        if min(p.when for p in page) < since:
            break
        await asyncio.sleep(pause)
    return posts


async def save_photos(client, housing, urls):
    for url in urls[:MAX_PHOTOS]:
        try:
            response = await client.get(url)
            response.raise_for_status()
        except httpx.HTTPError:
            continue
        if len(response.content) > 5 * 1024 * 1024:
            continue
        name = await store_image(response.content, PHOTOS)
        if name:
            housing.photos.append(HousingPhoto(file=name))


async def save_post(db, client, post, data, counts, with_photos):
    external_id = f"tg:{post.path}"
    if await db.scalar(select(Housing.id).where(Housing.external_id == external_id)):
        counts["known"] += 1
        return
    key = fingerprint(data)
    if await db.scalar(select(Housing.id).where(Housing.fingerprint == key)):
        counts["duplicates"] += 1
        return
    if data["phone"] and await db.scalar(select(Housing.id).where(
            Housing.phone == data["phone"], Housing.price == data["price"], Housing.city == data["city"])):
        counts["duplicates"] += 1
        return
    housing = Housing(**data, owner_id=None, source="telegram", source_name=f"@{post.channel}", external_id=external_id,
                      fingerprint=key, status="approved", is_active=True, created_at=post.when)
    db.add(housing)
    if with_photos:
        await save_photos(client, housing, post.photos)
    await db.commit()
    counts["created"] += 1


async def expire_old(db):
    border = utcnow() - timedelta(days=KEEP_DAYS)
    result = await db.execute(update(Housing).where(Housing.owner_id.is_(None), Housing.is_active.is_(True),
                                                    Housing.created_at < border).values(is_active=False))
    await db.commit()
    return result.rowcount or 0


async def import_housing(db, channels=None, pages=PAGES, with_photos=True, pause=1.0, log=print, transport=None):
    counts = {"created": 0, "known": 0, "duplicates": 0, "skipped": 0, "failed": 0}
    since = utcnow() - timedelta(days=FRESH_DAYS)
    async with httpx.AsyncClient(timeout=30, headers=HEADERS, follow_redirects=True, transport=transport) as client:
        for channel in channels or CHANNELS:
            try:
                posts = await fetch_channel(client, channel, since, pages, pause)
            except httpx.HTTPError as error:
                counts["failed"] += 1
                log(f"@{channel}: {error}")
                continue
            for post in sorted(posts, key=lambda p: p.when):
                data = parse_post(post, CHANNELS.get(channel, ""))
                if data is None or not data["city"]:
                    counts["skipped"] += 1
                    continue
                await save_post(db, client, post, data, counts, with_photos)
            log(f"@{channel}: {len(posts)} fresh posts")
    counts["expired"] = await expire_old(db)
    return counts
