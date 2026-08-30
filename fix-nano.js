import fs from 'fs';
let content = fs.readFileSync('index.js', 'utf-8');

// استبدال دالة الصور بالكامل
const oldFunc = content.match(/async function generateImageNanoBanana[\s\S]*?\n\}/)[0];

const newFunc = `async function generateImageNanoBanana(prompt) {
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
}`;

content = content.replace(oldFunc, newFunc);
fs.writeFileSync('index.js', content);
console.log('✅ تم');
