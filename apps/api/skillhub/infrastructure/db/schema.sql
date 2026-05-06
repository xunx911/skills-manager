create table artifacts (
  id text primary key,
  kind text not null,
  namespace text not null,
  locator text not null,
  digest text not null,
  media_type text not null,
  size_bytes bigint not null default 0,
  content_text text,
  created_at timestamptz not null default now(),
  created_by text not null,
  constraint artifacts_size_bytes_non_negative check (size_bytes >= 0),
  constraint artifacts_locator_digest_unique unique (locator, digest)
);

create table tag_sets (
  id text primary key,
  tags text[] not null,
  normalized_hash text not null unique,
  created_at timestamptz not null default now(),
  constraint tag_sets_tags_not_empty check (cardinality(tags) > 0)
);

create table skills (
  id text primary key,
  slug text not null unique,
  owner_ref text not null,
  default_variant_id text,
  lifecycle_status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint skills_lifecycle_status_check check (lifecycle_status in ('active', 'archived'))
);

create table variants (
  id text primary key,
  skill_id text not null references skills(id),
  name text not null,
  label text not null,
  summary text not null,
  tag_set_id text not null references tag_sets(id),
  current_version_id text,
  lifecycle_status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint variants_lifecycle_status_check check (lifecycle_status in ('active', 'archived')),
  constraint variants_id_skill_unique unique (id, skill_id),
  constraint variants_skill_tag_set_unique unique (skill_id, tag_set_id)
);

create table variant_versions (
  id text primary key,
  skill_id text not null,
  variant_id text not null,
  version_number integer not null,
  content_ref jsonb not null,
  content_digest text not null,
  change_summary text not null,
  created_at timestamptz not null default now(),
  created_by text not null,
  constraint variant_versions_version_number_positive check (version_number > 0),
  constraint variant_versions_variant_version_unique unique (variant_id, version_number),
  constraint variant_versions_id_skill_unique unique (id, skill_id),
  constraint variant_versions_variant_skill_fkey foreign key (variant_id, skill_id) references variants(id, skill_id)
);

alter table skills
  add constraint skills_default_variant_fkey
  foreign key (default_variant_id, id) references variants(id, skill_id);

alter table variants
  add constraint variants_current_version_fkey
  foreign key (current_version_id, skill_id) references variant_versions(id, skill_id);

create table eval_sets (
  id text primary key,
  skill_id text not null references skills(id),
  name text not null,
  description text not null default '',
  current_version_id text,
  lifecycle_status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint eval_sets_lifecycle_status_check check (lifecycle_status in ('active', 'archived')),
  constraint eval_sets_id_skill_unique unique (id, skill_id),
  constraint eval_sets_skill_name_unique unique (skill_id, name)
);

create table eval_cases (
  id text primary key,
  skill_id text not null references skills(id),
  title text not null,
  current_version_id text,
  lifecycle_status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint eval_cases_lifecycle_status_check check (lifecycle_status in ('active', 'archived')),
  constraint eval_cases_id_skill_unique unique (id, skill_id)
);

create table eval_case_versions (
  id text primary key,
  skill_id text not null,
  case_id text not null,
  version_number integer not null,
  input_artifact_id text not null references artifacts(id),
  expected_output_artifact_id text not null references artifacts(id),
  notes text,
  created_at timestamptz not null default now(),
  created_by text not null,
  constraint eval_case_versions_version_number_positive check (version_number > 0),
  constraint eval_case_versions_case_version_unique unique (case_id, version_number),
  constraint eval_case_versions_id_skill_unique unique (id, skill_id),
  constraint eval_case_versions_case_skill_fkey foreign key (case_id, skill_id) references eval_cases(id, skill_id)
);

alter table eval_cases
  add constraint eval_cases_current_version_fkey
  foreign key (current_version_id, skill_id) references eval_case_versions(id, skill_id);

create table eval_set_versions (
  id text primary key,
  skill_id text not null,
  eval_set_id text not null,
  version_number integer not null,
  created_at timestamptz not null default now(),
  created_by text not null,
  constraint eval_set_versions_version_number_positive check (version_number > 0),
  constraint eval_set_versions_eval_set_version_unique unique (eval_set_id, version_number),
  constraint eval_set_versions_id_skill_unique unique (id, skill_id),
  constraint eval_set_versions_eval_set_skill_fkey foreign key (eval_set_id, skill_id) references eval_sets(id, skill_id)
);

alter table eval_sets
  add constraint eval_sets_current_version_fkey
  foreign key (current_version_id, skill_id) references eval_set_versions(id, skill_id);

