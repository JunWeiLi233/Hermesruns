import { useMemo } from 'react';
import Explorer from '../../features/heatmap-explorer/App.jsx';
import { createHttpApi } from '../../features/heatmap-explorer/core/http-api.js';
import { ExplorerRoutesProvider } from '../../features/heatmap-explorer/router.jsx';
import { useI18n } from '../../contexts/I18nContext';
import { useTheme } from '../../contexts/ThemeContext';
import '../../features/heatmap-explorer/ui/tokens.css';
import '../../features/heatmap-explorer/ui/base.css';
import '../../features/heatmap-explorer/ui/app.css';
import './heatmap-workspace.css';

/** Capability links must work after sign-out and must not pick a cookie owner. */
export default function HeatmapPublicPage() {
  const { lang, t } = useI18n();
  const { isDark } = useTheme();
  const client = useMemo(() => createHttpApi({pollMs: 0, fetcher: (url, options) => fetch(url, {...options, credentials: 'omit'})}), []);
  return <main className="hermes-heatmap-workspace"><div className="heatmap-native-switch"><a href="/heatmap">{t('profile.dashboard_nav_heatmap')}</a></div><ExplorerRoutesProvider basePath="/heatmap"><Explorer embedded service={client} presentation={{language: lang, theme: isDark ? 'dark' : 'light'}}/></ExplorerRoutesProvider></main>;
}
