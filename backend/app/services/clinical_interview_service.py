"""Adaptive clinical-history interview orchestration.

One public coroutine, :func:`process_turn`, does everything for a patient
message: deterministic red-flag screen -> LLM (or scripted fallback) next
question -> persist transcript / triage / alerts -> typed response.
"""
from __future__ import annotations

from uuid import UUID

from app.core.config import settings
from app.core.logging import get_logger
from app.models.entities import AlertEntity, InterviewMessageEntity
from app.repositories.base import BaseRepository
from app.schemas.clinical_history import StructuredClinicalHistory, coerce_structured_history
from app.schemas.common import MessageRole, SessionStatus, TriagePriority
from app.schemas.interview import ChatTurn, InterviewMessageIn, InterviewMessageOut
from app.schemas.triage import TriageResult
from app.services.groq_service import GroqBadJSON, GroqUnavailable, get_groq
from app.services.prompts import INTERVIEW_SYSTEM, interview_user_prompt
from app.services.red_flag_service import find_red_flags, merge_triage

log = get_logger("services.interview")

# Scripted fallback flow - used when Groq is unavailable. Ordered by clinical
# priority; each item covers a history section from the spec.
_SCRIPT: list[dict] = [
    {"q": "When did this problem start, and did it come on suddenly or gradually?",
     "chips": ["Today", "A few days ago", "Weeks ago", "Months ago"], "area": "onset"},
    {"q": "Where exactly do you feel it, and does it spread anywhere?",
     "chips": ["Stays in one place", "Spreads to arm", "Spreads to back", "All over"], "area": "location"},
    {"q": "How would you describe it - sharp, dull, burning, cramping, or something else?",
     "chips": ["Sharp", "Dull ache", "Burning", "Cramping"], "area": "character"},
    {"q": "On a scale of 1 to 10, how severe is it right now?",
     "chips": ["2-3 (mild)", "4-6 (moderate)", "7-8 (severe)", "9-10 (worst)"], "area": "severity"},
    {"q": "Is there anything that makes it better or worse?",
     "chips": ["Rest helps", "Movement worsens", "Food changes it", "Nothing changes it"], "area": "modifiers"},
    {"q": "Are there any other symptoms along with it - for example fever, nausea, breathlessness, sweating or dizziness?",
     "chips": ["Fever", "Nausea", "Breathlessness", "None"], "area": "associated_symptoms"},
    {"q": "Do you have any ongoing medical conditions, such as diabetes, high blood pressure, asthma or heart disease?",
     "chips": ["Diabetes", "High blood pressure", "Asthma", "None"], "area": "past_medical_history"},
    {"q": "Have you had any surgeries or hospital admissions in the past?",
     "chips": ["Yes", "No"], "area": "past_surgical_history"},
    {"q": "Which medicines do you take regularly, including doses if you know them?",
     "chips": ["None", "I have a list", "Blood pressure meds", "Diabetes meds"], "area": "medications"},
    {"q": "Are you allergic to any medicines or foods? If yes, what happens?",
     "chips": ["No known allergies", "Penicillin", "Sulfa", "Other"], "area": "allergies"},
    {"q": "Do any serious illnesses run in your close family (heart disease, stroke, cancer, diabetes)?",
     "chips": ["Heart disease", "Diabetes", "Cancer", "None"], "area": "family_history"},
    {"q": "A few lifestyle questions: do you smoke or use tobacco, and do you drink alcohol?",
     "chips": ["Neither", "Smoke only", "Alcohol only", "Both"], "area": "personal_history"},
    {"q": "How are your sleep and appetite recently, and has your weight changed?",
     "chips": ["All normal", "Poor sleep", "Poor appetite", "Weight loss"], "area": "review_of_systems"},
    {"q": "Have you had any recent tests, scans or blood work for this problem?",
     "chips": ["No", "Blood tests", "X-ray / scan", "ECG"], "area": "previous_investigations"},
]

