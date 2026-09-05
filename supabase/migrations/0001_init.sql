-- ===========================================================================
-- MACI - Multilingual AI Clinical Intake Platform
-- Initial schema  (PostgreSQL / Supabase)
-- ---------------------------------------------------------------------------
-- Apply with either:
--   * Supabase SQL Editor  (paste this whole file, Run)
--   * supabase db push      (if using the Supabase CLI with this repo linked)
--   * psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_init.sql
--
-- Vector embeddings are NOT stored here - they live in Pinecone. Only
-- lightweight vector *metadata* references are kept (documents.indexed_in_pinecone).
-- ===========================================================================

create extension if not exists "pgcrypto";      -- gen_random_uuid()

-- --------------------------------------------------------------------------
-- Enum-like domains (kept as TEXT + CHECK for easy evolution)
-- --------------------------------------------------------------------------
do $$ begin
  create type gender_t              as enum ('male','female','other','undisclosed');
  create type language_t            as enum ('en','hi');
  create type intake_mode_t         as enum ('voice','text');
  create type clinical_mode_t       as enum ('general','ayush');
  create type session_status_t      as enum ('created','in_progress','awaiting_documents','summary_ready','submitted','reviewed','cancelled');
  create type triage_priority_t     as enum ('routine','standard','urgent','emergency');
  create type document_type_t       as enum ('prescription','lab_report','discharge_summary','imaging_report','referral','other');
  create type document_status_t     as enum ('uploaded','ocr_running','ocr_done','structured','failed');
  create type summary_status_t      as enum ('draft','edited','confirmed','rejected');
  create type alert_status_t        as enum ('open','acknowledged','resolved');
  create type message_role_t        as enum ('patient','assistant','system');
exception when duplicate_object then null; end $$;

-- --------------------------------------------------------------------------
-- Shared updated_at trigger
-- --------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

