import inventory from './screens.json';
const paths = ['welcome','map','filters','display','activities','activity','statistics','regions','routes','badges','photos','shares','settings','access','help','jobs','precision','square','downloads','recording','art','clubs','reports','route-edit','bulk','badge','eddington','tiles','provider-description','tile-compare','center','columns','reload','compare','gear','gear-cost','maintenance'];
export const SCREENS = inventory.map((screen, i) => ({ id: screen.screen_id, title: screen.name, release: screen.release, path: `/${paths[i]}` }));
export const screenForPath = path => SCREENS.find(screen => screen.path === `/${path.split('/').filter(Boolean)[0]}`) || SCREENS[0];
