const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const RENDER_URL = process.env.RENDER_URL || '';
const PORT = process.env.PORT || 3000;

// Express app to keep Render happy (web service needs HTTP)
const app = express();
app.use(express.json());
app.get('/', (req, res) => res.send('File Converter Bot is running!'));

let bot;

if (RENDER_URL) {
  // Webhook mode for Render
  bot = new TelegramBot(BOT_TOKEN);
  bot.setWebHook(`${RENDER_URL}/bot${BOT_TOKEN}`);
  app.post(`/bot${BOT_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });
} else {
  // Polling for local
  bot = new TelegramBot(BOT_TOKEN, { polling: true });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Self-ping every 4 minutes to prevent Render free tier from sleeping
  if (RENDER_URL) {
    setInterval(() => {
      axios.get(RENDER_URL).catch(() => {});
      console.log('Self-ping sent to stay awake');
    }, 4 * 60 * 1000);
  }
});

// Supported conversions
const CONVERSIONS = {
  // Images
  jpg:  ['png', 'webp', 'bmp', 'gif', 'pdf'],
  jpeg: ['png', 'webp', 'bmp', 'gif', 'pdf'],
  png:  ['jpg', 'webp', 'bmp', 'gif', 'pdf'],
  webp: ['jpg', 'png', 'bmp', 'gif'],
  bmp:  ['jpg', 'png', 'webp', 'gif'],
  gif:  ['jpg', 'png', 'webp', 'mp4'],
  tiff: ['jpg', 'png', 'webp', 'pdf'],
  tif:  ['jpg', 'png', 'webp', 'pdf'],
  // Documents
  pdf:  ['txt'],
  txt:  ['pdf'],
  docx: ['txt', 'pdf'],
  xlsx: ['csv'],
  csv:  ['xlsx'],
  // Audio
  mp3:  ['wav', 'ogg', 'flac', 'aac', 'm4a'],
  wav:  ['mp3', 'ogg', 'flac', 'aac'],
  ogg:  ['mp3', 'wav', 'flac'],
  flac: ['mp3', 'wav', 'ogg'],
  aac:  ['mp3', 'wav', 'ogg'],
  m4a:  ['mp3', 'wav', 'ogg'],
  // Video
  mp4:  ['avi', 'mov', 'mkv', 'webm', 'gif', 'mp3'],
  avi:  ['mp4', 'mov', 'mkv', 'mp3'],
  mov:  ['mp4', 'avi', 'mkv', 'mp3'],
  mkv:  ['mp4', 'avi', 'mov', 'mp3'],
  webm: ['mp4', 'avi', 'mov', 'gif'],
  flv:  ['mp4', 'avi', 'mkv', 'mp3'],
};

// User state storage
const userState = {};

// Download file from Telegram
async function downloadFile(fileId, destPath) {
  const fileInfo = await bot.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileInfo.file_path}`;
  const response = await axios({ url, responseType: 'arraybuffer' });
  fs.writeFileSync(destPath, Buffer.from(response.data));
}

// Convert using CloudConvert API (free tier: 25 conversions/day)
async function convertWithCloudConvert(inputPath, inputFmt, outputPath, outputFmt) {
  const CLOUD_CONVERT_KEY = process.env.CLOUD_CONVERT_KEY || '';
  
  if (!CLOUD_CONVERT_KEY) {
    throw new Error('CLOUD_CONVERT_KEY not set');
  }

  const FormData = require('form-data');
  
  // Create job
  const jobRes = await axios.post('https://api.cloudconvert.com/v2/jobs', {
    tasks: {
      'upload-file': { operation: 'import/upload' },
      'convert-file': {
        operation: 'convert',
        input: 'upload-file',
        input_format: inputFmt,
        output_format: outputFmt
      },
      'export-file': {
        operation: 'export/url',
        input: 'convert-file'
      }
    }
  }, {
    headers: { Authorization: `Bearer ${CLOUD_CONVERT_KEY}` }
  });

  const job = jobRes.data.data;
  const uploadTask = job.tasks.find(t => t.name === 'upload-file');

  // Upload file
  const form = new FormData();
  Object.entries(uploadTask.result.form.parameters).forEach(([k, v]) => form.append(k, v));
  form.append('file', fs.createReadStream(inputPath));
  await axios.post(uploadTask.result.form.url, form, { headers: form.getHeaders() });

  // Wait for result
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

  if (!exportTask?.result?.files?.[0]?.url) throw new Error('No output file from CloudConvert');

  // Download result
  const dlRes = await axios({ url: exportTask.result.files[0].url, responseType: 'arraybuffer' });
  fs.writeFileSync(outputPath, Buffer.from(dlRes.data));
}

// Local image conversion using Sharp
async function convertImage(inputPath, outputPath, outputFmt) {
  const sharp = require('sharp');
  const fmt = outputFmt === 'jpg' ? 'jpeg' : outputFmt;
  if (['jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff'].includes(fmt)) {
    await sharp(inputPath).toFormat(fmt).toFile(outputPath);
  } else {
    throw new Error('Unsupported image format for local conversion');
  }
}

// Local audio/video using ffmpeg
async function convertMedia(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = require('fluent-ffmpeg');
    ffmpeg(inputPath)
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

// Local XLSX to CSV
async function xlsxToCsv(inputPath, outputPath) {
  const XLSX = require('xlsx');
  const wb = XLSX.readFile(inputPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const csv = XLSX.utils.sheet_to_csv(ws);
  fs.writeFileSync(outputPath, csv);
}

// Local CSV to XLSX
async function csvToXlsx(inputPath, outputPath) {
  const XLSX = require('xlsx');
  const csv = fs.readFileSync(inputPath, 'utf8');
  const ws = XLSX.utils.aoa_to_sheet(csv.split('\n').map(r => r.split(',')));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, outputPath);
}

// Local DOCX to TXT
async function docxToTxt(inputPath, outputPath) {
  const mammoth = require('mammoth');
  const result = await mammoth.extractRawText({ path: inputPath });
  fs.writeFileSync(outputPath, result.value);
}

// Main conversion dispatcher
async function convertFile(inputPath, inputFmt, outputPath, outputFmt) {
  const imgFormats = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tiff', 'tif'];
  const mediaFormats = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'mp4', 'avi', 'mov', 'mkv', 'webm', 'flv'];

  if (imgFormats.includes(inputFmt) && imgFormats.includes(outputFmt)) {
    await convertImage(inputPath, outputPath, outputFmt);
  } else if (mediaFormats.includes(inputFmt) && mediaFormats.includes(outputFmt)) {
    await convertMedia(inputPath, outputPath);
  } else if (inputFmt === 'xlsx' && outputFmt === 'csv') {
    await xlsxToCsv(inputPath, outputPath);
  } else if (inputFmt === 'csv' && outputFmt === 'xlsx') {
    await csvToXlsx(inputPath, outputPath);
  } else if (inputFmt === 'docx' && outputFmt === 'txt') {
    await docxToTxt(inputPath, outputPath);
  } else {
    // Fallback to CloudConvert for everything else (pdf, txt, docx→pdf, etc.)
    await convertWithCloudConvert(inputPath, inputFmt, outputPath, outputFmt);
  }
}

// ─── BOT HANDLERS ─────────────────────────────────────────────────────────────

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
    '👋 *Welcome to FileConverter Bot!*\n\n' +
    'I can convert almost any file format for you.\n\n' +
    '🖼 *Images:* JPG, PNG, WebP, BMP, GIF, TIFF\n' +
    '📄 *Documents:* PDF, DOCX, TXT, XLSX, CSV\n' +
    '🎵 *Audio:* MP3, WAV, OGG, FLAC, AAC, M4A\n' +
    '🎬 *Video:* MP4, AVI, MOV, MKV, WebM, FLV\n\n' +
    'Just send me any file! ✨',
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    '📖 *How to use:*\n\n1. Send me any file\n2. Pick output format\n3. Get converted file!\n\nMax size: 20MB',
    { parse_mode: 'Markdown' }
  );
});

