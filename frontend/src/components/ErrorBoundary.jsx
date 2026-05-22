import React from 'react';
import { useI18n } from '../contexts/I18nContext';

class ErrorBoundaryInner extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Hermes] Render error captured by ErrorBoundary', error, errorInfo);
  }

  render() {
    const { children, title, body, reloadLabel } = this.props;

    if (!this.state.hasError) {
      return children;
    }

    return (
      <main className="app-error-boundary" role="alert">
        <section className="app-error-boundary__panel">
          <p className="app-error-boundary__eyebrow">HERMES</p>
          <h1>{title}</h1>
          <p>{body}</p>
          <button type="button" onClick={() => window.location.reload()}>
            {reloadLabel}
          </button>
        </section>
      </main>
    );
  }
}

export default function AppErrorBoundary({ children }) {
  const { t } = useI18n();

  return (
    <ErrorBoundaryInner
      title={t('common.app_crashed_title')}
      body={t('common.app_crashed_body')}
      reloadLabel={t('common.reload')}
    >
      {children}
    </ErrorBoundaryInner>
  );
}
