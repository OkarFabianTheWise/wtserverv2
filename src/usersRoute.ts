import express from 'express';
import { getUserInfo, expireTrialsForWallet } from './db';

const router = express.Router();

// GET /api/users/:walletAddress/points
// Returns { walletAddress, points, trial_expires_at }
router.get('/users/:walletAddress/points', async (req: any, res: any) => {
  try {
    const { walletAddress } = req.params;
    if (!walletAddress) return res.status(400).json({ error: 'walletAddress required' });

    // Ensure expired trials are processed before returning balance
    try {
      await expireTrialsForWallet(walletAddress);
    } catch (err) {
      // non-fatal
      console.error('Error expiring trials for balance check:', err);
    }

    const info = await getUserInfo(walletAddress);
    if (!info) return res.status(404).json({ error: 'User not found' });

    res.json({ walletAddress, points: info.prompt_points, trial_expires_at: info.trial_expires_at });
  } catch (err) {
    console.error('Error fetching user points:', err);
    res.status(500).json({ error: 'Failed to fetch user points' });
  }
});

export default router;
