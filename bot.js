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
const CLOUD_CONVERT_KEY = process.env.CLOUD_CONVERT_KEY || '';
const ADMIN_ID = 8995568038;
const SUPABASE_URL = 'https://qtpeyheyqkaqgaqvllnv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const app = express();
app.use(express.json());
app.get('/', (req, res) => res.send('GENZ_CONVERTER Bot is running!'));

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
  console.log('Server running on port ' + PORT);
  if (RENDER_URL) {
    setInterval(() => { axios.get(RENDER_URL).catch(() => {}); }, 4 * 60 * 1000);
  }
});

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const userState = {};
const userHistory = {};
const userStats = {};
const dailyCount = {};
const FREE_LIMIT = 10;
const MAX_FREE_SIZE = 5 * 1024 * 1024;
const MAX_PREMIUM_SIZE = 50 * 1024 * 1024;

// ─── SUPABASE HELPERS ─────────────────────────────────────────────────────────
async function saveUser(msg) {
  try {
    await supabase.from('bot_users').upsert({
      user_id: msg.from.id,
      name: msg.from.first_name || 'Unknown',
      username: msg.from.username || '',
      last_active: new Date().toISOString()
    }, { onConflict: 'user_id', ignoreDuplicates: false });
  } catch (e) { console.error('saveUser error:', e.message); }
}

async function incrementConversions(userId) {
  try {
    const { data } = await supabase.from('bot_users').select('total_conversions').eq('user_id', userId).single();
    const current = data ? data.total_conversions || 0 : 0;
    await supabase.from('bot_users').update({ total_conversions: current + 1, last_active: new Date().toISOString() }).eq('user_id', userId);
  } catch (e) {}
}