// Handle incoming files
async function handleFile(msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  let fileId, fileName;

  if (msg.document) {
    fileId = msg.document.file_id;
    fileName = msg.document.file_name || 'file';
  } else if (msg.photo) {
    fileId = msg.photo[msg.photo.length - 1].file_id;
    fileName = 'photo.jpg';
  } else if (msg.audio) {
    fileId = msg.audio.file_id;
    fileName = msg.audio.file_name || 'audio.mp3';
  } else if (msg.video) {
    fileId = msg.video.file_id;
    fileName = msg.video.file_name || 'video.mp4';
  } else if (msg.voice) {
    fileId = msg.voice.file_id;
    fileName = 'voice.ogg';
  } else {
    return bot.sendMessage(chatId, '❌ Please send a file.');
  }

  const ext = path.extname(fileName).toLowerCase().replace('.', '');
  if (!ext || !CONVERSIONS[ext]) {
    return bot.sendMessage(chatId, `❌ Format *${ext.toUpperCase()}* not supported yet.`, { parse_mode: 'Markdown' });
  }

  const formats = CONVERSIONS[ext];
  userState[userId] = { fileId, fileName, inputExt: ext };

  const keyboard = {
    inline_keyboard: []
  };

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
    `📁 Got *${fileName}*\n\nConvert *${ext.toUpperCase()}* to:`,
    { parse_mode: 'Markdown', reply_markup: keyboard }
  );
}

bot.on('message', (msg) => {
  if (msg.document || msg.photo || msg.audio || msg.video || msg.voice) {
    handleFile(msg);
  }
});

// Handle button clicks
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

  if (!state) {
    return bot.editMessageText('❌ Session expired. Send the file again.', { chat_id: chatId, message_id: msgId });
  }

  const { fileId, fileName, inputExt } = state;

  bot.editMessageText(
    `⏳ Converting *${inputExt.toUpperCase()}* → *${outputFmt.toUpperCase()}*...\nPlease wait.`,
    { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown' }
  );

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgbot-'));
  const inputPath = path.join(tmpDir, `input.${inputExt}`);
  const outputFileName = path.basename(fileName, path.extname(fileName)) + `.${outputFmt}`;
  const outputPath = path.join(tmpDir, outputFileName);

  try {
    await downloadFile(fileId, inputPath);
    await convertFile(inputPath, inputExt, outputPath, outputFmt);

    bot.editMessageText(`✅ Sending your *${outputFmt.toUpperCase()}* file...`, {
      chat_id: chatId, message_id: msgId, parse_mode: 'Markdown'
    });

    await bot.sendDocument(chatId, outputPath, {
      caption: `✅ *${fileName}* → *${outputFileName}*`,
      parse_mode: 'Markdown'
    });

    delete userState[userId];
  } catch (err) {
    console.error(err);
    bot.editMessageText(`❌ Failed: ${err.message}`, { chat_id: chatId, message_id: msgId });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

console.log('Bot started!');
