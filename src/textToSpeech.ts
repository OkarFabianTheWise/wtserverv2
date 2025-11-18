// src/textToSpeech.ts
import fs from 'fs';
import { config } from 'dotenv';
import { OpenAI } from 'openai';

config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// export async function generateSpeech(text: string, outputPath: string): Promise<void> {
//   const speech = await openai.audio.speech.create({
//     model: 'tts-1-hd',
//     voice: 'nova',
//     input: text,
//   });

//   const buffer = Buffer.from(await speech.arrayBuffer());
//   fs.writeFileSync(outputPath, buffer);
//   console.log(`✅ Voiceover saved to: ${outputPath}`);
// }

export async function generateSpeech(text: string, outputPath: string): Promise<void> {
  console.log('🧠 Generating speech with OpenAI...');
  const speech = await openai.audio.speech.create({
    model: 'tts-1-hd',
    voice: 'nova',
    input: text,
  });

  const arrayBuffer = await speech.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ Voiceover saved to: ${outputPath} (${buffer.length} bytes)`);

  if (buffer.length < 1000) {
    console.warn('⚠️ Warning: Audio file is unusually small. Check if TTS failed silently.');
  }
}
