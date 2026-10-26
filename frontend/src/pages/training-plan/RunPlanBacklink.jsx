import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { planRequest } from './planApi';
import { planWorkoutUrl } from './TrainingPlan';

export default function RunPlanBacklink({ activityId }) {
  const { token }=useAuth();const {t}=useI18n();const [link,setLink]=useState(null);
  useEffect(()=>{
    const control=new AbortController();
    function load(){planRequest(`/api/run-plans/activity-links/${activityId}`,{signal:control.signal}).then(result=>{if(!control.signal.aborted)setLink(result.link);}).catch(()=>{if(!control.signal.aborted)setLink(null);});}
    load();window.addEventListener('hermes-plan-changed',load);
    return()=>{control.abort();window.removeEventListener('hermes-plan-changed',load);};
  },[activityId,token]);
  return link?<section className="run-detail-v2__card"><h2>{t('training_plan.backlink')}</h2><Link to={planWorkoutUrl(link.planId,link.workoutId)}>{link.localDate} · {t(`training_plan.${link.state}`)}</Link></section>:null;
}
