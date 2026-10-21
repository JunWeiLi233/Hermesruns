import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { Link, RoutePrefixProvider } from './ui/router.jsx';
import { it, expect } from 'vitest';

function Location(){return <output data-testid="location">{useLocation().pathname}{useLocation().search}</output>;}
it('keeps activity deep links in native training routes and preserves the selected session',()=>{
  render(<MemoryRouter initialEntries={['/training/calendar']}><Routes><Route path="/training/*" element={<RoutePrefixProvider prefix="/training"><Link to="/activity?id=session-1">Open session</Link><Location/></RoutePrefixProvider>}/></Routes></MemoryRouter>);
  fireEvent.click(screen.getByRole('link',{name:'Open session'}));expect(screen.getByTestId('location')).toHaveTextContent('/training/activity?id=session-1');
});
