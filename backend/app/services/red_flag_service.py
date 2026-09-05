"""Deterministic, rule-based red-flag / triage safety layer.

This module is intentionally **not** AI-powered. It runs on every interview
turn and on the final summary text so that an emergency phrase is caught even
when the LLM is unavailable or wrong. An optional LLM pass
(:func:`llm_safety_review`) can *add* concerns but can never *remove* a
rule-based hit.

The patient-facing message never asserts a diagnosis - only that staff should
be contacted.
"""
from __future__ import annotations

import re

from app.schemas.common import TriagePriority
from app.schemas.triage import RedFlagHit, TriageResult

PATIENT_ALERT_TEXT = (
    "Potential urgent symptom detected. Please contact medical staff immediately."
)

_NEGATIONS = (
    "no", "not", "without", "denies", "denied", "deny", "negative for",
    "ruled out", "n/o", "never had", "free of",
)

# Each rule: any of `terms` (regexes) OR every group in `all_groups` matched.
_RULES: list[dict] = [
    {
        "id": "cardiac_acs",
        "label": "Possible acute cardiac event",
        "category": "cardiac",
        "severity": TriagePriority.EMERGENCY,
        "terms": [
            r"crushing chest pain", r"chest pain radiat\w*", r"chest pain.*(left arm|jaw)",
            r"(left arm|jaw).*chest pain", r"heart attack", r"angina at rest",
            r"chest (pain|tightness|pressure).*(sweat|clammy|short(ness)? of breath|breathless|nausea)",
            r"(sweat|clammy|short(ness)? of breath|breathless|nausea).*chest (pain|tightness|pressure)",
        ],
    },
    {
        "id": "resp_distress",
        "label": "Severe breathing difficulty",
        "category": "respiratory",
        "severity": TriagePriority.EMERGENCY,
        "terms": [
            r"can'?t breathe", r"cannot breathe", r"can not breathe",
            r"struggling to breathe", r"gasping for (air|breath)", r"choking",
            r"blue lips", r"lips (turned |are )?blue", r"severe(ly)? breathless",
            r"suffocat\w+",
        ],
    },
    {
        "id": "stroke",
        "label": "Stroke-like neurological symptoms",
        "category": "neurological",
        "severity": TriagePriority.EMERGENCY,
        "terms": [
            r"droop\w*", r"facial droop", r"face.{0,15}droop", r"slurr\w+",
            r"speech.{0,12}slurr\w+", r"can'?t speak", r"having a stroke",
            r"(is|had|is having) (a )?stroke", r"mini[- ]stroke", r"\btia\b",
            r"weakness (on |in )?(one side|left side|right side)", r"one side.{0,10}(weak|numb)",
            r"sudden numbness", r"arm drift", r"can'?t (lift|move|feel) (my )?(arm|leg|face)",
            r"thunderclap headache", r"worst headache of (my|his|her) life",
        ],
    },
    {
        "id": "loc",
        "label": "Loss of consciousness / unresponsive",
        "category": "neurological",
        "severity": TriagePriority.EMERGENCY,
        "terms": [
            r"lost consciousness", r"loss of consciousness", r"passed out", r"fainted",
            r"blacked out", r"unrespons\w+", r"won'?t wake up", r"unconscious",
            r"seizure", r"convuls\w+", r"fit\b.*(whole body|shaking)",
        ],
    },
    {
        "id": "hemorrhage",
        "label": "Severe bleeding",
        "category": "bleeding",
        "severity": TriagePriority.EMERGENCY,
        "terms": [
            r"heavy bleeding", r"bleeding (won'?t|will not|does not) stop",
            r"bleeding a lot", r"vomiting blood", r"throwing up blood", r"coughing up blood",
            r"blood in (stool|urine)", r"black tarry stool", r"melena",
            r"soaking through (pads|bandage)", r"spurting blood",
        ],
    },
    {
        "id": "anaphylaxis",
        "label": "Possible anaphylaxis",
        "category": "allergy",
        "severity": TriagePriority.EMERGENCY,
        "terms": [
            r"throat (is )?(swelling|closing|tight)", r"tongue swelling", r"anaphyla\w+",
            r"hives.*(breathe|throat|swelling)", r"can'?t swallow.*(swelling|rash)",
        ],
    },
    {
        "id": "sepsis_meningitis",
        "label": "Possible severe infection / meningitis",
        "category": "infection",
        "severity": TriagePriority.EMERGENCY,
        "terms": [
            r"stiff neck.*(fever|rash)", r"fever.*stiff neck",
            r"non[- ]blanching rash", r"rash.*(doesn'?t|does not) fade",
            r"(very )?high fever.*(confus|drowsy|shiver)",
        ],
    },
    {
        "id": "obstetric",
        "label": "Obstetric emergency concern",
        "category": "obstetric",
        "severity": TriagePriority.EMERGENCY,
        "terms": [
            r"pregnan\w+.*(heavy bleeding|severe (abdominal|belly) pain|no fetal movement|reduced fetal movement)",
            r"(heavy bleeding|severe (abdominal|belly) pain).*pregnan\w+",
            r"water broke.*(bleeding|pain)",
        ],
    },
    {
        "id": "self_harm",
        "label": "Self-harm / suicidal ideation",
        "category": "mental_health",
        "severity": TriagePriority.EMERGENCY,
        "terms": [
            r"want to (die|end my life|kill myself)", r"suicid\w+",
            r"harm myself", r"self[- ]harm", r"no reason to live",
        ],
    },
    {
        "id": "acute_abdomen",
        "label": "Possible acute abdomen",
        "category": "gastrointestinal",
        "severity": TriagePriority.URGENT,
        "terms": [
            r"rigid abdomen", r"board[- ]like abdomen",
            r"severe (abdominal|belly|stomach) pain.*(vomiting|can'?t move|fever)",
            r"(vomiting|fever).*severe (abdominal|belly|stomach) pain",
        ],
    },
    {
        "id": "severe_pain_scale",
        "label": "Very severe pain reported (>=9/10)",
        "category": "pain",
        "severity": TriagePriority.URGENT,
        "terms": [
            r"\b(9|10)\s*(/|out of)\s*10\b", r"pain (is )?(a )?(9|10)\b",
            r"worst pain (of |in )?(my life|ever)",
        ],
    },
    {
        "id": "neuro_deficit",
        "label": "Acute vision / speech / severe headache",
        "category": "neurological",
        "severity": TriagePriority.URGENT,
        "terms": [
            r"sudden (loss of )?vision loss", r"lost vision in one eye",
            r"double vision.*sudden", r"sudden severe headache",
        ],
    },
    {
        "id": "diabetic_emergency",
        "label": "Possible diabetic emergency",
        "category": "endocrine",
        "severity": TriagePriority.URGENT,
        "terms": [
            r"blood sugar (over|above|>) ?[34]\d\d", r"sugar \d{3}.*(drowsy|vomiting|breath)",
            r"fruity breath.*(drowsy|vomiting)", r"ketoacidosis",
        ],
    },
]

