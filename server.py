"""
Зоогостиница «Сёма» — Backend Server & Telegram Bot Dispatcher
- Обработка заявок на бронирование
- Модерация отзывов с inline-кнопками в Telegram
"""

import os
import json
import time
import logging
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import telebot
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton

# Configuration (load from local config.py if present, or from Environment Variables)
try:
    import config
    BOT_TOKEN = getattr(config, 'BOT_TOKEN', os.getenv('BOT_TOKEN'))
    CHAT_ID = getattr(config, 'CHAT_ID', int(os.getenv('CHAT_ID', 0)))
    PORT = getattr(config, 'PORT', int(os.getenv('PORT', 8000)))
except ImportError:
    BOT_TOKEN = os.getenv('BOT_TOKEN')
    chat_id_val = os.getenv('CHAT_ID')
    CHAT_ID = int(chat_id_val) if chat_id_val else None
    PORT = int(os.getenv('PORT', 8000))

if not BOT_TOKEN or not CHAT_ID:
    raise ValueError("BOT_TOKEN and CHAT_ID must be set in config.py or Environment Variables!")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REVIEWS_FILE = os.path.join(BASE_DIR, 'reviews_data.json')
BOOKINGS_FILE = os.path.join(BASE_DIR, 'bookings_data.json')
VISITS_FILE = os.path.join(BASE_DIR, 'visits_data.json')
PENDING_FILE = os.path.join(BASE_DIR, 'pending_reviews.json')

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger('SemaHotelBot')

bot = telebot.TeleBot(BOT_TOKEN, parse_mode='HTML')

# Initialize data files if not exist
if not os.path.exists(REVIEWS_FILE):
    with open(REVIEWS_FILE, 'w', encoding='utf-8') as f:
        json.dump([], f, ensure_ascii=False, indent=2)

if not os.path.exists(BOOKINGS_FILE):
    with open(BOOKINGS_FILE, 'w', encoding='utf-8') as f:
        json.dump([], f, ensure_ascii=False, indent=2)

if not os.path.exists(VISITS_FILE):
    with open(VISITS_FILE, 'w', encoding='utf-8') as f:
        json.dump([], f, ensure_ascii=False, indent=2)

if not os.path.exists(PENDING_FILE):
    with open(PENDING_FILE, 'w', encoding='utf-8') as f:
        json.dump({}, f, ensure_ascii=False, indent=2)


