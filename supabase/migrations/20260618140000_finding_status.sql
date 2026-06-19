-- Findings have their own status vocabulary ('to discuss', 'tasked', 'frozen'…)
-- that doesn't belong in task_statuses — which the task board renders and which
-- stories.status references by foreign key. Keep the finding status in a free
-- text column; stories.status stays null for kind='finding' rows.
alter table public.stories add column if not exists finding_status text;
