import React from 'react';
import HermesLogo from '../HermesLogo';
import HermesMarkSvg from '../HermesMarkSvg';
import { translateLoadingText } from '../../i18n/loadingCopy';

// Layout catalog ported from the downloaded Loading States Redesign reference.
// The viewport flag belongs to each factory, so page and dialog layouts cannot interfere.
export function createLoadingDesign({ mobile = false, t }) {
const M = mobile;
const paint = {
 '#fff':'var(--hr-surface)', '#ffffff':'var(--hr-surface)', '#fafafa':'var(--hr-surface-2)',
 '#f2f2f7':'var(--hr-canvas)', '#f7f7fa':'var(--hr-surface-2)',
 'rgba(255,255,255,.72)':'var(--hr-surface)', 'rgba(255,255,255,.94)':'var(--hr-surface)',
 'rgba(242,242,247,.88)':'var(--hr-canvas)', 'rgba(242,242,247,.92)':'var(--hr-canvas)',
};
let elementKey = 0;
const h = (type, props, ...children) => {
 const next = {...props};
 if(next.style) next.style=Object.fromEntries(Object.entries(next.style).map(([key,value])=>[key,paint[value]||value]));
 const translateChild = child => Array.isArray(child) ? child.map(translateChild) : typeof child==='string' ? translateLoadingText(t,child) : child;
 // Every primitive receives a deterministic key because the catalog composes arrays.
 if(next.key == null) next.key = 'loading-'+elementKey++;
 return React.createElement(type,next,...children.map(translateChild));
};
const IC={home:'<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="4.5" rx="1.5"/><rect x="13.5" y="11.5" width="7" height="9" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/>',analysis:'<path d="M4 18 9 12l3 3 7-9"/><path d="M18 6h2v2"/><path d="M4 20h16"/>',runs:'<path d="M12 7v5l3 2"/><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 5v4h4"/>',heatmap:'<path d="M12 20s5.5-5 5.5-9a5.5 5.5 0 1 0-11 0c0 4 5.5 9 5.5 9Z"/><circle cx="12" cy="11" r="2"/>',weather:'<circle cx="16.2" cy="7.2" r="2.6"/><path d="M7.5 18.2h8.7a3.4 3.4 0 0 0 .2-6.8 5 5 0 0 0-9.6-1.1 3.7 3.7 0 0 0 .7 7.9Z"/>',shoes:'<path d="M2.2 15.2h4.5c1.8 0 3.5.9 5.3.9h9.9"/><path d="M3 8.2 4 14v2c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-.8c0-1.2-.8-2.1-1.9-2.4l-1.7-.4c-1-.2-2-.7-2.8-1.4L11 7.5 9.2 9.1c-1.2 1-2.9.9-4-.2Z"/>',races:'<path d="M6 20V5"/><path d="M6 5h10l-2 3 2 3H6"/>',schedule:'<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M8 3.5v4M16 3.5v4M4 9.5h16"/>',muscle:'<path d="M6 8v8M18 8v8M3.5 10v4M20.5 10v4M6 12h12"/>',more:'<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',bell:'<path d="M8 17h8"/><path d="M10 20h4"/><path d="M7 17V11a5 5 0 1 1 10 0v6l1.5 1.5H5.5Z"/>',gear:'<circle cx="12" cy="12" r="2.8"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a7.4 7.4 0 0 0-2-.9l-.4-2.6h-4l-.4 2.6a7.4 7.4 0 0 0-2 .9l-2.4-1-2 3.5 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.5 2.4-1a7.4 7.4 0 0 0 2 .9l.4 2.6h4l.4-2.6a7.4 7.4 0 0 0 2-.9l2.4 1 2-3.5-2-1.5c.1-.4.1-.8.1-1.2Z"/>',close:'<path d="M6 6l12 12M18 6 6 18"/>',search:'<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',upload:'<path d="M12 15V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/>',link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',back:'<path d="M15 6l-6 6 6 6"/>'};
const SEQ=[.42,.66,.5,.78,.58,.86,.62,.72,.47,.9,.68,.75,.55,.8];
const rnd=(i,a,b)=>Math.round(a+(((i*7+3)%10)/9)*(b-a));
const rep=(n,f)=>Array.from({length:n},(_,i)=>f(i));
const sk=(st,tone)=>h('span',{className:'hr-sk'+(tone?' hr-sk--'+tone:''),'aria-hidden':'true',style:Object.assign({display:'block',flex:'none',borderRadius:6,maxWidth:'100%'},st)});
const L=(w,ht,tone)=>sk({width:w,height:ht||10,borderRadius:5},tone);
const Ey=w=>L(w||84,9);
const Ttl=(w,ht,tone)=>sk({width:w,height:ht||20,borderRadius:8},tone);
const Num=(w,ht,tone)=>sk({width:w,height:ht||28,borderRadius:8},tone);
const Pill=(w,ht,tone)=>sk({width:w,height:ht||36,borderRadius:999},tone);
const Circ=(d,tone)=>sk({width:d,height:d,borderRadius:'50%'},tone);
const Box=(ht,st,tone)=>sk(Object.assign({width:'100%',height:ht,borderRadius:14},st),tone);
const Col=(gap,kids,st)=>h('div',{style:Object.assign({display:'flex',flexDirection:'column',gap,minWidth:0},st)},...kids);
const Row=(gap,kids,st)=>h('div',{style:Object.assign({display:'flex',alignItems:'center',gap,minWidth:0},st)},...kids);
const Grid=(c,gap,kids,st)=>h('div',{style:Object.assign({display:'grid',gridTemplateColumns:c,gap,minWidth:0},st)},...kids);
const cols=(d,m)=>M?(m||'minmax(0,1fr)'):d;
const sp=()=>h('span',{style:{flex:1}});
const Card=(kids,st)=>h('div',{style:Object.assign({background:'var(--hr-surface)',borderRadius:20,padding:M?18:'24px 26px',display:'flex',flexDirection:'column',gap:16,minWidth:0},st)},...kids);
const Lbl=t=>h('span',{style:{fontSize:12,fontWeight:700,letterSpacing:'.06em',textTransform:'uppercase',color:'var(--hr-muted)'}},t);
const H1=()=>({margin:0,font:`italic 800 ${M?28:36}px/1.08 Manrope,sans-serif`,letterSpacing:'-0.035em',color:'var(--hr-ink)',textWrap:'pretty'});
const Icon=(k,sz)=>h('svg',{width:sz||20,height:sz||20,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round',style:{flex:'none'},'aria-hidden':'true',dangerouslySetInnerHTML:{__html:IC[k]}});
const IconBtn=k=>h('span',{style:{width:36,height:36,borderRadius:999,display:'grid',placeItems:'center',color:'var(--hr-muted)'}},Icon(k,18));
const Dot=()=>h('span',{className:'hr-dot',style:{width:8,height:8,borderRadius:'50%',background:'var(--hr-accent)',flex:'none'}});
const Spinner=()=>h('span',{className:'hr-spin',style:{width:14,height:14,borderRadius:'50%',border:'2px solid rgba(28,25,23,.12)',borderTopColor:'var(--hr-muted)',flex:'none'}});
const Field=lab=>h('div',{className:'loading-design__field'},Col(8,[typeof lab==='string'?h('span',{style:{fontSize:12.5,fontWeight:700,color:'var(--hr-muted)'}},lab):L(lab||72,9),sk({width:'100%',height:44,borderRadius:12})]));
const Seg=(labels,a,onCanvas)=>h('div',{style:{display:'flex',gap:2,padding:4,borderRadius:999,background:onCanvas?'#fff':'#f2f2f7',alignSelf:'flex-start',maxWidth:'100%',overflowX:'auto'}},...labels.map((l,i)=>h('span',{key:l,style:{flex:'none',height:32,padding:'0 13px',borderRadius:999,display:'flex',alignItems:'center',fontSize:13,fontWeight:700,whiteSpace:'nowrap',background:i===a?(onCanvas?'#f2f2f7':'#fff'):'transparent',color:i===a?'var(--hr-ink)':'var(--hr-muted)',boxShadow:i===a&&!onCanvas?'0 1px 2px rgba(28,25,23,.08)':'none'}},l)));
const CardHead=(o={})=>Row(12,[Col(8,[Ey(o.e||80),Ttl(o.w||180,o.th||20)].concat(o.sub?[L(o.sub,10)]:[]),{flex:1}),o.act?Pill(o.act,32):null],{alignItems:'flex-start'});
const Stat=(i,big)=>Col(8,[L(rnd(i,56,84),9),Num(rnd(i,72,110),big||28),L(rnd(i+3,70,120),9)]);
const StatCard=i=>Card([Stat(i)],{gap:0,padding:M?16:'20px 22px'});
const Bars=(n,ht,tone)=>Col(8,[h('div',{style:{height:ht,display:'flex',alignItems:'flex-end',gap:M?4:6,borderBottom:'1px solid var(--hr-line)'}},...rep(n,i=>sk({flex:1,height:Math.round(SEQ[i%SEQ.length]*100)+'%',borderRadius:'4px 4px 0 0'},tone))),h('div',{style:{display:'flex',gap:M?4:6}},...rep(n,()=>h('span',{style:{flex:1,display:'flex',justifyContent:'center'}},L(M?14:20,8))))]);
const Lead=(o)=>o.lead==='circ'?Circ(o.ls||36):o.lead==='date'?Col(5,[L(26,8),Num(26,18)],{width:40,alignItems:'center',flex:'none'}):o.lead==='thumb'?sk({width:o.ls||48,height:o.ls||48,borderRadius:12}):o.lead==='check'?sk({width:20,height:20,borderRadius:6}):o.lead===false?null:sk({width:36,height:36,borderRadius:10});
const ListRows=(n,o={})=>Col(0,rep(n,i=>Row(14,[Lead(o),Col(8,[L(rnd(i,140,220),11),L(rnd(i+5,90,150),9)],{flex:1}),...(o.cols&&!M?rep(o.cols,j=>Col(6,[L(rnd(i+j,40,56),11),L(32,8)],{width:76,alignItems:'flex-end'})):[]),o.trail===false?null:(o.pillTrail?Pill(rnd(i,56,76),24):L(rnd(i,44,64),11))],{minHeight:o.h||64,borderTop:i||o.first?'1px solid var(--hr-line)':'none'})));
const ToggleRows=n=>Col(0,rep(n,i=>Row(16,[Col(8,[L(rnd(i,120,180),11),L(rnd(i+4,160,260),9)],{flex:1}),sk({width:44,height:26,borderRadius:999})],{minHeight:68,borderTop:i?'1px solid var(--hr-line)':'none'})));
const PageHead=(o={})=>h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:M?'stretch':'flex-end',gap:16,flexDirection:M?'column':'row'}},Col(10,[o.title?h('h1',{style:H1()},o.title):Ttl(M?'82%':o.tw||460,M?30:38,'canvas'),o.sub===false?null:L(M?'70%':o.sw||360,11,'canvas')]),o.act?Row(8,rep(o.act,i=>Pill(i?118:136,38,'canvas')),{flexWrap:'wrap'}):null);
const Table=(n,c)=>M?Card([Pill('100%',40),ListRows(Math.min(n,7),{lead:'circ',ls:32,pillTrail:true,first:true})]):Card([Row(10,[Pill(260,40),...rep(3,i=>Pill(rnd(i,84,110),36)),sp(),Pill(110,36)]),Col(0,[Row(16,rep(c,j=>h('div',{style:{flex:j===0?2:1}},L(rnd(j,48,80),8))),{height:40,borderBottom:'1px solid var(--hr-line)'}),...rep(n,i=>Row(16,rep(c,j=>h('div',{style:{flex:j===0?2:1,display:'flex',alignItems:'center',gap:10,minWidth:0}},j===0?Circ(28):null,j===c-1?Pill(rnd(i,56,76),22):L(rnd(i+j,50,120),10))),{height:56,borderBottom:'1px solid var(--hr-line)'}))]),Row(10,[L(120,9),sp(),Pill(90,32)])],{padding:'20px 24px'});
const Thumbcard=()=>Row(12,[sk({width:56,height:56,borderRadius:12}),Col(8,[L(130,11),L(80,9)])]);
const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const Dz=(ht,kids,st)=>h('div',{style:Object.assign({height:ht,border:'1.5px dashed rgba(28,25,23,.14)',borderRadius:16,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12,padding:16,textAlign:'center'},st)},...kids);

const NAV=[['home','Home'],['analysis','Analysis'],['runs','Runs'],['heatmap','Heatmap'],['weather','Weather Engine'],['shoes','Shoes'],['races','Races'],['schedule','Schedule'],['muscle','Muscle training']];
const SET=['Profile','Preferences','Training','Connections','Notifications','Activity','Account'];
const ADM=[['overview','Overview'],['users','Users'],['courseMaps','Course maps'],['shoes','Shoes'],['jobs','Jobs'],['audit','Audit log'],['settings','Settings']];
const routes={home:'/profile',analysis:'/analysis',runs:'/runs',heatmap:'/heatmap',weather:'/weather',shoes:'/shoes',races:'/races',schedule:'/schedule',muscle:'/muscle-training'};
const adminRoute=k=>'/dashboard'+(k==='overview'?'':'/'+(k==='courseMaps'?'course-maps':k));
const link=(href,label,on,icon,extra={})=>h('a',{href,'aria-current':on?'page':undefined,...extra},icon?Icon(icon):null,label);
function AppNavigation(v){return h('nav',{'aria-label':t('loading.nav.primary'),className:'loading-design__navigation'},...NAV.map(([k,l])=>link(routes[k],l,k===v.nav,k,{key:k,title:translateLoadingText(t,l)})));}
function TabBar(v){return h('nav',{'aria-label':t('loading.nav.primary'),className:'loading-design__tabs'},
 link('/profile',t('common.mobile_home'),v.id==='profile'||v.id==='runner-fallback','home'),
 link('/today-run',t('common.mobile_today'),v.id==='today-run','schedule'),
 link('/runs',t('common.mobile_runs'),v.nav==='runs','runs'),
 h('details',{className:'loading-design__more'},h('summary',null,Icon('more'),t('common.mobile_pages')),h('div',{className:'loading-design__destinations'},...NAV.map(([k,l])=>link(routes[k],l,k===v.nav,k,{key:k})),link('/settings','Settings',v.shell==='settings','gear'))));}
function AppShell(v,content,H){
 const main=h('main',{className:'loading-design__main'},...content);
 const header=h('header',{className:'loading-design__topbar'},h('strong',null,v.head),Row(8,[link('/settings',t('settings.heading'),false,'gear',{'aria-label':t('settings.heading')}),Circ(34,'canvas')]));
 if(M)return h('div',{className:'loading-design__app loading-design__app--mobile',style:{minHeight:H}},header,main,TabBar(v));
 return h('div',{className:'loading-design__app',style:{minHeight:H}},h('aside',{className:'loading-design__rail'},h('a',{href:'/profile','aria-label':'HermesRuns',className:'loading-design__mark'},h(HermesMarkSvg,{tone:'auto'})),AppNavigation(v),link('/today-run',"Start today's workout",false,'schedule',{className:'loading-design__workout',title:translateLoadingText(t,"Start today's workout")})),h('div',{style:{flex:1,minWidth:0}},header,main));
}
function SettingsBody(active,content){
 const nav=h('nav',{'aria-label':translateLoadingText(t,'Settings'),className:'loading-design__settings-nav'},...SET.map(s=>link('/settings?section='+s.toLowerCase(),s,s===active,null,{key:s})));
 const head=Col(8,[h('h1',{style:H1()},active),L(M?'70%':320,11,'canvas')]);
 return [h('div',{className:'loading-design__settings','data-settings-section':active.toLowerCase()},h('div',{className:'loading-design__settings-rail'},Row(12,[Circ(44,'canvas'),Col(8,[L(110,11,'canvas'),L(150,9,'canvas')])]),nav),Col(20,[head,...content],{flex:1}))];
}
function AdminShell(v,content,H){
 const label=ADM.find(a=>a[0]===v.admin)[1];
 const nav=h('nav',{'aria-label':translateLoadingText(t,'Admin console'),className:'loading-design__admin-nav'},...ADM.map(([k,l])=>link(adminRoute(k),l,k===v.admin,null,{key:k})));
 const brand=h(HermesLogo,{});
 return h('div',{className:'loading-design__admin',style:{minHeight:H}},M?h('header',null,brand,nav):h('aside',null,brand,h('span',null,'Admin console'),nav,link('/profile','Back to app',false)),h('main',null,Col(8,[h('h1',{style:H1()},label),L(M?'70%':340,11,'canvas')]),...content));
}
function PublicShell(v,content,H){
 return h('div',{style:{minHeight:H,background:'var(--hr-canvas)',display:'flex',flexDirection:'column'}},
  h('header',{style:{height:M?60:76,padding:M?'0 16px':'0 48px',display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%',maxWidth:1296,margin:'0 auto'}},h(HermesLogo,{}),M?Pill(88,36,'canvas'):Row(28,[...rep(3,i=>L(rnd(i,56,76),10,'canvas')),Pill(110,40,'canvas')])),
  h('main',{style:{flex:1,width:'100%',maxWidth:1296,margin:'0 auto',padding:M?'0 16px 32px':'0 48px 56px',display:'flex',flexDirection:'column',gap:M?32:56}},...content),
  h('footer',{style:{padding:M?'24px 16px 32px':'32px 48px 40px',display:'flex',gap:M?16:28,justifyContent:'center',flexWrap:'wrap'}},...rep(4,i=>L(rnd(i,48,72),9,'canvas'))));
}
function AuthShell(fields,H,cta){
 const form=Col(M?18:20,[Col(10,[Ttl(M?'72%':260,32),L('86%',11),L('58%',11)],{marginBottom:8}),...fields.map(f=>Field(f)),cta===false?null:Row(0,[sp(),L(110,9)]),Pill('100%',48,'accent'),Row(10,[sk({flex:1,height:1,borderRadius:0}),L(24,9),sk({flex:1,height:1,borderRadius:0})]),Pill('100%',48),Row(8,[L(140,10),L(64,10)],{justifyContent:'center',marginTop:4})],{width:'100%',maxWidth:400});
 if(M)return h('div',{style:{minHeight:H,background:'#fff',padding:'20px 20px 32px',display:'flex',flexDirection:'column',gap:44}},h(HermesLogo,{}),form);
 return h('div',{style:{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',minHeight:H}},
  h('div',{style:{background:'var(--hr-canvas)',padding:'48px 56px',display:'flex',flexDirection:'column',justifyContent:'space-between'}},h(HermesLogo,{}),Col(14,[Ttl(420,40,'canvas'),Ttl(320,40,'canvas'),L(360,12,'canvas'),Row(10,[Circ(32,'canvas'),L(140,10,'canvas')],{marginTop:16})]),L(180,9,'canvas')),
  h('div',{style:{background:'#fff',display:'flex',alignItems:'center',justifyContent:'center',padding:48}},form));
}

const P=(o)=>Object.assign({kind:'page',shell:'app'},o);
const V=[
P({id:'landing',label:'Landing',group:'Public & auth',shell:'public',what:'HermesRuns',body:()=>[
 h('section',{style:{display:'grid',gridTemplateColumns:M?'minmax(0,1fr)':'minmax(0,1.05fr) minmax(0,1fr)',gap:M?28:56,alignItems:'center',paddingTop:M?20:40}},Col(M?14:18,[Ey(120),Ttl('95%',M?38:62,'canvas'),Ttl('68%',M?38:62,'canvas'),L('88%',13,'canvas'),L('62%',13,'canvas'),Row(10,[Pill(M?150:172,M?48:52,'accent'),Pill(140,M?48:52,'canvas')],{marginTop:10,flexWrap:'wrap'})]),Box(M?300:500,{borderRadius:28},'canvas')),
 Row(M?20:44,rep(M?4:6,i=>L(rnd(i,60,96),12,'canvas')),{justifyContent:'center',flexWrap:'wrap'}),
 Col(14,[Ey(100),Ttl(M?'80%':520,M?28:40,'canvas'),L(M?'90%':440,11,'canvas')],{alignItems:M?'flex-start':'center'}),
 Grid(cols('repeat(3,minmax(0,1fr))'),20,rep(3,i=>Card([Box(M?180:220),Ey(70),Ttl(rnd(i,160,220),20),L('90%',10),L('68%',10)]))),
 h('section',{style:{background:'#1c1917',borderRadius:M?24:32,padding:M?'28px 20px':56,display:'grid',gridTemplateColumns:M?'minmax(0,1fr)':'minmax(0,1fr) minmax(0,1fr)',gap:M?24:48,alignItems:'center'}},Col(14,[L(100,9,'dark'),Ttl('85%',M?30:44,'dark'),Ttl('60%',M?30:44,'dark'),L('80%',11,'dark')]),Box(M?280:380,{borderRadius:24},'dark')),
 Col(16,[Ttl(M?'70%':380,32,'canvas'),Pill(M?160:180,52,'accent')],{alignItems:'center',padding:'24px 0'})]}),
P({id:'login',label:'Log in',group:'Public & auth',shell:'auth',what:'sign-in',note:'Shares the captured auth layout with signup / forgot-password.',body:H=>AuthShell(['Email','Password'],H)}),
P({id:'signup',label:'Sign up',group:'Public & auth',shell:'auth',what:'sign-up',note:'Auth alias — same shell, three fields.',body:H=>AuthShell(['Name','Email','Password'],H,false)}),
P({id:'forgot-password',label:'Forgot password',group:'Public & auth',shell:'auth',what:'password reset',note:'Auth alias — one field.',body:H=>AuthShell(['Email'],H,false)}),
P({id:'terms',label:'Terms',group:'Public & auth',shell:'public',what:'terms',body:()=>Doc('Terms of service',7)}),
P({id:'privacy',label:'Privacy',group:'Public & auth',shell:'public',what:'privacy policy',body:()=>Doc('Privacy policy',6)}),

P({id:'runner-fallback',label:'Runner home (fallback)',group:'Home & runs',nav:'home',head:'Home',what:'your training',body:()=>[PageHead({tw:420}),Grid(cols('minmax(0,1.6fr) minmax(0,1fr)'),16,[Card([CardHead({act:96}),Box(M?160:220)]),Card([CardHead({}),ListRows(4,{})])]),Grid(cols('repeat(3,minmax(0,1fr))'),16,rep(3,StatCard)),Card([CardHead({act:120}),Bars(12,180)])]}),
P({id:'profile',label:'Profile',group:'Home & runs',nav:null,head:'Profile',what:'profile',body:()=>[
 Card([h('div',{style:{display:'flex',flexDirection:M?'column':'row',gap:M?18:28,alignItems:M?'flex-start':'center'}},Circ(M?72:104),Col(12,[Ttl(M?'70%':280,30),L(200,10),Row(8,rep(3,i=>Pill(rnd(i,72,96),28)),{flexWrap:'wrap'})],{flex:1}),Grid(M?'repeat(2,minmax(0,1fr))':'repeat(4,minmax(96px,1fr))',M?16:28,rep(4,i=>Stat(i,24)),{width:M?'100%':'auto'}))]),
 Grid(cols('minmax(0,1.6fr) minmax(0,1fr)'),16,[Card([CardHead({act:110}),Bars(12,170)]),Card([CardHead({}),ListRows(4,{lead:'circ',ls:32})])]),
 Grid(cols('repeat(3,minmax(0,1fr))'),16,rep(3,i=>Card([Ey(70),Ttl(rnd(i,120,180),20),sk({height:6,borderRadius:3,width:'100%'}),L(140,9)]))),
 Card([CardHead({act:84}),ListRows(5,{lead:'date'})])]}),
P({id:'runs',label:'Runs',group:'Home & runs',nav:'runs',head:'Runs',what:'your runs',body:()=>[
 PageHead({title:'Recent runs',act:2}),
 Card([Grid(M?'repeat(2,minmax(0,1fr))':'repeat(4,minmax(0,1fr))',M?16:24,rep(4,i=>Stat(i,26))),Row(0,[L(180,10),sp(),L(70,9)]),Bars(12,M?110:140)]),
 Row(10,[sk({flex:M?'1 1 100%':'0 1 340px',height:42,borderRadius:12},'canvas'),Seg(['All','Year','Month','Day'],0,true)],{flexWrap:'wrap'}),
 Card([Row(12,[Ttl(140,18),sp(),L(90,9)]),ListRows(M?5:7,{lead:'thumb',ls:44,cols:3,first:true,h:72})])]}),
P({id:'run-detail',label:'Run detail',group:'Home & runs',nav:'runs',head:'Runs',what:'run details',body:()=>[
 Row(10,[h('span',{style:{height:34,padding:'0 12px 0 6px',borderRadius:999,background:'#fff',display:'flex',alignItems:'center',gap:4,fontSize:13,fontWeight:700}},Icon('back',16),'Runs'),sp(),Pill(M?96:140,36,'canvas'),Pill(90,36,'canvas')]),
 Col(10,[Ey(120),Ttl(M?'72%':360,36,'canvas'),Row(8,rep(3,i=>Pill(rnd(i,80,110),28,'canvas')),{flexWrap:'wrap'})]),
 Grid(cols('minmax(0,1.7fr) minmax(0,1fr)'),16,[Box(M?220:380,{borderRadius:20},'map'),Card([Grid('repeat(2,minmax(0,1fr))',20,rep(6,i=>Stat(i,26)))])]),
 Card([Seg(['Heart rate','Pace','Elevation','Cadence'],0),Box(M?160:220),Row(16,rep(3,i=>L(rnd(i,80,120),9)),{flexWrap:'wrap'})]),
 Grid(cols('minmax(0,1.7fr) minmax(0,1fr)'),16,[Card([CardHead({}),ListRows(M?5:8,{lead:'date',cols:3,first:true,h:52})]),Col(16,[Card([CardHead({}),Thumbcard()]),Card([CardHead({}),Num(80,32),sk({height:8,borderRadius:4,width:'100%'}),L('80%',9)])])])]}),
P({id:'today-run',label:"Today's run",group:'Home & runs',nav:'home',head:"Today's run",what:"today's workout",body:()=>[
 Card([Row(16,[Col(10,[Ey(100),Ttl(M?'80%':380,34),Row(8,rep(3,i=>Pill(rnd(i,80,110),28)),{flexWrap:'wrap'})],{flex:1}),M?null:Pill(180,48,'accent')],{alignItems:'flex-start'}),Grid(M?'repeat(2,minmax(0,1fr))':'repeat(4,minmax(0,1fr))',16,rep(4,i=>Stat(i,24))),M?Pill('100%',48,'accent'):null]),
 Grid(cols('minmax(0,1.6fr) minmax(0,1fr)'),16,[Card([Ey(110),...rep(5,i=>Row(14,[sk({width:6,height:44,borderRadius:3}),Col(8,[L(rnd(i,120,200),11),L(rnd(i,80,140),9)],{flex:1}),L(54,11)]))]),Col(16,[Card([Ey(70),Row(12,[Circ(40),Col(8,[Num(60,20),L(100,9)])])]),Card([Ey(60),Thumbcard()]),Card([Ey(60),L('90%',10),L('60%',10)])])])]}),
P({id:'import-data',label:'Import data',group:'Home & runs',nav:'runs',head:'Import data',what:'import options',body:()=>[
 PageHead({title:'Import data'}),
 Grid(cols('minmax(0,1.7fr) minmax(0,1fr)'),16,[Card([Seg(['FIT / GPX export','COROS export','Huawei Health export'],0),Dz(M?200:260,[sk({width:44,height:44,borderRadius:12}),L(240,11),L(180,9)]),Row(10,[sp(),Pill(96,40),Pill(120,40,'accent')])]),Card([Ey(110),ListRows(3,{first:true}),L('80%',9)])])]}),

P({id:'analysis',label:'Analysis',group:'Analysis',nav:'analysis',head:'Analysis',what:'your analysis',body:()=>[
 Col(10,[Ttl(M?'90%':560,M?30:38,'canvas'),Row(12,[L(M?'60%':300,11,'canvas'),sp(),Pill(124,36,'canvas'),Pill(136,36,'canvas')],{flexWrap:'wrap'})]),
 Grid(cols('minmax(0,1.6fr) minmax(0,1fr)'),16,[Card([Row(16,[Col(8,[Lbl('VO₂max'),Num(140,48),L(220,10)],{flex:1}),Col(6,[L(60,9),Num(48,18)],{alignItems:'flex-end'})],{alignItems:'flex-start'}),Bars(12,168)],{gap:20}),Card([Row(0,[Lbl('Race predictions'),sp(),L(80,9)]),ListRows(4,{lead:false,first:true,h:68})],{gap:8})]),
 Grid(cols('repeat(auto-fit,minmax(240px,1fr))'),16,['Load balance','Intensity mix','Injury risk','Coach'].map((t,i)=>Card([h('span',{style:{fontSize:12,fontWeight:700,color:i===3?'var(--hr-accent)':'var(--hr-muted)'}},t),Num(rnd(i,70,140),30),sk({height:6,borderRadius:3,width:'100%'}),L('85%',9),L('60%',9)],{gap:12,padding:M?18:'20px 22px'}))),
 Col(14,[Row(12,[h('h2',{style:{margin:0,font:'italic 800 22px Manrope,sans-serif',letterSpacing:'-0.02em'}},'Go deeper'),sp(),M?null:L(220,9,'canvas')]),Card([ListRows(3,{lead:false,h:76})],{gap:0,padding:M?'4px 18px':'4px 26px'})])]}),
P({id:'analysis-insight',label:'Coach insight',group:'Analysis',nav:'analysis',head:'Coach insight',what:'coach insight',body:()=>[
 Row(12,[Circ(44,'canvas'),Col(8,[L(120,11,'canvas'),L(200,9,'canvas')])]),Col(10,[Ttl(M?'95%':720,34,'canvas'),Ttl(M?'70%':480,34,'canvas')]),
 Grid(cols('repeat(3,minmax(0,1fr))'),16,rep(3,_i=>Card([Row(10,[sk({width:32,height:32,borderRadius:10}),L(100,10)]),L('92%',10),L('80%',10),L('55%',10)]))),
 Card([CardHead({act:100}),Box(M?180:240)]),Card([CardHead({}),ListRows(3,{lead:false})])]}),
P({id:'analysis-load',label:'Load balance',group:'Analysis',nav:'analysis',head:'Load balance',what:'load balance',body:()=>[
 PageHead({tw:420}),
 Card([Row(24,[Col(10,[Lbl('Load balance'),Num(120,52),L(240,10)],{flex:1}),M?null:Col(8,[L(80,9),Num(60,22)],{alignItems:'flex-end'})],{alignItems:'flex-start'}),sk({height:8,borderRadius:4,width:'100%'}),Row(0,[L(24,8),sp(),L(64,8),sp(),L(24,8)])]),
 Grid(cols('minmax(0,1.6fr) minmax(0,1fr)'),16,[Card([CardHead({act:120}),Box(M?160:220)]),Card([CardHead({}),...rep(3,_i=>Col(8,[L(90,9),Num(70,22)]))])]),
 Card([ListRows(3,{lead:false,h:60})],{gap:0,padding:M?'4px 18px':'4px 26px'})]}),
P({id:'analysis-intensity',label:'Intensity',group:'Analysis',nav:'analysis',head:'Intensity',what:'intensity mix',body:()=>[
 PageHead({tw:380}),
 Card([Lbl('Your mix'),Num(200,40),h('div',{style:{display:'flex',gap:3}},sk({flex:78,height:12,borderRadius:'6px 0 0 6px'}),sk({flex:14,height:12,borderRadius:0}),sk({flex:8,height:12,borderRadius:'0 6px 6px 0'})),Grid('repeat(3,minmax(0,1fr))',16,rep(3,_i=>Col(8,[L(60,9),Num(56,22),L(90,9)])))]),
 Card([Lbl('Quality sessions'),ListRows(5,{lead:'date',first:true})])]}),
P({id:'analysis-injury',label:'Injury risk',group:'Analysis',nav:'analysis',head:'Injury risk',what:'injury risk',body:()=>[
 PageHead({tw:400}),
 Grid(cols('minmax(0,1.3fr) minmax(0,1fr)'),16,[Card([Lbl('Injury risk'),Row(10,[Num(130,44),L(60,10)]),Grid('repeat(3,1fr)',4,rep(3,()=>sk({height:6,borderRadius:3,width:'100%'}))),L(120,9),Row(6,rep(3,()=>sk({flex:1,height:38,borderRadius:10}))),L('80%',10)]),Card([CardHead({}),ListRows(4,{lead:false,pillTrail:true})])]),
 Card([Row(16,[Col(8,[Ttl(200,20),L(M?'90%':360,10)],{flex:1}),Pill(160,40,'accent')],{flexWrap:'wrap'})])]}),
P({id:'analysis-coach',label:'Coach & team',group:'Analysis',nav:'analysis',head:'Coach',what:'your team',body:()=>[
 PageHead({tw:300,act:1}),Seg(['Athletes','Team members','Messages'],0,true),
 Grid(cols('minmax(0,1.6fr) minmax(0,1fr)'),16,[Card([Row(10,[sk({flex:M?1:'0 1 280px',height:40,borderRadius:12}),M?null:sp(),M?null:Pill(110,36)]),ListRows(6,{lead:'circ',ls:40,pillTrail:true,first:true,h:68})]),Card([CardHead({}),...rep(3,i=>Row(10,[Circ(32),Col(8,[L(rnd(i,100,160),10),L(rnd(i+2,140,200),9)],{flex:1})],{alignItems:'flex-start'}))])])]}),
P({id:'prediction',label:'Race prediction',group:'Analysis',nav:'analysis',head:'Prediction',what:'race predictions',body:()=>[
 PageHead({tw:380}),
 Grid(cols('repeat(4,minmax(0,1fr))','repeat(2,minmax(0,1fr))'),16,['5K','10K','Half','Marathon'].map((t,i)=>Card([Lbl(t),Num(rnd(i,90,130),34),L(80,9),L(60,9)],{gap:10,padding:M?16:'20px 22px'}))),
 Grid(cols('minmax(0,1.6fr) minmax(0,1fr)'),16,[Card([CardHead({act:150}),Box(M?180:260)]),Card([CardHead({}),ListRows(4,{lead:false,h:56})])])]}),
P({id:'heatmap',label:'Heatmap',group:'Analysis',nav:'heatmap',head:'Heatmap',what:'your heatmap',body:()=>[
 h('div',{style:{position:'relative',height:M?520:740,borderRadius:20,overflow:'hidden'}},Box('100%',{height:'100%',borderRadius:20},'map'),
  h('div',{style:{position:'absolute',top:16,left:16,width:M?'calc(100% - 32px)':340,background:'#fff',borderRadius:16,padding:16,display:'flex',flexDirection:'column',gap:12,boxShadow:'0 8px 24px rgba(28,25,23,.08)'}},Seg(['All','Year','Month'],0),L(180,10),Row(6,rep(3,i=>Pill(rnd(i,64,84),28)))),
  h('div',{style:{position:'absolute',right:16,bottom:16,width:220,height:40,borderRadius:999,background:'#fff',padding:'0 14px',display:'flex',alignItems:'center',gap:10}},L(30,8),sk({flex:1,height:8,borderRadius:4}),L(30,8))),
 Grid(cols('repeat(3,minmax(0,1fr))'),16,rep(3,StatCard))]}),
P({id:'weather',label:'Weather engine',group:'Analysis',nav:'weather',head:'Weather Engine',what:'weather forecast',body:()=>[
 PageHead({tw:360}),
 Grid(cols('minmax(0,1.2fr) minmax(0,1fr)'),16,[Card([Row(20,[Circ(M?64:84),Col(10,[Num(M?100:140,M?44:56),L(160,10)])]),Grid('repeat(3,minmax(0,1fr))',16,rep(3,()=>Col(8,[L(56,9),Num(64,20)])))]),Card([Ey(110),Num(120,36),L('90%',10),L('70%',10),sk({height:8,borderRadius:4,width:'100%'})])]),
 Card([Ey(100),h('div',{style:{display:'grid',gridTemplateColumns:M?'repeat(12,64px)':'repeat(12,minmax(0,1fr))',gap:8,overflowX:M?'auto':'visible'}},...rep(12,()=>Col(8,[L(28,8),Circ(28),L(32,10)],{alignItems:'center',padding:'12px 0',background:'var(--hr-surface-2)',borderRadius:14})))]),
 Grid(cols('repeat(3,minmax(0,1fr))'),16,rep(3,()=>Card([Row(10,[sk({width:32,height:32,borderRadius:10}),L(110,11)]),L('90%',10),L('65%',10)])))]}),

P({id:'schedule',label:'Schedule',group:'Training',nav:'schedule',head:'Schedule',what:'your schedule',body:()=>[
 PageHead({title:'Weekly training schedule',act:1}),
 Card([Row(0,[Lbl('This week'),sp(),Num(120,22)]),sk({height:8,borderRadius:4,width:'100%'})],{gap:12,padding:M?16:'18px 24px'}),
 Card([Row(8,[Circ(32),L(110,12),Circ(32),sp(),M?null:Pill(120,34)]),h('div',{style:{display:'grid',gridTemplateColumns:M?'repeat(7,132px)':'repeat(7,minmax(0,1fr))',gap:10,overflowX:M?'auto':'visible'}},...DAYS.map((d,i)=>Col(10,[h('span',{style:{fontSize:12,fontWeight:700,color:i===3?'var(--hr-accent)':'var(--hr-muted)'}},d),Num(24,20),L('80%',11),L('60%',9),sp(),L('50%',8)],{height:170,padding:14,borderRadius:16,background:i===3?'var(--hr-accent-soft)':'var(--hr-surface-2)'})))]),
 Grid(cols('minmax(0,1.6fr) minmax(0,1fr)'),16,[Card([CardHead({act:110}),ListRows(4,{lead:false,h:56}),Box(M?160:200,{},'map')]),Col(16,[Card([Lbl('Coach lens'),L('92%',10),L('80%',10),L('50%',10)]),Card([Lbl('Current gear'),Thumbcard()])])])]}),
P({id:'muscle-training',label:'Muscle training',group:'Training',nav:'muscle',head:'Muscle training',what:'strength plan',body:()=>[
 PageHead({tw:380,act:1}),
 Grid(cols('repeat(7,minmax(0,1fr))','repeat(4,minmax(0,1fr))'),10,DAYS.map(d=>Col(10,[h('span',{style:{fontSize:12,fontWeight:700,color:'var(--hr-muted)'}},d),Circ(M?28:34)],{alignItems:'center',padding:'14px 0',background:'#fff',borderRadius:16}))),
 Grid(cols('minmax(0,1fr) minmax(0,1fr) minmax(0,1.2fr)'),16,[Card([Ey(90),Circ(M?160:180),L('70%',9)],{alignItems:'center'}),Card([CardHead({}),L('90%',10),L('70%',10),Pill(160,42,'accent')]),Card([CardHead({}),ListRows(4,{}),Pill(140,40)])]),
 Card([CardHead({}),Box(M?140:170)])]}),
P({id:'rewards',label:'Rewards',group:'Training',nav:null,head:'Rewards',what:'your rewards',body:()=>{const badge=()=>Col(10,[Circ(M?60:72),L(80,10),L(56,8)],{alignItems:'center'});return[
 Card([h('div',{style:{display:'flex',flexDirection:M?'column':'row',gap:M?18:32,alignItems:M?'flex-start':'center'}},Circ(M?96:150),Col(12,[Ey(100),Ttl(M?'80%':420,40),Row(8,rep(4,i=>Pill(rnd(i,72,96),28)),{flexWrap:'wrap'})],{flex:1}),M?null:h('div',{style:{width:340,padding:18,borderRadius:16,background:'var(--hr-surface-2)',display:'flex',gap:14,alignItems:'center'}},Circ(64),Col(8,[L(150,11),L(180,9),L(120,9)])))]),
 ...rep(M?3:5,()=>Card([h('div',{style:{display:'grid',gridTemplateColumns:M?'minmax(0,1fr)':'220px repeat(5,minmax(0,1fr))',gap:M?16:20,alignItems:'center'}},Col(8,[Ttl(140,20),L(180,9),L(120,9)]),...(M?[Grid('repeat(3,minmax(0,1fr))',12,rep(3,badge))]:rep(5,badge)))]))]}}),

P({id:'shoes',label:'Shoes',group:'Gear & races',nav:'shoes',head:'Shoes',what:'your shoes',body:()=>[
 PageHead({title:'Shoes',act:2}),
 Card([Row(8,[Seg(['Active','Retired','All'],0),M?null:sp(),sk({flex:M?'1 1 100%':'0 1 260px',height:40,borderRadius:12})],{flexWrap:'wrap'})],{padding:12}),
 Grid(cols('repeat(3,minmax(0,1fr))'),16,rep(M?2:3,i=>Card([Row(0,[L(80,9),sp(),Pill(64,22)]),Box(M?180:200),Ey(70),Ttl(rnd(i,160,220),20),sk({height:6,borderRadius:3,width:'100%'}),Row(0,[L(60,9),sp(),L(80,9)]),Grid('1fr 1fr',16,[Col(8,[L(60,9),Num(70,22)]),Col(8,[L(60,9),Num(70,22)])])])))]}),
P({id:'add-shoes',label:'Add shoes',group:'Gear & races',nav:'shoes',head:'Shoes',what:'shoe catalog',body:()=>[
 PageHead({title:'Add shoes'}),
 Card([Row(10,[Circ(28),Ttl(140,18)]),Grid(M?'repeat(3,minmax(0,1fr))':'repeat(7,minmax(0,1fr))',12,rep(M?6:10,()=>h('div',{style:{height:M?72:96,borderRadius:16,background:'var(--hr-surface-2)',display:'grid',placeItems:'center'}},sk({width:44,height:24,borderRadius:6}))))]),
 Card([Row(10,[Circ(28),Ttl(160,18),sp(),M?null:sk({width:280,height:40,borderRadius:12})]),Row(6,rep(5,i=>Pill(rnd(i,60,84),32)),{flexWrap:'wrap'}),Grid(M?'repeat(2,minmax(0,1fr))':'repeat(6,minmax(0,1fr))',12,rep(M?4:12,()=>Col(10,[Box(M?90:100,{borderRadius:12}),L('80%',10),L('50%',8)],{padding:12,borderRadius:16,background:'var(--hr-surface-2)'})))]),
 Card([Row(10,[Circ(28),Ttl(120,18)]),Grid(cols('1fr 1fr'),16,rep(4,()=>Field())),Row(10,[sp(),Pill(96,42),Pill(130,42,'accent')])])]}),
P({id:'shoe-catalog',label:'Shoe catalog',group:'Gear & races',nav:'shoes',head:'Shoes',what:'shoe catalog',body:()=>[
 Card([Ey(90),Ttl(M?'80%':320,30),Row(10,[sk({flex:1,height:46,borderRadius:12}),Pill(100,46)])]),
 Card([Row(0,[L(80,10),sp(),L(60,9)]),ListRows(6,{lead:'thumb',ls:52,first:true,h:76})])]}),
P({id:'races',label:'Races',group:'Gear & races',nav:'races',head:'Races',what:'your races',body:()=>[
 Grid(cols('minmax(0,1.3fr) minmax(0,1fr)'),16,[h('div',{style:{position:'relative',height:M?260:340,borderRadius:20,overflow:'hidden'}},Box('100%',{height:'100%',borderRadius:20},'canvas'),Col(12,[Ey(100),Ttl(M?220:380,36),L(260,10),Row(8,[Pill(110,40),Pill(110,40)])],{position:'absolute',left:M?20:28,right:M?20:28,bottom:M?20:28})),Card([CardHead({}),ListRows(2,{lead:'date'}),Pill(130,40)])]),
 Card([CardHead({}),Grid(M?'repeat(6,minmax(0,1fr))':'repeat(12,minmax(0,1fr))',8,rep(12,()=>Col(6,[L(24,8),Box(M?56:84,{borderRadius:10})])))]),
 Grid(cols('repeat(4,minmax(0,1fr))','repeat(2,minmax(0,1fr))'),16,rep(4,StatCard)),
 Card([Row(10,[Ttl(160,20),sp(),M?null:Pill(110,36),M?null:Pill(110,36)]),Grid(cols('repeat(3,minmax(0,1fr))'),16,rep(M?2:6,i=>Col(10,[Box(M?160:180),Ey(60),Ttl(rnd(i,140,200),18),L('80%',9)])))])]}),
P({id:'race-detail',label:'Race detail',group:'Gear & races',nav:'races',head:'Races',what:'race details',body:()=>[
 Row(10,[h('span',{style:{height:34,padding:'0 12px 0 6px',borderRadius:999,background:'#fff',display:'flex',alignItems:'center',gap:4,fontSize:13,fontWeight:700}},Icon('back',16),'Races'),sp(),Pill(100,36,'canvas')]),
 Grid(cols('minmax(0,1fr) minmax(0,2fr)'),16,[h('div',{style:{background:'#fff',borderRadius:20,overflow:'hidden',alignSelf:'start'}},Box(200,{borderRadius:0}),Col(16,[Ey(90),Ttl('80%',30),L('85%',10),L('60%',10),Grid('repeat(4,minmax(0,1fr))',12,rep(4,()=>Col(8,[L(40,8),Num(48,22)]))),ListRows(3,{first:true}),Row(10,[Pill(110,40,'accent'),Pill(110,40)])],{padding:M?18:24})),Col(16,[Box(M?240:520,{borderRadius:20},'map'),Card([CardHead({}),Grid('repeat(3,minmax(0,1fr))',16,rep(3,i=>Stat(i,24))),Box(M?140:180)])])])]}),

...SET.map(s=>P({id:'settings-'+s.toLowerCase(),label:'Settings · '+s,group:'Settings',shell:'settings',setting:s,nav:null,head:'Settings',what:s.toLowerCase()+' settings',body:()=>SETB[s]()})),
...ADM.map(([k,l])=>P({id:'admin-'+k,label:'Admin · '+l,group:'Admin',shell:'admin',admin:k,what:l.toLowerCase(),body:()=>ADMB[k]()})),

P({id:'legacy-garmin',label:'Garmin import (legacy)',group:'Legacy · unused previews',legacy:true,nav:'runs',head:'Garmin import',what:'Garmin import',note:'Unused legacy component preview — kept for completeness.',body:()=>[
 Grid(cols('220px minmax(0,1fr)'),24,[Col(10,[Ey(100),Ttl(160,36,'canvas'),L(120,10,'canvas'),L(90,10,'canvas')]),Box(M?160:180,{borderRadius:20},'canvas')],{alignItems:'center'}),
 Grid(cols('repeat(3,minmax(0,1fr))'),16,rep(3,()=>Card([Box(26,{borderRadius:8}),Box(26,{borderRadius:8}),Box(26,{borderRadius:8})],{gap:8,padding:18}))),
 Grid(cols('minmax(0,1.7fr) minmax(0,1fr)'),16,[Card([Ttl(200,20),ListRows(6,{first:true}),Pill(170,44)]),Card([Ttl(200,20),L('90%',10),L('80%',10),Row(8,rep(3,()=>sk({flex:1,height:46,borderRadius:12}))),Pill(170,44,'accent')])])]}),
P({id:'legacy-admin-login',label:'Admin login (legacy)',group:'Legacy · unused previews',legacy:true,shell:'auth',what:'admin sign-in',note:'Unused legacy component preview — kept for completeness.',body:H=>AuthShell(['Email','Password'],H,false)}),
];
function Doc(title,n){return[h('article',{style:{maxWidth:760,width:'100%',margin:'0 auto',background:'#fff',borderRadius:24,padding:M?'24px 20px':'48px 56px',display:'flex',flexDirection:'column',gap:M?24:32}},Col(12,[h('h1',{style:H1()},title),L(180,10)]),...rep(n,i=>Col(10,[Ttl(rnd(i,180,300),20),L('100%',11),L('96%',11),L('90%',11),i%2?L('58%',11):L('74%',11)])))]}
const SETB={
 Profile:()=>[Card([Row(16,[Circ(72),Col(8,[L(140,12),L(200,9)],{flex:1}),Pill(110,38)]),Grid(cols('1fr 1fr'),16,rep(4,()=>Field())),Row(0,[sp(),Pill(120,42,'accent')])])],
 Preferences:()=>[Card([...rep(3,i=>Row(16,[Col(8,[L(120,11),L(200,9)],{flex:1}),Pill(M?120:200,36)],{minHeight:72,borderTop:i?'1px solid var(--hr-line)':'none',flexWrap:'wrap'}))],{gap:0}),Card([ToggleRows(4)],{gap:0})],
 Training:()=>[Card([CardHead({}),Grid('1fr 1fr',16,[Stat(0),Stat(1)]),ListRows(5,{first:true,h:56})]),Card([CardHead({}),ListRows(3,{lead:false,first:true})])],
 Connections:()=>[Card([...rep(3,i=>Row(14,[sk({width:44,height:44,borderRadius:12}),Col(8,[L(120,12),L(180,9)],{flex:1}),M?null:Pill(84,24),Pill(100,38)],{minHeight:76,borderTop:i?'1px solid var(--hr-line)':'none'}))],{gap:0}),Card([CardHead({}),ListRows(4,{lead:false})])],
 Notifications:()=>[Card([L(120,12),ToggleRows(4)],{gap:4}),Card([L(120,12),ToggleRows(3)],{gap:4})],
 Activity:()=>[Card([CardHead({act:100}),Box(160)]),Card([ListRows(5,{})],{gap:0})],
 Account:()=>[Card([...rep(2,i=>Row(16,[Col(8,[L(90,11),L(200,9)],{flex:1}),Pill(120,38)],{minHeight:76,borderTop:i?'1px solid var(--hr-line)':'none'}))],{gap:0}),Card([Col(8,[L(120,12),L('80%',9)]),Pill(160,40,'accent')])],
};
const ADMB={
 overview:()=>[Grid(cols('repeat(4,minmax(0,1fr))','repeat(2,minmax(0,1fr))'),16,rep(4,StatCard)),Grid(cols('repeat(4,minmax(0,1fr))','repeat(2,minmax(0,1fr))'),16,rep(4,()=>Card([Row(10,[sk({width:10,height:10,borderRadius:5}),L(90,10)]),L(120,9)],{padding:'16px 18px',gap:12}))),Grid(cols('repeat(3,minmax(0,1fr))'),16,rep(3,()=>Card([CardHead({}),Box(140)]))),Grid(cols('1fr 1fr'),16,[Card([CardHead({}),ListRows(4,{})]),Card([CardHead({}),ListRows(4,{lead:'circ'})])])],
 users:()=>[Grid(cols('repeat(3,minmax(0,1fr))','repeat(3,minmax(0,1fr))'),M?10:16,rep(3,StatCard)),Table(10,5)],
 courseMaps:()=>[Grid(cols('minmax(0,1fr) minmax(0,1.6fr)'),16,[Card([sk({width:'100%',height:40,borderRadius:12}),ListRows(7,{lead:'thumb',ls:44,first:true})]),Col(16,[Box(M?240:460,{borderRadius:20},'map'),Card([Grid(cols('1fr 1fr'),16,rep(4,()=>Field())),Row(0,[sp(),Pill(120,40,'accent')])])])])],
 shoes:()=>[Grid(cols('minmax(0,1.7fr) minmax(0,1fr)'),16,[Table(8,4),Card([Box(200),Ttl(180,20),Grid('1fr 1fr',12,rep(6,()=>Col(8,[L(50,8),L(80,11)]))),Pill(120,40,'accent')])])],
 jobs:()=>[Grid(cols('repeat(4,minmax(0,1fr))','repeat(2,minmax(0,1fr))'),16,rep(4,StatCard)),Grid(cols('minmax(0,1.7fr) minmax(0,1fr)'),16,[Table(8,5),Card([CardHead({}),ListRows(5,{lead:false,pillTrail:true})])])],
 audit:()=>[Table(14,5)],
 settings:()=>rep(3,i=>Card([CardHead({}),Grid(cols('1fr 1fr'),16,rep(i===1?2:4,()=>Field())),Row(0,[sp(),Pill(120,40,'accent')])])),
};

const D=(o)=>Object.assign({kind:'dialog',group:'Dialogs'},o);
const PLAN=['Workout library','Workout editor','Training plans','Season structure'];
V.push(
D({id:'manual-run',label:'Log a completed run',under:'runs',title:'Log a completed run',sub:'Add a run you did without a watch.',w:600,minH:380,primary:'Save run',what:'run form',body:()=>[Grid(cols('1fr 1fr','1fr 1fr'),12,[Field('Date'),Field('Start time')]),Grid(cols('repeat(3,minmax(0,1fr))','1fr 1fr'),12,[Field('Distance'),Field('Duration'),Field('Avg pace')]),Col(8,[h('span',{style:{fontSize:12.5,fontWeight:700,color:'var(--hr-muted)'}},'Run type'),Row(6,rep(4,i=>Pill(rnd(i,64,84),34)),{flexWrap:'wrap'})]),Col(8,[h('span',{style:{fontSize:12.5,fontWeight:700,color:'var(--hr-muted)'}},'Shoes'),Thumbcard()]),Field('Notes')]}),
D({id:'session-comparison',label:'Compare sessions',under:'runs',title:'Compare sessions',sub:"Overlay heart rate from up to 4 runs you're allowed to see",w:1040,minH:M?560:470,primary:'Compare',what:'sessions to compare',body:()=>[M?Col(14,[sk({width:'100%',height:40,borderRadius:12}),ListRows(4,{lead:'check',first:true,h:56}),Box(220)]):Grid('320px minmax(0,1fr)',24,[Col(10,[sk({width:'100%',height:40,borderRadius:12}),ListRows(6,{lead:'check',first:true,h:60})]),Col(14,[Row(8,rep(4,i=>Pill(rnd(i,84,110),28))),Box(330),Grid('repeat(3,minmax(0,1fr))',16,rep(3,i=>Stat(i,22)))])])]}),
D({id:'sport-totals',label:'Sport totals',under:'analysis',title:'Sport totals',sub:'Time and distance by sport',w:600,minH:360,buttons:[['Close',0]],what:'sport totals',body:()=>[Row(6,rep(4,i=>Pill(rnd(i,64,90),34)),{flexWrap:'wrap'}),Grid('repeat(3,minmax(0,1fr))',12,rep(3,_i=>Col(8,[L(56,9),Num(72,26)]))),Col(0,rep(4,i=>Row(14,[sk({width:36,height:36,borderRadius:10}),Col(8,[L(rnd(i,90,130),11),sk({height:6,borderRadius:3,width:rnd(i,40,90)+'%'})],{flex:1}),L(56,11)],{minHeight:64,borderTop:'1px solid var(--hr-line)'})))]}),
D({id:'period-comparison',label:'Compare periods',under:'analysis',title:'Compare periods',sub:'This week against the week before',w:600,minH:360,buttons:[['Close',0]],what:'period comparison',body:()=>[Row(10,[Pill(M?120:160,40),L(20,9),Pill(M?120:160,40)]),...rep(4,i=>Col(8,[Row(0,[L(rnd(i,70,100),10),sp(),L(60,10)]),sk({height:10,width:rnd(i,60,92)+'%',borderRadius:5}),sk({height:10,width:rnd(i+3,48,85)+'%',borderRadius:5},'canvas')])),Col(8,[L('95%',10),L('68%',10)],{paddingTop:8,borderTop:'1px solid var(--hr-line)'})]}),
D({id:'recovery-journal',label:'Recovery journal',under:'analysis-injury',title:'Recovery journal',sub:'How your body feels today',w:640,minH:400,primary:'Save entry',what:'recovery journal',body:()=>[Grid('repeat(7,minmax(0,1fr))',6,DAYS.map((d,i)=>Col(6,[h('span',{style:{fontSize:11,fontWeight:700,color:i===6?'var(--hr-accent)':'var(--hr-muted)'}},d),sk({width:'100%',height:28,borderRadius:8})],{alignItems:'center'}))),...['Leg soreness','Sleep','Energy','Stress'].map(t=>Row(12,[h('span',{style:{fontSize:13.5,fontWeight:700,width:M?100:120,flex:'none'}},t),sp(),Row(M?4:6,rep(5,()=>Circ(M?26:30)))],{minHeight:48,borderTop:'1px solid var(--hr-line)'})),Field('Notes')]}),
D({id:'fitness-model',label:'Fitness and fatigue estimates',under:'analysis-load',title:'Fitness and fatigue estimates',sub:'Modelled from your recent training load',w:740,minH:400,buttons:[['Close',0]],what:'fitness model',body:()=>[Grid('repeat(3,minmax(0,1fr))',16,['Fitness','Fatigue','Form'].map((t,_i)=>Col(8,[Lbl(t),Num(70,30),L(90,9)]))),Box(M?180:220),L('95%',10),L('80%',10),L('50%',10)]}),
D({id:'session-conversation',label:'Discuss this session',under:'run-detail',title:'Discuss this session',sub:'Messages with your coach about this run',w:660,minH:420,buttons:[['Send',1]],what:'conversation',body:()=>[Row(12,[sk({width:44,height:44,borderRadius:12}),Col(8,[L(160,11),L(220,9)])],{padding:12,background:'var(--hr-surface-2)',borderRadius:14}),...rep(4,i=>h('div',{style:{alignSelf:i%2?'flex-end':'flex-start',display:'flex',gap:10,maxWidth:'82%',flexDirection:i%2?'row-reverse':'row',alignItems:'flex-end'}},Circ(30),Col(8,[L(rnd(i,180,260),10),L(rnd(i+1,110,200),10)],{padding:'12px 14px',borderRadius:16,background:i%2?'var(--hr-accent-soft)':'var(--hr-surface-2)'}))),sk({width:'100%',height:46,borderRadius:14})]}),
D({id:'workout-library',label:'Workout library',under:'schedule',title:'Workout library',sub:'Your reusable workouts and ones shared with you',tabs:PLAN,tab:0,w:960,minH:440,primary:'Add to day',what:'workout library',body:()=>[M?Col(12,[Row(6,rep(4,i=>Pill(rnd(i,70,96),32)),{overflow:'hidden'}),sk({width:'100%',height:40,borderRadius:12}),ListRows(5,{pillTrail:true,first:true})]):Grid('220px minmax(0,1fr)',20,[Col(6,rep(5,i=>sk({width:'100%',height:40,borderRadius:12},i?null:'accent'))),Col(10,[Row(8,[sk({width:260,height:40,borderRadius:12}),sp(),Pill(140,40)]),ListRows(6,{pillTrail:true,first:true})])])]}),
D({id:'workout-editor',label:'Workout editor',under:'schedule',title:'Workout editor',sub:'Build a session, preview the steps, and choose a day',tabs:PLAN,tab:1,w:960,minH:460,primary:'Save workout',what:'workout editor',body:()=>[Grid(cols('minmax(0,2fr) minmax(0,1fr)'),12,[Field('Workout name'),Field('Sport')]),...rep(4,i=>Row(12,[sk({width:6,height:40,borderRadius:3}),Col(8,[L(rnd(i,120,180),11),L(rnd(i,80,120),9)],{flex:1}),Pill(84,32)],{padding:'10px 12px',background:'var(--hr-surface-2)',borderRadius:14})),h('div',{style:{display:'flex',gap:3,alignItems:'flex-end',height:56}},...rep(16,i=>sk({flex:1,height:Math.round(SEQ[i%SEQ.length]*100)+'%',borderRadius:3}))),Row(6,DAYS.map(d=>h('span',{key:d,style:{flex:1,height:36,borderRadius:10,background:'var(--hr-surface-2)',display:'grid',placeItems:'center',fontSize:12,fontWeight:700,color:'var(--hr-faint)'}},d)))]}),
D({id:'reusable-plans',label:'Training plans',under:'schedule',title:'Training plans',sub:'A plan for you, or a reusable collection of workouts',tabs:PLAN,tab:2,w:960,minH:420,primary:'Use plan',what:'training plans',body:()=>[Row(8,[Pill(130,36),Pill(110,36),sp(),M?null:Pill(130,36)]),Grid(cols('1fr 1fr'),12,rep(4,i=>Col(10,[Ey(70),Ttl(rnd(i,140,200),18),L('85%',9),Row(8,[Pill(70,24),Pill(84,24)])],{padding:16,borderRadius:16,background:'var(--hr-surface-2)'})))]}),
D({id:'season-plan',label:'Season structure',under:'schedule',title:'Season structure',sub:'Give your next training block a clear shape',tabs:PLAN,tab:3,w:960,minH:440,primary:'Save season',what:'season structure',body:()=>[h('div',{style:{display:'flex',gap:4}},...[30,30,25,15].map((f,i)=>sk({flex:f,height:36,borderRadius:10},i===2?'accent':null))),Bars(12,140),ListRows(3,{})]}),
D({id:'activity-import',label:'Import workout data',what:'import options',body:()=>[]}),
D({id:'shoe-photo-search',label:'Shoe photo search',what:'shoe images',body:()=>[]})
);

const states = V;
function renderPage(id, height = '100dvh') {
 elementKey = 0;
 const v = states.find(state => state.id===id && state.kind==='page') || states.find(state=>state.id==='runner-fallback');
 if(v.shell==='auth') return v.body(height);
 const body = v.body();
 if(v.shell==='app') return AppShell(v,body,height);
 if(v.shell==='settings') return AppShell(v,SettingsBody(v.setting,body),height);
 if(v.shell==='admin') return AdminShell(v,body,height);
 return PublicShell(v,body,height);
}
function renderDialogBody(id) {
 elementKey = 0;
 return states.find(state=>state.id===id&&state.kind==='dialog')?.body()||[];
}
return {states,renderPage,renderDialogBody};
}
