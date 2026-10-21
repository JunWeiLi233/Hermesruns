import {MAP_TOKENS as T} from './workoutMapTokens';
import {buildHitIndex,pickWorkouts,workoutHits,groupRouteParts,coverageTileBounds} from './workoutMapModel';
import {createHeatPipeline} from './workoutHeatPipeline';

export function createWorkoutMap(L,node,{onPick,onReady,onError,startLabel}) {
  // A native double-tap zoom must finish before the next explicit zoom command;
  // Leaflet's CSS zoom animation otherwise discards rapid button presses.
  const map=L.map(node,{zoomControl:false,attributionControl:false,preferCanvas:true,scrollWheelZoom:true,zoomAnimation:false,
    maxBounds:[[-85.051129,-180],[85.051129,180]],maxBoundsViscosity:1,maxZoom:20});
  L.control.attribution({position:'bottomright',prefix:false}).addTo(map);
  map.setView(T.worldCenter,T.worldZoom);
  const canvas=L.canvas({padding:T.padding,tolerance:T.hitRadius}),group=L.layerGroup().addTo(map),hover=L.layerGroup().addTo(map);
  const base='/api/maps/tiles/';
  const streets=L.tileLayer(base+'{z}/{x}/{y}.png',{maxNativeZoom:19,maxZoom:20,noWrap:true,className:'workout-map-streets',attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'});
  const dark=L.tileLayer(base+'esri-dark/{z}/{y}/{x}.png',{maxNativeZoom:16,maxZoom:20,noWrap:true,attribution:'Tiles &copy; Esri — Esri, HERE, Garmin, FAO, NOAA, USGS'});
  const labels=L.tileLayer(base+'esri-dark-labels/{z}/{y}/{x}.png',{maxNativeZoom:16,maxZoom:20,noWrap:true});
  let parts=[],preferences={},isolated=null,selected=[],selectedCells=[],index=new Map(),heatTiles=new Map(),heatZoom=-1,heatParts=null,heatBounds='',hoverId=null,dead=false,ready=false,complete=false,basemap=null,startMarker=null,frame=null;
  const pipeline=createHeatPipeline((tiles,method)=>{
    if(dead||!complete||preferences.mode!=='heat'||isolated)return;
    heatTiles=new Map(tiles.map(tile=>[tile.key,tile.data]));heat.redraw();node.dataset.heatState='ready';node.dataset.heatMethod=method;
  },()=>{if(!dead){node.dataset.heatState='error';onError?.();}});
  const Heat=L.GridLayer.extend({createTile(coords){
    const tile=L.DomUtil.create('canvas','workout-map-heat-tile');tile.width=tile.height=T.tileSize;
    const pixels=heatTiles.get(`${coords.x}:${coords.y}`);
    if(pixels){const context=tile.getContext('2d'),image=context.createImageData(T.tileSize,T.tileSize);image.data.set(pixels);context.putImageData(image,0,0);}return tile;
  }});
  const heat=new Heat({tileSize:T.tileSize,keepBuffer:1,updateWhenIdle:true,pane:'overlayPane',className:'workout-map-heat-grid'});
  const geometry=()=>isolated?selected:parts;
  const project=coordinate=>map.latLngToContainerPoint(coordinate);
  const refreshIndex=()=>{const size=map.getSize();index=buildHitIndex(geometry(),project,[-T.hitRadius,-T.hitRadius,size.x+T.hitRadius,size.y+T.hitRadius]);};
  const refreshHeat=()=>{
    if(dead||!complete||preferences.mode!=='heat'||isolated)return;
    const zoom=map.getZoom(),bounds=map.getBounds().pad(T.padding),nw=map.project(bounds.getNorthWest(),zoom),se=map.project(bounds.getSouthEast(),zoom);
    const box=[nw.x-T.heatHalo,nw.y-T.heatHalo,se.x+T.heatHalo,se.y+T.heatHalo],key=box.map(Math.floor).join(':');
    if(heatParts===parts&&heatZoom===zoom&&heatBounds===key)return;
    heatParts=parts;heatZoom=zoom;heatBounds=key;node.dataset.heatState='loading';pipeline.render({parts,zoom,bounds:box});
  };
  const draw=()=>{
    if(dead)return;frame=null;group.clearLayers();hover.clearLayers();hoverId=null;
    for(const cell of selectedCells){const bounds=coverageTileBounds(cell);if(map.getBounds().intersects(bounds))L.rectangle(bounds,{renderer:canvas,interactive:false,color:T.coverageOutline,weight:T.coverageWeight,fillColor:T.coverageFill,fillOpacity:T.coverageOpacity}).addTo(group);}
    node.dataset.newTileCells=String(selectedCells.length);
    const visible=geometry();if(preferences.mode==='lines'||isolated)for(const routes of groupRouteParts(visible).values()){
      const line=L.polyline(routes.map(part=>part.coordinates),{renderer:canvas,interactive:false,bubblingMouseEvents:true,
        smoothFactor:0,color:isolated?preferences.highlightColor:preferences.color,weight:preferences.weight,opacity:isolated?1:T.opacity});
      line.addTo(group);
    }
    if(preferences.mode==='heat'&&!isolated){if(!visible.length){heatTiles=new Map();heat.redraw();}refreshHeat();if(!map.hasLayer(heat))heat.addTo(map);}else{pipeline.cancel();heatParts=null;heat.remove();node.dataset.heatState='idle';}
    startMarker?.remove();startMarker=null;
    const first=isolated&&visible[0]?.coordinates?.[0];
    if(first)startMarker=L.marker(first,{icon:L.divIcon({className:'workout-map-start',html:'<span aria-hidden="true">S</span>'}),title:startLabel,keyboard:true}).addTo(map);
    if(complete||isolated)refreshIndex();else index=new Map();node.dataset.renderMode=isolated?'highlight':preferences.mode;node.dataset.routeParts=String(visible.length);node.dataset.renderZoom=String(map.getZoom());
  };
  const schedule=()=>{if(frame!==null)cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);};
  map.on('moveend',()=>{if(complete||isolated)refreshIndex();if(selectedCells.length)schedule();refreshHeat();node.dataset.renderZoom=String(map.getZoom());});
  map.on('resize',()=>{if(complete||isolated)refreshIndex();refreshHeat();});
  map.on('click',event=>{const hits=workoutHits(index,event.containerPoint);if(hits.ids.length)onPick(hits);});
  map.on('mousemove',event=>{
    const id=pickWorkouts(index,event.containerPoint)[0]||null;if(id===hoverId)return;hoverId=id;hover.clearLayers();node.style.cursor=id?'pointer':'';
    if(id&&!isolated){const routes=groupRouteParts(parts).get(id)||[];L.polyline(routes.map(part=>part.coordinates),{renderer:canvas,interactive:false,smoothFactor:0,color:preferences.hoverColor,weight:Number(preferences.weight)+T.hoverExtra,opacity:1}).addTo(hover);}
  });
  function setBasemap(value){if(value===basemap)return;basemap=value;streets.remove();dark.remove();labels.remove();
    if(value==='streets')streets.addTo(map);else{dark.addTo(map);labels.addTo(map);}node.dataset.basemap=value;
  }
  const resize=new ResizeObserver(()=>map.invalidateSize());resize.observe(node);
  return {
    update(next,prefs,selection,context={complete:true}){
      if(next!==parts||!context.complete){pipeline.cancel();heatParts=null;}
      parts=next;preferences=prefs;complete=context.complete;isolated=selection?.id||null;selected=selection?.segments||[];selectedCells=selection?.cells||[];
      if(prefs.mode==='heat'&&!complete)node.dataset.heatState='loading';
      setBasemap(prefs.basemap);schedule();
    },
    fit(bounds){if(bounds){map.stop();map.fitBounds([[bounds[0],bounds[1]],[bounds[2],bounds[3]]],{padding:[T.fitPadding,T.fitPadding],maxZoom:T.initialZoom,animate:false});}if(!ready){ready=true;onReady();}},
    zoom(delta){map.stop();map.setZoom(map.getZoom()+delta,{animate:false});},
    destroy(){dead=true;pipeline.destroy();resize.disconnect();if(frame!==null)cancelAnimationFrame(frame);map.remove();},
  };
}
