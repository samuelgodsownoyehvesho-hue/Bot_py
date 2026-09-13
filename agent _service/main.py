"""
AutoGen-powered "brain" for the GENZ Converter Telegram bot.

This service does NOT talk to Telegram and does NOT touch files directly.
It receives a user's chat message from bot.js, decides (via an AutoGen
AssistantAgent with tools) whether to just reply or to actually perform one
of the bot's tasks, and — if so — calls back into bot.js's
POST /internal/agent-tool endpoint, which runs the real, unmodified bot
function (resize, compress, remove-bg, OCR, etc.) and sends the result to
the user on Telegram directly.

Run with:
    uvicorn main:app --host 0.0.0.0 --port 8000
"""
import os
import logging

import httpx
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

from autogen_agentchat.agents import AssistantAgent
from autogen_ext.models.openai import OpenAIChatCompletionClient

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("agent_service")

# ─── Config ──────────────────────────────────────────────────────────────────
GROQ_KEY = os.environ.get("GROQ_KEY", "")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")  # same non-deprecated model bot.js now uses
BOT_INTERNAL_URL = os.environ.get("BOT_INTERNAL_URL", "http://localhost:3000")
AGENT_SECRET = os.environ.get("AGENT_SECRET", "")

if not GROQ_KEY:
    log.warning("GROQ_KEY is not set — the agent will fail to reach the model.")
if not AGENT_SECRET:
    log.warning("AGENT_SECRET is not set — /agent/message is unauthenticated and bot.js calls will be rejected.")

SYSTEM_PROMPT = """You are GENZ Assistant, the AI agent inside the GENZ Converter Telegram bot.
The bot can convert files, resize/compress images, remove backgrounds, extract text (OCR),
convert video to GIF, turn images into stickers, generate QR codes, generate AI images,
translate text, turn text into speech, and create PDF/TXT files from text.

You have TOOLS that actually perform each of these actions for the user — always call the
matching tool instead of just describing what you would do. Some tools (resize, compress,
remove background, OCR, video-to-gif, sticker) act on the file the user most recently sent
in this chat; if the user asks for one of those and no file has been sent yet, ask them to
send it first instead of guessing. If a tool call fails, tell the user plainly what went wrong.

Keep replies short, friendly, and use at most one or two emoji. After a tool runs, confirm
what you did in one short sentence — don't repeat the raw tool output verbatim.
"""

# ─── Tool factory — binds each tool call to a specific user/chat ────────────
async def _call_bot_tool(uid: int, chat_id: int, tool: str, args: dict) -> str:
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            BOT_INTERNAL_URL.rstrip("/") + "/internal/agent-tool",
            json={"uid": uid, "chatId": chat_id, "tool": tool, "args": args},
            headers={"Authorization": "Bearer " + AGENT_SECRET, "Content-Type": "application/json"},
        )
    try:
        data = resp.json()
    except Exception:
        raise RuntimeError(f"Bot service returned an unexpected response (status {resp.status_code}).")
    if not data.get("ok"):
        raise RuntimeError(data.get("error") or "The bot could not complete that action.")
    return data.get("summary", "Done.")


