import fs from 'fs';

let content = fs.readFileSync('index.js', 'utf-8');

// استبدال دالة generateVideo
const oldGen = `async function generateVideo(prompt) {
  return \`https://video.pollinations.ai/prompt/\${encodeURIComponent(prompt)}?duration=3&nologo=true\`;
}`;

const newGen = `async function generateVideo(prompt) {
  // استخدام خدمة بديلة
  return \`https://image.pollinations.ai/video/\${encodeURIComponent(prompt)}?duration=3&width=512&height=512&nologo=true\`;
}`;

content = content.replace(oldGen, newGen);

// استبدال أمر الفيديو بالكامل
const oldVid = content.match(/bot\.command\('vid'.*?\n\}\);/s)[0];

const newVid = `bot.command('vid', async (ctx) => {
  const uid = ctx.from?.id.toString() || '';
  if (!allowedUsers.includes(uid)) return;
  
  const prompt = (ctx.message?.text || '').replace('/vid', '').trim();
  if (!prompt) return ctx.reply('الاستخدام: /vid وصف الفيديو');
  
  await ctx.reply('🎥 جاري صنع الفيديو...');
  
  try {
    const videoUrl = await generateVideo(prompt);
    console.log('Video URL:', videoUrl);
    
    // تحميل الفيديو وإرساله
    const response = await fetch(videoUrl);
    if (response.ok) {
      const buffer = Buffer.from(await response.arrayBuffer());
      await ctx.replyWithVideo(buffer, { caption: \`🎥 \${prompt}\` });
    } else {
      // إذا لم يعمل الفيديو، أرسل صورة متحركة
      const gifUrl = \`https://image.pollinations.ai/prompt/\${encodeURIComponent(prompt)}?width=512&height=512&nologo=true\`;
      await ctx.replyWithPhoto(gifUrl, { caption: \`🎥 (صورة بدل فيديو) \${prompt}\` });
    }
  } catch(e) {
    console.error('Video error:', e.message);
    await ctx.reply('❌ خدمة الفيديو غير متاحة حالياً. جرب /img بدلاً منها.');
  }
});`;

content = content.replace(oldVid, newVid);

fs.writeFileSync('index.js', content);
console.log('✅ تم التحديث');
