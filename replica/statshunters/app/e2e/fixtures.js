import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export const test=base.extend({page:async({page},use,testInfo)=>{
  const errors=[],serverErrors=[];
  const watched=new WeakSet();const watch=tab=>{if(watched.has(tab))return;watched.add(tab);
    tab.on('pageerror',error=>errors.push(error.message));
    tab.on('console',message=>{if(message.type()==='error')errors.push(`${message.location().url} ${message.text()}`);});
    tab.on('response',response=>{if(response.status()>=500)serverErrors.push(`${response.status()} ${new URL(response.url()).pathname}`);});
  };
  watch(page);page.context().on('page',watch);
  await fixture(page.request,'reset',{activities:!testInfo.title.includes('empty workspace')});
  await use(page);
  page.context().off('page',watch);
  const expected=testInfo.annotations.filter(a=>a.type==='expected-status').map(a=>a.description);
  const unexpected=errors.filter(error=>!(error.includes('/api/')&&expected.some(status=>error.includes(`status of ${status}`)))&&!(testInfo.annotations.some(a=>a.type==='offline')&&error.includes('net::ERR_INTERNET_DISCONNECTED')));
  expect(unexpected,'Unexpected browser console errors').toEqual([]);expect(serverErrors,'No 5xx responses').toEqual([]);
}});
export {expect};
export const owner='qa.owner@example.test',other='qa.other@example.test',password=process.env.EXPLORER_E2E_PASSWORD;
export async function fixture(request,action,body={}){const response=await request.post(`/api/explorer/public/test/${action}`,{headers:{'X-Explorer-Request':'1','X-Explorer-Test-Key':process.env.EXPLORER_E2E_KEY},data:body});expect(response.ok(),`Synthetic fixture ${action}`).toBeTruthy();return response.json();}
export async function open(page,route='map'){await page.goto(`/explorer/#/${route}`);await expect(page.getByRole('main').getByRole('heading').first()).toBeVisible();}
export async function login(page,email=owner){await open(page,'access');await page.getByLabel('Email address',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Places become familiar.'})).toBeVisible();}
export async function screen(page,testInfo,name){
  await expect(page.getByRole('main')).toBeVisible();
  const accessibility=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  await testInfo.attach(`${name}-axe`,{body:JSON.stringify(accessibility.violations,null,2),contentType:'application/json'});
  await page.screenshot({path:testInfo.outputPath(`${name}.png`),fullPage:true});
  expect(accessibility.violations.map(v=>({id:v.id,impact:v.impact,help:v.help,nodes:v.nodes.map(n=>n.target)})),`${name} accessibility`).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${name} has no horizontal page overflow`).toBeTruthy();
}
export async function staged(page,testInfo,route){await login(page);await open(page,route);await expect(page.getByText('This part of your workspace is scheduled for a later release.',{exact:false})).toBeVisible();await screen(page,testInfo,route);}
