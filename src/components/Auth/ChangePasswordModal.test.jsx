import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChangePasswordModal from './ChangePasswordModal';
import * as authApi from '../../api/auth';

vi.mock('../../api/auth');

describe('ChangePasswordModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function fillAndSubmit(user, { current = 'currentpass123', next = 'brandnewpass456', confirm } = {}) {
    await user.type(screen.getByLabelText(/current password/i), current);
    await user.type(screen.getByLabelText(/^new password/i), next);
    await user.type(screen.getByLabelText(/confirm new password/i), confirm ?? next);
    await user.click(screen.getByRole('button', { name: /update password/i }));
  }

  it('rejects a new password shorter than 8 characters before calling the API', async () => {
    const user = userEvent.setup();
    render(<ChangePasswordModal onClose={vi.fn()} />);
    await fillAndSubmit(user, { next: 'short', confirm: 'short' });
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(authApi.changePassword).not.toHaveBeenCalled();
  });

  it('rejects a mismatched confirmation before calling the API', async () => {
    const user = userEvent.setup();
    render(<ChangePasswordModal onClose={vi.fn()} />);
    await fillAndSubmit(user, { next: 'brandnewpass456', confirm: 'somethingelse123' });
    expect(screen.getByText(/do not match/i)).toBeInTheDocument();
    expect(authApi.changePassword).not.toHaveBeenCalled();
  });

  it('calls changePassword and shows a success state when everything is valid', async () => {
    authApi.changePassword.mockResolvedValue({ status: 'password updated' });
    const user = userEvent.setup();
    render(<ChangePasswordModal onClose={vi.fn()} />);
    await fillAndSubmit(user);

    await waitFor(() => expect(authApi.changePassword).toHaveBeenCalledWith('currentpass123', 'brandnewpass456'));
    expect(await screen.findByText(/updated successfully/i)).toBeInTheDocument();
  });

  it('surfaces the server error (e.g. wrong current password) instead of a generic message', async () => {
    authApi.changePassword.mockRejectedValue(new Error('Current password is incorrect'));
    const user = userEvent.setup();
    render(<ChangePasswordModal onClose={vi.fn()} />);
    await fillAndSubmit(user);

    expect(await screen.findByText(/current password is incorrect/i)).toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ChangePasswordModal onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  describe('mandatory mode (forced reset)', () => {
    it('shows no Cancel button and no close (X) button -- genuinely non-dismissible', () => {
      render(<ChangePasswordModal mandatory onSuccess={vi.fn()} />);
      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/close/i)).not.toBeInTheDocument();
    });

    it('explains why, since the user did not ask to be here', () => {
      render(<ChangePasswordModal mandatory onSuccess={vi.fn()} />);
      expect(screen.getByText(/temporary password/i)).toBeInTheDocument();
    });

    it('calls onSuccess (not just onClose) once the password is actually changed', async () => {
      authApi.changePassword.mockResolvedValue({ status: 'password updated' });
      const onSuccess = vi.fn();
      const user = userEvent.setup();
      render(<ChangePasswordModal mandatory onSuccess={onSuccess} />);
      await fillAndSubmit(user);

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    });
  });
});
