# Supabase setup for MACI

The backend runs **without** Supabase (it falls back to an in-memory store).
Configure Supabase when you want data to persist.

## 1. Create a project

1. Go to <https://app.supabase.com> → **New project**.
2. Copy from **Project Settings → API**:
   - `Project URL`  → `SUPABASE_URL`
   - `anon` / `publishable` key → `SUPABASE_KEY`
   - *(optional)* `service_role` key → `SUPABASE_SERVICE_KEY` (used only by the
     ingestion scripts; never ship it to the frontend)

## 2. Apply the schema

**Option A — SQL editor (simplest)**

1. Open **SQL Editor** in the Supabase dashboard.
2. Paste the entire contents of [`migrations/0001_init.sql`](migrations/0001_init.sql).
3. Click **Run**.

**Option B — Supabase CLI**

```bash
supabase link --project-ref <your-ref>
supabase db push        # applies everything in supabase/migrations/
```

**Option C — psql**

```bash
psql "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" \
  -f supabase/migrations/0001_init.sql
```

## 3. Point the backend at it

Add the three values to the repo-root `.env`, then restart the API. On start-up
the log line should read `Using Supabase repository`. `GET /api/health` will show
`"repository": "supabase"`.

## 4. Row Level Security

RLS is intentionally **disabled** in the migration so the prototype works with a
single server-side key. Production requires enabling RLS with per-role policies —
see the commented block at the bottom of `0001_init.sql` — plus a formal
security & compliance review. **This prototype is not HIPAA / DPDP / ABDM
certified.**

## Tables created

`patients`, `consents`, `clinical_sessions`, `clinical_answers`,
`medical_histories`, `documents`, `ocr_results`, `medications`, `allergies`,
`lab_results`, `clinical_summaries`, `alerts`, `ayush_assessments`.

Vector embeddings are **not** stored in Supabase — they live in Pinecone.