def build_tools(uid: int, chat_id: int):
    async def resize_image(width: int, height: int) -> str:
        """Resize the image the user most recently sent in this chat to an exact width and height in pixels."""
        return await _call_bot_tool(uid, chat_id, "resize_image", {"width": width, "height": height})

    async def compress_image() -> str:
        """Compress the image the user most recently sent in this chat to reduce its file size."""
        return await _call_bot_tool(uid, chat_id, "compress_image", {})

    async def remove_background() -> str:
        """Remove the background from the image the user most recently sent in this chat."""
        return await _call_bot_tool(uid, chat_id, "remove_background", {})

    async def extract_text() -> str:
        """Extract (OCR) any readable text from the image the user most recently sent in this chat."""
        return await _call_bot_tool(uid, chat_id, "extract_text", {})

    async def convert_video_to_gif() -> str:
        """Convert the video the user most recently sent in this chat into an animated GIF."""
        return await _call_bot_tool(uid, chat_id, "convert_video_to_gif", {})

    async def image_to_sticker() -> str:
        """Convert the image the user most recently sent in this chat into a Telegram sticker."""
        return await _call_bot_tool(uid, chat_id, "image_to_sticker", {})

    async def generate_qr_code(text: str) -> str:
        """Generate a QR code image encoding the given text or URL, and send it to the user."""
        return await _call_bot_tool(uid, chat_id, "generate_qr_code", {"text": text})

    async def generate_ai_image(prompt: str) -> str:
        """Generate an AI image from a text description and send it to the user."""
        return await _call_bot_tool(uid, chat_id, "generate_ai_image", {"prompt": prompt})

    async def translate_text(text: str, target_language_code: str) -> str:
        """Translate text into another language. target_language_code is a short code like
        'fr' (French), 'es' (Spanish), 'ar' (Arabic), 'zh' (Chinese), 'de' (German), 'ja' (Japanese), etc."""
        return await _call_bot_tool(uid, chat_id, "translate_text", {"text": text, "targetLang": target_language_code})

    async def text_to_speech(text: str) -> str:
        """Convert text into spoken voice audio and send it to the user."""
        return await _call_bot_tool(uid, chat_id, "text_to_speech", {"text": text})

    async def create_pdf_from_text(text: str) -> str:
        """Create a PDF document containing the given text and send it to the user."""
        return await _call_bot_tool(uid, chat_id, "create_pdf_from_text", {"text": text})

    async def create_txt_from_text(text: str) -> str:
        """Create a plain .txt file containing the given text and send it to the user."""
        return await _call_bot_tool(uid, chat_id, "create_txt_from_text", {"text": text})

    return [
        resize_image, compress_image, remove_background, extract_text,
        convert_video_to_gif, image_to_sticker, generate_qr_code,
        generate_ai_image, translate_text, text_to_speech,
        create_pdf_from_text, create_txt_from_text,
    ]


# ─── Per-user agent cache ────────────────────────────────────────────────────
# Each user gets their own AssistantAgent instance so conversation history and
# tool context (via the closures above) stay isolated between chats.
_agents: dict[int, AssistantAgent] = {}


def get_or_create_agent(uid: int, chat_id: int) -> AssistantAgent:
    if uid not in _agents:
        model_client = OpenAIChatCompletionClient(
            model=GROQ_MODEL,
            base_url="https://api.groq.com/openai/v1",
            api_key=GROQ_KEY,
            model_info={
                "vision": False,
                "function_calling": True,
                "json_output": True,
                "family": "unknown",
                "structured_output": False,
            },
        )
        _agents[uid] = AssistantAgent(
            name="genz_assistant",
            model_client=model_client,
            tools=build_tools(uid, chat_id),
            system_message=SYSTEM_PROMPT,
            max_tool_iterations=5,
            reflect_on_tool_use=True,
        )
    return _agents[uid]


# ─── HTTP API ────────────────────────────────────────────────────────────────
app = FastAPI(title="GENZ Assistant Agent Service")


class MessageIn(BaseModel):
    uid: int
    chatId: int
    message: str


@app.get("/health")
async def health():
    return {"ok": True}


@app.post("/agent/message")
async def agent_message(body: MessageIn, authorization: str | None = Header(default=None)):
    expected = "Bearer " + AGENT_SECRET
    if not AGENT_SECRET or authorization != expected:
        raise HTTPException(status_code=401, detail="unauthorized")

    agent = get_or_create_agent(body.uid, body.chatId)
    try:
        result = await agent.run(task=body.message)
    except Exception as e:
        log.exception("agent.run failed for uid=%s", body.uid)
        return {"reply": "Sorry, I ran into an error thinking about that: " + str(e)[:200]}

    reply = None
    for m in reversed(result.messages):
        content = getattr(m, "content", None)
        if isinstance(content, str) and content.strip():
            reply = content.strip()
            break
    if reply is None:
        reply = "Done!"
    return {"reply": reply}


# Reset a user's agent/conversation (bot.js calls this when the user ends chat,
# via DELETE, so the next /chat starts fresh instead of growing forever).
@app.delete("/agent/session/{uid}")
async def reset_session(uid: int, authorization: str | None = Header(default=None)):
    expected = "Bearer " + AGENT_SECRET
    if not AGENT_SECRET or authorization != expected:
        raise HTTPException(status_code=401, detail="unauthorized")
    _agents.pop(uid, None)
    return {"ok": True}
