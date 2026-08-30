import fs from 'fs';

// اقرأ الملف
let content = fs.readFileSync('index.js', 'utf-8');

// استبدال دالة transcribeAudio
const oldFunc = `async function transcribeAudio(fileUrl) {
  try {
    const response = await fetch(fileUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // استخدام Groq Whisper
    const transcription = await groq.audio.transcriptions.create({
      file: {
        name: 'audio.ogg',
        data: buffer,
      },
      model: 'whisper-large-v3-turbo',
      language: 'ar',
      response_format: 'json',
    });
    
    return transcription.text;
  } catch (error) {
    console.error('Transcription error:', error);
    throw error;
  }
}`;

const newFunc = `async function transcribeAudio(fileUrl) {
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
    // جرب بدون language
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const file = new File([blob], 'audio.ogg', { type: 'audio/ogg' });
      const transcription = await groq.audio.transcriptions.create({
        file: file,
        model: 'whisper-large-v3',
      });
      return transcription.text;
    } catch(e2) {
      throw e2;
    }
  }
}`;

content = content.replace(oldFunc, newFunc);
fs.writeFileSync('index.js', content);
console.log('✅ تم التحديث');
