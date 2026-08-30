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
    return completion.choices[0]?.message?.content || 'No response';
  } catch (error) {
    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
        const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n');
        return (await model.generateContent(prompt)).response.text();
      } catch(e) {}
    }
    throw error;
  }
}

// 🎨 توليد صورة باستخدام Nano Banana
async function generateImageNanoBanana(prompt) {
  if (!genAI) throw new Error('No Gemini API');
  
  // Nano Banana = gemini-2.5-flash-preview-image
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash-preview-image' 
  });
  
  const result = await model.generateContent({
    contents: [{ 
      role: 'user', 
      parts: [{ text: prompt }] 
    }],
  });
  
  const response = result.response;
  
  // استخراج الصورة
  if (response.candidates && response.candidates[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData && part.inlineData.data) {
        return Buffer.from(part.inlineData.data, 'base64');
      }
    }
  }
  
  throw new Error('No image in response');
}

// 🎵 نسخ الصوت
async function transcribeAudio(fileUrl) {
  try {
    const response = await fetch(fileUrl);
    const blob = await response.blob();
    const file = new File([blob], 'audio.ogg', { type: 'audio/ogg' });
    
    const transcription = await groq.audio.transcriptions.create({
      file: file,
      model: 'whisper-large-v3-turbo',
    });
    
    return transcription.text;
  } catch (error) {
    console.error('Transcription error:', error);
    throw error;
  }
}

bot.command('start', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return ctx.reply('⛔');
  await ctx.reply(
    '👋 مرحباً!\n\n' +
    '🎨 /img وصف - صورة\n' +
    '💾 /remember مفتاح قيمة\n' +
    '🔍 /recall مفتاح\n' +
    '📚 /listmem\n' +
    '🎵 أرسل صوتاً\n\n' +
    '💬 أتذكر محادثاتنا!'
  );
});

bot.command('img', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return;
  
  const prompt = (ctx.message?.text || '').replace('/img', '').trim();
  if (!prompt) return ctx.reply('الاستخدام: /img وصف الصورة');
  
  await ctx.reply('🎨 جاري صنع الصورة...');
  
  try {
    // تحسين البرومبت بالعربية أولاً
    const translatedPrompt = await translateToEnglish(prompt);
    console.log('Translated:', translatedPrompt);
    
    const imageBuffer = await generateImageNanoBanana(translatedPrompt);
    await ctx.replyWithPhoto(imageBuffer, { caption: prompt });
  } catch(e) {
    console.error('Image error:', e.message);
    // إذا فشل Nano Banana بسبب الحصة، جرب Pollinations
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&nologo=true`;
    try {
      const response = await fetch(url);
      const buffer = Buffer.from(await response.arrayBuffer());
      await ctx.replyWithPhoto(buffer, { caption: prompt });
    } catch(e2) {
      await ctx.reply('❌ خدمة الصور غير متاحة. حاول لاحقاً.');
    }
  }
});

// دالة الترجمة
async function translateToEnglish(text) {
  try {
    const response = await callLLM([
      { role: 'system', content: 'Translate to English. Return ONLY the translation.' },
      { role: 'user', content: text },
    ]);
    return response.trim();
  } catch(e) {
    return text;
  }
}

bot.command('remember', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  const parts = (ctx.message?.text || '').split(' ');
  if (parts.length < 3) return ctx.reply('الاستخدام: /remember مفتاح قيمة');
  const key = parts[1], value = parts.slice(2).join(' ');
  if (!memoryData[uid]) memoryData[uid] = {};
  memoryData[uid][key] = value;
  saveMemory();
  await ctx.reply('✅ تم الحفظ');
});

bot.command('recall', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
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
  let resp = '📚:\n\n';
  for (const k of keys) resp += `• ${k}: ${mem[k]}\n`;
  await ctx.reply(resp);
});

bot.on('message:voice', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return;
  
  try {
    await ctx.reply('🎵 جاري الفهم...');
    const file = await ctx.getFile();
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    const text = await transcribeAudio(fileUrl);
    await ctx.reply(`🎵 فهمت: ${text}`);
    
    const messages = [{ role: 'user', content: text }];
    const response = await callLLM(messages);
    await ctx.reply(response);
  } catch(e) {
    console.error('Voice error:', e);
    await ctx.reply('❌ خطأ في فهم الصوت');
  }
});

bot.on('message:text', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return;
  
  const text = ctx.message.text;
  
  if (text.includes('ارسم') || text.includes('صورة')) {
    const prompt = text.replace(/ارسم|صورة/g, '').trim() || 'cat';
    await ctx.reply('🎨 جاري الصنع...');
    try {
      const imageBuffer = await generateImageNanoBanana(prompt);
      await ctx.replyWithPhoto(imageBuffer);
    } catch(e) {
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true`;
      await ctx.replyWithPhoto(url);
    }
    return;
  }
  
  try {
    await ctx.replyWithChatAction('typing');
    const history = conversations.get(uid) || [];
    const messages = [
      { role: 'system', content: 'You are Sima.' },
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
