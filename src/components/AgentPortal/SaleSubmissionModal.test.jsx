import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SaleSubmissionModal from './SaleSubmissionModal';

const PROJECTS = [{ id: 'camp_1', name: 'US Solar Direct', status: 'Active' }];
const CURRENT_USER = { id: 'usr_agent_1', name: 'Agent Smith', role: 'Agent' };

function renderModal(props = {}) {
  return render(
    <SaleSubmissionModal
      isOpen
      onClose={vi.fn()}
      projects={PROJECTS}
      selectedCampaignId="camp_1"
      currentUser={CURRENT_USER}
      onSubmitSale={vi.fn()}
      {...props}
    />
  );
}

describe('SaleSubmissionModal', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <SaleSubmissionModal isOpen={false} onClose={vi.fn()} projects={PROJECTS} selectedCampaignId="camp_1" currentUser={CURRENT_USER} onSubmitSale={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('cannot submit while Name/Phone 1/Amount are missing (required fields block it)', async () => {
    const onSubmitSale = vi.fn();
    const user = userEvent.setup();
    renderModal({ onSubmitSale });

    await user.click(screen.getByRole('button', { name: /submit order/i }));

    expect(onSubmitSale).not.toHaveBeenCalled();
  });

  it('submits with the required fields filled and forwards the full field set, amount coerced to a number', async () => {
    const onSubmitSale = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal({ onSubmitSale, onClose });

    await user.type(screen.getByPlaceholderText(/johnathan sterling/i), 'Jane Doe');
    await user.type(screen.getByPlaceholderText(/\+1 \(555\) 000-0000/i), '5551234567');
    await user.type(screen.getByPlaceholderText(/e\.g\. 2500/i), '2500');
    await user.click(screen.getByRole('button', { name: /submit order/i }));

    expect(onSubmitSale).toHaveBeenCalledTimes(1);
    const submitted = onSubmitSale.mock.calls[0][0];
    expect(submitted.customerName).toBe('Jane Doe');
    expect(submitted.phone).toBe('5551234567');
    expect(submitted.amount).toBe(2500);
    expect(typeof submitted.amount).toBe('number');
    expect(onClose).toHaveBeenCalled();
  });

  it('shows Agent Name and Status as read-only, not user-editable fields', () => {
    renderModal();
    const agentNameInput = screen.getByDisplayValue('Agent Smith');
    expect(agentNameInput).toBeDisabled();
    const statusInput = screen.getByDisplayValue('Pending');
    expect(statusInput).toBeDisabled();
  });

  it('shows the active campaign name as a disabled field, not a free choice', () => {
    renderModal();
    const campaignInput = screen.getByDisplayValue('US Solar Direct');
    expect(campaignInput).toBeDisabled();
  });

  it('resets the form after a successful submit', async () => {
    const user = userEvent.setup();
    renderModal();

    const nameInput = screen.getByPlaceholderText(/johnathan sterling/i);
    await user.type(nameInput, 'Jane Doe');
    await user.type(screen.getByPlaceholderText(/\+1 \(555\) 000-0000/i), '5551234567');
    await user.type(screen.getByPlaceholderText(/e\.g\. 2500/i), '2500');
    await user.click(screen.getByRole('button', { name: /submit order/i }));

    expect(nameInput.value).toBe('');
  });
});
