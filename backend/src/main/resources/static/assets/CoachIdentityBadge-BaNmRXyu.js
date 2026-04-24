import{r as m}from"./I18nContext-BhY2a8Vp.js";var d="hermes_assigned_coach_v1",s=[{id:"mara-voss",name:"Mara Voss",roleEn:"Endurance Head Coach",roleZh:"耐力主教练"},{id:"elias-brooks",name:"Elias Brooks",roleEn:"Race Strategy Coach",roleZh:"比赛策略教练"},{id:"naomi-vale",name:"Naomi Vale",roleEn:"Performance Coach",roleZh:"表现教练"},{id:"lucas-rye",name:"Lucas Rye",roleEn:"Training Block Coach",roleZh:"训练周期教练"}];function f(e){let t=0;for(let a=0;a<e.length;a+=1)t=(t<<5)-t+e.charCodeAt(a),t|=0;return Math.abs(t)}function g(){try{const e=window.localStorage.getItem(d);if(!e)return{};const t=JSON.parse(e);return t&&typeof t=="object"?t:{}}catch{return{}}}function u(e){try{window.localStorage.setItem(d,JSON.stringify(e))}catch{}}function y(e,t){const a=e?.id!=null?String(e.id):"",r=e?.email?String(e.email).trim().toLowerCase():"",i=t?String(t).trim().toLowerCase():"",o=e?.displayName?String(e.displayName).trim():"";return a||r||i||o||"hermes-runner"}function x(e,t){const a=y(e,t),r=g(),i=r[a],o=s.find(h=>h.id===i);if(o)return o;const c=s[f(a)%s.length];return u({...r,[a]:c.id}),c}function C(e,t){return e?t==="zh-CN"?e.roleZh:e.roleEn:""}var n=m(),l=[{start:"#f6c8b8",end:"#d96b57",jacket:"#7b3226"},{start:"#d7e7f6",end:"#7ea6cf",jacket:"#2f4d6d"},{start:"#d8eddc",end:"#7cb588",jacket:"#305a3d"},{start:"#f0dff8",end:"#b88ad3",jacket:"#5c3675"}];function b(e){return Array.from(String(e||"")).reduce((t,a)=>t*31+a.charCodeAt(0)>>>0,0)}function v(e){const t=l[b(e)%l.length],a=`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-hidden="true">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${t.start}" />
          <stop offset="100%" stop-color="${t.end}" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="32" fill="url(#bg)" />
      <circle cx="32" cy="23" r="11" fill="#f7eee8" />
      <path d="M17 55c2-10 9-16 15-16s13 6 15 16" fill="${t.jacket}" />
      <path d="M24 20c2-6 14-6 16 0-2 1-4 2-8 2s-6-1-8-2Z" fill="rgba(42, 29, 24, 0.28)" />
      <circle cx="28" cy="23" r="1.2" fill="#7b5b4a" />
      <circle cx="36" cy="23" r="1.2" fill="#7b5b4a" />
      <path d="M28 28c1.5 1.8 6.5 1.8 8 0" stroke="#7b5b4a" stroke-width="1.6" stroke-linecap="round" fill="none" />
    </svg>
  `.trim();return`data:image/svg+xml;utf8,${encodeURIComponent(a)}`}function S({coach:e,lang:t,className:a=""}){if(!e)return null;const r=v(e.name||"Hermes Coach");return(0,n.jsxs)("div",{className:`coach-identity-badge${a?` ${a}`:""}`,children:[e.avatarUrl?(0,n.jsx)("img",{className:"coach-identity-avatar",src:e.avatarUrl,alt:e.name}):(0,n.jsx)("img",{className:"coach-identity-avatar coach-identity-avatar--fallback",src:r,alt:e.name}),(0,n.jsxs)("div",{className:"coach-identity-copy",children:[(0,n.jsx)("strong",{children:e.name}),(0,n.jsx)("span",{children:C(e,t)})]})]})}export{x as n,S as t};

//# sourceMappingURL=CoachIdentityBadge-BaNmRXyu.js.map