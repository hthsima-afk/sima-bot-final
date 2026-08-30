import fs from 'fs';
let content = fs.readFileSync('index.js', 'utf-8');

// استبدال أمر img مع تحسين البرومبت
const oldImg = content.match(/bot\.command\('img'[\s\S]*?\n\}\);/)[0];

const newImg = `bot.command('img', async (ctx) => {
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
    const url = \`https://image.pollinations.ai/prompt/\${encodeURIComponent(prompt)}?width=768&height=768&nologo=true\`;
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
}`;

content = content.replace(oldImg, newImg);
fs.writeFileSync('index.js', content);
console.log('✅ تم');
