# RectPose Vision – Frontend

React + Vite + TypeScript UI for the RectPose Vision demo. It captures a webcam feed, runs the rectangle-detection pipeline with OpenCV.js on the client, overlays the pose, and lets you send it to the backend robot simulator.

## Quick start

```bash
npm install
npm run dev -- --host   # http://localhost:5173 by default
```

- OpenCV.js is loaded from the official CDN.
- Dev proxy forwards `/api` to `http://localhost:4000`; override with `VITE_API_BASE`.
- For full project details and backend setup, see the root `README.md`.
