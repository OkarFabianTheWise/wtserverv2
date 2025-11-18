// import express from 'express';
// import type { Request, Response } from 'express';
// import path from 'path';
// import fs from 'fs';
// import { fileURLToPath } from 'url';
// import { enhanceScript } from './codeAnalyzer.ts';
// import { generateSpeech } from './textToSpeech.ts';
// import { generateScrollingScriptVideo } from './videoGenerator.ts';

// const router = express.Router();

// // ESM dirname
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// const outputDir = path.join(__dirname, 'output');

// // POST /generate
// router.post('/generate', async (req: Request, res: Response) => {
//   try {
//     const { script, title, walletAddress, transactionSignature } = req.body;
//     console.log('Processing tutorial request:', { title, transactionSignature });

//     if (!transactionSignature) {
//       return res.status(400).json({ error: 'Transaction signature is required' });
//     }

//     if (!fs.existsSync(outputDir)) {
//       fs.mkdirSync(outputDir, { recursive: true });
//     }

//     // AI narration
//     const explanation = await enhanceScript(script);
//     const audioPath = path.join(outputDir, `${transactionSignature}.mp3`);
//     const videoPath = path.join(outputDir, `${transactionSignature}.mp4`);

//     await generateSpeech(explanation, audioPath);
//     await generateScrollingScriptVideo(script, audioPath, videoPath);

//     res.json({
//       contentId: transactionSignature,
//       videoUrl: `/output/${transactionSignature}.mp4`,
//       message: 'Educational tutorial video generated successfully',
//     });
//   } catch (error) {
//     console.error('Video generation error:', error);
//     res.status(500).json({ error: 'Failed to generate video' });
//   }
// });

// export default router;
