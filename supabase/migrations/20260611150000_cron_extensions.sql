-- Background scheduler for the Airtable sync.
-- pg_cron runs the schedule; pg_net makes the HTTPS call to the sync-cron Edge
-- Function. The actual cron job (which carries the x-sync-secret) is created
-- out-of-band so the secret is never committed — see README "Background sync".
create extension if not exists pg_cron;
create extension if not exists pg_net;
