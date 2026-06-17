const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createClient } = require('@supabase/supabase-js');

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const RENDER_URL = process.env.RENDER_URL || '';
const PORT = process.env.PORT || 3000;
// LibreOffice used for document conversion (no API key needed)
const ADMIN_ID = 8995568038;
const SUPABASE_URL = 'https://qtpeyheyqkaqgaqvllnv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const FREE_LIMIT = 10;
const MAX_FREE_SIZE = 5 * 1024 * 1024;

// ─── LANGUAGES ────────────────────────────────────────────────────────────────
const LANGUAGES = {
  en: { name: 'English', flag: '🇬🇧' },
  fr: { name: 'Français', flag: '🇫🇷' },
  es: { name: 'Español', flag: '🇪🇸' },
  ar: { name: 'العربية', flag: '🇸🇦' },
  zh: { name: '中文', flag: '🇨🇳' },
  hi: { name: 'हिन्दी', flag: '🇮🇳' },
  pt: { name: 'Português', flag: '🇧🇷' },
  ru: { name: 'Русский', flag: '🇷🇺' },
  de: { name: 'Deutsch', flag: '🇩🇪' },
  ja: { name: '日本語', flag: '🇯🇵' },
  ko: { name: '한국어', flag: '🇰🇷' },
  it: { name: 'Italiano', flag: '🇮🇹' },
  tr: { name: 'Türkçe', flag: '🇹🇷' },
  id: { name: 'Indonesia', flag: '🇮🇩' },
  ms: { name: 'Melayu', flag: '🇲🇾' },
  nl: { name: 'Nederlands', flag: '🇳🇱' },
  pl: { name: 'Polski', flag: '🇵🇱' },
  uk: { name: 'Українська', flag: '🇺🇦' },
  vi: { name: 'Tiếng Việt', flag: '🇻🇳' },
  th: { name: 'ภาษาไทย', flag: '🇹🇭' },
  fa: { name: 'فارسی', flag: '🇮🇷' },
  bn: { name: 'বাংলা', flag: '🇧🇩' },
  ur: { name: 'اردو', flag: '🇵🇰' },
  sw: { name: 'Kiswahili', flag: '🇰🇪' },
  ha: { name: 'Hausa', flag: '🇳🇬' },
  yo: { name: 'Yorùbá', flag: '🇳🇬' },
  ig: { name: 'Igbo', flag: '🇳🇬' },
  am: { name: 'አማርኛ', flag: '🇪🇹' },
  ro: { name: 'Română', flag: '🇷🇴' },
  cs: { name: 'Čeština', flag: '🇨🇿' },
  hu: { name: 'Magyar', flag: '🇭🇺' },
  sv: { name: 'Svenska', flag: '🇸🇪' },
  fi: { name: 'Suomi', flag: '🇫🇮' },
  da: { name: 'Dansk', flag: '🇩🇰' },
  no: { name: 'Norsk', flag: '🇳🇴' },
  el: { name: 'Ελληνικά', flag: '🇬🇷' },
  he: { name: 'עברית', flag: '🇮🇱' },
  sk: { name: 'Slovenčina', flag: '🇸🇰' },
  bg: { name: 'Български', flag: '🇧🇬' },
  hr: { name: 'Hrvatski', flag: '🇭🇷' },
  sr: { name: 'Српски', flag: '🇷🇸' },
  lt: { name: 'Lietuvių', flag: '🇱🇹' },
  lv: { name: 'Latviešu', flag: '🇱🇻' },
  et: { name: 'Eesti', flag: '🇪🇪' },
  sl: { name: 'Slovenščina', flag: '🇸🇮' },
  ka: { name: 'ქართული', flag: '🇬🇪' },
  az: { name: 'Azərbaycan', flag: '🇦🇿' },
  kk: { name: 'Қазақша', flag: '🇰🇿' },
  uz: { name: "O'zbek", flag: '🇺🇿' },
  hy: { name: 'Հայերեն', flag: '🇦🇲' },
  tl: { name: 'Filipino', flag: '🇵🇭' },
  ne: { name: 'नेपाली', flag: '🇳🇵' },
  si: { name: 'සිංහල', flag: '🇱🇰' },
  my: { name: 'မြန်မာဘာသာ', flag: '🇲🇲' },
  km: { name: 'ខ្មែរ', flag: '🇰🇭' },
  lo: { name: 'ລາວ', flag: '🇱🇦' },
  mk: { name: 'Македонски', flag: '🇲🇰' },
  mn: { name: 'Монгол', flag: '🇲🇳' },
  sq: { name: 'Shqip', flag: '🇦🇱' },
  bs: { name: 'Bosanski', flag: '🇧🇦' },
  af: { name: 'Afrikaans', flag: '🇿🇦' },
  zu: { name: 'IsiZulu', flag: '🇿🇦' },
  so: { name: 'Soomaali', flag: '🇸🇴' },
};

// ─── DYNAMIC TRANSLATION CACHE ────────────────────────────────────────────────
// translationCache[langCode][key] = translated string
const translationCache = {};
const userLangCache = {};

// All English strings as plain text (functions resolved with placeholders)
const EN_STRINGS = {
  welcome: 'Welcome to GENZ_CONVERTER Bot, {name}!\n\nConvert any file format instantly.\n\nImages: JPG PNG WebP BMP GIF TIFF\nDocuments: PDF DOCX TXT XLSX CSV\nAudio: MP3 WAV OGG FLAC AAC M4A\nVideo: MP4 AVI MOV MKV WebM FLV\n\nCONVERT & TOOLS:\n/compress - Compress an image\n/resize - Resize an image\n/merge - Combine images into PDF\n/ocr - Extract text from image\n/qr [text] - Generate QR code\n/removebg - Remove image background\n/gif - Convert video to GIF\n/sticker - Image to Telegram sticker\n/img - AI Image Generator\n/tts - Text to Audio\n/chat - AI Chatbot\n\nCREATE FILES:\n/createpdf - Create PDF from text\n/createtxt - Create TXT file from text\n\nYOUR ACCOUNT:\n/profile - Your profile and plan\n/history - Your conversion history\n/stats - Your usage stats\n/refer - Referral link (3 = 7 days free!)\n/redeem - Redeem promo code\n/myid - Get your Telegram ID\n/language - Change language\n\nFree: 10 conversions/day up to 5MB\nPremium: Unlimited + up to 50MB\n\nJust send me any file to get started!',
  language_prompt: '🌍 Select your language:',
  language_set: '✅ Language set to {lang}!',
  send_size: 'Send the size e.g. 800x600',
  invalid_size: 'Invalid format. Send like 800x600',
  size_set: 'Size set to {w}x{h}. Now send the image!',
  send_image_compress: 'Send me an image to compress.',
  send_image_resize: 'Size set! Now send the image to resize.',
  send_images_merge: 'Send images one by one then /done',
  send_image_ocr: 'Send me an image to extract text from.',
  send_image_removebg: 'Send me an image and I will remove its background!',
  send_video_gif: 'Send me a video and I will convert it to a GIF!',
  send_image_sticker: 'Send me an image and I will convert it to a Telegram sticker!',
  send_text_pdf: 'Type or paste your text and I will create a PDF file from it.\n\nSend your text now:',
  send_text_txt: 'Type or paste your text and I will create a TXT file.\n\nSend your text now:',
  converting: 'Converting {from} to {to}...',
  done: '✅ Done!',
  failed: '❌ Failed: {e}',
  cancelled: 'Cancelled.',
  session_expired: 'Session expired. Send the file again.',
  file_too_large: 'File too large! Free users: max 5MB.\nUpgrade for 50MB.',
  format_not_supported: 'Format {f} is not supported.',
  convert_to: 'File: {name}\nSize: {size}\n{remaining}\n\nConvert {ext} to:',
  conversions_left: '{n} conversion(s) left today',
  unlimited: 'Unlimited conversions',
  no_images_merge: 'No images to merge. Use /merge first.',
  merging: 'Merging {n} images...',
  image_added: 'Image {n} added. Send more or /done',
  extracting_text: 'Extracting text...',
  no_text_found: 'No text found in the image.',
  compressing: 'Compressing...',
  resizing: 'Resizing...',
  removing_bg: 'Removing background... this may take 10-20 seconds.',
  converting_gif: 'Converting to GIF... please wait.',
  creating_sticker: 'Creating sticker...',
  creating_pdf: 'Creating PDF...',
  upgrade_msg: '⚠️ You have exhausted your 10 free trials for today.\n\n🕐 Resets in: {timeLeft}\n\n💎 Upgrade to Premium for:\n• Unlimited conversions\n• All tools (OCR, Remove BG, GIF, Sticker)\n• Files up to 50MB\n\n💰 Pricing:\n30 Days — ₦1,500\nLifetime — ₦5,000\n\nTo upgrade:\n1. Send /myid\n2. Send your ID + payment proof on WhatsApp\n3. Activated within minutes!',
  upgrade_btn: 'Upgrade on WhatsApp',
  myid_msg: 'Your Telegram ID:\n\n{id}\n\nSend this to WhatsApp when upgrading.',
  no_history: 'No history yet. Send me a file!',
  qr_generating: 'Generating QR code...',
  qr_usage: 'Usage: /qr your text\n\nExample: /qr https://google.com',
  promo_success: '🎉 Code redeemed!\n\nYou got {days} days of FREE Premium!\n\nEnjoy unlimited conversions!',
  promo_failed: 'Failed: {msg}',
  send_promo_code: 'Send your promo code:',
  send_tts: '🔊 Send me the text you want to convert to audio (up to 10,000 words):\n\nExample: Hello, welcome to GENZ Converter!',
  generating_audio: '🔊 Generating audio...',
  audio_done: '✅ Here is your audio!',
  audio_failed: '❌ Failed to generate audio. Try a shorter text.',
  send_tts_voice: '🔊 Choose a voice style:',
  chat_thinking: '💭 Thinking...',
  chat_failed: '❌ Failed to respond. Try again.',
  send_chat: '🤖 I am your AI assistant! Ask me anything.\n\nType your question and I will answer!',
  send_createimg: '🎨 Describe the image you want to create:\n\nExample: a sunset over the ocean, cinematic, 4K',
  generating_img: '🎨 Generating your image... this may take 10-20 seconds',
  img_failed: '❌ Failed to generate image. Try a different prompt.',
};

