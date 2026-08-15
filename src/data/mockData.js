export const INITIAL_USERS = [
  {
    id: 'usr_admin',
    name: 'Zain',
    email: 'admin@blylinks.com',
    password: 'admin',
    role: 'Admin',
    designation: 'VP of Operations',
    phone: '+92 300 1234567',
    cnic: '42101-1234567-1',
    allowedCampaignIds: ['camp_1', 'camp_2', 'camp_3'],
    status: 'Active',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    shift: '09:00 AM - 05:00 PM'
  },
  {
    id: 'usr_supervisor',
    name: 'Emma Watson',
    email: 'supervisor@blylinks.com',
    password: 'supervisor',
    role: 'Supervisor',
    designation: 'Team Operations Supervisor',
    phone: '+92 301 2345678',
    cnic: '42101-2345678-2',
    allowedCampaignIds: ['camp_1', 'camp_2'],
    status: 'Active',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&q=80',
    shift: '08:30 AM - 04:30 PM'
  },
  {
    id: 'usr_agent_1',
    name: 'Sarah Jenkins',
    email: 'sarah@blylinks.com',
    password: 'agent',
    role: 'Agent',
    designation: 'Outbound Sales Specialist',
    phone: '+92 302 3456789',
    cnic: '42101-3456789-3',
    allowedCampaignIds: ['camp_1', 'camp_2'],
    status: 'Active',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
    shift: '08:00 AM - 04:00 PM'
  }
];

export const INITIAL_PROJECTS = [
  {
    id: 'camp_1',
    name: 'Solar Campaign PKR',
    client: 'EcoPower Pakistan',
    category: 'Outbound Telesales',
    monthlyTargetPkr: 1500000, // Rs. 1,500,000
    commissionRate: 10,
    status: 'Active',
    assignedAgentIds: ['usr_agent_1'],
    totalSalesCount: 12,
    totalRevenuePkr: 850000
  },
  {
    id: 'camp_2',
    name: 'Healthcare BPO PKR',
    client: 'CarePlus Health',
    category: 'Inbound Verification',
    monthlyTargetPkr: 1000000, // Rs. 1,000,000
    commissionRate: 8,
    status: 'Active',
    assignedAgentIds: ['usr_agent_1'],
    totalSalesCount: 8,
    totalRevenuePkr: 420000
  },
  {
    id: 'camp_3',
    name: 'Commercial Real Estate PKR',
    client: 'Apex Builders',
    category: 'Lead Generation',
    monthlyTargetPkr: 2000000, // Rs. 2,000,000
    commissionRate: 12,
    status: 'Active',
    assignedAgentIds: [],
    totalSalesCount: 0,
    totalRevenuePkr: 0
  }
];

export const INITIAL_SALES = [
  {
    id: 'SALE-101',
    customerName: 'Tariq Mahmood',
    phone: '+92 300 9876543',
    email: 'tariq@mahmood.pk',
    campaignId: 'camp_1',
    projectName: 'Solar Campaign PKR',
    agentId: 'usr_agent_1',
    agentName: 'Sarah Jenkins',
    amount: 150000, // Rs. 150,000
    status: 'Approved',
    date: '2026-08-11 11:30 AM',
    agentNotes: 'Customer approved 5kW solar inverter installation.',
    qaNotes: 'Audio verified by Emma Watson. CNIC & bill copy received.',
    verifiedBy: 'Emma Watson (Supervisor)'
  },
  {
    id: 'SALE-102',
    customerName: 'Fatima Ali',
    phone: '+92 312 8765432',
    email: 'fatima.ali@gmail.com',
    campaignId: 'camp_2',
    projectName: 'Healthcare BPO PKR',
    agentId: 'usr_agent_1',
    agentName: 'Sarah Jenkins',
    amount: 85000, // Rs. 85,000
    status: 'Pending',
    date: '2026-08-11 12:45 PM',
    agentNotes: 'Enrolled in premium family health coverage plan.',
    qaNotes: '',
    verifiedBy: ''
  }
];

