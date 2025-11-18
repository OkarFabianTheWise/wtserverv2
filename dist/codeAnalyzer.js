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
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeCode = analyzeCode;
// src/codeAnalyzer.ts
const openai_1 = require("openai");
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const openai = new openai_1.OpenAI({ apiKey: process.env.OPENAI_API_KEY });
function analyzeCode(code) {
    return __awaiter(this, void 0, void 0, function* () {
        const prompt = `Explain the following code as a tutorial for beginners. Include step-by-step reasoning and note the language:

\n\n\`\`\`
${code}
\`\`\``;
        const completion = yield openai.chat.completions.create({
            model: 'gpt-4',
            messages: [{ role: 'user', content: prompt }],
        });
        const response = completion.choices[0].message.content || '';
        return {
            tutorialText: response.trim(),
            language: 'typescript', // optionally detect via code parsing
        };
    });
}
