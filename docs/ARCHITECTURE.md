# MACI — Architecture & Diagrams

Companion to the root [`README.md`](../README.md) §4. All diagrams are Mermaid
(they render on GitHub).

- [1. System flow (pipeline)](#1-system-flow-pipeline)
- [2. Component / architecture flow](#2-component--architecture-flow)
- [3. Input / Output (I/O) diagram](#3-input--output-io-diagram)
- [4. End-to-end sequence](#4-end-to-end-sequence)
- [5. Backend layers & graceful degradation](#5-backend-layers--graceful-degradation)
- [6. Red-flag safety decision flow](#6-red-flag-safety-decision-flow)
- [7. RAG & patient isolation](#7-rag--patient-isolation)
- [8. Database schema (ER)](#8-database-schema-er)
- [9. Patient intake state machine](#9-patient-intake-state-machine)
- [10. Deployment](#10-deployment)

---

## 1. System flow (pipeline)

```mermaid
flowchart TD
    A([Patient]) --> B[React Frontend]
    B --> C{Voice / Touch / Text}
    C --> D[FastAPI Backend]
    D --> E[Groq API]
    E --> F[Adaptive Clinical Questions + Clinical History]
    F --> G[OCR.Space]
    G --> H[Prescription / Lab Report / Discharge Summary Extraction]
    H --> I[Pinecone]
    I --> J[Store / retrieve document embeddings + previous medical context]
    J --> K[Groq]
    K --> L[Structured Physician-Ready Clinical Summary]
    L --> M[Supabase]
    M --> N[Save Patient / Session / History / Documents / Summary]
    N --> O([Doctor Dashboard])
```

---

## 2. Component / architecture flow

```mermaid
flowchart LR
    P([Patient]):::actor
    DR([Doctor]):::actor

    subgraph FE["Frontend — React 18 + Vite + Tailwind"]
        KIOSK["Patient kiosk<br/>Details → Symptoms → History → Documents → AI Review → Submit"]
        DASH["Doctor dashboard<br/>queue · patient view · analytics"]
        VOICE["Voice layer<br/>Web Speech ASR + speechSynthesis TTS"]
        I18N["i18n (EN / HI, extensible)"]
    end

    subgraph BE["Backend — FastAPI + Pydantic"]
        R["API routes /api/*"]
        subgraph S["Service layer"]
            INT["clinical_interview_service"]
            SUM["summary_service"]
            DOC["document_service"]
            TRI["red_flag_service (deterministic)"]:::safe
            TL["timeline_service"]
            DOCT["doctor_service"]
            VOX["voice_service"]
            ABDM["abdm_service (stub)"]
        end
        subgraph ABS["Abstractions"]
            REPO["repositories: memory | supabase"]
            VEC["vector store: memory | pinecone"]
            EMB["embeddings: hash | fastembed | ST"]
            LLM["groq_service: JSON mode + retry/repair"]
            OCRS["ocr_service"]
        end
    end

    subgraph EXT["External (server-side only, all optional)"]
        GROQ[(Groq)]
        OCRA[(OCR.Space)]
        PC[(Pinecone)]
        SB[(Supabase / PostgreSQL)]
    end

    P <--> KIOSK
    KIOSK --- VOICE
    KIOSK --- I18N
    DR <--> DASH
    KIOSK & DASH -->|HTTPS JSON / multipart| R
    R --> S
    INT & SUM & DOC --> TRI
    INT & SUM & DOC --> LLM --> GROQ
    DOC --> OCRS --> OCRA
    SUM & DOC --> VEC --> PC
    VEC --> EMB
    S --> REPO --> SB

    classDef actor fill:#eef6ff,stroke:#1a63db,color:#0f1b2d;
    classDef safe fill:#ffe4e6,stroke:#e11d48,color:#881337;
```

---

## 3. Input / Output (I/O) diagram

```mermaid
flowchart LR
    subgraph INPUTS
        I1["Voice answers (browser ASR)"]
        I2["Touch / text answers"]
        I3["Document uploads — Rx / lab / discharge (image / PDF / text)"]
        I4["Language choice (EN / HI)"]
        I5["Consent"]
        I6["Demographics"]
    end

    CORE(("MACI"))

    subgraph OUTPUTS
        O1["Structured clinical history (validated JSON)"]
        O2["Physician-ready summary + narrative"]
        O3["Medical timeline (chronological)"]
        O4["Red-flag alerts + triage priority"]
        O5["Document intelligence — meds / doses / labs / dates / diagnoses"]
        O6["Doctor queue + analytics"]
        O7["Spoken questions (TTS)"]
        O8["Retrieved prior context (RAG)"]
    end

    I1 & I2 & I3 & I4 & I5 & I6 --> CORE
    CORE --> O1 & O2 & O3 & O4 & O5 & O6 & O7 & O8
```

| Input | Consumed by | Produces |
|---|---|---|
| Voice / text answer | `POST /api/history/message` → interview service | next question, `suggested_replies`, triage, partial history |
| Document upload | `POST /api/documents/upload` + `/process` | OCR text, `StructuredDocument`, `medications`/`lab_results` rows, vectors |
| "Generate summary" | `POST /api/history/generate-summary` | `ClinicalSummary` (history JSON + narrative + timeline + red flags + attention points) |
| Submit | `POST /api/sessions/{id}/submit` | session `status=submitted`, appears on doctor queue |
| Doctor edit / confirm | `PATCH/POST /api/summaries/{id}` | `status=edited|confirmed|rejected`, doctor notes |

---

## 4. End-to-end sequence

```mermaid
sequenceDiagram
    actor Patient
    participant FE as React Frontend
    participant API as FastAPI
    participant RF as Red-flag engine
    participant Groq
    participant OCR as OCR.Space
    participant PC as Pinecone
    participant DB as Supabase
    actor Doctor

    Patient->>FE: demographics + consent
    FE->>API: POST /api/patients, /consent, /sessions
    API->>DB: persist patient / consent / session

    loop Adaptive interview
        Patient->>FE: answer (voice→text or text)
        FE->>API: POST /api/history/message
        API->>RF: screen message (deterministic, always)
        API->>Groq: next question (JSON mode)
        Groq-->>API: {assistant_message, next_question, is_complete}
        API->>DB: append transcript, triage, alerts
        API-->>FE: question + suggestions + triage
    end

    Patient->>FE: upload prescription / lab report
    FE->>API: POST /api/documents/upload → /process
    API->>OCR: extract text
    OCR-->>API: raw text
    API->>Groq: structure text → {meds, labs, dates}
    API->>PC: embed + upsert (namespace = patient::id)
    API->>DB: save document + extractions

    FE->>API: POST /api/history/generate-summary
    API->>PC: query prior context (patient_id filter)
    PC-->>API: relevant chunks
    API->>Groq: history + documents + context → summary JSON
    API->>RF: re-screen summary (deterministic escalation wins)
    API->>DB: save clinical_summary (status = draft)

    Patient->>FE: submit
    FE->>API: POST /api/sessions/{id}/submit
    Doctor->>API: GET /api/doctor/queue → /patients/{id}/summary
    Doctor->>API: edit → PATCH /summaries/{id} → POST /confirm
    Doctor->>API: POST /api/doctor/sessions/{id}/reviewed
```

---

## 5. Backend layers & graceful degradation

```mermaid
flowchart TD
    REQ[HTTP request] --> RT[Route + Pydantic validation]
    RT --> SVC[Service layer]
    SVC --> DET{External service<br/>configured & reachable?}

    DET -- Groq yes --> G1[Groq JSON mode<br/>+ retry + repair pass]
    DET -- Groq no/err --> G2[Scripted interview /<br/>template summary /<br/>heuristic structuring]

    DET -- OCR yes --> O1[OCR.Space]
    DET -- OCR no/err --> O2[Direct text read /<br/>manual entry prompt]

    DET -- Pinecone yes --> P1[Pinecone upsert/query]
    DET -- Pinecone no/err --> P2[In-process cosine store]

    DET -- Supabase yes --> S1[SupabaseRepository]
    DET -- Supabase no/err --> S2[InMemoryRepository]

    G1 & G2 & O1 & O2 & P1 & P2 & S1 & S2 --> RESP[Typed response]
    RESP --> OUT[JSON to client]
```

The choice is logged at startup and surfaced at `GET /api/health`
(`integrations` booleans + `runtime.repository` / `runtime.vector_store`).

---

## 6. Red-flag safety decision flow

```mermaid
flowchart TD
    MSG[Patient message / summary text] --> RULES[Deterministic rule + regex engine]
    RULES --> NEG{Negated?<br/>"no", "denies", "without"…}
    NEG -- yes --> DROP[Ignore match]
    NEG -- no --> HIT[Record RedFlagHit<br/>rule_id · category · severity]

    HIT --> SEV{Highest severity}
    SEV -- emergency/urgent --> ESC[red_flag = true<br/>priority = emergency/urgent]
    SEV -- none --> OKk[priority = standard]

    subgraph OPT["Optional additive LLM screen (never removes a rule hit)"]
        LLMS[llm_safety_review]
    end
    ESC --> MERGE[merge_triage]
    OKk --> MERGE
    LLMS --> MERGE

    MERGE --> ACT["Patient: 'Potential urgent symptom detected.<br/>Please contact medical staff immediately.'<br/>(never a diagnosis)"]
    MERGE --> DBW[session.red_flag = true<br/>session.triage_priority ↑<br/>create alerts row]
    DBW --> DASH[Doctor dashboard: HIGH PRIORITY badge + alert]
```

Key rule: **the deterministic layer always wins on escalation** — the LLM can
add concerns but can never downgrade or clear a rule-based red flag.

---

## 7. RAG & patient isolation

```mermaid
flowchart LR
    subgraph WRITE["Index (on document process / summary generate)"]
        T1[OCR text chunks]
        T2[Document summary line]
        T3[Clinical summary]
        T4[Structured history]
        T1 & T2 & T3 & T4 --> EMB[Embedding abstraction]
        EMB --> UP["upsert(patient_id, records)<br/>namespace = patient::&lt;id&gt;<br/>metadata.patient_id = &lt;id&gt;"]
        UP --> PC[(Pinecone / in-memory)]
    end

    subgraph READ["Retrieve (on summary generate)"]
        Q["query(patient_id, text)<br/>❗ raises if patient_id missing"]
        Q --> F["namespace = patient::&lt;id&gt;<br/>AND filter metadata.patient_id == &lt;id&gt;"]
        F --> PC
        PC --> R["matches — re-checked:<br/>drop any row whose metadata.patient_id ≠ &lt;id&gt;"]
    end
```

Three independent guards: per-patient **namespace**, mandatory **metadata
filter**, and a **post-query re-check**. One patient's records can never surface
for another.

---

## 8. Database schema (ER)

```mermaid
erDiagram
    patients ||--o{ consents : has
    patients ||--o{ clinical_sessions : has
    patients ||--o{ documents : has
    patients ||--o{ medications : has
    patients ||--o{ allergies : has
    patients ||--o{ lab_results : has
    patients ||--o{ medical_histories : has
    patients ||--o{ clinical_summaries : has
    patients ||--o{ alerts : has

    clinical_sessions ||--o{ clinical_answers : contains
    clinical_sessions ||--o{ documents : has
    clinical_sessions ||--o{ medical_histories : produces
    clinical_sessions ||--|| clinical_summaries : produces
    clinical_sessions ||--o{ alerts : raises
    clinical_sessions ||--o| ayush_assessments : "optional (AYUSH mode)"
    clinical_sessions ||--o| consents : "linked"

    documents ||--o{ ocr_results : yields
    documents ||--o{ medications : extracts
    documents ||--o{ lab_results : extracts

    patients {
        uuid id PK
        text full_name
        int age
        enum gender
        enum preferred_language
        text mrn
        text abha_id
        timestamptz created_at
    }
    clinical_sessions {
        uuid id PK
        uuid patient_id FK
        enum status
        enum triage_priority
        bool red_flag
        int completion_pct
        jsonb transcript
        jsonb partial_history
        timestamptz submitted_at
    }
    documents {
        uuid id PK
        uuid session_id FK
        uuid patient_id FK
        enum document_type
        enum status
        text ocr_text
        jsonb structured
        bool corrected_by_user
    }
    clinical_summaries {
        uuid id PK
        uuid session_id FK
        uuid patient_id FK
        enum status
        text narrative
        jsonb history
        jsonb timeline
        jsonb red_flags
        jsonb attention_points
        text reviewed_by
        timestamptz confirmed_at
    }
    alerts {
        uuid id PK
        uuid session_id FK
        text label
        enum severity
        enum status
        text source
    }
```

Full DDL: [`../supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql).
Vector embeddings are **not** stored here — they live in Pinecone.

---

## 9. Patient intake state machine

```mermaid
stateDiagram-v2
    [*] --> created : POST /sessions (consent required)
    created --> in_progress : first /history/message
    in_progress --> in_progress : more answers
    in_progress --> awaiting_documents : interview complete
    awaiting_documents --> summary_ready : /history/generate-summary
    summary_ready --> submitted : /sessions/{id}/submit
    submitted --> reviewed : doctor marks reviewed
    reviewed --> [*]

    in_progress --> in_progress : red flag → red_flag=true, priority↑
    created --> cancelled
    in_progress --> cancelled
```

---

## 10. Deployment

```mermaid
flowchart LR
    subgraph Client
        BR[Browser]
    end
    subgraph "docker compose"
        NG["frontend<br/>nginx : 80 → 5173<br/>serves dist/ + proxies /api"]
        UV["backend<br/>uvicorn : 8000<br/>app.main:app"]
        VOL[(maci_uploads volume)]
    end
    subgraph "Managed (SaaS)"
        SB[(Supabase / PostgreSQL)]
        PC[(Pinecone)]
        GQ[(Groq)]
        OC[(OCR.Space)]
    end

    BR -->|:5173| NG
    NG -->|/api → :8000| UV
    UV --- VOL
    UV --> SB
    UV --> PC
    UV --> GQ
    UV --> OC
```

`docker compose up --build` — frontend on `:5173`, backend on `:8000`. No local
database container by design (PostgreSQL is Supabase-hosted). The app still runs
with none of the managed services configured.
