# MACI — Data & Dataset Ingestion

This folder is where datasets live. **No large synthetic dataset is bundled** —
only a tiny demo under [`demo/`](demo/) so you can verify the app. Provide your
real dataset later and import it with the scripts in [`../scripts/`](../scripts/)
**without changing any application code**.

```
data/
├── README_DATA.md        <- this file
├── demo/                  <- minimal demo records (safe to delete)
│   ├── demo_intake_records.jsonl
│   └── demo_patients.csv
├── real/                  <- put YOUR dataset here  (git-ignored)
└── uploads/               <- runtime document storage (git-ignored, auto-created)
```

> Place your real dataset files in **`data/real/`**. That path is git-ignored.

---

## 1. Supported formats

| Format | Extension        | Shape                                             |
|--------|------------------|--------------------------------------------------|
| JSONL  | `.jsonl`,`.ndjson` | one **unified intake record** per line          |
| JSON   | `.json`          | an array of records, or `{ "records": [ ... ] }` |
| CSV    | `.csv`           | one record per row (flat columns + JSON columns) |

Document *files* (image/PDF scans) are handled by the running app’s
`POST /api/documents/upload` endpoint, or you can embed their **text** directly
in a record (see `documents[].text`).

---

## 2. The unified intake record

Every importer consumes this one object shape. All fields except
`patient.full_name` are optional.

```jsonc
{
  "patient": {
    "external_id": "HOSP-000123",       // your id (kept for your reference)
    "full_name": "Asha Rao",            // REQUIRED
    "age": 58,
    "gender": "female",                 // male | female | other | undisclosed
    "preferred_language": "en",         // en | hi
    "phone": "…",
    "mrn": "MRN-000123",                // used to de-duplicate on re-import
    "abha_id": "12-3456-7890-1234"      // optional, NOT verified in the prototype
  },

  "session": {
    "chief_complaint": "Chest discomfort on exertion for 3 days",
    "language": "en",                   // en | hi
    "mode": "text",                     // text | voice
    "clinical_mode": "general",         // general | ayush
    "department": "General Medicine",
    "status": "submitted"               // created|in_progress|awaiting_documents|
                                        // summary_ready|submitted|reviewed
  },

  "transcript": [                       // optional prior Q&A, oldest first
    { "role": "assistant", "text": "When did it start?" },
    { "role": "patient",   "text": "Three days ago, on exertion." }
  ],

  "history": {                          // optional; validated against the
    "chief_complaint": "…",             // StructuredClinicalHistory schema and
    "history_of_present_illness": {     // coerced if slightly malformed
      "onset": "3 days ago",
      "duration": "3 days",
      "severity": "5-6/10 on exertion",
      "aggravating_factors": ["stairs"],
      "relieving_factors": ["rest"],
      "associated_symptoms": ["mild dyspnoea"]
    },
    "past_medical_history": ["Hypertension"],
    "medications": [{ "name": "Amlodipine", "dosage": "5 mg", "frequency": "OD" }],
    "allergies": ["No known drug allergy"],
    "family_history": ["Father MI at 60"],
    "personal_history": { "smoking": "Never", "alcohol": "Occasional" },
    "review_of_systems": { "cardiovascular": "exertional chest pressure" },
    "previous_investigations": ["ECG normal 6 months ago"],
    "red_flags": [],
    "triage_priority": "urgent",
    "doctor_attention_points": ["Consider ECG + troponin"]
  },

  "documents": [                        // optional
    {
      "filename": "amlodipine_rx.txt",
      "document_type": "prescription",  // prescription | lab_report |
                                        // discharge_summary | imaging_report |
                                        // referral | other
      "document_date": "2025-06-10",
      "text": "City Care Clinic\nDate: 2025-06-10\nTab Amlodipine 5 mg 1-0-0",
      "structured": { /* optional pre-parsed StructuredDocument; if absent the
                        importer runs the heuristic parser on `text` */ }
    }
  ],

  "summary": {                          // optional; if absent a summary is built
    "narrative": "58-year-old woman with …",
    "attention_points": ["Evaluate for stable angina"],
    "red_flags": [],
    "triage_priority": "urgent",
    "history": { /* optional override of the structured history */ }
  },

  "ayush": {                            // optional; only for clinical_mode = ayush
    "prakriti": "Vata-Pitta", "vikriti": "Pitta aggravation", "ahara_shakti": "moderate"
  }
}
```

