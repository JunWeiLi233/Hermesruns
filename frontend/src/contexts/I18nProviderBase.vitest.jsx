import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslationRuntime } from '../i18n/createTranslationRuntime.js';
import I18nContext, { I18nProvider, useI18n as usePrivateI18n } from './I18nContext.jsx';
import { I18nProviderBase } from './I18nProviderBase.jsx';
import LightweightI18nContext, { useI18n } from './i18nContextState.js';

function makeRuntime(loader) {
  return createTranslationRuntime({
    fallbackMessages: { landing: { text: 'English {count}' } },
    localeLoaders: { 'zh-CN': loader },
  });
}

function Probe({ onRender }) {
  const { lang, t, setLang, formatNumber, formatList } = useI18n();
  onRender?.(lang);
  return <>
    <output>{`${lang}: ${t('landing.text', { count: 2 })}`}</output>
    <span>{formatNumber(1234.5)}</span><span>{formatList(['one', 'two'])}</span>
    <button onClick={() => setLang('en')}>English</button>
    <button onClick={() => setLang('zh-CN')}>Chinese</button>
  </>;
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('navigator', { language: 'en-US', languages: ['en-US'] });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.lang = 'en';
  vi.unstubAllGlobals();
});

describe('shared i18n provider', () => {
  it('keeps the private hook and default context identity compatible', () => {
    expect(I18nContext).toBe(LightweightI18nContext);
    expect(usePrivateI18n).toBe(useI18n);
    function PrivateProbe() { return <output>{usePrivateI18n().t('races.loading')}</output>; }
    render(<I18nProvider initialLanguage="en"><PrivateProbe /></I18nProvider>);
    expect(screen.getByText('Loading races...')).toBeInTheDocument();
  });

  it('hydrates English first, then applies a saved language after its messages arrive', async () => {
    let finishLoad;
    const runtime = makeRuntime(() => new Promise((resolve) => { finishLoad = resolve; }));
    const renders = [];
    const onRecoverableError = vi.fn();
    const tree = <I18nProviderBase runtime={runtime} initialLanguage="en" deferLanguageDetection>
      <Probe onRender={(lang) => renders.push(lang)} />
    </I18nProviderBase>;
    const container = document.createElement('div');
    container.innerHTML = renderToString(tree);
    document.body.append(container);
    localStorage.setItem('hermes_lang', 'zh-CN');
    let root;
    await act(async () => { root = hydrateRoot(container, tree, { onRecoverableError }); });
    expect(container.querySelector('output')).toHaveTextContent('en: English 2');
    expect(renders.every((lang) => lang === 'en')).toBe(true);
    expect(document.documentElement.lang).toBe('en');

    await act(async () => { finishLoad({ default: { landing: { text: '中文 {count}' } } }); });
    expect(container.querySelector('output')).toHaveTextContent('zh-CN: 中文 2');
    expect(document.documentElement.lang).toBe('zh-CN');
    expect(onRecoverableError).not.toHaveBeenCalled();
    await act(async () => root.unmount());
    container.remove();
  });

  it('uses the system locale after mounting when there is no saved preference', async () => {
    vi.stubGlobal('navigator', { language: 'zh-CN', languages: ['zh-Hans-CN', 'en-US'] });
    const runtime = makeRuntime(async () => ({ default: { landing: { text: '中文 {count}' } } }));
    render(<I18nProviderBase runtime={runtime} initialLanguage="en" deferLanguageDetection><Probe /></I18nProviderBase>);
    expect(await screen.findByText('zh-CN: 中文 2')).toBeInTheDocument();
  });

  it('retains the English locale and formatting when the preferred dictionary fails', async () => {
    localStorage.setItem('hermes_lang', 'zh-CN');
    const runtime = makeRuntime(async () => { throw new Error('offline'); });
    render(<I18nProviderBase runtime={runtime} initialLanguage="en" deferLanguageDetection><Probe /></I18nProviderBase>);
    await act(async () => { expect(await runtime.ensureLocaleMessages('zh-CN')).toBeNull(); });
    expect(screen.getByText('en: English 2')).toBeInTheDocument();
    expect(screen.getByText('1,234.5')).toBeInTheDocument();
    expect(screen.getByText('one and two')).toBeInTheDocument();
    expect(localStorage.getItem('hermes_lang')).toBe('zh-CN');
  });

  it('does not override an explicit language choice with a pending saved preference', async () => {
    let finishLoad;
    localStorage.setItem('hermes_lang', 'zh-CN');
    const runtime = makeRuntime(() => new Promise((resolve) => { finishLoad = resolve; }));
    render(<I18nProviderBase runtime={runtime} initialLanguage="en" deferLanguageDetection><Probe /></I18nProviderBase>);
    fireEvent.click(screen.getByText('English'));
    await act(async () => { finishLoad({ default: { landing: { text: '中文 {count}' } } }); });
    expect(screen.getByText('en: English 2')).toBeInTheDocument();
    expect(localStorage.getItem('hermes_lang')).toBe('en');
  });

  it('retains immediate preferred-locale initialization without deferred detection', async () => {
    localStorage.setItem('hermes_lang', 'zh-CN');
    let finishLoad;
    const renders = [];
    const runtime = makeRuntime(() => new Promise((resolve) => { finishLoad = resolve; }));
    render(<I18nProviderBase runtime={runtime}><Probe onRender={(lang) => renders.push(lang)} /></I18nProviderBase>);
    expect(renders[0]).toBe('zh-CN');
    expect(screen.getByText('zh-CN: English 2')).toBeInTheDocument();
    await act(async () => { finishLoad({ default: { landing: { text: '中文 {count}' } } }); });
    expect(screen.getByText('zh-CN: 中文 2')).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByText('English')); });
    expect(screen.getByText('en: English 2')).toBeInTheDocument();
    expect(localStorage.getItem('hermes_lang')).toBe('en');
  });
});
