# 📁 Telegram File Converter Bot

Convert any file to another format — right inside Telegram.

## Supported Formats

| Type | Formats |
|------|---------|
| 🖼 Images | JPG, PNG, WebP, BMP, GIF, TIFF, ICO, SVG |
| 📄 Documents | PDF, DOCX, TXT, HTML, XLSX, CSV, PPTX |
| 🎵 Audio | MP3, WAV, OGG, FLAC, AAC, M4A, OPUS |
| 🎬 Video | MP4, AVI, MOV, MKV, WebM, FLV → also extract audio or convert to GIF |

---

## Setup

### Step 1 — Get a Bot Token

1. Open Telegram, search for **@BotFather**
2. Send `/newbot`
3. Follow the prompts, copy your token

### Step 2 — Install system dependencies

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y ffmpeg libreoffice poppler-utils

# macOS
brew install ffmpeg libreoffice poppler
```

### Step 3 — Install Python dependencies

```bash
pip install -r requirements.txt
```

### Step 4 — Set your bot token

Either set the environment variable:
```bash
export BOT_TOKEN="your_token_here"
```

Or edit `bot.py` line 14:
```python
BOT_TOKEN = "your_token_here"
```

### Step 5 — Run the bot

```bash
python bot.py
```

---

## Deploy Free on Railway / Render

### Railway (recommended)
1. Push this folder to a GitHub repo
2. Go to railway.app → New Project → Deploy from GitHub
3. Add environment variable: `BOT_TOKEN=your_token`
4. Done — it runs 24/7 for free

### Render
1. Push to GitHub
2. Go to render.com → New Web Service
3. Build command: `pip install -r requirements.txt`
4. Start command: `python bot.py`
5. Add env var: `BOT_TOKEN=your_token`

---

## How It Works

1. User sends any file to the bot
2. Bot detects the format and shows available output formats as buttons
3. User taps a format
4. Bot converts and sends the file back
