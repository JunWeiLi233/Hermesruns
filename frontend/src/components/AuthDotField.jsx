import { useEffect, useRef, useState } from 'react';

const GRID_SPACING = 20;
const INTERACTION_RADIUS = 240;
const POINTER_EASING = 0.22;

function getDotPalette(canvas) {
  const styles = window.getComputedStyle(canvas);
  return {
    rgb: styles.getPropertyValue('--auth-dot-rgb').trim() || '255, 244, 236',
    opacity: Number.parseFloat(styles.getPropertyValue('--auth-dot-opacity')) || 0.2,
  };
}

export default function AuthDotField() {
  const canvasRef = useRef(null);
  const canvasReadyRef = useRef(false);
  const [isInteractive, setIsInteractive] = useState(false);
  const pointerRef = useRef({
    active: false,
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
  });
  const frameIdRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof canvas.getContext !== 'function') return undefined;

    let prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const requestFrame = window.requestAnimationFrame?.bind(window);
    const cancelFrame = window.cancelAnimationFrame?.bind(window);

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width <= 0 || height <= 0) return;

      const pixelRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      const canvasWidth = Math.round(width * pixelRatio);
      const canvasHeight = Math.round(height * pixelRatio);

      if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
      }

      const context = canvas.getContext('2d');
      if (!context) return;

      if (!canvasReadyRef.current) {
        canvasReadyRef.current = true;
        setIsInteractive(true);
      }

      const { rgb, opacity } = getDotPalette(canvas);
      const pointer = pointerRef.current;
      const allowsInteraction = pointer.active && !prefersReducedMotion;

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.fillStyle = `rgb(${rgb})`;

      for (let baseY = GRID_SPACING / 2; baseY < height; baseY += GRID_SPACING) {
        for (let baseX = GRID_SPACING / 2; baseX < width; baseX += GRID_SPACING) {
          let x = baseX;
          let y = baseY;
          let radius = 1.1;
          let alpha = opacity;

          if (allowsInteraction) {
            const offsetX = pointer.x - baseX;
            const offsetY = pointer.y - baseY;
            const distance = Math.hypot(offsetX, offsetY);
            const influence = Math.max(0, 1 - distance / INTERACTION_RADIUS) ** 2;

            x += offsetX * influence * 0.2;
            y += offsetY * influence * 0.2;
            radius += influence * 0.9;
            alpha += influence * 0.36;
          }

          context.globalAlpha = Math.min(1, alpha);
          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fill();
        }
      }

      context.globalAlpha = 1;
    };

    const render = () => {
      frameIdRef.current = undefined;
      const pointer = pointerRef.current;

      if (pointer.active && !prefersReducedMotion) {
        pointer.x += (pointer.targetX - pointer.x) * POINTER_EASING;
        pointer.y += (pointer.targetY - pointer.y) * POINTER_EASING;
      }

      draw();

      const settlingDistance = Math.hypot(pointer.targetX - pointer.x, pointer.targetY - pointer.y);
      if (requestFrame && pointer.active && !prefersReducedMotion && settlingDistance > 0.2) {
        frameIdRef.current = requestFrame(render);
      }
    };

    const scheduleRender = () => {
      if (!requestFrame) {
        render();
        return;
      }

      if (frameIdRef.current === undefined) {
        frameIdRef.current = requestFrame(render);
      }
    };

    const resetPointer = () => {
      pointerRef.current.active = false;
      scheduleRender();
    };

    const handlePointerMove = (event) => {
      const bounds = canvas.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;

      if (x < 0 || y < 0 || x > bounds.width || y > bounds.height) {
        resetPointer();
        return;
      }

      const pointer = pointerRef.current;
      if (!pointer.active) {
        pointer.x = x;
        pointer.y = y;
      }

      pointer.targetX = x;
      pointer.targetY = y;
      pointer.active = true;
      scheduleRender();
    };

    const handlePointerOut = (event) => {
      if (event.relatedTarget === null) resetPointer();
    };

    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionPreference = () => {
      prefersReducedMotion = motionPreference.matches;
      if (prefersReducedMotion) pointerRef.current.active = false;
      scheduleRender();
    };

    const resizeObserver = typeof window.ResizeObserver === 'function'
      ? new window.ResizeObserver(scheduleRender)
      : null;
    resizeObserver?.observe(canvas);

    const themeObserver = typeof MutationObserver === 'function'
      ? new MutationObserver(scheduleRender)
      : null;
    themeObserver?.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerout', handlePointerOut, { passive: true });
    window.addEventListener('blur', resetPointer);
    window.addEventListener('resize', scheduleRender);
    document.addEventListener('visibilitychange', resetPointer);
    motionPreference.addEventListener('change', handleMotionPreference);
    scheduleRender();

    return () => {
      resizeObserver?.disconnect();
      themeObserver?.disconnect();
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerout', handlePointerOut);
      window.removeEventListener('blur', resetPointer);
      window.removeEventListener('resize', scheduleRender);
      document.removeEventListener('visibilitychange', resetPointer);
      motionPreference.removeEventListener('change', handleMotionPreference);
      if (frameIdRef.current !== undefined && cancelFrame) {
        cancelFrame(frameIdRef.current);
      }
    };
  }, []);

  return (
    <div className={`auth-login-dot-field${isInteractive ? ' is-interactive' : ''}`} aria-hidden="true">
      <canvas ref={canvasRef} className="auth-login-dot-field__canvas" />
    </div>
  );
}
