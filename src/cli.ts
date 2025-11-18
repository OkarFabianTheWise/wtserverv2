// src/cli.ts
// #!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { analyzeCode } from './codeAnalyzer.ts';
import { generateSpeech } from './textToSpeech.ts';
import { generateVideo } from './videoGenerator.ts';

const program = new Command();

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
  .action(async (options) => {
    const filePath = path.resolve(process.cwd(), options.file);
    if (!fs.existsSync(filePath)) {
      console.error('File not found:', filePath);
      process.exit(1);
    }

    const code = fs.readFileSync(filePath, 'utf-8');
    const result = await analyzeCode(code);

    console.log('\n--- Generated Tutorial ---\n');
    console.log(result.tutorialText);

    let audioPath = filePath.replace(/\.[^.]+$/, '.mp3');
    if (options.voice || options.video) {
      await generateSpeech(result.tutorialText, audioPath);
    }

    if (options.video) {
      const videoPath = filePath.replace(/\.[^.]+$/, '.mp4');
      await generateVideo(result.tutorialText, audioPath, videoPath);
    }
  });

program.parse();