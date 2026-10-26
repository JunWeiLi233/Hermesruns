import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../i18n/locales/en';
import zh from '../i18n/locales/zh-CN';
import Vo2maxEstimatesLink from './Vo2maxEstimatesLink';

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

describe('Vo2maxEstimatesLink', () => {
  it('links to the page of the runs behind the number, in the language of the page', () => {
    render(<MemoryRouter><Vo2maxEstimatesLink /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'The runs behind this number' })).toHaveAttribute('href', '/analysis#vo2max-estimates');

    cleanup();
    state.lang = 'zh-CN';
    render(<MemoryRouter><Vo2maxEstimatesLink /></MemoryRouter>);
    expect(screen.getByRole('link', { name: '这个数字背后的跑步' })).toHaveAttribute('href', '/analysis#vo2max-estimates');
  });
});
