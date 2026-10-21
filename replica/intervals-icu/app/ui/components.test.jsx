import React from 'react';
import { afterEach, it, expect } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router';
import { DataTable, LineChart, QueryGate } from './components.jsx';
afterEach(cleanup);
it('keeps both traces when two sessions have the same display name', () => {
  render(<LineChart title="Repeated session names" series={[
    { name: 'HR', values: [110] },
    { name: 'HR', values: [130] }
  ]} />);
  fireEvent.click(screen.getByText('Read chart values'));
  expect(screen.getByRole('cell', { name: '110' })).toBeInTheDocument();
  expect(screen.getByRole('cell', { name: '130' })).toBeInTheDocument();
});
it('preserves unknown and zero values in the accessible data table', () => {
  render(<DataTable caption="Metrics" rows={[{
    name: 'Unknown',
    load: null
  }, {
    name: 'Zero',
    load: 0
  }]} columns={[{
    key: 'name',
    label: 'Name'
  }, {
    key: 'load',
    label: 'Load'
  }]} />);
  expect(screen.getByRole('cell', {
    name: '—'
  })).toBeInTheDocument();
  expect(screen.getByRole('cell', {
    name: '0'
  })).toBeInTheDocument();
});
it('suppresses protected children on an access error', () => {
  render(<MemoryRouter><QueryGate query={{
      error: {
        status: 404
      }
    }}>{() => <p>Private session</p>}</QueryGate></MemoryRouter>);
  expect(screen.queryByText('Private session')).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('current data access');
});
it('offers a keyboard-operable sample input and missing-data output', () => {
  render(<LineChart title="Gapped signal" series={[{
    name: 'HR',
    values: [110, null, 130]
  }]} />);
  fireEvent.change(screen.getByRole('spinbutton'), {
    target: {
      value: '1'
    }
  });
  expect(screen.getByRole('status')).toHaveTextContent('HR unavailable');
  fireEvent.click(screen.getByText('Read chart values'));
  expect(screen.getByRole('table')).toHaveAccessibleName('Gapped signal');
});
