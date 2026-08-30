import fs from 'fs';
let content = fs.readFileSync('index.js', 'utf-8');

// استبدال دالة generateImageNanoBanana بالكامل
const oldFunc = content.match(/async function generateImageNanoBanana[\s\S]*?\n}/)[0];

const newFunc = `async function generateImageNanoBanana(prompt) {
  // استخدام Pollinations مباشرة - يعمل بدون حصة
  return \`https://image.pollinations.ai/prompt/\${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=\${Date.now()}\`;
}`;

content = content.replace(oldFunc, newFunc);
fs.writeFileSync('index.js', content);
console.log('✅ تم');
