import { useEffect, useRef, useState } from 'react';

export function PerformanceOverlay() {
  const [fps, setFps] = useState(0);
  const last = useRef<number>(performance.now());
  const acc = useRef(0);
  const frames = useRef(0);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const now = performance.now();
      const dt = now - last.current;
      last.current = now;
      acc.current += dt;
      frames.current += 1;
      if (acc.current >= 500) {
        const fpsNow = (frames.current / acc.current) * 1000;
        setFps(Math.round(fpsNow));
        acc.current = 0;
        frames.current = 0;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div
      style={{
        position: 'absolute',
        right: 12,
        top: 48,
        padding: '4px 8px',
        background: 'rgba(15,23,42,0.85)',
        border: '1px solid #334155',
        borderRadius: 6,
        color: '#e5e7eb',
        fontFamily: 'monospace',
        fontSize: 12,
      }}
    >
      FPS: {fps}
    </div>
  );
}
