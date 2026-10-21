import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../i18n/locales/en';
import zh from '../i18n/locales/zh-CN';
import PaceCurveLink from './PaceCurveLink';

const state = vi.hoisted(() => ({ lang: 'en' }));
vi.mock('../contexts/I18nContext', () => ({
  useI18n: () => ({
    t: (key) => key.split('.').reduce((value, part) => value?.[part], state.lang === 'zh-CN' ? zh : en) || key,
  }),
}));

afterEach(() => {
  cleanup();
  state.lang = 'en';
});

describe('PaceCurveLink', () => {
  it('links to the pace curve page, in the language of the page', () => {
    render(<MemoryRouter><PaceCurveLink /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Pace curve and critical pace' })).toHaveAttribute('href', '/analysis#pace-curve');

    cleanup();
    state.lang = 'zh-CN';
    render(<MemoryRouter><PaceCurveLink /></MemoryRouter>);
    expect(screen.getByRole('link', { name: '配速曲线和临界配速' })).toHaveAttribute('href', '/analysis#pace-curve');
  });
});
