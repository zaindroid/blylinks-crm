ALTER TABLE campaign_agents RENAME TO campaign_access;
ALTER TABLE campaign_access RENAME COLUMN agent_id TO user_id;
ALTER INDEX campaign_agents_pkey RENAME TO campaign_access_pkey;