// Translate a single string to target language using Groq
async function translateWithGroq(text, targetLang) {
  const GROQ_KEY = process.env.GROQ_KEY || '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';
  const langName = LANGUAGES[targetLang] ? LANGUAGES[targetLang].name : targetLang;
  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You are a translation assistant. Translate the given text to ${langName}. Rules:
- Return ONLY the translated text, nothing else
- Keep all placeholders like {name}, {lang}, {w}, {h}, {from}, {to}, {e}, {f}, {ext}, {name}, {size}, {remaining}, {n}, {timeLeft}, {id}, {days}, {msg} exactly as they are
- Keep all emojis, newlines, and formatting
- Keep all Telegram commands like /compress, /resize etc unchanged
- Do not add any explanation or preamble`
        },
        { role: 'user', content: text }
      ],
      max_tokens: 1024,
      temperature: 0.1
    },
    {
      headers: { 'Authorization': 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' },
      timeout: 15000
    }
  );
  return response.data.choices[0].message.content.trim();
}

// Get a translated string for a language (with caching)
async function getTranslated(lang, key) {
  if (lang === 'en') return EN_STRINGS[key] || key;
  // Check cache
  if (translationCache[lang] && translationCache[lang][key] !== undefined) {
    return translationCache[lang][key];
  }
  // Translate via Groq
  try {
    const translated = await translateWithGroq(EN_STRINGS[key] || key, lang);
    if (!translationCache[lang]) translationCache[lang] = {};
    translationCache[lang][key] = translated;
    return translated;
  } catch(e) {
    console.error('[TRANSLATE ERROR]', lang, key, e.message);
    return EN_STRINGS[key] || key; // fallback to English
  }
}

// Fill named placeholders: fillPlaceholders('Hello {name}', {name:'John'})
function fillPlaceholders(str, vars) {
  if (!str || !vars || Object.keys(vars).length === 0) return str || '';
  return str.replace(/\{(\w+)\}/g, (_, k) => vars[k] !== undefined ? vars[k] : '{'+k+'}');
}

// Main translation function — async
// Usage: await t(uid, 'key', {placeholder: value, ...})
async function t(uid, key, vars) {
  const lang = userLangCache[uid] || 'en';
  const translated = await getTranslated(lang, key);
  return fillPlaceholders(translated, vars || {});
}

function getLang(uid) { return userLangCache[uid] || 'en'; }

async function getUserLang(uid) {
  if (userLangCache[uid]) return userLangCache[uid];
  try {
    const { data } = await supabase.from('bot_users').select('language').eq('user_id', uid).single();
    if (data && data.language) { userLangCache[uid] = data.language; return data.language; }
  } catch(e) {}
  return 'en';
}

async function setUserLang(uid, lang) {
  userLangCache[uid] = lang;
  try {
    await supabase.from('bot_users').upsert({ user_id: uid, language: lang }, { onConflict: 'user_id' });
  } catch(e) { console.error('[LANG SAVE ERROR]', e.message); }
}
// ─── CACHE ────────────────────────────────────────────────────────────────────
const userCache = {};
const CACHE_TTL = 30000;
function getCached(uid) { const c = userCache[uid]; return (c && Date.now()-c.ts < CACHE_TTL) ? c.data : null; }
function setCache(uid, data) { userCache[uid] = { data, ts: Date.now() }; }
function clearCache(uid) { delete userCache[uid]; }

// ─── EXPRESS ──────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-admin-id');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.get('/', (req, res) => res.send('GENZ_CONVERTER Bot is running!'));
app.get('/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

let bot;
if (RENDER_URL) {
  bot = new TelegramBot(BOT_TOKEN);
  bot.setWebHook(`${RENDER_URL}/bot${BOT_TOKEN}`);
  app.post(`/bot${BOT_TOKEN}`, (req, res) => { bot.processUpdate(req.body); res.sendStatus(200); });
} else {
  bot = new TelegramBot(BOT_TOKEN, { polling: true });
}

app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
  if (RENDER_URL) {
    setInterval(() => { axios.get(RENDER_URL).catch(() => {}); }, 4 * 60 * 1000);
    setInterval(checkPremiumExpiry, 60 * 60 * 1000);
  }
});

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
async function getUser(uid, force = false) {
  if (!force) { const c = getCached(uid); if (c) return c; }
  try {
    const { data } = await supabase.from('bot_users').select('*').eq('user_id', uid).single();
    if (data) setCache(uid, data);
    return data;
  } catch (e) { return null; }
}

async function saveUser(msg) {
  try {
    await supabase.from('bot_users').upsert({
      user_id: msg.from.id, name: msg.from.first_name || 'Unknown',
      username: msg.from.username || '', last_active: new Date().toISOString()
    }, { onConflict: 'user_id', ignoreDuplicates: false });
    clearCache(msg.from.id);
    if (!userLangCache[msg.from.id]) getUserLang(msg.from.id).catch(() => {});
  } catch (e) {}
}

async function isPremium(uid) {
  if (uid === ADMIN_ID) return true;
  const u = await getUser(uid);
  if (!u) return false;
  if (u.lifetime) return true;
  if (u.premium_until && new Date(u.premium_until) > new Date()) return true;
  return false;
}

async function grantPremium(uid, plan) {
  const update = plan === 'lifetime'
    ? { lifetime: true, premium_until: null, notified_10days: false }
    : (() => { const d = new Date(); d.setDate(d.getDate() + parseInt(plan)); return { lifetime: false, premium_until: d.toISOString(), notified_10days: false }; })();
  await supabase.from('bot_users').upsert({ user_id: uid, ...update }, { onConflict: 'user_id' });
  clearCache(uid);
}

async function revokePremium(uid) {
  await supabase.from('bot_users').update({ lifetime: false, premium_until: null }).eq('user_id', uid);
  clearCache(uid);
}

async function getDailyCount(uid) {
  const u = await getUser(uid);
  if (!u) return 0;
  const lastReset = u.daily_reset ? new Date(u.daily_reset) : new Date(0);
  if ((Date.now() - lastReset) >= 24 * 60 * 60 * 1000) {
    await supabase.from('bot_users').update({ daily_count: 0, daily_reset: new Date().toISOString() }).eq('user_id', uid);
    clearCache(uid);
    return 0;
  }
  return u.daily_count || 0;
}

async function incrementDailyCount(uid) {
  const u = await getUser(uid);
  const count = (u && u.daily_count) || 0;
  await supabase.from('bot_users').update({ daily_count: count + 1 }).eq('user_id', uid);
  clearCache(uid);
}

async function getTimeUntilReset(uid) {
  const u = await getUser(uid);
  if (!u || !u.daily_reset) return '24h 0m';
  const reset = new Date(new Date(u.daily_reset).getTime() + 24 * 60 * 60 * 1000);
  const diff = reset - Date.now();
  if (diff <= 0) return '0h 0m';
  return Math.floor(diff / 3600000) + 'h ' + Math.floor((diff % 3600000) / 60000) + 'm';
}

async function addHistory(uid, from, to, filename) {
  try {
    await supabase.from('conversion_history').insert({ user_id: uid, from_fmt: from, to_fmt: to, filename });
    const u = await getUser(uid);
    await supabase.from('bot_users').update({ total_conversions: ((u && u.total_conversions) || 0) + 1 }).eq('user_id', uid);
    clearCache(uid);
  } catch (e) {}
}

async function getUserHistory(uid, limit = 20) {
  try {
    const { data } = await supabase.from('conversion_history').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(limit);
    return data || [];
  } catch (e) { return []; }
}

async function getTotalUsers() {
  try { const { count } = await supabase.from('bot_users').select('*', { count: 'exact', head: true }); return count || 0; } catch (e) { return 0; }
}

async function getTotalConversions() {
  try { const { count } = await supabase.from('conversion_history').select('*', { count: 'exact', head: true }); return count || 0; } catch (e) { return 0; }
}

async function getPremiumUsers() {
  try {
    const { data } = await supabase.from('bot_users').select('user_id,name,username,lifetime,premium_until')
      .or(`lifetime.eq.true,premium_until.gt.${new Date().toISOString()}`).neq('user_id', ADMIN_ID);
    return data || [];
  } catch (e) { return []; }
}

async function checkPremiumExpiry() {
  try {
    const tenDays = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const { data } = await supabase.from('bot_users').select('user_id,name,premium_until,notified_10days')
      .eq('lifetime', false).eq('notified_10days', false).not('premium_until', 'is', null)
      .lt('premium_until', tenDays.toISOString()).gt('premium_until', new Date().toISOString());
    for (const u of data || []) {
      const days = Math.ceil((new Date(u.premium_until) - Date.now()) / 86400000);
      try {
        await bot.sendMessage(u.user_id, 'Your premium expires in ' + days + ' day' + (days !== 1 ? 's' : '') + '.\n\nRenew: wa.me/2347012276929');
        await supabase.from('bot_users').update({ notified_10days: true }).eq('user_id', u.user_id);
      } catch (e) {}
    }
  } catch (e) {}
}

// ─── REFERRAL ─────────────────────────────────────────────────────────────────
async function processReferral(newUid, referrerId) {
  if (!referrerId || referrerId === newUid) return;
  try {
    const u = await getUser(newUid);
    if (u && u.referred_by) return;
    await supabase.from('bot_users').update({ referred_by: referrerId }).eq('user_id', newUid);
    clearCache(newUid);
  } catch (e) {}
}

async function countReferralConversion(uid) {
  try {
    const u = await getUser(uid, true);
    if (!u || u.has_converted || !u.referred_by) return;
    await supabase.from('bot_users').update({ has_converted: true }).eq('user_id', uid);
    clearCache(uid);
    const ref = await getUser(u.referred_by, true);
    if (!ref) return;
    const newCount = (ref.referral_count || 0) + 1;
    await supabase.from('bot_users').update({ referral_count: newCount }).eq('user_id', u.referred_by);
    clearCache(u.referred_by);
    if (newCount >= 3 && !ref.referral_rewarded) {
      await grantPremium(u.referred_by, '7');
      await supabase.from('bot_users').update({ referral_rewarded: true }).eq('user_id', u.referred_by);
      try { await bot.sendMessage(u.referred_by, '🎉 You referred 3 people!\n\nYour 7-day FREE Premium is now active!\n\nThank you for sharing GENZ_CONVERTER!'); } catch (e) {}
    } else if (newCount < 3) {
      const left = 3 - newCount;
      try { await bot.sendMessage(u.referred_by, '👥 Referral #' + newCount + '/3 counted!\n\n' + left + ' more to get 7 days FREE Premium!'); } catch (e) {}
    }
  } catch (e) {}
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function formatBytes(b) {
  if (!b) return '0 B';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(1) + ' MB';
}

function formatDate(s) {
  if (!s) return 'N/A';
  return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function sendUpgradeMessage(chatId, timeLeft, uid) {
  const kb = { inline_keyboard: [[{ text: t(uid||chatId, 'upgrade_btn'), url: 'https://wa.me/2347012276929' }]] };
  await bot.sendMessage(chatId, t(uid||chatId, 'upgrade_msg', {timeLeft}), { reply_markup: kb });
}

// ─── CONVERSIONS ──────────────────────────────────────────────────────────────
const CONVERSIONS = {
  jpg: ['png','webp','bmp','gif','pdf'], jpeg: ['png','webp','bmp','gif','pdf'],
  png: ['jpg','webp','bmp','gif','pdf'], webp: ['jpg','png','bmp','gif'],
  bmp: ['jpg','png','webp','gif'], gif: ['jpg','png','webp','mp4'],
  tiff: ['jpg','png','webp','pdf'], tif: ['jpg','png','webp','pdf'],
  pdf: ['txt'], txt: ['pdf'], docx: ['txt','pdf'], xlsx: ['csv'], csv: ['xlsx'],
  mp3: ['wav','ogg','flac','aac','m4a'], wav: ['mp3','ogg','flac','aac'],
  ogg: ['mp3','wav','flac'], flac: ['mp3','wav','ogg'], aac: ['mp3','wav','ogg'], m4a: ['mp3','wav','ogg'],
  mp4: ['avi','mov','mkv','webm','gif','mp3'], avi: ['mp4','mov','mkv','mp3'],
  mov: ['mp4','avi','mkv','mp3'], mkv: ['mp4','avi','mov','mp3'],
  webm: ['mp4','avi','mov','gif'], flv: ['mp4','avi','mkv','mp3'],
};

async function downloadFile(fileId, destPath) {
  const fi = await bot.getFile(fileId);
  const url = 'https://api.telegram.org/file/bot' + BOT_TOKEN + '/' + fi.file_path;
  const r = await axios({ url, responseType: 'arraybuffer' });
  fs.writeFileSync(destPath, Buffer.from(r.data));
}

async function convertImage(inputPath, outputPath, fmt) {
  const sharp = require('sharp');
  const sharpFmts = ['jpeg','png','webp','gif','tiff'];
  const f = fmt === 'jpg' ? 'jpeg' : fmt;
  if (!sharpFmts.includes(f)) {
    await sharp(inputPath).toFormat('png').toFile(outputPath);
    return;
  }
  await sharp(inputPath).toFormat(f).toFile(outputPath);
}

async function imageToPdf(inputPath, outputPath) {
  const { PDFDocument } = require('pdf-lib');
  const sharp = require('sharp');
  const buf = await sharp(inputPath).jpeg().toBuffer();
  const pdf = await PDFDocument.create();
  const img = await pdf.embedJpg(buf);
  const page = pdf.addPage([img.width, img.height]);
  page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  fs.writeFileSync(outputPath, await pdf.save());
}

async function compressImage(inputPath, outputPath) {
  const sharp = require('sharp');
  const ext = path.extname(inputPath).toLowerCase().replace('.', '');
  const f = ext === 'jpg' ? 'jpeg' : ext;
  if (f === 'jpeg') await sharp(inputPath).jpeg({ quality: 70 }).toFile(outputPath);
  else if (f === 'png') await sharp(inputPath).png({ compressionLevel: 9 }).toFile(outputPath);
  else if (f === 'webp') await sharp(inputPath).webp({ quality: 70 }).toFile(outputPath);
  else await sharp(inputPath).jpeg({ quality: 70 }).toFile(outputPath);
}

async function resizeImage(inputPath, outputPath, w, h) {
  const sharp = require('sharp');
  const ext = path.extname(outputPath).toLowerCase().replace('.', '');
  const f = ext === 'jpg' ? 'jpeg' : ext;
  await sharp(inputPath).resize(w, h, { fit: 'inside' }).toFormat(f).toFile(outputPath);
}

async function convertMedia(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    require('fluent-ffmpeg')(inputPath).output(outputPath).on('end', resolve).on('error', reject).run();
  });
}

async function xlsxToCsv(i, o) {
  const X = require('xlsx');
  const wb = X.readFile(i);
  fs.writeFileSync(o, X.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]));
}

async function csvToXlsx(i, o) {
  const X = require('xlsx');
  const ws = X.utils.aoa_to_sheet(fs.readFileSync(i,'utf8').split('\n').map(r=>r.split(',')));
  const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'Sheet1'); X.writeFile(wb, o);
}

async function docxToTxt(i, o) {
  const m = require('mammoth');
  const r = await m.extractRawText({ path: i });
  fs.writeFileSync(o, r.value);
}

async function imagesToPdf(paths, outputPath) {
  const { PDFDocument } = require('pdf-lib');
  const sharp = require('sharp');
  const pdf = await PDFDocument.create();
  for (const p of paths) {
    const buf = await sharp(p).jpeg().toBuffer();
    const img = await pdf.embedJpg(buf);
    const page = pdf.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  fs.writeFileSync(outputPath, await pdf.save());
}

async function generateQR(text, outputPath) {
  await require('qrcode').toFile(outputPath, text, { width: 512, margin: 2 });
}

async function convertWithLibreOffice(inputPath, outputPath, outputFmt) {
  const { exec } = require('child_process');
  const outDir = path.dirname(outputPath);
  const baseName = path.basename(inputPath, path.extname(inputPath));
  // LibreOffice converts and saves to outDir
  await new Promise((resolve, reject) => {
    exec('libreoffice --headless --convert-to ' + outputFmt + ' --outdir ' + outDir + ' ' + inputPath, (err, stdout, stderr) => {
      if (err) reject(new Error('LibreOffice conversion failed: ' + stderr));
      else resolve();
    });
  });
  // LibreOffice names output as baseName.outputFmt
  const libreOut = path.join(outDir, baseName + '.' + outputFmt);
  if (libreOut !== outputPath) fs.renameSync(libreOut, outputPath);
}

async function convertFile(inputPath, inputFmt, outputPath, outputFmt) {
  const imgFmts = ['jpg','jpeg','png','webp','bmp','gif','tiff','tif'];
  const mediaFmts = ['mp3','wav','ogg','flac','aac','m4a','mp4','avi','mov','mkv','webm','flv'];
  if (imgFmts.includes(inputFmt) && imgFmts.includes(outputFmt)) await convertImage(inputPath, outputPath, outputFmt);
  else if (imgFmts.includes(inputFmt) && outputFmt === 'pdf') await imageToPdf(inputPath, outputPath);
  else if (mediaFmts.includes(inputFmt) && mediaFmts.includes(outputFmt)) await convertMedia(inputPath, outputPath);
  else if (inputFmt === 'xlsx' && outputFmt === 'csv') await xlsxToCsv(inputPath, outputPath);
  else if (inputFmt === 'csv' && outputFmt === 'xlsx') await csvToXlsx(inputPath, outputPath);
  else if (inputFmt === 'docx' && outputFmt === 'txt') await docxToTxt(inputPath, outputPath);
  else await convertWithLibreOffice(inputPath, outputPath, outputFmt);
}

// ─── USER STATE ───────────────────────────────────────────────────────────────
const userState = {};

// ─── API ROUTES ───────────────────────────────────────────────────────────────
const multer = require('multer');
const upload = multer({ dest: os.tmpdir() });

app.post('/api/convert', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const { outputFmt } = req.body;
  const inputExt = path.extname(req.file.originalname).toLowerCase().replace('.', '');
  const inputPath = req.file.path;
  const outName = path.basename(req.file.originalname, path.extname(req.file.originalname)) + '.' + outputFmt;
  const outputPath = inputPath + '_out.' + outputFmt;
  try {
    await convertFile(inputPath, inputExt, outputPath, outputFmt);
    const buf = fs.readFileSync(outputPath);
    res.setHeader('Content-Disposition', 'attachment; filename="' + outName + '"');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { fs.unlink(inputPath, ()=>{}); fs.unlink(outputPath, ()=>{}); }
});

app.post('/api/compress', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
  const inputPath = req.file.path;
  const outputPath = inputPath + '_c.' + ext;
  try {
    await compressImage(inputPath, outputPath);
    const buf = fs.readFileSync(outputPath);
    res.setHeader('Content-Disposition', 'attachment; filename="compressed_' + req.file.originalname + '"');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Original-Size', req.file.size);
    res.setHeader('X-Compressed-Size', fs.statSync(outputPath).size);
    res.setHeader('Access-Control-Expose-Headers', 'X-Original-Size,X-Compressed-Size,Content-Disposition');
    res.send(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { fs.unlink(inputPath, ()=>{}); fs.unlink(outputPath, ()=>{}); }
});

app.post('/api/resize', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const { width, height } = req.body;
  const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
  const inputPath = req.file.path;
  const outputPath = inputPath + '_r.' + ext;
  try {
    await resizeImage(inputPath, outputPath, parseInt(width), parseInt(height));
    const buf = fs.readFileSync(outputPath);
    res.setHeader('Content-Disposition', 'attachment; filename="resized_' + req.file.originalname + '"');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { fs.unlink(inputPath, ()=>{}); fs.unlink(outputPath, ()=>{}); }
});

app.post('/api/ocr', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const inputPath = req.file.path;
  try {
    const result = await require('tesseract.js').recognize(inputPath, 'eng');
    const rawText = result.data.text.trim();
    if (!rawText) return res.json({ text: '', aiEnhanced: false });
    // Try Groq AI enhancement
    let finalText = rawText;
    let aiEnhanced = false;
    try {
      finalText = await enhanceOcrWithGroq(rawText);
      aiEnhanced = true;
    } catch(e) { finalText = rawText; }
    res.json({ text: finalText, aiEnhanced });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { fs.unlink(inputPath, ()=>{}); }
});

app.post('/api/qr', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text required' });
  const outputPath = path.join(os.tmpdir(), 'qr_' + Date.now() + '.png');
  try {
    await generateQR(text, outputPath);
    const buf = fs.readFileSync(outputPath);
    res.setHeader('Content-Type', 'image/png');
    res.send(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { fs.unlink(outputPath, ()=>{}); }
});


app.post('/api/removebg', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const inputPath = req.file.path;
  const outputPath = inputPath + '_nobg.png';
  try {
    await removeBackground(inputPath, outputPath);
    const buf = fs.readFileSync(outputPath);
    res.setHeader('Content-Type', 'image/png');
    res.send(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { fs.unlink(inputPath, ()=>{}); fs.unlink(outputPath, ()=>{}); }
});

app.post('/api/createpdf', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text required' });
  const outputPath = path.join(os.tmpdir(), 'doc_' + Date.now() + '.pdf');
  try {
    await createPdfFromText(text, outputPath);
    const buf = fs.readFileSync(outputPath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="document.pdf"');
    res.send(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { fs.unlink(outputPath, ()=>{}); }
});

app.post('/api/redeem', async (req, res) => {
  const { userId, code } = req.body;
  if (!userId || !code) return res.status(400).json({ error: 'userId and code required' });
  const result = await redeemPromoCode(parseInt(userId), code.trim());
  if (result.success) res.json({ success: true, days: result.days });
  else res.status(400).json({ success: false, msg: result.msg });
});

app.post('/api/tts', async (req, res) => {
  const { text, voice } = req.body;
  if (!text) return res.status(400).json({ error: 'Text required' });
  if (text.length > 10000) return res.status(400).json({ error: 'Text too long. Max 10,000 characters.' });
  const espeakVoice = voice === 'male' ? 'en+m3' : voice === 'robot' ? 'en+m1' : 'en+f3';
  const espeakSpeed = voice === 'robot' ? '120' : '150';
  const espeakPitch = voice === 'robot' ? '30' : voice === 'male' ? '50' : '70';
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttsapi-'));
  const txtPath = path.join(tmpDir, 'input.txt');
  const mp3Path = path.join(tmpDir, 'audio.mp3');
  try {
    fs.writeFileSync(txtPath, text);
    await new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      exec('espeak -v ' + espeakVoice + ' -s ' + espeakSpeed + ' -p ' + espeakPitch + ' -f ' + txtPath + ' --stdout | ffmpeg -i pipe:0 -ar 22050 -ab 128k ' + mp3Path + ' -y -loglevel quiet', (err) => {
        if (err) reject(err); else resolve();
      });
    });
    const buf = fs.readFileSync(mp3Path);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="audio.mp3"');
    res.send(buf);
  } catch(e) { res.status(500).json({ error: e.message }); }
  finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
});


// ─── CHAT HISTORY API ─────────────────────────────────────────────────────────

// Get all chat sessions for a user
app.get('/api/chats/:userId', async (req, res) => {
  const uid = parseInt(req.params.userId);
  try {
    const { data } = await supabase
      .from('chat_sessions')
      .select('id, title, created_at, updated_at')
      .eq('user_id', uid)
      .order('updated_at', { ascending: false })
      .limit(50);
    res.json({ sessions: data || [] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Get messages for a specific chat session
app.get('/api/chats/:userId/:sessionId', async (req, res) => {
  const uid = parseInt(req.params.userId);
  const sid = req.params.sessionId;
  try {
    const { data } = await supabase
      .from('chat_messages')
      .select('role, content, created_at')
      .eq('session_id', sid)
      .eq('user_id', uid)
      .order('created_at', { ascending: true });
    res.json({ messages: data || [] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Save a message to a session (creates session if needed)
app.post('/api/chats/save', async (req, res) => {
  const { userId, sessionId, role, content, title } = req.body;
  if (!userId || !sessionId || !role || !content) return res.status(400).json({ error: 'Missing fields' });
  try {
    // Upsert session
    await supabase.from('chat_sessions').upsert({
      id: sessionId,
      user_id: parseInt(userId),
      title: title || 'New Chat',
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });
    // Insert message
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      user_id: parseInt(userId),
      role,
      content,
      created_at: new Date().toISOString()
    });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Delete a chat session
app.delete('/api/chats/:userId/:sessionId', async (req, res) => {
  const uid = parseInt(req.params.userId);
  const sid = req.params.sessionId;
  try {
    await supabase.from('chat_messages').delete().eq('session_id', sid).eq('user_id', uid);
    await supabase.from('chat_sessions').delete().eq('id', sid).eq('user_id', uid);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Update session title
app.patch('/api/chats/:userId/:sessionId/title', async (req, res) => {
  const uid = parseInt(req.params.userId);
  const sid = req.params.sessionId;
  const { title } = req.body;
  try {
    await supabase.from('chat_sessions').update({ title }).eq('id', sid).eq('user_id', uid);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/chat', async (req, res) => {
  const { messages, userId } = req.body;
  if (!messages || !messages.length) return res.status(400).json({ error: 'Messages required' });
  try {
    const GROQ_KEY = process.env.GROQ_KEY || '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';
    const resp = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'You are GENZ Assistant, a helpful AI inside GENZ_CONVERTER Telegram bot. Be concise and friendly. You can help with questions, writing, coding, math, and general knowledge.' },
        ...messages.slice(-20)
      ],
      max_tokens: 2048,
      temperature: 0.7
    }, {
      headers: { 'Authorization': 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' },
      timeout: 30000
    });
    res.json({ reply: resp.data.choices[0].message.content.trim() });
  } catch(e) {
    console.error('[CHAT API ERROR]', e.response ? JSON.stringify(e.response.data) : e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/setlang', async (req, res) => {
  const { userId, lang } = req.body;
  if (!userId || !lang) return res.status(400).json({ error: 'userId and lang required' });
  await setUserLang(parseInt(userId), lang);
  res.json({ success: true });
});

app.get('/api/formats/:ext', (req, res) => {
  res.json({ formats: CONVERSIONS[req.params.ext.toLowerCase()] || [] });
});

app.get('/api/profile/:userId', async (req, res) => {
  const uid = parseInt(req.params.userId);
  try {
    const user = await getUser(uid, true);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const premium = await isPremium(uid);
    const history = await getUserHistory(uid, 50);
    const dailyCount = await getDailyCount(uid);
    res.json({ user, premium, history, dailyCount, freeLimit: FREE_LIMIT });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/profile/:userId/username', async (req, res) => {
  const uid = parseInt(req.params.userId);
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });
  const clean = username.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 32);
  try {
    await supabase.from('bot_users').update({ username: clean }).eq('user_id', uid);
    clearCache(uid);
    res.json({ success: true, username: clean });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query required' });
  try {
    const { data } = await supabase.from('bot_users').select('*')
      .or('name.ilike.%' + q + '%,username.ilike.%' + q + '%').limit(10);
    const now = new Date();
    const results = (data || []).map(u => ({
      ...u,
      is_premium: u.lifetime || (u.premium_until && new Date(u.premium_until) > now)
    }));
    res.json({ results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── ADMIN API MIDDLEWARE ──────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const raw = req.headers['x-admin-id'] || req.body['adminId'] || '0';
  if (raw === 'null' || !raw) return res.status(403).json({ error: 'Not authenticated' });
  const adminId = parseInt(raw);
  if (isNaN(adminId) || adminId !== ADMIN_ID) return res.status(403).json({ error: 'Admin access only' });
  next();
}

// GET /api/admin/stats
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const [totalUsers, totalConvs, premUsers] = await Promise.all([
      getTotalUsers(), getTotalConversions(), getPremiumUsers()
    ]);
    res.json({ totalUsers, totalConversions: totalConvs, premiumUsers: premUsers.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/users?filter=all|premium|free|recent
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  const filter = req.query.filter || 'all';
  try {
    let query = supabase.from('bot_users').select('*').neq('user_id', ADMIN_ID).limit(50);
    const now = new Date().toISOString();
    if (filter === 'premium') {
      query = query.or('lifetime.eq.true,premium_until.gt.' + now);
    } else if (filter === 'free') {
      query = query.eq('lifetime', false).or('premium_until.is.null,premium_until.lte.' + now);
    } else if (filter === 'recent') {
      const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('last_active', week).order('last_active', { ascending: false });
    } else {
      query = query.order('last_active', { ascending: false });
    }
    const { data } = await query;
    const users = (data || []).map(u => ({
      ...u,
      is_premium: u.lifetime || (u.premium_until && new Date(u.premium_until) > new Date())
    }));
    res.json({ users });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/broadcast
app.post('/api/admin/broadcast', requireAdmin, async (req, res) => {
  const { message, premiumOnly } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message required' });
  try {
    let query = supabase.from('bot_users').select('user_id').neq('user_id', ADMIN_ID);
    if (premiumOnly) {
      const now = new Date().toISOString();
      query = query.or('lifetime.eq.true,premium_until.gt.' + now);
    }
    const { data: users } = await query;
    const total = (users || []).length;
    let sent = 0; let failed = 0;
    // Send in background, return immediately with estimate
    res.json({ started: true, total, message: 'Broadcast started to ' + total + ' users' });
    for (const u of users || []) {
      try {
        await bot.sendMessage(u.user_id, 'Announcement\n\n' + message.trim());
        sent++;
      } catch (e) { failed++; }
      await new Promise(r => setTimeout(r, 50));
    }
    // Notify admin when done
    try {
      await bot.sendMessage(ADMIN_ID, 'Broadcast complete!\n\nTotal: ' + total + '\nSent: ' + sent + '\nFailed: ' + failed);
    } catch(e) {}
  } catch (e) { if (!res.headersSent) res.status(500).json({ error: e.message }); }
});

// POST /api/admin/grant  { user: userId_or_username, plan: '30'|'lifetime'|'revoke' }
app.post('/api/admin/grant', requireAdmin, async (req, res) => {
  const { user, plan } = req.body;
  if (!user || !plan) return res.status(400).json({ error: 'user and plan required' });
  try {
    // Resolve user: numeric ID or @username
    let targetId = parseInt(user);
    if (isNaN(targetId)) {
      const uname = String(user).replace('@', '');
      const { data } = await supabase.from('bot_users').select('user_id').ilike('username', uname).single();
      if (!data) return res.status(404).json({ error: 'User not found' });
      targetId = data.user_id;
    }
    if (plan === 'revoke') {
      await revokePremium(targetId);
      try { await bot.sendMessage(targetId, 'Your premium access has been revoked.'); } catch(e) {}
      return res.json({ success: true, message: 'Premium revoked for ' + targetId });
    }
    await grantPremium(targetId, plan);
    const label = plan === 'lifetime' ? 'Lifetime' : plan + ' Days';
    try {
      await bot.sendMessage(targetId, 'Your Premium is now active!\nPlan: ' + label + '\nEnjoy unlimited conversions and 50MB files!');
    } catch(e) {}
    res.json({ success: true, message: 'Granted ' + label + ' to user ' + targetId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/promo  { code, days, maxUses }
app.post('/api/admin/promo', requireAdmin, async (req, res) => {
  const { code, days, maxUses } = req.body;
  if (!code || !days) return res.status(400).json({ error: 'code and days required' });
  const upper = String(code).toUpperCase().trim();
  try {
    const { error } = await supabase.from('promo_codes').insert({
      code: upper, days: parseInt(days), max_uses: parseInt(maxUses) || 100, used_count: 0
    });
    if (error) throw new Error(error.message || 'Code may already exist');
    res.json({ success: true, code: upper, days, maxUses });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// GET /api/admin/promos
app.get('/api/admin/promos', requireAdmin, async (req, res) => {
  try {
    const { data } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false }).limit(50);
    res.json({ codes: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/analytics
app.get('/api/admin/analytics', requireAdmin, async (req, res) => {
  try {
    const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    // Top conversions
    const { data: convs } = await supabase.from('conversion_history')
      .select('from_fmt, to_fmt').gte('created_at', week);
    const fmtCount = {};
    for (const c of convs || []) {
      const key = (c.from_fmt || '?') + ':' + (c.to_fmt || '?');
      fmtCount[key] = (fmtCount[key] || 0) + 1;
    }
    const topConversions = Object.entries(fmtCount)
      .sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([key, count]) => {
        const [from_format, to_format] = key.split(':');
        return { from_format, to_format, count };
      });
    // Event counts from analytics table
    const { data: evts } = await supabase.from('analytics').select('event').gte('created_at', week);
    const events = {};
    for (const e of evts || []) {
      events[e.event] = (events[e.event] || 0) + 1;
    }
    res.json({ topConversions, events });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ─── GROQ AI OCR CLEANUP ──────────────────────────────────────────────────────
async function enhanceOcrWithGroq(rawText) {
  const GROQ_KEY = process.env.GROQ_KEY || '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';
  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: 'You are an OCR text correction assistant. The user will give you raw text extracted from an image via OCR. It may contain errors, broken words, wrong characters, bad spacing, or garbled sentences. Your job is to clean it up and return only the corrected text — no explanations, no commentary, no preamble. Preserve the original structure, language, and meaning. Do not translate or summarize.'
        },
        {
          role: 'user',
          content: rawText
        }
      ],
      max_tokens: 2048,
      temperature: 0.2
    },
    {
      headers: {
        'Authorization': 'Bearer ' + GROQ_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 20000
    }
  );
  return response.data.choices[0].message.content.trim();
}

// ─── BOT COMMANDS ─────────────────────────────────────────────────────────────

// Build language selector keyboard (5 per row)
function buildLangKeyboard() {
  const keys = Object.keys(LANGUAGES);
  const rows = [];
  for (let i = 0; i < keys.length; i += 3) {
    rows.push(keys.slice(i, i + 3).map(code => ({
      text: LANGUAGES[code].flag + ' ' + LANGUAGES[code].name,
      callback_data: 'setlang:' + code
    })));
  }
  return { inline_keyboard: rows };
}

bot.onText(/\/language/, async (msg) => {
  const uid = msg.from.id;
  await getUserLang(uid);
  bot.sendMessage(msg.chat.id, await t(uid, 'language_prompt'), { reply_markup: buildLangKeyboard() });
});

bot.onText(/\/start (.+)/, async (msg, match) => {
  saveUser(msg).catch(() => {});
  const uid = msg.from.id;
  await getUserLang(uid);
  const param = match[1].trim();
  if (param.startsWith('ref_')) {
    const refId = parseInt(param.replace('ref_', ''));
    if (!isNaN(refId)) await processReferral(uid, refId);
  }
  t(uid, 'welcome', {name: msg.from.first_name}).then(m => bot.sendMessage(msg.chat.id, m));
});

bot.onText(/\/start$/, async (msg) => {
  saveUser(msg).catch(() => {});
  const uid = msg.from.id;
  await getUserLang(uid);
  t(uid, 'welcome', {name: msg.from.first_name}).then(m => bot.sendMessage(msg.chat.id, m));
});

bot.onText(/\/myid/, async (msg) => {
  const uid = msg.from.id;
  await getUserLang(uid);
  bot.sendMessage(msg.chat.id, await t(uid, 'myid_msg', {id: uid}));
});

bot.onText(/\/refer/, async (msg) => {
  const uid = msg.from.id;
  saveUser(msg).catch(() => {});
  const u = await getUser(uid);
  const count = u ? (u.referral_count || 0) : 0;
  const rewarded = u ? u.referral_rewarded : false;
  const link = 'https://t.me/genzfiledit_bot?start=ref_' + uid;
  let status = rewarded
    ? 'You already claimed your 7-day premium reward!\n\nKeep referring for future rewards.'
    : 'Progress: ' + count + '/3\n' + (3 - count) + ' more referral' + (3 - count === 1 ? '' : 's') + ' to get 7 days FREE Premium!';
  bot.sendMessage(msg.chat.id,
    'Your Referral Link:\n\n' + link + '\n\n' + status + '\n\n' +
    'How it works:\n' +
    '1. Share your link with friends\n' +
    '2. They join and make their first conversion\n' +
    '3. After 3 referrals you get 7 days FREE Premium!\n\n' +
    'Referral counts only after friend makes their first conversion.'
  );
});

bot.onText(/\/profile/, async (msg) => {
  const uid = msg.from.id;
  saveUser(msg).catch(() => {});
  const [u, premium, daily, total] = await Promise.all([
    getUser(uid), isPremium(uid), getDailyCount(uid),
    (async () => { try { const { count } = await supabase.from('conversion_history').select('*',{count:'exact',head:true}).eq('user_id',uid); return count||0; } catch(e){return 0;} })()
  ]);
  let plan = 'Free (10/day)';
  if (uid === ADMIN_ID) plan = 'Admin (Unlimited)';
  else if (premium) {
    if (u && u.lifetime) plan = 'Lifetime Premium';
    else if (u && u.premium_until) {
      const days = Math.ceil((new Date(u.premium_until) - Date.now()) / 86400000);
      plan = '30-Day Premium (' + days + ' days left)';
    }
  }
  const remaining = premium ? 'Unlimited' : (FREE_LIMIT - daily) + ' of ' + FREE_LIMIT + ' left today';
  bot.sendMessage(msg.chat.id,
    'YOUR PROFILE\n\n' +
    'Name: ' + (u ? u.name : msg.from.first_name) + '\n' +
    'ID: ' + uid + '\n' +
    'Username: ' + (u && u.username ? '@' + u.username : 'Not set') + '\n\n' +
    'PLAN: ' + plan + '\n' +
    'Today: ' + remaining + '\n' +
    'Total conversions: ' + total + '\n' +
    'Referrals: ' + (u ? u.referral_count || 0 : 0) + '/3\n\n' +
    (premium ? 'You have full premium access!' : 'Upgrade: wa.me/2347012276929')
  );
});

bot.onText(/\/history/, async (msg) => {
  const history = await getUserHistory(msg.from.id, 20);
  if (!history.length) return bot.sendMessage(msg.chat.id, 'No history yet. Send me a file!');
  let text = 'YOUR HISTORY\n\n';
  history.forEach((h, i) => {
    text += (i+1) + '. ' + (h.filename||'file') + '\n   ' + (h.from_fmt||'?').toUpperCase() + ' to ' + (h.to_fmt||'?').toUpperCase() + ' - ' + formatDate(h.created_at) + '\n';
  });
  bot.sendMessage(msg.chat.id, text);
});

bot.onText(/\/stats/, async (msg) => {
  const uid = msg.from.id;
  const [total, daily, premium, timeLeft] = await Promise.all([
    (async () => { try { const{count}=await supabase.from('conversion_history').select('*',{count:'exact',head:true}).eq('user_id',uid); return count||0;} catch(e){return 0;} })(),
    getDailyCount(uid), isPremium(uid), getTimeUntilReset(uid)
  ]);
  bot.sendMessage(msg.chat.id,
    'YOUR STATS\n\nTotal: ' + total + '\nToday: ' + daily + (premium ? ' (unlimited)' : ' of ' + FREE_LIMIT) + '\n' +
    (premium ? 'Plan: Premium' : 'Resets in: ' + timeLeft)
  );
});

bot.onText(/\/grant (.+)/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return bot.sendMessage(msg.chat.id, 'Admin only.');
  const targetId = parseInt(match[1].trim());
  if (isNaN(targetId)) return bot.sendMessage(msg.chat.id, 'Invalid ID.');
  const u = await getUser(targetId);
  const kb = { inline_keyboard: [[{ text: '30 Days', callback_data: 'grant:' + targetId + ':30' },{ text: 'Lifetime', callback_data: 'grant:' + targetId + ':lifetime' }],[{ text: 'Cancel', callback_data: 'cancel' }]] };
  bot.sendMessage(msg.chat.id, 'User: ' + (u ? u.name : 'Unknown') + '\nID: ' + targetId + '\n\nChoose plan:', { reply_markup: kb });
});

bot.onText(/\/revoke (.+)/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return bot.sendMessage(msg.chat.id, 'Admin only.');
  const id = parseInt(match[1].trim());
  if (isNaN(id)) return bot.sendMessage(msg.chat.id, 'Invalid ID.');
  await revokePremium(id);
  bot.sendMessage(msg.chat.id, 'Premium revoked for ' + id);
});

bot.onText(/\/users/, async (msg) => {
  if (msg.from.id !== ADMIN_ID) return bot.sendMessage(msg.chat.id, 'Admin only.');
  const [total, totalConv, premUsers] = await Promise.all([getTotalUsers(), getTotalConversions(), getPremiumUsers()]);
  let text = 'ADMIN STATS\n\nTotal users: ' + total + '\nTotal conversions: ' + totalConv + '\n\nPREMIUM USERS (' + premUsers.length + '):\n\n';
  if (!premUsers.length) text += 'None yet.';
  else premUsers.forEach((u,i) => { text += (i+1) + '. ' + u.name + (u.username?' @'+u.username:'') + '\n   ID: '+u.user_id+'\n   ' + (u.lifetime?'Lifetime':'Expires '+formatDate(u.premium_until)) + '\n\n'; });
  bot.sendMessage(msg.chat.id, text);
});

bot.onText(/\/lookup (.+)/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return bot.sendMessage(msg.chat.id, 'Admin only.');
  const id = parseInt(match[1].trim());
  if (isNaN(id)) return bot.sendMessage(msg.chat.id, 'Invalid ID.');
  const u = await getUser(id, true);
  if (!u) return bot.sendMessage(msg.chat.id, 'User not found.');
  const premium = await isPremium(id);
  const plan = id===ADMIN_ID?'Admin':u.lifetime?'Lifetime Premium':u.premium_until&&new Date(u.premium_until)>new Date()?'30-Day ('+Math.ceil((new Date(u.premium_until)-Date.now())/86400000)+' days left)':'Free';
  try { const {count} = await supabase.from('conversion_history').select('*',{count:'exact',head:true}).eq('user_id',id);
    bot.sendMessage(msg.chat.id, 'USER PROFILE\n\nName: '+u.name+'\nUsername: '+(u.username?'@'+u.username:'N/A')+'\nID: '+id+'\nJoined: '+formatDate(u.joined_at)+'\nLast active: '+formatDate(u.last_active)+'\nPlan: '+plan+'\nTotal conversions: '+(count||0)+'\nReferrals: '+(u.referral_count||0));
  } catch(e) { bot.sendMessage(msg.chat.id, 'Error loading user.'); }
});

bot.onText(/\/qr/, (msg) => {
  userState[msg.from.id] = { mode: 'qr' };
  t(msg.from.id, 'qr_usage').then(m => bot.sendMessage(msg.chat.id, m));
});
bot.onText(/\/compress/, async (msg) => { userState[msg.from.id] = { mode: 'compress' }; bot.sendMessage(msg.chat.id, await t(msg.from.id, 'send_image_compress')); });
bot.onText(/\/resize/, async (msg) => { userState[msg.from.id] = { mode: 'resize_waiting_size' }; bot.sendMessage(msg.chat.id, await t(msg.from.id, 'send_size')); });
bot.onText(/\/merge/, async (msg) => { userState[msg.from.id] = { mode: 'merge', images: [] }; bot.sendMessage(msg.chat.id, await t(msg.from.id, 'send_images_merge')); });
bot.onText(/\/ocr/, async (msg) => { userState[msg.from.id] = { mode: 'ocr' }; bot.sendMessage(msg.chat.id, await t(msg.from.id, 'send_image_ocr')); });

bot.onText(/\/done/, async (msg) => {
  const chatId = msg.chat.id; const uid = msg.from.id;
  const state = userState[uid];
  if (!state || state.mode !== 'merge' || !state.images || !state.images.length) return t(uid, 'no_images_merge').then(m => bot.sendMessage(chatId, m));
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-'));
  const outputPath = path.join(tmpDir, 'merged.pdf');
  try {
    await bot.sendMessage(chatId, await t(uid, 'merging', {n: state.images.length}));
    await imagesToPdf(state.images, outputPath);
    await bot.sendDocument(chatId, outputPath, { caption: 'Merged ' + state.images.length + ' images - ' + formatBytes(fs.statSync(outputPath).size) });
    await addHistory(uid, 'images', 'pdf', 'merged.pdf');
  } catch (e) { t(uid, 'failed', {e: e.message}).then(m => bot.sendMessage(chatId, m)); }
  finally { fs.rmSync(tmpDir, { recursive: true, force: true }); delete userState[uid]; }
});

// resize_waiting_size handled in main text handler below

// ─── FILE HANDLER ─────────────────────────────────────────────────────────────
async function handleFile(msg) {
  const chatId = msg.chat.id; const uid = msg.from.id;
  const state = userState[uid];
  let fileId, fileName, fileSize;
  if (msg.document) { fileId=msg.document.file_id; fileName=msg.document.file_name||'file'; fileSize=msg.document.file_size; }
  else if (msg.photo) { fileId=msg.photo[msg.photo.length-1].file_id; fileName='photo.jpg'; fileSize=msg.photo[msg.photo.length-1].file_size; }
  else if (msg.audio) { fileId=msg.audio.file_id; fileName=msg.audio.file_name||'audio.mp3'; fileSize=msg.audio.file_size; }
  else if (msg.video) { fileId=msg.video.file_id; fileName=msg.video.file_name||'video.mp4'; fileSize=msg.video.file_size; }
  else if (msg.voice) { fileId=msg.voice.file_id; fileName='voice.ogg'; fileSize=msg.voice.file_size; }
  else return;
  saveUser(msg).catch(() => {});
  const ext = path.extname(fileName).toLowerCase().replace('.', '');

  // ── CHAT MODE: handle image in AI chat ──────────────────────────────────────
  if (state && state.mode === 'chat') {
    // If there's a pending action, handle it
    if (state.pendingAction === 'removebg' && msg.photo) {
      delete state.pendingAction; userState[uid] = state;
      const sm = await bot.sendMessage(chatId, '✂️ Removing background...');
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rbg-'));
      try {
        const inp = path.join(tmpDir, 'input.jpg');
        const out = path.join(tmpDir, 'output.png');
        await downloadFile(fileId, inp);
        await removeBackground(inp, out);
        await bot.editMessageText('✅ Background removed!', { chat_id: chatId, message_id: sm.message_id });
        await bot.sendDocument(chatId, out, { caption: '✂️ Background removed!' });
      } catch(e) { await bot.editMessageText('❌ Failed: ' + e.message, { chat_id: chatId, message_id: sm.message_id }); }
      finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
      return;
    }
    if (state.pendingAction === 'ocr' && msg.photo) {
      delete state.pendingAction; userState[uid] = state;
      const sm = await bot.sendMessage(chatId, '🔍 Extracting text...');
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-'));
      try {
        const inp = path.join(tmpDir, 'input.jpg');
        await downloadFile(fileId, inp);
        const r = await require('tesseract.js').recognize(inp, 'eng');
        const raw = r.data.text.trim();
        if (!raw) { await bot.editMessageText('No text found in image.', { chat_id: chatId, message_id: sm.message_id }); return; }
        let final = raw; let ai = false;
        try { final = await enhanceOcrWithGroq(raw); ai = true; } catch(e) {}
        await bot.editMessageText('✅ Done!', { chat_id: chatId, message_id: sm.message_id });
        const label = (ai ? '✨ AI Enhanced Text:\n\n' : 'Extracted Text:\n\n');
        if (final.length > 4000) {
          const tp = path.join(tmpDir, 'text.txt'); fs.writeFileSync(tp, final);
          await bot.sendDocument(chatId, tp, { caption: ai ? '✨ AI Enhanced OCR' : 'Extracted text' });
        } else { await bot.sendMessage(chatId, label + final); }
      } catch(e) { await bot.editMessageText('❌ Failed: ' + e.message, { chat_id: chatId, message_id: sm.message_id }); }
      finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
      return;
    }
    // No pending action — AI describes the image and asks what to do
    if (msg.photo) {
      const sm = await bot.sendMessage(chatId, '🔍 Looking at your image...');
      try {
        // Download image and analyse with OCR first for context
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-img-'));
        const inp = path.join(tmpDir, 'input.jpg');
        await downloadFile(fileId, inp);
        const r = await require('tesseract.js').recognize(inp, 'eng');
        const rawText = r.data.text.trim();
        fs.rmSync(tmpDir, { recursive: true, force: true });
        // Ask Pollinations to describe and suggest actions
        const context = rawText ? `The image contains this text: "${rawText.slice(0, 500)}"` : 'The image contains no readable text.';
        const GROQ_KEY2 = process.env.GROQ_KEY || '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';
        const resp = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: 'You are GENZ Assistant in a Telegram bot. The user sent an image. Briefly describe what you can tell about it from its text content, then suggest what they might want to do (remove background, extract text, compress, convert to PDF). Keep it short and friendly.' },
            { role: 'user', content: context + '\n\nThe user sent this image. What can I help them with?' }
          ],
          max_tokens: 300, temperature: 0.7
        }, {
          headers: { 'Authorization': 'Bearer ' + GROQ_KEY2, 'Content-Type': 'application/json' },
          timeout: 20000
        });
        const reply = resp.data.choices[0].message.content.trim();
        state.history.push({ role: 'user', content: '[Sent an image]' });
        state.history.push({ role: 'assistant', content: reply });
        userState[uid] = state;
        await bot.editMessageText(reply, {
          chat_id: chatId, message_id: sm.message_id,
          reply_markup: { inline_keyboard: [
            [{ text: '✂️ Remove BG', callback_data: 'chat_action:removebg' }, { text: '🔍 Extract Text', callback_data: 'chat_action:ocr' }],
            [{ text: '❌ End Chat', callback_data: 'endchat' }]
          ]}
        });
      } catch(e) {
        await bot.editMessageText('I can see you sent an image! What would you like me to do with it?\n\n✂️ Remove background\n🔍 Extract text', { chat_id: chatId, message_id: sm.message_id });
      }
      return;
    }
  }

  const runWithTmp = async (prefix, fn) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    try { await fn(tmpDir); } catch (e) { bot.sendMessage(chatId, 'Failed: ' + e.message); }
    finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
  };

  if (state && state.mode === 'ocr') {
    delete userState[uid];
    const _prem = await isPremium(uid);
    if (!_prem) { const _dc = await getDailyCount(uid); if (_dc >= FREE_LIMIT) return sendUpgradeMessage(chatId, await getTimeUntilReset(uid), uid); }
    return runWithTmp('ocr-', async (d) => {
      const inp = path.join(d, 'i.' + ext);
      const sm = await bot.sendMessage(chatId, await t(uid, 'extracting_text'));
      await downloadFile(fileId, inp);
      const r = await require('tesseract.js').recognize(inp, 'eng');
      const rawText = r.data.text.trim();
      if (!rawText) {
        await bot.editMessageText(await t(uid, 'done'), { chat_id: chatId, message_id: sm.message_id });
        await bot.sendMessage(chatId, await t(uid, 'no_text_found'));
        return;
      }
      // Try Groq AI enhancement, fallback to raw text silently
      let finalText = rawText;
      let aiEnhanced = false;
      try {
        await bot.editMessageText('🤖 Enhancing with AI...', { chat_id: chatId, message_id: sm.message_id });
        finalText = await enhanceOcrWithGroq(rawText);
        aiEnhanced = true;
      } catch (e) {
        // Groq failed — log and fall back to raw text
        console.error('[GROQ OCR ERROR]', e.response ? JSON.stringify(e.response.data) : e.message);
        finalText = rawText;
        aiEnhanced = false;
      }
      await bot.editMessageText(await t(uid, 'done'), { chat_id: chatId, message_id: sm.message_id });
      const label = aiEnhanced ? '✨ AI Enhanced Text:\n\n' : 'Extracted Text:\n\n';
      if (finalText.length > 4000) {
        const tp = path.join(d, 'extracted.txt'); fs.writeFileSync(tp, finalText);
        await bot.sendDocument(chatId, tp, { caption: aiEnhanced ? '✨ AI Enhanced OCR result' : 'Extracted text' });
      } else {
        await bot.sendMessage(chatId, label + finalText);
      }
      await addHistory(uid, ext, 'txt', fileName);
    });
  }

  if (state && state.mode === 'compress') {
    delete userState[uid];
    return runWithTmp('cmp-', async (d) => {
      const inp = path.join(d, 'i.' + ext); const out = path.join(d, 'out.' + ext);
      const sm = await bot.sendMessage(chatId, 'Compressing...');
      await downloadFile(fileId, inp); await compressImage(inp, out);
      const inS = fs.statSync(inp).size; const outS = fs.statSync(out).size;
      const saved = Math.round((1 - outS/inS)*100);
      await bot.editMessageText('Done!', { chat_id: chatId, message_id: sm.message_id });
      await bot.sendDocument(chatId, out, { caption: 'Compressed!\nOriginal: '+formatBytes(inS)+'\nNew: '+formatBytes(outS)+'\nSaved: '+saved+'%' });
      await addHistory(uid, ext, ext, fileName);
    });
  }

  if (state && state.mode === 'resize_ready') {
    const { width, height } = state; delete userState[uid];
    return runWithTmp('rsz-', async (d) => {
      const inp = path.join(d, 'i.' + ext); const out = path.join(d, 'out.' + ext);
      await bot.sendMessage(chatId, 'Resizing...');
      await downloadFile(fileId, inp); await resizeImage(inp, out, width, height);
      await bot.sendDocument(chatId, out, { caption: 'Resized to ' + width + 'x' + height });
      await addHistory(uid, ext, ext, fileName);
    });
  }

  if (state && state.mode === 'merge') {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'img-'));
    const inp = path.join(tmpDir, 'img_' + Date.now() + '.' + ext);
    await downloadFile(fileId, inp);
    state.images.push(inp);
    return bot.sendMessage(chatId, 'Image ' + state.images.length + ' added. Send more or /done');
  }

  if (state && state.mode === 'resize_waiting_size') {
    return t(uid, 'send_size').then(m => bot.sendMessage(chatId, m));
  }

  const premium = await isPremium(uid);
  if (!premium) {
    const daily = await getDailyCount(uid);
    if (daily >= FREE_LIMIT) return sendUpgradeMessage(chatId, await getTimeUntilReset(uid), uid);
    if (fileSize && fileSize > MAX_FREE_SIZE) {
      await bot.sendMessage(chatId, await t(uid, 'file_too_large'));
      return sendUpgradeMessage(chatId, await getTimeUntilReset(uid), uid);
    }
  }

  if (!ext || !CONVERSIONS[ext]) return t(uid, 'format_not_supported', {f: (ext||'unknown').toUpperCase()}).then(m => bot.sendMessage(chatId, m));

  const formats = CONVERSIONS[ext];
  userState[uid] = { fileId, fileName, inputExt: ext, fileSize };
  const daily2 = premium ? 0 : await getDailyCount(uid);
  const remaining = premium ? await t(uid, 'unlimited') : await t(uid, 'conversions_left', {n: FREE_LIMIT - daily2});
  const kb = { inline_keyboard: [] };
  let row = [];
  formats.forEach((f, i) => {
    row.push({ text: f.toUpperCase(), callback_data: 'convert:' + f });
    if (row.length === 3 || i === formats.length-1) { kb.inline_keyboard.push(row); row = []; }
  });
  kb.inline_keyboard.push([{ text: 'Cancel', callback_data: 'cancel' }]);
  t(uid, 'convert_to', {ext: ext.toUpperCase(), name: fileName, size: formatBytes(fileSize||0), remaining}).then(m => bot.sendMessage(chatId, m, { reply_markup: kb }));
}

bot.on('message', (msg) => { if (msg.document||msg.photo||msg.audio||msg.video||msg.voice) handleFile(msg); });

// ─── CALLBACK ─────────────────────────────────────────────────────────────────
bot.on('callback_query', async (query) => {
  const uid = query.from.id; const chatId = query.message.chat.id; const msgId = query.message.message_id;
  await bot.answerCallbackQuery(query.id);

  if (query.data === 'endchat') {
    delete userState[uid];
    return bot.editMessageText('Chat ended. Send /chat to start again.', { chat_id: chatId, message_id: msgId });
  }

  if (query.data.startsWith('chat_action:')) {
    const action = query.data.split(':')[1];
    if (!userState[uid]) userState[uid] = { mode: 'chat', history: [] };
    userState[uid].pendingAction = action;
    const prompts = { removebg: '✂️ Now send me the image to remove its background!', ocr: '🔍 Now send me the image to extract text from!' };
    return bot.editMessageText(prompts[action] || 'Send me the image!', { chat_id: chatId, message_id: msgId });
  }

  if (query.data === 'cancel') { delete userState[uid]; return t(uid, 'cancelled').then(m => bot.editMessageText(m, { chat_id: chatId, message_id: msgId })); }

  if (query.data.startsWith('setlang:')) {
    const code = query.data.split(':')[1];
    if (LANGUAGES[code]) {
      await setUserLang(uid, code);
      const langName = LANGUAGES[code].flag + ' ' + LANGUAGES[code].name;
      await bot.editMessageText(await t(uid, 'language_set', {lang: langName}), { chat_id: chatId, message_id: msgId });
    }
    return;
  }

  if (query.data.startsWith('grant:')) {
    if (query.from.id !== ADMIN_ID) return;
    const parts = query.data.split(':'); const targetId = parseInt(parts[1]); const plan = parts[2];
    await grantPremium(targetId, plan);
    const label = plan === 'lifetime' ? 'Lifetime' : plan + ' Days';
    await bot.editMessageText('Premium activated!\nUser: ' + targetId + '\nPlan: ' + label, { chat_id: chatId, message_id: msgId });
    try { await bot.sendMessage(targetId, 'Your Premium is now active!\nPlan: ' + label + '\nEnjoy unlimited conversions and 50MB files!'); } catch (e) {}
    return;
  }

  if (!query.data.startsWith('convert:')) return;
  const outputFmt = query.data.split(':')[1];
  const state = userState[uid];
  if (!state) return t(uid, 'session_expired').then(m => bot.editMessageText(m, { chat_id: chatId, message_id: msgId }));
  const { fileId, fileName, inputExt, fileSize } = state;

  await bot.editMessageText('Converting ' + inputExt.toUpperCase() + ' to ' + outputFmt.toUpperCase() + '\n[###.......] 30%', { chat_id: chatId, message_id: msgId });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'conv-'));
  const inputPath = path.join(tmpDir, 'i.' + inputExt);
  const outName = path.basename(fileName, path.extname(fileName)) + '.' + outputFmt;
  const outputPath = path.join(tmpDir, outName);

  try {
    await downloadFile(fileId, inputPath);
    await bot.editMessageText('Converting ' + inputExt.toUpperCase() + ' to ' + outputFmt.toUpperCase() + '\n[######....] 60%', { chat_id: chatId, message_id: msgId });
    await convertFile(inputPath, inputExt, outputPath, outputFmt);
    await bot.editMessageText('Converting ' + inputExt.toUpperCase() + ' to ' + outputFmt.toUpperCase() + '\n[#########.] 90%', { chat_id: chatId, message_id: msgId });
    const inSize = fileSize || fs.statSync(inputPath).size;
    const outSize = fs.statSync(outputPath).size;
    await bot.editMessageText('Done! [##########] 100%', { chat_id: chatId, message_id: msgId });
    await bot.sendDocument(chatId, outputPath, { caption: 'Converted!\nOriginal: '+formatBytes(inSize)+'\nOutput: '+formatBytes(outSize)+'\n'+fileName+' to '+outName });
    await addHistory(uid, inputExt, outputFmt, fileName);
    await countReferralConversion(uid);
    const premium = await isPremium(uid);
    if (!premium) {
      await incrementDailyCount(uid);
      const newCount = await getDailyCount(uid);
      const left = FREE_LIMIT - newCount;
      if (left > 0) await bot.sendMessage(chatId, 'You have ' + left + ' free conversion' + (left===1?'':'s') + ' left today.');
    }
    delete userState[uid];
  } catch (err) {
    bot.editMessageText('Failed: ' + err.message, { chat_id: chatId, message_id: msgId });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

console.log('Bot started!');

// ─── BACKGROUND REMOVER ───────────────────────────────────────────────────────
async function removeBackground(inputPath, outputPath) {
  const REMOVEBG_KEY = process.env.REMOVEBG_KEY || 'Dr9ZYW2uA7G5G2qB9tc7dTxv';
  const FormData = require('form-data');
  const form = new FormData();
  form.append('image_file', fs.createReadStream(inputPath), { filename: 'image.png', contentType: 'image/png' });
  form.append('size', 'auto');
  const response = await axios.post(
    'https://api.remove.bg/v1.0/removebg',
    form,
    {
      headers: {
        ...form.getHeaders(),
        'X-Api-Key': REMOVEBG_KEY
      },
      responseType: 'arraybuffer',
      timeout: 60000
    }
  );
  fs.writeFileSync(outputPath, Buffer.from(response.data));
}

// ─── VIDEO TO GIF ─────────────────────────────────────────────────────────────
async function videoToGif(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = require('fluent-ffmpeg');
    const palettePath = outputPath + '.palette.png';
    ffmpeg(inputPath)
      .outputOptions(['-vf', 'fps=10,scale=480:-1:flags=lanczos,palettegen'])
      .output(palettePath)
      .on('end', () => {
        ffmpeg(inputPath)
          .input(palettePath)
          .complexFilter(['fps=10,scale=480:-1:flags=lanczos[x];[x][1:v]paletteuse'])
          .output(outputPath)
          .on('end', () => { try { fs.unlinkSync(palettePath); } catch(e) {} resolve(); })
          .on('error', reject)
          .run();
      })
      .on('error', reject)
      .run();
  });
}

// ─── IMAGE TO STICKER ─────────────────────────────────────────────────────────
async function imageToSticker(inputPath, outputPath) {
  const sharp = require('sharp');
  await sharp(inputPath)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90 })
    .toFile(outputPath);
}

// ─── CREATE FILE FROM TEXT ────────────────────────────────────────────────────
async function createPdfFromText(text, outputPath) {
  const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const lines = text.split('\n');
  let page = pdf.addPage([595, 842]);
  const { width, height } = page.getSize();
  let y = height - 50;
  const size = 12;
  const lineH = size * 1.4;
  const margin = 50;
  const maxW = width - margin * 2;
  for (const line of lines) {
    const words = line.split(' ');
    let current = '';
    for (const word of words) {
      const test = current ? current + ' ' + word : word;
      const tw = font.widthOfTextAtSize(test, size);
      if (tw > maxW && current) {
        if (y < 50) { page = pdf.addPage([595, 842]); y = height - 50; }
        page.drawText(current, { x: margin, y, size, font, color: rgb(0,0,0) });
        y -= lineH; current = word;
      } else { current = test; }
    }
    if (current) {
      if (y < 50) { page = pdf.addPage([595, 842]); y = height - 50; }
      page.drawText(current, { x: margin, y, size, font, color: rgb(0,0,0) });
      y -= lineH;
    }
    y -= lineH * 0.3;
  }
  fs.writeFileSync(outputPath, await pdf.save());
}

// ─── PROMO CODES ──────────────────────────────────────────────────────────────
async function redeemPromoCode(userId, code) {
  const upper = code.toUpperCase().trim();
  const { data: promo } = await supabase.from('promo_codes').select('*').eq('code', upper).single();
  if (!promo) return { success: false, msg: 'Invalid promo code.' };
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) return { success: false, msg: 'This code has expired.' };
  if (promo.used_count >= promo.max_uses) return { success: false, msg: 'This code has been fully used.' };
  const { error: useErr } = await supabase.from('promo_uses').insert({ code: upper, user_id: userId });
  if (useErr) return { success: false, msg: 'You have already used this code.' };
  await supabase.from('promo_codes').update({ used_count: promo.used_count + 1 }).eq('code', upper);
  await grantPremium(userId, String(promo.days));
  return { success: true, days: promo.days };
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
async function trackEvent(event, userId, metadata = {}) {
  try {
    await supabase.from('analytics').insert({ event, user_id: userId, metadata });
  } catch (e) {}
}

async function getAnalytics() {
  try {
    const now = new Date();
    const week = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const { data: convs } = await supabase.from('conversion_history')
      .select('from_fmt, to_fmt').gte('created_at', week.toISOString());
    const fmtCount = {};
    for (const c of convs || []) {
      const key = c.from_fmt + ' to ' + c.to_fmt;
      fmtCount[key] = (fmtCount[key] || 0) + 1;
    }
    const sorted = Object.entries(fmtCount).sort((a,b) => b[1]-a[1]).slice(0, 5);
    const { count: totalUsers } = await supabase.from('bot_users').select('*', { count: 'exact', head: true });
    const { count: weeklyConvs } = await supabase.from('conversion_history')
      .select('*', { count: 'exact', head: true }).gte('created_at', week.toISOString());
    const { count: totalConvs } = await supabase.from('conversion_history')
      .select('*', { count: 'exact', head: true });
    const premUsers = await getPremiumUsers();
    return { totalUsers, totalConvs, weeklyConvs, sorted, premUsers: premUsers.length };
  } catch (e) { return null; }
}

// ─── NEW BOT COMMANDS ─────────────────────────────────────────────────────────

// BROADCAST
bot.onText(/\/broadcast(@\w+)?(.*)/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return bot.sendMessage(msg.chat.id, 'Admin only.');
  const message = (match[2] || '').trim();
  if (!message) return bot.sendMessage(msg.chat.id, 'Usage: /broadcast Your message here');
  const statusMsg = await bot.sendMessage(msg.chat.id, 'Starting broadcast...');
  try {
    const { data: users } = await supabase.from('bot_users').select('user_id');
    const total = (users || []).length;
    let sent = 0; let failed = 0; let count = 0;
    for (const u of users || []) {
      try {
        await bot.sendMessage(u.user_id, '📢 Announcement\n\n' + message);
        sent++;
      } catch (e) { failed++; }
      count++;
      // Update progress every 10 users
      if (count % 10 === 0 || count === total) {
        try {
          await bot.editMessageText(
            'Broadcasting... ' + count + '/' + total + '\nSent: ' + sent + ' | Failed: ' + failed,
            { chat_id: msg.chat.id, message_id: statusMsg.message_id }
          );
        } catch(e) {}
      }
      // Telegram allows 30 messages/second — wait 50ms between each
      await new Promise(r => setTimeout(r, 50));
    }
    await bot.editMessageText(
      'Broadcast complete!\n\nTotal users: ' + total + '\nSuccessfully sent: ' + sent + '\nFailed: ' + failed,
      { chat_id: msg.chat.id, message_id: statusMsg.message_id }
    );
  } catch (e) {
    bot.editMessageText('Broadcast failed: ' + e.message, { chat_id: msg.chat.id, message_id: statusMsg.message_id });
  }
});

// ANALYTICS
bot.onText(/\/analytics/, async (msg) => {
  if (msg.from.id !== ADMIN_ID) return bot.sendMessage(msg.chat.id, 'Admin only.');
  const data = await getAnalytics();
  if (!data) return bot.sendMessage(msg.chat.id, 'Could not load analytics.');
  let text = 'ANALYTICS\n\n';
  text += 'Total users: ' + data.totalUsers + '\n';
  text += 'Premium users: ' + data.premUsers + '\n';
  text += 'Total conversions: ' + data.totalConvs + '\n';
  text += 'This week: ' + data.weeklyConvs + '\n\n';
  text += 'TOP CONVERSIONS (7 days):\n';
  if (data.sorted.length) {
    data.sorted.forEach((s, i) => { text += (i+1) + '. ' + s[0].toUpperCase() + ' - ' + s[1] + 'x\n'; });
  } else { text += 'No data yet.'; }
  bot.sendMessage(msg.chat.id, text);
});

// PROMO CODE CREATION
bot.onText(/\/createcode (.+)/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return bot.sendMessage(msg.chat.id, 'Admin only.');
  const parts = match[1].trim().split(' ');
  if (parts.length < 2) return bot.sendMessage(msg.chat.id, 'Usage: /createcode CODE DAYS [MAX_USES]\n\nExample: /createcode GENZ2025 7 100');
  const code = parts[0].toUpperCase();
  const days = parseInt(parts[1]);
  const maxUses = parts[2] ? parseInt(parts[2]) : 1;
  if (isNaN(days) || days < 1) return bot.sendMessage(msg.chat.id, 'Invalid days.');
  try {
    await supabase.from('promo_codes').insert({ code, days, max_uses: maxUses, used_count: 0 });
    bot.sendMessage(msg.chat.id, 'Promo code created!\n\nCode: ' + code + '\nDays: ' + days + '\nMax uses: ' + maxUses);
  } catch (e) { bot.sendMessage(msg.chat.id, 'Failed: Code may already exist.'); }
});

// REDEEM PROMO CODE
bot.onText(/\/redeem/, (msg) => {
  userState[msg.from.id] = { mode: 'redeem' };
  t(msg.from.id, 'send_promo_code').then(m => bot.sendMessage(msg.chat.id, m));
});

// TTS temporarily disabled

// CHATBOT
bot.onText(/\/chat/, async (msg) => {
  const uid = msg.from.id;
  await getUserLang(uid);
  userState[uid] = { mode: 'chat', history: [] };
  bot.sendMessage(msg.chat.id,
    '🤖 GENZ Assistant is ready!\n\nI can:\n• Answer any question\n• Generate images\n• Remove backgrounds\n• Extract text from images\n• Create QR codes\n• Change language\n• And more!\n\nJust type or send an image!',
    { reply_markup: { inline_keyboard: [[{ text: '❌ End Chat', callback_data: 'endchat' }]] } }
  );
});

// AI IMAGE GENERATION
bot.onText(/\/img/, async (msg) => {
  const uid = msg.from.id;
  await getUserLang(uid);
  const premium = await isPremium(uid);
  if (!premium) {
    const daily = await getDailyCount(uid);
    if (daily >= FREE_LIMIT) return sendUpgradeMessage(msg.chat.id, await getTimeUntilReset(uid), uid);
  }
  userState[uid] = { mode: 'createimg' };
  t(uid, 'send_createimg').then(m => bot.sendMessage(msg.chat.id, m));
});

// BACKGROUND REMOVER
bot.onText(/\/removebg/, (msg) => {
  userState[msg.from.id] = { mode: 'removebg' };
  t(msg.from.id, 'send_image_removebg').then(m => bot.sendMessage(msg.chat.id, m));
});

// VIDEO TO GIF
bot.onText(/\/gif/, (msg) => {
  userState[msg.from.id] = { mode: 'videogif' };
  t(msg.from.id, 'send_video_gif').then(m => bot.sendMessage(msg.chat.id, m));
});

// IMAGE TO STICKER
bot.onText(/\/sticker/, (msg) => {
  userState[msg.from.id] = { mode: 'sticker' };
  t(msg.from.id, 'send_image_sticker').then(m => bot.sendMessage(msg.chat.id, m));
});

// CREATE FILE
bot.onText(/\/create/, (msg) => {
  userState[msg.from.id] = { mode: 'create_waiting_text' };
  bot.sendMessage(msg.chat.id, 'What do you want to create?\n\n/createpdf - Create PDF from text\n/createtxt - Create TXT file\n/createcsv - Create CSV file');
});

bot.onText(/\/createpdf/, (msg) => {
  userState[msg.from.id] = { mode: 'create_pdf' };
  t(msg.from.id, 'send_text_pdf').then(m => bot.sendMessage(msg.chat.id, m));
});

bot.onText(/\/createtxt/, (msg) => {
  userState[msg.from.id] = { mode: 'create_txt' };
  t(msg.from.id, 'send_text_txt').then(m => bot.sendMessage(msg.chat.id, m));
});


// ─── UPDATED TEXT HANDLER ─────────────────────────────────────────────────────
// Override the existing text handler for new modes
bot.on('text', async (msg) => {
  if (msg.text.startsWith('/')) return;
  const uid = msg.from.id;
  const state = userState[uid];
  if (!state) return;

  if (state.mode === 'resize_waiting_size') {
    const m = msg.text.trim().match(/^(\d+)[xX](\d+)$/);
    if (!m) return t(uid, 'invalid_size').then(m2 => bot.sendMessage(msg.chat.id, m2));
    userState[uid] = { mode: 'resize_ready', width: parseInt(m[1]), height: parseInt(m[2]) };
    return t(uid, 'size_set', {w: m[1], h: m[2]}).then(m2 => bot.sendMessage(msg.chat.id, m2));
  }

  if (state.mode === 'qr') {
    delete userState[uid];
    const qrText = msg.text;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-'));
    const outputPath = path.join(tmpDir, 'qrcode.png');
    try {
      await bot.sendMessage(msg.chat.id, await t(uid, 'qr_generating'));
      await generateQR(qrText, outputPath);
      await bot.sendPhoto(msg.chat.id, outputPath, { caption: 'QR code for: ' + qrText });
    } catch (e) { t(uid, 'failed', {e: e.message}).then(m => bot.sendMessage(msg.chat.id, m)); }
    finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    return;
  }

  if (state.mode === 'redeem') {
    delete userState[uid];
    const code = msg.text.trim();
    const result = await redeemPromoCode(uid, code);
    if (result.success) {
      t(uid, 'promo_success', {days: result.days}).then(m => bot.sendMessage(msg.chat.id, m));
      await trackEvent('promo_redeemed', uid, { code });
    } else {
      t(uid, 'promo_failed', {msg: result.msg}).then(m => bot.sendMessage(msg.chat.id, m));
    }
    return;
  }

  if (state.mode === 'createimg') {
    delete userState[uid];
    const prompt = msg.text.trim();
    const sm = await bot.sendMessage(msg.chat.id, await t(uid, 'generating_img'));
    try {
      const premium = await isPremium(uid);
      if (!premium) {
        const daily = await getDailyCount(uid);
        if (daily >= FREE_LIMIT) {
          await bot.deleteMessage(msg.chat.id, sm.message_id).catch(()=>{});
          return sendUpgradeMessage(msg.chat.id, await getTimeUntilReset(uid), uid);
        }
        await incrementDailyCount(uid);
      }
      const HF_KEY = process.env.HF_KEY || '';
      const POLLINATIONS_KEY = process.env.POLLINATIONS_KEY || '';
      const seed = Math.floor(Math.random() * 999999);
      let sent = false;

      // ── Method 1: Hugging Face (FLUX.1-schnell) ───────────────────────────
      if (HF_KEY) {
        try {
          console.log('[IMG] Trying Hugging Face...');
          const hfResp = await axios.post(
            'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
            { inputs: prompt + ', high quality, detailed, 4K' },
            {
              headers: { 'Authorization': 'Bearer ' + HF_KEY, 'Content-Type': 'application/json', 'Accept': 'image/png' },
              responseType: 'arraybuffer',
              timeout: 60000
            }
          );
          const ct = hfResp.headers['content-type'] || '';
          if (ct.includes('image') && hfResp.data.byteLength > 1000) {
            const imgBuf = Buffer.from(hfResp.data);
            await bot.deleteMessage(msg.chat.id, sm.message_id).catch(()=>{});
            await bot.sendPhoto(msg.chat.id, imgBuf, { caption: 'Generated: ' + prompt });
            await addHistory(uid, 'prompt', 'image', prompt.slice(0, 50));
            sent = true;
          } else {
            throw new Error('Non-image response: ' + ct);
          }
        } catch(hfErr) {
          let detail = hfErr.message;
          if (hfErr.response && hfErr.response.data) {
            try { detail = Buffer.from(hfErr.response.data).toString('utf8'); } catch(e2) {}
          }
          console.log('[IMG] Hugging Face failed:', detail);
        }
      }

      // ── Method 2: Pollinations fallback ───────────────────────────────────
      if (!sent) {
        try {
          console.log('[IMG] Trying Pollinations...');
          const encodedPrompt = encodeURIComponent(prompt + ', high quality, detailed');
          const polUrl = 'https://image.pollinations.ai/prompt/' + encodedPrompt +
            '?width=1024&height=1024&nologo=true&seed=' + seed + '&model=flux' +
            (POLLINATIONS_KEY ? '&key=' + POLLINATIONS_KEY : '');
          const imgResp = await axios({
            method: 'get', url: polUrl, responseType: 'arraybuffer',
            timeout: 120000, headers: { 'User-Agent': 'Mozilla/5.0' }, maxRedirects: 10
          });
          const ct = imgResp.headers['content-type'] || '';
          if (ct.includes('image') && imgResp.data.byteLength > 1000) {
            const imgBuf = Buffer.from(imgResp.data);
            await bot.deleteMessage(msg.chat.id, sm.message_id).catch(()=>{});
            await bot.sendPhoto(msg.chat.id, imgBuf, { caption: 'Generated: ' + prompt });
            await addHistory(uid, 'prompt', 'image', prompt.slice(0, 50));
            sent = true;
          } else {
            throw new Error('Non-image response: ' + ct);
          }
        } catch(polErr) {
          console.log('[IMG] Pollinations failed:', polErr.message);
        }
      }

      if (!sent) throw new Error('Image generation failed. Please try again later.');
    } catch(e) {
      console.error('[CREATEIMG ERROR]', e.message);
      await bot.editMessageText('Image generation failed: ' + e.message.slice(0,100), { chat_id: msg.chat.id, message_id: sm.message_id }).catch(()=>{});
    }
    return;
  }

  if (state.mode === 'chat') {
    const userMsg = msg.text.trim();
    if (!state.history) state.history = [];
    state.history.push({ role: 'user', content: userMsg });
    // Keep last 10 messages to avoid token overflow
    if (state.history.length > 50) state.history = state.history.slice(-50);
    const sm = await bot.sendMessage(msg.chat.id, await t(uid, 'chat_thinking'));
    try {
      // Try Groq first (fast, reliable), fallback to Pollinations
      let reply;
      try {
        const GROQ_KEY3 = process.env.GROQ_KEY || '';
        if (!GROQ_KEY3) throw new Error('No Groq key');
        const groqResp = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: 'You are GENZ Assistant inside GENZ_CONVERTER Telegram bot. Be helpful, concise and friendly.' },
            ...state.history.slice(-20)
          ],
          max_tokens: 2048, temperature: 0.7
        }, { headers: { 'Authorization': 'Bearer ' + GROQ_KEY3, 'Content-Type': 'application/json' }, timeout: 30000 });
        reply = groqResp.data.choices[0].message.content.trim();
      } catch(groqErr) {
        console.log('[CHAT] Groq failed, trying Pollinations:', groqErr.message);
        const pollResp = await axios.post('https://text.pollinations.ai/openai', {
          model: 'openai',
          messages: [
            { role: 'system', content: 'You are GENZ Assistant inside GENZ_CONVERTER Telegram bot. Be helpful, concise and friendly.' },
            ...state.history.slice(-20)
          ],
          max_tokens: 1024, temperature: 0.7, private: true
        }, { headers: { 'Content-Type': 'application/json' }, timeout: 40000 });
        reply = pollResp.data.choices[0].message.content.trim();
      }
      state.history.push({ role: 'assistant', content: reply });
      userState[uid] = state;
      // Split long replies
      if (reply.length > 4000) {
        await bot.editMessageText(reply.slice(0, 4000), { chat_id: msg.chat.id, message_id: sm.message_id, reply_markup: { inline_keyboard: [[{ text: '❌ End Chat', callback_data: 'endchat' }]] } });
        await bot.sendMessage(msg.chat.id, reply.slice(4000));
      } else {
        await bot.editMessageText(reply, { chat_id: msg.chat.id, message_id: sm.message_id, reply_markup: { inline_keyboard: [[{ text: '❌ End Chat', callback_data: 'endchat' }]] } });
      }
    } catch(e) {
      console.error('[CHAT ERROR]', e.message);
      await bot.editMessageText('❌ ' + e.message.slice(0, 100), { chat_id: msg.chat.id, message_id: sm.message_id });
    }
    return;
  }

  if (state.mode === 'create_pdf') {
    delete userState[uid];
    const text = msg.text;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-'));
    const outputPath = path.join(tmpDir, 'document.pdf');
    try {
      const sm = await bot.sendMessage(msg.chat.id, 'Creating PDF...');
      await createPdfFromText(text, outputPath);
      await bot.editMessageText('Done!', { chat_id: msg.chat.id, message_id: sm.message_id });
      await bot.sendDocument(msg.chat.id, outputPath, { caption: 'Your PDF is ready! Size: ' + formatBytes(fs.statSync(outputPath).size) });
      await addHistory(uid, 'text', 'pdf', 'document.pdf');
      await trackEvent('create_pdf', uid, {});
    } catch (e) { bot.sendMessage(msg.chat.id, 'Failed: ' + e.message); }
    finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    return;
  }

  if (state.mode === 'create_txt') {
    delete userState[uid];
    const text = msg.text;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-'));
    const outputPath = path.join(tmpDir, 'document.txt');
    try {
      fs.writeFileSync(outputPath, text);
      await bot.sendDocument(msg.chat.id, outputPath, { caption: 'Your TXT file is ready!' });
      await addHistory(uid, 'text', 'txt', 'document.txt');
    } catch (e) { bot.sendMessage(msg.chat.id, 'Failed: ' + e.message); }
    finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    return;
  }
});

// ─── UPDATED FILE HANDLER FOR NEW MODES ──────────────────────────────────────
// Patch handleFile to support removebg, videogif, sticker
const _origHandleFile = handleFile;
async function handleFileExtended(msg) {
  const uid = msg.from.id;
  const state = userState[uid];
  let fileId, fileName, fileSize;
  if (msg.document) { fileId=msg.document.file_id; fileName=msg.document.file_name||'file'; fileSize=msg.document.file_size; }
  else if (msg.photo) { fileId=msg.photo[msg.photo.length-1].file_id; fileName='photo.jpg'; fileSize=msg.photo[msg.photo.length-1].file_size; }
  else if (msg.audio) { fileId=msg.audio.file_id; fileName=msg.audio.file_name||'audio.mp3'; fileSize=msg.audio.file_size; }
  else if (msg.video) { fileId=msg.video.file_id; fileName=msg.video.file_name||'video.mp4'; fileSize=msg.video.file_size; }
  else if (msg.voice) { fileId=msg.voice.file_id; fileName='voice.ogg'; fileSize=msg.voice.file_size; }
  else return;

  const ext = path.extname(fileName).toLowerCase().replace('.', '');
  const chatId = msg.chat.id;

  // Background remover
  if (state && state.mode === 'removebg') {
    delete userState[uid];
    const _prem2 = await isPremium(uid);
    if (!_prem2) { const _dc2 = await getDailyCount(uid); if (_dc2 >= FREE_LIMIT) return sendUpgradeMessage(chatId, await getTimeUntilReset(uid), uid); }
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bg-'));
    const inputPath = path.join(tmpDir, 'input.' + ext);
    const outputPath = path.join(tmpDir, 'nobg.png');
    try {
      const sm = await bot.sendMessage(chatId, 'Removing background... this may take 10-20 seconds.');
      await downloadFile(fileId, inputPath);
      await removeBackground(inputPath, outputPath);
      await bot.editMessageText('Done!', { chat_id: chatId, message_id: sm.message_id });
      await bot.sendDocument(chatId, outputPath, { caption: 'Background removed! Size: ' + formatBytes(fs.statSync(outputPath).size) });
      await addHistory(uid, ext, 'png', fileName);
      await trackEvent('removebg', uid, {});
    } catch (e) { bot.sendMessage(chatId, 'Failed: ' + e.message); }
    finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    return;
  }

  // Video to GIF
  if (state && state.mode === 'videogif') {
    delete userState[uid];
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gif-'));
    const inputPath = path.join(tmpDir, 'input.' + ext);
    const outputPath = path.join(tmpDir, 'output.gif');
    try {
      const sm = await bot.sendMessage(chatId, 'Converting to GIF... please wait.');
      await downloadFile(fileId, inputPath);
      await videoToGif(inputPath, outputPath);
      await bot.editMessageText('Done!', { chat_id: chatId, message_id: sm.message_id });
      await bot.sendDocument(chatId, outputPath, { caption: 'GIF ready! Size: ' + formatBytes(fs.statSync(outputPath).size) });
      await addHistory(uid, ext, 'gif', fileName);
      await trackEvent('video_to_gif', uid, {});
    } catch (e) { bot.sendMessage(chatId, 'Failed: ' + e.message); }
    finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    return;
  }

  // Image to sticker
  if (state && state.mode === 'sticker') {
    delete userState[uid];
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stk-'));
    const inputPath = path.join(tmpDir, 'input.' + ext);
    const outputPath = path.join(tmpDir, 'sticker.webp');
    try {
      const sm = await bot.sendMessage(chatId, 'Creating sticker...');
      await downloadFile(fileId, inputPath);
      await imageToSticker(inputPath, outputPath);
      await bot.editMessageText('Done!', { chat_id: chatId, message_id: sm.message_id });
      await bot.sendDocument(chatId, outputPath, { caption: 'Sticker ready! Save this .webp file and add it to your Telegram sticker pack.' });
      await addHistory(uid, ext, 'webp', fileName);
    } catch (e) { bot.sendMessage(chatId, 'Failed: ' + e.message); }
    finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    return;
  }

  // Fall through to original handler
  return _origHandleFile(msg);
}

// Replace message listener with extended version
bot.removeAllListeners('message');
bot.on('message', (msg) => {
  if (msg.document || msg.photo || msg.audio || msg.video || msg.voice) handleFileExtended(msg);
});

// Re-add text handler (bot.on text above)
