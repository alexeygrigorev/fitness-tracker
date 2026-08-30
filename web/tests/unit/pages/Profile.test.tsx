import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Profile from '@/pages/Profile';

const auth = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  user: {
    id: 7,
    username: 'verified@example.com',
    email: 'verified@example.com',
    display_name: 'Verified User',
    is_active: true,
    dark_mode: false,
    weight_kg: null,
    height_cm: null,
    age: null,
    goal: null,
    weekly_workouts: null,
  },
}));

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => ({ user: auth.user, updateProfile: auth.updateProfile }),
}));

describe('Profile', () => {
  it('shows the authenticated identity and saves owned profile fields', async () => {
    auth.updateProfile.mockResolvedValue({ ...auth.user, weight_kg: 82.5 });
    render(<Profile />);

    expect(screen.getByText('Verified User')).toBeInTheDocument();
    expect(screen.getByText('verified@example.com')).toBeInTheDocument();
    expect(screen.queryByText('Alex')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: '82.5' } });
    fireEvent.change(screen.getByLabelText('Height'), { target: { value: '181' } });
    fireEvent.change(screen.getByLabelText('Age'), { target: { value: '34' } });
    fireEvent.change(screen.getByLabelText('Primary Goal'), { target: { value: 'gain_muscle' } });
    fireEvent.change(screen.getByLabelText('Weekly Workouts Target'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(auth.updateProfile).toHaveBeenCalledWith({
      weight_kg: 82.5,
      height_cm: 181,
      age: 34,
      goal: 'gain_muscle',
      weekly_workouts: 4,
    }));
  });
});
