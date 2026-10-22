import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { apiFetch } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useUnit } from '../../contexts/UnitContext';
import AuthenticatedPageChrome from '../../components/AuthenticatedPageChrome';
import PageSkeleton from '../../components/PageSkeleton';
import Explorer from '../../features/heatmap-explorer/App.jsx';
import { createNativeExplorerApi } from './nativeExplorerApi.js';
import { ExplorerRoutesProvider } from '../../features/heatmap-explorer/router.jsx';
import RecordedHeatmap from './Heatmap.jsx';
import WorkoutHeatmap from './WorkoutHeatmap.jsx';
import HeatmapDatasetSync from './HeatmapDatasetSync.jsx';
import '../../features/heatmap-explorer/ui/tokens.css';
import '../../features/heatmap-explorer/ui/base.css';
import '../../features/heatmap-explorer/ui/app.css';
import './heatmap-workspace.css';

export default function HeatmapPage() {
  return <HeatmapWorkspacePage/>;
}

function HeatmapWorkspacePage() {
  const { token, email, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { isDark, setTheme } = useTheme();
  const { unit, setUnit } = useUnit();
  const location = useLocation();
  const recorded = /^\/heatmap(?:\/recorded)?\/?$/.test(location.pathname);
  const [attempt, setAttempt] = useState(0);
  const [capability, setCapability] = useState({});
  const client=useMemo(()=>createNativeExplorerApi({token,email,fetcher:apiFetch}),[token,email]);
  useLayoutEffect(()=>{client.configure({logout,setUnit,setLang,setTheme,unit});},[client,logout,setUnit,setLang,setTheme,unit]);
  useEffect(() => () => client.retire(), [client]);
  useEffect(() => {
    const controller = new AbortController();
    setCapability({});
    apiFetch('/api/profile/heatmap/explorer', {signal: controller.signal}).then(async response => {
      if (response.status === 401) { client.expire(); return; }
      if (response.status === 404) return {available: false};
      if (!response.ok) throw new Error('heatmap-workspace-unavailable');
      return response.json();
    }).then(value => {if (!controller.signal.aborted && value) setCapability(value);})
      .catch(error => {if (!controller.signal.aborted && error.name !== 'AbortError') setCapability({error: true});});
    return () => controller.abort();
  }, [recorded, attempt, token, client]);

  const tr = key => t(`heatmapExplorer.${key}`);
  if (capability.available === false) return <>
    <RecordedHeatmap/>
    <aside className="heatmap-workspace-switch" aria-label={tr('workspace')}>
      <span>{tr('workspaceUnavailable')}</span><button onClick={() => setAttempt(value => value + 1)}>{tr('retry')}</button>
    </aside>
  </>;
  if (!capability.available && !capability.error) return <PageSkeleton variant="heatmap"/>;
  if (recorded && capability.available) return <WorkoutHeatmap key={token}/>;
  return <AuthenticatedPageChrome key={token} activeKey="heatmap" title={t('profile.dashboard_nav_heatmap')} bodyClassName="heatmap-native-page">
    <div className="heatmap-native-switch"><Link to="/heatmap/recorded">{tr('recordedMap')}</Link></div>
    {capability.error ? <section role="alert" className="heatmap-native-error"><p>{tr('workspaceError')}</p><button onClick={() => setAttempt(value => value + 1)}>{tr('retry')}</button></section> :
      <ExplorerRoutesProvider basePath="/heatmap"><div className="hermes-heatmap-workspace"><Explorer key={token} service={client} embedded presentation={{language: lang, theme: isDark ? 'dark' : 'light', units: unit === 'mile' ? 'mi' : 'km'}}><HeatmapDatasetSync email={email}/></Explorer></div></ExplorerRoutesProvider>}
  </AuthenticatedPageChrome>;
}
