import { Bot } from 'grammy';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || '');

const allowedUsers = (process.env.ALLOWED_USER_IDS || '').split(',').map(id => id.trim());

// ذاكرة دائمة
const MEMORY_FILE = 'memory.json';
let memoryData = {};
try { if (fs.existsSync(MEMORY_FILE)) memoryData = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8')); } catch(e) {}
function saveMemory() { fs.writeFileSync(MEMORY_FILE, JSON.stringify(memoryData, null, 2)); }

async function callLLM(messages) {
  try {
    const completion = await groq.chat.completions.create({
      messages, model: 'groq/compound-mini', temperature: 0.7, max_tokens: 2000,
    });
    const response = completion.choices[0]?.message?.content;
    if (response) return response;
    throw new Error('Empty');
  } catch (error) {
    console.error('Groq error:', error.message);
    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
        const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n');
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch(e) { console.error('Gemini error:', e.message); }
    }
    throw error;
  }
}

// 🎨 صنع الصور
async function generateImage(prompt) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true`;
  return url;
}

// 🎥 صنع الفيديو
async function generateVideo(prompt) {
  const url = `https://video.pollinations.ai/prompt/${encodeURIComponent(prompt)}?duration=5&nologo=true`;
  return url;
}

// 🎵 فهم الصوت
async function transcribeAudio(fileUrl) {
  try {
    const response = await fetch(fileUrl);
    const buffer = await response.arrayBuffer();
    
    const transcription = await groq.audio.transcriptions.create({
      file: new File([buffer], 'audio.ogg', { type: 'audio/ogg' }),
      model: 'whisper-large-v3-turbo',
      language: 'ar',
    });
    
    return transcription.text;
  } catch (error) {
    console.error('Transcription error:', error);
    throw error;
  }
}

// الأوامر الأساسية
bot.command('start', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return ctx.reply('⛔');
  await ctx.reply(
    '👋 Welcome to Sima!\n\n' +
    '🎨 /img وصف الصورة - صنع صورة\n' +
    '🎥 /vid وصف الفيديو - صنع فيديو\n' +
    '💾 /remember مفتاح قيمة - حفظ\n' +
    '🔍 /recall مفتاح - استرجاع\n' +
    '📚 /listmem - عرض الذكريات\n\n' +
    '🎵 أرسل مقطع صوتي لفهمه!\n\n' +
    'Just chat!'
  );
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    '🤖 أوامر Sima:\n\n' +
    '🎨 /img وصف - صنع صورة\n' +
    '🎥 /vid وصف - صنع فيديو\n' +
    '💾 /remember مفتاح قيمة\n' +
    '🔍 /recall مفتاح\n' +
    '📚 /listmem\n\n' +
    '🎵 أرسل صوت للنسخ!\n' +
    '💬 أرسل رسالة للدردشة!'
  );
});

// 🎨 صنع الصور
bot.command('img', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return;
  
  const prompt = (ctx.message?.text || '').replace('/img', '').trim();
  if (!prompt) return ctx.reply('Usage: /img وصف الصورة');
  
  await ctx.reply('🎨 جاري صنع الصورة...');
  
  try {
    const imageUrl = await generateImage(prompt);
    await ctx.replyWithPhoto(imageUrl, { caption: `🎨 ${prompt}` });
  } catch(e) {
    await ctx.reply('❌ خطأ في صنع الصورة');
  }
});

// 🎥 صنع الفيديو
bot.command('vid', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return;
  
  const prompt = (ctx.message?.text || '').replace('/vid', '').trim();
  if (!prompt) return ctx.reply('Usage: /vid وصف الفيديو');
  
  await ctx.reply('🎥 جاري صنع الفيديو (قد يستغرق دقيقة)...');
  
  try {
    const videoUrl = await generateVideo(prompt);
    await ctx.replyWithVideo(videoUrl, { caption: `🎥 ${prompt}` });
  } catch(e) {
    await ctx.reply('❌ خطأ في صنع الفيديو');
  }
});

// 💾 الذاكرة
bot.command('remember', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return;
  const parts = (ctx.message?.text || '').split(' ');
  if (parts.length < 3) return ctx.reply('Usage: /remember key value');
  const key = parts[1], value = parts.slice(2).join(' ');
  if (!memoryData[uid]) memoryData[uid] = {};
  memoryData[uid][key] = value;
  saveMemory();
  await ctx.reply(`✅ Remembered: ${key}`);
});

bot.command('recall', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return;
  const key = (ctx.message?.text || '').split(' ')[1];
  if (!key) return ctx.reply('Usage: /recall key');
  const value = memoryData[uid]?.[key];
  await ctx.reply(value ? `🔍 ${key}: ${value}` : `❌ Not found`);
});

bot.command('listmem', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  const mem = memoryData[uid] || {};
  const keys = Object.keys(mem);
  if (keys.length === 0) return ctx.reply('📭 No memories');
  let resp = '📚 Memories:\n\n';
  for (const k of keys) resp += `• ${k}: ${mem[k]}\n`;
  await ctx.reply(resp);
});

// 🎵 فهم الصوت
bot.on('message:voice', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return;
  
  try {
    await ctx.reply('🎵 جاري فهم الصوت...');
    
    const file = await ctx.getFile();
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    
    const text = await transcribeAudio(fileUrl);
    await ctx.reply(`🎵 النص:\n\n${text}`);
    
  } catch(e) {
    console.error('Voice error:', e);
    await ctx.reply('❌ خطأ في فهم الصوت');
  }
});

// 💬 الدردشة
bot.on('message:text', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return ctx.reply('⛔ Unauthorized');
  try {
    await ctx.replyWithChatAction('typing');
    const messages = [
      { role: 'system', content: 'You are Sima, a helpful AI assistant.' },
      { role: 'user', content: ctx.message.text },
    ];
    const response = await callLLM(messages);
    await ctx.reply(response);
  } catch(e) {
    await ctx.reply('❌ Error');
  }
});

console.log('🤖 Sima starting...');
bot.start({ onStart: (info) => console.log(`✅ Bot @${info.username} started!`) });
