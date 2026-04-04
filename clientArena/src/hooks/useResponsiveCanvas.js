import { useRef, useEffect } from 'react';

export function useResponsiveCanvas(drawFunction) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const parent = canvas.parentElement;
    let animationFrameId;

    const render = () => {
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      const dpr = window.devicePixelRatio || 1;

      // Only force a browser reflow if the CSS size actually changed
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        context.scale(dpr, dpr);
        context.imageSmoothingEnabled = false;
      }

      // Draw the current frame
      drawFunction(context, width, height);
      
      // Request the next frame immediately
      animationFrameId = requestAnimationFrame(render);
    };

    render(); // Start the loop

    // Cleanup the loop if the component ever unmounts
    return () => cancelAnimationFrame(animationFrameId);
  }, [drawFunction]);

  return canvasRef;
}