import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import LoadingScreen from './components/LoadingScreen';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import AgentOverview from './components/AgentPortal/AgentOverview';
import SupervisorOverview from './components/SupervisorPortal/SupervisorOverview';
import AdminOverview from './components/AdminPortal/AdminOverview';
import SaleSubmissionModal from './components/AgentPortal/SaleSubmissionModal';
import AgentSalesTracker from './components/AgentPortal/AgentSalesTracker';
import AgentCallbacks from './components/AgentPortal/AgentCallbacks';
import AgentAttendanceHistory from './components/AgentPortal/AgentAttendanceHistory';
import AgentSalary from './components/AgentPortal/AgentSalary';
import QASalesApproval from './components/AdminPortal/QASalesApproval';
import AdminAttendance from './components/AdminPortal/AdminAttendance';
import AdminTargets from './components/AdminPortal/AdminTargets';
import AdminPayroll from './components/AdminPortal/AdminPayroll';
import AdminProjects from './components/AdminPortal/AdminProjects';
import LeadManagement from './components/Shared/LeadManagement';
import ReportsAnalytics from './components/Shared/ReportsAnalytics';
import KnowledgeBase from './components/Shared/KnowledgeBase';
import DncCheck from './components/Shared/DncCheck';
import DncManagement from './components/Shared/DncManagement';
import AccessControl from './components/AdminPortal/AccessControl';
import SupportTickets from './components/Shared/SupportTickets';
import TeamManagement from './components/Shared/TeamManagement';
import MessageGroupManagement from './components/Shared/MessageGroupManagement';
import TaskNotificationDrawer from './components/TaskNotificationDrawer';
import ChatDrawer from './components/Chat/ChatDrawer';
import { ChatContext } from './components/Chat/ChatContext';
import { useUnreadTracker } from './hooks/useUnreadTracker';
import AuthModal from './components/Auth/AuthModal';
import ChangePasswordModal from './components/Auth/ChangePasswordModal';
import SaleCelebration from './components/Shared/SaleCelebration';
import { requestNotificationPermission, showDesktopNotification } from './utils/notifications';
import { buildCelebration, countMySales } from './utils/celebration';

import { getToken, setToken, decodeToken } from './api/client';
import { logout as apiLogout } from './api/auth';
import { fetchUsers, createUser, deactivateUser, updateUserCampaigns, updateBaseSalary, resetUserPassword, updateUserRole } from './api/users';
import { fetchCampaigns, createCampaign, updateCampaign, toggleCampaignStatus } from './api/campaigns';
import { fetchSales, submitSale, approveSale, rejectSale } from './api/sales';
import { fetchAttendance, clockIn, clockOut, updateAttendanceStatus } from './api/attendance';
import { fetchTargets, updateTarget } from './api/targets';
import { fetchCallbacks, addCallback, completeCallback } from './api/callbacks';
import { fetchLeads, addLead, updateLeadStatus } from './api/leads';
import { fetchPayroll, togglePaymentStatus, generatePayroll, updatePayrollAdjustments } from './api/payroll';
import { fetchMessages, sendMessage } from './api/messages';
import { fetchMessageGroups, createMessageGroup, updateMessageGroupMembers, deleteMessageGroup } from './api/messageGroups';
import { fetchKbArticles, createKbArticle, updateKbArticle, deleteKbArticle } from './api/kb';
import { fetchTickets, addTicket, resolveTicket } from './api/tickets';

