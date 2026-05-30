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

const T = {
  en: {
    welcome: (name) => `Welcome to GENZ_CONVERTER Bot, ${name}!\n\nConvert any file format instantly.\n\nImages: JPG PNG WebP BMP GIF TIFF\nDocuments: PDF DOCX TXT XLSX CSV\nAudio: MP3 WAV OGG FLAC AAC M4A\nVideo: MP4 AVI MOV MKV WebM FLV\n\nCONVERT & TOOLS:\n/compress - Compress an image\n/resize - Resize an image\n/merge - Combine images into PDF\n/ocr - Extract text from image\n/qr [text] - Generate QR code\n/removebg - Remove image background\n/gif - Convert video to GIF\n/sticker - Image to Telegram sticker\n\nCREATE FILES:\n/createpdf - Create PDF from text\n/createtxt - Create TXT file from text\n\nYOUR ACCOUNT:\n/profile - Your profile and plan\n/history - Your conversion history\n/stats - Your usage stats\n/refer - Referral link (3 = 7 days free!)\n/redeem - Redeem promo code\n/myid - Get your Telegram ID\n/language - Change language\n\nFree: 10 conversions/day up to 5MB\nPremium: Unlimited + up to 50MB\n\nJust send me any file to get started!`,
    language_prompt: '🌍 Select your language:',
    language_set: (lang) => `✅ Language set to ${lang}!`,
    send_size: 'Send the size e.g. 800x600',
    invalid_size: 'Invalid format. Send like 800x600',
    size_set: (w, h) => `Size set to ${w}x${h}. Now send the image!`,
    send_image_compress: 'Send me an image to compress.',
    send_image_resize: 'Size set! Now send the image to resize.',
    send_images_merge: 'Send images one by one then /done',
    send_image_ocr: 'Send me an image to extract text from.',
    send_image_removebg: 'Send me an image and I will remove its background!',
    send_video_gif: 'Send me a video and I will convert it to a GIF!',
    send_image_sticker: 'Send me an image and I will convert it to a Telegram sticker!',
    send_text_pdf: 'Type or paste your text and I will create a PDF file from it.\n\nSend your text now:',
    send_text_txt: 'Type or paste your text and I will create a TXT file.\n\nSend your text now:',
    converting: (from, to) => `Converting ${from} to ${to}...`,
    done: '✅ Done!',
    failed: (e) => `❌ Failed: ${e}`,
    cancelled: 'Cancelled.',
    session_expired: 'Session expired. Send the file again.',
    file_too_large: 'File too large! Free users: max 5MB.\nUpgrade for 50MB.',
    format_not_supported: (f) => `Format ${f} is not supported.`,
    convert_to: (ext, name, size, remaining) => `File: ${name}\nSize: ${size}\n${remaining}\n\nConvert ${ext} to:`,
    conversions_left: (n) => `${n} conversion${n===1?'':'s'} left today`,
    unlimited: 'Unlimited conversions',
    no_images_merge: 'No images to merge. Use /merge first.',
    merging: (n) => `Merging ${n} images...`,
    image_added: (n) => `Image ${n} added. Send more or /done`,
    extracting_text: 'Extracting text...',
    no_text_found: 'No text found in the image.',
    compressing: 'Compressing...',
    resizing: 'Resizing...',
    removing_bg: 'Removing background... this may take 10-20 seconds.',
    converting_gif: 'Converting to GIF... please wait.',
    creating_sticker: 'Creating sticker...',
    creating_pdf: 'Creating PDF...',
    upgrade_msg: (timeLeft) => `You have used all 10 free conversions today.\n\nResets in: ${timeLeft}\n\nUpgrade to Premium:\n- Unlimited conversions\n- Files up to 50MB\n\nPricing:\n30 Days - ₦1,500\nLifetime - ₦5,000\n\nHow:\n1. Send /myid\n2. Send ID + payment on WhatsApp\n3. Activated within minutes!`,
    upgrade_btn: 'Upgrade on WhatsApp',
    myid_msg: (id) => `Your Telegram ID:\n\n${id}\n\nSend this to WhatsApp when upgrading.`,
    no_history: 'No history yet. Send me a file!',
    qr_generating: 'Generating QR code...',
    qr_usage: 'Usage: /qr your text\n\nExample: /qr https://google.com',
    promo_success: (days) => `🎉 Code redeemed!\n\nYou got ${days} days of FREE Premium!\n\nEnjoy unlimited conversions!`,
    promo_failed: (msg) => `Failed: ${msg}`,
    send_promo_code: 'Send your promo code:',
  },
  fr: {
    welcome: (name) => `Bienvenue sur GENZ_CONVERTER Bot, ${name}!\n\nConvertissez n'importe quel format de fichier instantanément.\n\nImages: JPG PNG WebP BMP GIF TIFF\nDocuments: PDF DOCX TXT XLSX CSV\nAudio: MP3 WAV OGG FLAC AAC M4A\nVidéo: MP4 AVI MOV MKV WebM FLV\n\nOUTILS:\n/compress - Compresser une image\n/resize - Redimensionner une image\n/merge - Combiner des images en PDF\n/ocr - Extraire du texte d'une image\n/qr [texte] - Générer un QR code\n/removebg - Supprimer l'arrière-plan\n/gif - Convertir une vidéo en GIF\n/sticker - Image en sticker Telegram\n\nCRÉER DES FICHIERS:\n/createpdf - Créer un PDF\n/createtxt - Créer un fichier TXT\n\nVOTRE COMPTE:\n/profile - Votre profil\n/history - Historique\n/stats - Statistiques\n/refer - Lien de parrainage\n/redeem - Code promo\n/myid - Votre ID Telegram\n/language - Changer de langue\n\nGratuit: 10 conversions/jour jusqu'à 5Mo\nPremium: Illimité + jusqu'à 50Mo`,
    language_prompt: '🌍 Sélectionnez votre langue:',
    language_set: (lang) => `✅ Langue définie sur ${lang}!`,
    send_size: 'Envoyez la taille, ex: 800x600',
    invalid_size: 'Format invalide. Envoyez comme 800x600',
    size_set: (w, h) => `Taille définie à ${w}x${h}. Envoyez maintenant l'image!`,
    send_image_compress: 'Envoyez-moi une image à compresser.',
    send_image_resize: 'Taille définie! Envoyez maintenant l\'image.',
    send_images_merge: 'Envoyez les images une par une puis /done',
    send_image_ocr: 'Envoyez-moi une image pour extraire le texte.',
    send_image_removebg: 'Envoyez-moi une image pour supprimer l\'arrière-plan!',
    send_video_gif: 'Envoyez-moi une vidéo pour la convertir en GIF!',
    send_image_sticker: 'Envoyez-moi une image pour la convertir en sticker!',
    send_text_pdf: 'Tapez ou collez votre texte pour créer un PDF.\n\nEnvoyez votre texte:',
    send_text_txt: 'Tapez ou collez votre texte pour créer un TXT.\n\nEnvoyez votre texte:',
    converting: (from, to) => `Conversion de ${from} vers ${to}...`,
    done: '✅ Terminé!',
    failed: (e) => `❌ Échec: ${e}`,
    cancelled: 'Annulé.',
    session_expired: 'Session expirée. Envoyez le fichier à nouveau.',
    file_too_large: 'Fichier trop grand! Gratuit: max 5Mo.\nPassez à Premium pour 50Mo.',
    format_not_supported: (f) => `Format ${f} non supporté.`,
    convert_to: (ext, name, size, remaining) => `Fichier: ${name}\nTaille: ${size}\n${remaining}\n\nConvertir ${ext} en:`,
    conversions_left: (n) => `${n} conversion${n===1?'':'s'} restante${n===1?'':'s'} aujourd'hui`,
    unlimited: 'Conversions illimitées',
    no_images_merge: 'Aucune image à fusionner. Utilisez /merge d\'abord.',
    merging: (n) => `Fusion de ${n} images...`,
    image_added: (n) => `Image ${n} ajoutée. Envoyez-en d'autres ou /done`,
    extracting_text: 'Extraction du texte...',
    no_text_found: 'Aucun texte trouvé dans l\'image.',
    compressing: 'Compression...',
    resizing: 'Redimensionnement...',
    removing_bg: 'Suppression de l\'arrière-plan... 10-20 secondes.',
    converting_gif: 'Conversion en GIF... veuillez patienter.',
    creating_sticker: 'Création du sticker...',
    creating_pdf: 'Création du PDF...',
    upgrade_msg: (timeLeft) => `Vous avez utilisé toutes vos 10 conversions gratuites.\n\nRéinitialisation dans: ${timeLeft}\n\nPassez à Premium:\n- Conversions illimitées\n- Fichiers jusqu'à 50Mo\n\nTarifs:\n30 Jours - ₦1,500\nÀ vie - ₦5,000`,
    upgrade_btn: 'Mettre à niveau sur WhatsApp',
    myid_msg: (id) => `Votre ID Telegram:\n\n${id}\n\nEnvoyez ceci sur WhatsApp lors de la mise à niveau.`,
    no_history: 'Aucun historique. Envoyez-moi un fichier!',
    qr_generating: 'Génération du QR code...',
    qr_usage: 'Usage: /qr votre texte\n\nExemple: /qr https://google.com',
    promo_success: (days) => `🎉 Code utilisé!\n\nVous avez obtenu ${days} jours Premium GRATUIT!`,
    promo_failed: (msg) => `Échec: ${msg}`,
    send_promo_code: 'Envoyez votre code promo:',
  },
  es: {
    welcome: (name) => `¡Bienvenido a GENZ_CONVERTER Bot, ${name}!\n\nConvierte cualquier formato de archivo al instante.\n\nImágenes: JPG PNG WebP BMP GIF TIFF\nDocumentos: PDF DOCX TXT XLSX CSV\nAudio: MP3 WAV OGG FLAC AAC M4A\nVídeo: MP4 AVI MOV MKV WebM FLV\n\nHERRAMIENTAS:\n/compress - Comprimir imagen\n/resize - Redimensionar imagen\n/merge - Combinar imágenes en PDF\n/ocr - Extraer texto de imagen\n/qr [texto] - Generar código QR\n/removebg - Eliminar fondo\n/gif - Convertir vídeo a GIF\n/sticker - Imagen a sticker\n\n/language - Cambiar idioma\n\nGratis: 10 conversiones/día hasta 5MB\nPremium: Ilimitado + hasta 50MB`,
    language_prompt: '🌍 Selecciona tu idioma:',
    language_set: (lang) => `✅ Idioma establecido en ${lang}!`,
    send_size: 'Envía el tamaño, ej: 800x600',
    invalid_size: 'Formato inválido. Envía como 800x600',
    size_set: (w, h) => `Tamaño establecido en ${w}x${h}. ¡Ahora envía la imagen!`,
    send_image_compress: 'Envíame una imagen para comprimir.',
    send_image_resize: '¡Tamaño listo! Ahora envía la imagen.',
    send_images_merge: 'Envía imágenes una a una y luego /done',
    send_image_ocr: 'Envíame una imagen para extraer el texto.',
    send_image_removebg: '¡Envíame una imagen y eliminaré el fondo!',
    send_video_gif: '¡Envíame un vídeo y lo convertiré a GIF!',
    send_image_sticker: '¡Envíame una imagen y la convertiré a sticker!',
    send_text_pdf: 'Escribe o pega tu texto para crear un PDF.\n\nEnvía tu texto:',
    send_text_txt: 'Escribe o pega tu texto para crear un TXT.\n\nEnvía tu texto:',
    converting: (from, to) => `Convirtiendo ${from} a ${to}...`,
    done: '✅ ¡Listo!',
    failed: (e) => `❌ Error: ${e}`,
    cancelled: 'Cancelado.',
    session_expired: 'Sesión expirada. Envía el archivo de nuevo.',
    file_too_large: '¡Archivo demasiado grande! Gratis: máx 5MB.\nActualiza para 50MB.',
    format_not_supported: (f) => `Formato ${f} no soportado.`,
    convert_to: (ext, name, size, remaining) => `Archivo: ${name}\nTamaño: ${size}\n${remaining}\n\nConvertir ${ext} a:`,
    conversions_left: (n) => `${n} conversión${n===1?'':'es'} restante${n===1?'':'s'} hoy`,
    unlimited: 'Conversiones ilimitadas',
    no_images_merge: 'No hay imágenes para combinar. Usa /merge primero.',
    merging: (n) => `Combinando ${n} imágenes...`,
    image_added: (n) => `Imagen ${n} añadida. Envía más o /done`,
    extracting_text: 'Extrayendo texto...',
    no_text_found: 'No se encontró texto en la imagen.',
    compressing: 'Comprimiendo...',
    resizing: 'Redimensionando...',
    removing_bg: 'Eliminando fondo... 10-20 segundos.',
    converting_gif: 'Convirtiendo a GIF... por favor espera.',
    creating_sticker: 'Creando sticker...',
    creating_pdf: 'Creando PDF...',
    upgrade_msg: (timeLeft) => `Has usado todas tus 10 conversiones gratuitas.\n\nSe reinicia en: ${timeLeft}\n\nActualiza a Premium:\n- Conversiones ilimitadas\n- Archivos hasta 50MB\n\nPrecios:\n30 Días - ₦1,500\nDe por vida - ₦5,000`,
    upgrade_btn: 'Actualizar en WhatsApp',
    myid_msg: (id) => `Tu ID de Telegram:\n\n${id}\n\nEnvía esto a WhatsApp al actualizar.`,
    no_history: 'Sin historial. ¡Envíame un archivo!',
    qr_generating: 'Generando código QR...',
    qr_usage: 'Uso: /qr tu texto\n\nEjemplo: /qr https://google.com',
    promo_success: (days) => `🎉 ¡Código canjeado!\n\n¡Obtuviste ${days} días de Premium GRATIS!`,
    promo_failed: (msg) => `Error: ${msg}`,
    send_promo_code: 'Envía tu código promocional:',
  },
  ar: {
    welcome: (name) => `مرحباً في GENZ_CONVERTER Bot، ${name}!\n\nحوّل أي صيغة ملف فورياً.\n\nصور: JPG PNG WebP BMP GIF TIFF\nمستندات: PDF DOCX TXT XLSX CSV\nصوت: MP3 WAV OGG FLAC AAC M4A\nفيديو: MP4 AVI MOV MKV WebM FLV\n\nالأدوات:\n/compress - ضغط صورة\n/resize - تغيير حجم صورة\n/merge - دمج صور في PDF\n/ocr - استخراج نص من صورة\n/qr [نص] - إنشاء رمز QR\n/removebg - إزالة الخلفية\n/gif - تحويل فيديو إلى GIF\n/sticker - صورة إلى ملصق\n\n/language - تغيير اللغة\n\nمجاني: 10 تحويلات/يوم حتى 5MB\nبريميوم: غير محدود + حتى 50MB`,
    language_prompt: '🌍 اختر لغتك:',
    language_set: (lang) => `✅ تم ضبط اللغة على ${lang}!`,
    send_size: 'أرسل الحجم، مثال: 800x600',
    invalid_size: 'صيغة غير صحيحة. أرسل مثل 800x600',
    size_set: (w, h) => `تم ضبط الحجم على ${w}x${h}. أرسل الصورة الآن!`,
    send_image_compress: 'أرسل لي صورة لضغطها.',
    send_image_resize: 'تم ضبط الحجم! أرسل الصورة الآن.',
    send_images_merge: 'أرسل الصور واحدة تلو الأخرى ثم /done',
    send_image_ocr: 'أرسل لي صورة لاستخراج النص منها.',
    send_image_removebg: 'أرسل لي صورة وسأزيل خلفيتها!',
    send_video_gif: 'أرسل لي فيديو وسأحوله إلى GIF!',
    send_image_sticker: 'أرسل لي صورة وسأحولها إلى ملصق!',
    send_text_pdf: 'اكتب أو الصق نصك لإنشاء PDF.\n\nأرسل نصك:',
    send_text_txt: 'اكتب أو الصق نصك لإنشاء TXT.\n\nأرسل نصك:',
    converting: (from, to) => `جارٍ تحويل ${from} إلى ${to}...`,
    done: '✅ تم!',
    failed: (e) => `❌ فشل: ${e}`,
    cancelled: 'تم الإلغاء.',
    session_expired: 'انتهت الجلسة. أرسل الملف مجدداً.',
    file_too_large: 'الملف كبير جداً! مجاني: حتى 5MB.\nترقَّ للحصول على 50MB.',
    format_not_supported: (f) => `الصيغة ${f} غير مدعومة.`,
    convert_to: (ext, name, size, remaining) => `الملف: ${name}\nالحجم: ${size}\n${remaining}\n\nتحويل ${ext} إلى:`,
    conversions_left: (n) => `${n} تحويل متبقٍ اليوم`,
    unlimited: 'تحويلات غير محدودة',
    no_images_merge: 'لا توجد صور للدمج. استخدم /merge أولاً.',
    merging: (n) => `جارٍ دمج ${n} صور...`,
    image_added: (n) => `تمت إضافة الصورة ${n}. أرسل المزيد أو /done`,
    extracting_text: 'جارٍ استخراج النص...',
    no_text_found: 'لم يُعثر على نص في الصورة.',
    compressing: 'جارٍ الضغط...',
    resizing: 'جارٍ تغيير الحجم...',
    removing_bg: 'جارٍ إزالة الخلفية... 10-20 ثانية.',
    converting_gif: 'جارٍ التحويل إلى GIF... يرجى الانتظار.',
    creating_sticker: 'جارٍ إنشاء الملصق...',
    creating_pdf: 'جارٍ إنشاء PDF...',
    upgrade_msg: (timeLeft) => `لقد استخدمت جميع تحويلاتك المجانية الـ10.\n\nإعادة التعيين في: ${timeLeft}\n\nترقَّ إلى Premium:\n- تحويلات غير محدودة\n- ملفات حتى 50MB\n\nالأسعار:\n30 يوم - ₦1,500\nمدى الحياة - ₦5,000`,
    upgrade_btn: 'الترقية عبر واتساب',
    myid_msg: (id) => `معرّف Telegram الخاص بك:\n\n${id}\n\nأرسل هذا على واتساب عند الترقية.`,
    no_history: 'لا يوجد سجل. أرسل لي ملفاً!',
    qr_generating: 'جارٍ إنشاء رمز QR...',
    qr_usage: 'الاستخدام: /qr نصك\n\nمثال: /qr https://google.com',
    promo_success: (days) => `🎉 تم استرداد الكود!\n\nحصلت على ${days} يوم Premium مجاناً!`,
    promo_failed: (msg) => `فشل: ${msg}`,
    send_promo_code: 'أرسل كود الخصم:',
  },
  zh: {
    welcome: (name) => `欢迎使用 GENZ_CONVERTER Bot，${name}！\n\n即时转换任何文件格式。\n\n图片: JPG PNG WebP BMP GIF TIFF\n文档: PDF DOCX TXT XLSX CSV\n音频: MP3 WAV OGG FLAC AAC M4A\n视频: MP4 AVI MOV MKV WebM FLV\n\n工具:\n/compress - 压缩图片\n/resize - 调整图片大小\n/merge - 合并图片为PDF\n/ocr - 从图片提取文字\n/qr [文字] - 生成二维码\n/removebg - 去除背景\n/gif - 视频转GIF\n/sticker - 图片转贴纸\n\n/language - 更改语言\n\n免费: 每天10次转换，最大5MB\n高级: 无限 + 最大50MB`,
    language_prompt: '🌍 选择您的语言:',
    language_set: (lang) => `✅ 语言已设置为${lang}！`,
    send_size: '发送尺寸，例如: 800x600',
    invalid_size: '格式无效。请发送如 800x600',
    size_set: (w, h) => `尺寸已设置为${w}x${h}。现在发送图片！`,
    send_image_compress: '发送一张图片来压缩。',
    send_image_resize: '尺寸已设置！现在发送图片。',
    send_images_merge: '逐一发送图片，然后 /done',
    send_image_ocr: '发送一张图片来提取文字。',
    send_image_removebg: '发送一张图片，我将去除背景！',
    send_video_gif: '发送一个视频，我将转换为GIF！',
    send_image_sticker: '发送一张图片，我将转换为贴纸！',
    send_text_pdf: '输入或粘贴文字来创建PDF。\n\n发送您的文字:',
    send_text_txt: '输入或粘贴文字来创建TXT。\n\n发送您的文字:',
    converting: (from, to) => `正在将${from}转换为${to}...`,
    done: '✅ 完成！',
    failed: (e) => `❌ 失败: ${e}`,
    cancelled: '已取消。',
    session_expired: '会话已过期。请重新发送文件。',
    file_too_large: '文件太大！免费用户最大5MB。\n升级获得50MB。',
    format_not_supported: (f) => `不支持${f}格式。`,
    convert_to: (ext, name, size, remaining) => `文件: ${name}\n大小: ${size}\n${remaining}\n\n将${ext}转换为:`,
    conversions_left: (n) => `今天还剩${n}次转换`,
    unlimited: '无限转换',
    no_images_merge: '没有图片可合并。请先使用/merge。',
    merging: (n) => `正在合并${n}张图片...`,
    image_added: (n) => `已添加第${n}张图片。继续发送或 /done`,
    extracting_text: '正在提取文字...',
    no_text_found: '图片中未找到文字。',
    compressing: '正在压缩...',
    resizing: '正在调整大小...',
    removing_bg: '正在去除背景... 10-20秒。',
    converting_gif: '正在转换为GIF... 请稍候。',
    creating_sticker: '正在创建贴纸...',
    creating_pdf: '正在创建PDF...',
    upgrade_msg: (timeLeft) => `您已用完今天的10次免费转换。\n\n重置时间: ${timeLeft}\n\n升级到高级版:\n- 无限转换\n- 文件最大50MB\n\n价格:\n30天 - ₦1,500\n终身 - ₦5,000`,
    upgrade_btn: '在WhatsApp上升级',
    myid_msg: (id) => `您的Telegram ID:\n\n${id}\n\n升级时请将此发送到WhatsApp。`,
    no_history: '暂无历史记录。发送一个文件吧！',
    qr_generating: '正在生成二维码...',
    qr_usage: '用法: /qr 您的文字\n\n示例: /qr https://google.com',
    promo_success: (days) => `🎉 兑换成功！\n\n您获得了${days}天免费高级会员！`,
    promo_failed: (msg) => `失败: ${msg}`,
    send_promo_code: '请发送您的促销码:',
  },
  hi: {
    welcome: (name) => `GENZ_CONVERTER Bot में आपका स्वागत है, ${name}!\n\nकिसी भी फ़ाइल फ़ॉर्मेट को तुरंत कन्वर्ट करें।\n\nचित्र: JPG PNG WebP BMP GIF TIFF\nदस्तावेज़: PDF DOCX TXT XLSX CSV\nऑडियो: MP3 WAV OGG FLAC AAC M4A\nवीडियो: MP4 AVI MOV MKV WebM FLV\n\n/language - भाषा बदलें\n\nमुफ़्त: 10 कन्वर्शन/दिन, 5MB तक\nप्रीमियम: असीमित + 50MB तक`,
    language_prompt: '🌍 अपनी भाषा चुनें:',
    language_set: (lang) => `✅ भाषा ${lang} पर सेट की गई!`,
    send_size: 'आकार भेजें, जैसे: 800x600',
    invalid_size: 'अमान्य फ़ॉर्मेट। 800x600 जैसा भेजें',
    size_set: (w, h) => `आकार ${w}x${h} सेट हो गया। अब चित्र भेजें!`,
    send_image_compress: 'कम्प्रेस करने के लिए कोई चित्र भेजें।',
    send_image_resize: 'आकार सेट हो गया! अब चित्र भेजें।',
    send_images_merge: 'एक-एक करके चित्र भेजें फिर /done',
    send_image_ocr: 'टेक्स्ट निकालने के लिए चित्र भेजें।',
    send_image_removebg: 'पृष्ठभूमि हटाने के लिए चित्र भेजें!',
    send_video_gif: 'GIF में बदलने के लिए वीडियो भेजें!',
    send_image_sticker: 'स्टिकर बनाने के लिए चित्र भेजें!',
    send_text_pdf: 'PDF बनाने के लिए टेक्स्ट टाइप करें।\n\nअपना टेक्स्ट भेजें:',
    send_text_txt: 'TXT बनाने के लिए टेक्स्ट टाइप करें।\n\nअपना टेक्स्ट भेजें:',
    converting: (from, to) => `${from} को ${to} में कन्वर्ट हो रहा है...`,
    done: '✅ हो गया!',
    failed: (e) => `❌ विफल: ${e}`,
    cancelled: 'रद्द किया गया।',
    session_expired: 'सत्र समाप्त हो गया। फ़ाइल फिर से भेजें।',
    file_too_large: 'फ़ाइल बहुत बड़ी है! मुफ़्त: अधिकतम 5MB।\n50MB के लिए अपग्रेड करें।',
    format_not_supported: (f) => `${f} फ़ॉर्मेट समर्थित नहीं है।`,
    convert_to: (ext, name, size, remaining) => `फ़ाइल: ${name}\nआकार: ${size}\n${remaining}\n\n${ext} को कन्वर्ट करें:`,
    conversions_left: (n) => `आज ${n} कन्वर्शन बचे हैं`,
    unlimited: 'असीमित कन्वर्शन',
    no_images_merge: 'मर्ज करने के लिए कोई चित्र नहीं। पहले /merge उपयोग करें।',
    merging: (n) => `${n} चित्र मर्ज हो रहे हैं...`,
    image_added: (n) => `चित्र ${n} जोड़ा गया। और भेजें या /done`,
    extracting_text: 'टेक्स्ट निकाला जा रहा है...',
    no_text_found: 'चित्र में कोई टेक्स्ट नहीं मिला।',
    compressing: 'कम्प्रेस हो रहा है...',
    resizing: 'आकार बदला जा रहा है...',
    removing_bg: 'पृष्ठभूमि हटाई जा रही है... 10-20 सेकंड।',
    converting_gif: 'GIF में कन्वर्ट हो रहा है... कृपया प्रतीक्षा करें।',
    creating_sticker: 'स्टिकर बनाया जा रहा है...',
    creating_pdf: 'PDF बनाया जा रहा है...',
    upgrade_msg: (timeLeft) => `आपने आज की सभी 10 मुफ़्त कन्वर्शन उपयोग कर ली हैं।\n\nरीसेट होगा: ${timeLeft} में\n\nप्रीमियम में अपग्रेड करें:\n- असीमित कन्वर्शन\n- 50MB तक फ़ाइलें\n\nकीमत:\n30 दिन - ₦1,500\nआजीवन - ₦5,000`,
    upgrade_btn: 'WhatsApp पर अपग्रेड करें',
    myid_msg: (id) => `आपकी Telegram ID:\n\n${id}\n\nअपग्रेड करते समय इसे WhatsApp पर भेजें।`,
    no_history: 'कोई इतिहास नहीं। मुझे कोई फ़ाइल भेजें!',
    qr_generating: 'QR कोड बनाया जा रहा है...',
    qr_usage: 'उपयोग: /qr आपका टेक्स्ट\n\nउदाहरण: /qr https://google.com',
    promo_success: (days) => `🎉 कोड रिडीम हो गया!\n\nआपको ${days} दिन का मुफ़्त प्रीमियम मिला!`,
    promo_failed: (msg) => `विफल: ${msg}`,
    send_promo_code: 'अपना प्रोमो कोड भेजें:',
  },
  pt: {
    welcome: (name) => `Bem-vindo ao GENZ_CONVERTER Bot, ${name}!\n\nConverta qualquer formato de arquivo instantaneamente.\n\nImagens: JPG PNG WebP BMP GIF TIFF\nDocumentos: PDF DOCX TXT XLSX CSV\nÁudio: MP3 WAV OGG FLAC AAC M4A\nVídeo: MP4 AVI MOV MKV WebM FLV\n\n/language - Mudar idioma\n\nGrátis: 10 conversões/dia até 5MB\nPremium: Ilimitado + até 50MB`,
    language_prompt: '🌍 Selecione seu idioma:',
    language_set: (lang) => `✅ Idioma definido para ${lang}!`,
    send_size: 'Envie o tamanho, ex: 800x600',
    invalid_size: 'Formato inválido. Envie como 800x600',
    size_set: (w, h) => `Tamanho definido para ${w}x${h}. Agora envie a imagem!`,
    send_image_compress: 'Envie uma imagem para comprimir.',
    send_image_resize: 'Tamanho definido! Agora envie a imagem.',
    send_images_merge: 'Envie imagens uma a uma e depois /done',
    send_image_ocr: 'Envie uma imagem para extrair o texto.',
    send_image_removebg: 'Envie uma imagem e removerei o fundo!',
    send_video_gif: 'Envie um vídeo e o convertirei para GIF!',
    send_image_sticker: 'Envie uma imagem e a convertirei em sticker!',
    send_text_pdf: 'Digite ou cole seu texto para criar um PDF.\n\nEnvie seu texto:',
    send_text_txt: 'Digite ou cole seu texto para criar um TXT.\n\nEnvie seu texto:',
    converting: (from, to) => `Convertendo ${from} para ${to}...`,
    done: '✅ Pronto!',
    failed: (e) => `❌ Falhou: ${e}`,
    cancelled: 'Cancelado.',
    session_expired: 'Sessão expirada. Envie o arquivo novamente.',
    file_too_large: 'Arquivo muito grande! Grátis: máx 5MB.\nAtualize para 50MB.',
    format_not_supported: (f) => `Formato ${f} não suportado.`,
    convert_to: (ext, name, size, remaining) => `Arquivo: ${name}\nTamanho: ${size}\n${remaining}\n\nConverter ${ext} para:`,
    conversions_left: (n) => `${n} conversão${n===1?'':'ões'} restante${n===1?'':'s'} hoje`,
    unlimited: 'Conversões ilimitadas',
    no_images_merge: 'Sem imagens para combinar. Use /merge primeiro.',
    merging: (n) => `Combinando ${n} imagens...`,
    image_added: (n) => `Imagem ${n} adicionada. Envie mais ou /done`,
    extracting_text: 'Extraindo texto...',
    no_text_found: 'Nenhum texto encontrado na imagem.',
    compressing: 'Comprimindo...',
    resizing: 'Redimensionando...',
    removing_bg: 'Removendo fundo... 10-20 segundos.',
    converting_gif: 'Convertendo para GIF... aguarde.',
    creating_sticker: 'Criando sticker...',
    creating_pdf: 'Criando PDF...',
    upgrade_msg: (timeLeft) => `Você usou todas as 10 conversões gratuitas.\n\nReset em: ${timeLeft}\n\nAtualize para Premium:\n- Conversões ilimitadas\n- Arquivos até 50MB\n\nPreços:\n30 Dias - ₦1,500\nVitalício - ₦5,000`,
    upgrade_btn: 'Atualizar no WhatsApp',
    myid_msg: (id) => `Seu ID do Telegram:\n\n${id}\n\nEnvie isso no WhatsApp ao atualizar.`,
    no_history: 'Sem histórico. Envie um arquivo!',
    qr_generating: 'Gerando QR code...',
    qr_usage: 'Uso: /qr seu texto\n\nExemplo: /qr https://google.com',
    promo_success: (days) => `🎉 Código resgatado!\n\nVocê ganhou ${days} dias de Premium GRÁTIS!`,
    promo_failed: (msg) => `Falhou: ${msg}`,
    send_promo_code: 'Envie seu código promocional:',
  },
  ru: {
    welcome: (name) => `Добро пожаловать в GENZ_CONVERTER Bot, ${name}!\n\nМгновенно конвертируйте любые форматы файлов.\n\nИзображения: JPG PNG WebP BMP GIF TIFF\nДокументы: PDF DOCX TXT XLSX CSV\nАудио: MP3 WAV OGG FLAC AAC M4A\nВидео: MP4 AVI MOV MKV WebM FLV\n\n/language - Сменить язык\n\nБесплатно: 10 конвертаций/день до 5МБ\nПремиум: Безлимитно + до 50МБ`,
    language_prompt: '🌍 Выберите ваш язык:',
    language_set: (lang) => `✅ Язык установлен: ${lang}!`,
    send_size: 'Отправьте размер, например: 800x600',
    invalid_size: 'Неверный формат. Отправьте как 800x600',
    size_set: (w, h) => `Размер установлен: ${w}x${h}. Теперь отправьте изображение!`,
    send_image_compress: 'Отправьте изображение для сжатия.',
    send_image_resize: 'Размер установлен! Теперь отправьте изображение.',
    send_images_merge: 'Отправляйте изображения по одному, затем /done',
    send_image_ocr: 'Отправьте изображение для извлечения текста.',
    send_image_removebg: 'Отправьте изображение и я удалю фон!',
    send_video_gif: 'Отправьте видео и я конвертирую в GIF!',
    send_image_sticker: 'Отправьте изображение и я сделаю стикер!',
    send_text_pdf: 'Введите или вставьте текст для создания PDF.\n\nОтправьте текст:',
    send_text_txt: 'Введите или вставьте текст для создания TXT.\n\nОтправьте текст:',
    converting: (from, to) => `Конвертация ${from} в ${to}...`,
    done: '✅ Готово!',
    failed: (e) => `❌ Ошибка: ${e}`,
    cancelled: 'Отменено.',
    session_expired: 'Сессия истекла. Отправьте файл снова.',
    file_too_large: 'Файл слишком большой! Бесплатно: макс 5МБ.\nОбновитесь для 50МБ.',
    format_not_supported: (f) => `Формат ${f} не поддерживается.`,
    convert_to: (ext, name, size, remaining) => `Файл: ${name}\nРазмер: ${size}\n${remaining}\n\nКонвертировать ${ext} в:`,
    conversions_left: (n) => `Осталось ${n} конвертаций сегодня`,
    unlimited: 'Безлимитные конвертации',
    no_images_merge: 'Нет изображений для объединения. Используйте /merge сначала.',
    merging: (n) => `Объединение ${n} изображений...`,
    image_added: (n) => `Изображение ${n} добавлено. Отправьте ещё или /done`,
    extracting_text: 'Извлечение текста...',
    no_text_found: 'Текст в изображении не найден.',
    compressing: 'Сжатие...',
    resizing: 'Изменение размера...',
    removing_bg: 'Удаление фона... 10-20 секунд.',
    converting_gif: 'Конвертация в GIF... подождите.',
    creating_sticker: 'Создание стикера...',
    creating_pdf: 'Создание PDF...',
    upgrade_msg: (timeLeft) => `Вы использовали все 10 бесплатных конвертаций.\n\nСброс через: ${timeLeft}\n\nОбновитесь до Premium:\n- Безлимитные конвертации\n- Файлы до 50МБ\n\nЦены:\n30 Дней - ₦1,500\nПожизненно - ₦5,000`,
    upgrade_btn: 'Обновить в WhatsApp',
    myid_msg: (id) => `Ваш Telegram ID:\n\n${id}\n\nОтправьте это в WhatsApp при обновлении.`,
    no_history: 'Нет истории. Отправьте файл!',
    qr_generating: 'Генерация QR-кода...',
    qr_usage: 'Использование: /qr ваш текст\n\nПример: /qr https://google.com',
    promo_success: (days) => `🎉 Код использован!\n\nВы получили ${days} дней бесплатного Premium!`,
    promo_failed: (msg) => `Ошибка: ${msg}`,
    send_promo_code: 'Отправьте ваш промокод:',
  },
};

