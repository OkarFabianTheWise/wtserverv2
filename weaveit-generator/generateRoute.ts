import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { enhanceScript } from '../src/codeAnalyzer.ts';
import { generateSpeech } from '../src/textToSpeech.ts';
import { generateScrollingScriptVideo } from '../src/videoGenerator.ts';

const router = express.Router();

function makeContentId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Use the server's `src/output` directory so static serving matches
const outputDir = path.join(process.cwd(), 'src', 'output');

// POST /api/generate
// POST /api/generate
router.post('/generate', async (req: Request, res: Response) => {
  try {
    let { transactionSignature, script, title } = req.body;

    if (!script || typeof script !== 'string' || script.trim() === '') {
      return res.status(400).json({ error: 'Missing script in request body' });
    }

    if (!transactionSignature) {
      transactionSignature = makeContentId();
    }

    console.log('weaveit-generator: Processing tutorial request:', { title, transactionSignature });

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Enhance the script for narration
    const explanation = await enhanceScript(script);
    const audioPath = path.join(outputDir, `${transactionSignature}.mp3`);
    const videoPath = path.join(outputDir, `${transactionSignature}.mp4`);

    // Generate speech and video (these may take time)
    await generateSpeech(explanation, audioPath);
    await generateScrollingScriptVideo(script, audioPath, videoPath);

    res.json({
      contentId: transactionSignature,
      videoUrl: `/output/${transactionSignature}.mp4`,
      message: 'Educational tutorial video generated successfully',
    });
  } catch (error) {
    console.error('weaveit-generator: Video generation error:', error);
    res.status(500).json({ error: 'Failed to generate video' });
  }
});

export default router;
