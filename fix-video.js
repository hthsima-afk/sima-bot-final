import fs from 'fs';

let content = fs.readFileSync('index.js', 'utf-8');

// استبدال أمر الفيديو
const oldVid = `bot.command('vid', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return;
  
  const prompt = (ctx.message?.text || '').replace('/vid', '').trim();
  if (!prompt) return ctx.reply('الاستخدام: /vid وصف الفيديو');
  
  await ctx.reply('🎥 جاري صنع الفيديو...');
  
  try {
    const videoUrl = await generateVideo(prompt);
    await ctx.reply(\`🎥 الفيديو:\\n\${videoUrl}\`);
  } catch(e) {
    await ctx.reply('❌ خطأ في صنع الفيديو');
  }
});`;

const newVid = `bot.command('vid', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return;
  
  const prompt = (ctx.message?.text || '').replace('/vid', '').trim();
  if (!prompt) return ctx.reply('الاستخدام: /vid وصف الفيديو');
  
  await ctx.reply('🎥 جاري صنع الفيديو...');
  
  try {
    const videoUrl = await generateVideo(prompt);
    console.log('Video URL:', videoUrl);
    
    // محاولة إرسال الفيديو مباشرة
    try {
      await ctx.replyWithVideo(videoUrl, { caption: \`🎥 \${prompt}\` });
    } catch(videoError) {
      // إذا فشل، أرسل الرابط
      await ctx.reply(\`🎥 الفيديو (اضغط للتحميل):\\n\${videoUrl}\`);
    }
  } catch(e) {
    console.error('Video error:', e);
    await ctx.reply('❌ خطأ في صنع الفيديو');
  }
});`;

content = content.replace(oldVid, newVid);

// استبدال في معالج الصوت أيضاً
const oldVoiceVid = `if (trimmed.includes('فيديو') || trimmed.includes('مقطع')) {
      const prompt = trimmed.replace(/فيديو|مقطع/g, '').trim();
      const videoUrl = await generateVideo(prompt || 'nature');
      await ctx.reply(\`🎥 الفيديو:\\n\${videoUrl}\`);
      return;
    }`;

const newVoiceVid = `if (trimmed.includes('فيديو') || trimmed.includes('مقطع')) {
      const prompt = trimmed.replace(/فيديو|مقطع/g, '').trim();
      const videoUrl = await generateVideo(prompt || 'nature');
      try {
        await ctx.replyWithVideo(videoUrl, { caption: \`🎥 \${prompt}\` });
      } catch(e) {
        await ctx.reply(\`🎥 الفيديو:\\n\${videoUrl}\`);
      }
      return;
    }`;

content = content.replace(oldVoiceVid, newVoiceVid);

fs.writeFileSync('index.js', content);
console.log('✅ تم التحديث');