_COMPILED = [
    {**r, "patterns": [re.compile(p, re.IGNORECASE) for p in r["terms"]]} for r in _RULES
]

_PRIORITY_ORDER = {
    TriagePriority.ROUTINE.value: 0,
    TriagePriority.STANDARD.value: 1,
    TriagePriority.URGENT.value: 2,
    TriagePriority.EMERGENCY.value: 3,
}


def _is_negated(text: str, match_start: int) -> bool:
    """True if a negation word appears shortly before the match."""
    window = text[max(0, match_start - 40) : match_start].lower()
    words = re.findall(r"[a-z'/]+", window)
    tail = " ".join(words[-5:])
    return any(neg in tail for neg in _NEGATIONS)


def find_red_flags(text: str, *, age: int | None = None) -> TriageResult:
    """Deterministic screen. Returns a :class:`TriageResult`."""
    text = text or ""
    hits: list[RedFlagHit] = []
    seen_rules: set[str] = set()

    for rule in _COMPILED:
        matched_terms: list[str] = []
        for pat in rule["patterns"]:
            for m in pat.finditer(text):
                if _is_negated(text, m.start()):
                    continue
                matched_terms.append(m.group(0).strip())
        if matched_terms and rule["id"] not in seen_rules:
            seen_rules.add(rule["id"])
            sev = rule["severity"]
            hits.append(
                RedFlagHit(
                    rule_id=rule["id"],
                    label=rule["label"],
                    category=rule["category"],
                    matched_terms=sorted(set(matched_terms))[:6],
                    severity=sev,
                    advice=PATIENT_ALERT_TEXT,
                    source="rule",
                )
            )

    if not hits:
        return TriageResult(red_flag=False, priority=TriagePriority.STANDARD, hits=[])

    top = max(hits, key=lambda h: _PRIORITY_ORDER.get(_sev_value(h.severity), 1))
    priority = _sev_value(top.severity)
    return TriageResult(
        red_flag=True,
        priority=priority,
        hits=hits,
        patient_message=PATIENT_ALERT_TEXT,
    )


