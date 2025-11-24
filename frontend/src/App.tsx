import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, AlertTriangle, Bot, Camera, Cpu, Play, Square } from 'lucide-react';
import './index.css';
import { Card } from './components/ui/card';
import { Button } from './components/ui/button';
import { Separator } from './components/ui/separator';
import { ScrollArea } from './components/ui/scroll-area';
import type { PoseLogEntry, PoseResponse } from './types';
import { cn } from './lib/utils';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
const FRAME_INTERVAL_MS = 250;

type Status = 'idle' | 'streaming' | 'waiting' | 'error';

const statusColor: Record<Status, string> = {
  idle: 'bg-slate-500',
  streaming: 'bg-emerald-400',
  waiting: 'bg-amber-400',
  error: 'bg-red-500',
};

function AnimatedValue({ value, label }: { value: number | null | undefined; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <motion.span
        key={value ?? '---'}
        initial={{ opacity: 0.3, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="text-2xl font-semibold text-slate-50"
      >
        {value != null ? value.toFixed(1) : '---'}
      </motion.span>
    </div>
  );
}

function Chip({ color, text }: { color: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1 text-xs text-slate-200 shadow-inner">
      <span className={cn('h-2.5 w-2.5 rounded-full', color)} />
      {text}
    </span>
  );
}

function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const captureRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<Status>('idle');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [pose, setPose] = useState<PoseResponse | null>(null);
  const [logs, setLogs] = useState<PoseLogEntry[]>([]);
  const [requestInFlight, setRequestInFlight] = useState(false);
  const [sendingPose, setSendingPose] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [mmScaleInput, setMmScaleInput] = useState('');

  const mmScale = useMemo(() => {
    const numeric = Number(mmScaleInput);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }, [mmScaleInput]);

  const pushLog = (message: string) => {
    setLogs((prev) => [{ timestamp: new Date().toLocaleTimeString(), message }, ...prev].slice(0, 15));
  };

  const syncCanvasSize = () => {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    const capture = captureRef.current;
    if (!video || !overlay || !capture) return;
    if (!video.videoWidth || !video.videoHeight) return;
    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;
    capture.width = video.videoWidth;
    capture.height = video.videoHeight;
  };

  const drawOverlay = (result: PoseResponse | null) => {
    const canvas = overlayRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!result?.found || result.x_px == null || result.y_px == null) {
      ctx.fillStyle = 'rgba(226,232,240,0.7)';
      ctx.font = '14px "Inter", sans-serif';
      ctx.fillText('No rectangle detected', 18, 26);
      return;
    }

    if (result.box && result.box.length === 4) {
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(result.box[0][0], result.box[0][1]);
      for (let i = 1; i < result.box.length; i += 1) {
        ctx.lineTo(result.box[i][0], result.box[i][1]);
      }
      ctx.closePath();
      ctx.stroke();
    }

    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.arc(result.x_px, result.y_px, 6, 0, Math.PI * 2);
    ctx.fill();

    if (result.theta_deg != null) {
      const rad = (result.theta_deg * Math.PI) / 180;
      const len = 50;
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(result.x_px, result.y_px);
      ctx.lineTo(result.x_px + len * Math.cos(rad), result.y_px + len * Math.sin(rad));
      ctx.stroke();

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '13px "Inter", sans-serif';
      ctx.fillText(`θ ${result.theta_deg.toFixed(1)}°`, result.x_px + 10, result.y_px - 10);
    }
  };

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const capture = captureRef.current;
    if (!video || !capture || !video.videoWidth || !video.videoHeight) return null;
    capture.width = video.videoWidth;
    capture.height = video.videoHeight;
    const ctx = capture.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, capture.width, capture.height);
    return capture.toDataURL('image/jpeg', 0.85);
  }, []);

  const sendFrame = useCallback(async () => {
    if (!cameraActive || requestInFlight) return;
    const image = captureFrame();
    if (!image) return;

    setRequestInFlight(true);
    setStatus('waiting');
    try {
      const resp = await fetch(`${API_BASE}/api/pose/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: image }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: PoseResponse = await resp.json();
      drawOverlay(data);
      setPose(data);
      setLastUpdated(new Date().toLocaleTimeString());
      if (!data.found) {
        pushLog('No rectangle detected');
      }
      setStatus('streaming');
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      pushLog(`Processing error: ${err?.message ?? 'unknown'}`);
    } finally {
      setRequestInFlight(false);
    }
  }, [cameraActive, requestInFlight, captureFrame]);

  useEffect(() => {
    if (!cameraActive) return;
    const id = window.setInterval(() => {
      void sendFrame();
    }, FRAME_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [cameraActive, sendFrame]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 1280, height: 720 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      syncCanvasSize();
      setCameraActive(true);
      setCameraError(null);
      setStatus('streaming');
      pushLog('Camera started');
    } catch (err: any) {
      console.error(err);
      setCameraError(err?.message ?? 'Unable to start camera');
      setStatus('error');
      pushLog(`Camera error: ${err?.message ?? 'unknown'}`);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setStatus('idle');
    drawOverlay(null);
    pushLog('Camera stopped');
  };

  const handleSendPose = async () => {
    if (!pose?.found || pose.x_px == null || pose.y_px == null || pose.theta_deg == null) {
      pushLog('Cannot send: no rectangle detected');
      return;
    }
    const enrichedPose = {
      x_px: pose.x_px,
      y_px: pose.y_px,
      theta_deg: pose.theta_deg,
      x_mm: pose.x_mm ?? (mmScale ? pose.x_px * mmScale : null),
      y_mm: pose.y_mm ?? (mmScale ? pose.y_px * mmScale : null),
    };
    setSendingPose(true);
    try {
      const resp = await fetch(`${API_BASE}/api/pose/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enrichedPose),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      pushLog('Pose sent to robot simulator');
    } catch (err: any) {
      pushLog(`Send failed: ${err?.message ?? 'unknown'}`);
    } finally {
      setSendingPose(false);
    }
  };

  const detectionStatus = pose?.found ? 'Rectangle detected' : cameraError ? 'Camera not available' : 'No rectangle detected';

  const computedXmm = pose?.found && pose.x_px != null && mmScale ? pose.x_px * mmScale : pose?.x_mm ?? null;
  const computedYmm = pose?.found && pose.y_px != null && mmScale ? pose.y_px * mmScale : pose?.y_mm ?? null;

  return (
    <div className="min-h-screen px-6 py-5">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">RectPose Vision</p>
            <h1 className="text-2xl font-bold text-slate-50">Rectangle Pose Estimation System</h1>
            <p className="text-sm text-slate-400">Live CV, robust contour filtering, and robot handoff simulator.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip color={statusColor[status]} text={`Status: ${status}`} />
            <Chip color={pose?.found ? 'bg-emerald-400' : 'bg-amber-400'} text={detectionStatus} />
            {cameraError ? <Chip color="bg-red-500" text="Camera error" /> : null}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[2fr,1.15fr]">
          <Card className="relative h-full overflow-hidden p-0">
            <div className="relative aspect-video w-full bg-slate-950">
              <video
                ref={videoRef}
                className="absolute inset-0 h-full w-full rounded-xl object-cover"
                playsInline
                muted
                onLoadedMetadata={syncCanvasSize}
              />
              <canvas ref={overlayRef} className="absolute inset-0 h-full w-full" />
              {!cameraActive ? (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-slate-300">
                  <div className="flex flex-col items-center gap-2 text-sm">
                    <Camera className="h-6 w-6 text-slate-400" />
                    <p>Camera idle. Start to begin detection.</p>
                  </div>
                </div>
              ) : null}
              {requestInFlight ? (
                <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-slate-900/80 px-3 py-1 text-xs text-slate-200">
                  <Cpu className="h-4 w-4 text-cyan-300" />
                  Processing…
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Activity className="h-4 w-4 text-emerald-300" />
                <span>{detectionStatus}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>Frame interval: {FRAME_INTERVAL_MS} ms</span>
                {lastUpdated ? <span>Last update: {lastUpdated}</span> : null}
              </div>
            </div>
          </Card>

          <div className="flex flex-col gap-3">
            <Card title="Pose" description="Pixel + optional metric scale" className="p-0">
              <div className="grid grid-cols-3 gap-3 p-4">
                <AnimatedValue value={pose?.x_px ?? null} label="X (px)" />
                <AnimatedValue value={pose?.y_px ?? null} label="Y (px)" />
                <AnimatedValue value={pose?.theta_deg ?? null} label="Theta (deg)" />
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-3 px-4 pb-4 pt-3">
                <AnimatedValue value={computedXmm} label="X (mm)" />
                <AnimatedValue value={computedYmm} label="Y (mm)" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={startCamera} disabled={cameraActive} variant="primary">
                  <Play className="h-4 w-4" /> Start camera
                </Button>
                <Button onClick={stopCamera} disabled={!cameraActive} variant="ghost">
                  <Square className="h-4 w-4" /> Stop camera
                </Button>
                <Button onClick={handleSendPose} disabled={!pose?.found || sendingPose} variant="outline">
                  <Bot className="h-4 w-4" />
                  {sendingPose ? 'Sending...' : 'Send Pose to Robot'}
                </Button>
              </div>
              <div className="mt-4 grid grid-cols-[1fr] gap-2 sm:grid-cols-[1.2fr,0.8fr]">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Scale (mm per pixel)</p>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-cyan-300 focus:outline-none"
                    placeholder="e.g. 0.25"
                    value={mmScaleInput}
                    onChange={(e) => setMmScaleInput(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-slate-500">Applies client-side scaling to show mm fields.</p>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">
                  {pose?.found ? (
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  ) : (
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
                  )}
                  {pose?.found ? 'Pose ready to send' : 'Waiting for detection'}
                </div>
              </div>
            </Card>

            <Card title="Logs" action={<Chip color="bg-cyan-300" text="Live" />} className="p-0">
              <ScrollArea className="px-4 py-3">
                {logs.length === 0 ? (
                  <p className="text-sm text-slate-500">Actions will appear here.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {logs.map((log, idx) => (
                      <div
                        key={`${log.timestamp}-${idx}`}
                        className="flex items-center gap-3 rounded-lg border border-slate-800/80 bg-slate-900/50 px-3 py-2 text-sm text-slate-200"
                      >
                        <span className="font-mono text-xs text-cyan-300">{log.timestamp}</span>
                        <span>{log.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </Card>

            {cameraError ? (
              <Card className="border-red-700 bg-red-950/40">
                <div className="flex items-center gap-2 text-sm text-red-200">
                  <AlertTriangle className="h-4 w-4" />
                  Camera not available: {cameraError}
                </div>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
      <canvas ref={captureRef} className="hidden" />
    </div>
  );
}

export default App;
