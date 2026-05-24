import os
import logging
import tempfile
import shutil
from pathlib import Path
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CommandHandler, MessageHandler,
    CallbackQueryHandler, ContextTypes, filters
)
from converter import convert_file, get_output_formats

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger(__name__)

BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
RENDER_URL = os.environ.get("RENDER_URL", "")
PORT = int(os.environ.get("PORT", 8080))

user_state = {}


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "👋 *Welcome to FileConverter Bot!*\n\n"
        "I can convert almost any file format for you.\n\n"
        "📄 *Documents:* PDF ↔ Word, Excel, PPT\n"
        "🖼 *Images:* JPG, PNG, WebP, BMP, GIF, TIFF, ICO\n"
        "🎵 *Audio:* MP3, WAV, OGG, FLAC, AAC, M4A\n"
        "🎬 *Video:* MP4, AVI, MOV, MKV, WebM, GIF\n\n"
        "Just send me any file and I'll ask what format you want! ✨",
        parse_mode="Markdown"
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "📖 *How to use:*\n\n"
        "1. Send me any file\n"
        "2. I'll show you available output formats\n"
        "3. Pick one and I'll convert it\n"
        "4. Download your converted file!\n\n"
        "Max file size: 50MB",
        parse_mode="Markdown"
    )


async def handle_file(update: Update, context: ContextTypes.DEFAULT_TYPE):
    message = update.message
    user_id = update.effective_user.id

    file_obj = None
    original_filename = "file"

    if message.document:
        file_obj = message.document
        original_filename = file_obj.file_name or "file"
    elif message.photo:
        file_obj = message.photo[-1]
        original_filename = "photo.jpg"
    elif message.audio:
        file_obj = message.audio
        original_filename = file_obj.file_name or "audio.mp3"
    elif message.video:
        file_obj = message.video
        original_filename = file_obj.file_name or "video.mp4"
    elif message.voice:
        file_obj = message.voice
        original_filename = "voice.ogg"

    if not file_obj:
        await message.reply_text("❌ Please send a file, image, audio, or video.")
        return

    if hasattr(file_obj, 'file_size') and file_obj.file_size and file_obj.file_size > 50 * 1024 * 1024:
        await message.reply_text("❌ File too large. Maximum size is 50MB.")
        return

    ext = Path(original_filename).suffix.lower().lstrip(".")
    if not ext:
        ext = "unknown"

    output_formats = get_output_formats(ext)

    if not output_formats:
        await message.reply_text(
            f"❌ Sorry, I don't support converting *{ext.upper()}* files yet.",
            parse_mode="Markdown"
        )
        return

    user_state[user_id] = {
        "file_id": file_obj.file_id,
        "original_filename": original_filename,
        "input_ext": ext
    }

    buttons = []
    row = []
    for fmt in output_formats:
        row.append(InlineKeyboardButton(fmt.upper(), callback_data=f"convert:{fmt}"))
        if len(row) == 3:
            buttons.append(row)
            row = []
    if row:
        buttons.append(row)
    buttons.append([InlineKeyboardButton("❌ Cancel", callback_data="cancel")])

    await message.reply_text(
        f"📁 Got it! *{original_filename}*\n\nConvert *{ext.upper()}* to:",
        reply_markup=InlineKeyboardMarkup(buttons),
        parse_mode="Markdown"
    )


async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    user_id = query.from_user.id
    await query.answer()

    if query.data == "cancel":
        user_state.pop(user_id, None)
        await query.edit_message_text("❌ Cancelled.")
        return

    if not query.data.startswith("convert:"):
        return

    output_fmt = query.data.split(":")[1]

    if user_id not in user_state:
        await query.edit_message_text("❌ Session expired. Please send the file again.")
        return

    state = user_state[user_id]
    input_ext = state["input_ext"]
    original_filename = state["original_filename"]
    file_id = state["file_id"]

    await query.edit_message_text(
        f"⏳ Converting *{input_ext.upper()}* → *{output_fmt.upper()}*...\nPlease wait.",
        parse_mode="Markdown"
    )

    tmp_dir = tempfile.mkdtemp()
    try:
        tg_file = await context.bot.get_file(file_id)
        input_path = os.path.join(tmp_dir, f"input.{input_ext}")
        await tg_file.download_to_drive(input_path)

        output_filename = Path(original_filename).stem + f".{output_fmt}"
        output_path = os.path.join(tmp_dir, output_filename)

        success, error_msg = convert_file(input_path, input_ext, output_path, output_fmt)

        if not success:
            await query.edit_message_text(f"❌ Conversion failed: {error_msg}")
            return

        await query.edit_message_text(
            f"✅ Sending your *{output_fmt.upper()}* file...",
            parse_mode="Markdown"
        )

        with open(output_path, "rb") as f:
            await context.bot.send_document(
                chat_id=query.message.chat_id,
                document=f,
                filename=output_filename,
                caption=f"✅ *{original_filename}* → *{output_filename}*",
                parse_mode="Markdown"
            )

        user_state.pop(user_id, None)

    except Exception as e:
        logger.error(f"Error: {e}")
        await query.edit_message_text(f"❌ Something went wrong: {str(e)}")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def main():
    app = Application.builder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(MessageHandler(
        filters.Document.ALL | filters.PHOTO | filters.AUDIO |
        filters.VIDEO | filters.VOICE,
        handle_file
    ))
    app.add_handler(CallbackQueryHandler(handle_callback))

    if RENDER_URL:
        logger.info("Starting webhook mode...")
        app.run_webhook(
            listen="0.0.0.0",
            port=PORT,
            url_path=BOT_TOKEN,
            webhook_url=f"{RENDER_URL}/{BOT_TOKEN}"
        )
    else:
        logger.info("Starting polling mode...")
        app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