_INTRO = {
    "en": "Thank you. I'll ask a few short questions so the doctor has your full history before you meet. "
          "This is only to record your history - I won't give a diagnosis.",
    "hi": "धन्यवाद। मैं कुछ छोटे सवाल पूछूँगा ताकि डॉक्टर को मिलने से पहले आपकी पूरी जानकारी हो। "
          "यह केवल आपकी जानकारी दर्ज करने के लिए है - मैं कोई निदान नहीं दूँगा।",
}


def _patient_text(transcript: list[dict]) -> str:
    return "\n".join(t.get("text", "") for t in transcript if t.get("role") == MessageRole.PATIENT.value)


def _completion_pct(question_count: int, is_complete: bool) -> int:
    if is_complete:
        return 100
    return max(5, min(95, round(question_count / max(1, settings.max_interview_questions) * 100)))


def _persist_message(repo: BaseRepository, session_id: UUID, patient_id: UUID, role: str, text: str, idx: int | None):
    repo.create(
        "clinical_answers",
        InterviewMessageEntity(
            session_id=session_id, patient_id=patient_id, role=role, text=text, question_index=idx
        ),
    )


def _raise_alerts(repo: BaseRepository, session_id: UUID, patient_id: UUID, triage: TriageResult) -> None:
    existing = {a.get("label") for a in repo.alerts_for_session(session_id)}
    for hit in triage.hits:
        if hit.label in existing:
            continue
        repo.create(
            "alerts",
            AlertEntity(
                session_id=session_id,
                patient_id=patient_id,
                kind="red_flag",
                label=hit.label,
                detail=", ".join(hit.matched_terms) or hit.category,
                severity=hit.severity if isinstance(hit.severity, str) else hit.severity.value,
                source=hit.source,
            ),
        )


def _scripted_turn(transcript: list[dict], question_count: int, request_complete: bool, language: str):
    """Deterministic next question when the LLM is unavailable."""
    max_q = settings.max_interview_questions
    if request_complete or question_count >= min(max_q, len(_SCRIPT) + 1):
        msg = {
            "en": "Thank you - that's everything I need. Your history is ready for the doctor.",
            "hi": "धन्यवाद - मुझे बस इतनी ही जानकारी चाहिए थी। आपकी जानकारी डॉक्टर के लिए तैयार है।",
        }.get(language, "Thank you - that's everything I need for now.")
        return msg, None, True, [], "complete"

    step = _SCRIPT[min(question_count, len(_SCRIPT) - 1)]
    ack = {
        "en": "Thank you.",
        "hi": "धन्यवाद।",
    }.get(language, "Thank you.")
    return ack, step["q"], False, step["chips"], step["area"]