def _sev_value(sev) -> str:
    return sev.value if hasattr(sev, "value") else str(sev)


def merge_triage(*results: TriageResult) -> TriageResult:
    """Combine multiple screens - highest priority and union of hits win."""
    all_hits: list[RedFlagHit] = []
    seen: set[str] = set()
    priority = TriagePriority.STANDARD.value
    red = False
    for r in results:
        if not r:
            continue
        red = red or r.red_flag
        if _PRIORITY_ORDER.get(_sev_value(r.priority), 1) > _PRIORITY_ORDER.get(priority, 1):
            priority = _sev_value(r.priority)
        for h in r.hits:
            key = f"{h.source}:{h.rule_id}:{h.label}"
            if key not in seen:
                seen.add(key)
                all_hits.append(h)
    return TriageResult(
        red_flag=red or bool(all_hits),
        priority=priority,
        hits=all_hits,
        patient_message=PATIENT_ALERT_TEXT if (red or all_hits) else None,
    )


async def llm_safety_review(text: str) -> TriageResult:
    """Optional additive LLM screen. Failures degrade to an empty result."""
    from app.services.groq_service import GroqUnavailable, get_groq

    groq = get_groq()
    if not groq.available:
        return TriageResult(red_flag=False, priority=TriagePriority.STANDARD, hits=[])
    system = (
        "You are a triage safety net. Given a patient's words, list any potential "
        "emergency ('red flag') concerns a nurse should know about. Do NOT diagnose. "
        'Return ONLY JSON: {"concerns":[{"label":"","category":"","severity":"urgent|emergency"}]}'
    )
    try:
        data = await groq.chat_json(system, text[:4000], temperature=0.0, max_tokens=500)
    except (GroqUnavailable, Exception):  # noqa: BLE001 - safety net must never raise
        return TriageResult(red_flag=False, priority=TriagePriority.STANDARD, hits=[])

    concerns = data.get("concerns") or []
    hits: list[RedFlagHit] = []
    for c in concerns if isinstance(concerns, list) else []:
        if not isinstance(c, dict):
            continue
        sev = str(c.get("severity", "urgent")).lower()
        sev = "emergency" if sev == "emergency" else "urgent"
        hits.append(
            RedFlagHit(
                rule_id="llm_" + re.sub(r"\W+", "_", str(c.get("label", "concern")).lower())[:40],
                label=str(c.get("label", "Potential concern"))[:120],
                category=str(c.get("category", "general"))[:40],
                matched_terms=[],
                severity=TriagePriority(sev),
                advice=PATIENT_ALERT_TEXT,
                source="llm",
            )
        )
    if not hits:
        return TriageResult(red_flag=False, priority=TriagePriority.STANDARD, hits=[])
    priority = "emergency" if any(_sev_value(h.severity) == "emergency" for h in hits) else "urgent"
    return TriageResult(red_flag=True, priority=priority, hits=hits, patient_message=PATIENT_ALERT_TEXT)
