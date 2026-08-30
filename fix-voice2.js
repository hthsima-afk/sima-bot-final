import fs from 'fs';

let content = fs.readFileSync('index.js', 'utf-8');

// استبدال معالج الصوت
const oldHandler = `bot.on('message:voice', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return ctx.reply('⛔ غير مصرح');
  
  try {
    await ctx.reply('🎵 جاري فهم الصوت...');
    
    // الحصول على ملف الصوت
    const file = await ctx.getFile();
    const fileUrl = \`https://api.telegram.org/file/bot\${process.env.TELEGRAM_BOT_TOKEN}/\${file.file_path}\`;
    
    console.log('Audio URL:', fileUrl);
    
    // نسخ الصوت
    const text = await transcribeAudio(fileUrl);
    
    await ctx.reply(\`🎵 النص:\\n\\n\${text}\`);
    
  } catch(error) {
    console.error('Voice error:', error);
    await ctx.reply('❌ خطأ في فهم الصوت. حاول مرة أخرى.');
  }
});`;

const newHandler = `bot.on('message:voice', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return ctx.reply('⛔ غير مصرح');
  
  try {
    await ctx.reply('🎵 جاري فهم الصوت...');
    
    const file = await ctx.getFile();
    const fileUrl = \`https://api.telegram.org/file/bot\${process.env.TELEGRAM_BOT_TOKEN}/\${file.file_path}\`;
    
    const text = await transcribeAudio(fileUrl);
    
    await ctx.reply(\`🎵 فهمت: \${text}\\n\\n⚡ جاري التنفيذ...\`);
    
    // تنفيذ النص كأمر
    const trimmed = text.trim();
    
    // إذا كان النص يطلب صورة
    if (trimmed.includes('صورة') || trimmed.includes('ارسم') || trimmed.includes('صور')) {
      const prompt = trimmed.replace(/صورة|ارسم|صور/g, '').trim();
      const imageUrl = await generateImage(prompt || 'cute cat');
      await ctx.replyWithPhoto(imageUrl, { caption: \`🎨 \${prompt}\` });
      return;
    }
    
    // إذا كان النص يطلب فيديو
    if (trimmed.includes('فيديو') || trimmed.includes('مقطع')) {
      const prompt = trimmed.replace(/فيديو|مقطع/g, '').trim();
      const videoUrl = await generateVideo(prompt || 'nature');
      await ctx.reply(\`🎥 الفيديو:\\n\${videoUrl}\`);
      return;
    }
    
    // وإلا تعامل معه كسؤال عادي
    const messages = [
      { role: 'system', content: 'You are Sima, a helpful AI assistant.' },
      { role: 'user', content: text },
    ];
    const response = await callLLM(messages);
    await ctx.reply(response);
    
  } catch(error) {
    console.error('Voice error:', error);
    await ctx.reply('❌ خطأ في فهم الصوت');
  }
});`;

content = content.replace(oldHandler, newHandler);

// استبدال معالج audio أيضاً
const oldAudio = `bot.on('message:audio', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return;
  
  try {
    await ctx.reply('🎵 جاري فهم الملف الصوتي...');
    
    const file = await ctx.getFile();
    const fileUrl = \`https://api.telegram.org/file/bot\${process.env.TELEGRAM_BOT_TOKEN}/\${file.file_path}\`;
    
    const text = await transcribeAudio(fileUrl);
    
    await ctx.reply(\`🎵 النص:\\n\\n\${text}\`);
    
  } catch(error) {
    console.error('Audio error:', error);
    await ctx.reply('❌ خطأ في فهم الملف الصوتي');
  }
});`;

const newAudio = `bot.on('message:audio', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return;
  
  try {
    await ctx.reply('🎵 جاري فهم الملف الصوتي...');
    
    const file = await ctx.getFile();
    const fileUrl = \`https://api.telegram.org/file/bot\${process.env.TELEGRAM_BOT_TOKEN}/\${file.file_path}\`;
    
    const text = await transcribeAudio(fileUrl);
    
    await ctx.reply(\`🎵 فهمت: \${text}\\n\\n⚡ جاري التنفيذ...\`);
    
    const trimmed = text.trim();
    
    if (trimmed.includes('صورة') || trimmed.includes('ارسم') || trimmed.includes('صور')) {
      const prompt = trimmed.replace(/صورة|ارسم|صور/g, '').trim();
      const imageUrl = await generateImage(prompt || 'cute cat');
      await ctx.replyWithPhoto(imageUrl, { caption: \`🎨 \${prompt}\` });
      return;
    }
    
    if (trimmed.includes('فيديو') || trimmed.includes('مقطع')) {
      const prompt = trimmed.replace(/فيديو|مقطع/g, '').trim();
      const videoUrl = await generateVideo(prompt || 'nature');
      await ctx.reply(\`🎥 الفيديو:\\n\${videoUrl}\`);
      return;
    }
    
    const messages = [
      { role: 'system', content: 'You are Sima, a helpful AI assistant.' },
      { role: 'user', content: text },
    ];
    const response = await callLLM(messages);
    await ctx.reply(response);
    
  } catch(error) {
    console.error('Audio error:', error);
    await ctx.reply('❌ خطأ في فهم الملف الصوتي');
  }
});`;

content = content.replace(oldAudio, newAudio);

fs.writeFileSync('index.js', content);
console.log('✅ تم التحديث');
