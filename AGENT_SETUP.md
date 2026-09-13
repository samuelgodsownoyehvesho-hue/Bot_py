# What changed

Two things, both scoped to the AI only:

1. **Fixed the deprecated model.** Groq retired `llama-3.1-8b-instant` and
   `llama-3.3-70b-versatile` on Aug 16, 2026. Every call site in `bot.js`
   that used them now uses `openai/gpt-oss-20b` / `openai/gpt-oss-120b`
   instead (Groq's own recommended replacements). Nothing else in those
   functions changed.

2. **The `/chat` AI is now a real agent**, built with Microsoft AutoGen
   (`autogen-agentchat`), living in a new folder: `agent_service/`. It runs
   as its **own small service**, separate from `bot.js`.

Nothing else in `bot.js` was touched — every other command (`/resize`,
`/compress`, `/merge`, `/ocr`, `/qr`, `/tts`, format conversion, admin API,
etc.) works exactly as it did before, untouched.

## How it fits together

```
Telegram user
    │  "resize this to 300x300" + photo
    ▼
bot.js  (Node, unchanged except /chat + file-in-chat-mode + one new route)
    │  POST /agent/message  { uid, chatId, message }
    ▼
agent_service  (Python, AutoGen AssistantAgent)
    │  decides: call the resize_image tool
    ▼
    POST back to bot.js: /internal/agent-tool { tool: "resize_image", args }
    ▼
bot.js runs the EXACT SAME resizeImage() function /resize already used,
sends the result to the user on Telegram directly, and returns a one-line
summary to the agent, which replies to the user in the chat.
```

The Python service never touches Telegram or files directly — it's purely
the decision-making brain. `bot.js` still does all the real work.

## What the agent can do

Resize, compress, remove background, OCR/extract text, video → GIF, image →
sticker, generate a QR code, generate an AI image, translate text, text →
speech, create a PDF from text, create a TXT from text — just by asking for
it in `/chat`, in any order, with the file before or after the instruction.

**Not wired up:** `/merge` (multi-image merging) — it needs several files
accumulated in sequence, which didn't fit cleanly into the "one file at a
time" tool pattern. It still works fine as the manual `/merge` command.

## Environment variables to set

**On the Node bot (`bot.js`) — add these, keep everything else as-is:**
| Variable | Value |
|---|---|
| `AGENT_URL` | URL of the deployed `agent_service`, e.g. `https://your-agent.onrender.com` |
| `AGENT_SECRET` | A random shared secret string — generate one, e.g. `openssl rand -hex 32` |

**On the new `agent_service`:**
| Variable | Value |
|---|---|
| `GROQ_KEY` | Same Groq API key as the bot |
| `AGENT_SECRET` | **Must match** the `bot.js` value exactly |
| `BOT_INTERNAL_URL` | URL of the deployed `bot.js` service, e.g. `https://your-bot.onrender.com` |
| `GROQ_MODEL` | Optional, defaults to `openai/gpt-oss-120b` |

## Deploying

`agent_service/` has its own `Dockerfile` — deploy it as a **second, separate
service** on Render/Railway/wherever `bot.js` runs today, the same way you
deployed the bot. Two services, two URLs, pointed at each other via the env
vars above.

## One thing outside this change, worth knowing

`bot.js` has a live Groq API key and a Remove.bg key hardcoded as fallback
values in a few places (`process.env.GROQ_KEY || 'gsk_...'`). I left these
exactly as they were since you asked me not to touch anything besides the
AI — but if this repo is public, that key is exposed right now. Worth
rotating both keys and removing the hardcoded fallbacks when you get a
chance.
