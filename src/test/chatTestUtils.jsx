import React from 'react';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { ChatContext } from '../components/Chat/ChatContext';

export const ME = { id: 'usr_agent_1', name: 'Agent Smith', role: 'Agent' };
export const OTHER = { id: 'usr_agent_2', name: 'Agent Two', role: 'Agent', status: 'Active' };
export const GROUPS = [
  { id: 'announcements', name: 'Announcements' },
  { id: 'general-lounge', name: 'Sales Lounge' }
];

export const dmWithOther = ['usr_agent_1', 'usr_agent_2'].sort().join('|');

export function msg(overrides = {}) {
  return {
    id: `m_${Math.random().toString(36).slice(2)}`,
    channel: 'announcements',
    senderId: OTHER.id,
    senderName: OTHER.name,
    senderRole: 'Agent',
    text: 'hello',
    timestamp: '08:00 PM',
    createdAt: '2026-01-01T10:00:00.000Z',
    ...overrides
  };
}

export function chatValue(ctx = {}) {
  return {
    messages: [],
    groups: GROUPS,
    unreadByChannel: {},
    totalUnread: 0,
    markRead: vi.fn(),
    reportViewing: vi.fn(),
    consumeFocus: vi.fn(),
    focusRequest: null,
    ...ctx
  };
}

// Renders UI inside a ChatContext with sensible, overridable defaults.
export function renderWithChat(ui, ctx = {}) {
  const value = chatValue(ctx);
  const utils = render(<ChatContext.Provider value={value}>{ui}</ChatContext.Provider>);
  return { value, ...utils };
}
