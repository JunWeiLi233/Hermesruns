import { useCallback, useEffect, useRef, useState } from 'react';

export const CATALOG_LONG_PRESS_MS = 3000;
export const CATALOG_SWIPE_THRESHOLD_PX = 48;

const CATALOG_MOVE_CANCEL_PX = 12;

export function getCatalogTargetKey(target) {
  return target?.id ? `${target.kind}:${target.id}` : '';
}

/**
 * Coordinates the admin catalog card gesture without changing the card's
 * normal click behavior. Persisted cards opt in by passing a target with an
 * id; built-in cards simply do not attach these handlers.
 */
export function useCatalogLongPress(onDelete) {
  const [readyKey, setReadyKey] = useState('');
  const timerRef = useRef(null);
  const gestureRef = useRef(null);
  const suppressClickRef = useRef(false);
  const onDeleteRef = useRef(onDelete);

  useEffect(() => {
    onDeleteRef.current = onDelete;
  }, [onDelete]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetGesture = useCallback(() => {
    clearTimer();
    gestureRef.current = null;
    setReadyKey('');
  }, [clearTimer]);

  useEffect(() => () => {
    clearTimer();
    gestureRef.current = null;
  }, [clearTimer]);

  const begin = useCallback((target, event) => {
    const key = getCatalogTargetKey(target);
    if (!key || !event) return;

    clearTimer();
    setReadyKey('');
    gestureRef.current = {
      key,
      target,
      startX: event.clientX,
      startY: event.clientY,
      ready: false,
    };
    // Keep native click targets (brand/series buttons and footer actions) as
    // the click target. Capturing a pointer that started on a descendant can
    // retarget the following click to the card shell instead of the button.
    if (event.target === event.currentTarget) {
      event.currentTarget?.setPointerCapture?.(event.pointerId);
    }
    timerRef.current = window.setTimeout(() => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.key !== key) return;
      gesture.ready = true;
      suppressClickRef.current = true;
      setReadyKey(key);
    }, CATALOG_LONG_PRESS_MS);
  }, [clearTimer]);

  const move = useCallback((target, event) => {
    const key = getCatalogTargetKey(target);
    const gesture = gestureRef.current;
    if (!key || !gesture || gesture.key !== key || gesture.ready) return;

    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    if (Math.hypot(deltaX, deltaY) > CATALOG_MOVE_CANCEL_PX) {
      resetGesture();
    }
  }, [resetGesture]);

  const finish = useCallback((target, event) => {
    const key = getCatalogTargetKey(target);
    const gesture = gestureRef.current;
    if (!key || !gesture || gesture.key !== key) return;

    clearTimer();
    gestureRef.current = null;
    const deltaY = event.clientY - gesture.startY;

    if (!gesture.ready) {
      setReadyKey('');
      return;
    }

    suppressClickRef.current = true;
    if (deltaY <= -CATALOG_SWIPE_THRESHOLD_PX) {
      setReadyKey('');
      void onDeleteRef.current?.(target);
      return;
    }

    if (deltaY >= CATALOG_SWIPE_THRESHOLD_PX) {
      setReadyKey('');
    }
  }, [clearTimer]);

  const cancel = useCallback((target) => {
    const key = getCatalogTargetKey(target);
    if (gestureRef.current?.key === key) resetGesture();
  }, [resetGesture]);

  const consumeClick = useCallback((event) => {
    if (!suppressClickRef.current) return false;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
    return true;
  }, []);

  return {
    readyKey,
    begin,
    move,
    finish,
    cancel,
    consumeClick,
  };
}
