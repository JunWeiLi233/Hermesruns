import { useCallback, useEffect } from 'react';

/**
 * Which day (or week) of a chart is being looked at, and how it is chosen: by the pointer, by a tap, or by the arrow keys.
 * The chart owns the state (`selectedIndex`, null for none); this returns the handlers to put on the element that holds
 * the picture, which has to be focusable and a slider for the keys to mean anything.
 *
 * - the pointer picks the nearest position as it moves, and lets go when it leaves, unless the chart has the keyboard;
 * - a finger picks on touching and keeps the pick after it lifts (a finger that has lifted has left, which says nothing
 *   about wanting the readout gone); touching anywhere else lets go of it;
 * - focusing the chart picks the newest day, and the arrows, Home and End move the pick; Escape and losing focus let go.
 *
 * @param plotRef      the element that holds the picture
 * @param positions    where each choice sits across the picture, in the picture's own units
 * @param viewWidth    the width of the picture in those units
 * @param startIndex   the choice a keyboard starts on
 * @param lastIndex    the last choice a key can reach (an arrow can go past `startIndex` into days after today)
 */
export default function useScrubber({ plotRef, positions, viewWidth, startIndex, lastIndex, selectedIndex, onSelect }) {
  const selectNearest = useCallback((event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || positions.length === 0) return;
    const x = ((event.clientX - rect.left) / rect.width) * viewWidth;
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    positions.forEach((position, index) => {
      const distance = Math.abs(position - x);
      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    onSelect(best);
  }, [positions, viewWidth, onSelect]);

  const onKeyDown = useCallback((event) => {
    const index = selectedIndex ?? startIndex;
    const next = {
      ArrowLeft: Math.max(0, index - 1),
      ArrowRight: Math.min(lastIndex, index + 1),
      Home: 0,
      End: startIndex,
    }[event.key];
    if (next != null) {
      event.preventDefault();
      onSelect(next);
    } else if (event.key === 'Escape') {
      onSelect(null);
    }
  }, [selectedIndex, startIndex, lastIndex, onSelect]);

  const holding = selectedIndex != null;
  useEffect(() => {
    if (!holding) return undefined;
    const letGo = (event) => {
      if (plotRef.current && !plotRef.current.contains(event.target)) onSelect(null);
    };
    document.addEventListener('pointerdown', letGo, true);
    return () => document.removeEventListener('pointerdown', letGo, true);
  }, [holding, plotRef, onSelect]);

  return {
    onFocus: () => { if (selectedIndex == null) onSelect(startIndex); },
    onBlur: () => onSelect(null),
    onKeyDown,
    onPointerMove: selectNearest,
    onPointerDown: selectNearest,
    onPointerLeave: (event) => {
      if (event.pointerType === 'touch' || event.pointerType === 'pen') return;
      if (document.activeElement !== plotRef.current) onSelect(null);
    },
  };
}
