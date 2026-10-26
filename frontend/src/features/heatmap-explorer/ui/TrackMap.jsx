import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cellBounds, displaySegment } from '../core/geometry.js';
import { useExplorer } from '../context.jsx';
import { Button, Notice } from './primitives.jsx';
// Basemap is opt-in. The default map uses only local source geometry.
export default function TrackMap({activities,selectedId,mode='lines',showCells=true,basemap=false,onInspect,bounds}) {
  const node=useRef(null),map=useRef(null),layer=useRef(null),tiles=useRef(null);const [tileError,setTileError]=useState(false);const [limited,setLimited]=useState(false);const {theme,t,api,view,refresh}=useExplorer();
  const remote=api.mode==='server'&&!selectedId;
  const [overlay,setOverlay]=useState({tracks:[],cells:[],limited:false}),[mapError,setMapError]=useState('');
  const drawnActivities=remote?overlay.tracks:activities;
  useEffect(()=>{
    const instance=L.map(node.current,{preferCanvas:true,worldCopyJump:false,minZoom:2,maxZoom:18,zoomControl:false,attributionControl:true}).setView([40.78,-73.97],12);
    instance.attributionControl.setPrefix(false);instance.attributionControl.addAttribution('Activity geometry · your source files');
    L.control.zoom({position:'bottomright',zoomInTitle:'Zoom in',zoomOutTitle:'Zoom out'}).addTo(instance);
    map.current=instance;layer.current=L.layerGroup().addTo(instance);
    const element=node.current;const resize=new ResizeObserver(()=>{if(map.current===instance&&element.isConnected)instance.invalidateSize();});resize.observe(element);
    return()=>{resize.disconnect();instance.remove();map.current=null;};
  },[]);
  useEffect(()=>{
    if(!map.current)return;const points=activities.flatMap(a=>a.segments.flatMap(displaySegment));
    if(remote&&bounds)map.current.fitBounds([[bounds.south,bounds.west],[bounds.north,bounds.east]],{padding:[24,24],maxZoom:14,animate:false});
    else if(points.length)map.current.fitBounds(L.latLngBounds(points),{padding:[24,24],maxZoom:14,animate:false});
  },[activities,remote,bounds]);
  useEffect(()=>{
    const instance=map.current;if(!remote||!instance)return;let timer,controller,active=true;
    setOverlay({tracks:[],cells:[],limited:false});
    const load=()=>{clearTimeout(timer);controller?.abort();timer=setTimeout(async()=>{
      const pending=new AbortController();controller=pending;const viewport=instance.getBounds(),width=viewport.getEast()-viewport.getWest();
      const normalize=lon=>((lon+180)%360+360)%360-180;
      const west=width>=360?-180:normalize(viewport.getWest()),east=width>=360?180:normalize(viewport.getEast());
      const base={south:Math.max(-85.05112878,viewport.getSouth()),north:Math.min(85.05112878,viewport.getNorth())};
      const boxes=west>east?[{...base,west,east:180},{...base,west:-180,east}]:[{...base,west,east}];
      try{const results=await Promise.all(boxes.map(box=>api.getOverlay(box,view.revision,{signal:pending.signal})));if(!active||pending.signal.aborted)return;
        const tracks=new Map(),cells=new Map();for(const result of results){for(const track of result.tracks)tracks.set(track.id,track);for(const cell of result.cells)cells.set(`${cell.x}:${cell.y}`,cell);}
        setOverlay({tracks:[...tracks.values()],cells:[...cells.values()],limited:results.some(result=>result.limited)});setMapError('');
      }catch(error){if(active&&error.name!=='AbortError')setMapError(error.message);}
    },200);};
    instance.on('moveend',load);load();return()=>{active=false;clearTimeout(timer);controller?.abort();instance.off('moveend',load);};
  },[api,remote,view.revision]);
  useEffect(()=>{
    const instance=map.current;if(!instance)return;
    const draw=()=>{
      if(!node.current?.isConnected||map.current!==instance)return;
      const group=layer.current;group.clearLayers();const style=getComputedStyle(node.current);const color=name=>style.getPropertyValue(`--sh-${name}`).trim();
      const viewport=instance.getBounds();const center=instance.getCenter().lng;
      const visits=new Map();if(remote)for(const cell of overlay.cells)visits.set(`${cell.x}:${cell.y}`,cell.visits);
      else for(const activity of drawnActivities)for(const key of activity.cells)visits.set(key,(visits.get(key)||0)+1);
      let drawn=0;const cap=5000;
      if(showCells||mode==='density')for(const [key,count] of visits){const bounds=cellBounds(key);const longitude=(bounds[0][1]+bounds[1][1])/2;const offset=Math.round((center-longitude)/360)*360;
        const adjusted=bounds.map(([lat,lon])=>[lat,lon+offset]);if(!viewport.intersects(L.latLngBounds(adjusted)))continue;
        if(drawn>=cap)break;drawn++;
        L.rectangle(adjusted,{interactive:false,color:color('map-grid'),weight:mode==='density'?0:1,fillColor:color('track'),fillOpacity:mode==='density'?Math.min(.82,.12+count*.14):.09}).addTo(group);
      }
      setLimited(drawn===cap||remote&&overlay.limited);
      if(mode==='lines')for(const activity of drawnActivities)for(const segment of activity.segments){if(segment.length<2)continue;const points=displaySegment(segment);const selected=String(activity.id)===String(selectedId);
        if(selected)L.polyline(points,{color:color('track-halo'),weight:8,opacity:1,interactive:false}).addTo(group);
        const line=L.polyline(points,{color:color(selected?'track-selected':'track'),weight:selected?4:2,opacity:selected?1:.68,interactive:false,smoothFactor:1}).addTo(group);
        // The adjacent activity links provide the complete keyboard alternative.
        if(onInspect)line.on('click',()=>onInspect(activity.id));
      }
    };
    draw();instance.on('moveend',draw);return()=>instance.off('moveend',draw);
  },[drawnActivities,selectedId,mode,showCells,theme,onInspect,remote,overlay]);
  useEffect(()=>{
    if(!map.current)return;if(tiles.current){tiles.current.remove();tiles.current=null;}
    if(basemap){const layer=L.tileLayer(import.meta.env.VITE_BASEMAP_URL||'https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',updateWhenIdle:true,keepBuffer:0});layer.on('tileerror',()=>setTileError(true));layer.addTo(map.current);tiles.current=layer;}
    return()=>{tiles.current?.remove();tiles.current=null;};
  },[basemap]);
  function fit(){const points=activities.flatMap(a=>a.segments.flatMap(displaySegment));if(remote&&bounds)map.current.fitBounds([[bounds.south,bounds.west],[bounds.north,bounds.east]],{padding:[24,24],maxZoom:14,animate:false});else if(points.length)map.current.fitBounds(L.latLngBounds(points),{padding:[24,24],maxZoom:14,animate:false});}
  return <div className="ex-map-wrap"><div className="ex-map" ref={node} role="region" aria-label={t('Activity map. Use arrow keys to pan, plus and minus to zoom. Activity links below provide a text alternative.','活动地图。使用方向键平移，加减号缩放。下方活动链接提供文字替代。')}/><div className="ex-map-top"><Button onClick={fit} disabled={!activities.some(a=>a.pointCount)}>{t('Fit matching tracks','显示匹配轨迹')}</Button><span className="ex-map-legend">{mode==='density'?t('Darker cells = more activities','颜色越深，活动越多'):t('Recorded track lines','记录的轨迹线')}</span></div>{mapError&&<div className="ex-map-status"><Notice tone="danger">{mapError} <Button onClick={refresh}>{t('Reload selection','重新加载范围')}</Button></Notice></div>}{!basemap&&<span className="ex-map-local">{remote?t('Account geometry · street map off','账户轨迹 · 街道底图已关闭'):t('Local geometry · street map off','本地轨迹 · 街道底图已关闭')}</span>}{tileError&&basemap&&<div className="ex-map-status"><Notice tone="warning">{t('The street map could not load. Your activity tracks remain available.','街道底图加载失败，活动轨迹仍可查看。')} <Button onClick={()=>{setTileError(false);tiles.current?.redraw();}}>{t('Retry map','重试底图')}</Button></Notice></div>}{limited&&<div className="ex-map-status"><Notice>{t('Zoom in to see more cells. Totals still include the complete selection.','请放大以查看更多网格。汇总仍包括全部所选活动。')}</Notice></div>}</div>;
}
