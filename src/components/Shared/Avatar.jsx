import React from 'react';

// A user's profile photo if they have one, otherwise a plain initial. Never a placeholder photo.
export default function Avatar({ user, className = '' }) {
  const name = user?.name || '';
  if (user?.avatar) {
    return <img src={user.avatar} alt={name} className={className} />;
  }
  return (
    <span className={`avatar-fallback ${className}`} role="img" aria-label={name || 'User'}>
      {name.trim().charAt(0) || '?'}
    </span>
  );
}
