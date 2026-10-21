const targets={
 settings:'/settings?section=training',connections:'/settings?section=connections',calendar:'/schedule',activities:'/runs',import:'/settings/import-data',
 activity:'/runs?view=activity',intervals:'/runs?view=activity&panel=intervals',analysis:'/runs?view=activity&panel=analysis',
 'compare-activities':'/runs?view=compare',fitness:'/analysis/load-balance?fitness=1',totals:'/analysis?view=totals','compare-periods':'/analysis?view=compare',
 wellness:'/analysis/injury-risk?journal=1',library:'/schedule?trainingTool=library',workout:'/schedule?trainingTool=workout',plans:'/schedule?trainingTool=plans',season:'/schedule?trainingTool=season',
 athletes:'/profile/team?view=athletes',access:'/settings?section=account',messages:'/profile/team?view=messages',team:'/profile/team?view=team','team-consent':'/settings?section=account',
 bulk:'/settings?section=training&bulk=1',coaches:'/profile/team?view=athletes',privacy:'/settings?section=account',power:'/analysis',
};
export function trainingDestination(to,{athleteId}={}){
 if(typeof to==='number')return to;
 if(typeof to!=='string'||!to.startsWith('/')||to.startsWith('//'))return to;
 const source=new URL(to,'http://hermes.invalid');
 const key=source.pathname.replace(/^\/training\/?/,'').replace(/^\//,'')||'calendar';
 if(!Object.hasOwn(targets,key))return to;
 const dest=new URL(targets[key],'http://hermes.invalid');
 for(const [k,v]of source.searchParams){if(k==='id'&&['activity','intervals','analysis'].includes(key))dest.searchParams.set('activity',v);else dest.searchParams.set(k,v);}
 if(athleteId&&!dest.pathname.startsWith('/settings'))dest.searchParams.set('athlete',athleteId);
 return dest.pathname+dest.search+source.hash;
}
export function planDestination(path,search=''){
 const parts=path.split('/').filter(Boolean);const params=new URLSearchParams(search);
 if(parts[1]==='setup'){params.set('planView','setup');if(parts[2])params.set('planId',parts[2]);return '/schedule?'+params;}
 if(parts[2]==='preview'){params.set('planView','preview');params.set('planId',parts[1]);params.set('versionId',parts[3]);return '/schedule?'+params;}
 if(parts[2]==='workouts'){params.set('planId',parts[1]);params.set('workoutId',parts[3]);return '/today-run?'+params;}
 return '/schedule'+(params.size?'?'+params:'');
}
export function canonicalDestination(activity,actor,search='',hash=''){
 const params=new URLSearchParams(search);params.delete('view');params.delete('activity');
 if(activity.athleteId!==actor)params.set('athlete',activity.athleteId);else params.delete('athlete');
 return `/runs/${encodeURIComponent(activity.canonicalId)}${params.size?'?'+params:''}${hash}`;
}
