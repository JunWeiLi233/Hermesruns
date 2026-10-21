import { createContext, useContext, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { createLocalClient } from '../data/local.mjs';
import { createHttpClient } from '../data/http.mjs';
const Context = createContext(null),
  client = import.meta.env.VITE_TRAINING_MODE === 'server' || new URLSearchParams(window.location.search).get('backend') === '1' ? createHttpClient() : createLocalClient();
export function WorkspaceProvider({
  children
}) {
  const [version, setVersion] = useState(0),
    [athleteId, setAthlete] = useState(client.getActor()),
    [theme, setTheme] = useState('light');
  useEffect(() => client.subscribe(() => setVersion(v => v + 1)), []);
  useEffect(() => {
    if(client.mode !== 'http') return;
    client.getMe().then(me=>{setAthlete(me.id);setVersion(v=>v+1);}).catch(()=>{});
    const refresh=()=>{if(document.visibilityState==='visible')client.refresh();};
    const interval=setInterval(refresh,30000);
    const visible=()=>{if(document.visibilityState==='visible')refresh();};
    document.addEventListener('visibilitychange',visible);
    return()=>{clearInterval(interval);document.removeEventListener('visibilitychange',visible);};
  },[]);
  const actor = client.getActor();
  return <Context.Provider value={{
    api: client,
    actor,
    athleteId,
    version,
    setAthlete,
    theme,
    setTheme,
    switchActor: id => {
      if(client.mode === 'local') client.setActor(id);
      else if(id!==client.getActor())throw Error('Sign in before changing identity.');
      setAthlete(id);
    }
  }}>{children}</Context.Provider>;
}
export const useWorkspace = () => useContext(Context);
export function useCanWrite() {
  const {
      athleteId
    } = useWorkspace(),
    q = useResource('getRoster');
  return !!q.data?.items.some(a => a.id === athleteId && ['owner', 'coach'].includes(a.access));
}
export function useResource(method, payload = {}) {
  const {
      api,
      actor,
      version
    } = useWorkspace(),
    serialized = JSON.stringify(payload),
    scope = `${actor}:${api.getSecurityKey()}:${method}:${serialized}`,
    key = `${version}:${scope}`;
  const [result, set] = useState({
    key: '',
    loading: true
  });
  useEffect(() => {
    let active = true;
    set(old => old.scope === scope && old.data ? {
      ...old,
      key,
      refreshing: true
    } : {
      key,
      scope,
      loading: true
    });
    api[method](JSON.parse(serialized)).then(data => active && set({
      key,
      scope,
      data
    })).catch(error => active && set({
      key,
      scope,
      error
    }));
    return () => {
      active = false;
    };
  }, [api, method, key, scope, serialized]);
  return result.key === key ? result : result.scope === scope && result.data ? {
    ...result,
    refreshing: true
  } : {
    loading: true
  };
}
export function useCommand() {
  const {
      actor
    } = useWorkspace(),
    [s, set] = useState({});
  async function run(fn, message = 'Saved in this local workspace.') {
    set({
      busy: true,
      actor
    });
    try {
      const value = await fn();
      set({
        actor,
        message
      });
      return value;
    } catch (error) {
      set({
        actor,
        error: error.message
      });
      return null;
    }
  }
  return {
    ...(s.actor === actor ? s : {}),
    run
  };
}
export function useActivity() {
  const {
      athleteId
    } = useWorkspace(),
    [p] = useSearchParams(),
    list = useResource('getActivities', {
      athleteId
    }),
    id = p.get('id') || list.data?.items[0]?.id,
    detail = useResource(id ? 'getActivity' : 'getActivities', id ? {
      activityId: id
    } : {
      athleteId
    });
  return {
    list,
    detail,
    id,
    activity: id ? detail.data : null
  };
}
