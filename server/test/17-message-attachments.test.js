const request = require('supertest');
const { app, createAdmin, createCampaign, createAgentViaApi, insertUser, loginToken } = require('./helpers');

describe('chat file sharing', () => {
  it('sharing a file in a group: the list shows metadata only, and the download route returns the real bytes', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    const fileData = Buffer.from('hello attachment').toString('base64');

    const post = await request(app).post('/api/messages').set('Authorization', `Bearer ${agent.token}`)
      .send({ channel: 'qa-support', text: 'see attached', fileName: 'notes.txt', fileType: 'text/plain', fileData });
    expect(post.status).toBe(201);
    expect(post.body.hasAttachment).toBe(true);
    expect(post.body.fileName).toBe('notes.txt');
    expect(post.body.fileSize).toBe(Buffer.byteLength('hello attachment'));
    expect(JSON.stringify(post.body)).not.toContain(fileData); // raw bytes never ride along with the message object

    const list = await request(app).get('/api/messages?channel=qa-support').set('Authorization', `Bearer ${admin.token}`);
    const listed = list.body.find(m => m.id === post.body.id);
    expect(listed.hasAttachment).toBe(true);
    expect(listed.fileName).toBe('notes.txt');
    expect(JSON.stringify(list.body)).not.toContain(fileData);

    const download = await request(app).get(`/api/messages/${post.body.id}/attachment`).set('Authorization', `Bearer ${admin.token}`);
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toContain('text/plain');
    expect(download.text).toBe('hello attachment');
  });

  it('a message can be file-only, with no text', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    const fileData = Buffer.from('just a file').toString('base64');

    const res = await request(app).post('/api/messages').set('Authorization', `Bearer ${agent.token}`)
      .send({ channel: 'qa-support', fileName: 'standalone.txt', fileType: 'text/plain', fileData });
    expect(res.status).toBe(201);
    expect(res.body.hasAttachment).toBe(true);
  });

  it('rejects a message with neither text nor a file', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);

    const res = await request(app).post('/api/messages').set('Authorization', `Bearer ${agent.token}`)
      .send({ channel: 'qa-support' });
    expect(res.status).toBe(400);
  });

  it('rejects a file over the 5MB cap', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);
    const fileData = Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64');

    const res = await request(app).post('/api/messages').set('Authorization', `Bearer ${agent.token}`)
      .send({ channel: 'qa-support', fileName: 'big.bin', fileData });
    expect(res.status).toBe(400);
  });

  it('a non-member of the channel cannot download its attachment, even by guessing the message id', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agentInGroup = await createAgentViaApi(admin.token, [campaignId]);
    const outsider = await insertUser({ role: 'Agent' });
    const outsiderToken = await loginToken(outsider.username, outsider.password);
    const fileData = Buffer.from('secret').toString('base64');

    // qa-support is a default group every new Agent auto-joins -- use a group the outsider was never added to.
    const group = await request(app).post('/api/message-groups').set('Authorization', `Bearer ${admin.token}`)
      .send({ id: `grp_${Date.now()}`, name: 'Private Group', memberIds: [agentInGroup.id] });
    const post = await request(app).post('/api/messages').set('Authorization', `Bearer ${agentInGroup.token}`)
      .send({ channel: group.body.id, fileName: 'secret.txt', fileData });

    const res = await request(app).get(`/api/messages/${post.body.id}/attachment`).set('Authorization', `Bearer ${outsiderToken}`);
    expect(res.status).toBe(403);
  });

  it('404s for an attachment on a message that has none, or does not exist', async () => {
    const admin = await createAdmin();
    const campaignId = await createCampaign(admin.token);
    const agent = await createAgentViaApi(admin.token, [campaignId]);

    const textOnly = await request(app).post('/api/messages').set('Authorization', `Bearer ${agent.token}`)
      .send({ channel: 'qa-support', text: 'no file here' });
    const noAttachment = await request(app).get(`/api/messages/${textOnly.body.id}/attachment`).set('Authorization', `Bearer ${admin.token}`);
    expect(noAttachment.status).toBe(404);

    const missing = await request(app).get('/api/messages/msg_nope/attachment').set('Authorization', `Bearer ${admin.token}`);
    expect(missing.status).toBe(404);
  });
});
