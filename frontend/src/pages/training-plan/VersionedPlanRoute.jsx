import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import useRecommendationRevision from '../../hooks/useRecommendationRevision';
import PageSkeleton from '../../components/PageSkeleton';
import { planRead, preparePlanOfflineShell } from '../../utils/trainingPlanCache';
import { planRequest, localDate } from './planApi';

const empty = { loading:false, data:null, root:null, error:null, selected:false, allowLegacy:true, reload:()=>{} };
const PlanSelection = createContext(empty);
export const useVersionedPlan = () => useContext(PlanSelection);

/** Select prescription data before mounting legacy coaching effects; keep the native page. */
export default function VersionedPlanRoute({ children, variant }) {
  const recommendationRevision = useRecommendationRevision();
  const { token, email } = useAuth();
  const identity = `${token}:${email}`;
  const [attempt,setAttempt] = useState(0);
  const [state,setState] = useState({ identity:null,loading:true });
  const reload = useCallback(()=>setAttempt(n=>n+1),[]);
  useEffect(()=>{
    if(!token){setState({...empty,identity});return;}
    setState(previous=>previous.identity===identity?{...previous,refreshing:true}:previous);
    const control = new AbortController();
    async function refresh(){
      try {
        // Renew the server-authorized offline window before the cached Today read.
        const root=await planRead('/api/run-plans',token,()=>planRequest('/api/run-plans',{signal:control.signal}));
        const data=await planRead('/api/run-plans/today',token,()=>planRequest('/api/run-plans/today',{signal:control.signal}));
        if(!control.signal.aborted)setState({identity,loading:false,root,data,error:null});
      }catch(error){if(!control.signal.aborted)setState({identity,loading:false,root:null,data:null,error});}
    }
    refresh();window.addEventListener('hermes-plan-changed',reload);
    return()=>{control.abort();window.removeEventListener('hermes-plan-changed',reload);};
  },[identity,token,attempt,reload,recommendationRevision]);
  const current=state.identity===identity?state:{loading:true};
  useEffect(()=>{
    if(!current.data?.plan?.inputs?.timeZone)return;
    preparePlanOfflineShell();
    const refreshDay=()=>{if(localDate(current.data.plan.inputs.timeZone)!==current.data.localDate)reload();};
    const timer=window.setInterval(refreshDay,60000);window.addEventListener('focus',refreshDay);
    return()=>{window.clearInterval(timer);window.removeEventListener('focus',refreshDay);};
  },[current.data,reload]);
  if(current.loading)return <PageSkeleton variant={variant}/>;
  return <PlanSelection.Provider key={identity} value={{...current,selected:Boolean(current.data?.plan),allowLegacy:!current.error&&!current.data?.plan,reload}}>{children}</PlanSelection.Provider>;
}
