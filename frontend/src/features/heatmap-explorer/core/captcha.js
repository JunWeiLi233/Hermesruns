let loading;
export async function signupCaptcha(configuration){
  if(!configuration?.recaptchaRequired)return '';
  const key=configuration.recaptchaSiteKey;
  if(!key)throw new Error('Account registration is unavailable until CAPTCHA is configured.');
  if(!loading)loading=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=`https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(key)}`;script.async=true;script.onload=resolve;script.onerror=()=>{loading=null;reject(new Error('CAPTCHA could not load. Try again.'));};document.head.append(script);});
  await loading;
  await new Promise(resolve=>window.grecaptcha.ready(resolve));
  return window.grecaptcha.execute(key,{action:'signup'});
}
