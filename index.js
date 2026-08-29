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

bot.command('start', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return ctx.reply('⛔');
  await ctx.reply('👋 Welcome to Sima!\n\n/help - Help\n/remember key value - Save\n/recall key - Get\n/listmem - List all\n\nJust chat!');
});

bot.command('help', async (ctx) => {
  await ctx.reply('🤖 Commands:\n/start - Welcome\n/help - Help\n/remember key value\n/recall key\n/listmem');
});

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
  await ctx.reply(value ? `🔍 ${key}: ${value}` : `❌ Not found: ${key}`);
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
