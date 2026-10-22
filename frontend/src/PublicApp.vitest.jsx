import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter } from 'react-router';
import PublicApp, { LeavePublicApp } from './PublicApp';
import { renderPublicPage } from './publicPageEntry';
import LegalPage from './pages/legal/LegalPage';

let hydratedRoot;
let container;
beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  document.documentElement.lang = 'en';
});
afterEach(async () => {
  if (hydratedRoot) await act(async () => hydratedRoot.unmount());
  hydratedRoot = null;
  container?.remove();
  container = null;
  cleanup();
});

describe('public client startup', () => {
  it('hydrates the existing hero and keeps goal selection and FAQs interactive', async () => {
    container = document.createElement('div');
    container.innerHTML = renderPublicPage('/').content;
    document.body.append(container);
    const originalHero = container.querySelector('.lv3-hero img');
    const recoverable = vi.fn();
    await act(async () => {
      hydratedRoot = hydrateRoot(container, <BrowserRouter><PublicApp /></BrowserRouter>, { onRecoverableError: recoverable });
    });
    expect(recoverable).not.toHaveBeenCalled();
    expect(container.querySelector('.lv3-hero img')).toBe(originalHero);
    const firstGoal = container.querySelector('.lv3-goal');
    await userEvent.click(firstGoal);
    expect(firstGoal).toHaveAttribute('aria-pressed', 'true');
    const question = container.querySelectorAll('details summary')[1];
    await userEvent.click(question);
    expect(question.parentElement).toHaveAttribute('open');
  });

  it('hydrates English before applying the saved Chinese locale', async () => {
    localStorage.setItem('hermes_lang', 'zh-CN');
    container = document.createElement('div');
    container.innerHTML = renderPublicPage('/').content;
    document.body.append(container);
    const originalHero = container.querySelector('.lv3-hero img');
    const recoverable = vi.fn();
    await act(async () => {
      hydratedRoot = hydrateRoot(container, <BrowserRouter><PublicApp /></BrowserRouter>, { onRecoverableError: recoverable });
    });
    await waitFor(() => expect(document.documentElement).toHaveAttribute('lang', 'zh-CN'));
    expect(container.querySelector('h1')).toHaveTextContent('不负训练');
    expect(container.querySelector('.lv3-hero img')).toBe(originalHero);
    expect(recoverable).not.toHaveBeenCalled();
  });

  it('keeps hydration stable when the built footer year differs from the current year', async () => {
    const dateSpy = vi.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2020);
    const content = renderPublicPage('/').content;
    dateSpy.mockRestore();
    container = document.createElement('div');
    container.innerHTML = content;
    document.body.append(container);
    const originalHero = container.querySelector('.lv3-hero img');
    const recoverable = vi.fn();
    await act(async () => {
      hydratedRoot = hydrateRoot(container, <BrowserRouter><PublicApp /></BrowserRouter>, { onRecoverableError: recoverable });
    });
    expect(recoverable).not.toHaveBeenCalled();
    expect(container.querySelector('.lv3-hero img')).toBe(originalHero);
    expect(container.querySelector('[data-render-year]')).toHaveAttribute('data-render-year', String(new Date().getFullYear()));
  });

  it('renders the legal route with its own heading', async () => {
    window.history.replaceState(null, '', '/privacy');
    render(<BrowserRouter><PublicApp /></BrowserRouter>);
    expect(await screen.findByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to HermesRuns' })).toHaveAttribute('href', '/');
  });

  it.each(['/terms', '/privacy'])('hydrates preloaded legal content at %s without replacing its heading', async (route) => {
    window.history.replaceState(null, '', route);
    container = document.createElement('div');
    container.innerHTML = renderPublicPage(route).content;
    document.body.append(container);
    const originalHeading = container.querySelector('h1');
    const recoverable = vi.fn();
    await act(async () => {
      hydratedRoot = hydrateRoot(container, <BrowserRouter><PublicApp initialLegal={LegalPage} /></BrowserRouter>, { onRecoverableError: recoverable });
    });
    expect(container.querySelector('h1')).toBe(originalHeading);
    expect(recoverable).not.toHaveBeenCalled();
  });

  it('hands private routes to their document without losing query or OAuth hash', () => {
    const replace = vi.fn();
    render(<MemoryRouter initialEntries={['/profile?return=training#token=example']}><LeavePublicApp replace={replace} /></MemoryRouter>);
    expect(replace).toHaveBeenCalledWith('/profile?return=training#token=example');
  });
});
