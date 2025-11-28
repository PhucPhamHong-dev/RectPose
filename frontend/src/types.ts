export interface PoseResponse {
  found: boolean;
  class_id: number | null;
  class_name: string | null;
  x_px: number | null;
  y_px: number | null;
  theta_deg: number | null;
  x_mm: number | null;
  y_mm: number | null;
  box?: Array<[number, number]>;
}

export interface PoseLogEntry {
  timestamp: string;
  message: string;
}
