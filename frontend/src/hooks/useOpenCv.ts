import { useEffect, useState } from 'react';

declare global {
  interface Window {
    cv: any;
  }
}

const OPENCV_CDN = 'https://docs.opencv.org/4.x/opencv.js';

export function useOpenCv() {
  const [ready, setReady] = useState<boolean>(typeof window !== 'undefined' && !!window.cv?.Mat);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready) return;

    const existingScript = document.getElementById('opencv-js');
    if (existingScript) {
      if (window.cv?.Mat) {
        setReady(true);
        return;
      }
      existingScript.addEventListener('load', () => setReady(true));
      return;
    }

    const script = document.createElement('script');
    script.id = 'opencv-js';
    script.src = OPENCV_CDN;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.cv) {
        // Ensure OpenCV runtime is initialized before marking ready
        window.cv['onRuntimeInitialized'] = () => setReady(true);
        if (window.cv.Mat) {
          setReady(true);
        }
      } else {
        setError('OpenCV.js loaded but window.cv is undefined');
      }
    };
    script.onerror = () => setError('Failed to load OpenCV.js from CDN');
    document.body.appendChild(script);

    return () => {
      script.onload = null;
      script.onerror = null;
    };
  }, [ready]);

  return { ready, error };
}
