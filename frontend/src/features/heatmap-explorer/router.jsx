import { createContext, useContext } from 'react';
import { Link as HostLink, NavLink as HostNavLink, Navigate as HostNavigate, useLocation as useHostLocation, useNavigate as useHostNavigate } from 'react-router';
export { Route, Routes, useParams } from 'react-router';

const Base = createContext('');
function resolve(base, to) {
  if (!base || typeof to !== 'string' || !to.startsWith('/') || to.startsWith('//')) return to;
  if (to === '/access') return '/login';
  return to === '/map' || to === '/' ? base : `${base}${to}`;
}
export function ExplorerRoutesProvider({ basePath = '', children }) {
  return <Base.Provider value={basePath.replace(/\/$/, '')}>{children}</Base.Provider>;
}
export function Link({ to, ...props }) { return <HostLink {...props} to={resolve(useContext(Base), to)}/>; }
export function NavLink({ to, ...props }) { return <HostNavLink {...props} to={resolve(useContext(Base), to)}/>; }
export function Navigate({ to, ...props }) { return <HostNavigate {...props} to={resolve(useContext(Base), to)}/>; }
export function useNavigate() {
  const base = useContext(Base), navigate = useHostNavigate();
  return (to, options) => navigate(resolve(base, to), options);
}
export function useLocation() {
  const location = useHostLocation(), base = useContext(Base);
  if (!base) return location;
  const relative = location.pathname.slice(base.length);
  return { ...location, pathname: !relative || relative === '/' ? '/map' : relative };
}