// Fallback: all other languages get English with a note
function getLang(uid) {
  return userLangCache[uid] || 'en';
}

function t(uid, key, ...args) {
  const lang = getLang(uid);
  const strings = T[lang] || T['en'];
  const val = strings[key] !== undefined ? strings[key] : T['en'][key];
  if (typeof val === 'function') return val(...args);
  return val || key;
}

// In-memory language cache (also persisted to DB)
const userLangCache = {};

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
    await supabase.from('bot_users').update({ language: lang }).eq('user_id', uid);
  } catch(e) {}
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
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.get('/', (req, res) => res.send('GENZ_CONVERTER Bot is running!'));

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
  await bot.sendMessage(chatId, t(uid||chatId, 'upgrade_msg', timeLeft), { reply_markup: kb });
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

async function convertWithCloudConvert(inputPath, inputFmt, outputPath, outputFmt) {
  if (!CLOUD_CONVERT_KEY) throw new Error('This conversion requires CloudConvert API key');
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
  Object.entries(uploadTask.result.form.parameters).forEach(([k,v]) => form.append(k,v));
  form.append('file', fs.createReadStream(inputPath));
  await axios.post(uploadTask.result.form.url, form, { headers: form.getHeaders() });
  let exportTask;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const s = await axios.get('https://api.cloudconvert.com/v2/jobs/' + job.id, { headers: { Authorization: 'Bearer ' + CLOUD_CONVERT_KEY } });
    const tasks = s.data.data.tasks;
    exportTask = tasks.find(t => t.name === 'export-file');
    if (exportTask && exportTask.status === 'finished') break;
    if (tasks.some(t => t.status === 'error')) throw new Error('Conversion failed');
  }
  if (!exportTask || !exportTask.result || !exportTask.result.files[0]) throw new Error('No output from CloudConvert');
  const dl = await axios({ url: exportTask.result.files[0].url, responseType: 'arraybuffer' });
  fs.writeFileSync(outputPath, Buffer.from(dl.data));
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
  else await convertWithCloudConvert(inputPath, inputFmt, outputPath, outputFmt);
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
    res.json({ text: result.data.text.trim() });
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
  bot.sendMessage(msg.chat.id, t(uid, 'language_prompt'), { reply_markup: buildLangKeyboard() });
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
  bot.sendMessage(msg.chat.id, t(uid, 'welcome', msg.from.first_name));
});

