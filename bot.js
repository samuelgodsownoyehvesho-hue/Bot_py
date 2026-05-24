const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, exec } = require('child_process');

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const RENDER_URL = process.env.RENDER_URL || '';
const PORT = process.env.PORT || 3000;
const CLOUD_CONVERT_KEY = process.env.CLOUD_CONVERT_KEY || '';

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
const userHistory = {}; // { userId: [{from, to, filename, date}] }
const userStats = {};   // { userId: { total, bytes } }

function addHistory(userId, from, to, filename) {
  if (!userHistory[userId]) userHistory[userId] = [];
  userHistory[userId].unshift({ from, to, filename, date: new Date().toLocaleDateString() });
  if (userHistory[userId].length > 5) userHistory[userId].pop();
  if (!userStats[userId]) userStats[userId] = { total: 0, bytes: 0 };
  userStats[userId].total++;
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
bot.onText(/\/start/, (msg) => {
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
    '━━━━━━━━━━━━━━━━━\n' +
    '👉 *To start:* Just send me any file!',
    { parse_mode: 'Markdown' }
  );
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
    delete userState[userId];

  } catch (err) {
    console.error(err);
    bot.editMessageText(`❌ Failed: ${err.message}`, { chat_id: chatId, message_id: msgId });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

console.log('Bot started!');
