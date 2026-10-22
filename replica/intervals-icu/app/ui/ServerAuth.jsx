import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useCommand, useWorkspace } from './workspace.jsx';
import { Button, Feedback, Notice, Panel, TextField } from './components.jsx';
export function ServerAuth({signup=false}){
  const {api,switchActor}=useWorkspace(),navigate=useNavigate(),c=useCommand();
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[recovery,setRecovery]=useState(false);
  return <Panel title={recovery?'Recover your Hermes account':signup?'Create a Hermes account':'Sign in to Hermes'}>
    <Notice>Server mode uses the existing Hermes identity authority. Sessions use an HttpOnly cookie. Sample accounts and browser data are separate.</Notice>
    <form onSubmit={e=>{e.preventDefault();c.run(async()=>{
      if(recovery){await api.requestPasswordReset({email});return;}
      if(signup){await api.signup({email,password});setPassword('');return;}
      const result=await api.login({email,password});setPassword('');switchActor(result.user.id);navigate('/calendar');
    },recovery?'If this account can recover, instructions will arrive by email.':signup?'Check your inbox for verification before signing in.':'Signed in.');}}>
      <TextField label="Email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/>
      {!recovery&&<TextField label="Password" type="password" autoComplete={signup?'new-password':'current-password'} required value={password} onChange={e=>setPassword(e.target.value)}/>}
      <Button type="submit" variant="primary" busy={c.busy}>{recovery?'Send recovery instructions':signup?'Create account':'Sign in'}</Button>
    </form><Feedback command={c}/>
    {!signup&&<Button onClick={()=>setRecovery(!recovery)}>{recovery?'Return to sign in':'Forgot password'}</Button>}
    <Link to={signup?'/login':'/signup'}>{signup?'Already have an account? Sign in':'Create an account'}</Link>
    {signup&&<p className="tw-muted">Verified transactional mail and any required CAPTCHA must be configured on your backend. This form does not bypass those checks.</p>}
  </Panel>;
}