async function isPremium(userId) {
  if (userId === ADMIN_ID) return true;
  try {
    const { data } = await supabase.from('bot_users').select('premium_until, lifetime').eq('user_id', userId).single();
    if (!data) return false;
    if (data.lifetime) return true;
    if (data.premium_until && new Date(data.premium_until) > new Date()) return true;
  } catch (e) {}
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

async function getTotalUsers() {
  try {
    const { count } = await supabase.from('bot_users').select('*', { count: 'exact', head: true });
    return count || 0;
  } catch (e) { return 0; }
}

async function getTotalConversions() {
  try {
    const { data } = await supabase.from('bot_users').select('total_conversions');
    return (data || []).reduce((sum, u) => sum + (u.total_conversions || 0), 0);
  } catch (e) { return 0; }
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

function addHistory(userId, from, to, filename) {
  if (!userHistory[userId]) userHistory[userId] = [];
  userHistory[userId].unshift({ from, to, filename, date: new Date().toLocaleDateString() });
  if (userHistory[userId].length > 5) userHistory[userId].pop();
  if (!userStats[userId]) userStats[userId] = { total: 0 };
  userStats[userId].total++;
  incrementConversions(userId).catch(() => {});
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function sendUpgradeMessage(chatId) {
  const keyboard = { inline_keyboard: [[{ text: '💬 Chat on WhatsApp', url: 'https://wa.me/2348028383053' }]] };
  await bot.sendMessage(chatId,
    '❌ You have used your 10 free conversions today.\n\n' +
    '💎 Upgrade to Premium\n\n' +
    '✅ Unlimited conversions\n' +
    '✅ Files up to 50MB\n' +
    '✅ All features unlocked\n\n' +
    '💰 Pricing:\n' +
    '• 30 Days - N1,500\n' +
    '• Lifetime - N5,000\n\n' +
    'How to upgrade:\n' +
    '1. Send /myid to get your Telegram ID\n' +
    '2. Send your ID + payment proof to WhatsApp\n' +
    '3. We activate within minutes!',
    { reply_markup: keyboard }
  );
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

// ─── DOWNLOAD ─────────────────────────────────────────────────────────────────
async function downloadFile(fileId, destPath) {
  const fileInfo = await bot.getFile(fileId);
  const url = 'https://api.telegram.org/file/bot' + BOT_TOKEN + '/' + fileInfo.file_path;
  const response = await axios({ url, responseType: 'arraybuffer' });
  fs.writeFileSync(destPath, Buffer.from(response.data));
  return response.data.byteLength;
}

// ─── CONVERTERS ───────────────────────────────────────────────────────────────
async function convertImage(inputPath, outputPath, outputFmt) {
  const sharp = require('sharp');
  const fmt = outputFmt === 'jpg' ? 'jpeg' : outputFmt;
  await sharp(inputPath).toFormat(fmt).toFile(outputPath);
}

async function compressImage(inputPath, outputPath) {
  const sharp = require('sharp');
  const ext = path.extname(inputPath).toLowerCase().replace('.', '');
  const fmt = ext === 'jpg' ? 'jpeg' : ext;
  if (fmt === 'jpeg') await sharp(inputPath).jpeg({ quality: 70 }).toFile(outputPath);
  else if (fmt === 'png') await sharp(inputPath).png({ compressionLevel: 9 }).toFile(outputPath);
  else if (fmt === 'webp') await sharp(inputPath).webp({ quality: 70 }).toFile(outputPath);
  else await sharp(inputPath).jpeg({ quality: 70 }).toFile(outputPath);
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
    ffmpeg(inputPath).output(outputPath).on('end', resolve).on('error', reject).run();
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
  }, { headers: { Authorization: 'Bearer ' + CLOUD_CONVERT_KEY } });

  const job = jobRes.data.data;
  const uploadTask = job.tasks.find(t => t.name === 'upload-file');
  const form = new FormData();
  Object.entries(uploadTask.result.form.parameters).forEach(([k, v]) => form.append(k, v));
  form.append('file', fs.createReadStream(inputPath));
  await axios.post(uploadTask.result.form.url, form, { headers: form.getHeaders() });

  let exportTask;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const statusRes = await axios.get('https://api.cloudconvert.com/v2/jobs/' + job.id, {
      headers: { Authorization: 'Bearer ' + CLOUD_CONVERT_KEY }
    });
    const tasks = statusRes.data.data.tasks;
    exportTask = tasks.find(t => t.name === 'export-file');
    if (exportTask && exportTask.status === 'finished') break;
    if (tasks.some(t => t.status === 'error')) throw new Error('Conversion failed on CloudConvert');
  }
  if (!exportTask || !exportTask.result || !exportTask.result.files[0]) throw new Error('No output from CloudConvert');
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


// ─── API ROUTES FOR MINI APP ──────────────────────────────────────────────────
const multer = require('multer');
const upload = multer({ dest: os.tmpdir() });

// CORS for mini app
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Convert endpoint
app.post('/api/convert', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { outputFmt } = req.body;
  if (!outputFmt) return res.status(400).json({ error: 'No output format specified' });
  
  const inputExt = path.extname(req.file.originalname).toLowerCase().replace('.', '');
  const inputPath = req.file.path;
  const outputFileName = path.basename(req.file.originalname, path.extname(req.file.originalname)) + '.' + outputFmt;
  const outputPath = inputPath + '_out.' + outputFmt;
  
  try {
    await convertFile(inputPath, inputExt, outputPath, outputFmt);
    const outSize = fs.statSync(outputPath).size;
    const fileBuffer = fs.readFileSync(outputPath);
    res.setHeader('Content-Disposition', 'attachment; filename="' + outputFileName + '"');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-File-Size', outSize);
    res.send(fileBuffer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    fs.unlink(inputPath, () => {});
    fs.unlink(outputPath, () => {});
  }
});

// Compress endpoint
app.post('/api/compress', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
  const inputPath = req.file.path;
  const outputPath = inputPath + '_compressed.' + ext;
  try {
    await compressImage(inputPath, outputPath);
    const inSize = req.file.size;
    const outSize = fs.statSync(outputPath).size;
    const fileBuffer = fs.readFileSync(outputPath);
    res.setHeader('Content-Disposition', 'attachment; filename="compressed_' + req.file.originalname + '"');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Original-Size', inSize);
    res.setHeader('X-Compressed-Size', outSize);
    res.send(fileBuffer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    fs.unlink(inputPath, () => {});
    fs.unlink(outputPath, () => {});
  }
});

// Resize endpoint
app.post('/api/resize', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { width, height } = req.body;
  if (!width || !height) return res.status(400).json({ error: 'Width and height required' });
  const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
  const inputPath = req.file.path;
  const outputPath = inputPath + '_resized.' + ext;
  try {
    await resizeImage(inputPath, outputPath, parseInt(width), parseInt(height));
    const fileBuffer = fs.readFileSync(outputPath);
    res.setHeader('Content-Disposition', 'attachment; filename="resized_' + req.file.originalname + '"');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(fileBuffer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    fs.unlink(inputPath, () => {});
    fs.unlink(outputPath, () => {});
  }
});

// OCR endpoint
app.post('/api/ocr', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const inputPath = req.file.path;
  try {
    const Tesseract = require('tesseract.js');
    const result = await Tesseract.recognize(inputPath, 'eng');
    res.json({ text: result.data.text.trim() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    fs.unlink(inputPath, () => {});
  }
});

// QR endpoint
app.post('/api/qr', express.json(), async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text required' });
  const outputPath = path.join(os.tmpdir(), 'qr_' + Date.now() + '.png');
  try {
    await generateQR(text, outputPath);
    const fileBuffer = fs.readFileSync(outputPath);
    res.setHeader('Content-Type', 'image/png');
    res.send(fileBuffer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    fs.unlink(outputPath, () => {});
  }
});

// Formats endpoint
app.get('/api/formats/:ext', (req, res) => {
  const ext = req.params.ext.toLowerCase();
  const formats = CONVERSIONS[ext] || [];
  res.json({ formats });
});

// ─── COMMANDS ─────────────────────────────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  await saveUser(msg);
  bot.sendMessage(msg.chat.id,
    '👋 Welcome to GENZ_CONVERTER Bot!\n\n' +
    'I can convert, compress, resize, merge and more!\n\n' +
    '━━━━━━━━━━━━━━━━━\n' +
    'CONVERT ANY FILE\n' +
    'Just send me a file and pick the output format!\n\n' +
    'Images: JPG, PNG, WebP, BMP, GIF, TIFF\n' +
    'Documents: PDF, DOCX, TXT, XLSX, CSV\n' +
    'Audio: MP3, WAV, OGG, FLAC, AAC, M4A\n' +
    'Video: MP4, AVI, MOV, MKV, WebM, FLV\n\n' +
    '━━━━━━━━━━━━━━━━━\n' +
    'SPECIAL COMMANDS\n\n' +
    '/compress - Shrink image file size\n' +
    '/resize - Resize image e.g. 800x600\n' +
    '/merge - Combine images into one PDF\n' +
    '/qr [text] - Generate a QR code\n' +
    '/ocr - Extract text from any image\n' +
    '/history - Your last 5 conversions\n' +
    '/stats - Your usage stats\n' +
    '/myid - Get your Telegram ID\n\n' +
    '━━━━━━━━━━━━━━━━━\n' +
    'Free: 10 conversions/day up to 5MB\n' +
    'Premium: Unlimited + up to 50MB\n\n' +
    'To start: Just send me any file!'
  );
});

bot.onText(/\/myid/, (msg) => {
  bot.sendMessage(msg.chat.id,
    'Your Telegram ID:\n\n' + msg.from.id + '\n\nSend this ID to WhatsApp when upgrading to Premium.'
  );
});

bot.onText(/\/grant (.+)/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return bot.sendMessage(msg.chat.id, 'Admin only.');
  const targetId = parseInt(match[1].trim());
  if (isNaN(targetId)) return bot.sendMessage(msg.chat.id, 'Invalid user ID. Use: /grant 123456789');
  const { data } = await supabase.from('bot_users').select('name, username').eq('user_id', targetId).single();
  const name = data ? data.name || 'Unknown' : 'Unknown';
  const username = data && data.username ? '@' + data.username : '';
  const keyboard = {
    inline_keyboard: [
      [
        { text: '30 Days', callback_data: 'grant:' + targetId + ':30' },
        { text: 'Lifetime', callback_data: 'grant:' + targetId + ':lifetime' }
      ],
      [{ text: 'Cancel', callback_data: 'cancel' }]
    ]
  };
  bot.sendMessage(msg.chat.id,
    'User: ' + name + ' ' + username + '\nID: ' + targetId + '\n\nChoose plan to activate:',
    { reply_markup: keyboard }
  );
});

