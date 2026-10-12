import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import HermesLogo from './HermesLogo';
import HermesMarkSvg from './HermesMarkSvg';
import HermesWordmarkSvg from './HermesWordmarkSvg';

// hermes:runs logo kit (2026): ink #1a1714, coral #ff5a3c, paper #f5f1ea. The colon is always coral.
const INK = '#1a1714';
const PAPER = '#f5f1ea';
const CORAL = '#ff5a3c';

afterEach(() => cleanup());

describe('HermesWordmarkSvg', () => {
  it('draws the letters in the text colour and the colon in coral', () => {
    const { container } = render(<HermesWordmarkSvg />);
    const svg = container.querySelector('svg');
    const [letters, colon] = svg.querySelectorAll('path');

    expect(svg).toHaveAttribute('viewBox', '6.2 -72.4 597 73.6');
    expect(letters).toHaveAttribute('fill', 'currentColor');
    expect(colon).toHaveAttribute('fill', CORAL);
    expect(colon.getAttribute('d').match(/M/g)).toHaveLength(2);
  });

  it('is named after the product, not after the drawing', () => {
    const { container, rerender } = render(<HermesWordmarkSvg />);
    expect(container.querySelector('svg')).toHaveAttribute('role', 'img');
    expect(container.querySelector('svg')).toHaveAttribute('aria-label', 'HermesRuns');

    rerender(<HermesWordmarkSvg title="HermesRuns home" className="landing-cinematic-brand-word" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-label', 'HermesRuns home');
    expect(container.querySelector('svg')).toHaveClass('hermes-wordmark', 'landing-cinematic-brand-word');
  });
});

describe('HermesMarkSvg', () => {
  const colors = (container) => ({
    tile: container.querySelector('.hermes-mark__tile').getAttribute('fill'),
    letter: container.querySelector('.hermes-mark__letter')?.getAttribute('stroke'),
    colon: [...container.querySelectorAll('rect:not(.hermes-mark__tile)')].map((rect) => rect.getAttribute('fill')),
  });

  it('is an ink tile with a paper h by default, and a paper tile with an ink h on dark surfaces', () => {
    const light = render(<HermesMarkSvg />);
    expect(colors(light.container)).toEqual({ tile: INK, letter: PAPER, colon: [CORAL, CORAL] });
    cleanup();

    const dark = render(<HermesMarkSvg tone="dark" />);
    expect(colors(dark.container)).toEqual({ tile: PAPER, letter: INK, colon: [CORAL, CORAL] });
  });

  it('keeps the kit symbol drawing: stem and arch with flat ends, two rounded colon squares', () => {
    const { container } = render(<HermesMarkSvg />);
    const letter = container.querySelector('.hermes-mark__letter');

    expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 100 100');
    expect(container.querySelector('.hermes-mark__tile')).toHaveAttribute('rx', '24');
    expect(letter).toHaveAttribute('stroke-width', '14');
    expect(letter).toHaveAttribute('stroke-linecap', 'butt');
    expect(container.querySelectorAll('rect[rx="3"]')).toHaveLength(2);
  });

  it('draws the colon alone for 16 to 32 px, like the kit favicon', () => {
    const { container } = render(<HermesMarkSvg variant="colon" />);

    expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 32 32');
    expect(container.querySelector('.hermes-mark__letter')).toBeNull();
    expect(colors(container)).toEqual({ tile: INK, letter: undefined, colon: [CORAL, CORAL] });
  });

  it('carries its tone as a class, so the midnight theme can flip tone="auto"', () => {
    const { container } = render(<HermesMarkSvg tone="auto" className="auth-flow-wordmark-logo" />);

    expect(container.querySelector('svg')).toHaveClass('hermes-mark', 'hermes-mark--auto', 'auth-flow-wordmark-logo');
    expect(colors(container).tile).toBe(INK);
  });

  it('is decorative: the wordmark beside it carries the name', () => {
    const { container } = render(<HermesMarkSvg />);

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('svg')).toHaveAttribute('focusable', 'false');
  });
});

describe('HermesLogo', () => {
  it('follows the theme by default', () => {
    const { container } = render(<HermesLogo />);

    expect(container.firstChild).toHaveClass('hermes-logo', 'hermes-logo--auto');
    expect(container.querySelector('.hermes-logo__icon')).toHaveClass('hermes-mark--auto');
    expect(container.querySelector('.hermes-logo__word')).toHaveClass('hermes-wordmark');
  });

  it('passes an explicit tone to the symbol', () => {
    const { container } = render(<HermesLogo tone="dark" />);

    expect(container.firstChild).toHaveClass('hermes-logo--dark');
    expect(container.querySelector('.hermes-mark__tile')).toHaveAttribute('fill', PAPER);
  });

  it('ignores the legacy dark flag the sidebars still pass, and can hide the symbol', () => {
    const { container } = render(<HermesLogo dark showIcon={false} />);

    expect(container.firstChild).toHaveClass('hermes-logo--auto');
    expect(container.querySelector('.hermes-logo__icon')).toBeNull();
  });

  it('shows the optional accent text after the logotype', () => {
    const { container } = render(<HermesLogo mark="RUN" />);

    expect(container.querySelector('.hermes-logo__mark')).toHaveTextContent('RUN');
  });
});