bot.onText(/\/start$/, async (msg) => {
  saveUser(msg).catch(() => {});
  const uid = msg.from.id;
  await getUserLang(uid);
  bot.sendMessage(msg.chat.id, t(uid, 'welcome', msg.from.first_name));
});

bot.onText(/\/myid/, async (msg) => {
  const uid = msg.from.id;
  await getUserLang(uid);
  bot.sendMessage(msg.chat.id, t(uid, 'myid_msg', uid));
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
  bot.sendMessage(msg.chat.id, t(msg.from.id, 'qr_usage'));
});
bot.onText(/\/compress/, (msg) => { userState[msg.from.id] = { mode: 'compress' }; bot.sendMessage(msg.chat.id, t(msg.from.id, 'send_image_compress')); });
bot.onText(/\/resize/, (msg) => { userState[msg.from.id] = { mode: 'resize_waiting_size' }; bot.sendMessage(msg.chat.id, t(msg.from.id, 'send_size')); });
bot.onText(/\/merge/, (msg) => { userState[msg.from.id] = { mode: 'merge', images: [] }; bot.sendMessage(msg.chat.id, t(msg.from.id, 'send_images_merge')); });
bot.onText(/\/ocr/, (msg) => { userState[msg.from.id] = { mode: 'ocr' }; bot.sendMessage(msg.chat.id, t(msg.from.id, 'send_image_ocr')); });

