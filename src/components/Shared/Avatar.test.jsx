import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Avatar from './Avatar';

describe('Avatar', () => {
  it('shows the profile photo when the user has one', () => {
    render(<Avatar user={{ name: 'Ayesha Khan', avatar: 'https://example.com/me.png' }} className="user-avatar" />);
    expect(screen.getByRole('img', { name: 'Ayesha Khan' })).toHaveAttribute('src', 'https://example.com/me.png');
  });

  it('falls back to the initial -- never an <img> placeholder -- when there is no photo', () => {
    const { container } = render(<Avatar user={{ name: 'ayesha khan', avatar: null }} className="user-avatar" />);
    expect(container.querySelector('img')).toBeNull();
    const fallback = screen.getByRole('img', { name: 'ayesha khan' });
    expect(fallback).toHaveTextContent('a');
    expect(fallback).toHaveClass('avatar-fallback', 'user-avatar');
  });

  it('does not crash on a missing user or empty name', () => {
    render(<Avatar user={{ name: '', avatar: '' }} />);
    expect(screen.getByRole('img', { name: 'User' })).toHaveTextContent('?');
  });
});
