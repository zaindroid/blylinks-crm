const bcrypt = require('bcrypt');
const pool = require('./pool');
const logger = require('../logger');

async function seed() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  if (rows[0].count > 0) {
    logger.info('seed skipped: users already exist');
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const users = [
      { id: 'usr_admin', name: 'Zain', email: 'admin@blylinks.com', password: 'admin', role: 'Admin', designation: 'VP of Operations', phone: '+92 300 1234567', cnic: '42101-1234567-1', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80', shift: '09:00 AM - 05:00 PM' },
      { id: 'usr_supervisor', name: 'Emma Watson', email: 'supervisor@blylinks.com', password: 'supervisor', role: 'Supervisor', designation: 'Team Operations Supervisor', phone: '+92 301 2345678', cnic: '42101-2345678-2', avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&q=80', shift: '08:30 AM - 04:30 PM' },
      { id: 'usr_agent_1', name: 'Sarah Jenkins', email: 'sarah@blylinks.com', password: 'agent', role: 'Agent', designation: 'Outbound Sales Specialist', phone: '+92 302 3456789', cnic: '42101-3456789-3', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80', shift: '08:00 AM - 04:00 PM' }
    ];

    for (const u of users) {
      const passwordHash = await bcrypt.hash(u.password, 10);
      await client.query(
        `INSERT INTO users (id, name, email, password_hash, role, designation, phone, cnic, status, avatar, shift)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Active',$9,$10)`,
        [u.id, u.name, u.email, passwordHash, u.role, u.designation, u.phone, u.cnic, u.avatar, u.shift]
      );
    }

    const campaigns = [
      { id: 'camp_1', name: 'Solar Campaign PKR', client: 'EcoPower Pakistan', category: 'Outbound Telesales', monthlyTargetPkr: 1500000, commissionRate: 10, agents: ['usr_agent_1'] },
      { id: 'camp_2', name: 'Healthcare BPO PKR', client: 'CarePlus Health', category: 'Inbound Verification', monthlyTargetPkr: 1000000, commissionRate: 8, agents: ['usr_agent_1'] },
      { id: 'camp_3', name: 'Commercial Real Estate PKR', client: 'Apex Builders', category: 'Lead Generation', monthlyTargetPkr: 2000000, commissionRate: 12, agents: [] }
    ];

    for (const c of campaigns) {
      await client.query(
        `INSERT INTO campaigns (id, name, client, category, monthly_target_pkr, commission_rate, status)
         VALUES ($1,$2,$3,$4,$5,$6,'Active')`,
        [c.id, c.name, c.client, c.category, c.monthlyTargetPkr, c.commissionRate]
      );
      for (const agentId of c.agents) {
        await client.query('INSERT INTO campaign_agents (campaign_id, agent_id) VALUES ($1,$2)', [c.id, agentId]);
      }
    }

    await client.query(
      `INSERT INTO sales (id, customer_name, phone, email, campaign_id, agent_id, amount, status, sale_date, agent_notes, qa_notes, verified_by)
       VALUES
       ('SALE-101','Tariq Mahmood','+92 300 9876543','tariq@mahmood.pk','camp_1','usr_agent_1',150000,'Approved','2026-08-11 11:30 AM','Customer approved 5kW solar inverter installation.','Audio verified by Emma Watson. CNIC & bill copy received.','Emma Watson (Supervisor)'),
       ('SALE-102','Fatima Ali','+92 312 8765432','fatima.ali@gmail.com','camp_2','usr_agent_1',85000,'Pending','2026-08-11 12:45 PM','Enrolled in premium family health coverage plan.','','')`
    );

    await client.query(
      `INSERT INTO attendance_logs (id, agent_id, log_date, clock_in, clock_out, status, total_hours)
       VALUES ('att_1','usr_agent_1','2026-08-11','07:58 AM','--:--','Present','5h 35m (Active)')`
    );

    await client.query(
      `INSERT INTO targets (agent_id, daily_target_pkr, daily_achieved_pkr, weekly_target_pkr, weekly_achieved_pkr, monthly_target_pkr, monthly_achieved_pkr)
       VALUES ('usr_agent_1',50000,150000,300000,450000,1200000,850000)`
    );

    await client.query(
      `INSERT INTO callbacks (id, customer_name, phone, campaign_id, agent_id, due_date, priority, status, notes)
       VALUES ('cb_101','Kamran Khan','+92 333 4567890','camp_1','usr_agent_1','2026-08-11 02:30 PM','High','Pending','Requested callback regarding net-metering approval process.')`
    );

    await client.query(
      `INSERT INTO leads (id, name, phone, email, address, campaign_id, source, assigned_agent_id, status, last_contact, next_callback, notes)
       VALUES ('lead_1','Usman Rashid','+92 321 5551234','usman@rashid.pk','DHA Phase 5, Lahore','camp_1','Manager Lead Input','usr_agent_1','Interested','2026-08-11','2026-08-12 10:00 AM','Interested in 10kW residential setup.')`
    );

    await client.query(
      `INSERT INTO payroll (id, agent_id, month, base_salary_pkr, commission_pkr, bonus_pkr, deductions_pkr, net_salary_pkr, status, payment_date)
       VALUES ('pay_aug_1','usr_agent_1','August 2026',60000,85000,10000,0,155000,'Paid','2026-08-01')`
    );

    await client.query(
      `INSERT INTO messages (id, channel, sender_id, text, created_at)
       VALUES ('msg_1','announcements','usr_admin','Team, Q3 targets are updated. Excellent performance on Solar Campaign PKR.', now())`
    );

    await client.query(
      `INSERT INTO kb_articles (id, category, title, summary, content)
       VALUES ('kb_1','Sales Scripts','Solar Campaign PKR — Opening Pitch','Opening script for residential solar inquiries.',
       '[GREETING] "Assalam-o-Alaikum, am I speaking with [Customer Name]? My name is [Agent Name] calling from EcoPower Pakistan."
[PITCH] "We are currently conducting solar feasibility assessments in your area to eliminate heavy grid electricity bills."
[QUALIFICATION] "Is your average monthly electricity bill above Rs. 35,000?"')`
    );

    await client.query(
      `INSERT INTO tickets (id, agent_id, subject, category, priority, status, ticket_date, description)
       VALUES ('TICK-101','usr_agent_1','Commission Query for Solar Deal SALE-101','Payroll & Incentives','Medium','Open','2026-08-11','Please verify commission percentage for 5kW Solar sale.')`
    );

    await client.query('COMMIT');
    logger.info('seed complete');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch(err => {
      logger.error({ err }, 'seed failed');
      process.exit(1);
    });
}

module.exports = seed;
