const request = require('supertest');
const { app, uid, createAdmin, createCampaign, createAgentViaApi, insertUser, loginToken } = require('./helpers');

describe('message group membership scoping', () => {
  it('Admin can create a group with specific members', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent1 = await createAgentViaApi(admin.token, [campaignId]);
    const agent2 = await createAgentViaApi(admin.token, [campaignId]);

    const res = await request(app).post('/api/message-groups').set('Authorization', `Bearer ${admin.token}`)
      .send({ id: uid('grp'), name: 'Night Shift', memberIds: [agent1.id, agent2.id] });
    expect(res.status).toBe(201);
    expect(res.body.memberIds.sort()).toEqual([agent1.id, agent2.id].sort());
  });

  it('a member can post and read; a non-member is rejected on both', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const member = await createAgentViaApi(admin.token, [campaignId]);
    const outsider = await createAgentViaApi(admin.token, [campaignId]);
    const groupId = uid('grp');
    await request(app).post('/api/message-groups').set('Authorization', `Bearer ${admin.token}`)
      .send({ id: groupId, name: 'Scoped Group', memberIds: [member.id] });

    const post = await request(app).post('/api/messages').set('Authorization', `Bearer ${member.token}`)
      .send({ channel: groupId, text: 'hello team' });
    expect(post.status).toBe(201);

    const outsiderPost = await request(app).post('/api/messages').set('Authorization', `Bearer ${outsider.token}`)
      .send({ channel: groupId, text: 'i should not be able to do this' });
    expect(outsiderPost.status).toBe(403);

    const outsiderRead = await request(app).get(`/api/messages?channel=${groupId}`).set('Authorization', `Bearer ${outsider.token}`);
    expect(outsiderRead.status).toBe(403);

    const memberInbox = await request(app).get('/api/messages').set('Authorization', `Bearer ${member.token}`);
    expect(memberInbox.body.some(m => m.channel === groupId)).toBe(true);

    const outsiderInbox = await request(app).get('/api/messages').set('Authorization', `Bearer ${outsider.token}`);
    expect(outsiderInbox.body.some(m => m.channel === groupId)).toBe(false);
  });

  it('Supervisor can only add themselves + Agents that share their own campaign access', async () => {
    const admin = await createAdmin();
    const campaignA = await createCampaign(admin.token);
    const campaignB = await createCampaign(admin.token);
    const supUser = await insertUser({ role: 'Supervisor', username: uid('grp_sup') });
    await request(app).patch(`/api/users/${supUser.id}/campaigns`).set('Authorization', `Bearer ${admin.token}`).send({ campaignIds: [campaignA] });
    const supToken = await loginToken(supUser.username, supUser.password);
    const inScopeAgent = await createAgentViaApi(admin.token, [campaignA]);
    const outOfScopeAgent = await createAgentViaApi(admin.token, [campaignB]);

    const ok = await request(app).post('/api/message-groups').set('Authorization', `Bearer ${supToken}`)
      .send({ id: uid('grp'), name: 'Sup Group', memberIds: [inScopeAgent.id] });
    expect(ok.status).toBe(201);
    expect(ok.body.memberIds).toContain(supUser.id); // supervisor is auto-included

    const rejected = await request(app).post('/api/message-groups').set('Authorization', `Bearer ${supToken}`)
      .send({ id: uid('grp'), name: 'Bad Group', memberIds: [outOfScopeAgent.id] });
    expect(rejected.status).toBe(403);
  });

  it('only Admin can delete a group', async () => {
    const admin = await createAdmin();
    const groupId = uid('grp');
    await request(app).post('/api/message-groups').set('Authorization', `Bearer ${admin.token}`).send({ id: groupId, name: 'ToDelete', memberIds: [] });
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);

    const agentAttempt = await request(app).delete(`/api/message-groups/${groupId}`).set('Authorization', `Bearer ${agent.token}`);
    expect(agentAttempt.status).toBe(403);

    const adminAttempt = await request(app).delete(`/api/message-groups/${groupId}`).set('Authorization', `Bearer ${admin.token}`);
    expect(adminAttempt.status).toBe(200);
  });

  it('GET /api/message-groups without ?all shows only groups you belong to, even for Admin', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    const groupId = uid('grp');
    // Admin creates a group but does not add themselves
    await request(app).post('/api/message-groups').set('Authorization', `Bearer ${admin.token}`)
      .send({ id: groupId, name: 'Not Admins', memberIds: [agent.id] });

    const adminOwn = await request(app).get('/api/message-groups').set('Authorization', `Bearer ${admin.token}`);
    expect(adminOwn.body.find(g => g.id === groupId)).toBeUndefined();

    const adminAll = await request(app).get('/api/message-groups?all=true').set('Authorization', `Bearer ${admin.token}`);
    expect(adminAll.body.find(g => g.id === groupId)).toBeDefined();
  });
});

describe('direct messages', () => {
  it('requires a matching recipientId -- cannot post to a DM channel without proving participation', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agentA = await createAgentViaApi(admin.token, [campaignId]);
    const agentB = await createAgentViaApi(admin.token, [campaignId]);
    const agentC = await createAgentViaApi(admin.token, [campaignId]);
    const dmChannel = `dm:${[agentA.id, agentB.id].sort().join('|')}`;

    const noRecipient = await request(app).post('/api/messages').set('Authorization', `Bearer ${agentA.token}`)
      .send({ channel: dmChannel, text: 'no recipientId' });
    expect(noRecipient.status).toBe(403);

    const wrongRecipient = await request(app).post('/api/messages').set('Authorization', `Bearer ${agentA.token}`)
      .send({ channel: dmChannel, text: 'spoofed', recipientId: agentC.id });
    expect(wrongRecipient.status).toBe(403);

    const correct = await request(app).post('/api/messages').set('Authorization', `Bearer ${agentA.token}`)
      .send({ channel: dmChannel, text: 'hi B', recipientId: agentB.id });
    expect(correct.status).toBe(201);
  });

  it('a DM thread is only visible to its two participants', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agentA = await createAgentViaApi(admin.token, [campaignId]);
    const agentB = await createAgentViaApi(admin.token, [campaignId]);
    const agentC = await createAgentViaApi(admin.token, [campaignId]);
    const dmChannel = `dm:${[agentA.id, agentB.id].sort().join('|')}`;

    await request(app).post('/api/messages').set('Authorization', `Bearer ${agentA.token}`)
      .send({ channel: dmChannel, text: 'private', recipientId: agentB.id });

    const bReads = await request(app).get(`/api/messages?channel=${dmChannel}`).set('Authorization', `Bearer ${agentB.token}`);
    expect(bReads.status).toBe(200);
    expect(bReads.body).toHaveLength(1);

    const cReads = await request(app).get(`/api/messages?channel=${dmChannel}`).set('Authorization', `Bearer ${agentC.token}`);
    expect(cReads.status).toBe(403);

    const cInbox = await request(app).get('/api/messages').set('Authorization', `Bearer ${agentC.token}`);
    expect(cInbox.body.some(m => m.channel === dmChannel)).toBe(false);
  });
});
