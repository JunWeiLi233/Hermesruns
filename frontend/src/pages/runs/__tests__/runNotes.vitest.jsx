import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../i18n/locales/en';
import RunNotes from '../RunNotes';

const t = (key) => key.split('.').reduce((value, part) => value?.[part], en) || key;

vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: 'en', t }) }));

afterEach(() => cleanup());

describe('RunNotes', () => {
  it.each([[null], [undefined], [''], ['   \n  '], [42], [{}]])('shows nothing for %j', (notes) => {
    const { container } = render(<RunNotes notes={notes} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows short notes under a heading, with the runner\'s line breaks kept', () => {
    render(<RunNotes notes={'Windy on the bridge.\nHeavy legs.'} />);
    const section = screen.getByRole('region', { name: t('run_detail.notes_title') });
    expect(section).toBeInTheDocument();
    // The line break is in the text itself (the page shows it with white-space: pre-wrap); jest-dom would fold it into a space.
    expect(screen.getByText(/Windy on the bridge\./).textContent).toBe('Windy on the bridge.\nHeavy legs.');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/Windy/)).not.toHaveClass('is-folded');
  });

  it('shows the words as text, never as markup', () => {
    render(<RunNotes notes={'<b>bold</b> <script>alert(1)</script>'} />);
    expect(screen.getByText('<b>bold</b> <script>alert(1)</script>')).toBeInTheDocument();
    expect(document.querySelector('b')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
  });

  it('folds notes of more than four lines until asked, and folds them again', async () => {
    const user = userEvent.setup();
    render(<RunNotes notes={'one\ntwo\nthree\nfour\nfive'} />);
    const text = screen.getByText(/one/);
    expect(text).toHaveClass('is-folded');
    const toggle = screen.getByRole('button', { name: t('run_detail.notes_more') });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', text.id);

    await user.click(toggle);
    expect(text).not.toHaveClass('is-folded');
    expect(screen.getByRole('button', { name: t('run_detail.notes_less') })).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('button', { name: t('run_detail.notes_less') }));
    expect(text).toHaveClass('is-folded');
  });

  it('folds long notes on one line, and does not fold notes of exactly the limit', () => {
    const { unmount } = render(<RunNotes notes={'a'.repeat(281)} />);
    expect(screen.getByRole('button', { name: t('run_detail.notes_more') })).toBeInTheDocument();
    unmount();
    render(<RunNotes notes={'a'.repeat(280)} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does not fold four lines', () => {
    render(<RunNotes notes={'one\ntwo\nthree\nfour'} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
