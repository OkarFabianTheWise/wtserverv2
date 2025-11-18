"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSpeech = generateSpeech;
// src/textToSpeech.ts
const fs_1 = __importDefault(require("fs"));
const dotenv_1 = require("dotenv");
const openai_1 = require("openai");
(0, dotenv_1.config)();
const openai = new openai_1.OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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
function generateSpeech(text, outputPath) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('🧠 Generating speech with OpenAI...');
        const speech = yield openai.audio.speech.create({
            model: 'tts-1-hd',
            voice: 'nova',
            input: text,
        });
        const arrayBuffer = yield speech.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        fs_1.default.writeFileSync(outputPath, buffer);
        console.log(`✅ Voiceover saved to: ${outputPath} (${buffer.length} bytes)`);
        if (buffer.length < 1000) {
            console.warn('⚠️ Warning: Audio file is unusually small. Check if TTS failed silently.');
        }
    });
}
