const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const RENDER_URL = process.env.RENDER_URL || '';
const PORT = process.env.PORT || 3000;
const CLOUD_CONVERT_KEY = process.env.CLOUD_CONVERT_KEY || '';
const ADMIN_ID = 8995568038;

const SUPABASE_URL = 'https://qtpeyheyqkaqgaqvllnv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── PREMIUM SYSTEM ───────────────────────────────────────────────────────────
const dailyCount = {}; // { userId: { count, date } }
const FREE_LIMIT = 10;
const MAX_FREE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_PREMIUM_SIZE = 50 * 1024 * 1024; // 50MB

async function isPremium(userId) {
  if (userId === ADMIN_ID) return true;
  const { data } = await supabase.from('bot_users')
    .select('premium_until, lifetime')
    .eq('user_id', userId).single();
  if (!data) return false;
  if (data.lifetime) return true;
  if (data.premium_until && new Date(data.premium_until) > new Date()) return true;
  return false;
}

async function grantPremium(userId, plan) {
  if (plan === 'lifetime') {
    await supabase.from('bot_users').upsert({ user_id: userId, lifetime: true, premium_until: null }, { onConflict: 'user_id' });
  } else {
    const days = parseInt(plan);
    const until = new Date();
    until.setDate(until.getDate() + days);
    await supabase.from('bot_users').upsert({ user_id: userId, lifetime: false, premium_until: until.toISOString() }, { onConflict: 'user_id' });
  }
}

async function revokePremium(userId) {
  await supabase.from('bot_users').update({ lifetime: false, premium_until: null }).eq('user_id', userId);
}

function canConvert(userId, fileSize) {
  if (userId === ADMIN_ID) return { ok: true };
  const today = new Date().toDateString();
  if (!dailyCount[userId] || dailyCount[userId].date !== today) {
    dailyCount[userId] = { count: 0, date: today };
  }
  if (dailyCount[userId].count >= FREE_LIMIT) return { ok: false, reason: 'limit' };
  if (fileSize && fileSize > MAX_FREE_SIZE) return { ok: false, reason: 'size' };
  return { ok: true };
}

function incrementDailyCount(userId) {
  const today = new Date().toDateString();
  if (!dailyCount[userId] || dailyCount[userId].date !== today) {
    dailyCount[userId] = { count: 0, date: today };
  }
  dailyCount[userId].count++;
}

async function sendUpgradeMessage(chatId) {
  const keyboard = {
    inline_keyboard: [[
      { text: '💬 Chat on WhatsApp', url: 'https://wa.me/2348028383053' }
    ]]
  };
  await bot.sendMessage(chatId,
    '❌ *You have used your 10 free conversions today.*

' +
    '💎 *Upgrade to Premium*

' +
    '✅ Unlimited conversions
' +
    '✅ Files up to 50MB
' +
    '✅ All features unlocked

' +
    '*💰 Pricing:*
' +
    '• 30 Days → ₦1,500
' +
    '• Lifetime → ₦5,000

' +
    '*How to upgrade:*
' +
    '1️⃣ Send /myid to get your Telegram ID
' +
    '2️⃣ Send your ID + payment proof to WhatsApp
' +
    '3️⃣ We activate within minutes!
',
    { parse_mode: 'Markdown', reply_markup: keyboard }
  );
}

async function saveUser(msg) {
  const userId = msg.from.id;
  const { error } = await supabase.from('bot_users').upsert({
    user_id: userId,
    name: msg.from.first_name || 'Unknown',
    username: msg.from.username || '',
    last_active: new Date().toISOString()
  }, { onConflict: 'user_id', ignoreDuplicates: false });
  if (error) console.error('Supabase saveUser error:', error.message);
}

async function incrementConversions(userId) {
  const { data } = await supabase.from('bot_users').select('total_conversions').eq('user_id', userId).single();
  const current = data?.total_conversions || 0;
  await supabase.from('bot_users').update({ total_conversions: current + 1, last_active: new Date().toISOString() }).eq('user_id', userId);
}

async function getTotalUsers() {
  const { count } = await supabase.from('bot_users').select('*', { count: 'exact', head: true });
  return count || 0;
}

async function getTotalConversions() {
  const { data } = await supabase.from('bot_users').select('total_conversions');
  return (data || []).reduce((sum, u) => sum + (u.total_conversions || 0), 0);
}

