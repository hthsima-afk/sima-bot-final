import fs from 'fs';
let content = fs.readFileSync('index.js', 'utf-8');

const oldFunc = content.match(/async function generateImageNanoBanana[\s\S]*?\n\}/)[0];

const newFunc = `async function generateImageNanoBanana(prompt) {
  // Hugging Face FLUX - مجاني
  const response = await fetch('https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs: prompt }),
  });
  
  if (!response.ok) throw new Error('HF: ' + response.status);
  
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer;
}`;

content = content.replace(oldFunc, newFunc);
fs.writeFileSync('index.js', content);
console.log('✅ تم');
