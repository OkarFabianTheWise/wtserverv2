import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import videosStatusRoute from '../weaveit-generator/videosStatusRoute.ts';
import generateRoute from '../weaveit-generator/generateRoute.ts';
import { testConnection } from './db.ts';

// Load environment variables from root .env file
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use('/output', express.static(path.join(__dirname, 'output')));

// Mount API routers under `/api` so frontend can call `/api/generate` and `/api/videos/status/:id`
app.use('/api', videosStatusRoute);
app.use('/api', generateRoute);

// Video serving endpoint
app.get('/api/videos/:transactionSignature', (req, res) => {
  const { transactionSignature } = req.params;
  const videoPath = path.join(__dirname, 'output', `${transactionSignature}.mp4`);

  if (!fs.existsSync(videoPath)) {
    res.status(404).json({ error: 'Video not found' });
    return;
  }

  res.sendFile(videoPath);
});

// DB health endpoint
app.get('/api/db/health', async (_req, res) => {
  try {
    await testConnection();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Fallback 404 handler (always JSON)
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
