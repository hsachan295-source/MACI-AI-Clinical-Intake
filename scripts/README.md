# MACI scripts

Run these from the **repo root** with the backend virtualenv's Python so the
`app` package and the repo-root `.env` are picked up:

```bash
# Windows
backend\.venv\Scripts\python.exe scripts\<script>.py ...
# macOS / Linux
backend/.venv/bin/python   scripts/<script>.py ...
```

| Script | Purpose |
|--------|---------|
| `seed_demo_data.py` | Ingest + index the tiny demo dataset in `data/demo/`. Use `--no-index` / `--list`. |
| `import_dataset.py` | Import YOUR dataset (CSV/JSON/JSONL). `--path`, `--format`, `--dry-run`, `--limit`, `--no-index`. |
| `index_pinecone.py` | (Re)build the vector index. `--all`, `--patient <id>`, `--from-file <path>`, `--create-index`. |
| `check_groq.py` | List the Groq models your key can use and test a JSON completion. |
| `_maci_ingest.py` | Shared library used by the scripts above (not run directly). |

All scripts write to whatever backend is configured:
Supabase + Pinecone when their keys are present, otherwise an in-memory store
that lives only for the length of the process. `GET /api/health` shows which.

See [`../data/README_DATA.md`](../data/README_DATA.md) for the dataset record
format.
