export interface PosePayload {
  x_px: number;
  y_px: number;
  theta_deg: number;
  x_mm?: number | null;
  y_mm?: number | null;
}

export interface PoseRecord extends PosePayload {
  receivedAt: string;
}

export interface LatestPoseResponse {
  status: 'ok' | 'empty';
  pose?: PoseRecord;
  message?: string;
}
