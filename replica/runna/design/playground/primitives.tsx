import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, findNodeHandle } from 'react-native';
import type { TextStyle, TextInputProps } from 'react-native';
import { tokens as t } from '../tokens';

const c = t.color;
const font = (name: keyof typeof t.type): TextStyle => ({ fontSize:t.type[name].size, lineHeight:t.type[name].line, fontWeight:String(t.type[name].weight) as TextStyle['fontWeight'] });
export function Copy({children, tone='text', size='body'}:{children:React.ReactNode; tone?:keyof typeof c; size?:keyof typeof t.type}) {
  return <Text style={[font(size),{color:c[tone],flexShrink:1}]}>{children}</Text>;
}
export function Heading({children}:{children:React.ReactNode}) { return <Text accessibilityRole="header" style={[font('title'),{color:c.text}]}>{children}</Text>; }
export function Stack({children}:{children:React.ReactNode}) {return <View style={s.stack}>{children}</View>;}
export function Panel({children}:{children:React.ReactNode}) {return <View style={s.panel}>{children}</View>;}

export function ActionButton({label,onPress,variant='primary',disabled=false,busy=false}:{label:string;onPress?:()=>void;variant?:'primary'|'secondary'|'ghost'|'danger';disabled?:boolean;busy?:boolean}) {
  const [focused,setFocused]=useState(false);
  const filled=variant==='primary'||variant==='danger';
  const bg=disabled?c.disabled:variant==='primary'?c.accent:variant==='danger'?c.danger:variant==='secondary'?c.surface:c.bg;
  const fg=disabled?c['on-disabled']:filled?c['on-accent']:c.text;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:disabled||busy,busy}}
    disabled={disabled||busy} onPress={onPress} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
    style={({pressed})=>[s.button,{backgroundColor:pressed&&!disabled&&variant==='primary'?c['accent-pressed']:bg,borderColor:focused?c.focus:variant==='secondary'?c['border-input']:bg,borderWidth:focused?t.layout.focusWidth:t.layout.borderWidth}]}>
    {busy&&<ActivityIndicator color={fg} size="small"/>}<Text style={[font('label'),{color:fg,textAlign:'center',flexShrink:1}]}>{label}</Text>
  </Pressable>;
}

export function WizardHeader({step,total,title,onBack}:{step:number;total:number;title:string;onBack:()=>void}) {
  return <Stack><View style={s.row}><ActionButton label="Back" variant="ghost" onPress={onBack}/><Copy tone="text-muted" size="caption">{`Step ${step} of ${total}`}</Copy></View>
    <Heading>{title}</Heading><View accessibilityRole="progressbar" accessibilityLabel="Plan setup" accessibilityValue={{min:0,max:total,now:step}} style={s.progressTrack}><View style={[s.progressFill,{width:`${step/total*100}%`}]}/></View></Stack>;
}

export function ChoiceCard({title,description,selected,onPress,disabled=false}:{title:string;description?:string;selected:boolean;onPress:()=>void;disabled?:boolean}) {
  const [focused,setFocused]=useState(false);
  return <Pressable accessibilityRole="radio" accessibilityLabel={[title,description].filter(Boolean).join('. ')} accessibilityState={{checked:selected,disabled}}
    disabled={disabled} onPress={onPress} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
    style={[s.choice,{backgroundColor:disabled?c.disabled:selected?c.selected:c.surface,borderColor:focused?c.focus:selected?c.accent:c['border-input'],borderWidth:focused?t.layout.focusWidth:t.layout.selectedBorderWidth}]}>
    <View style={s.row}><Copy size="label">{title}</Copy><Copy tone={disabled?'on-disabled':'accent'} size="caption">{selected?'Selected':disabled?'Unavailable':'Choose'}</Copy></View>
    {description&&<Copy tone="text-muted">{description}</Copy>}
  </Pressable>;
}

export function LabeledField({label,value,onChange,error,hint,disabled=false,...props}:{label:string;value:string;onChange:(value:string)=>void;error?:string;hint?:string;disabled?:boolean}&Omit<TextInputProps,'onChange'|'value'>) {
  const [focused,setFocused]=useState(false);
  return <Stack><Copy size="label">{label}</Copy><TextInput {...props} accessibilityLabel={label} accessibilityHint={error||hint}
    accessibilityState={{disabled}} editable={!disabled} value={value} onChangeText={onChange} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
    placeholderTextColor={c['text-muted']} style={[s.field,font('body'),{backgroundColor:disabled?c.disabled:c.surface,borderColor:focused?c.focus:error?c.danger:c['border-input'],borderWidth:focused?t.layout.focusWidth:t.layout.selectedBorderWidth}]}/>
    {(error||hint)&&<Text accessibilityLiveRegion="polite" style={[font('caption'),{color:error?c.danger:c['text-muted']}]}>{error?`Fix this: ${error}`:hint}</Text>}</Stack>;
}

