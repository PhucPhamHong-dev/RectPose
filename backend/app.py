import base64
import os
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from ultralytics import YOLO

app = FastAPI(title="RectPose Vision Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the YOLO model once at startup for fast inference.
BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "weights" / "best.pt"

print("MODEL_PATH =", MODEL_PATH)
print("MODEL_PATH exists? ", MODEL_PATH.exists())

yolo_model = YOLO(str(MODEL_PATH))

# Class filters (block Oil by default to avoid false detections on faces).
ALLOWED_CLASS_NAMES = {
    name.strip().lower() for name in os.getenv("TARGET_CLASSES", "").split(",") if name.strip()
}
ALLOWED_CLASS_IDS = {
    int(val) for val in os.getenv("TARGET_CLASS_IDS", "").split(",") if val.strip().isdigit()
}
BLOCKED_CLASS_NAMES = {
    name.strip().lower() for name in os.getenv("BLOCK_CLASSES", "").split(",") if name.strip()
}
BLOCKED_CLASS_IDS = {
    int(val) for val in os.getenv("BLOCK_CLASS_IDS", "").split(",") if val.strip().isdigit()
}

# Confidence/area gates to reduce false positives (tune via env if needed).
MIN_CONF = float(os.getenv("MIN_CONF", "0.5"))
# Bounding box area as fraction of frame (0.005 = 0.5%).
MIN_BOX_REL_AREA = float(os.getenv("MIN_BOX_REL_AREA", "0.005"))
MAX_BOX_REL_AREA = float(os.getenv("MAX_BOX_REL_AREA", "0.5"))


class FrameRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 data URL of the frame")


class PoseResponse(BaseModel):
    found: bool
    class_id: Optional[int] = None
    class_name: Optional[str] = None
    x_px: Optional[int] = None
    y_px: Optional[int] = None
    theta_deg: Optional[float] = None
    x_mm: Optional[float] = None
    y_mm: Optional[float] = None
    box: Optional[List[Tuple[int, int]]] = None


class PoseSendRequest(BaseModel):
    x_px: float
    y_px: float
    theta_deg: float
    x_mm: Optional[float] = None
    y_mm: Optional[float] = None


latest_pose: Optional[dict] = None


def _compute_rotated_pose(
    frame: np.ndarray, box: Tuple[int, int, int, int]
) -> Tuple[Optional[int], Optional[int], Optional[float], Optional[List[Tuple[int, int]]]]:
    """
    Refine pose using minAreaRect inside the YOLO box to get rotation and tighter corners.
    Returns (cx, cy, theta_deg, box_points) in absolute image coords when possible.
    """
    x1, y1, x2, y2 = map(int, box)
    roi = frame[y1:y2, x1:x2]
    if roi.size == 0:
        return None, None, None, None

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    _, mask = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    edges = cv2.Canny(mask, 50, 150)
    mask = cv2.bitwise_or(mask, edges)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None, None, None, None

    roi_area = float(roi.shape[0] * roi.shape[1])
    min_roi_area = max(50.0, roi_area * 0.003)
    largest = max(contours, key=cv2.contourArea)
    if cv2.contourArea(largest) < min_roi_area:
        return None, None, None, None

    rect = cv2.minAreaRect(largest)
    (cx, cy), (w, h), angle = rect
    if w == 0 or h == 0:
        return None, None, None, None

    # OpenCV gives angle in [-90, 0); normalize so that taller boxes rotate to a positive angle.
    if w < h:
        angle += 90.0
    theta_deg = float(angle)

    box_points = cv2.boxPoints(rect)
    box_points[:, 0] += x1
    box_points[:, 1] += y1
    pts_list: List[Tuple[int, int]] = [(int(p[0]), int(p[1])) for p in box_points]

    return int(cx) + x1, int(cy) + y1, theta_deg, pts_list


def _decode_image(data_url: str) -> np.ndarray:
    """Decode a base64 data URL into a BGR OpenCV image."""
    header, data = data_url.split(",", 1) if "," in data_url else ("", data_url)
    try:
        image_bytes = base64.b64decode(data)
    except Exception as exc:  # noqa: BLE001
        raise ValueError("Invalid base64 image payload") from exc
    image_array = np.frombuffer(image_bytes, np.uint8)
    frame = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Could not decode image")
    return frame


def _run_yolo(frame: np.ndarray) -> PoseResponse:
    """Run YOLO inference and refine pose with minAreaRect inside the detection box."""
    results = yolo_model(frame, verbose=False)[0]

    names_map = {}
    if isinstance(getattr(results, "names", None), dict):
        names_map = results.names  # type: ignore[assignment]
    elif isinstance(getattr(yolo_model, "names", None), dict):
        names_map = yolo_model.names  # type: ignore[assignment]

    frame_h, frame_w = frame.shape[:2]
    frame_area = float(frame_h * frame_w)

    best_box: Optional[Tuple[int, int, int, int]] = None
    best_cls: Optional[int] = None
    best_cls_name: Optional[str] = None
    best_conf = MIN_CONF

    for box in results.boxes or []:
        conf = float(box.conf[0])
        if conf <= best_conf:
            continue

        cls_id = int(box.cls[0]) if box.cls is not None else None
        cls_name = names_map.get(cls_id) if cls_id is not None else None
        cls_name_lower = (cls_name or "").lower()

        if BLOCKED_CLASS_IDS and cls_id in BLOCKED_CLASS_IDS:
            continue
        if BLOCKED_CLASS_NAMES and cls_name_lower in BLOCKED_CLASS_NAMES:
            continue
        if ALLOWED_CLASS_IDS and (cls_id is None or cls_id not in ALLOWED_CLASS_IDS):
            continue
        if ALLOWED_CLASS_NAMES and cls_name_lower not in ALLOWED_CLASS_NAMES:
            continue

        x1, y1, x2, y2 = box.xyxy[0].tolist()
        w_box = max(1.0, x2 - x1)
        h_box = max(1.0, y2 - y1)
        rel_area = (w_box * h_box) / frame_area
        if rel_area < MIN_BOX_REL_AREA or rel_area > MAX_BOX_REL_AREA:
            continue

        best_conf = conf
        best_box = (int(x1), int(y1), int(x2), int(y2))
        best_cls = cls_id
        best_cls_name = cls_name

    if best_box is None:
        return PoseResponse(found=False, class_id=None, class_name=None, box=None)

    x1, y1, x2, y2 = best_box

    # Clamp coordinates to frame bounds for safety.
    h, w = frame.shape[:2]
    x1 = max(0, min(w - 1, x1))
    y1 = max(0, min(h - 1, y1))
    x2 = max(0, min(w - 1, x2))
    y2 = max(0, min(h - 1, y2))

    # Refine angle and corners inside the ROI.
    cx_ref, cy_ref, theta_deg, rot_box = _compute_rotated_pose(frame, (x1, y1, x2, y2))

    x_center = cx_ref if cx_ref is not None else int((x1 + x2) / 2)
    y_center = cy_ref if cy_ref is not None else int((y1 + y2) / 2)

    box_points = rot_box if rot_box is not None else [(x1, y1), (x2, y1), (x2, y2), (x1, y2)]

    return PoseResponse(
        found=True,
        class_id=best_cls,
        class_name=best_cls_name,
        x_px=x_center,
        y_px=y_center,
        theta_deg=theta_deg if theta_deg is not None else 0.0,
        x_mm=None,
        y_mm=None,
        box=box_points,
    )


@app.post("/api/pose/estimate", response_model=PoseResponse)
async def estimate_pose(payload: FrameRequest):
    """Decode the incoming frame and run YOLO inference to estimate the pose."""
    try:
        frame = _decode_image(payload.image_base64)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return _run_yolo(frame)


@app.post("/api/pose/send")
async def send_pose(pose: PoseSendRequest):
    """Store the last sent pose to mimic a robot controller."""
    global latest_pose
    received_at = datetime.utcnow().isoformat()
    latest_pose = {**pose.model_dump(), "receivedAt": received_at}
    return {"status": "ok", "receivedAt": received_at, "pose": latest_pose}


@app.get("/api/pose/latest")
async def latest():
    """Return the most recent pose if available."""
    if latest_pose is None:
        return {"status": "empty", "message": "No pose received yet"}
    return {"status": "ok", "pose": latest_pose}