### CSV column mapping

Flat columns: `external_id, full_name, age, gender, preferred_language, phone,
mrn, abha_id, chief_complaint, session_language, mode, clinical_mode,
department, status`.

JSON-in-a-cell columns (stringified JSON): `transcript_json`, `documents_json`,
`history_json`, `summary_json`, `ayush_json`.

See [`demo/demo_patients.csv`](demo/demo_patients.csv) for a working example.

---

## 3. What ingestion does

For each record the importer (`scripts/_maci_ingest.py`) will:

1. **Patient** — reuse an existing patient with the same `mrn`, else create one.
2. **Consent** — record a `dataset-import` consent row.
3. **Session** — create a `clinical_sessions` row with the transcript and a
   deterministic red-flag screen applied to the patient text.
4. **Transcript** — write each turn to `clinical_answers`.
5. **Documents** — validate/parse `structured` (or run the heuristic parser on
   `text`), write `documents` + derived `medications` / `lab_results`.
6. **History** — validate/coerce to the structured schema → `medical_histories`.
7. **Summary** — write a `clinical_summaries` draft (using your `summary` block
   if given, otherwise assembled from history + documents + timeline).
8. **Alerts** — create `alerts` rows for any deterministic red flags.
9. **AYUSH** — write an `ayush_assessments` row when `ayush` is present.
10. **Index** — embed and upsert document chunks, the summary and the structured
    history into the vector store, namespaced per patient.

Where the data lands:

| Target                        | When                                             |
|-------------------------------|--------------------------------------------------|
| **Supabase / PostgreSQL**     | if `SUPABASE_URL` + `SUPABASE_KEY` are set *and* the schema is applied |
| **In-memory store**           | otherwise (data lives only for that process)     |
| **Pinecone**                  | if `PINECONE_API_KEY` (+ host/index) are set     |
| **In-memory vector store**    | otherwise                                        |

Run `GET /api/health` to see which backends are active.

---

## 4. How to import your dataset

```bash
# 0. (once) apply the DB schema  — see ../supabase/README.md
# 1. put files in data/real/
# 2. validate without writing
python scripts/import_dataset.py --path data/real/intake.jsonl --dry-run

# 3. import (also indexes into the vector store)
python scripts/import_dataset.py --path data/real/intake.jsonl

# variations
python scripts/import_dataset.py --path "data/real/*.csv" --format csv
python scripts/import_dataset.py --path data/real/records.json --no-index --limit 100
```

### (Re)building the vector index only

```bash
python scripts/index_pinecone.py --create-index          # create the Pinecone index if missing
python scripts/index_pinecone.py --all                    # reindex every patient in the DB
python scripts/index_pinecone.py --patient <patient_id>   # reindex one patient
python scripts/index_pinecone.py --from-file data/real/intake.jsonl
```

### Seeding the demo

```bash
python scripts/seed_demo_data.py            # ingest + index data/demo/*
python scripts/seed_demo_data.py --no-index
python scripts/seed_demo_data.py --list     # preview only
```

---

## 5. Notes & safety

- **Patient isolation** is enforced on every vector operation (per-patient
  namespace + mandatory `patient_id` metadata filter). One patient’s records can
  never be retrieved for another.
- Do **not** commit real patient data. `data/real/` and `data/uploads/` are
  git-ignored.
- This is a prototype. It is **not** HIPAA / India DPDP / ABDM certified;
  production use needs a formal security & compliance review.