def get_pending_reviews():
    try:
        if os.path.exists(PENDING_FILE):
            with open(PENDING_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception:
        pass
    return {}


def save_pending_reviews(pending):
    try:
        with open(PENDING_FILE, 'w', encoding='utf-8') as f:
            json.dump(pending, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Error saving pending reviews: {e}")


def save_approved_review(review):
    with open(REVIEWS_FILE, 'r', encoding='utf-8') as f:
        reviews = json.load(f)
    reviews.insert(0, review)
    with open(REVIEWS_FILE, 'w', encoding='utf-8') as f:
        json.dump(reviews, f, ensure_ascii=False, indent=2)


def save_booking(booking):
    with open(BOOKINGS_FILE, 'r', encoding='utf-8') as f:
        bookings = json.load(f)
    bookings.insert(0, booking)
    with open(BOOKINGS_FILE, 'w', encoding='utf-8') as f:
        json.dump(bookings, f, ensure_ascii=False, indent=2)


def save_visit(visit):
    try:
        visits = []
        if os.path.exists(VISITS_FILE):
            with open(VISITS_FILE, 'r', encoding='utf-8') as f:
                visits = json.load(f)
        visits.insert(0, visit)
        # Keep recent 2000 visits
        if len(visits) > 2000:
            visits = visits[:2000]
        with open(VISITS_FILE, 'w', encoding='utf-8') as f:
            json.dump(visits, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Error saving visit: {e}")


# --- TELEGRAM INLINE HANDLER FOR REVIEW MODERATION ---
@bot.callback_query_handler(func=lambda call: call.data.startswith(('appr_', 'decl_')))
def handle_review_moderation(call):
    try:
        action, rev_id = call.data.split('_', 1)
        pending = get_pending_reviews()
        rev = pending.get(rev_id)

        if action == 'appr':
            if rev:
                save_approved_review(rev)
                del pending[rev_id]
                save_pending_reviews(pending)
                try:
                    bot.answer_callback_query(call.id, '✅ Отзыв опубликован на сайте!')
                except Exception:
                    pass
                try:
                    bot.edit_message_reply_markup(call.message.chat.id, call.message.message_id, reply_markup=None)
                except Exception:
                    pass
                bot.send_message(
                    call.message.chat.id,
                    f"✅ <b>Отзыв от «{rev.get('name', 'Клиент')}» одобрен куратором {call.from_user.first_name} и добавлен на сайт!</b>",
                    reply_to_message_id=call.message.message_id
                )
            else:
                try:
                    bot.answer_callback_query(call.id, 'Отзыв уже обработан или не найден.')
                except Exception:
                    pass
        elif action == 'decl':
            if rev:
                del pending[rev_id]
                save_pending_reviews(pending)
            try:
                bot.answer_callback_query(call.id, '❌ Отзыв отклонён')
            except Exception:
                pass
            try:
                bot.edit_message_reply_markup(call.message.chat.id, call.message.message_id, reply_markup=None)
            except Exception:
                pass
            bot.send_message(
                call.message.chat.id,
                f"❌ <b>Отзыв отклонён куратором {call.from_user.first_name}.</b>",
                reply_to_message_id=call.message.message_id
            )
    except Exception as e:
        logger.error(f"Error handling review moderation callback: {e}")


# --- HTTP SERVER FOR FRONTEND API ---
class SemaHotelHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(200)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/health':
            self._set_headers(200)
            self.wfile.write(json.dumps({'status': 'ok'}).encode('utf-8'))
        elif parsed.path == '/api/reviews':
            with open(REVIEWS_FILE, 'r', encoding='utf-8') as f:
                data = f.read()
            self._set_headers(200)
            self.wfile.write(data.encode('utf-8'))
        elif parsed.path == '/api/stats':
            try:
                visits = []
                if os.path.exists(VISITS_FILE):
                    with open(VISITS_FILE, 'r', encoding='utf-8') as f:
                        visits = json.load(f)
                total_visits = len(visits)
                # Count sources
                sources = {}
                devices = {}
                for v in visits:
                    s = v.get('source', 'Прямой заход')
                    sources[s] = sources.get(s, 0) + 1
                    d = v.get('device', 'Десктоп')
                    devices[d] = devices.get(d, 0) + 1
                self._set_headers(200)
                self.wfile.write(json.dumps({
                    'total': total_visits,
                    'sources': sources,
                    'devices': devices,
                    'recent': visits[:50]
                }, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'Not found'}).encode('utf-8'))

    def do_POST(self):
        parsed = urlparse(self.path)
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)

        try:
            payload = json.loads(post_data.decode('utf-8'))
        except Exception:
            payload = {}

        if parsed.path == '/api/visit':
            import datetime
            now_str = datetime.datetime.now().strftime('%d.%m.%Y %H:%M:%S')
            source = payload.get('source', 'Прямой переход')
            device = payload.get('device', 'Мобильный' if 'mobi' in payload.get('userAgent', '').lower() else 'Десктоп')
            screen = payload.get('screen', 'Неизвестно')
            landing = payload.get('path', '/')
            referrer = payload.get('referrer', '')

            visit_entry = {
                'time': now_str,
                'source': source,
                'device': device,
                'screen': screen,
                'path': landing,
                'referrer': referrer
            }
            save_visit(visit_entry)

            # Send Telegram alert for new visitor
            msg = (
                f"👀 <b>НОВЫЙ ПОСЕТИТЕЛЬ НА САЙТЕ!</b>\n"
                f"━━━━━━━━━━━━━━━━━━━\n"
                f"🌐 <b>Источник:</b> {source}\n"
                f"📱 <b>Устройство:</b> {device} ({screen})\n"
                f"🔗 <b>Страница:</b> {landing}\n"
                f"🕒 <b>Время:</b> {now_str}\n"
                f"━━━━━━━━━━━━━━━━━━━\n"
                f"<i>Зоогостиница «Сёма» • semahotel.ru</i>"
            )
            try:
                bot.send_message(CHAT_ID, msg)
            except Exception as e:
                logger.error(f"Error sending telegram visit alert: {e}")

            self._set_headers(200)
            self.wfile.write(json.dumps({'status': 'ok'}).encode('utf-8'))

        elif parsed.path == '/api/booking':
            name = payload.get('name', 'Не указано')
            phone = payload.get('phone', 'Не указано')
            pet = payload.get('pet', 'Не указано')
            dates = payload.get('dates', 'Не указано')
            comment = payload.get('comment', 'Нет пожеланий')

            save_booking(payload)

            # Format beautiful telegram card
            msg = (
                f"🏨 <b>НОВАЯ ЗАЯВКА НА БРОНИРОВАНИЕ!</b>\n"
                f"━━━━━━━━━━━━━━━━━━━\n"
                f"👤 <b>Имя клиента:</b> {name}\n"
                f"📞 <b>Телефон:</b> <code>{phone}</code>\n"
                f"🐾 <b>Питомец:</b> {pet}\n"
                f"📅 <b>Даты проживания:</b> {dates}\n"
                f"💬 <b>Пожелания:</b> {comment}\n"
                f"━━━━━━━━━━━━━━━━━━━\n"
                f"<i>Заявка отправлена с формы бронирования на сайте</i>"
            )

            try:
                bot.send_message(CHAT_ID, msg)
                self._set_headers(200)
                self.wfile.write(json.dumps({'status': 'ok', 'message': 'Booking sent'}).encode('utf-8'))
            except Exception as e:
                logger.error(f"Error sending telegram booking: {e}")
                self._set_headers(500)
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))

        elif parsed.path == '/api/review':
            name = payload.get('name', 'Аноним')
            pet = payload.get('pet', 'Питомец')
            service = payload.get('service', 'Услуга')
            rating = payload.get('rating', '5')
            text = payload.get('text', '')

            import time
            rev_id = str(int(time.time() * 1000))
            new_review = {
                'id': rev_id,
                'name': name,
                'pet': pet,
                'service': service,
                'rating': int(rating),
                'text': text,
                'source': 'Сайт'
            }
            pending = get_pending_reviews()
            pending[rev_id] = new_review
            save_pending_reviews(pending)

            stars_str = '★' * int(rating)
            msg = (
                f"⭐ <b>НОВЫЙ ОТЗЫВ НА МОДЕРАЦИЮ!</b>\n"
                f"━━━━━━━━━━━━━━━━━━━\n"
                f"👤 <b>Автор:</b> {name} и {pet}\n"
                f"🏷️ <b>Услуга:</b> {service}\n"
                f"✨ <b>Оценка:</b> {stars_str} ({rating}/5)\n"
                f"📝 <b>Текст:</b>\n«{text}»\n"
                f"━━━━━━━━━━━━━━━━━━━\n"
                f"<i>Опубликовать этот отзыв на сайте?</i>"
            )

            markup = InlineKeyboardMarkup()
            markup.row(
                InlineKeyboardButton("✅ Опубликовать", callback_data=f"appr_{rev_id}"),
                InlineKeyboardButton("❌ Отклонить", callback_data=f"decl_{rev_id}")
            )

            try:
                bot.send_message(CHAT_ID, msg, reply_markup=markup)
                self._set_headers(200)
                self.wfile.write(json.dumps({'status': 'ok', 'message': 'Review pending moderation'}).encode('utf-8'))
            except Exception as e:
                logger.error(f"Error sending telegram review: {e}")
                self._set_headers(500)
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'Endpoint not found'}).encode('utf-8'))


def run_bot_polling():
    while True:
        try:
            logger.info("Telegram Bot polling started...")
            bot.infinity_polling(skip_pending=True, timeout=20, long_polling_timeout=20)
        except Exception as e:
            logger.error(f"Polling exception: {e}. Retrying in 5 seconds...")
            time.sleep(5)


if __name__ == '__main__':
    bot_thread = threading.Thread(target=run_bot_polling, daemon=True)
    bot_thread.start()

    logger.info(f"HTTP Server starting on 0.0.0.0:{PORT}...")
    server = HTTPServer(('0.0.0.0', PORT), SemaHotelHandler)
    server.serve_forever()

