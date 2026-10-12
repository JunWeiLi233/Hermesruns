import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useProfileIdentity from './useProfileIdentity';

const cachedApiJson = vi.fn();
let auth = { isAuthenticated: true, email: 'strava+4417@example.com' };

vi.mock('../api/resourceCache', () => ({ cachedApiJson: (...args) => cachedApiJson(...args) }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));

function Probe({ fallback }) {
  const { displayName, initials } = useProfileIdentity(fallback);
  return (
    <p>
      <span data-testid="name">{displayName}</span>
      <span data-testid="initials">{initials}</span>
    </p>
  );
}

beforeEach(() => {
  cachedApiJson.mockReset();
  auth = { isAuthenticated: true, email: 'strava+4417@example.com' };
});
afterEach(() => cleanup());

describe('the name and initial at the top right', () => {
  it('is the profile display name first, as every other page shows it, not the start of the address', async () => {
    cachedApiJson.mockResolvedValue({ displayName: 'Hermes Shared Runner', email: 'strava+4417@example.com' });

    render(<Probe fallback="Runner" />);

    await waitFor(() => expect(screen.getByTestId('initials')).toHaveTextContent('H'));
    expect(screen.getByTestId('name')).toHaveTextContent('Hermes Shared Runner');
    expect(cachedApiJson).toHaveBeenCalledWith('/api/profile/me');
  });

  it('stands in with the start of the address until the profile arrives', () => {
    cachedApiJson.mockReturnValue(new Promise(() => {}));

    render(<Probe fallback="Runner" />);

    expect(screen.getByTestId('initials')).toHaveTextContent('S');
    expect(screen.getByTestId('name')).toHaveTextContent('Strava+4417');
  });

  it('keeps the address when the profile cannot be read', async () => {
    cachedApiJson.mockRejectedValue(new Error('boom'));

    render(<Probe fallback="Runner" />);

    await waitFor(() => expect(cachedApiJson).toHaveBeenCalled());
    expect(screen.getByTestId('initials')).toHaveTextContent('S');
  });

  it('asks for nothing when nobody is signed in, and falls back to the given name', () => {
    auth = { isAuthenticated: false, email: '' };

    render(<Probe fallback="Runner" />);

    expect(cachedApiJson).not.toHaveBeenCalled();
    expect(screen.getByTestId('name')).toHaveTextContent('Runner');
    expect(screen.getByTestId('initials')).toHaveTextContent('R');
  });
});
