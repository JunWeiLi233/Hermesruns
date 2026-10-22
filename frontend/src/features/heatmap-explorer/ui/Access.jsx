import { useEffect, useRef, useState } from 'react';
import { signupCaptcha } from '../core/captcha.js';
import { useNavigate } from '../router.jsx';
import { useAction, useExplorer } from '../context.jsx';
import { Button, Checkbox, Field, Notice, Segmented } from './primitives.jsx';
import { PageHeading } from './shared.jsx';

export default function Access() {
  const {api,t}=useExplorer();const navigate=useNavigate();const action=useAction();
  const [configuration,setConfiguration]=useState(null);
  useEffect(()=>{if(api.mode==='server')api.getAccountConfiguration().then(setConfiguration).catch(()=>{});},[api]);
  const [mode,setMode]=useState('login');const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [persistent,setPersistent]=useState(false);const [errors,setErrors]=useState({});const [accepted,setAccepted]=useState(false);const form=useRef(null);
  function changeMode(value){setMode(value);setPassword('');setErrors({});setAccepted(false);action.setError('');}
  async function submit(event){
    event.preventDefault();setAccepted(false);const next={};
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))next.email=t('Enter a complete email address.','请输入完整的电子邮箱地址。');
    if(['login','signup'].includes(mode)&&!password)next.password=t('Enter your account password.','请输入账户密码。');
    setErrors(next);if(Object.keys(next).length){requestAnimationFrame(()=>form.current?.querySelector('[aria-invalid="true"]')?.focus());return;}
    const result=await action.run(async()=>mode==='login'?api.login({email:email.trim(),password,persistent}):mode==='signup'?api.signup({email:email.trim(),password,captchaToken:await signupCaptcha(configuration)}):mode==='resend'?api.resendVerification({email:email.trim()}):api.requestPasswordReset({email:email.trim()}));
    setPassword('');
    if(result?.ok){if(mode==='login')navigate('/map');else setAccepted(true);}
  }
  return <><PageHeading eyebrow={t('YOUR HERMES ACCOUNT','你的 HERMES 账户')} title={t('Account access','账户访问')} description={t('Sign in or request help with an existing account.','登录或申请恢复现有账户。')}/><section className="sh-card sh-stack ex-access">
    {api.mode==='local'&&<Notice>{t('Account services are not connected in this local build. These forms validate input, but cannot sign in, send email or link identities yet. Open the local workspace to try file imports.','此本地版本尚未接入账户服务。表单可校验输入，但暂时无法登录、发送邮件或关联身份。可打开本地工作区试用文件导入。')}</Notice>}
    <Segmented label={t('Account action','账户操作')} value={mode} onChange={changeMode} options={[{value:'login',label:t('Sign in','登录')},{value:'recovery',label:t('Recover access','恢复访问')},...(api.mode==='server'?[{value:'signup',label:t('Create account','注册账户')},{value:'resend',label:t('Verify email','验证邮箱')}]:[])]}/>
    <form ref={form} className="sh-stack" onSubmit={submit} noValidate>
      <Field label={t('Email address','电子邮箱')} error={errors.email}>{p=><input {...p} type="email" autoComplete="username" maxLength={320} value={email} onChange={e=>setEmail(e.target.value)}/>}</Field>
      {['login','signup'].includes(mode)?<><Field label={t('Password','密码')} error={errors.password}>{p=><input {...p} type="password" autoComplete={mode==='signup'?'new-password':'current-password'} maxLength={512} value={password} onChange={e=>setPassword(e.target.value)}/>}</Field>{mode==='login'?<Checkbox checked={persistent} onChange={e=>setPersistent(e.target.checked)}>{t('Keep me signed in on this device','在此设备保持登录')}</Checkbox>:<p className="sh-small sh-muted">{t('Use at least 10 characters with uppercase, lowercase, a number and a symbol. Verify your email before signing in. CAPTCHA, when configured, sends a registration risk check to Google.','至少使用 10 个字符，包含大小写字母、数字和符号。登录前需验证邮箱。配置验证码时会向 Google 发送注册风险校验。')}</p>}</>:<p className="sh-muted">{t('A confirmed request gives the same response whether or not the address belongs to an account. Linking an existing identity requires the authenticated account flow.','已确认的请求会对所有邮箱返回相同结果，不透露账户是否存在。关联现有身份需要先完成账户认证。')}</p>}
      {action.error&&<Notice tone="danger" live>{action.error}</Notice>}
      {accepted&&<Notice tone="success" live>{mode==='signup'||mode==='resend'?t('Check your email for a verification link before signing in.','登录前请查看邮箱中的验证链接。'):t('If this address is eligible, account recovery instructions will be sent.','如果此邮箱符合条件，系统将发送账户恢复说明。')}</Notice>}
      <Button variant="primary" type="submit" busy={action.busy}>{mode==='login'?t('Sign in','登录'):mode==='signup'?t('Create account','注册账户'):mode==='resend'?t('Send verification link','发送验证链接'):t('Request recovery instructions','申请恢复说明')}</Button>
    </form>
    {api.mode==='local'&&<Button onClick={async()=>{const result=await action.run(()=>api.openWorkspace());if(result?.ok)navigate('/map');}} busy={action.busy}>{t('Open local workspace','打开本地工作区')}</Button>}
    <p className="sh-small sh-muted">{api.mode==='local'?t('New-account registration, verification, CAPTCHA and conflict-safe account linking will reuse the existing Hermes account service.','新账户注册、验证、验证码与冲突安全的身份关联将复用现有 Hermes 账户服务。'):t('Sessions use a private browser cookie. Signing out revokes access on every device. Provider linking is unavailable.','会话使用私密浏览器 Cookie。退出登录会撤销所有设备上的访问。暂不支持关联外部服务。')}</p>
  </section></>;
}