export const INITIAL_ATTENDANCE = [
  {
    id: 'att_1',
    agentId: 'usr_agent_1',
    agentName: 'Sarah Jenkins',
    date: '2026-08-11',
    clockIn: '07:58 AM',
    clockOut: '--:--',
    status: 'Present',
    totalHours: '5h 35m (Active)'
  }
];

export const INITIAL_TARGETS = [
  {
    agentId: 'usr_agent_1',
    agentName: 'Sarah Jenkins',
    dailyTargetPkr: 50000,
    dailyAchievedPkr: 150000,
    weeklyTargetPkr: 300000,
    weeklyAchievedPkr: 450000,
    monthlyTargetPkr: 1200000,
    monthlyAchievedPkr: 850000
  }
];

export const INITIAL_CALLBACKS = [
  {
    id: 'cb_101',
    customerName: 'Kamran Khan',
    phone: '+92 333 4567890',
    campaignId: 'camp_1',
    projectName: 'Solar Campaign PKR',
    agentId: 'usr_agent_1',
    dueDate: '2026-08-11 02:30 PM',
    priority: 'High',
    status: 'Pending',
    notes: 'Requested callback regarding net-metering approval process.'
  }
];

export const INITIAL_LEADS = [
  {
    id: 'lead_1',
    name: 'Usman Rashid',
    phone: '+92 321 5551234',
    email: 'usman@rashid.pk',
    address: 'DHA Phase 5, Lahore',
    campaignId: 'camp_1',
    projectName: 'Solar Campaign PKR',
    source: 'Manager Lead Input',
    assignedAgentId: 'usr_agent_1',
    assignedAgentName: 'Sarah Jenkins',
    status: 'Interested',
    lastContact: '2026-08-11',
    nextCallback: '2026-08-12 10:00 AM',
    notes: 'Interested in 10kW residential setup.'
  }
];

export const INITIAL_PAYROLL = [
  {
    id: 'pay_aug_1',
    agentId: 'usr_agent_1',
    agentName: 'Sarah Jenkins',
    month: 'August 2026',
    baseSalaryPkr: 60000,
    commissionPkr: 85000,
    bonusPkr: 10000,
    deductionsPkr: 0,
    netSalaryPkr: 155000,
    status: 'Paid',
    paymentDate: '2026-08-01'
  }
];

export const INITIAL_MESSAGES = [
  {
    id: 'msg_1',
    channel: 'announcements',
    senderId: 'usr_admin',
    senderName: 'Zain (Admin)',
    senderRole: 'Admin',
    text: 'Team, Q3 targets are updated. Excellent performance on Solar Campaign PKR.',
    timestamp: '2026-08-11 09:00 AM'
  }
];

export const KNOWLEDGE_BASE_ARTICLES = [
  {
    id: 'kb_1',
    category: 'Sales Scripts',
    title: 'Solar Campaign PKR — Opening Pitch',
    summary: 'Opening script for residential solar inquiries.',
    content: `[GREETING] "Assalam-o-Alaikum, am I speaking with [Customer Name]? My name is [Agent Name] calling from EcoPower Pakistan."
[PITCH] "We are currently conducting solar feasibility assessments in your area to eliminate heavy grid electricity bills."
[QUALIFICATION] "Is your average monthly electricity bill above Rs. 35,000?"`
  }
];

export const SUPPORT_TICKETS = [
  {
    id: 'TICK-101',
    agentId: 'usr_agent_1',
    agentName: 'Sarah Jenkins',
    subject: 'Commission Query for Solar Deal SALE-101',
    category: 'Payroll & Incentives',
    priority: 'Medium',
    status: 'Open',
    date: '2026-08-11',
    description: 'Please verify commission percentage for 5kW Solar sale.'
  }
];
