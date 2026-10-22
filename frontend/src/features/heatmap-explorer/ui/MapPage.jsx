import { Link, useNavigate } from '../router.jsx';
import { useExplorer } from '../context.jsx';
import { civilDate, distance, duration, SPORTS } from '../core/model.js';
import TrackMap from './TrackMap.jsx';
import { EmptyHistory, PageHeading, ScopeBar, Summary } from './shared.jsx';
import { Badge, Button } from './primitives.jsx';
export default function MapPage({onImport,display}) {
  const {view,prefs,t}=useExplorer();const navigate=useNavigate();
  return <><PageHeading eyebrow={t('YOUR ACTIVITY ATLAS','你的活动地图')} title={t('Places become familiar.','足迹，串起熟悉的地方。')} description={t('Every track adds another piece of your world.','每段轨迹，都为你的世界增添一片风景。')}><Link className="sh-button" to="/display">{t('Display','地图显示')}</Link><Button variant="primary" onClick={onImport}>{t('Add activity files','添加活动文件')}</Button></PageHeading><ScopeBar/><Summary/>{!view.items.length?<EmptyHistory matches={view.historyCount>0} onImport={onImport}/>:<div className="ex-map-layout"><TrackMap activities={view.items} bounds={view.summary.bounds} {...display} onInspect={id=>navigate(`/activity/${id}`)}/><aside className="ex-track-list"><div className="sh-section-heading"><h2>{t('In this view','当前视图')}</h2><span className="sh-muted">{view.items.length}</span></div><ol>{view.items.slice(0,30).map(a=><li key={a.id}><span className="sh-small sh-muted">{civilDate(a.startTime,prefs.zone)} · {SPORTS[a.sport]}</span><Link to={`/activity/${a.id}`}>{a.name}</Link><div className="sh-row sh-between"><span>{distance(a.distanceKm,prefs.units)} {prefs.units} · {duration(a.movingSeconds)}</span>{!a.pointCount&&<Badge>{t('No GPS','无 GPS')}</Badge>}</div></li>)}</ol><Link to="/activities" className="sh-button">{t('Open activity history','打开活动历史')}</Link></aside></div>}</>;
}