bot.onText(/\/revoke (.+)/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return bot.sendMessage(msg.chat.id, 'Admin only.');
  const targetId = parseInt(match[1].trim());
  if (isNaN(targetId)) return bot.sendMessage(msg.chat.id, 'Invalid user ID.');
  await revokePremium(targetId);
  bot.sendMessage(msg.chat.id, 'Premium revoked for user ' + targetId);
});

bot.onText(/\/users/, async (msg) => {
  if (msg.from.id !== ADMIN_ID) return bot.sendMessage(msg.chat.id, 'Admin only.');
  const totalUsers = await getTotalUsers();
  const totalConversions = await getTotalConversions();
  bot.sendMessage(msg.chat.id,
    'Admin Stats:\n\n' +
    'Total users (all time): ' + totalUsers + '\n' +
    'Total conversions: ' + totalConversions
  );
});

bot.onText(/\/history/, (msg) => {
  const userId = msg.from.id;
  const history = userHistory[userId];
  if (!history || history.length === 0) {
    return bot.sendMessage(msg.chat.id, 'No conversion history yet. Send me a file!');
  }
  let text = 'Your last conversions:\n\n';
  history.forEach((h, i) => {
    text += (i + 1) + '. ' + h.filename + ' ' + h.from.toUpperCase() + ' to ' + h.to.toUpperCase() + ' (' + h.date + ')\n';
  });
  bot.sendMessage(msg.chat.id, text);
});

