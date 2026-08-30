import fs from 'fs';
let content = fs.readFileSync('index.js', 'utf-8');

// استبدال دالة الصور
const oldFunc = content.match(/async function generateImageNanoBanana[\s\S]*?\n\}/)[0];

const newFunc = `async function generateImageNanoBanana(prompt) {
  // استخدام Craiyon API - مجاني بدون مفتاح
  const response = await fetch('https://api.craiyon.com/v3', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: prompt, model: 'photo' }),
  });
  
  if (!response.ok) throw new Error('Craiyon failed');
  
  const data = await response.json();
  if (data.images && data.images.length > 0) {
    const imageBase64 = data.images[0].replace('data:image/jpeg;base64,', '');
    return Buffer.from(imageBase64, 'base64');
  }
  
  throw new Error('No image');
}`;

content = content.replace(oldFunc, newFunc);
fs.writeFileSync('index.js', content);
console.log('✅ تم');