const dayNames=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
export function WeekdayPicker({selected,onChange}:{selected:number[];onChange:(value:number[])=>void}) {
  return <View style={s.wrap}>{dayNames.map((name,index)=>{const checked=selected.includes(index+1);return <Pressable key={name}
    accessibilityRole="checkbox" accessibilityLabel={name} accessibilityState={{checked}} onPress={()=>onChange(checked?selected.filter(x=>x!==index+1):[...selected,index+1])}
    style={({pressed})=>[s.day,{backgroundColor:checked?c.accent:pressed?c.selected:c.surface,borderColor:c['border-input']}]}>
    <Text style={[font('label'),{color:checked?c['on-accent']:c.text}]}>{name.slice(0,3)}</Text></Pressable>;})}</View>;
}

export function PreferenceSelector({label,options,value,onChange}:{label:string;options:{value:string;title:string;description:string}[];value:string;onChange:(value:string)=>void}) {
  return <View accessibilityRole="radiogroup" accessibilityLabel={label} style={s.stack}><Copy size="heading">{label}</Copy>{options.map(option=><ChoiceCard key={option.value} title={option.title} description={option.description} selected={value===option.value} onPress={()=>onChange(option.value)}/>)}</View>;
}

export type Tone='neutral'|'success'|'warning'|'danger'|'info';
const tones:Record<Tone,{fg:string;bg:string}>={neutral:{fg:c['text-muted'],bg:c['surface-subtle']},success:{fg:c.success,bg:c['success-bg']},warning:{fg:c.warning,bg:c['warning-bg']},danger:{fg:c.danger,bg:c['danger-bg']},info:{fg:c.info,bg:c['info-bg']}};
export function StatusBadge({label,tone='neutral'}:{label:string;tone?:Tone}) {return <View style={[s.badge,{backgroundColor:tones[tone].bg}]}><Text style={[font('caption'),{color:tones[tone].fg}]}>{label}</Text></View>;}
export function Metric({label,value}:{label:string;value:string}) {return <View style={s.metric}><Text style={[font('heading'),{color:c.text,fontVariant:['tabular-nums']}]}>{value}</Text><Copy tone="text-muted" size="caption">{label}</Copy></View>;}

export function WorkoutCard({title,description,distance,duration,state='Planned',onOpen}:{title:string;description:string;distance:string;duration:string;state?:string;onOpen:()=>void}) {
  return <Panel><View style={s.row}><Copy size="caption" tone="text-muted">TODAY'S SESSION</Copy><StatusBadge label={state} tone={state==='Completed'?'success':'neutral'}/></View>
    <Heading>{title}</Heading><Copy tone="text-muted">{description}</Copy><View style={s.wrap}><Metric label="Distance" value={distance}/><Metric label="Expected time" value={duration}/></View>
    <ActionButton label="View session" onPress={onOpen}/></Panel>;
}

export function StepList({steps}:{steps:{title:string;target:string;current?:boolean}[]}) {return <Stack>{steps.map((step,index)=><View key={`${index}-${step.title}`} style={[s.step,{backgroundColor:step.current?c.selected:c.surface}]}>
  <View style={s.stepMark}><Copy size="label">{index+1}</Copy></View><View style={s.flex}><Copy size="label">{step.title}</Copy><Copy tone="text-muted">{step.target}</Copy>{step.current&&<Copy size="caption">Current step</Copy>}</View></View>)}</Stack>;}

