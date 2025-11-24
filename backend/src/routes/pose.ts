import { Router, Request, Response } from 'express';
import { LatestPoseResponse, PosePayload } from '../models/pose';
import { getLatestPose, savePose } from '../services/robotSimulator';

const router = Router();

function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

function normalizePayload(body: any): PosePayload | null {
  const { x_px, y_px, theta_deg, x_mm = null, y_mm = null } = body ?? {};
  if (!isValidNumber(x_px) || !isValidNumber(y_px) || !isValidNumber(theta_deg)) {
    return null;
  }
  const mmX = x_mm === null || x_mm === undefined ? null : Number(x_mm);
  const mmY = y_mm === null || y_mm === undefined ? null : Number(y_mm);
  return {
    x_px: Number(x_px),
    y_px: Number(y_px),
    theta_deg: Number(theta_deg),
    x_mm: mmX,
    y_mm: mmY,
  };
}

router.post('/send', (req: Request, res: Response) => {
  const payload = normalizePayload(req.body);
  if (!payload) {
    return res.status(400).json({ status: 'error', message: 'Invalid pose payload' });
  }

  const saved = savePose(payload);
  return res.status(200).json({ status: 'ok', receivedAt: saved.receivedAt });
});

router.get('/latest', (_req: Request, res: Response<LatestPoseResponse>) => {
  const latest = getLatestPose();
  if (!latest) {
    return res.json({ status: 'empty', message: 'No pose received yet' });
  }
  return res.json({ status: 'ok', pose: latest });
});

export default router;
