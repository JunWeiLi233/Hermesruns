import { useEffect, useState } from 'react';
import { useAction, useExplorer } from '../context.jsx';
import { Button, Checkbox, Field, Notice } from './primitives.jsx';

export default function ServerAccountControls(){
  const {api,prefs,t}=useExplorer();const [email,setEmail]=useState(prefs.reportEmail||'');const [available,setAvailable]=useState(false);const [sent,setSent]=useState(false);const action=useAction();
  const [pendingReport,setPendingReport]=useState(null),[pendingPrivacy,setPendingPrivacy]=useState(null);
  useEffect(()=>{let active=true;api.getConnections().then(result=>{if(active)setAvailable(result.capabilities.email);}).catch(()=>{});return()=>{active=false;};},[api]);
  async function verify(event){event.preventDefault();const result=await action.run(()=>api.requestReportVerification(email));if(result?.ok)setSent(true);}
  async function reportChange(enabled){setPendingReport(enabled);await action.run(()=>api.updateEmailPreferences({enabled}));setPendingReport(null);}
  async function privacyChange(hidden){setPendingPrivacy(hidden);await action.run(()=>api.updatePreferences({hideFromClubs:hidden}));setPendingPrivacy(null);}
  return <section className="sh-card sh-stack"><h2>{t('Reports & group privacy','报告与群组隐私')}</h2>
    <p>{t('A separate report address must be verified before delivery can be enabled. Monthly report generation is scheduled for R4.','启用邮件前需验证独立报告邮箱。月度报告生成计划在 R4 提供。')}</p>
    {!available&&<Notice>{t('Report email delivery is not configured on this server.','此服务器尚未配置报告邮件服务。')}</Notice>}
    <form className="sh-stack" onSubmit={verify}><Field label={t('Report email','报告邮箱')}>{p=><input {...p} type="email" required maxLength={254} disabled={!available} value={email} onChange={e=>{setEmail(e.target.value);setSent(false);}}/>}</Field><Button type="submit" disabled={!available} busy={action.busy}>{t('Send verification link','发送验证链接')}</Button></form>
    {sent&&<Notice tone="success" live>{t('Verification is queued for delivery. Open the link in your email, then enable reports here.','验证邮件已进入发送队列。请打开邮件中的链接，再在此启用报告。')}</Notice>}
    <p className="sh-small">{prefs.reportEmailVerified?t('Address verified','邮箱已验证'):t('Address not verified','邮箱尚未验证')}</p>
    <Checkbox checked={pendingReport??Boolean(prefs.reportsEnabled)} disabled={!prefs.reportEmailVerified||action.busy} onChange={e=>void reportChange(e.target.checked)}>{t('Receive reports when available','有报告时接收邮件')}</Checkbox>
    <Checkbox checked={pendingPrivacy??Boolean(prefs.hideFromClubs)} disabled={action.busy} onChange={e=>void privacyChange(e.target.checked)}>{t('Keep my history out of club maps','不向俱乐部地图提供活动记录')}</Checkbox>
    {(pendingReport!==null||pendingPrivacy!==null)&&<p role="status">{t('Saving your choice…','正在保存你的选择…')}</p>}
    {action.error&&<Notice tone="danger" live>{action.error}</Notice>}
  </section>;
}
