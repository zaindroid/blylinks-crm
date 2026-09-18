const request = require('supertest');
const { app, pool, createAdmin, createCampaign, createAgentViaApi } = require('./helpers');
const { ensureDefaultGroups, DEFAULT_GROUP_IDS } = require('../utils/defaultGroups');

// Regression for the production incident where group messaging died while DMs
// kept working: a `TRUNCATE ... users CASCADE` wipe also truncated message_groups
// (created_by references users), and migration 006 -- the only thing that ever
// created the default groups -- never runs twice. Every account created after
// that joined zero groups, silently.
describe('default message groups self-heal', () => {
  it('re-creates wiped default groups on startup, backfills active users, and group messaging works again', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);

    // Simulate the wipe: the default groups (and, by cascade, their memberships) are gone.
    await pool.query('DELETE FROM message_groups WHERE id = ANY($1)', [DEFAULT_GROUP_IDS]);
    const gone = await request(app).get('/api/message-groups').set('Authorization', `Bearer ${agent.token}`);
    expect(gone.body).toEqual([]);
    const blocked = await request(app).post('/api/messages').set('Authorization', `Bearer ${admin.token}`)
      .send({ channel: 'announcements', text: 'anyone there?' });
    expect(blocked.status).toBe(403);

    const recreated = await ensureDefaultGroups(pool);
    expect(recreated.sort()).toEqual([...DEFAULT_GROUP_IDS].sort());

    const groups = await request(app).get('/api/message-groups').set('Authorization', `Bearer ${agent.token}`);
    expect(groups.body.map(g => g.id).sort()).toEqual([...DEFAULT_GROUP_IDS].sort());

    const sent = await request(app).post('/api/messages').set('Authorization', `Bearer ${admin.token}`)
      .send({ channel: 'announcements', text: 'team meeting at 3' });
    expect(sent.status).toBe(201);
    expect(sent.body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const agentInbox = await request(app).get('/api/messages').set('Authorization', `Bearer ${agent.token}`);
    expect(agentInbox.body.map(m => m.text)).toContain('team meeting at 3');
  });

  it('leaves groups that still exist completely alone -- a deliberate membership removal survives a restart', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);

    await pool.query('DELETE FROM message_group_members WHERE group_id = $1 AND user_id = $2', ['general-lounge', agent.id]);

    const recreated = await ensureDefaultGroups(pool);
    expect(recreated).toEqual([]);

    const { rows } = await pool.query('SELECT 1 FROM message_group_members WHERE group_id = $1 AND user_id = $2', ['general-lounge', agent.id]);
    expect(rows).toHaveLength(0);
  });

  it('does not backfill deactivated users into a re-created group', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    await pool.query("UPDATE users SET status = 'Inactive' WHERE id = $1", [agent.id]);

    await pool.query('DELETE FROM message_groups WHERE id = ANY($1)', [DEFAULT_GROUP_IDS]);
    await ensureDefaultGroups(pool);

    const { rows } = await pool.query('SELECT 1 FROM message_group_members WHERE user_id = $1', [agent.id]);
    expect(rows).toHaveLength(0);
  });
});
