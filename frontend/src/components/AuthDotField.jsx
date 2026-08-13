import { useEffect, useRef } from 'react';

const DOT_GAP = 22;
const INTERACTION_RADIUS = 260;
const EASING = 0.18;

export default function AuthDotField() {
  const canvasRef = useRef(null);
  const frameRef = useRef();
  const pointerRef = useRef({
    active: false,
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const context = canvas.getContext('2d');
    if (!context) return undefined;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionQuery.matches;

    const palette = () => {
      const styles = window.getComputedStyle(canvas);
      return {
        color:
          styles.getPropertyValue('--auth-dot-color').trim() || '224, 238, 255',
        opacity:
          Number.parseFloat(styles.getPropertyValue('--auth-dot-opacity')) ||
          0.22,
      };
    };

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;

      const ratio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      const pixelWidth = Math.round(width * ratio);
      const pixelHeight = Math.round(height * ratio);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }

      const { color, opacity } = palette();
      const pointer = pointerRef.current;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.fillStyle = `rgb(${color})`;

      for (let baseY = DOT_GAP / 2; baseY < height; baseY += DOT_GAP) {
        for (let baseX = DOT_GAP / 2; baseX < width; baseX += DOT_GAP) {
          const dx = pointer.x - baseX;
          const dy = pointer.y - baseY;
          const distance = Math.hypot(dx, dy);
          const influence =
            pointer.active && !reducedMotion
              ? Math.max(0, 1 - distance / INTERACTION_RADIUS) ** 2
              : 0;
          const radius = 1.05 + influence * 1.1;
          const alpha = Math.min(1, opacity + influence * 0.48);

          context.globalAlpha = alpha;
          context.beginPath();
          context.arc(
            baseX + dx * influence * 0.12,
            baseY + dy * influence * 0.12,
            radius,
            0,
            Math.PI * 2,
          );
          context.fill();
        }
      }
      context.globalAlpha = 1;
    };

    const render = () => {
      frameRef.current = undefined;
      const pointer = pointerRef.current;
      if (pointer.active && !reducedMotion) {
        pointer.x += (pointer.targetX - pointer.x) * EASING;
        pointer.y += (pointer.targetY - pointer.y) * EASING;
      }

      draw();
      const remaining = Math.hypot(
        pointer.targetX - pointer.x,
        pointer.targetY - pointer.y,
      );
      if (pointer.active && !reducedMotion && remaining > 0.2) {
        frameRef.current = window.requestAnimationFrame(render);
      }
    };

    const schedule = () => {
      if (frameRef.current === undefined) {
        frameRef.current = window.requestAnimationFrame(render);
      }
    };

    const handlePointerMove = (event) => {
      const bounds = canvas.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      if (x < 0 || y < 0 || x > bounds.width || y > bounds.height) return;

      const pointer = pointerRef.current;
      if (!pointer.active) {
        pointer.x = x;
        pointer.y = y;
      }
      pointer.targetX = x;
      pointer.targetY = y;
      pointer.active = true;
      schedule();
    };

    const resetPointer = () => {
      pointerRef.current.active = false;
      schedule();
    };

    const handleMotionChange = () => {
      reducedMotion = motionQuery.matches;
      if (reducedMotion) pointerRef.current.active = false;
      schedule();
    };

    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(canvas);
    window.addEventListener('pointermove', handlePointerMove, {
      passive: true,
    });
    window.addEventListener('blur', resetPointer);
    motionQuery.addEventListener('change', handleMotionChange);
    schedule();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('blur', resetPointer);
      motionQuery.removeEventListener('change', handleMotionChange);
      if (frameRef.current !== undefined)
        window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <div className="auth-dot-field" aria-hidden="true">
      <canvas ref={canvasRef} className="auth-dot-field__canvas" />
    </div>
  );
}
