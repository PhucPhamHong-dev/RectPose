import { PosePayload, PoseRecord } from '../models/pose';

let latestPose: PoseRecord | null = null;

export function savePose(payload: PosePayload): PoseRecord {
  const receivedAt = new Date().toISOString();
  latestPose = { ...payload, receivedAt };
  // Simple log to mimic a robot controller receiving data
  console.log(
    `[RobotSimulator] Received pose: x_px=${payload.x_px.toFixed(1)}, y_px=${payload.y_px.toFixed(
      1,
    )}, theta_deg=${payload.theta_deg.toFixed(1)}, x_mm=${
      payload.x_mm ?? 'n/a'
    }, y_mm=${payload.y_mm ?? 'n/a'}`,
  );
  return latestPose;
}

export function getLatestPose(): PoseRecord | null {
  return latestPose;
}
