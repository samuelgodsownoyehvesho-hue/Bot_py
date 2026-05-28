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

const FREE_LIMIT = 10;
const MAX_FREE_SIZE = 5 * 1024 * 1024;

const app = express();
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

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
    // Check 10-day premium notifications every hour
    setInterval(checkPremiumExpiry, 60 * 60 * 1000);
  }
});

// ─── SUPABASE HELPERS ─────────────────────────────────────────────────────────
async function saveUser(msg) {
  try {
    await supabase.from('bot_users').upsert({
      user_id: msg.from.id,
      name: msg.from.first_name || 'Unknown',
      username: msg.from.username || '',
      last_active: new Date().toISOString()
    }, { onConflict: 'user_id', ignoreDuplicates: false });
  } catch (e) { console.error('saveUser:', e.message); }
}

async function getUser(userId) {
  try {
    const { data } = await supabase.from('bot_users').select('*').eq('user_id', userId).single();
    return data;
  } catch (e) { return null; }
}

async function isPremium(userId) {
  if (userId === ADMIN_ID) return true;
  const user = await getUser(userId);
  if (!user) return false;
  if (user.lifetime) return true;
  if (user.premium_until && new Date(user.premium_until) > new Date()) return true;
  return false;
}

async function grantPremium(userId, plan) {
  const update = plan === 'lifetime'
    ? { lifetime: true, premium_until: null, notified_10days: false }
    : (() => {
        const days = parseInt(plan);
        const until = new Date();
        until.setDate(until.getDate() + days);
        return { lifetime: false, premium_until: until.toISOString(), notified_10days: false };
      })();
  await supabase.from('bot_users').upsert({ user_id: userId, ...update }, { onConflict: 'user_id' });
}

async function revokePremium(userId) {
  await supabase.from('bot_users').update({ lifetime: false, premium_until: null }).eq('user_id', userId);
}

async function getDailyCount(userId) {
  const user = await getUser(userId);
  if (!user) return 0;
  const lastReset = user.daily_reset ? new Date(user.daily_reset) : new Date(0);
  const now = new Date();
  const hoursSince = (now - lastReset) / (1000 * 60 * 60);
  if (hoursSince >= 24) {
    await supabase.from('bot_users').update({ daily_count: 0, daily_reset: now.toISOString() }).eq('user_id', userId);
    return 0;
  }
  return user.daily_count || 0;
}

async function incrementDailyCount(userId) {
  const user = await getUser(userId);
  const count = (user && user.daily_count) || 0;
  await supabase.from('bot_users').update({ daily_count: count + 1 }).eq('user_id', userId);
}

