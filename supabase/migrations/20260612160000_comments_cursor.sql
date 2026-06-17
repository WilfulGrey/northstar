-- Cursor for the incremental native-comment crawl (walks the workspace's tasks
-- a window at a time; wraps to 0 after a full pass).
alter table public.workspace_integrations add column comments_cursor int not null default 0;
