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
    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
        const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n');
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch(e) {}
    }
    throw error;
  }
}

// 🎨 صنع الصور
async function generateImage(prompt) {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true`;
}

// 🎥 صنع الفيديو
async function generateVideo(prompt) {
  return `https://video.pollinations.ai/prompt/${encodeURIComponent(prompt)}?duration=3&nologo=true`;
}

bot.command('start', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return ctx.reply('⛔');
  await ctx.reply(
    '👋 Welcome to Sima!\n\n' +
    '🎨 /img وصف - صنع صورة\n' +
    '🎥 /vid وصف - صنع فيديو\n' +
    '💾 /remember مفتاح قيمة\n' +
    '🔍 /recall مفتاح\n' +
    '📚 /listmem\n\n' +
    'Just chat!'
  );
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    '🎨 /img وصف\n' +
    '🎥 /vid وصف\n' +
    '💾 /remember مفتاح قيمة\n' +
    '🔍 /recall مفتاح\n' +
    '📚 /listmem'
  );
});

// 🎨 صنع صورة
bot.command('img', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return;
  
  const prompt = (ctx.message?.text || '').replace('/img', '').trim();
  if (!prompt) return ctx.reply('الاستخدام: /img وصف الصورة');
  
  await ctx.reply('🎨 جاري صنع الصورة...');
  
  try {
    const imageUrl = await generateImage(prompt);
    console.log('Image URL:', imageUrl);
    
    // إرسال مباشر من الرابط
    await ctx.replyWithPhoto(imageUrl, { caption: `🎨 ${prompt}` });
  } catch(e) {
    console.error('Image error:', e.message);
    const url = await generateImage(prompt);
    await ctx.reply(`🎨 الصورة جاهزة:\n${url}`);
  }
});

// 🎥 صنع فيديو
bot.command('vid', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return;
  
  const prompt = (ctx.message?.text || '').replace('/vid', '').trim();
  if (!prompt) return ctx.reply('الاستخدام: /vid وصف الفيديو');
  
  await ctx.reply('🎥 جاري صنع الفيديو...');
  
  try {
    const videoUrl = await generateVideo(prompt);
    await ctx.reply(`🎥 الفيديو جاهز:\n${videoUrl}`);
  } catch(e) {
    await ctx.reply('❌ خطأ في صنع الفيديو');
  }
});

bot.command('remember', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return;
  const parts = (ctx.message?.text || '').split(' ');
  if (parts.length < 3) return ctx.reply('الاستخدام: /remember مفتاح قيمة');
  const key = parts[1], value = parts.slice(2).join(' ');
  if (!memoryData[uid]) memoryData[uid] = {};
  memoryData[uid][key] = value;
  saveMemory();
  await ctx.reply(`✅ تم الحفظ: ${key}`);
});

bot.command('recall', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return;
  const key = (ctx.message?.text || '').split(' ')[1];
  if (!key) return ctx.reply('الاستخدام: /recall مفتاح');
  const value = memoryData[uid]?.[key];
  await ctx.reply(value ? `🔍 ${key}: ${value}` : '❌ غير موجود');
});

bot.command('listmem', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  const mem = memoryData[uid] || {};
  const keys = Object.keys(mem);
  if (keys.length === 0) return ctx.reply('📭 لا توجد ذكريات');
  let resp = '📚 الذكريات:\n\n';
  for (const k of keys) resp += `• ${k}: ${mem[k]}\n`;
  await ctx.reply(resp);
});

bot.on('message:text', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return ctx.reply('⛔ غير مصرح');
  try {
    await ctx.replyWithChatAction('typing');
    const messages = [
      { role: 'system', content: 'You are Sima, a helpful AI assistant.' },
      { role: 'user', content: ctx.message.text },
    ];
    const response = await callLLM(messages);
    await ctx.reply(response);
  } catch(e) {
    await ctx.reply('❌ خطأ');
  }
});

console.log('🤖 Sima starting...');
bot.start({ onStart: (info) => console.log(`✅ Bot @${info.username} started!`) });
