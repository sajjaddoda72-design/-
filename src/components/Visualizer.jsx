import React, { useRef, useEffect } from 'react';
import { engine } from '../audio/engine';
import { useStore } from '../store';

export const Visualizer = () => {
  const canvasRef = useRef(null);
  const isPlaying = useStore((state) => state.isPlaying);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const analyser = engine.analyser;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(centerX, centerY) - 20;

      ctx.clearRect(0, 0, width, height);

      // Background glow
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.05)';
      ctx.fill();

      if (isPlaying) {
        analyser.getByteTimeDomainData(dataArray);
      } else {
        dataArray.fill(128); // flat line if paused
      }

      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.8)';
      ctx.beginPath();

      const sliceAngle = (Math.PI * 2) / bufferLength;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const r = radius + (v - 1) * 50; // amplify wave
        const angle = i * sliceAngle;

        const x = centerX + r * Math.cos(angle);
        const y = centerY + r * Math.sin(angle);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.closePath();
      ctx.stroke();

      // Inner radar circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.5, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.2)';
      ctx.stroke();

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying]);

  return (
    <div className="flex justify-center items-center w-full p-4">
      <canvas 
        ref={canvasRef} 
        width={300} 
        height={300} 
        className="max-w-full rounded-full shadow-[0_0_30px_rgba(16,185,129,0.15)]"
      />
    </div>
  );
};