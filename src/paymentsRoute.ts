import express from 'express';
import { awardUserPoints } from './db.js';

const router = express.Router();

// POST /api/payments/award
// Body: { walletAddress: string, tier?: number|string, amount?: number, points?: number, contentType?: 'audio'|'video' }
router.post('/payments/award', async (req: any, res: any) => {
  try {
    const { walletAddress, tier, amount, points, contentType } = req.body || {};
    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress is required' });
    }

    const tierMap: Record<string, number> = { '5': 30, '10': 80, '20': 150 };

    let awardedPoints: number | undefined;
    if (points !== undefined) awardedPoints = Number(points);
    else if (tier !== undefined) awardedPoints = tierMap[String(tier)];
    else if (amount !== undefined) awardedPoints = tierMap[String(amount)];

    if (awardedPoints === undefined || Number.isNaN(awardedPoints)) {
      return res.status(400).json({ error: 'Provide valid `tier`, `amount`, or `points`' });
    }

    const newTotal = await awardUserPoints(walletAddress, awardedPoints);

    // Optionally compute equivalent content credits based on cost per content
    // NOTE: audio creation = 1 credit, video creation = 2 credits
    const costs: Record<string, number> = { audio: 1, video: 2 };
    let contentCredits: number | null = null;
    if (contentType && costs[contentType]) {
      contentCredits = Number((awardedPoints / costs[contentType]).toFixed(2));
    }

    res.json({
      walletAddress,
      awardedPoints,
      newTotalPoints: newTotal,
      contentType: contentType || null,
      contentCredits
    });
  } catch (err) {
    console.error('Error awarding points:', err);
    res.status(500).json({ error: 'Failed to award points' });
  }
});

export default router;
