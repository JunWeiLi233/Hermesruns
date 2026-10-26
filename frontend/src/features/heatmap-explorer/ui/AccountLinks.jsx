import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from '../router.jsx';
import { useAction, useExplorer } from '../context.jsx';
import { Button, Field, Notice } from './primitives.jsx';
import { PageHeading } from './shared.jsx';

function useCapability(){const location=useLocation(),navigate=useNavigate();const [token]=useState(()=>new URLSearchParams(location.search).get('token')||'');useEffect(()=>{if(location.search)navigate(location.pathname,{replace:true});},[location.pathname,location.search,navigate]);return token;}
export function EmailLink({kind}){
  const {api,t}=useExplorer();const token=useCapability();const action=useAction();const [done,setDone]=useState(false);const unsubscribe=kind==='unsubscribe';
  async function submit(){const result=await action.run(()=>unsubscribe?api.unsubscribe(token):api.confirmReportEmail(token));if(result?.ok)setDone(true);}
  return <><PageHeading title={unsubscribe?t('Stop report email','停止报告邮件'):t('Verify report address','验证报告邮箱')}/><section className="sh-card sh-stack">
    {api.mode==='local'?<p>{t('This browser workspace does not send email.','此浏览器工作区不会发送邮件。')}</p>:done?<Notice tone="success" live>{unsubscribe?t('Report email is turned off.','报告邮件已关闭。'):t('Address verified. You can enable reports in your account settings.','邮箱已验证。可在账户设置中启用报告。')}</Notice>:<><p>{t('Confirm the action from your email link.','请确认邮件链接中的操作。')}</p><Button variant="primary" disabled={!token} busy={action.busy} onClick={submit}>{unsubscribe?t('Unsubscribe','退订'):t('Verify address','验证邮箱')}</Button>{!token&&<Notice>{t('Open the complete link from your email.','请打开邮件中的完整链接。')}</Notice>}</>}
    {action.error&&<Notice tone="danger" live>{action.error}</Notice>}<Link to="/settings">{t('Account settings','账户设置')}</Link>
  </section></>;
}
export function DeletionReceipt(){
  const {api,t}=useExplorer();const [receipt,setReceipt]=useState(null),[error,setError]=useState('');
  useEffect(()=>{let active=true,timer;async function read(){try{const result=await api.getDeletionReceipt();if(!active)return;setReceipt(result);setError('');if(result&&['queued','running','retry'].includes(result.state))timer=setTimeout(read,3000);}catch(e){if(active)setError(e.message);}}void read();return()=>{active=false;clearTimeout(timer);};},[api]);
  return <><PageHeading title={t('Account deletion receipt','账户删除回执')}/><section className="sh-card sh-stack">{receipt?<><Notice tone={receipt.state==='complete'?'success':receipt.state==='failed'?'danger':'warning'} live>{receipt.state==='complete'?t('Account and stored history have been deleted.','账户与保存的历史记录已删除。'):receipt.state==='failed'?t('Cleanup needs operator attention. Access remains revoked. Keep this receipt for support.','清理需要管理员处理。访问权限仍已撤销，请保留回执以便支持人员处理。'):t('Access is revoked. Stored data cleanup is still in progress.','访问权限已撤销，保存的数据仍在清理中。')}</Notice><p>{t('Status','状态')}: {receipt.state}</p></>:<p>{t('No deletion receipt is saved in this tab.','此标签页没有保存的删除回执。')}</p>}{error&&<Notice tone="danger" live>{error}</Notice>}<Link to="/access">{t('Account access','账户访问')}</Link></section></>;
}
export function PasswordReset(){
  const {api,t}=useExplorer();const token=useCapability();const action=useAction();const [password,setPassword]=useState(''),[done,setDone]=useState(false);
  async function submit(event){event.preventDefault();const result=await action.run(()=>api.confirmPasswordReset({token,password}));setPassword('');if(result?.ok)setDone(true);}
  return <><PageHeading title={t('Reset your account password','重设账户密码')}/><section className="sh-card sh-stack">{done?<Notice tone="success" live>{t('Password reset. Sign in with your new password.','密码已重设，请使用新密码登录。')}</Notice>:<form onSubmit={submit} className="sh-stack"><Field label={t('New password','新密码')} hint={t('Use at least 10 characters with uppercase, lowercase, a number and a symbol.','至少使用 10 个字符，包含大小写字母、数字和符号。')}>{p=><input {...p} type="password" autoComplete="new-password" required minLength={10} maxLength={512} value={password} onChange={e=>setPassword(e.target.value)}/>}</Field><Button type="submit" disabled={!token} busy={action.busy}>{t('Reset password','重设密码')}</Button></form>}{action.error&&<Notice tone="danger" live>{action.error}</Notice>}<Link to="/access">{t('Sign in','登录')}</Link></section></>;
}