const app = express();
app.use(express.json());
app.get('/', (req, res) => res.send('File Converter Bot is running!'));

let bot;
if (RENDER_URL) {
  bot = new TelegramBot(BOT_TOKEN);
  bot.setWebHook(`${RENDER_URL}/bot${BOT_TOKEN}`);
  app.post(`/bot${BOT_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });
} else {
  bot = new TelegramBot(BOT_TOKEN, { polling: true });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (RENDER_URL) {
    setInterval(() => {
      axios.get(RENDER_URL).catch(() => {});
    }, 4 * 60 * 1000);
  }
});

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const userState = {};
const userHistory = {};
const userStats = {};
const allUsers = {}; // tracks every user who ever messaged

function trackUser(msg) {
  const userId = msg.from.id;
  if (!allUsers[userId]) {
    allUsers[userId] = {
      name: msg.from.first_name || 'Unknown',
      username: msg.from.username || '',
      joined: new Date().toLocaleDateString()
    };
  }
}

function addHistory(userId, from, to, filename) {
  if (!userHistory[userId]) userHistory[userId] = [];
  userHistory[userId].unshift({ from, to, filename, date: new Date().toLocaleDateString() });
  if (userHistory[userId].length > 5) userHistory[userId].pop();
  if (!userStats[userId]) userStats[userId] = { total: 0 };
  userStats[userId].total++;
  incrementConversions(userId).catch(() => {});
}

// ─── CONVERSIONS MAP ──────────────────────────────────────────────────────────
const CONVERSIONS = {
  jpg:  ['png', 'webp', 'bmp', 'gif', 'pdf'],
  jpeg: ['png', 'webp', 'bmp', 'gif', 'pdf'],
  png:  ['jpg', 'webp', 'bmp', 'gif', 'pdf'],
  webp: ['jpg', 'png', 'bmp', 'gif'],
  bmp:  ['jpg', 'png', 'webp', 'gif'],
  gif:  ['jpg', 'png', 'webp', 'mp4'],
  tiff: ['jpg', 'png', 'webp', 'pdf'],
  tif:  ['jpg', 'png', 'webp', 'pdf'],
  pdf:  ['txt'],
  txt:  ['pdf'],
  docx: ['txt', 'pdf'],
  xlsx: ['csv'],
  csv:  ['xlsx'],
  mp3:  ['wav', 'ogg', 'flac', 'aac', 'm4a'],
  wav:  ['mp3', 'ogg', 'flac', 'aac'],
  ogg:  ['mp3', 'wav', 'flac'],
  flac: ['mp3', 'wav', 'ogg'],
  aac:  ['mp3', 'wav', 'ogg'],
  m4a:  ['mp3', 'wav', 'ogg'],
  mp4:  ['avi', 'mov', 'mkv', 'webm', 'gif', 'mp3'],
  avi:  ['mp4', 'mov', 'mkv', 'mp3'],
  mov:  ['mp4', 'avi', 'mkv', 'mp3'],
  mkv:  ['mp4', 'avi', 'mov', 'mp3'],
  webm: ['mp4', 'avi', 'mov', 'gif'],
  flv:  ['mp4', 'avi', 'mkv', 'mp3'],
};

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── DOWNLOAD ─────────────────────────────────────────────────────────────────
async function downloadFile(fileId, destPath) {
  const fileInfo = await bot.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileInfo.file_path}`;
  const response = await axios({ url, responseType: 'arraybuffer' });
  fs.writeFileSync(destPath, Buffer.from(response.data));
  return response.data.byteLength;
}

// ─── CONVERTERS ───────────────────────────────────────────────────────────────
async function convertImage(inputPath, outputPath, outputFmt) {
  const sharp = require('sharp');
  const fmt = outputFmt === 'jpg' ? 'jpeg' : outputFmt;
  if (['jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff'].includes(fmt)) {
    await sharp(inputPath).toFormat(fmt).toFile(outputPath);
  } else throw new Error('Unsupported image format');
}

async function compressImage(inputPath, outputPath, quality = 70) {
  const sharp = require('sharp');
  const ext = path.extname(inputPath).toLowerCase().replace('.', '');
  const fmt = ext === 'jpg' ? 'jpeg' : ext;
  if (fmt === 'jpeg') {
    await sharp(inputPath).jpeg({ quality }).toFile(outputPath);
  } else if (fmt === 'png') {
    await sharp(inputPath).png({ compressionLevel: 9, quality }).toFile(outputPath);
  } else if (fmt === 'webp') {
    await sharp(inputPath).webp({ quality }).toFile(outputPath);
  } else {
    await sharp(inputPath).jpeg({ quality }).toFile(outputPath);
  }
}

async function resizeImage(inputPath, outputPath, width, height) {
  const sharp = require('sharp');
  const ext = path.extname(outputPath).toLowerCase().replace('.', '');
  const fmt = ext === 'jpg' ? 'jpeg' : ext;
  await sharp(inputPath).resize(width, height, { fit: 'inside' }).toFormat(fmt).toFile(outputPath);
}

async function convertMedia(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = require('fluent-ffmpeg');
    ffmpeg(inputPath).output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

async function xlsxToCsv(inputPath, outputPath) {
  const XLSX = require('xlsx');
  const wb = XLSX.readFile(inputPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  fs.writeFileSync(outputPath, XLSX.utils.sheet_to_csv(ws));
}

async function csvToXlsx(inputPath, outputPath) {
  const XLSX = require('xlsx');
  const csv = fs.readFileSync(inputPath, 'utf8');
  const ws = XLSX.utils.aoa_to_sheet(csv.split('\n').map(r => r.split(',')));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, outputPath);
}

async function docxToTxt(inputPath, outputPath) {
  const mammoth = require('mammoth');
  const result = await mammoth.extractRawText({ path: inputPath });
  fs.writeFileSync(outputPath, result.value);
}

async function imagesToPdf(imagePaths, outputPath) {
  const { PDFDocument } = require('pdf-lib');
  const sharp = require('sharp');
  const pdfDoc = await PDFDocument.create();
  for (const imgPath of imagePaths) {
    const jpgBuf = await sharp(imgPath).jpeg().toBuffer();
    const img = await pdfDoc.embedJpg(jpgBuf);
    const page = pdfDoc.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  fs.writeFileSync(outputPath, await pdfDoc.save());
}

async function generateQR(text, outputPath) {
  const QRCode = require('qrcode');
  await QRCode.toFile(outputPath, text, { width: 512, margin: 2 });
}

async function convertWithCloudConvert(inputPath, inputFmt, outputPath, outputFmt) {
  if (!CLOUD_CONVERT_KEY) throw new Error('CLOUD_CONVERT_KEY not set');
  const FormData = require('form-data');
  const jobRes = await axios.post('https://api.cloudconvert.com/v2/jobs', {
    tasks: {
      'upload-file': { operation: 'import/upload' },
      'convert-file': { operation: 'convert', input: 'upload-file', input_format: inputFmt, output_format: outputFmt },
      'export-file': { operation: 'export/url', input: 'convert-file' }
    }
  }, { headers: { Authorization: `Bearer ${CLOUD_CONVERT_KEY}` } });

  const job = jobRes.data.data;
  const uploadTask = job.tasks.find(t => t.name === 'upload-file');
  const form = new FormData();
  Object.entries(uploadTask.result.form.parameters).forEach(([k, v]) => form.append(k, v));
  form.append('file', fs.createReadStream(inputPath));
  await axios.post(uploadTask.result.form.url, form, { headers: form.getHeaders() });

  let exportTask;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const statusRes = await axios.get(`https://api.cloudconvert.com/v2/jobs/${job.id}`, {
      headers: { Authorization: `Bearer ${CLOUD_CONVERT_KEY}` }
    });
    const tasks = statusRes.data.data.tasks;
    exportTask = tasks.find(t => t.name === 'export-file');
    if (exportTask?.status === 'finished') break;
    if (tasks.some(t => t.status === 'error')) throw new Error('Conversion failed on CloudConvert');
  }
  if (!exportTask?.result?.files?.[0]?.url) throw new Error('No output from CloudConvert');
  const dlRes = await axios({ url: exportTask.result.files[0].url, responseType: 'arraybuffer' });
  fs.writeFileSync(outputPath, Buffer.from(dlRes.data));
}

async function convertFile(inputPath, inputFmt, outputPath, outputFmt) {
  const imgFmts = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tiff', 'tif'];
  const mediaFmts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'mp4', 'avi', 'mov', 'mkv', 'webm', 'flv'];
  if (imgFmts.includes(inputFmt) && imgFmts.includes(outputFmt)) {
    await convertImage(inputPath, outputPath, outputFmt);
  } else if (mediaFmts.includes(inputFmt) && mediaFmts.includes(outputFmt)) {
    await convertMedia(inputPath, outputPath);
  } else if (inputFmt === 'xlsx' && outputFmt === 'csv') {
    await xlsxToCsv(inputPath, outputPath);
  } else if (inputFmt === 'csv' && outputFmt === 'xlsx') {
    await csvToXlsx(inputPath, outputPath);
  } else if (inputFmt === 'docx' && outputFmt === 'txt') {
    await docxToTxt(inputPath, outputPath);
  } else {
    await convertWithCloudConvert(inputPath, inputFmt, outputPath, outputFmt);
  }
}

// ─── COMMANDS ─────────────────────────────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  trackUser(msg);
  await saveUser(msg);
  bot.sendMessage(msg.chat.id,
    '👋 *Welcome to FileConverter Bot!*\n\n' +
    'I can convert, compress, resize, merge and more!\n\n' +
    '━━━━━━━━━━━━━━━━━\n' +
    '📁 *CONVERT ANY FILE*\n' +
    'Just send me a file and pick the output format!\n\n' +
    '🖼 Images: JPG, PNG, WebP, BMP, GIF, TIFF\n' +
    '📄 Documents: PDF, DOCX, TXT, XLSX, CSV\n' +
    '🎵 Audio: MP3, WAV, OGG, FLAC, AAC, M4A\n' +
    '🎬 Video: MP4, AVI, MOV, MKV, WebM, FLV\n\n' +
    '━━━━━━━━━━━━━━━━━\n' +
    '✨ *SPECIAL COMMANDS*\n\n' +
    '🗜 /compress\n' +
    '→ Shrink image file size. Send command then image.\n\n' +
    '📐 /resize\n' +
    '→ Resize image to any dimension e.g. 800x600. Send command, then size, then image.\n\n' +
    '🖼 /merge\n' +
    '→ Combine multiple images into one PDF. Send command, send images one by one, then /done.\n\n' +
    '📱 /qr [text or URL]\n' +
    '→ Generate a QR code. Example: /qr https://google.com\n\n' +
    '📋 /history\n' +
    '→ See your last 5 conversions.\n\n' +
    '📊 /stats\n' +
    '→ See how many files you have converted.\n\n' +
    '🔍 /ocr\n' +
    '→ Extract text from any image instantly.\n\n' +
    '━━━━━━━━━━━━━━━━━\n' +
    '🪪 /myid — Get your Telegram ID (needed for premium)\n\n' +
    '👉 *To start:* Just send me any file!',
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/myid/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `🪪 *Your Telegram ID:*

\`${msg.from.id}\`

Send this ID to WhatsApp when upgrading to Premium.`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/grant (.+)/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return bot.sendMessage(msg.chat.id, '❌ Admin only.');
  const targetId = parseInt(match[1].trim());
  if (isNaN(targetId)) return bot.sendMessage(msg.chat.id, '❌ Invalid user ID. Use: /grant 123456789');

  // Get user info
  const { data } = await supabase.from('bot_users').select('name, username').eq('user_id', targetId).single();
  const name = data?.name || 'Unknown';
  const username = data?.username ? `@${data.username}` : '';

  const keyboard = {
    inline_keyboard: [
      [
        { text: '30 Days', callback_data: `grant:${targetId}:30` },
        { text: 'Lifetime', callback_data: `grant:${targetId}:lifetime` }
      ],
      [{ text: '❌ Cancel', callback_data: 'cancel' }]
    ]
  };
  bot.sendMessage(msg.chat.id,
    `👤 *User:* ${name} ${username}
🆔 ID: \`${targetId}\`

Choose plan to activate:`,
    { parse_mode: 'Markdown', reply_markup: keyboard }
  );
});