bot.onText(/\/done/, async (msg) => {
  const chatId = msg.chat.id; const uid = msg.from.id;
  const state = userState[uid];
  if (!state || state.mode !== 'merge' || !state.images || !state.images.length) return bot.sendMessage(chatId, t(uid, 'no_images_merge'));
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-'));
  const outputPath = path.join(tmpDir, 'merged.pdf');
  try {
    await bot.sendMessage(chatId, t(uid, 'merging', state.images.length));
    await imagesToPdf(state.images, outputPath);
    await bot.sendDocument(chatId, outputPath, { caption: 'Merged ' + state.images.length + ' images - ' + formatBytes(fs.statSync(outputPath).size) });
    await addHistory(uid, 'images', 'pdf', 'merged.pdf');
  } catch (e) { bot.sendMessage(chatId, t(uid, 'failed', e.message)); }
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

  const runWithTmp = async (prefix, fn) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    try { await fn(tmpDir); } catch (e) { bot.sendMessage(chatId, 'Failed: ' + e.message); }
    finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
  };

  if (state && state.mode === 'ocr') {
    delete userState[uid];
    return runWithTmp('ocr-', async (d) => {
      const inp = path.join(d, 'i.' + ext);
      const sm = await bot.sendMessage(chatId, 'Extracting text...');
      await downloadFile(fileId, inp);
      const r = await require('tesseract.js').recognize(inp, 'eng');
      const text = r.data.text.trim();
      await bot.editMessageText('Done!', { chat_id: chatId, message_id: sm.message_id });
      if (!text) { await bot.sendMessage(chatId, 'No text found.'); return; }
      if (text.length > 4000) {
        const tp = path.join(d, 'extracted.txt'); fs.writeFileSync(tp, text);
        await bot.sendDocument(chatId, tp, { caption: 'Extracted text' });
      } else { await bot.sendMessage(chatId, 'Extracted Text:\n\n' + text); }
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
    return bot.sendMessage(chatId, t(uid, 'send_size'));
  }

  const premium = await isPremium(uid);
  if (!premium) {
    if (fileSize && fileSize > MAX_FREE_SIZE) {
      await bot.sendMessage(chatId, t(uid, 'file_too_large'));
      return sendUpgradeMessage(chatId, await getTimeUntilReset(uid), uid);
    }
    const daily = await getDailyCount(uid);
    if (daily >= FREE_LIMIT) return sendUpgradeMessage(chatId, await getTimeUntilReset(uid), uid);
  }

  if (!ext || !CONVERSIONS[ext]) return bot.sendMessage(chatId, t(uid, 'format_not_supported', (ext||'unknown').toUpperCase()));

  const formats = CONVERSIONS[ext];
  userState[uid] = { fileId, fileName, inputExt: ext, fileSize };
  const daily2 = premium ? 0 : await getDailyCount(uid);
  const remaining = premium ? t(uid, 'unlimited') : t(uid, 'conversions_left', FREE_LIMIT - daily2);
  const kb = { inline_keyboard: [] };
  let row = [];
  formats.forEach((f, i) => {
    row.push({ text: f.toUpperCase(), callback_data: 'convert:' + f });
    if (row.length === 3 || i === formats.length-1) { kb.inline_keyboard.push(row); row = []; }
  });
  kb.inline_keyboard.push([{ text: 'Cancel', callback_data: 'cancel' }]);
  bot.sendMessage(chatId, t(uid, 'convert_to', ext.toUpperCase(), fileName, formatBytes(fileSize||0), remaining), { reply_markup: kb });
}

bot.on('message', (msg) => { if (msg.document||msg.photo||msg.audio||msg.video||msg.voice) handleFile(msg); });

// ─── CALLBACK ─────────────────────────────────────────────────────────────────
bot.on('callback_query', async (query) => {
  const uid = query.from.id; const chatId = query.message.chat.id; const msgId = query.message.message_id;
  await bot.answerCallbackQuery(query.id);

  if (query.data === 'cancel') { delete userState[uid]; return bot.editMessageText(t(uid, 'cancelled'), { chat_id: chatId, message_id: msgId }); }

  if (query.data.startsWith('setlang:')) {
    const code = query.data.split(':')[1];
    if (LANGUAGES[code]) {
      await setUserLang(uid, code);
      const langName = LANGUAGES[code].flag + ' ' + LANGUAGES[code].name;
      await bot.editMessageText(t(uid, 'language_set', langName), { chat_id: chatId, message_id: msgId });
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
  if (!state) return bot.editMessageText(t(uid, 'session_expired'), { chat_id: chatId, message_id: msgId });
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
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return bot.sendMessage(msg.chat.id, 'Admin only.');
  const message = match[1].trim();
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
  bot.sendMessage(msg.chat.id, t(msg.from.id, 'send_promo_code'));
});

// BACKGROUND REMOVER
bot.onText(/\/removebg/, (msg) => {
  userState[msg.from.id] = { mode: 'removebg' };
  bot.sendMessage(msg.chat.id, t(msg.from.id, 'send_image_removebg'));
});

// VIDEO TO GIF
bot.onText(/\/gif/, (msg) => {
  userState[msg.from.id] = { mode: 'videogif' };
  bot.sendMessage(msg.chat.id, t(msg.from.id, 'send_video_gif'));
});

// IMAGE TO STICKER
bot.onText(/\/sticker/, (msg) => {
  userState[msg.from.id] = { mode: 'sticker' };
  bot.sendMessage(msg.chat.id, t(msg.from.id, 'send_image_sticker'));
});

// CREATE FILE
bot.onText(/\/create/, (msg) => {
  userState[msg.from.id] = { mode: 'create_waiting_text' };
  bot.sendMessage(msg.chat.id, 'What do you want to create?\n\n/createpdf - Create PDF from text\n/createtxt - Create TXT file\n/createcsv - Create CSV file');
});

bot.onText(/\/createpdf/, (msg) => {
  userState[msg.from.id] = { mode: 'create_pdf' };
  bot.sendMessage(msg.chat.id, t(msg.from.id, 'send_text_pdf'));
});

bot.onText(/\/createtxt/, (msg) => {
  userState[msg.from.id] = { mode: 'create_txt' };
  bot.sendMessage(msg.chat.id, t(msg.from.id, 'send_text_txt'));
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
    if (!m) return bot.sendMessage(msg.chat.id, t(uid, 'invalid_size'));
    userState[uid] = { mode: 'resize_ready', width: parseInt(m[1]), height: parseInt(m[2]) };
    return bot.sendMessage(msg.chat.id, t(uid, 'size_set', m[1], m[2]));
  }

  if (state.mode === 'qr') {
    delete userState[uid];
    const qrText = msg.text;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-'));
    const outputPath = path.join(tmpDir, 'qrcode.png');
    try {
      await bot.sendMessage(msg.chat.id, t(uid, 'qr_generating'));
      await generateQR(qrText, outputPath);
      await bot.sendPhoto(msg.chat.id, outputPath, { caption: 'QR code for: ' + qrText });
    } catch (e) { bot.sendMessage(msg.chat.id, t(uid, 'failed', e.message)); }
    finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
    return;
  }

  if (state.mode === 'redeem') {
    delete userState[uid];
    const code = msg.text.trim();
    const result = await redeemPromoCode(uid, code);
    if (result.success) {
      bot.sendMessage(msg.chat.id, t(uid, 'promo_success', result.days));
      await trackEvent('promo_redeemed', uid, { code });
    } else {
      bot.sendMessage(msg.chat.id, t(uid, 'promo_failed', result.msg));
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