export function ActivityCard({title,summary,status,onPress,selected=false}:{title:string;summary:string;status:string;onPress:()=>void;selected?:boolean}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${summary}. ${status}`} accessibilityState={{selected}} onPress={onPress}
    style={[s.choice,{backgroundColor:selected?c.selected:c.surface,borderColor:selected?c.accent:c.border,borderWidth:t.layout.borderWidth}]}>
    <View style={s.row}><Copy size="label">{title}</Copy><StatusBadge label={status} tone={status==='Waiting to sync'?'warning':status==='Linked'?'success':'neutral'}/></View><Copy tone="text-muted">{summary}</Copy>
  </Pressable>;
}

export function FeedbackBanner({title,detail,tone='info',action,onAction}:{title:string;detail:string;tone?:Tone;action?:string;onAction?:()=>void}) {
  return <View style={[s.banner,{backgroundColor:tones[tone].bg}]}><Text accessibilityLiveRegion="polite" style={[font('label'),{color:tones[tone].fg}]}>{title}</Text><Copy>{detail}</Copy>{action&&<ActionButton label={action} variant="secondary" onPress={onAction}/>}</View>;
}

type Focusable = {focus?:()=>void};
function moveFocus(target:unknown) {
  if (!target) return;
  if (Platform.OS==='web') (target as Focusable).focus?.();
  else {const handle=findNodeHandle(target as Parameters<typeof findNodeHandle>[0]);if(handle)AccessibilityInfo.setAccessibilityFocus(handle);}
}
export function ConfirmationSheet({visible,title,detail,confirmLabel,onConfirm,onCancel,destructive=false,busy=false,returnFocus}:{visible:boolean;title:string;detail:string;confirmLabel:string;onConfirm:()=>void;onCancel:()=>void;destructive?:boolean;busy?:boolean;returnFocus?:()=>void}) {
  const heading=useRef<React.ComponentRef<typeof Text>>(null);
  const previous=useRef(false);
  useEffect(()=>{if(previous.current&&!visible)returnFocus?.();previous.current=visible;},[visible,returnFocus]);
  return <Modal visible={visible} transparent animationType="none" onRequestClose={()=>{if(!busy)onCancel();}} onShow={()=>moveFocus(heading.current)}>
    <View style={s.backdrop}><View accessibilityViewIsModal style={s.sheet}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.stack}>
      <Text ref={heading} accessible accessibilityRole="header" style={[font('heading'),{color:c.text}]}>{title}</Text><Copy>{detail}</Copy>
      <ActionButton label={confirmLabel} variant={destructive?'danger':'primary'} busy={busy} onPress={onConfirm}/><ActionButton label="Keep editing" variant="secondary" disabled={busy} onPress={onCancel}/>
    </ScrollView></View></View>
  </Modal>;
}

export function RecordingControls({paused,onToggle,onFinish}:{paused:boolean;onToggle:()=>void;onFinish:()=>void}) {return <View style={s.stack}><ActionButton label={paused?'Resume run':'Pause run'} onPress={onToggle}/><ActionButton label="Finish run" variant="secondary" onPress={onFinish}/></View>;}
export function TabBar({tabs,value,onChange}:{tabs:string[];value:string;onChange:(value:string)=>void}) {return <View accessibilityRole="tablist" style={s.tabs}>{tabs.map(tab=><Pressable key={tab} accessibilityRole="tab" accessibilityLabel={tab} accessibilityState={{selected:tab===value}} onPress={()=>onChange(tab)} style={[s.tab,{backgroundColor:tab===value?c.selected:c.surface}]}><Copy size="label">{tab}</Copy></Pressable>)}</View>;}

const s=StyleSheet.create({
  stack:{gap:t.space[3]},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:t.space[3],flexWrap:'wrap'},wrap:{flexDirection:'row',flexWrap:'wrap',gap:t.space[2]},flex:{flex:1,gap:t.space[1]},
  panel:{backgroundColor:c.surface,borderRadius:t.radius.lg,padding:t.space[5],gap:t.space[4],borderWidth:t.layout.borderWidth,borderColor:c.border},
  button:{minHeight:t.layout.controlMin,paddingHorizontal:t.space[4],paddingVertical:t.space[3],borderRadius:t.radius.md,flexDirection:'row',gap:t.space[2],alignItems:'center',justifyContent:'center'},
  choice:{minHeight:t.layout.controlMin,padding:t.space[4],gap:t.space[2],borderRadius:t.radius.md},
  field:{minHeight:t.component.fieldMin,paddingHorizontal:t.space[4],paddingVertical:t.space[3],borderRadius:t.radius.md,color:c.text},
  day:{minWidth:t.layout.controlMin,minHeight:t.layout.controlMin,padding:t.space[3],borderRadius:t.radius.md,borderWidth:t.layout.borderWidth,alignItems:'center',justifyContent:'center'},
  progressTrack:{height:t.space[1],backgroundColor:c['surface-subtle'],borderRadius:t.radius.pill},progressFill:{height:t.space[1],backgroundColor:c.accent,borderRadius:t.radius.pill},
  badge:{borderRadius:t.radius.sm,paddingHorizontal:t.space[2],paddingVertical:t.space[1],alignSelf:'flex-start'},metric:{flexGrow:1,gap:t.space[1]},
  step:{flexDirection:'row',gap:t.space[3],padding:t.space[4],borderWidth:t.layout.borderWidth,borderColor:c.border,borderRadius:t.radius.md,alignItems:'flex-start'},stepMark:{width:t.component.stepMark,minHeight:t.component.stepMark,alignItems:'center',justifyContent:'center',backgroundColor:c['surface-subtle'],borderRadius:t.radius.sm},
  banner:{padding:t.space[4],gap:t.space[2],borderRadius:t.radius.md},
  backdrop:{flex:1,backgroundColor:c.bg,justifyContent:'center',alignItems:'center',padding:t.layout.gutter},sheet:{width:'100%',maxWidth:t.component.sheetMax,maxHeight:'90%',padding:t.space[5],backgroundColor:c.surface,borderRadius:t.radius.lg,borderWidth:t.layout.borderWidth,borderColor:c['border-input']},
  tabs:{flexDirection:'row',gap:t.space[1],padding:t.space[2],backgroundColor:c.surface,borderRadius:t.radius.md,flexWrap:'wrap'},tab:{minHeight:t.layout.tabMin,flexGrow:1,alignItems:'center',justifyContent:'center',paddingHorizontal:t.space[3],borderRadius:t.radius.sm}
});
