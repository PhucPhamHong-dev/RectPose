import base64
import base64
from datetime import datetime
from typing import List, Optional, Tuple

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="RectPose Vision Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class FrameRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 data URL of the frame")


class PoseResponse(BaseModel):
    found: bool
    x_px: Optional[float] = None
    y_px: Optional[float] = None
    theta_deg: Optional[float] = None
    x_mm: Optional[float] = None
    y_mm: Optional[float] = None
    box: Optional[List[Tuple[float, float]]] = None


class PoseSendRequest(BaseModel):
    x_px: float
    y_px: float
    theta_deg: float
    x_mm: Optional[float] = None
    y_mm: Optional[float] = None


latest_pose: Optional[dict] = None


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


def detect_rectangle_from_frame(frame: np.ndarray) -> PoseResponse:
    h, w = frame.shape[:2]
    print(f"[DEBUG] frame size: {w}x{h}")

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)

    # dùng Otsu + invert: giấy trắng, vật tối
    _, thresh = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    kernel = np.ones((3, 3), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)

    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    print(f"[DEBUG] contours found: {len(contours)}")

    best_cnt = None
    best_area = 0.0

    for c in contours:
        area = cv2.contourArea(c)
        print(f"[DEBUG] contour area: {area}")
        if area < 0.01 * w * h:  # nhỏ hơn 1% frame → bỏ
            continue

        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        print(f"[DEBUG] vertices: {len(approx)}")

        if len(approx) < 4 or len(approx) > 8:
            continue

        if area > best_area:
            best_area = area
            best_cnt = c

    if best_cnt is None:
        print("[DEBUG] no suitable rectangle")
        return PoseResponse(found=False, box=None)

    rect = cv2.minAreaRect(best_cnt)
    (cx, cy), (rw, rh), angle = rect

    if angle < -45:
        angle += 90

    print(f"[DEBUG] chosen rect center=({cx:.1f},{cy:.1f}), angle={angle:.1f}")
    box_points = cv2.boxPoints(rect)
    box_list = [(float(p[0]), float(p[1])) for p in box_points]

    return PoseResponse(
        found=True,
        x_px=float(cx),
        y_px=float(cy),
        theta_deg=float(angle),
        x_mm=None,
        y_mm=None,
        box=box_list,
    )


@app.post("/api/pose/estimate", response_model=PoseResponse)
async def estimate_pose(payload: FrameRequest):
    try:
        frame = _decode_image(payload.image_base64)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return detect_rectangle_from_frame(frame)


@app.post("/api/pose/send")
async def send_pose(pose: PoseSendRequest):
    global latest_pose
    received_at = datetime.utcnow().isoformat()
    latest_pose = {**pose.model_dump(), "receivedAt": received_at}
    print(
        f"[RobotSimulator] Received pose x_px={pose.x_px:.1f}, y_px={pose.y_px:.1f}, "
        f"theta_deg={pose.theta_deg:.1f}, x_mm={pose.x_mm}, y_mm={pose.y_mm}"
    )
    return {"status": "ok", "receivedAt": received_at, "pose": latest_pose}


@app.get("/api/pose/latest")
async def latest():
    if latest_pose is None:
        return {"status": "empty", "message": "No pose received yet"}
    return {"status": "ok", "pose": latest_pose}