async function getTimeUntilReset(userId) {
  const user = await getUser(userId);
  if (!user || !user.daily_reset) return '24 hours';
  const lastReset = new Date(user.daily_reset);
  const resetTime = new Date(lastReset.getTime() + 24 * 60 * 60 * 1000);
  const now = new Date();
  const diff = resetTime - now;
  if (diff <= 0) return '0 hours';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m`;
}

async function addHistory(userId, fromFmt, toFmt, filename) {
  try {
    await supabase.from('conversion_history').insert({ user_id: userId, from_fmt: fromFmt, to_fmt: toFmt, filename });
    await supabase.from('bot_users').upsert({
      user_id: userId,
      total_conversions: (await getTotalUserConversions(userId)) + 1,
      last_active: new Date().toISOString()
    }, { onConflict: 'user_id' });
  } catch (e) { console.error('addHistory:', e.message); }
}

async function getTotalUserConversions(userId) {
  try {
    const { count } = await supabase.from('conversion_history').select('*', { count: 'exact', head: true }).eq('user_id', userId);
    return count || 0;
  } catch (e) { return 0; }
}

async function getUserHistory(userId, limit = 20) {
  try {
    const { data } = await supabase.from('conversion_history').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
    return data || [];
  } catch (e) { return []; }
}

async function getTotalUsers() {
  try {
    const { count } = await supabase.from('bot_users').select('*', { count: 'exact', head: true });
    return count || 0;
  } catch (e) { return 0; }
}

async function getTotalConversions() {
  try {
    const { count } = await supabase.from('conversion_history').select('*', { count: 'exact', head: true });
    return count || 0;
  } catch (e) { return 0; }
}

async function getPremiumUsers() {
  try {
    const now = new Date().toISOString();
    const { data } = await supabase.from('bot_users')
      .select('user_id, name, username, lifetime, premium_until')
      .or(`lifetime.eq.true,premium_until.gt.${now}`)
      .neq('user_id', ADMIN_ID);
    return data || [];
  } catch (e) { return []; }
}

async function checkPremiumExpiry() {
  try {
    const now = new Date();
    const tenDays = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
    const { data } = await supabase.from('bot_users')
      .select('user_id, name, premium_until, notified_10days')
      .eq('lifetime', false)
      .eq('notified_10days', false)
      .not('premium_until', 'is', null)
      .lt('premium_until', tenDays.toISOString())
      .gt('premium_until', now.toISOString());
    for (const user of data || []) {
      const expiry = new Date(user.premium_until);
      const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
      try {
        await bot.sendMessage(user.user_id,
          `⚠️ Premium Expiry Notice\n\nHi ${user.name}! Your premium plan expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.\n\nRenew now to keep unlimited access!\n\nContact: wa.me/2347012276929`,
        );
        await supabase.from('bot_users').update({ notified_10days: true }).eq('user_id', user.user_id);
      } catch (e) {}
    }
  } catch (e) { console.error('checkPremiumExpiry:', e.message); }
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function sendUpgradeMessage(chatId, timeLeft) {
  const keyboard = { inline_keyboard: [[{ text: 'Chat on WhatsApp to Upgrade', url: 'https://wa.me/2347012276929' }]] };
  await bot.sendMessage(chatId,
    `You have used all your free conversions today.\n\n` +
    `Next reset in: ${timeLeft}\n\n` +
    `Upgrade to Premium:\n` +
    `- Unlimited conversions\n` +
    `- Files up to 50MB\n\n` +
    `Pricing:\n` +
    `30 Days - N1,500\n` +
    `Lifetime - N5,000\n\n` +
    `How:\n` +
    `1. Send /myid to get your ID\n` +
    `2. Send ID + payment proof on WhatsApp\n` +
    `3. Activated within minutes!`,
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
}

// ─── CONVERTERS ───────────────────────────────────────────────────────────────
async function convertImage(inputPath, outputPath, outputFmt) {
  const sharp = require('sharp');
  // Sharp supports: jpeg, png, webp, gif, tiff, avif, heif
  // For BMP output, convert to PNG then rename (most viewers accept PNG named as BMP)
  const sharpFmts = ['jpeg', 'png', 'webp', 'gif', 'tiff'];
  let fmt = outputFmt === 'jpg' ? 'jpeg' : outputFmt;
  if (!sharpFmts.includes(fmt)) {
    // fallback: convert to PNG
    fmt = 'png';
    const pngPath = outputPath.replace(/\.[^.]+$/, '.png');
    await sharp(inputPath).toFormat('png').toFile(pngPath);
    fs.renameSync(pngPath, outputPath);
    return;
  }
  await sharp(inputPath).toFormat(fmt).toFile(outputPath);
}

async function imageToPdf(inputPath, outputPath) {
  const { PDFDocument } = require('pdf-lib');
  const sharp = require('sharp');
  const jpgBuf = await sharp(inputPath).jpeg().toBuffer();
  const pdfDoc = await PDFDocument.create();
  const img = await pdfDoc.embedJpg(jpgBuf);
  const page = pdfDoc.addPage([img.width, img.height]);
  page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  fs.writeFileSync(outputPath, await pdfDoc.save());
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
  if (!CLOUD_CONVERT_KEY) throw new Error('This conversion type requires CloudConvert API key');
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
    if (tasks.some(t => t.status === 'error')) throw new Error('Conversion failed');
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
  } else if (imgFmts.includes(inputFmt) && outputFmt === 'pdf') {
    await imageToPdf(inputPath, outputPath);
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

// ─── USER STATE ───────────────────────────────────────────────────────────────
const userState = {};

// ─── API ROUTES ───────────────────────────────────────────────────────────────
const multer = require('multer');
const upload = multer({ dest: os.tmpdir() });

app.post('/api/convert', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { outputFmt } = req.body;
  if (!outputFmt) return res.status(400).json({ error: 'No output format' });
  const inputExt = path.extname(req.file.originalname).toLowerCase().replace('.', '');
  const inputPath = req.file.path;
  const outputFileName = path.basename(req.file.originalname, path.extname(req.file.originalname)) + '.' + outputFmt;
  const outputPath = inputPath + '_out.' + outputFmt;
  try {
    await convertFile(inputPath, inputExt, outputPath, outputFmt);
    const fileBuffer = fs.readFileSync(outputPath);
    res.setHeader('Content-Disposition', 'attachment; filename="' + outputFileName + '"');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-File-Size', fs.statSync(outputPath).size);
    res.setHeader('Access-Control-Expose-Headers', 'X-File-Size, Content-Disposition');
    res.send(fileBuffer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    fs.unlink(inputPath, () => {});
    fs.unlink(outputPath, () => {});
  }
});

app.post('/api/compress', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
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
    res.setHeader('Access-Control-Expose-Headers', 'X-Original-Size, X-Compressed-Size, Content-Disposition');
    res.send(fileBuffer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    fs.unlink(inputPath, () => {});
    fs.unlink(outputPath, () => {});
  }
});

app.post('/api/resize', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const { width, height } = req.body;
  const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
  const inputPath = req.file.path;
  const outputPath = inputPath + '_resized.' + ext;
  try {
    await resizeImage(inputPath, outputPath, parseInt(width), parseInt(height));
    const fileBuffer = fs.readFileSync(outputPath);
    res.setHeader('Content-Disposition', 'attachment; filename="resized_' + req.file.originalname + '"');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(fileBuffer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    fs.unlink(inputPath, () => {});
    fs.unlink(outputPath, () => {});
  }
});

app.post('/api/ocr', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
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

app.post('/api/qr', async (req, res) => {
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

app.post('/api/profile/:userId/username', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });
  const clean = username.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 32);
  try {
    await supabase.from('bot_users').update({ username: clean }).eq('user_id', userId);
    res.json({ success: true, username: clean });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/formats/:ext', (req, res) => {
  const ext = req.params.ext.toLowerCase();
  res.json({ formats: CONVERSIONS[ext] || [] });
});

app.get('/api/profile/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  try {
    const user = await getUser(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const premium = await isPremium(userId);
    const history = await getUserHistory(userId, 50);
    const dailyCount = await getDailyCount(userId);
    res.json({ user, premium, history, dailyCount, freeLimit: FREE_LIMIT });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── BOT COMMANDS ─────────────────────────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  await saveUser(msg);
  bot.sendMessage(msg.chat.id,
    'Welcome to GENZ_CONVERTER Bot!\n\n' +
    'Convert any file format instantly.\n\n' +
    'Images: JPG PNG WebP BMP GIF TIFF\n' +
    'Documents: PDF DOCX TXT XLSX CSV\n' +
    'Audio: MP3 WAV OGG FLAC AAC M4A\n' +
    'Video: MP4 AVI MOV MKV WebM FLV\n\n' +
    'COMMANDS:\n' +
    '/compress - Compress an image\n' +
    '/resize - Resize an image\n' +
    '/merge - Merge images into PDF\n' +
    '/ocr - Extract text from image\n' +
    '/qr [text] - Generate QR code\n' +
    '/history - Your conversion history\n' +
    '/profile - Your profile and plan\n' +
    '/myid - Get your Telegram ID\n' +
    '/stats - Your usage stats\n\n' +
    'Free: 10 conversions/day up to 5MB\n' +
    'Premium: Unlimited + up to 50MB\n\n' +
    'Send me any file to get started!'
  );
});

bot.onText(/\/myid/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Your Telegram ID:\n\n' + msg.from.id + '\n\nSend this ID to WhatsApp when upgrading to Premium.');
});

bot.onText(/\/profile/, async (msg) => {
  const userId = msg.from.id;
  await saveUser(msg);
  const user = await getUser(userId);
  const premium = await isPremium(userId);
  const dailyCount = await getDailyCount(userId);
  const totalConversions = await getTotalUserConversions(userId);

  let planText = 'Free (10/day)';
  if (userId === ADMIN_ID) {
    planText = 'Admin (Unlimited)';
  } else if (premium) {
    if (user && user.lifetime) {
      planText = 'Lifetime Premium';
    } else if (user && user.premium_until) {
      const expiry = new Date(user.premium_until);
      const daysLeft = Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24));
      planText = '30-Day Premium (' + daysLeft + ' days left, expires ' + formatDate(user.premium_until) + ')';
    }
  }

  const remaining = premium ? 'Unlimited' : (FREE_LIMIT - dailyCount) + ' of ' + FREE_LIMIT + ' left today';

  bot.sendMessage(msg.chat.id,
    'YOUR PROFILE\n\n' +
    'Name: ' + (user ? user.name : msg.from.first_name) + '\n' +
    'ID: ' + userId + '\n' +
    'Username: ' + (user && user.username ? '@' + user.username : 'Not set') + '\n' +
    'Joined: ' + (user ? formatDate(user.joined_at) : 'Today') + '\n\n' +
    'PLAN: ' + planText + '\n' +
    'Conversions today: ' + remaining + '\n' +
    'Total conversions: ' + totalConversions + '\n\n' +
    (premium ? 'You have full premium access!' : 'Upgrade to Premium for unlimited access.\nContact: wa.me/2347012276929')
  );
});

bot.onText(/\/history/, async (msg) => {
  const userId = msg.from.id;
  const history = await getUserHistory(userId, 20);
  if (!history.length) return bot.sendMessage(msg.chat.id, 'No conversion history yet. Send me a file!');
  let text = 'YOUR CONVERSION HISTORY\n\n';
  history.forEach((h, i) => {
    const date = new Date(h.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    text += (i + 1) + '. ' + (h.filename || 'file') + '\n   ' + (h.from_fmt || '?').toUpperCase() + ' to ' + (h.to_fmt || '?').toUpperCase() + ' - ' + date + '\n';
  });
  bot.sendMessage(msg.chat.id, text);
});

bot.onText(/\/stats/, async (msg) => {
  const userId = msg.from.id;
  const total = await getTotalUserConversions(userId);
  const dailyCount = await getDailyCount(userId);
  const premium = await isPremium(userId);
  const timeLeft = await getTimeUntilReset(userId);
  bot.sendMessage(msg.chat.id,
    'YOUR STATS\n\n' +
    'Total conversions: ' + total + '\n' +
    'Today: ' + dailyCount + (premium ? ' (unlimited)' : ' of ' + FREE_LIMIT) + '\n' +
    (premium ? 'Plan: Premium' : 'Daily reset in: ' + timeLeft)
  );
});

bot.onText(/\/grant (.+)/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return bot.sendMessage(msg.chat.id, 'Admin only.');
  const targetId = parseInt(match[1].trim());
  if (isNaN(targetId)) return bot.sendMessage(msg.chat.id, 'Invalid ID. Use: /grant 123456789');
  const user = await getUser(targetId);
  const name = user ? user.name : 'Unknown';
  const username = user && user.username ? '@' + user.username : '';
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
    'User: ' + name + ' ' + username + '\nID: ' + targetId + '\n\nChoose plan:',
    { reply_markup: keyboard }
  );
});

bot.onText(/\/revoke (.+)/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return bot.sendMessage(msg.chat.id, 'Admin only.');
  const targetId = parseInt(match[1].trim());
  if (isNaN(targetId)) return bot.sendMessage(msg.chat.id, 'Invalid ID.');
  await revokePremium(targetId);
  bot.sendMessage(msg.chat.id, 'Premium revoked for ' + targetId);
});

bot.onText(/\/users/, async (msg) => {
  if (msg.from.id !== ADMIN_ID) return bot.sendMessage(msg.chat.id, 'Admin only.');
  const total = await getTotalUsers();
  const totalConv = await getTotalConversions();
  const premiumUsers = await getPremiumUsers();
  let text = 'ADMIN STATS\n\n';
  text += 'Total users: ' + total + '\n';
  text += 'Total conversions: ' + totalConv + '\n\n';
  if (premiumUsers.length === 0) {
    text += 'No premium users yet.';
  } else {
    text += 'PREMIUM USERS (' + premiumUsers.length + '):\n\n';
    premiumUsers.forEach((u, i) => {
      const plan = u.lifetime ? 'Lifetime' : 'Expires ' + formatDate(u.premium_until);
      text += (i + 1) + '. ' + u.name + (u.username ? ' @' + u.username : '') + '\n   ID: ' + u.user_id + '\n   Plan: ' + plan + '\n\n';
    });
  }
  bot.sendMessage(msg.chat.id, text);
});

bot.onText(/\/lookup (.+)/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return bot.sendMessage(msg.chat.id, 'Admin only.');
  const targetId = parseInt(match[1].trim());
  if (isNaN(targetId)) return bot.sendMessage(msg.chat.id, 'Invalid ID.');
  const user = await getUser(targetId);
  if (!user) return bot.sendMessage(msg.chat.id, 'User not found.');
  const premium = await isPremium(targetId);
  const total = await getTotalUserConversions(targetId);
  const history = await getUserHistory(targetId, 5);
  let planText = 'Free';
  if (targetId === ADMIN_ID) planText = 'Admin';
  else if (user.lifetime) planText = 'Lifetime Premium';
  else if (user.premium_until && new Date(user.premium_until) > new Date()) {
    const days = Math.ceil((new Date(user.premium_until) - new Date()) / (1000 * 60 * 60 * 24));
    planText = '30-Day Premium (' + days + ' days left)';
  }
  let text = 'USER PROFILE\n\n';
  text += 'Name: ' + user.name + '\n';
  text += 'Username: ' + (user.username ? '@' + user.username : 'N/A') + '\n';
  text += 'ID: ' + targetId + '\n';
  text += 'Joined: ' + formatDate(user.joined_at) + '\n';
  text += 'Last active: ' + formatDate(user.last_active) + '\n';
  text += 'Plan: ' + planText + '\n';
  text += 'Total conversions: ' + total + '\n\n';
  if (history.length) {
    text += 'Last 5 conversions:\n';
    history.forEach((h, i) => {
      text += (i + 1) + '. ' + (h.from_fmt || '?').toUpperCase() + ' to ' + (h.to_fmt || '?').toUpperCase() + ' - ' + formatDate(h.created_at) + '\n';
    });
  }
  bot.sendMessage(msg.chat.id, text);
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
  bot.sendMessage(msg.chat.id, 'Send me the size you want e.g. 800x600');
});

bot.onText(/\/merge/, (msg) => {
  userState[msg.from.id] = { mode: 'merge', images: [] };
  bot.sendMessage(msg.chat.id, 'Send images one by one. When done, send /done');
});

bot.onText(/\/ocr/, (msg) => {
  userState[msg.from.id] = { mode: 'ocr' };
  bot.sendMessage(msg.chat.id, 'Send me an image to extract text from.');
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
    await bot.sendDocument(chatId, outputPath, { caption: 'Merged ' + state.images.length + ' images - ' + formatBytes(outSize) });
    await addHistory(userId, 'images', 'pdf', 'merged.pdf');
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
    if (!match) return bot.sendMessage(msg.chat.id, 'Invalid format. Send like 800x600');
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
  if (msg.document) { fileId = msg.document.file_id; fileName = msg.document.file_name || 'file'; fileSize = msg.document.file_size; }
  else if (msg.photo) { fileId = msg.photo[msg.photo.length - 1].file_id; fileName = 'photo.jpg'; fileSize = msg.photo[msg.photo.length - 1].file_size; }
  else if (msg.audio) { fileId = msg.audio.file_id; fileName = msg.audio.file_name || 'audio.mp3'; fileSize = msg.audio.file_size; }
  else if (msg.video) { fileId = msg.video.file_id; fileName = msg.video.file_name || 'video.mp4'; fileSize = msg.video.file_size; }
  else if (msg.voice) { fileId = msg.voice.file_id; fileName = 'voice.ogg'; fileSize = msg.voice.file_size; }
  else return;

  await saveUser(msg);
  const ext = path.extname(fileName).toLowerCase().replace('.', '');

  // OCR
  if (state && state.mode === 'ocr') {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-'));
    const inputPath = path.join(tmpDir, 'input.' + ext);
    try {
      const statusMsg = await bot.sendMessage(chatId, 'Extracting text...');
      await downloadFile(fileId, inputPath);
      const Tesseract = require('tesseract.js');
      const result = await Tesseract.recognize(inputPath, 'eng');
      const text = result.data.text.trim();
      await bot.editMessageText('Done!', { chat_id: chatId, message_id: statusMsg.message_id });
      if (!text) { await bot.sendMessage(chatId, 'No text found.'); }
      else if (text.length > 4000) {
        const txtPath = path.join(tmpDir, 'extracted.txt');
        fs.writeFileSync(txtPath, text);
        await bot.sendDocument(chatId, txtPath, { caption: 'Extracted text' });
      } else { await bot.sendMessage(chatId, 'Extracted Text:\n\n' + text); }
      await addHistory(userId, ext, 'txt', fileName);
    } catch (e) { bot.sendMessage(chatId, 'OCR failed: ' + e.message); }
    finally { fs.rmSync(tmpDir, { recursive: true, force: true }); delete userState[userId]; }
    return;
  }

  // Compress
  if (state && state.mode === 'compress') {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'compress-'));
    const inputPath = path.join(tmpDir, 'input.' + ext);
    const outputPath = path.join(tmpDir, 'compressed.' + ext);
    try {
      const statusMsg = await bot.sendMessage(chatId, 'Compressing...');
      await downloadFile(fileId, inputPath);
      await compressImage(inputPath, outputPath);
      const inSize = fs.statSync(inputPath).size;
      const outSize = fs.statSync(outputPath).size;
      const saved = Math.round((1 - outSize / inSize) * 100);
      await bot.editMessageText('Done!', { chat_id: chatId, message_id: statusMsg.message_id });
      await bot.sendDocument(chatId, outputPath, { caption: 'Compressed!\nOriginal: ' + formatBytes(inSize) + '\nNew: ' + formatBytes(outSize) + '\nSaved: ' + saved + '%' });
      await addHistory(userId, ext, ext, fileName);
    } catch (e) { bot.sendMessage(chatId, 'Failed: ' + e.message); }
    finally { fs.rmSync(tmpDir, { recursive: true, force: true }); delete userState[userId]; }
    return;
  }

  // Resize
  if (state && state.mode === 'resize_ready') {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resize-'));
    const inputPath = path.join(tmpDir, 'input.' + ext);
    const outputPath = path.join(tmpDir, 'resized.' + ext);
    try {
      await bot.sendMessage(chatId, 'Resizing...');
      await downloadFile(fileId, inputPath);
      await resizeImage(inputPath, outputPath, state.width, state.height);
      await bot.sendDocument(chatId, outputPath, { caption: 'Resized to ' + state.width + 'x' + state.height });
      await addHistory(userId, ext, ext, fileName);
    } catch (e) { bot.sendMessage(chatId, 'Failed: ' + e.message); }
    finally { fs.rmSync(tmpDir, { recursive: true, force: true }); delete userState[userId]; }
    return;
  }

  // Merge
  if (state && state.mode === 'merge') {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'img-'));
    const inputPath = path.join(tmpDir, 'img_' + Date.now() + '.' + ext);
    await downloadFile(fileId, inputPath);
    state.images.push(inputPath);
    bot.sendMessage(chatId, 'Image ' + state.images.length + ' added. Send more or /done to merge.');
    return;
  }

  if (state && state.mode === 'resize_waiting_size') {
    return bot.sendMessage(chatId, 'Please send the size first e.g. 800x600');
  }

  // Premium / limit check
  const premium = await isPremium(userId);
  if (!premium) {
    const dailyCount = await getDailyCount(userId);
    if (fileSize && fileSize > MAX_FREE_SIZE) {
      await bot.sendMessage(chatId, 'File too large! Free users: max 5MB.\n\nUpgrade to Premium for 50MB.');
      return sendUpgradeMessage(chatId, await getTimeUntilReset(userId));
    }
    if (dailyCount >= FREE_LIMIT) {
      const timeLeft = await getTimeUntilReset(userId);
      return sendUpgradeMessage(chatId, timeLeft);
    }
  }

  // Normal conversion
  if (!ext || !CONVERSIONS[ext]) return bot.sendMessage(chatId, 'Format ' + (ext || 'unknown').toUpperCase() + ' not supported.');

  const formats = CONVERSIONS[ext];
  userState[userId] = { fileId, fileName, inputExt: ext, fileSize };

  const keyboard = { inline_keyboard: [] };
  let row = [];
  formats.forEach((fmt, i) => {
    row.push({ text: fmt.toUpperCase(), callback_data: 'convert:' + fmt });
    if (row.length === 3 || i === formats.length - 1) { keyboard.inline_keyboard.push(row); row = []; }
  });
  keyboard.inline_keyboard.push([{ text: 'Cancel', callback_data: 'cancel' }]);

  const premium2 = await isPremium(userId);
  const dailyCount = premium2 ? 0 : await getDailyCount(userId);
  const remaining = premium2 ? 'Unlimited' : (FREE_LIMIT - dailyCount) + ' conversions left today';

  bot.sendMessage(chatId,
    'File: ' + fileName + '\nSize: ' + formatBytes(fileSize || 0) + '\n' + remaining + '\n\nConvert ' + ext.toUpperCase() + ' to:',
    { reply_markup: keyboard }
  );
}

bot.on('message', (msg) => {
  if (msg.document || msg.photo || msg.audio || msg.video || msg.voice) handleFile(msg);
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
        'Your Premium is now active!\n\nPlan: ' + label + '\nEnjoy unlimited conversions and up to 50MB files!\n\nThank you!'
      );
    } catch (e) {}
    return;
  }

  if (!query.data.startsWith('convert:')) return;
  const outputFmt = query.data.split(':')[1];
  const state = userState[userId];
  if (!state) return bot.editMessageText('Session expired. Send the file again.', { chat_id: chatId, message_id: msgId });

  const { fileId, fileName, inputExt, fileSize } = state;

  await bot.editMessageText('Converting ' + inputExt.toUpperCase() + ' to ' + outputFmt.toUpperCase() + '\n[###.......] 30%', { chat_id: chatId, message_id: msgId });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgbot-'));
  const inputPath = path.join(tmpDir, 'input.' + inputExt);
  const outputFileName = path.basename(fileName, path.extname(fileName)) + '.' + outputFmt;
  const outputPath = path.join(tmpDir, outputFileName);

  try {
    await downloadFile(fileId, inputPath);
    await bot.editMessageText('Converting ' + inputExt.toUpperCase() + ' to ' + outputFmt.toUpperCase() + '\n[######....] 60%', { chat_id: chatId, message_id: msgId });
    await convertFile(inputPath, inputExt, outputPath, outputFmt);
    await bot.editMessageText('Converting ' + inputExt.toUpperCase() + ' to ' + outputFmt.toUpperCase() + '\n[#########.] 90%', { chat_id: chatId, message_id: msgId });
    const inSize = fileSize || fs.statSync(inputPath).size;
    const outSize = fs.statSync(outputPath).size;
    await bot.editMessageText('Done! [##########] 100%', { chat_id: chatId, message_id: msgId });
    await bot.sendDocument(chatId, outputPath, {
      caption: 'Converted!\nOriginal: ' + formatBytes(inSize) + '\nOutput: ' + formatBytes(outSize) + '\n' + fileName + ' to ' + outputFileName
    });
    await addHistory(userId, inputExt, outputFmt, fileName);
    const premium = await isPremium(userId);
    if (!premium) {
      await incrementDailyCount(userId);
      const newCount = await getDailyCount(userId);
      const remaining = FREE_LIMIT - newCount;
      if (remaining > 0) {
        await bot.sendMessage(chatId, 'You have ' + remaining + ' free conversion' + (remaining === 1 ? '' : 's') + ' left today.');
      }
    }
    delete userState[userId];
  } catch (err) {
    console.error(err);
    bot.editMessageText('Failed: ' + err.message, { chat_id: chatId, message_id: msgId });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

console.log('Bot started!');