export default function App() {
  const [authChecking, setAuthChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  // Splash screen: shown for at least MIN_SPLASH_MS regardless of how fast
  // the auth check resolves, so it's actually seen rather than flickering
  // past on a fast connection -- then fades out into whichever screen
  // (dashboard or login) is actually ready underneath.
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);
  const splashMountedAt = useRef(performance.now());
  const [allUsers, setAllUsers] = useState([]);
  const [theme, setTheme] = useState('light');
  const [activeTab, setActiveTab] = useState('overview');

  // Core Data States — populated from the API once authenticated
  const [sales, setSales] = useState([]);
  const salesRef = useRef([]);
  useEffect(() => { salesRef.current = sales; }, [sales]);
  const [projects, setProjects] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [targets, setTargets] = useState([]);
  const [callbacks, setCallbacks] = useState([]);
  const [leads, setLeads] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [messages, setMessages] = useState([]);
  const [messageGroups, setMessageGroups] = useState([]);
  const [kbArticles, setKbArticles] = useState([]);
  const [tickets, setTickets] = useState([]);

  // Active Campaign State
  const [selectedCampaignId, setSelectedCampaignId] = useState('camp_1');

  // Modals & UI States
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [latestNotification, setLatestNotification] = useState(null);
  const [celebration, setCelebration] = useState(null);

  // Chat drawer state: 'closed' | 'open' | 'minimized'
  const [chatPanelState, setChatPanelState] = useState('closed');
  const chatPanelStateRef = useRef(chatPanelState);
  useEffect(() => { chatPanelStateRef.current = chatPanelState; }, [chatPanelState]);
  const seenMessageIds = useRef(new Set());
  const messagesInitialized = useRef(false);

  // The background poll is a long-lived closure; it reads the *current* user through
  // this ref so a role change made by an Admin is picked up without re-creating it.
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  const openChatToRef = useRef(() => {});

  // Shared chat state: which conversations have unread messages, which conversation
  // is on screen right now, and a "please open this conversation" request that a
  // notification click can raise for whichever chat window is available.
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const { unreadByChannel, totalUnread, markRead } = useUnreadTracker(currentUser?.id, messages, messagesLoaded);
  const [chatFocus, setChatFocus] = useState(null);
  const viewingRef = useRef({});
  const reportViewing = useCallback((source, channel) => { viewingRef.current[source] = channel; }, []);
  const consumeFocus = useCallback((nonce) => setChatFocus(f => (f && f.nonce === nonce ? null : f)), []);
  const chatGroups = useMemo(
    () => messageGroups.filter(g => (g.memberIds || []).includes(currentUser?.id)),
    [messageGroups, currentUser?.id]
  );
  const chatContextValue = useMemo(() => ({
    messages, groups: chatGroups, unreadByChannel, totalUnread, markRead, reportViewing, focusRequest: chatFocus, consumeFocus
  }), [messages, chatGroups, unreadByChannel, totalUnread, markRead, reportViewing, chatFocus, consumeFocus]);

  // Ask for desktop notification permission once, up front
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    if (authChecking) return undefined;
    const MIN_SPLASH_MS = 2600;
    const elapsed = performance.now() - splashMountedAt.current;
    const remaining = Math.max(MIN_SPLASH_MS - elapsed, 0);
    const timer = setTimeout(() => setSplashFading(true), remaining);
    return () => clearTimeout(timer);
  }, [authChecking]);

  // Silently restore a session from a stored JWT, if any
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAuthChecking(false);
      return;
    }
    const payload = decodeToken(token);
    if (!payload) {
      setToken(null);
      setAuthChecking(false);
      return;
    }
    fetchUsers()
      .then(users => {
        const match = users.find(u => u.id === payload.sub);
        if (match) {
          setAllUsers(users);
          setCurrentUser(match);
        } else {
          setToken(null);
        }
      })
      .catch(err => {
        // A still-valid token whose account is mid-forced-reset gets 403'd on
        // every endpoint except change-password (server-enforced, not just a
        // frontend nudge) -- that's a real, valid session, not an invalid one.
        // Restore it straight into the mandatory-change gate instead of
        // discarding the token and bouncing back to the login screen.
        if (err.mustChangePassword) {
          setCurrentUser({ id: payload.sub, role: payload.role, mustChangePassword: true });
        } else {
          setToken(null);
        }
      })
      .finally(() => setAuthChecking(false));
  }, []);

  // Once authenticated, load every resource the portal needs
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    (async () => {
      try {
        const [users, campaignsData, salesData, attendanceData, targetsData, callbacksData, leadsData, payrollData, messagesData, groupsData, kbData, ticketsData] = await Promise.all([
          fetchUsers(), fetchCampaigns(), fetchSales(), fetchAttendance(), fetchTargets(),
          fetchCallbacks(), fetchLeads(), fetchPayroll(), fetchMessages(),
          fetchMessageGroups({ all: currentUser.role === 'Admin' }), fetchKbArticles(), fetchTickets()
        ]);
        if (cancelled) return;
        setAllUsers(users);
        setProjects(campaignsData);
        setSales(salesData);
        setAttendanceLogs(attendanceData);
        setTargets(targetsData);
        setCallbacks(callbacksData);
        setLeads(leadsData);
        setPayroll(payrollData);
        setMessages(messagesData);
        messagesData.forEach(m => seenMessageIds.current.add(m.id));
        messagesInitialized.current = true;
        setMessagesLoaded(true);
        setMessageGroups(groupsData);
        setKbArticles(kbData);
        setTickets(ticketsData);
      } catch (err) {
        console.error('Failed to load portal data', err);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  // Background sync: other users' actions (approvals, payroll, attendance edits, etc.)
  // don't push to this tab on their own, so poll the shared data every few seconds
  // and surface a notification if one of *my* sales just got reviewed.
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    seenMessageIds.current = new Set();
    messagesInitialized.current = false;

    const interval = setInterval(async () => {
      try {
        const me = currentUserRef.current;
        const [usersData, salesData, campaignsData, attendanceData, payrollData, callbacksData, leadsData, ticketsData, messagesData, groupsData] = await Promise.all([
          fetchUsers(), fetchSales(), fetchCampaigns(), fetchAttendance(), fetchPayroll(), fetchCallbacks(), fetchLeads(), fetchTickets(),
          fetchMessages(), fetchMessageGroups({ all: me.role === 'Admin' })
        ]);
        if (cancelled) return;

        // An Admin can change anyone's role at any time (and the server honours it on the
        // very next request) -- so keep the user list fresh and, if *my* role just changed,
        // switch this session over to the right portal instead of leaving it half-working.
        setAllUsers(usersData);
        const freshMe = usersData.find(u => u.id === me.id);
        if (freshMe && freshMe.role !== me.role) {
          setCurrentUser(freshMe);
          setActiveTab('overview');
        }

        if (me.role === 'Agent') {
          const prevSales = salesRef.current;
          for (const freshSale of salesData) {
            if (freshSale.agentId !== me.id) continue;
            const prior = prevSales.find(s => s.id === freshSale.id);
            if (prior && prior.status === 'Pending' && freshSale.status !== 'Pending') {
              const notif = {
                title: freshSale.status === 'Approved' ? 'Sale Approved' : 'Sale Rejected',
                message: `${freshSale.id} for ${freshSale.customerName} was ${freshSale.status.toLowerCase()} by ${freshSale.verifiedBy || 'a reviewer'}`,
                time: 'Just now',
                read: false,
                type: freshSale.status === 'Approved' ? 'success' : 'alert'
              };
              setNotifications(n => [notif, ...n]);
              setLatestNotification(notif);
              showDesktopNotification(notif.title, notif.message);
            }
          }
        }
        setSales(salesData);

        setProjects(campaignsData);
        setAttendanceLogs(attendanceData);
        setPayroll(payrollData);
        setCallbacks(callbacksData);
        setLeads(leadsData);
        setTickets(ticketsData);

        if (!messagesInitialized.current) {
          messagesData.forEach(m => seenMessageIds.current.add(m.id));
          messagesInitialized.current = true;
        } else {
          const incoming = messagesData.filter(m => m.senderId !== me.id && !seenMessageIds.current.has(m.id));
          if (incoming.length > 0) {
            incoming.forEach(m => seenMessageIds.current.add(m.id));
            // The unread badges/counts come from useUnreadTracker. This block only decides
            // whether to *interrupt* the user: no toast for a message in the conversation
            // they are looking at right now (it just appears in the thread) -- unless the
            // tab is in the background, where it's the only way they'd find out.
            const viewing = Object.values(viewingRef.current);
            const notifiable = document.hidden ? incoming : incoming.filter(m => !viewing.includes(m.channel));
            if (notifiable.length > 0) {
              const latest = notifiable[notifiable.length - 1];
              const groupName = groupsData.find(g => g.id === latest.channel)?.name;
              const from = groupName ? `${latest.senderName} in ${groupName}` : latest.senderName;
              // `channel` is what lets clicking the toast / bell entry open that exact conversation.
              const notif = notifiable.length === 1
                ? { title: `New message from ${from}`, message: latest.text, time: 'Just now', read: false, type: 'message', channel: latest.channel }
                : { title: `${notifiable.length} new messages`, message: `Latest from ${from}: ${latest.text}`, time: 'Just now', read: false, type: 'message', channel: latest.channel };
              setNotifications(n => [notif, ...n]);
              setLatestNotification(notif);
              showDesktopNotification(notif.title, notif.message, () => openChatToRef.current(notif));
            }
          }
        }
        setMessages(messagesData);
        setMessageGroups(groupsData);
      } catch (err) {
        console.error('Background sync failed', err);
      }
    }, 8000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentUser?.id]);

  // Ensure selected campaign is allowed for logged in user
  useEffect(() => {
    if (currentUser?.role === 'Agent') {
      const allowed = projects.filter(p => currentUser.allowedCampaignIds?.includes(p.id));
      if (allowed.length > 0 && !currentUser.allowedCampaignIds?.includes(selectedCampaignId)) {
        setSelectedCampaignId(allowed[0].id);
      }
    }
  }, [currentUser, projects]);

  // Toggle Theme Class on Root
  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleAuthenticated = (user) => {
    setCurrentUser(user);
    setActiveTab('overview');
  };

  const handleLogout = () => {
    apiLogout();
    setCurrentUser(null);
    setAllUsers([]);
    setSales([]);
    setProjects([]);
    setAttendanceLogs([]);
    setTargets([]);
    setCallbacks([]);
    setLeads([]);
    setPayroll([]);
    setMessages([]);
    setMessagesLoaded(false);
    setChatFocus(null);
    setKbArticles([]);
    setTickets([]);
    setActiveTab('overview');
  };

  // Chat Drawer Handlers
  const handleOpenChat = () => {
    setChatPanelState('open');
  };

  // Clicking a message notification (toast, bell entry or desktop alert) lands you in
  // that exact conversation. On the dashboard the floating messenger is already the
  // chat window, so use it; anywhere else (or if the drawer is already open) use the
  // navbar drawer, which exists on every page.
  const handleOpenNotification = (notif) => {
    setNotifications(list => list.map(n => (n === notif ? { ...n, read: true } : n)));
    if (latestNotification === notif) setLatestNotification(null);
    if (!notif?.channel) return;
    const target = activeTab === 'overview' && chatPanelState !== 'open' ? 'inline' : 'drawer';
    setChatFocus({ channel: notif.channel, target, nonce: `${Date.now()}-${Math.random()}` });
    if (target === 'drawer') setChatPanelState('open');
  };
  openChatToRef.current = handleOpenNotification;

  const handleMinimizeChat = () => {
    setChatPanelState('minimized');
  };

  const handleCloseChat = () => {
    setChatPanelState('closed');
  };

  // Derive attendance status for the current agent from fetched logs (no separate state to drift)
  const myOpenAttendanceLog = currentUser
    ? attendanceLogs.find(l => l.agentId === currentUser.id && l.clockOut === '--:--')
    : null;
  const agentAttendanceStatus = myOpenAttendanceLog ? myOpenAttendanceLog.status : 'Clocked Out';

  // Clock Actions
  const handleClockAction = async (action) => {
    try {
      if (action === 'Clock In') {
        await clockIn();
      } else if (action === 'Clock Out') {
        await clockOut();
      }
      setAttendanceLogs(await fetchAttendance());
    } catch (err) {
      console.error('Clock action failed', err);
    }
  };

  const dismissCelebration = useCallback(() => setCelebration(null), []);

  // Sale Handlers
  const handleSubmitSale = async (newSale) => {
    try {
      const saved = await submitSale({
        campaignId: selectedCampaignId,
        ...newSale
      });
      const [freshSales, freshCampaigns] = await Promise.all([fetchSales(), fetchCampaigns()]);
      setSales(freshSales);
      setProjects(freshCampaigns);
      const notif = {
        title: 'QA Review Required',
        message: `${saved.agentName} logged deal ${saved.id}${saved.amount > 0 ? ` (Rs. ${saved.amount.toLocaleString()})` : ''}`,
        time: 'Just now',
        read: false,
        type: 'alert'
      };
      setNotifications([notif, ...notifications]);
      setLatestNotification(notif);
      showDesktopNotification(notif.title, notif.message);
      const mine = countMySales(freshSales, currentUser.id);
      const campaign = freshCampaigns.find(c => c.id === (saved.campaignId || selectedCampaignId));
      // The agent's own monthly target (set by their Admin/Supervisor) is what they are chasing, so
      // it wins; without one, fall back to the campaign's team goal.
      const personalTarget = targets.find(t => t.agentId === currentUser.id)?.monthlySalesTarget || 0;
      const usePersonal = personalTarget > 0;
      setCelebration(buildCelebration({
        agentName: currentUser.name,
        campaignName: campaign?.name,
        salesToday: Math.max(1, mine.today),
        salesThisMonth: Math.max(1, mine.month),
        goal: usePersonal ? personalTarget : (campaign?.monthlySalesGoal || 0),
        goalProgress: usePersonal ? Math.max(1, mine.month) : (campaign?.monthSalesCount || 0),
        goalKind: usePersonal ? 'personal' : 'campaign'
      }));
    } catch (err) {
      console.error('Failed to submit sale', err);
    }
  };

  const handleApproveSale = async (saleId, qaNote) => {
    await approveSale(saleId, qaNote);
    setSales(await fetchSales());
    setProjects(await fetchCampaigns());
  };

  const handleRejectSale = async (saleId, qaNote) => {
    await rejectSale(saleId, qaNote);
    setSales(await fetchSales());
  };

  // Callback Handlers
  const handleAddCallback = async (newCb) => {
    await addCallback({
      campaignId: selectedCampaignId,
      customerName: newCb.customerName,
      phone: newCb.phone,
      dueDate: newCb.dueDate,
      priority: newCb.priority,
      notes: newCb.notes
    });
    setCallbacks(await fetchCallbacks());
  };

  const handleCompleteCallback = async (cbId) => {
    await completeCallback(cbId);
    setCallbacks(await fetchCallbacks());
  };

  // Lead Handlers
  const handleAddLead = async (newLead) => {
    await addLead({
      campaignId: selectedCampaignId,
      name: newLead.name,
      phone: newLead.phone,
      email: newLead.email,
      address: newLead.address,
      assignedAgentId: newLead.assignedAgentId,
      notes: newLead.notes
    });
    setLeads(await fetchLeads());
  };

  const handleUpdateLeadStatus = async (leadId, newStatus) => {
    await updateLeadStatus(leadId, newStatus);
    setLeads(await fetchLeads());
  };

  // Attendance Handlers
  const handleUpdateAttendance = async (logId, newStatus) => {
    await updateAttendanceStatus(logId, newStatus);
    setAttendanceLogs(await fetchAttendance());
  };

  // Target Handlers
  // Payroll Handlers
  const handleTogglePaymentStatus = async (payrollId) => {
    await togglePaymentStatus(payrollId);
    setPayroll(await fetchPayroll());
  };

  const handleGeneratePayroll = async (month) => {
    await generatePayroll(month);
    setPayroll(await fetchPayroll());
  };

  const handleUpdatePayrollAdjustments = async (payrollId, adjustments) => {
    await updatePayrollAdjustments(payrollId, adjustments);
    setPayroll(await fetchPayroll());
  };

  const handleUpdateBaseSalary = async (userId, baseSalaryPkr) => {
    await updateBaseSalary(userId, baseSalaryPkr);
    setAllUsers(await fetchUsers());
  };

  // Team / User Handlers
  const handleAddUser = async (payload) => {
    await createUser(payload);
    setAllUsers(await fetchUsers());
  };

  const handleDeactivateUser = async (userId) => {
    await deactivateUser(userId);
    setAllUsers(await fetchUsers());
  };

  const handleUpdateUserCampaigns = async (userId, campaignIds) => {
    await updateUserCampaigns(userId, campaignIds);
    setAllUsers(await fetchUsers());
  };

  // Knowledge base documents (Admin / Supervisor)
  const handleCreateKbArticle = async (payload) => {
    await createKbArticle(payload);
    setKbArticles(await fetchKbArticles());
  };

  const handleUpdateKbArticle = async (id, payload) => {
    await updateKbArticle(id, payload);
    setKbArticles(await fetchKbArticles());
  };

  const handleDeleteKbArticle = async (id) => {
    await deleteKbArticle(id);
    setKbArticles(await fetchKbArticles());
  };

  // Individual monthly sales-count target for an agent (Admin: any agent, Supervisor: their own agents).
  const handleUpdateSalesTarget = async (agentId, monthlySalesTarget) => {
    await updateTarget(agentId, { monthlySalesTarget });
    setTargets(await fetchTargets());
  };

  const handleChangeRole = async (userId, role) => {
    await updateUserRole(userId, role);
    setAllUsers(await fetchUsers());
  };

  const handleResetPassword = async (userId) => {
    const result = await resetUserPassword(userId);
    setAllUsers(await fetchUsers());
    return result;
  };

  // Project Handlers
  const handleAddProject = async (newProj) => {
    await createCampaign({
      id: newProj.id,
      name: newProj.name,
      client: newProj.client,
      category: newProj.category,
      monthlySalesGoal: newProj.monthlySalesGoal,
      assignedAgentIds: newProj.assignedAgentIds
    });
    setProjects(await fetchCampaigns());
  };

  const handleUpdateProject = async (projId, updatedData) => {
    await updateCampaign(projId, updatedData);
    setProjects(await fetchCampaigns());
  };

  const handleToggleProjectStatus = async (projId) => {
    await toggleCampaignStatus(projId);
    setProjects(await fetchCampaigns());
  };

  // Messaging Handler
  // Sending a message is your own action -- it must never generate a notification
  // back to yourself. Notifications for incoming messages from other people are
  // handled separately, by the messenger widgets that poll for them.
  const handleSendMessage = async (newMsg) => {
    await sendMessage(newMsg.channel, newMsg.text, newMsg.recipientId);
    setMessages(await fetchMessages());
  };

  // Group Handlers (Admin/Supervisor manage who can see which channels)
  const handleCreateMessageGroup = async (payload) => {
    await createMessageGroup(payload);
    setMessageGroups(await fetchMessageGroups({ all: currentUser.role === 'Admin' }));
  };

  const handleUpdateMessageGroupMembers = async (groupId, memberIds) => {
    await updateMessageGroupMembers(groupId, memberIds);
    setMessageGroups(await fetchMessageGroups({ all: currentUser.role === 'Admin' }));
  };

  const handleDeleteMessageGroup = async (groupId) => {
    await deleteMessageGroup(groupId);
    setMessageGroups(await fetchMessageGroups({ all: currentUser.role === 'Admin' }));
  };

  // Ticket Handlers
  const handleAddTicket = async (newT) => {
    await addTicket({
      subject: newT.subject,
      category: newT.category,
      priority: newT.priority,
      description: newT.description
    });
    setTickets(await fetchTickets());
  };

  const handleResolveTicket = async (tickId) => {
    await resolveTicket(tickId);
    setTickets(await fetchTickets());
  };

  const pendingQaCount = sales.filter(s => s.status === 'Pending').length;

  // The splash screen (below, in the outer return) covers the full viewport
  // until it fades out, so what renders here during authChecking doesn't
  // matter visually -- null keeps it cheap.
  function renderContent() {
  if (authChecking) {
    return null;
  }

  if (!currentUser) {
    return <AuthModal isOpen closable={false} onClose={() => {}} onAuthenticated={handleAuthenticated} />;
  }

  // Enforced server-side too (blockIfMustChangePassword rejects every other
  // endpoint while this is true) -- this just gives it a coherent UI instead
  // of every API call silently 403ing until they figure out why.
  if (currentUser.mustChangePassword) {
    return (
      <ChangePasswordModal
        mandatory
        onSuccess={async () => {
          // currentUser may only be the minimal { id, role } shape restored
          // from a page refresh mid-reset (fetchUsers() was blocked until
          // just now) -- re-fetch rather than just flipping the flag in
          // place, so the rest of the app gets a fully-populated user.
          const users = await fetchUsers();
          const match = users.find(u => u.id === currentUser.id);
          setAllUsers(users);
          setCurrentUser(match || { ...currentUser, mustChangePassword: false });
        }}
      />
    );
  }

  return (
    <ChatContext.Provider value={chatContextValue}>
    <div className="app-container">
      <Sidebar
        currentRole={currentUser.role}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingQaCount={pendingQaCount}
      />

      <div className="main-wrapper">
        <Navbar
          currentUser={currentUser}
          onLogout={handleLogout}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          notifications={notifications}
          onClearNotifications={() => setNotifications([])}
          attendanceStatus={agentAttendanceStatus}
          onClockAction={handleClockAction}
          projects={projects}
          selectedCampaignId={selectedCampaignId}
          onSelectCampaign={setSelectedCampaignId}
          onToggleChat={handleOpenChat}
          chatUnreadCount={totalUnread}
          onOpenNotification={handleOpenNotification}
        />

        <main className="content-area">
          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === 'overview' && (
            currentUser.role === 'Agent' ? (
              <AgentOverview
                currentUser={currentUser}
                users={allUsers}
                sales={sales}
                targets={targets}
                callbacks={callbacks}
                attendanceStatus={agentAttendanceStatus}
                onClockAction={handleClockAction}
                onOpenSaleModal={() => setIsSaleModalOpen(true)}
                onOpenCallbackModal={() => {}}
                onCompleteCallback={handleCompleteCallback}
                setActiveTab={setActiveTab}
                selectedCampaignId={selectedCampaignId}
                projects={projects}
                onOpenChat={handleOpenChat}
                onSendMessage={handleSendMessage}
              />
            ) : currentUser.role === 'Supervisor' ? (
              <SupervisorOverview
                currentUser={currentUser}
                sales={sales}
                users={allUsers}
                attendanceLogs={attendanceLogs}
                onApproveSale={handleApproveSale}
                onRejectSale={handleRejectSale}
                setActiveTab={setActiveTab}
                selectedCampaignId={selectedCampaignId}
                projects={projects}
                onSendMessage={handleSendMessage}
              />
            ) : (
              <AdminOverview
                currentUser={currentUser}
                sales={sales}
                users={allUsers}
                projects={projects}
                attendanceLogs={attendanceLogs}
                onApproveSale={handleApproveSale}
                onRejectSale={handleRejectSale}
                setActiveTab={setActiveTab}
                selectedCampaignId={selectedCampaignId}
                onSendMessage={handleSendMessage}
              />
            )
          )}

          {/* AGENT TABS */}
          {activeTab === 'my-sales' && (
            <AgentSalesTracker
              currentUser={currentUser}
              sales={sales.filter(s => s.campaignId === selectedCampaignId)}
              onOpenSaleModal={() => setIsSaleModalOpen(true)}
            />
          )}

          {activeTab === 'callbacks' && (
            <AgentCallbacks
              currentUser={currentUser}
              callbacks={callbacks}
              onAddCallback={handleAddCallback}
              onCompleteCallback={handleCompleteCallback}
            />
          )}

          {activeTab === 'attendance' && (
            <AgentAttendanceHistory
              currentUser={currentUser}
              attendanceLogs={attendanceLogs}
              attendanceStatus={agentAttendanceStatus}
              onClockAction={handleClockAction}
            />
          )}

          {activeTab === 'my-salary' && (
            <AgentSalary currentUser={currentUser} payroll={payroll} />
          )}

          {/* SUPERVISOR & ADMIN TABS */}
          {activeTab === 'qa-approval' && (
            <QASalesApproval
              sales={sales}
              currentUser={currentUser}
              onApproveSale={handleApproveSale}
              onRejectSale={handleRejectSale}
            />
          )}

          {activeTab === 'team-attendance' && (
            <AdminAttendance
              attendanceLogs={attendanceLogs}
              users={allUsers}
              onUpdateAttendance={handleUpdateAttendance}
            />
          )}

          {activeTab === 'team' && (
            <TeamManagement
              currentUser={currentUser}
              users={allUsers}
              projects={projects}
              onAddUser={handleAddUser}
              onDeactivateUser={handleDeactivateUser}
              onUpdateUserCampaigns={handleUpdateUserCampaigns}
              onUpdateBaseSalary={handleUpdateBaseSalary}
              onResetPassword={handleResetPassword}
              onChangeRole={handleChangeRole}
              targets={targets}
              onUpdateSalesTarget={handleUpdateSalesTarget}
            />
          )}

          {activeTab === 'access-control' && currentUser.role === 'Admin' && (
            <AccessControl />
          )}

          {activeTab === 'dnc-check' && currentUser.role === 'Agent' && (
            <DncCheck projects={projects} />
          )}

          {activeTab === 'dnc-manage' && (currentUser.role === 'Admin' || currentUser.role === 'Supervisor') && (
            <DncManagement />
          )}

          {activeTab === 'message-groups' && (currentUser.role === 'Admin' || currentUser.role === 'Supervisor') && (
            <MessageGroupManagement
              currentUser={currentUser}
              users={allUsers}
              groups={messageGroups}
              onCreateGroup={handleCreateMessageGroup}
              onUpdateMembers={handleUpdateMessageGroupMembers}
              onDeleteGroup={handleDeleteMessageGroup}
            />
          )}

          {activeTab === 'targets' && (
            <AdminTargets
              currentUser={currentUser}
              users={allUsers}
              sales={sales}
              targets={targets}
              onUpdateSalesTarget={handleUpdateSalesTarget}
            />
          )}

          {activeTab === 'projects' && (
            <AdminProjects
              currentUser={currentUser}
              projects={projects}
              users={allUsers}
              onAddProject={handleAddProject}
              onUpdateProject={handleUpdateProject}
              onToggleProjectStatus={handleToggleProjectStatus}
            />
          )}

          {/* ADMIN-ONLY TABS */}
          {activeTab === 'payroll' && (
            <AdminPayroll
              payroll={payroll}
              users={allUsers}
              onTogglePaymentStatus={handleTogglePaymentStatus}
              onGeneratePayroll={handleGeneratePayroll}
              onUpdatePayrollAdjustments={handleUpdatePayrollAdjustments}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsAnalytics
              sales={sales}
              attendanceLogs={attendanceLogs}
              leads={leads}
              payroll={payroll}
            />
          )}

          {/* COMMON MODULE TABS */}
          {activeTab === 'leads' && (
            <LeadManagement
              leads={leads}
              currentUser={currentUser}
              users={allUsers}
              projects={projects}
              onAddLead={handleAddLead}
              onUpdateLeadStatus={handleUpdateLeadStatus}
            />
          )}

          {activeTab === 'knowledge' && (
            <KnowledgeBase
              articles={kbArticles}
              canManage={currentUser.role === 'Admin' || currentUser.role === 'Supervisor'}
              onCreateArticle={handleCreateKbArticle}
              onUpdateArticle={handleUpdateKbArticle}
              onDeleteArticle={handleDeleteKbArticle}
            />
          )}

          {activeTab === 'tickets' && (
            <SupportTickets
              currentUser={currentUser}
              tickets={tickets}
              onAddTicket={handleAddTicket}
              onResolveTicket={handleResolveTicket}
            />
          )}
        </main>
      </div>

      {/* Global Sale Submission Modal */}
      <SaleSubmissionModal
        isOpen={isSaleModalOpen}
        onClose={() => setIsSaleModalOpen(false)}
        projects={projects}
        selectedCampaignId={selectedCampaignId}
        currentUser={currentUser}
        onSubmitSale={handleSubmitSale}
      />

      {celebration && (
        <SaleCelebration celebration={celebration} onDone={dismissCelebration} />
      )}

      {/* Floating Notification Toast & Minimizable Task Drawer */}
      <TaskNotificationDrawer
        latestNotification={latestNotification}
        onDismissNotification={() => setLatestNotification(null)}
        onOpenNotification={handleOpenNotification}
        callbacks={callbacks.filter(c => c.agentId === currentUser.id)}
        attendanceStatus={agentAttendanceStatus}
        onClockAction={handleClockAction}
        isChatMinimized={chatPanelState === 'minimized'}
        chatUnreadCount={totalUnread}
        onExpandChat={handleOpenChat}
      />

      {/* Global Team Chat Drawer — reachable from the topbar on every screen */}
      <ChatDrawer
        isOpen={chatPanelState === 'open'}
        currentUser={currentUser}
        users={allUsers}
        onSendMessage={handleSendMessage}
        onClose={handleCloseChat}
        onMinimize={handleMinimizeChat}
      />
    </div>
    </ChatContext.Provider>
  );
  }

  return (
    <>
      {renderContent()}
      {showSplash && (
        <LoadingScreen
          fading={splashFading}
          onFadeOutComplete={() => setShowSplash(false)}
        />
      )}
    </>
  );
}
