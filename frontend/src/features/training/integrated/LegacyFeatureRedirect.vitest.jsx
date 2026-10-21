import {cleanup, render, screen} from '@testing-library/react';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router';
import {afterEach, expect, it} from 'vitest';
import {LegacyFeatureRedirect} from './ExistingPageRoutes';

afterEach(cleanup);
function Location(){const location=useLocation();return <output data-testid="destination">{location.pathname}{location.search}{location.hash}</output>;}
it.each([
 ['/training/messages?conversation=thread#message-1',false,'/profile/team?view=messages&conversation=thread#message-1'],
 ['/training-plan/plan/preview/version?athlete=runner#workout-2',true,'/schedule?athlete=runner&planView=preview&planId=plan&versionId=version#workout-2'],
])('retains the fragment from the legacy bookmark %s',async(source,plan,expected)=>{
 render(<MemoryRouter initialEntries={[source]}><Routes><Route path={plan?'/training-plan/*':'/training/*'} element={<LegacyFeatureRedirect plan={plan}/>}/><Route path="*" element={<Location/>}/></Routes></MemoryRouter>);
 expect(await screen.findByTestId('destination')).toHaveTextContent(expected);
});
