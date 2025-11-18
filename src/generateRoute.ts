import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { enhanceScript } from './codeAnalyzer.ts';
import { generateSpeech } from './textToSpeech.ts';
import { generateScrollingScriptVideo } from './videoGenerator.ts';
import crypto from 'crypto';

const router = express.Router();

// ESM dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputDir = path.join(__dirname, 'output');

// POST /generate
// POST /generate
// Accepts { script, title, walletAddress, transactionSignature? }
// If `transactionSignature` is not provided the route will generate a unique id.
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { script, title, walletAddress, transactionSignature } = req.body;
    // Allow callers to omit a transaction signature — generate a unique id when missing
    const id = transactionSignature || `gen-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
    console.log('Processing tutorial request:', { title, id });

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // AI narration
    const explanation = await enhanceScript(script);
    const audioPath = path.join(outputDir, `${id}.mp3`);
    const videoPath = path.join(outputDir, `${id}.mp4`);

    await generateSpeech(explanation, audioPath);
    await generateScrollingScriptVideo(script, audioPath, videoPath);

    res.json({
      contentId: id,
      videoUrl: `/output/${id}.mp4`,
      message: 'Educational tutorial video generated successfully',
    });
  } catch (error) {
    console.error('Video generation error:', error);
    res.status(500).json({ error: 'Failed to generate video' });
  }
});

export default router;
