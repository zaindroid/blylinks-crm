// Direct-message channel ids use ':' and '|' -- characters that never appear in a user id --
// so a participant can be verified with plain prefix/suffix checks. Must match the server's
// identical helper in server/routes/messages.routes.js.
export const DM_PREFIX = 'dm:';

export function dmChannelId(userIdA, userIdB) {
  return `${DM_PREFIX}${[userIdA, userIdB].sort().join('|')}`;
}

export function isDmChannel(channelId) {
  return typeof channelId === 'string' && channelId.startsWith(DM_PREFIX);
}