bot.onText(/\/stats/, (msg) => {
  const userId = msg.from.id;
  const stats = userStats[userId];
  if (!stats || stats.total === 0) {
    return bot.sendMessage(msg.chat.id, 'No stats yet. Convert some files first!');
  }
  bot.sendMessage(msg.chat.id, 'Your Stats:\n\nTotal conversions this session: ' + stats.total);
});

bot.onText(/\/qr (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const text = match[1];
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-'));
  const outputPath = path.join(tmpDir, 'qrcode.png');
  try {
    await bot.sendMessage(chatId, 'Generating QR code...');
    await generateQR(text, outputPath);
    await bot.sendPhoto(chatId, outputPath, { caption: 'QR code for: ' + text });
  } catch (e) {
    bot.sendMessage(chatId, 'Failed: ' + e.message);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

bot.onText(/\/qr$/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Usage: /qr your text or URL\n\nExample: /qr https://google.com');
});

bot.onText(/\/compress/, (msg) => {
  userState[msg.from.id] = { mode: 'compress' };
  bot.sendMessage(msg.chat.id, 'Send me an image to compress (JPG, PNG, WebP).');
});

bot.onText(/\/resize/, (msg) => {
  userState[msg.from.id] = { mode: 'resize_waiting_size' };
  bot.sendMessage(msg.chat.id, 'Send me the size you want e.g. 800x600 or 1920x1080');
});

bot.onText(/\/merge/, (msg) => {
  userState[msg.from.id] = { mode: 'merge', images: [] };
  bot.sendMessage(msg.chat.id, 'Merge images into PDF\n\nSend me images one by one.\nWhen done, send /done');
});

bot.onText(/\/ocr/, (msg) => {
  userState[msg.from.id] = { mode: 'ocr' };
  bot.sendMessage(msg.chat.id, 'Send me an image and I will extract all the text from it.');
});

bot.onText(/\/done/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const state = userState[userId];
  if (!state || state.mode !== 'merge' || !state.images || !state.images.length) {
    return bot.sendMessage(chatId, 'No images to merge. Use /merge first.');
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-'));
  const outputPath = path.join(tmpDir, 'merged.pdf');
  try {
    await bot.sendMessage(chatId, 'Merging ' + state.images.length + ' images into PDF...');
    await imagesToPdf(state.images, outputPath);
    const outSize = fs.statSync(outputPath).size;
    await bot.sendDocument(chatId, outputPath, {
      caption: 'Merged ' + state.images.length + ' images into PDF\nSize: ' + formatBytes(outSize)
    });
    addHistory(userId, 'images', 'pdf', 'merged.pdf');
  } catch (e) {
    bot.sendMessage(chatId, 'Failed: ' + e.message);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete userState[userId];
  }
});

// ─── TEXT HANDLER ─────────────────────────────────────────────────────────────
bot.on('text', (msg) => {
  if (msg.text.startsWith('/')) return;
  const userId = msg.from.id;
  const state = userState[userId];
  if (state && state.mode === 'resize_waiting_size') {
    const match = msg.text.trim().match(/^(\d+)[xX](\d+)$/);
    if (!match) {
      return bot.sendMessage(msg.chat.id, 'Invalid format. Send like 800x600\n\nExample: 1920x1080');
    }
    userState[userId] = { mode: 'resize_ready', width: parseInt(match[1]), height: parseInt(match[2]) };
    return bot.sendMessage(msg.chat.id, 'Size set to ' + match[1] + 'x' + match[2] + '. Now send me the image!');
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

  await saveUser(msg);
  const ext = path.extname(fileName).toLowerCase().replace('.', '');

  // OCR mode
  if (state && state.mode === 'ocr') {
    const imgExts = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff', 'tif'];
    if (!imgExts.includes(ext)) {
      return bot.sendMessage(chatId, 'Please send an image (JPG, PNG, WebP, BMP).');
    }
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-'));
    const inputPath = path.join(tmpDir, 'input.' + ext);
    try {
      const statusMsg = await bot.sendMessage(chatId, 'Extracting text... please wait.');
      await downloadFile(fileId, inputPath);
      const Tesseract = require('tesseract.js');
      const result = await Tesseract.recognize(inputPath, 'eng');
      const text = result.data.text.trim();
      await bot.editMessageText('Text extracted!', { chat_id: chatId, message_id: statusMsg.message_id });
      if (!text) {
        await bot.sendMessage(chatId, 'No text found in this image.');
      } else if (text.length > 4000) {
        const txtPath = path.join(tmpDir, 'extracted.txt');
        fs.writeFileSync(txtPath, text);
        await bot.sendDocument(chatId, txtPath, { caption: 'Extracted text (saved as file)' });
      } else {
        await bot.sendMessage(chatId, 'Extracted Text:\n\n' + text);
      }
      addHistory(userId, ext, 'txt', fileName);
    } catch (e) {
      bot.sendMessage(chatId, 'OCR failed: ' + e.message);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      delete userState[userId];
    }
    return;
  }

  // Compress mode
  if (state && state.mode === 'compress') {
    const imgExts = ['jpg', 'jpeg', 'png', 'webp'];
    if (!imgExts.includes(ext)) {
      return bot.sendMessage(chatId, 'Please send a JPG, PNG, or WebP image.');
    }
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'compress-'));
    const inputPath = path.join(tmpDir, 'input.' + ext);
    const outputPath = path.join(tmpDir, 'compressed.' + ext);
    try {
      const statusMsg = await bot.sendMessage(chatId, 'Compressing... [##........] 20%');
      await downloadFile(fileId, inputPath);
      await bot.editMessageText('Compressing... [#####.....] 50%', { chat_id: chatId, message_id: statusMsg.message_id });
      await compressImage(inputPath, outputPath);
      await bot.editMessageText('Compressing... [##########] 100%', { chat_id: chatId, message_id: statusMsg.message_id });
      const inSize = fs.statSync(inputPath).size;
      const outSize = fs.statSync(outputPath).size;
      const saved = Math.round((1 - outSize / inSize) * 100);
      await bot.sendDocument(chatId, outputPath, {
        caption: 'Compressed!\nOriginal: ' + formatBytes(inSize) + '\nCompressed: ' + formatBytes(outSize) + '\nSaved: ' + saved + '%'
      });
      addHistory(userId, ext, ext, fileName);
    } catch (e) {
      bot.sendMessage(chatId, 'Failed: ' + e.message);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      delete userState[userId];
    }
    return;
  }

  // Resize mode
  if (state && state.mode === 'resize_ready') {
    const imgExts = ['jpg', 'jpeg', 'png', 'webp', 'bmp'];
    if (!imgExts.includes(ext)) {
      return bot.sendMessage(chatId, 'Please send a JPG, PNG, WebP or BMP image.');
    }
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resize-'));
    const inputPath = path.join(tmpDir, 'input.' + ext);
    const outputPath = path.join(tmpDir, 'resized.' + ext);
    try {
      const statusMsg = await bot.sendMessage(chatId, 'Resizing... [#####.....] 50%');
      await downloadFile(fileId, inputPath);
      await resizeImage(inputPath, outputPath, state.width, state.height);
      await bot.editMessageText('Resizing... [##########] 100%', { chat_id: chatId, message_id: statusMsg.message_id });
      const outSize = fs.statSync(outputPath).size;
      await bot.sendDocument(chatId, outputPath, {
        caption: 'Resized to ' + state.width + 'x' + state.height + '\nSize: ' + formatBytes(outSize)
      });
      addHistory(userId, ext, ext, fileName);
    } catch (e) {
      bot.sendMessage(chatId, 'Failed: ' + e.message);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      delete userState[userId];
    }
    return;
  }

  // Merge mode
  if (state && state.mode === 'merge') {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'img-'));
    const inputPath = path.join(tmpDir, 'img_' + Date.now() + '.' + ext);
    await downloadFile(fileId, inputPath);
    state.images.push(inputPath);
    bot.sendMessage(chatId, 'Image ' + state.images.length + ' added. Send more or /done to merge.');
    return;
  }

  // Resize waiting — user sent file before size
  if (state && state.mode === 'resize_waiting_size') {
    return bot.sendMessage(chatId, 'Please send the size first e.g. 800x600, then send the image.');
  }

  // Premium / limit check
  const premium = await isPremium(userId);
  if (!premium) {
    const check = canConvert(userId, fileSize);
    if (!check.ok) {
      if (check.reason === 'size') {
        await bot.sendMessage(chatId, 'File too large! Free users can only send files up to 5MB.\n\nUpgrade to Premium for up to 50MB!');
        return sendUpgradeMessage(chatId);
      }
      return sendUpgradeMessage(chatId);
    }
  }

  // Normal conversion
  if (!ext || !CONVERSIONS[ext]) {
    return bot.sendMessage(chatId, 'Format ' + (ext ? ext.toUpperCase() : 'unknown') + ' not supported yet.');
  }

  const formats = CONVERSIONS[ext];
  userState[userId] = { fileId, fileName, inputExt: ext, fileSize };

  const keyboard = { inline_keyboard: [] };
  let row = [];
  formats.forEach((fmt, i) => {
    row.push({ text: fmt.toUpperCase(), callback_data: 'convert:' + fmt });
    if (row.length === 3 || i === formats.length - 1) {
      keyboard.inline_keyboard.push(row);
      row = [];
    }
  });
  keyboard.inline_keyboard.push([{ text: 'Cancel', callback_data: 'cancel' }]);

  bot.sendMessage(chatId,
    'Got: ' + fileName + '\nSize: ' + formatBytes(fileSize || 0) + '\n\nConvert ' + ext.toUpperCase() + ' to:',
    { reply_markup: keyboard }
  );
}

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
    return bot.editMessageText('Cancelled.', { chat_id: chatId, message_id: msgId });
  }

  // Admin grant premium buttons
  if (query.data.startsWith('grant:')) {
    if (query.from.id !== ADMIN_ID) return;
    const parts = query.data.split(':');
    const targetId = parseInt(parts[1]);
    const plan = parts[2];
    await grantPremium(targetId, plan);
    const label = plan === 'lifetime' ? 'Lifetime' : plan + ' Days';
    await bot.editMessageText('Premium activated!\nUser: ' + targetId + '\nPlan: ' + label, { chat_id: chatId, message_id: msgId });
    try {
      await bot.sendMessage(targetId,
        'Your Premium is now active!\n\nPlan: ' + label + '\n\nEnjoy unlimited conversions and up to 50MB files!\n\nThank you for upgrading!'
      );
    } catch (e) {}
    return;
  }

  if (!query.data.startsWith('convert:')) return;

  const outputFmt = query.data.split(':')[1];
  const state = userState[userId];
  if (!state) return bot.editMessageText('Session expired. Send the file again.', { chat_id: chatId, message_id: msgId });

  const { fileId, fileName, inputExt, fileSize } = state;

  await bot.editMessageText(
    'Converting ' + inputExt.toUpperCase() + ' to ' + outputFmt.toUpperCase() + '\n[###.......] 30%',
    { chat_id: chatId, message_id: msgId }
  );

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgbot-'));
  const inputPath = path.join(tmpDir, 'input.' + inputExt);
  const outputFileName = path.basename(fileName, path.extname(fileName)) + '.' + outputFmt;
  const outputPath = path.join(tmpDir, outputFileName);

  try {
    await downloadFile(fileId, inputPath);
    await bot.editMessageText(
      'Converting ' + inputExt.toUpperCase() + ' to ' + outputFmt.toUpperCase() + '\n[######....] 60%',
      { chat_id: chatId, message_id: msgId }
    );
    await convertFile(inputPath, inputExt, outputPath, outputFmt);
    await bot.editMessageText(
      'Converting ' + inputExt.toUpperCase() + ' to ' + outputFmt.toUpperCase() + '\n[#########.] 90%',
      { chat_id: chatId, message_id: msgId }
    );
    const inSize = fileSize || fs.statSync(inputPath).size;
    const outSize = fs.statSync(outputPath).size;
    await bot.editMessageText('Done! [##########] 100%', { chat_id: chatId, message_id: msgId });
    await bot.sendDocument(chatId, outputPath, {
      caption: 'Converted!\nOriginal: ' + formatBytes(inSize) + '\nOutput: ' + formatBytes(outSize) + '\n' + fileName + ' to ' + outputFileName
    });
    addHistory(userId, inputExt, outputFmt, fileName);
    const premium = await isPremium(userId);
    if (!premium) incrementDailyCount(userId);
    delete userState[userId];
  } catch (err) {
    console.error(err);
    bot.editMessageText('Failed: ' + err.message, { chat_id: chatId, message_id: msgId });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

console.log('Bot started!');
