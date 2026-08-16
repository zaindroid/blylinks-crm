import React, { useState, useEffect, useRef } from 'react';
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
import QASalesApproval from './components/AdminPortal/QASalesApproval';
import AdminAttendance from './components/AdminPortal/AdminAttendance';
import AdminTargets from './components/AdminPortal/AdminTargets';
import AdminPayroll from './components/AdminPortal/AdminPayroll';
import AdminProjects from './components/AdminPortal/AdminProjects';
import LeadManagement from './components/Shared/LeadManagement';
import ReportsAnalytics from './components/Shared/ReportsAnalytics';
import KnowledgeBase from './components/Shared/KnowledgeBase';
import SupportTickets from './components/Shared/SupportTickets';
import TeamManagement from './components/Shared/TeamManagement';
import TaskNotificationDrawer from './components/TaskNotificationDrawer';
import ChatDrawer from './components/Chat/ChatDrawer';
import AuthModal from './components/Auth/AuthModal';
import { requestNotificationPermission, showDesktopNotification } from './utils/notifications';

import { getToken, setToken, decodeToken } from './api/client';
import { logout as apiLogout } from './api/auth';
import { fetchUsers, createUser, deactivateUser, updateUserCampaigns } from './api/users';
import { fetchCampaigns, createCampaign, updateCampaign, toggleCampaignStatus } from './api/campaigns';
import { fetchSales, submitSale, approveSale, rejectSale } from './api/sales';
import { fetchAttendance, clockIn, clockOut, updateAttendanceStatus } from './api/attendance';
import { fetchTargets, updateTarget } from './api/targets';
import { fetchCallbacks, addCallback, completeCallback } from './api/callbacks';
import { fetchLeads, addLead, updateLeadStatus } from './api/leads';
import { fetchPayroll, togglePaymentStatus } from './api/payroll';
import { fetchMessages, sendMessage } from './api/messages';
import { fetchKbArticles } from './api/kb';
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
  const [projects, setProjects] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [targets, setTargets] = useState([]);
  const [callbacks, setCallbacks] = useState([]);
  const [leads, setLeads] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [messages, setMessages] = useState([]);
  const [kbArticles, setKbArticles] = useState([]);
  const [tickets, setTickets] = useState([]);

  // Active Campaign State
  const [selectedCampaignId, setSelectedCampaignId] = useState('camp_1');

  // Modals & UI States
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [latestNotification, setLatestNotification] = useState(null);

  // Chat drawer state: 'closed' | 'open' | 'minimized'
  const [chatPanelState, setChatPanelState] = useState('closed');
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

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
      .catch(() => setToken(null))
      .finally(() => setAuthChecking(false));
  }, []);

  // Once authenticated, load every resource the portal needs
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    (async () => {
      try {
        const [users, campaignsData, salesData, attendanceData, targetsData, callbacksData, leadsData, payrollData, messagesData, kbData, ticketsData] = await Promise.all([
          fetchUsers(), fetchCampaigns(), fetchSales(), fetchAttendance(), fetchTargets(),
          fetchCallbacks(), fetchLeads(), fetchPayroll(), fetchMessages(), fetchKbArticles(), fetchTickets()
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
        setKbArticles(kbData);
        setTickets(ticketsData);
      } catch (err) {
        console.error('Failed to load portal data', err);
      }
    })();
    return () => { cancelled = true; };
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
    setKbArticles([]);
    setTickets([]);
    setActiveTab('overview');
  };

  // Chat Drawer Handlers
  const handleOpenChat = () => {
    setChatPanelState('open');
    setChatUnreadCount(0);
  };

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
  const agentAttendanceStatus = myOpenAttendanceLog ? 'Present' : 'Clocked Out';

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

  // Sale Handlers
  const handleSubmitSale = async (newSale) => {
    try {
      const saved = await submitSale({
        campaignId: selectedCampaignId,
        customerName: newSale.customerName,
        phone: newSale.phone,
        email: newSale.email,
        amount: newSale.amount,
        agentNotes: newSale.agentNotes
      });
      setSales(await fetchSales());
      const notif = {
        title: 'QA Audit Required',
        message: `${saved.agentName} logged deal ${saved.id} (Rs. ${saved.amount.toLocaleString()})`,
        time: 'Just now',
        read: false,
        type: 'alert'
      };
      setNotifications([notif, ...notifications]);
      setLatestNotification(notif);
      showDesktopNotification(notif.title, notif.message);
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
  const handleUpdateTarget = async (agentId, updatedTarget) => {
    await updateTarget(agentId, updatedTarget);
    setTargets(await fetchTargets());
  };

  // Payroll Handlers
  const handleTogglePaymentStatus = async (payrollId) => {
    await togglePaymentStatus(payrollId);
    setPayroll(await fetchPayroll());
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

  // Project Handlers
  const handleAddProject = async (newProj) => {
    await createCampaign({
      id: newProj.id,
      name: newProj.name,
      client: newProj.client,
      category: newProj.category,
      monthlyTargetPkr: newProj.monthlyTargetPkr,
      commissionRate: newProj.commissionRate,
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
  const handleSendMessage = async (newMsg) => {
    await sendMessage(newMsg.channel, newMsg.text);
    setMessages(await fetchMessages());
    const notif = {
      title: `New Message in ${newMsg.channel}`,
      message: `${currentUser.name}: "${newMsg.text.slice(0, 35)}..."`,
      time: 'Just now',
      read: false,
      type: 'info'
    };
    setNotifications([notif, ...notifications]);
    setLatestNotification(notif);
    showDesktopNotification(notif.title, notif.message);

    if (chatPanelState !== 'open') {
      setChatUnreadCount(count => count + 1);
    }
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

  return (
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
          chatUnreadCount={chatUnreadCount}
        />

        <main className="content-area">
          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === 'overview' && (
            currentUser.role === 'Agent' ? (
              <AgentOverview
                currentUser={currentUser}
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
              />
            ) : currentUser.role === 'Supervisor' ? (
              <SupervisorOverview
                sales={sales}
                users={allUsers}
                attendanceLogs={attendanceLogs}
                onApproveSale={handleApproveSale}
                onRejectSale={handleRejectSale}
                setActiveTab={setActiveTab}
                selectedCampaignId={selectedCampaignId}
                projects={projects}
              />
            ) : (
              <AdminOverview
                sales={sales}
                users={allUsers}
                projects={projects}
                attendanceLogs={attendanceLogs}
                onApproveSale={handleApproveSale}
                onRejectSale={handleRejectSale}
                setActiveTab={setActiveTab}
                selectedCampaignId={selectedCampaignId}
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
            />
          )}

          {/* ADMIN-ONLY TABS */}
          {activeTab === 'targets' && (
            <AdminTargets
              targets={targets}
              onUpdateTarget={handleUpdateTarget}
            />
          )}

          {activeTab === 'payroll' && (
            <AdminPayroll
              payroll={payroll}
              onTogglePaymentStatus={handleTogglePaymentStatus}
            />
          )}

          {activeTab === 'projects' && (
            <AdminProjects
              projects={projects}
              users={allUsers}
              onAddProject={handleAddProject}
              onUpdateProject={handleUpdateProject}
              onToggleProjectStatus={handleToggleProjectStatus}
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
            <KnowledgeBase articles={kbArticles} />
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
        currentUser={currentUser}
        onSubmitSale={handleSubmitSale}
      />

      {/* Floating Notification Toast & Minimizable Task Drawer */}
      <TaskNotificationDrawer
        latestNotification={latestNotification}
        onDismissNotification={() => setLatestNotification(null)}
        callbacks={callbacks.filter(c => c.agentId === currentUser.id)}
        attendanceStatus={agentAttendanceStatus}
        onClockAction={handleClockAction}
        isChatMinimized={chatPanelState === 'minimized'}
        chatUnreadCount={chatUnreadCount}
        onExpandChat={handleOpenChat}
      />

      {/* Global Team Chat Drawer — reachable from the topbar on every screen */}
      <ChatDrawer
        isOpen={chatPanelState === 'open'}
        currentUser={currentUser}
        messages={messages}
        onSendMessage={handleSendMessage}
        onClose={handleCloseChat}
        onMinimize={handleMinimizeChat}
      />
    </div>
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
