import { createContext, useCallback, useContext } from 'react';
import { Link as RouterLink, useNavigate as useRouterNavigate } from 'react-router';
import {trainingDestination} from '../destinations.mjs';
export { useSearchParams } from 'react-router';
const Prefix = createContext('/training');
const Native = createContext(null);
export function NativeTrainingRoutesProvider({athleteId,children}){return <Native.Provider value={{athleteId}}>{children}</Native.Provider>;}
export function RoutePrefixProvider({ prefix, children }) { return <Prefix.Provider value={prefix}>{children}</Prefix.Provider>; }
export function trainingPath(to, prefix = '/training') {
  if (typeof to === 'number') return to;
  if (typeof to === 'object' && to) return { ...to, pathname: trainingPath(to.pathname, prefix) };
  return typeof to === 'string' && to.startsWith('/') && !to.startsWith('//') && !to.startsWith(`${prefix}/`) && to !== prefix ? `${prefix}${to}` : to;
}
export function Link({ to, ...props }) { const prefix=useContext(Prefix),native=useContext(Native);return <RouterLink {...props} to={native?trainingDestination(to,native):prefix ? trainingPath(to,prefix) : to}/>; }
export function useNavigate() { const navigate=useRouterNavigate(),prefix=useContext(Prefix),native=useContext(Native);return useCallback((to,options)=>navigate(native?trainingDestination(to,native):prefix?trainingPath(to,prefix):to,options),[navigate,prefix,native]); }
