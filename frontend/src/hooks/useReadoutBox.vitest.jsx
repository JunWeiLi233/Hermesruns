import { act, cleanup, render, screen } from '@testing-library/react';
import { useEffect, useRef, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import useReadoutBox from './useReadoutBox';

/** What the box of the readout is, for a test with no layout: the test says. */
let drawn = { width: 190, height: 120 };
const rect = () => ({ left: 0, top: 0, right: drawn.width, bottom: drawn.height, width: drawn.width, height: drawn.height, x: 0, y: 0, toJSON() {} });

/** What the test reaches into the component with: a way to show or hide the readout, a way to draw it again, and the number of times the page was drawn. */
const control = { show: null, again: null, commits: 0 };

function Probe() {
  const [shown, setShown] = useState(true);
  const [, setTick] = useState(0);
  const ref = useRef(null);
  const size = useReadoutBox(ref);
  useEffect(() => {
    control.show = setShown;
    control.again = () => setTick((tick) => tick + 1);
  }, []);
  useEffect(() => { control.commits += 1; });
  return (
    <div>
      <output data-testid="size">{size ? `${size.width}x${size.height}` : 'none'}</output>
      {shown ? <div ref={(node) => { ref.current = node; if (node) node.getBoundingClientRect = rect; }}>readout</div> : null}
    </div>
  );
}

afterEach(() => { cleanup(); drawn = { width: 190, height: 120 }; control.commits = 0; });

describe('the size of a readout', () => {
  it('is what the readout is once it is drawn', () => {
    render(<Probe />);
    expect(screen.getByTestId('size')).toHaveTextContent('190x120');
  });

  it('follows the readout when it changes size (the text was made larger), and is nothing while there is no readout', () => {
    render(<Probe />);
    drawn = { width: 190, height: 240 };
    act(() => control.show(false));
    expect(screen.getByTestId('size')).toHaveTextContent('none');
    act(() => control.show(true));
    expect(screen.getByTestId('size')).toHaveTextContent('190x240');
  });

  it('settles: a readout that stays the same size does not cause render after render', () => {
    render(<Probe />);
    const first = control.commits;
    act(() => control.again());
    act(() => control.again());
    act(() => control.again());
    expect(control.commits - first).toBe(3);
    expect(screen.getByTestId('size')).toHaveTextContent('190x120');
  });

  it('is nothing for a box that cannot be right (no layout, as in a test), so that the caller keeps its guess', () => {
    drawn = { width: 0, height: 0 };
    render(<Probe />);
    expect(screen.getByTestId('size')).toHaveTextContent('none');
  });
});