create table eval_set_case_versions (
  eval_set_version_id text not null,
  skill_id text not null,
  case_version_id text not null,
  position integer not null,
  primary key (eval_set_version_id, position),
  constraint eval_set_case_versions_position_non_negative check (position >= 0),
  constraint eval_set_case_versions_case_unique unique (eval_set_version_id, case_version_id),
  constraint eval_set_case_versions_set_skill_fkey foreign key (eval_set_version_id, skill_id) references eval_set_versions(id, skill_id),
  constraint eval_set_case_versions_case_skill_fkey foreign key (case_version_id, skill_id) references eval_case_versions(id, skill_id)
);

create table eval_runs (
  id text primary key,
  skill_id text not null,
  variant_version_id text not null,
  eval_set_version_id text not null,
  strategy text not null,
  status text not null,
  summary jsonb not null default '{}'::jsonb,
  result_artifact_id text references artifacts(id),
  created_at timestamptz not null default now(),
  created_by text not null,
  constraint eval_runs_status_check check (status in ('queued', 'running', 'finished', 'failed')),
  constraint eval_runs_id_skill_unique unique (id, skill_id),
  constraint eval_runs_variant_version_skill_fkey foreign key (variant_version_id, skill_id) references variant_versions(id, skill_id),
  constraint eval_runs_eval_set_version_skill_fkey foreign key (eval_set_version_id, skill_id) references eval_set_versions(id, skill_id)
);

create table case_results (
  run_id text not null,
  skill_id text not null,
  case_version_id text not null,
  passed boolean not null,
  score integer not null,
  result_artifact_id text references artifacts(id),
  created_at timestamptz not null default now(),
  primary key (run_id, case_version_id),
  constraint case_results_score_pass_fail check (score in (0, 1)),
  constraint case_results_run_skill_fkey foreign key (run_id, skill_id) references eval_runs(id, skill_id),
  constraint case_results_case_skill_fkey foreign key (case_version_id, skill_id) references eval_case_versions(id, skill_id)
);

create table jobs (
  id text primary key,
  type text not null,
  status text not null default 'queued',
  payload jsonb not null,
  result_ref text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  created_by text not null,
  error text,
  constraint jobs_status_check check (status in ('queued', 'running', 'succeeded', 'failed', 'canceled'))
);

create table role_assignments (
  id text primary key,
  subject_type text not null,
  subject_id text not null,
  resource_type text not null,
  resource_id text not null,
  role text not null,
  created_at timestamptz not null default now(),
  created_by text not null,
  constraint role_assignments_role_check check (role in ('owner', 'maintainer', 'evaluator', 'viewer')),
  constraint role_assignments_scope_unique unique (subject_type, subject_id, resource_type, resource_id, role)
);

create table audit_events (
  id text primary key,
  actor_ref text not null,
  action text not null,
  resource_type text not null,
  resource_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index artifacts_namespace_idx on artifacts (namespace);
create index variants_skill_id_idx on variants (skill_id);
create index variants_tag_set_id_idx on variants (tag_set_id);
create index variant_versions_skill_id_idx on variant_versions (skill_id);
create index variant_versions_variant_id_idx on variant_versions (variant_id);
create index eval_sets_skill_id_idx on eval_sets (skill_id);
create index eval_cases_skill_id_idx on eval_cases (skill_id);
create index eval_case_versions_skill_id_idx on eval_case_versions (skill_id);
create index eval_case_versions_case_id_idx on eval_case_versions (case_id);
create index eval_set_versions_skill_id_idx on eval_set_versions (skill_id);
create index eval_set_versions_eval_set_id_idx on eval_set_versions (eval_set_id);
create index eval_set_case_versions_skill_id_idx on eval_set_case_versions (skill_id);
create index eval_set_case_versions_case_version_id_idx on eval_set_case_versions (case_version_id);
create index eval_runs_skill_id_created_at_idx on eval_runs (skill_id, created_at desc);
create index eval_runs_variant_version_id_idx on eval_runs (variant_version_id);
create index eval_runs_eval_set_version_id_idx on eval_runs (eval_set_version_id);
create index case_results_skill_id_idx on case_results (skill_id);
create index case_results_case_version_id_idx on case_results (case_version_id);
create index jobs_status_created_at_idx on jobs (status, created_at);
create index role_assignments_resource_idx on role_assignments (resource_type, resource_id);
create index audit_events_resource_idx on audit_events (resource_type, resource_id, created_at desc);