bot.onText(/\/revoke (.+)/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return bot.sendMessage(msg.chat.id, '❌ Admin only.');
  const targetId = parseInt(match[1].trim());
  if (isNaN(targetId)) return bot.sendMessage(msg.chat.id, '❌ Invalid user ID.');
  await revokePremium(targetId);
  bot.sendMessage(msg.chat.id, `✅ Premium revoked for user \`${targetId}\``, { parse_mode: 'Markdown' });
});

bot.onText(/\/history/, (msg) => {
  const userId = msg.from.id;
  const history = userHistory[userId];
  if (!history || history.length === 0) {
    return bot.sendMessage(msg.chat.id, '📭 No conversion history yet. Send me a file!');
  }
  let text = '📋 *Your last conversions:*\n\n';
  history.forEach((h, i) => {
    text += `${i + 1}. \`${h.filename}\` ${h.from.toUpperCase()} → ${h.to.toUpperCase()} _(${h.date})_\n`;
  });
  bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

bot.onText(/\/stats/, (msg) => {
  const userId = msg.from.id;
  const stats = userStats[userId];
  if (!stats || stats.total === 0) {
    return bot.sendMessage(msg.chat.id, '📊 No stats yet. Convert some files first!');
  }
  bot.sendMessage(msg.chat.id,
    `📊 *Your Stats:*\n\n` +
    `✅ Total conversions: *${stats.total}*\n`,
    { parse_mode: 'Markdown' }
  );
});


bot.onText(/\/users/, async (msg) => {
  if (msg.from.id !== ADMIN_ID) return bot.sendMessage(msg.chat.id, "❌ Admin only.");
  const totalUsers = await getTotalUsers();
  const totalConversions = await getTotalConversions();
  const totalConverters = Object.keys(userStats).length;
  bot.sendMessage(msg.chat.id,
    `👑 *Admin Stats:*\n\n` +
    `👥 Total users (all time): *${totalUsers}*\n` +
    `🔄 Active this session: *${totalConverters}*\n` +
    `✅ Total conversions: *${totalConversions}*`,
    { parse_mode: "Markdown" }
  );
});
bot.onText(/\/qr (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const text = match[1];
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-'));
  const outputPath = path.join(tmpDir, 'qrcode.png');
  try {
    await bot.sendMessage(chatId, '⏳ Generating QR code...');
    await generateQR(text, outputPath);
    await bot.sendPhoto(chatId, outputPath, { caption: `✅ QR code for: ${text}` });
  } catch (e) {
    bot.sendMessage(chatId, `❌ Failed: ${e.message}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

bot.onText(/\/qr$/, (msg) => {
  bot.sendMessage(msg.chat.id, '📝 Usage: `/qr your text or URL here`\n\nExample: `/qr https://google.com`', { parse_mode: 'Markdown' });
});

bot.onText(/\/ocr/, (msg) => {
  const userId = msg.from.id;
  userState[userId] = { mode: 'ocr' };
  bot.sendMessage(msg.chat.id, '🔍 Send me an image and I will extract all the text from it.');
});

bot.onText(/\/compress/, (msg) => {
  const userId = msg.from.id;
  userState[userId] = { mode: 'compress' };
  bot.sendMessage(msg.chat.id, '🗜 Send me an image to compress (JPG, PNG, WebP).');
});

bot.onText(/\/resize/, (msg) => {
  const userId = msg.from.id;
  userState[userId] = { mode: 'resize_waiting_size' };
  bot.sendMessage(msg.chat.id, '📐 Send me the size you want (e.g. `800x600` or `1920x1080`)', { parse_mode: 'Markdown' });
});

bot.onText(/\/merge/, (msg) => {
  const userId = msg.from.id;
  userState[userId] = { mode: 'merge', images: [] };
  bot.sendMessage(msg.chat.id,
    '🖼 *Merge images into PDF*\n\nSend me images one by one.\nWhen done, send /done',
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/done/, async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const state = userState[userId];
  if (!state || state.mode !== 'merge' || !state.images.length) {
    return bot.sendMessage(chatId, '❌ No images to merge. Use /merge first.');
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-'));
  const outputPath = path.join(tmpDir, 'merged.pdf');
  try {
    await bot.sendMessage(chatId, `⏳ Merging ${state.images.length} images into PDF...`);
    await imagesToPdf(state.images, outputPath);
    const outSize = fs.statSync(outputPath).size;
    await bot.sendDocument(chatId, outputPath, {
      caption: `✅ Merged *${state.images.length} images* into PDF\n📦 Size: ${formatBytes(outSize)}`,
      parse_mode: 'Markdown'
    });
    addHistory(userId, 'images', 'pdf', 'merged.pdf');
  } catch (e) {
    bot.sendMessage(chatId, `❌ Failed: ${e.message}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete userState[userId];
  }
});

// ─── FILE HANDLER ─────────────────────────────────────────────────────────────
async function handleFile(msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const state = userState[userId];

  let fileId, fileName, fileSize;

  if (msg.document) {
    fileId = msg.document.file_id;
    fileName = msg.document.file_name || 'file';
    fileSize = msg.document.file_size;
  } else if (msg.photo) {
    fileId = msg.photo[msg.photo.length - 1].file_id;
    fileName = 'photo.jpg';
    fileSize = msg.photo[msg.photo.length - 1].file_size;
  } else if (msg.audio) {
    fileId = msg.audio.file_id;
    fileName = msg.audio.file_name || 'audio.mp3';
    fileSize = msg.audio.file_size;
  } else if (msg.video) {
    fileId = msg.video.file_id;
    fileName = msg.video.file_name || 'video.mp4';
    fileSize = msg.video.file_size;
  } else if (msg.voice) {
    fileId = msg.voice.file_id;
    fileName = 'voice.ogg';
    fileSize = msg.voice.file_size;
  } else return;

  const ext = path.extname(fileName).toLowerCase().replace('.', '');

  // Handle compress mode
  if (state?.mode === 'compress') {
    const imgExts = ['jpg', 'jpeg', 'png', 'webp'];
    if (!imgExts.includes(ext)) {
      return bot.sendMessage(chatId, '❌ Please send a JPG, PNG, or WebP image.');
    }
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'compress-'));
    const inputPath = path.join(tmpDir, `input.${ext}`);
    const outputPath = path.join(tmpDir, `compressed.${ext}`);
    try {
      const statusMsg = await bot.sendMessage(chatId, '⏳ Compressing... [▓░░░░░░░░░] 10%');
      await downloadFile(fileId, inputPath);
      await bot.editMessageText('⏳ Compressing... [▓▓▓▓░░░░░░] 40%', { chat_id: chatId, message_id: statusMsg.message_id });
      await compressImage(inputPath, outputPath);
      await bot.editMessageText('⏳ Compressing... [▓▓▓▓▓▓▓▓░░] 80%', { chat_id: chatId, message_id: statusMsg.message_id });
      const inSize = fs.statSync(inputPath).size;
      const outSize = fs.statSync(outputPath).size;
      const saved = Math.round((1 - outSize / inSize) * 100);
      await bot.editMessageText('✅ Done! [▓▓▓▓▓▓▓▓▓▓] 100%', { chat_id: chatId, message_id: statusMsg.message_id });
      await bot.sendDocument(chatId, outputPath, {
        caption: `🗜 *Compressed!*\n📥 Original: ${formatBytes(inSize)}\n📤 Compressed: ${formatBytes(outSize)}\n💾 Saved: ${saved}%`,
        parse_mode: 'Markdown'
      });
      addHistory(userId, ext, ext, fileName);
    } catch (e) {
      bot.sendMessage(chatId, `❌ Failed: ${e.message}`);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      delete userState[userId];
    }
    return;
  }

  // Handle OCR mode
  if (state?.mode === 'ocr') {
    const imgExts = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff', 'tif'];
    if (!imgExts.includes(ext)) {
      return bot.sendMessage(chatId, '❌ Please send an image (JPG, PNG, WebP, BMP).');
    }
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-'));
    const inputPath = path.join(tmpDir, `input.${ext}`);
    try {
      const statusMsg = await bot.sendMessage(chatId, '🔍 Extracting text... please wait.');
      await downloadFile(fileId, inputPath);
      const Tesseract = require('tesseract.js');
      const result = await Tesseract.recognize(inputPath, 'eng');
      const text = result.data.text.trim();
      await bot.editMessageText('✅ Text extracted!', { chat_id: chatId, message_id: statusMsg.message_id });
      if (!text) {
        await bot.sendMessage(chatId, '❌ No text found in this image.');
      } else if (text.length > 4000) {
        // Send as file if too long
        const txtPath = path.join(tmpDir, 'extracted.txt');
        fs.writeFileSync(txtPath, text);
        await bot.sendDocument(chatId, txtPath, { caption: '📄 Extracted text (saved as file — too long for message)' });
      } else {
        await bot.sendMessage(chatId, `📄 Extracted Text:\n\n${text}`);
      }
      addHistory(userId, ext, 'txt', fileName);
    } catch (e) {
      bot.sendMessage(chatId, `❌ OCR failed: ${e.message}`);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      delete userState[userId];
    }
    return;
  }

  // Handle resize mode
  if (state?.mode === 'resize_ready') {
    const imgExts = ['jpg', 'jpeg', 'png', 'webp', 'bmp'];
    if (!imgExts.includes(ext)) {
      return bot.sendMessage(chatId, '❌ Please send a JPG, PNG, WebP or BMP image.');
    }
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resize-'));
    const inputPath = path.join(tmpDir, `input.${ext}`);
    const outputPath = path.join(tmpDir, `resized.${ext}`);
    try {
      const statusMsg = await bot.sendMessage(chatId, '⏳ Resizing... [▓▓▓░░░░░░░] 30%');
      await downloadFile(fileId, inputPath);
      await bot.editMessageText('⏳ Resizing... [▓▓▓▓▓▓░░░░] 60%', { chat_id: chatId, message_id: statusMsg.message_id });
      await resizeImage(inputPath, outputPath, state.width, state.height);
      await bot.editMessageText('✅ Done! [▓▓▓▓▓▓▓▓▓▓] 100%', { chat_id: chatId, message_id: statusMsg.message_id });
      const outSize = fs.statSync(outputPath).size;
      await bot.sendDocument(chatId, outputPath, {
        caption: `📐 *Resized to ${state.width}x${state.height}*\n📦 Size: ${formatBytes(outSize)}`,
        parse_mode: 'Markdown'
      });
      addHistory(userId, ext, ext, fileName);
    } catch (e) {
      bot.sendMessage(chatId, `❌ Failed: ${e.message}`);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      delete userState[userId];
    }
    return;
  }

  // Handle merge mode
  if (state?.mode === 'merge') {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'img-'));
    const inputPath = path.join(tmpDir, `img_${Date.now()}.${ext}`);
    await downloadFile(fileId, inputPath);
    state.images.push(inputPath);
    bot.sendMessage(chatId, `✅ Image ${state.images.length} added. Send more or /done to merge.`);
    return;
  }

  // Premium / limit check
  const premium = await isPremium(userId);
  if (!premium) {
    const check = canConvert(userId, fileSize);
    if (!check.ok) {
      if (check.reason === 'size') {
        return bot.sendMessage(chatId,
          '❌ *File too large!*

Free users can only send files up to 5MB.

Upgrade to Premium for up to 50MB!',
          { parse_mode: 'Markdown' }
        ).then(() => sendUpgradeMessage(chatId));
      }
      return sendUpgradeMessage(chatId);
    }
  }

  // If resize_waiting_size, remind user to send size first
  if (state?.mode === 'resize_waiting_size') {
    return bot.sendMessage(chatId, '📐 Please send the size first e.g. `800x600`, then send the image.', { parse_mode: 'Markdown' });
  }

  // Normal conversion
  if (!ext || !CONVERSIONS[ext]) {
    return bot.sendMessage(chatId, `❌ Format *${ext.toUpperCase() || 'unknown'}* not supported.`, { parse_mode: 'Markdown' });
  }

  const formats = CONVERSIONS[ext];
  userState[userId] = { fileId, fileName, inputExt: ext, fileSize };

  const keyboard = { inline_keyboard: [] };
  let row = [];
  formats.forEach((fmt, i) => {
    row.push({ text: fmt.toUpperCase(), callback_data: `convert:${fmt}` });
    if (row.length === 3 || i === formats.length - 1) {
      keyboard.inline_keyboard.push(row);
      row = [];
    }
  });
  keyboard.inline_keyboard.push([{ text: '❌ Cancel', callback_data: 'cancel' }]);

  bot.sendMessage(chatId,
    `📁 *${fileName}*\n📦 Size: ${formatBytes(fileSize || 0)}\n\nConvert *${ext.toUpperCase()}* to:`,
    { parse_mode: 'Markdown', reply_markup: keyboard }
  );
}

// Handle text messages (resize size input)
bot.on('text', (msg) => {
  if (msg.text.startsWith('/')) return; // ignore commands
  const userId = msg.from.id;
  const state = userState[userId];

  if (state?.mode === 'resize_waiting_size') {
    const match = msg.text.trim().match(/^(\d+)[xX×](\d+)$/);
    if (!match) {
      return bot.sendMessage(msg.chat.id, '❌ Invalid format. Send like `800x600`\n\nExample: `1920x1080`', { parse_mode: 'Markdown' });
    }
    userState[userId] = { mode: 'resize_ready', width: parseInt(match[1]), height: parseInt(match[2]) };
    return bot.sendMessage(msg.chat.id, `✅ Size set to *${match[1]}x${match[2]}*\n\nNow send me the image!`, { parse_mode: 'Markdown' });
  }
});

// Handle file messages
bot.on('message', (msg) => {
  if (msg.document || msg.photo || msg.audio || msg.video || msg.voice) {
    handleFile(msg);
  }
});

// ─── CALLBACK HANDLER ─────────────────────────────────────────────────────────
bot.on('callback_query', async (query) => {
  const userId = query.from.id;
  const chatId = query.message.chat.id;
  const msgId = query.message.message_id;

  await bot.answerCallbackQuery(query.id);

  if (query.data === 'cancel') {
    delete userState[userId];
    return bot.editMessageText('❌ Cancelled.', { chat_id: chatId, message_id: msgId });
  }

  // Grant premium from admin buttons
  if (query.data.startsWith('grant:')) {
    if (query.from.id !== ADMIN_ID) return bot.answerCallbackQuery(query.id, { text: 'Admin only' });
    const parts = query.data.split(':');
    const targetId = parseInt(parts[1]);
    const plan = parts[2];
    await grantPremium(targetId, plan);
    const label = plan === 'lifetime' ? 'Lifetime' : `${plan} Days`;
    await bot.editMessageText(
      `✅ Premium activated!

User: ${targetId}
Plan: ${label}`,
      { chat_id: chatId, message_id: msgId }
    );
    // Notify the user
    try {
      await bot.sendMessage(targetId,
        `🎉 *Your Premium is now active!*

Plan: *${label}*

Enjoy unlimited conversions and up to 50MB files!

Thank you for upgrading 🙏`,
        { parse_mode: 'Markdown' }
      );
    } catch(e) {}
    return;
  }

  if (!query.data.startsWith('convert:')) return;

  const outputFmt = query.data.split(':')[1];
  const state = userState[userId];
  if (!state) return bot.editMessageText('❌ Session expired. Send the file again.', { chat_id: chatId, message_id: msgId });

  const { fileId, fileName, inputExt, fileSize } = state;

  await bot.editMessageText(
    `⏳ Converting *${inputExt.toUpperCase()}* → *${outputFmt.toUpperCase()}*\n[▓▓░░░░░░░░] 20%`,
    { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown' }
  );

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgbot-'));
  const inputPath = path.join(tmpDir, `input.${inputExt}`);
  const outputFileName = path.basename(fileName, path.extname(fileName)) + `.${outputFmt}`;
  const outputPath = path.join(tmpDir, outputFileName);

  try {
    await downloadFile(fileId, inputPath);
    await bot.editMessageText(
      `⏳ Converting *${inputExt.toUpperCase()}* → *${outputFmt.toUpperCase()}*\n[▓▓▓▓▓░░░░░] 50%`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown' }
    );

    await convertFile(inputPath, inputExt, outputPath, outputFmt);

    await bot.editMessageText(
      `⏳ Converting *${inputExt.toUpperCase()}* → *${outputFmt.toUpperCase()}*\n[▓▓▓▓▓▓▓▓░░] 80%`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown' }
    );

    const inSize = fileSize || fs.statSync(inputPath).size;
    const outSize = fs.statSync(outputPath).size;

    await bot.editMessageText(
      `✅ Done! [▓▓▓▓▓▓▓▓▓▓] 100%`,
      { chat_id: chatId, message_id: msgId }
    );

    await bot.sendDocument(chatId, outputPath, {
      caption: `✅ *Converted!*\n📥 Original: ${formatBytes(inSize)}\n📤 Output: ${formatBytes(outSize)}\n📄 ${fileName} → ${outputFileName}`,
      parse_mode: 'Markdown'
    });

    addHistory(userId, inputExt, outputFmt, fileName);
    if (!(await isPremium(userId))) incrementDailyCount(userId);
    delete userState[userId];

  } catch (err) {
    console.error(err);
    bot.editMessageText(`❌ Failed: ${err.message}`, { chat_id: chatId, message_id: msgId });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

console.log('Bot started!');
