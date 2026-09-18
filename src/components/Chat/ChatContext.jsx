import { createContext, useContext } from 'react';

// Shared chat state, owned by App: one messages list, one unread tracker, and one
// "open this conversation" request channel -- so the navbar drawer, the dashboard
// messenger, the bell and the toast can never disagree about what is unread.
export const ChatContext = createContext({
  messages: [],
  groups: [],
  unreadByChannel: {},
  totalUnread: 0,
  markRead: () => {},
  reportViewing: () => {},
  focusRequest: null
});

export const useChat = () => useContext(ChatContext);
