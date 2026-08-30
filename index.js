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

// ============ الذاكرة ============
const MEMORY_FILE = 'memory.json';
let memoryData = {};
try { if (fs.existsSync(MEMORY_FILE)) memoryData = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8')); } catch(e) {}
function saveMemory() { fs.writeFileSync(MEMORY_FILE, JSON.stringify(memoryData, null, 2)); }

// محادثة لكل مستخدم
const conversations = new Map();

// ============ LLM ============
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

// ============ الصور عالية الجودة ============
function generateImage(prompt) {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random()*1000)}`;
}

// ============ الفيديو (GIF متحرك) ============
function generateVideo(prompt) {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt + ', animated, motion, cinematic')}?width=768&height=768&nologo=true&gif=true&seed=${Math.floor(Math.random()*1000)}`;
}

// ============ الأوامر ============
bot.command('start', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return ctx.reply('⛔');
  await ctx.reply(
    '👋 مرحباً! أنا سيما\n\n' +
    '🎨 /img وصف - صورة عالية الجودة\n' +
    '🎥 /vid وصف - فيديو متحرك\n' +
    '💾 /remember مفتاح قيمة - حفظ\n' +
    '🔍 /recall مفتاح - استرجاع\n' +
    '📚 /listmem - الذكريات\n\n' +
    '💬 أنا أتذكر محادثاتنا!'
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

// 🎨 صورة عالية الجودة
bot.command('img', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return ctx.reply('⛔');
  
  const prompt = (ctx.message?.text || '').replace('/img', '').trim();
  if (!prompt) return ctx.reply('الاستخدام: /img وصف الصورة');
  
  await ctx.reply('🎨 جاري صنع صورة عالية الجودة...');
  
  try {
    const imageUrl = generateImage(prompt);
    console.log('Image URL:', imageUrl);
    
    // تحميل الصورة وإرسالها مباشرة
    const response = await fetch(imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    await ctx.replyWithPhoto(buffer, { caption: `🎨 ${prompt}` });
  } catch(e) {
    console.error('Image error:', e.message);
    // محاولة الإرسال بالرابط
    await ctx.replyWithPhoto(generateImage(prompt), { caption: `🎨 ${prompt}` });
  }
});

// 🎥 فيديو متحرك
bot.command('vid', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return ctx.reply('⛔');
  
  const prompt = (ctx.message?.text || '').replace('/vid', '').trim();
  if (!prompt) return ctx.reply('الاستخدام: /vid وصف المشهد');
  
  await ctx.reply('🎥 جاري صنع الفيديو...');
  
  try {
    const gifUrl = generateVideo(prompt);
    console.log('GIF URL:', gifUrl);
    
    // تحميل وإرسال مباشرة
    const response = await fetch(gifUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    await ctx.replyWithAnimation(buffer, { caption: `🎥 ${prompt}` });
  } catch(e) {
    console.error('Video error:', e.message);
    await ctx.replyWithAnimation(generateVideo(prompt), { caption: `🎥 ${prompt}` });
  }
});

// 💾 حفظ
bot.command('remember', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return;
  const parts = (ctx.message?.text || '').split(' ');
  if (parts.length < 3) return ctx.reply('الاستخدام: /remember مفتاح قيمة');
  const key = parts[1], value = parts.slice(2).join(' ');
  if (!memoryData[uid]) memoryData[uid] = {};
  memoryData[uid][key] = value;
  saveMemory();
  await ctx.reply(`✅ تم الحفظ: ${key} = ${value}`);
});

// 🔍 استرجاع
bot.command('recall', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return;
  const key = (ctx.message?.text || '').split(' ')[1];
  if (!key) return ctx.reply('الاستخدام: /recall مفتاح');
  const value = memoryData[uid]?.[key];
  await ctx.reply(value ? `🔍 ${key}: ${value}` : '❌ غير موجود');
});

// 📚 عرض الذكريات
bot.command('listmem', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  const mem = memoryData[uid] || {};
  const keys = Object.keys(mem);
  if (keys.length === 0) return ctx.reply('📭 لا توجد ذكريات');
  let resp = '📚 الذكريات:\n\n';
  for (const k of keys) resp += `• ${k}: ${mem[k]}\n`;
  await ctx.reply(resp);
});

// 💬 الدردشة مع ذاكرة المحادثة
bot.on('message:text', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return ctx.reply('⛔ غير مصرح');
  
  const text = ctx.message.text;
  
  // إذا طلب صورة
  if (text.includes('ارسم') || text.includes('صورة') || text.includes('صور')) {
    const prompt = text.replace(/ارسم|صورة|صور/g, '').trim();
    await ctx.reply('🎨 جاري الصنع...');
    try {
      const imageUrl = generateImage(prompt || 'cute cat');
      const response = await fetch(imageUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      await ctx.replyWithPhoto(buffer, { caption: `🎨 ${prompt}` });
    } catch(e) {
      await ctx.replyWithPhoto(generateImage(prompt), { caption: `🎨 ${prompt}` });
    }
    return;
  }
  
  // إذا طلب فيديو
  if (text.includes('فيديو') || text.includes('مقطع')) {
    const prompt = text.replace(/فيديو|مقطع/g, '').trim();
    await ctx.reply('🎥 جاري الصنع...');
    try {
      const gifUrl = generateVideo(prompt || 'nature');
      const response = await fetch(gifUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      await ctx.replyWithAnimation(buffer, { caption: `🎥 ${prompt}` });
    } catch(e) {
      await ctx.replyWithAnimation(generateVideo(prompt), { caption: `🎥 ${prompt}` });
    }
    return;
  }
  
  try {
    await ctx.replyWithChatAction('typing');
    
    // استرجاع محادثات سابقة
    const history = conversations.get(uid) || [];
    
    // استرجاع ذكريات محفوظة
    const savedMemories = memoryData[uid] || {};
    const memText = Object.entries(savedMemories).map(([k,v]) => `${k}: ${v}`).join('\n');
    
    const messages = [
      { role: 'system', content: `You are Sima, a helpful AI assistant. User memories:\n${memText || 'None'}` },
      ...history.slice(-6),
      { role: 'user', content: text },
    ];
    
    const response = await callLLM(messages);
    
    // حفظ في ذاكرة المحادثة
    history.push({ role: 'user', content: text });
    history.push({ role: 'assistant', content: response });
    conversations.set(uid, history.slice(-10));
    
    await ctx.reply(response);
  } catch(e) {
    console.error('Chat error:', e);
    await ctx.reply('❌ خطأ');
  }
});

console.log('🤖 Sima starting...');
bot.start({ onStart: (info) => console.log(`✅ Bot @${info.username} started!`) });
