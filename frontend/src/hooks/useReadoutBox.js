import { useLayoutEffect, useState } from 'react';

/**
 * The size a readout has once it is drawn, so that it can be put where it fits by what it is and not by what it was guessed to be: its text sets its height, and how large
 * the text is belongs to the reader (a browser set to a big font makes the readout twice as tall as at the usual size), as the language does. It is measured before the
 * browser paints, so a readout is never seen in the wrong place for a moment. Nothing (null) until there is a readout, and for a size that cannot be right (no layout, as
 * in a test), so that the caller can fall back to its guess.
 *
 * @param ref the readout's element (`ref.current` is null while there is none)
 * @returns {{ width: number, height: number } | null}
 */
export default function useReadoutBox(ref) {
  const [size, setSize] = useState(null);
  // After every render on purpose, with no list of what it depends on: what the readout says, and so its size, changes with the render. It sets the size only when the size is
  // not the one it has, so a render that changes nothing changes nothing and there is no chain of updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const node = ref.current;
    const box = node ? node.getBoundingClientRect() : null;
    const next = box && box.width > 0 && box.height > 0 ? { width: box.width, height: box.height } : null;
    setSize((current) => {
      if (next === null || current === null) return next === current ? current : next;
      return Math.abs(current.width - next.width) < 0.5 && Math.abs(current.height - next.height) < 0.5 ? current : next;
    });
  });
  return size;
}
