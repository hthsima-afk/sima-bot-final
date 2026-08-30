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

const conversations = new Map();

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

// 🎨 صورة - باستخدام Pollinations مع تحسين البرومبت
function generateImage(prompt) {
  const enhancedPrompt = `${prompt}, highly detailed, professional photography, 4k, sharp focus, beautiful lighting`;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&nologo=true`;
}

// 🎨 بديل: استخدام Hugging Face API مجاني
async function generateImageHF(prompt) {
  try {
    const response = await fetch('https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: prompt }),
    });
    
    if (response.ok) {
      const buffer = Buffer.from(await response.arrayBuffer());
      return buffer;
    }
    throw new Error('HF failed');
  } catch(e) {
    return null;
  }
}

bot.command('start', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return ctx.reply('⛔');
  await ctx.reply(
    '👋 مرحباً! أنا سيما\n\n' +
    '🎨 /img وصف - صورة\n' +
    '💾 /remember مفتاح قيمة - حفظ\n' +
    '🔍 /recall مفتاح - استرجاع\n' +
    '📚 /listmem - الذكريات\n\n' +
    '💬 أتذكر محادثاتنا!'
  );
});

bot.command('img', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return ctx.reply('⛔');
  
  const prompt = (ctx.message?.text || '').replace('/img', '').trim();
  if (!prompt) return ctx.reply('الاستخدام: /img وصف الصورة');
  
  await ctx.reply('🎨 جاري صنع الصورة...');
  
  try {
    // جرب Pollinations أولاً
    const imageUrl = generateImage(prompt);
    const response = await fetch(imageUrl);
    if (response.ok) {
      const buffer = Buffer.from(await response.arrayBuffer());
      await ctx.replyWithPhoto(buffer, { caption: `🎨 ${prompt}` });
      return;
    }
    
    // جرب Hugging Face
    const hfBuffer = await generateImageHF(prompt);
    if (hfBuffer) {
      await ctx.replyWithPhoto(hfBuffer, { caption: `🎨 ${prompt}` });
      return;
    }
    
    // إذا فشل كل شيء
    await ctx.replyWithPhoto(imageUrl, { caption: `🎨 ${prompt}` });
  } catch(e) {
    console.error('Image error:', e.message);
    await ctx.replyWithPhoto(generateImage(prompt));
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
  await ctx.reply(`✅ تم الحفظ: ${key} = ${value}`);
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
  if (!allowedUsers.includes(uid)) return ctx.reply('⛔');
  
  const text = ctx.message.text;
  
  // إذا طلب صورة
  if (text.includes('ارسم') || text.includes('صورة') || text.includes('صور')) {
    const prompt = text.replace(/ارسم|صورة|صور/g, '').trim() || 'cute cat';
    await ctx.reply('🎨 جاري الصنع...');
    try {
      const imageUrl = generateImage(prompt);
      await ctx.replyWithPhoto(imageUrl, { caption: `🎨 ${prompt}` });
    } catch(e) {
      await ctx.reply('❌ خطأ في الصورة');
    }
    return;
  }
  
  try {
    await ctx.replyWithChatAction('typing');
    
    const history = conversations.get(uid) || [];
    const savedMemories = memoryData[uid] || {};
    const memText = Object.entries(savedMemories).map(([k,v]) => `${k}: ${v}`).join('\n');
    
    const messages = [
      { role: 'system', content: `You are Sima. User memories:\n${memText || 'None'}` },
      ...history.slice(-6),
      { role: 'user', content: text },
    ];
    
    const response = await callLLM(messages);
    
    history.push({ role: 'user', content: text });
    history.push({ role: 'assistant', content: response });
    conversations.set(uid, history.slice(-10));
    
    await ctx.reply(response);
  } catch(e) {
    await ctx.reply('❌ خطأ');
  }
});

console.log('🤖 Sima starting...');
bot.start({ onStart: (info) => console.log(`✅ Bot @${info.username} started!`) });
