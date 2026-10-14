import React, {useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Pressable,ScrollView,StyleSheet,View,useWindowDimensions} from 'react-native';
import {tokens as t} from '../tokens';
import {ActionButton,ActivityCard,ConfirmationSheet,Copy,FeedbackBanner,Heading,LabeledField,Metric,Panel,PreferenceSelector,RecordingControls,Stack,StatusBadge,StepList,TabBar,WeekdayPicker,WizardHeader,WorkoutCard} from './primitives';

function Gallery() {
  const {width}=useWindowDimensions();
  const [tab,setTab]=useState('Today');
  const [state,setState]=useState('Planned');
  const [days,setDays]=useState([2,4,7]);
  const [volume,setVolume]=useState('steady');
  const [distance,setDistance]=useState('5.2');
  const [duration,setDuration]=useState('32:10');
  const [saved,setSaved]=useState(false);
  const [sheet,setSheet]=useState(false);
  const [paused,setPaused]=useState(false);
  const [notice,setNotice]=useState('');
  const trigger=useRef<React.ComponentRef<typeof View>>(null);
  const rows=[{value:'gentle',title:'Lighter weeks',description:'Leave more room around your running.'},{value:'steady',title:'Steady weeks',description:'A consistent amount of running.'},{value:'full',title:'Fuller weeks',description:'Make running a larger part of your week.'}];
  const invalid=distance!==''&&(!Number.isFinite(Number(distance))||Number(distance)<=0);
  const durationInvalid=!/^\d{1,2}:\d{2}$/.test(duration)||Number(duration.split(':')[1])>59;
  const narrow=width<t.layout.wideThreshold;
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
    <View style={styles.header}><Copy size="caption" tone="text-muted">HERMES / MOBILE DESIGN STUDY</Copy><Heading>A clear next session.</Heading><Copy tone="text-muted">Original design · synthetic examples · no live training plan</Copy></View>
    <View style={[styles.layout,{flexDirection:narrow?'column':'row'}]}>
      <View style={[styles.phone,{maxWidth:narrow?undefined:t.layout.previewMax}]}>
        <View style={styles.phoneHead}><Copy size="heading">Hermes</Copy><StatusBadge label="Sample plan" tone="info"/></View>
        <TabBar tabs={['Today','Setup','Log run','Components']} value={tab} onChange={setTab}/>
        <View style={styles.phoneBody}>
          {tab==='Today'&&<Stack><Copy size="caption" tone="text-muted">TUESDAY, 13 OCTOBER · WEEK 3</Copy><Heading>{state==='Rest day'?'Room to recover.':'Your run, at a glance.'}</Heading>
            <Copy tone="text-muted">Your 10K plan · 3 runs this week</Copy>
            {state==='Rest day'?<Panel><Heading>Rest day</Heading><Copy>No run is scheduled today.</Copy><ActionButton label="See this week" variant="secondary" onPress={()=>setNotice('This example has no plan calendar connection.')}/></Panel>
              :<WorkoutCard title="Easy run" description="Keep the effort relaxed. You should be able to talk comfortably." distance="5.0 km" duration="About 35 min" state={state} onOpen={()=>setNotice('Session details are shown below.')}/>}
            <Panel><Copy size="heading">This week</Copy><View style={styles.row}><Metric label="Logged" value="8.2 km"/><Metric label="Planned" value="18.0 km"/></View><Copy size="caption" tone="text-muted">Logged distance includes extra runs.</Copy></Panel>
            {state!=='Rest day'&&<><Copy size="heading">Session details</Copy><StepList steps={[{title:'Settle in',target:'5 minutes · comfortable effort'},{title:'Easy running',target:'4.0 km · relaxed effort'},{title:'Ease out',target:'5 minutes · comfortable effort'}]}/><ActionButton label="Log a completed run" onPress={()=>setTab('Log run')}/></>}
            {notice&&<FeedbackBanner title="Design example" detail={notice}/>}</Stack>}
          {tab==='Setup'&&<Stack><WizardHeader step={4} total={6} title="Make room for running." onBack={()=>setTab('Today')}/><Copy tone="text-muted">Choose the days that usually work for you.</Copy><WeekdayPicker selected={days} onChange={setDays}/><Copy size="caption">{days.length} days selected</Copy>
            <PreferenceSelector label="Weekly volume" options={rows} value={volume} onChange={setVolume}/><ActionButton label="Review sample schedule" disabled={days.length<2} onPress={()=>setSheet(true)}/><Copy size="caption" tone="text-muted">These choices only change the gallery example.</Copy></Stack>}
          {tab==='Log run'&&<Stack><Heading>Save what you ran.</Heading><Copy tone="text-muted">Manual entry · Tuesday, 13 October</Copy><LabeledField label="Distance (km)" value={distance} onChange={v=>{setDistance(v);setSaved(false);}} keyboardType="decimal-pad" error={invalid?'Enter a distance greater than zero.':undefined}/>
            <LabeledField label="Elapsed time (mm:ss)" value={duration} onChange={v=>{setDuration(v);setSaved(false);}} hint="Include time spent standing still." error={durationInvalid?'Use minutes and seconds, such as 32:10.':undefined}/>
            <FeedbackBanner tone="info" title="Keep your history accurate" detail="Saving a run and finishing a planned session are separate choices."/>
            <ActionButton label="Save example run" disabled={invalid||durationInvalid||!distance} onPress={()=>setSaved(true)}/>
            {saved&&<FeedbackBanner tone="success" title="Example saved" detail={`${distance} km in ${duration}. This stays in the gallery only.`}/>}<Copy size="caption" tone="text-muted">In the app, date, time zone and session linking are also required.</Copy></Stack>}
          {tab==='Components'&&<Stack><Heading>Component states</Heading><ActionButton label="Continue" onPress={()=>setNotice('Primary action pressed.')}/><ActionButton label="Secondary action" variant="secondary" onPress={()=>setNotice('Secondary action pressed.')}/><ActionButton label="Unavailable" disabled/><ActionButton label="Saving run" busy/>
            <LabeledField label="Distance with an error" value="0" onChange={()=>{}} error="Use a value greater than zero."/>
            <View style={styles.row}><StatusBadge label="Completed" tone="success"/><StatusBadge label="Waiting to sync" tone="warning"/><StatusBadge label="Needs attention" tone="danger"/></View>
            <FeedbackBanner tone="warning" title="Stored on this phone" detail="This example shows how a pending offline run will appear." action="Retry sync" onAction={()=>setNotice('No API is connected to this gallery.')}/>
            <ActivityCard title="Tuesday run" summary="5.2 km · 32:10 · Manual" status="Linked" onPress={()=>setNotice('Activity row pressed.')}/>
            <RecordingControls paused={paused} onToggle={()=>setPaused(!paused)} onFinish={()=>setSheet(true)}/>
            <Pressable ref={trigger} accessibilityRole="button" accessibilityLabel="Open confirmation example" onPress={()=>setSheet(true)} style={styles.trigger}><Copy size="label">Open confirmation example</Copy></Pressable>
            {notice&&<FeedbackBanner title="Gallery action" detail={notice}/>}</Stack>}
        </View>
      </View>
      {!narrow&&<View style={styles.sidebar}><Copy size="caption" tone="text-muted">01 / VISUAL SYSTEM</Copy><Heading>Less to decode.</Heading><Copy tone="text-muted">Neutral surfaces, readable targets and a single clear next action. Layout and language are original proposals.</Copy>
        <Panel><Copy size="heading">Color roles</Copy>{(['bg','surface','text','text-muted','accent','focus'] as const).map(role=><View key={role} style={styles.row}><View style={[styles.swatch,{backgroundColor:t.color[role]}]}/><Copy>{role}</Copy><Copy size="caption" tone="text-muted">{t.color[role]}</Copy></View>)}</Panel>
        <Panel><Copy size="heading">Today variants</Copy><View style={styles.row}>{['Planned','Completed','Rest day'].map(v=><ActionButton key={v} label={v} variant="secondary" onPress={()=>{setState(v);setTab('Today');}}/>)}</View></Panel>
        <Copy size="caption" tone="text-muted">Native primitives rendered through React Native Web. Device accessibility and native builds still need verification.</Copy></View>}
    </View>
    <ConfirmationSheet visible={sheet} title="Review this example?" detail="This confirmation tests the design primitive. It does not activate a plan or upload a run." confirmLabel="Confirm example" onConfirm={()=>{setSheet(false);setNotice('Example confirmed.');}} onCancel={()=>setSheet(false)} returnFocus={()=>trigger.current?.focus()}/>
  </ScrollView>;
}
const styles=StyleSheet.create({page:{padding:t.layout.gutter,gap:t.space[6],alignItems:'center'},header:{width:'100%',maxWidth:t.layout.galleryMax,gap:t.space[2]},layout:{width:'100%',maxWidth:t.layout.galleryMax,gap:t.space[7],alignItems:'flex-start'},phone:{width:'100%',backgroundColor:t.color.bg,borderWidth:t.layout.borderWidth,borderColor:t.color.border,borderRadius:t.radius.lg,overflow:'hidden'},phoneHead:{padding:t.space[5],flexDirection:'row',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:t.space[2]},phoneBody:{padding:t.space[5]},sidebar:{flex:1,gap:t.space[5]},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:t.space[3],flexWrap:'wrap'},swatch:{width:t.space[6],height:t.space[6],borderWidth:t.layout.borderWidth,borderColor:t.color['border-input'],borderRadius:t.radius.sm},trigger:{minHeight:t.layout.controlMin,justifyContent:'center',padding:t.space[4],borderWidth:t.layout.borderWidth,borderColor:t.color['border-input'],borderRadius:t.radius.md}});
createRoot(document.getElementById('root')!).render(<Gallery/>);
