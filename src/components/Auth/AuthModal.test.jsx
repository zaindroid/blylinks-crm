import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthModal from './AuthModal';
import * as authApi from '../../api/auth';

vi.mock('../../api/auth');

describe('AuthModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a loading state while checking bootstrap status', () => {
    authApi.checkBootstrapStatus.mockReturnValue(new Promise(() => {})); // never resolves
    render(<AuthModal isOpen onClose={() => {}} onAuthenticated={() => {}} />);
    expect(screen.getByText(/checking portal status/i)).toBeInTheDocument();
  });

  it('renders the bootstrap ("Set Up Your Organization") form when needsBootstrap is true', async () => {
    authApi.checkBootstrapStatus.mockResolvedValue({ needsBootstrap: true });
    render(<AuthModal isOpen onClose={() => {}} onAuthenticated={() => {}} />);
    await waitFor(() => expect(screen.getByText(/set up your organization/i)).toBeInTheDocument());
    expect(screen.queryByPlaceholderText(/your username/i)).not.toBeInTheDocument();
  });

  it('renders the plain login form when needsBootstrap is false, with no signup link', async () => {
    authApi.checkBootstrapStatus.mockResolvedValue({ needsBootstrap: false });
    render(<AuthModal isOpen onClose={() => {}} onAuthenticated={() => {}} />);
    await waitFor(() => expect(screen.getByText(/account login/i)).toBeInTheDocument());
    expect(screen.queryByText(/create organization/i)).not.toBeInTheDocument();
    expect(screen.getByText(/ask your admin or supervisor/i)).toBeInTheDocument();
  });

  it('submits login credentials and calls onAuthenticated on success', async () => {
    authApi.checkBootstrapStatus.mockResolvedValue({ needsBootstrap: false });
    authApi.login.mockResolvedValue({ id: 'usr_1', name: 'Agent Smith', role: 'Agent' });
    const onAuthenticated = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<AuthModal isOpen onClose={onClose} onAuthenticated={onAuthenticated} />);
    await waitFor(() => expect(screen.getByText(/account login/i)).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/your username/i), 'agentsmith');
    await user.type(screen.getByPlaceholderText('••••••••'), 'pass12345');
    await user.click(screen.getByRole('button', { name: /sign in to portal/i }));

    await waitFor(() => expect(authApi.login).toHaveBeenCalledWith('agentsmith', 'pass12345'));
    expect(onAuthenticated).toHaveBeenCalledWith({ id: 'usr_1', name: 'Agent Smith', role: 'Agent' });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the server error message and does not authenticate on failed login', async () => {
    authApi.checkBootstrapStatus.mockResolvedValue({ needsBootstrap: false });
    authApi.login.mockRejectedValue(new Error('Invalid username or password'));
    const onAuthenticated = vi.fn();
    const user = userEvent.setup();

    render(<AuthModal isOpen onClose={() => {}} onAuthenticated={onAuthenticated} />);
    await waitFor(() => expect(screen.getByText(/account login/i)).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/your username/i), 'wronguser');
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /sign in to portal/i }));

    await waitFor(() => expect(screen.getByText(/invalid username or password/i)).toBeInTheDocument());
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it('cannot submit the bootstrap form with a required field left empty', async () => {
    // All three fields carry the HTML `required` attribute, so the browser
    // itself blocks submission before any JS runs -- confirm the net effect:
    // the API is never called with a partially-filled form.
    authApi.checkBootstrapStatus.mockResolvedValue({ needsBootstrap: true });
    const user = userEvent.setup();
    render(<AuthModal isOpen onClose={() => {}} onAuthenticated={() => {}} />);
    await waitFor(() => expect(screen.getByText(/set up your organization/i)).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/full name/i), 'Only Name Filled');
    await user.click(screen.getByRole('button', { name: /create organization/i }));

    expect(authApi.bootstrapFirstAdmin).not.toHaveBeenCalled();
  });

  it('renders nothing when isOpen is false', () => {
    authApi.checkBootstrapStatus.mockResolvedValue({ needsBootstrap: false });
    const { container } = render(<AuthModal isOpen={false} onClose={() => {}} onAuthenticated={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
