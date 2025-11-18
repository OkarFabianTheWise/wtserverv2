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
// src/cli.ts
// #!/usr/bin/env node
const commander_1 = require("commander");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const codeAnalyzer_1 = require("./codeAnalyzer");
const textToSpeech_1 = require("./textToSpeech");
const videoGenerator_1 = require("./videoGenerator");
const program = new commander_1.Command();
program
    .name('aigen')
    .description('AI agent SDK to turn code into a tutorial')
    .version('0.1.0');
program
    .command('analyze')
    .description('Analyze a script and generate a tutorial')
    .requiredOption('-f, --file <path>', 'Path to the script file')
    .option('-v, --voice', 'Also generate voiceover')
    .option('--video', 'Also generate tutorial video')
    .action((options) => __awaiter(void 0, void 0, void 0, function* () {
    const filePath = path_1.default.resolve(process.cwd(), options.file);
    if (!fs_1.default.existsSync(filePath)) {
        console.error('File not found:', filePath);
        process.exit(1);
    }
    const code = fs_1.default.readFileSync(filePath, 'utf-8');
    const result = yield (0, codeAnalyzer_1.analyzeCode)(code);
    console.log('\n--- Generated Tutorial ---\n');
    console.log(result.tutorialText);
    let audioPath = filePath.replace(/\.[^.]+$/, '.mp3');
    if (options.voice || options.video) {
        yield (0, textToSpeech_1.generateSpeech)(result.tutorialText, audioPath);
    }
    if (options.video) {
        const videoPath = filePath.replace(/\.[^.]+$/, '.mp4');
        yield (0, videoGenerator_1.generateVideo)(result.tutorialText, audioPath, videoPath);
    }
}));
program.parse();
