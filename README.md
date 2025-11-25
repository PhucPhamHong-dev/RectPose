# RectPose Vision – Rectangle Pose Estimation System

Industrial-style demo that detects a single rectangle from the webcam, estimates its center and rotation, and sends the pose to a simulated robot controller.

## Project layout

```
RectPose/
  backend/   Express + TypeScript API (robot simulator)
  frontend/  React + Vite + TypeScript UI with OpenCV.js
```

## Prerequisites

- Node.js 18+ (tested with npm)
- Webcam access in the browser
- Network access to load OpenCV.js from the official CDN

## Backend (API / Robot Simulator)

```bash
cd backend
npm install
npm run dev       # watches TS with nodemon
# or build + run
npm run build
npm start         # starts compiled dist/server.js
```

- Runs on port `4000` by default (`PORT` env overrides).
- Endpoints:
  - `POST /api/pose/send` – accepts `{ x_px, y_px, theta_deg, x_mm, y_mm }`, logs, and stores as the latest pose.
  - `GET /api/pose/latest` – returns the last pose with timestamp or `status: "empty"` if none.

## Frontend (Web UI + CV)

```bash
cd frontend
npm install
npm run dev -- --host   # Vite dev server (defaults to http://localhost:5173)
```

- Uses OpenCV.js loaded from `https://docs.opencv.org/4.x/opencv.js`.
- Dev proxy forwards `/api` to `http://localhost:4000`; for another backend use `VITE_API_BASE`.

### Using the app

1. Start the backend, then the frontend dev server.
2. Open the UI in the browser, allow webcam access, and click **Start camera**.
3. Place a high-contrast rectangle/box in view. The overlay draws the rotated bounding box, center marker, and θ.
4. (Optional) Enter a simple scale factor in **Scale (mm per pixel)** to derive `x_mm` / `y_mm`.
5. Click **Send pose to robot** to POST to the backend. The log panel shows acknowledgements and the latest pose on the server.

### CV pipeline (frontend)

- Grab frame from `getUserMedia` video
- Grayscale → Gaussian blur
- Canny edge detection
- `findContours` → filter by area
- `minAreaRect` → center `(x, y)` and rotation `θ`
- Draw rotated box + center + orientation arrow on overlay canvas

### Notes & caveats

- If OpenCV.js fails to load, check network/CORS and refresh; the CDN download can take a few seconds on first load.
- Detection targets the dominant rectangle; very small or low-contrast shapes may be ignored.
- Calibration is a simple linear mm-per-pixel scale for demo purposes.

Enjoy building with RectPose Vision!