-- ========================================================================
-- patients
-- ========================================================================
create table if not exists patients (
  id                  uuid primary key default gen_random_uuid(),
  full_name           text not null check (length(trim(full_name)) > 0),
  age                 int  check (age is null or (age >= 0 and age <= 130)),
  gender              gender_t not null default 'undisclosed',
  preferred_language  language_t not null default 'en',
  phone               text,
  abha_id             text,                    -- optional ABHA/ABDM id (NOT verified in prototype)
  mrn                 text,                    -- hospital medical record number
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_patients_mrn      on patients (mrn);
create index if not exists idx_patients_abha      on patients (abha_id);
create index if not exists idx_patients_created  on patients (created_at desc);
create or replace trigger trg_patients_updated before update on patients
  for each row execute function set_updated_at();

-- ========================================================================
-- consents  (consent recording - required before intake)
-- ========================================================================
create table if not exists consents (
  id                    uuid primary key default gen_random_uuid(),
  patient_id            uuid not null references patients(id) on delete cascade,
  session_id            uuid,                  -- FK added after clinical_sessions
  consent_text_version  text not null default 'v1',
  data_processing       boolean not null default false,
  ai_assistance         boolean not null default false,
  share_with_clinician   boolean not null default false,
  channel               text not null default 'kiosk',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_consents_patient on consents (patient_id);
create or replace trigger trg_consents_updated before update on consents
  for each row execute function set_updated_at();

-- ========================================================================
-- clinical_sessions
-- ========================================================================
create table if not exists clinical_sessions (
  id                uuid primary key default gen_random_uuid(),
  patient_id        uuid not null references patients(id) on delete cascade,
  language          language_t not null default 'en',
  mode              intake_mode_t not null default 'text',
  clinical_mode     clinical_mode_t not null default 'general',
  department        text,
  chief_complaint   text,
  status            session_status_t not null default 'created',
  triage_priority   triage_priority_t not null default 'standard',
  red_flag          boolean not null default false,
  question_count    int not null default 0,
  completion_pct    int not null default 0 check (completion_pct between 0 and 100),
  transcript        jsonb not null default '[]'::jsonb,
  partial_history   jsonb,
  submitted_at      timestamptz,
  reviewed_at       timestamptz,
  reviewed_by       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_sessions_patient   on clinical_sessions (patient_id);
create index if not exists idx_sessions_status    on clinical_sessions (status);
create index if not exists idx_sessions_priority  on clinical_sessions (triage_priority);
create index if not exists idx_sessions_redflag   on clinical_sessions (red_flag) where red_flag;
create index if not exists idx_sessions_submitted on clinical_sessions (submitted_at desc);
create or replace trigger trg_sessions_updated before update on clinical_sessions
  for each row execute function set_updated_at();

do $$ begin
  alter table consents
    add constraint fk_consents_session
    foreign key (session_id) references clinical_sessions(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ========================================================================
-- clinical_answers  (interview transcript, one row per message/turn)
-- ========================================================================
create table if not exists clinical_answers (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references clinical_sessions(id) on delete cascade,
  patient_id      uuid not null references patients(id) on delete cascade,
  role            message_role_t not null,
  text            text not null,
  question_index  int,
  meta            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_answers_session on clinical_answers (session_id, created_at);
create index if not exists idx_answers_patient on clinical_answers (patient_id);
create or replace trigger trg_answers_updated before update on clinical_answers
  for each row execute function set_updated_at();

-- ========================================================================
-- medical_histories  (structured history snapshots)
-- ========================================================================
create table if not exists medical_histories (
  id                  uuid primary key default gen_random_uuid(),
  patient_id          uuid not null references patients(id) on delete cascade,
  session_id          uuid not null references clinical_sessions(id) on delete cascade,
  structured          jsonb not null default '{}'::jsonb,
  completeness_score  int not null default 0 check (completeness_score between 0 and 100),
  source              text not null default 'interview',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_histories_patient on medical_histories (patient_id, created_at desc);
create index if not exists idx_histories_session on medical_histories (session_id);
create or replace trigger trg_histories_updated before update on medical_histories
  for each row execute function set_updated_at();

-- ========================================================================
-- documents
-- ========================================================================
create table if not exists documents (
  id                    uuid primary key default gen_random_uuid(),
  session_id            uuid not null references clinical_sessions(id) on delete cascade,
  patient_id            uuid not null references patients(id) on delete cascade,
  filename              text not null,
  stored_path           text,
  content_type          text not null default 'application/octet-stream',
  size_bytes            bigint not null default 0,
  document_type         document_type_t not null default 'other',
  status                document_status_t not null default 'uploaded',
  ocr_text              text,
  ocr_engine            text,
  ocr_confidence        real,
  structured            jsonb,
  error                 text,
  corrected_by_user     boolean not null default false,
  indexed_in_pinecone   boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_documents_session on documents (session_id);
create index if not exists idx_documents_patient on documents (patient_id);
create index if not exists idx_documents_status  on documents (status);
create or replace trigger trg_documents_updated before update on documents
  for each row execute function set_updated_at();

-- ========================================================================
-- ocr_results  (raw OCR payload history, one row per OCR run)
-- ========================================================================
create table if not exists ocr_results (
  id               uuid primary key default gen_random_uuid(),
  document_id      uuid not null references documents(id) on delete cascade,
  patient_id       uuid not null references patients(id) on delete cascade,
  engine           text not null,
  raw_text         text not null default '',
  mean_confidence  real,
  pages            int not null default 1,
  payload          jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_ocr_document on ocr_results (document_id);
create or replace trigger trg_ocr_updated before update on ocr_results
  for each row execute function set_updated_at();

-- ========================================================================
-- medications
-- ========================================================================
create table if not exists medications (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references patients(id) on delete cascade,
  session_id   uuid references clinical_sessions(id) on delete set null,
  document_id  uuid references documents(id) on delete set null,
  name         text not null,
  dosage       text default '',
  frequency    text default '',
  route        text default '',
  duration     text default '',
  indication   text default '',
  source       text not null default 'document',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_medications_patient on medications (patient_id);
create index if not exists idx_medications_session on medications (session_id);
create or replace trigger trg_medications_updated before update on medications
  for each row execute function set_updated_at();

-- ========================================================================
-- allergies
-- ========================================================================
create table if not exists allergies (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references patients(id) on delete cascade,
  session_id   uuid references clinical_sessions(id) on delete set null,
  substance    text not null,
  reaction     text default '',
  severity     text default '',
  source       text not null default 'interview',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_allergies_patient on allergies (patient_id);
create or replace trigger trg_allergies_updated before update on allergies
  for each row execute function set_updated_at();

-- ========================================================================
-- lab_results
-- ========================================================================
create table if not exists lab_results (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references patients(id) on delete cascade,
  session_id       uuid references clinical_sessions(id) on delete set null,
  document_id      uuid references documents(id) on delete set null,
  test_name        text not null,
  value            text default '',
  unit             text default '',
  reference_range  text default '',
  flag             text default '',
  observed_at      text default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_labs_patient on lab_results (patient_id);
create index if not exists idx_labs_document on lab_results (document_id);
create or replace trigger trg_labs_updated before update on lab_results
  for each row execute function set_updated_at();

-- ========================================================================
-- clinical_summaries  (AI-drafted, clinician-reviewed)
-- ========================================================================
create table if not exists clinical_summaries (
  id                    uuid primary key default gen_random_uuid(),
  session_id            uuid not null references clinical_sessions(id) on delete cascade,
  patient_id            uuid not null references patients(id) on delete cascade,
  status                summary_status_t not null default 'draft',
  narrative             text not null default '',
  history               jsonb not null default '{}'::jsonb,
  edited_history        jsonb,
  document_intelligence jsonb not null default '[]'::jsonb,
  timeline              jsonb not null default '[]'::jsonb,
  ayush_assessment      jsonb,
  red_flags             jsonb not null default '[]'::jsonb,
  attention_points      jsonb not null default '[]'::jsonb,
  triage_priority       triage_priority_t not null default 'standard',
  retrieved_context     jsonb not null default '[]'::jsonb,
  used_llm_fallback     boolean not null default false,
  model_name            text not null default '',
  doctor_notes          text not null default '',
  reviewed_by           text,
  confirmed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_summaries_session on clinical_summaries (session_id, created_at desc);
create index if not exists idx_summaries_patient on clinical_summaries (patient_id);
create index if not exists idx_summaries_status  on clinical_summaries (status);
create or replace trigger trg_summaries_updated before update on clinical_summaries
  for each row execute function set_updated_at();

-- ========================================================================
-- alerts  (red-flag alerts surfaced on the doctor dashboard)
-- ========================================================================
create table if not exists alerts (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references clinical_sessions(id) on delete cascade,
  patient_id       uuid not null references patients(id) on delete cascade,
  kind             text not null default 'red_flag',
  label            text not null default '',
  detail           text not null default '',
  severity         triage_priority_t not null default 'urgent',
  status           alert_status_t not null default 'open',
  source           text not null default 'rule',   -- 'rule' | 'llm'
  acknowledged_by  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_alerts_session on alerts (session_id);
create index if not exists idx_alerts_status  on alerts (status) where status = 'open';
create or replace trigger trg_alerts_updated before update on alerts
  for each row execute function set_updated_at();

-- ========================================================================
-- ayush_assessments  (optional AYUSH / Ayurveda mode - kept separate)
-- ========================================================================
create table if not exists ayush_assessments (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references clinical_sessions(id) on delete cascade,
  patient_id   uuid not null references patients(id) on delete cascade,
  assessment   jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_ayush_session on ayush_assessments (session_id);
create or replace trigger trg_ayush_updated before update on ayush_assessments
  for each row execute function set_updated_at();

-- ===========================================================================
-- Row Level Security
-- ---------------------------------------------------------------------------
-- The prototype backend talks to Supabase with a single server-side key and
-- performs its OWN patient-isolation checks in the repository layer. RLS is
-- therefore left DISABLED by default so the prototype "just works".
--
-- FOR PRODUCTION you MUST enable RLS on every table above and add policies
-- scoped to the authenticated clinician / patient. Example skeleton:
--
--   alter table patients enable row level security;
--   create policy "clinicians read patients"
--     on patients for select to authenticated using (true);
--
-- A production deployment also requires: encryption at rest + in transit,
-- audit logging, PII minimisation, and a formal security & compliance review
-- (HIPAA / India DPDP Act / ABDM). This prototype claims NO certification.
-- ===========================================================================