async def process_turn(
    repo: BaseRepository, payload: InterviewMessageIn
) -> InterviewMessageOut:
    session, patient = repo.session_with_patient(payload.session_id)
    repo.ensure_owned(session, payload.patient_id, table="clinical_sessions")

    language = (payload.language.value if payload.language else None) or session.get("language") or "en"
    transcript: list[dict] = list(session.get("transcript") or [])

    # 1) record the patient's message
    patient_turn = {"role": MessageRole.PATIENT.value, "text": payload.text.strip(),
                    "created_at": ChatTurn(role=MessageRole.PATIENT, text=payload.text).created_at.isoformat()}
    transcript.append(patient_turn)
    _persist_message(repo, payload.session_id, payload.patient_id, MessageRole.PATIENT.value, payload.text, None)

    if not session.get("chief_complaint"):
        session["chief_complaint"] = payload.text.strip()[:2000]

    question_count = int(session.get("question_count") or 0)

    # 2) DETERMINISTIC red-flag screen (always runs, never skipped)
    rule_triage = find_red_flags(_patient_text(transcript) + "\n" + payload.text, age=patient.get("age"))

    # 3) next question - LLM first, scripted fallback on any failure
    groq = get_groq()
    used_llm = False
    partial_history: StructuredClinicalHistory | None = None
    if groq.available:
        try:
            data = await groq.chat_json(
                INTERVIEW_SYSTEM,
                interview_user_prompt(
                    language=language,
                    clinical_mode=session.get("clinical_mode") or "general",
                    chief_complaint=session.get("chief_complaint") or "",
                    transcript=transcript,
                    question_count=question_count,
                    max_questions=settings.max_interview_questions,
                    rule_red_flags=[h.label for h in rule_triage.hits],
                ),
                temperature=0.35,
                max_tokens=1200,
            )
            assistant_message = str(data.get("assistant_message") or "").strip() or "Thank you."
            next_question = data.get("next_question")
            next_question = str(next_question).strip() if next_question else None
            is_complete = bool(data.get("is_complete"))
            chips = [str(c) for c in (data.get("suggested_replies") or [])][:4]
            focus = str(data.get("focus_area") or "")
            if isinstance(data.get("partial_history"), dict):
                partial_history = coerce_structured_history(data["partial_history"])
            used_llm = True
        except (GroqUnavailable, GroqBadJSON) as exc:
            log.info("Interview LLM fallback (%s)", type(exc).__name__)
            assistant_message, next_question, is_complete, chips, focus = _scripted_turn(
                transcript, question_count, payload.request_complete, language
            )
    else:
        assistant_message, next_question, is_complete, chips, focus = _scripted_turn(
            transcript, question_count, payload.request_complete, language
        )

    # Hard stop at the safety limit
    if question_count + 1 >= settings.max_interview_questions and not is_complete:
        is_complete = True
        next_question = None

    # 4) assemble assistant reply + persist
    full_assistant = assistant_message
    if rule_triage.red_flag:
        full_assistant = f"{rule_triage.patient_message}\n\n{assistant_message}"
    if next_question:
        full_assistant = f"{full_assistant}\n\n{next_question}".strip()

    assistant_turn = {"role": MessageRole.ASSISTANT.value, "text": full_assistant,
                      "created_at": ChatTurn(role=MessageRole.ASSISTANT, text=full_assistant).created_at.isoformat()}
    transcript.append(assistant_turn)
    _persist_message(
        repo, payload.session_id, payload.patient_id, MessageRole.ASSISTANT.value,
        full_assistant, question_count if next_question else None,
    )

    new_qcount = question_count + (1 if next_question else 0)
    completion = _completion_pct(new_qcount, is_complete)

    # 5) triage + alerts + session update
    prev_priority = session.get("triage_priority") or TriagePriority.STANDARD.value
    triage = merge_triage(rule_triage, TriageResult(priority=prev_priority, red_flag=session.get("red_flag", False)))
    if triage.hits:
        _raise_alerts(repo, payload.session_id, payload.patient_id, triage)

    status = session.get("status") or SessionStatus.CREATED.value
    if status in (SessionStatus.CREATED.value,):
        status = SessionStatus.IN_PROGRESS.value
    if is_complete:
        status = SessionStatus.AWAITING_DOCUMENTS.value

    repo.update(
        "clinical_sessions",
        payload.session_id,
        {
            "transcript": transcript,
            "question_count": new_qcount,
            "completion_pct": completion,
            "triage_priority": triage.priority if isinstance(triage.priority, str) else triage.priority.value,
            "red_flag": bool(triage.red_flag),
            "status": status,
            "chief_complaint": session.get("chief_complaint"),
        },
    )

    return InterviewMessageOut(
        session_id=payload.session_id,
        assistant_message=assistant_message if not rule_triage.red_flag else full_assistant.split("\n\n")[0],
        next_question=next_question,
        is_complete=is_complete,
        question_count=new_qcount,
        completion_pct=completion,
        suggested_replies=chips,
        triage=triage,
        partial_history=partial_history,
    )


def intro_message(language: str, chief_complaint: str = "") -> str:
    base = _INTRO.get(language, _INTRO["en"])
    if chief_complaint:
        return base
    return base
