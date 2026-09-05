import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, ArrowRight, CheckCircle2, RotateCcw } from "lucide-react";
import { Logo, LanguagePicker } from "../components/layout.jsx";
import {
  AyushForm,
  ChatPanel,
  DocumentCard,
  DocumentUploader,
  MicButton,
  ProgressSteps,
  RedFlagBanner,
  SummaryReview,
} from "../components/intake.jsx";
import {
  AiDraftNotice,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  Select,
  SectionTitle,
  Spinner,
  TextInput,
} from "../components/ui.jsx";
import { CLINICAL_MODES, GENDERS, STEPS } from "../lib/constants";
import { useI18n } from "../lib/i18n";
import { speak, cancelSpeech } from "../lib/useVoice";
import { api, ApiError } from "../lib/api";

const LS_KEY = "maci.intake.v1";

const emptyState = {
  step: 0,
  patientId: null,
  sessionId: null,
  mode: "text",
  clinicalMode: "general",
  chiefComplaint: "",
};

function loadPersisted() {
  try {
    return { ...emptyState, ...JSON.parse(localStorage.getItem(LS_KEY) || "{}") };
  } catch {
    return { ...emptyState };
  }
}

export default function PatientIntakePage() {
  const { lang, setLang, t } = useI18n();
  const [persist, setPersist] = useState(loadPersisted);
  const setP = useCallback((patch) => setPersist((s) => ({ ...s, ...patch })), []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(persist));
    } catch {
      /* ignore */
    }
  }, [persist]);

  const { step } = persist;
  const setStep = (n) => setP({ step: Math.max(0, Math.min(STEPS.length - 1, n)) });

  // --- step 0 form ---
  const [form, setForm] = useState({ full_name: "", age: "", gender: "undisclosed", phone: "" });
  const [consent, setConsent] = useState({ data: false, ai: false, share: false });
  const [busy, setBusy] = useState(false);

  // --- interview ---
  const [transcript, setTranscript] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [triage, setTriage] = useState(null);
  const [interviewComplete, setInterviewComplete] = useState(false);
  const [sending, setSending] = useState(false);
  const [speakAloud, setSpeakAloud] = useState(false);

  // --- documents ---
  const [documents, setDocuments] = useState([]);
  const [docBusy, setDocBusy] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  // --- review ---
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [ayush, setAyush] = useState({});
  const [ayushSaving, setAyushSaving] = useState(false);

  // --- submit ---
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || !persist.sessionId || !persist.patientId) return;
    restoredRef.current = true;
    (async () => {
      try {
        const [iv, docs] = await Promise.all([
          api.getInterview(persist.sessionId),
          api.listDocuments(persist.sessionId, persist.patientId),
        ]);
        setTranscript(iv.transcript || []);
        setInterviewComplete(Boolean(iv.is_complete));
        setDocuments(docs || []);
        if (persist.step >= 4) {
          try {
            setSummary(await api.getSessionSummary(persist.sessionId));
          } catch {
            /* not generated yet */
          }
        }
      } catch (e) {
        // stale ids — reset silently
        resetAll(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApiError = (e, fallback) => {
    const msg = e instanceof ApiError ? e.message : fallback;
    toast.error(msg || fallback);
  };

  function resetAll(confirmFirst = true) {
    if (confirmFirst && !window.confirm("Start a new intake and clear this one?")) return;
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* ignore */
    }
    setPersist({ ...emptyState });
    setForm({ full_name: "", age: "", gender: "undisclosed", phone: "" });
    setConsent({ data: false, ai: false, share: false });
    setTranscript([]);
    setSuggestions([]);
    setTriage(null);
    setInterviewComplete(false);
    setDocuments([]);
    setSummary(null);
    setAyush({});
    setDone(false);
    restoredRef.current = true;
  }

  /* ---------------- Step 0: details + consent ---------------- */
  const canSubmitDetails =
    form.full_name.trim().length > 1 && consent.data && consent.ai && consent.share;

  async function submitDetails() {
    if (!canSubmitDetails) return;
    setBusy(true);
    try {
      const patient = await api.createPatient({
        full_name: form.full_name,
        age: form.age ? Number(form.age) : null,
        gender: form.gender,
        preferred_language: lang,
        phone: form.phone || null,
      });
      await api.recordConsent(patient.id, {
        patient_id: patient.id,
        data_processing: consent.data,
        ai_assistance: consent.ai,
        share_with_clinician: consent.share,
      });
      setP({ patientId: patient.id, step: 1 });
      toast.success("Details saved");
    } catch (e) {
      handleApiError(e, "Could not save your details");
    } finally {
      setBusy(false);
    }
  }

  /* ---------------- Step 1: symptoms ---------------- */
  async function startInterview() {
    if (persist.chiefComplaint.trim().length < 3) {
      toast.error("Please describe your main problem");
      return;
    }
    setBusy(true);
    try {
      let sessionId = persist.sessionId;
      if (!sessionId) {
        const session = await api.createSession({
          patient_id: persist.patientId,
          language: lang,
          mode: persist.mode,
          clinical_mode: persist.clinicalMode,
          chief_complaint: persist.chiefComplaint,
        });
        sessionId = session.id;
      }
      const res = await api.sendMessage({
        session_id: sessionId,
        patient_id: persist.patientId,
        text: persist.chiefComplaint,
        language: lang,
      });
      applyInterviewResponse(res, persist.chiefComplaint);
      setP({ sessionId, step: 2 });
    } catch (e) {
      handleApiError(e, "Could not start the interview");
    } finally {
      setBusy(false);
    }
  }

  /* ---------------- Step 2: interview ---------------- */
  function applyInterviewResponse(res, patientText) {
    setTranscript((prev) => {
      const next = [...prev];
      if (patientText) next.push({ role: "patient", text: patientText });
      const assistantLine = [res.assistant_message, res.next_question].filter(Boolean).join("\n\n");
      if (assistantLine) next.push({ role: "assistant", text: assistantLine });
      return next;
    });
    setSuggestions(res.suggested_replies || []);
    setTriage(res.triage || null);
    setInterviewComplete(Boolean(res.is_complete));
    if (res.triage?.red_flag) {
      toast.error("Potential urgent symptom — please alert staff", { duration: 6000 });
    }
    if (speakAloud) {
      const toRead = res.next_question || res.assistant_message;
      if (toRead) speak(toRead, lang);
    }
  }

  async function sendMessage(text, requestComplete = false) {
    setSending(true);
    try {
      const res = await api.sendMessage({
        session_id: persist.sessionId,
        patient_id: persist.patientId,
        text,
        language: lang,
        request_complete: requestComplete,
      });
      applyInterviewResponse(res, text);
    } catch (e) {
      handleApiError(e, "Message could not be sent");
    } finally {
      setSending(false);
    }
  }

  /* ---------------- Step 3: documents ---------------- */
  async function pickDocument(file, documentType) {
    setDocBusy(true);
    try {
      const doc = await api.uploadDocument({
        sessionId: persist.sessionId,
        patientId: persist.patientId,
        documentType,
        file,
      });
      setDocuments((d) => [...d, doc]);
      toast.success("Uploaded — extracting…");
      await processDocument(doc.id);
    } catch (e) {
      handleApiError(e, "Upload failed");
    } finally {
      setDocBusy(false);
    }
  }

  async function processDocument(id) {
    setProcessingId(id);
    try {
      const res = await api.processDocument(id, persist.patientId);
      setDocuments((d) => d.map((x) => (x.id === id ? res.document : x)));
      if (res.document.status === "failed") toast.error(res.message || "Could not read the document");
      else toast.success("Details extracted");
    } catch (e) {
      handleApiError(e, "Extraction failed");
    } finally {
      setProcessingId(null);
    }
  }

  async function saveCorrection(id, patch) {
    try {
      const updated = await api.correctDocument(id, persist.patientId, patch);
      setDocuments((d) => d.map((x) => (x.id === id ? updated : x)));
      toast.success("Saved");
    } catch (e) {
      handleApiError(e, "Could not save your correction");
    }
  }

  /* ---------------- Step 4: review ---------------- */
  const generateSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const s = await api.generateSummary({
        session_id: persist.sessionId,
        patient_id: persist.patientId,
      });
      setSummary(s);
    } catch (e) {
      handleApiError(e, "Could not generate the summary");
    } finally {
      setSummaryLoading(false);
    }
  }, [persist.sessionId, persist.patientId]);

  useEffect(() => {
    if (step === 4 && persist.sessionId && !summary && !summaryLoading) {
      generateSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function saveAyush() {
    setAyushSaving(true);
    try {
      await api.saveAyush({
        session_id: persist.sessionId,
        patient_id: persist.patientId,
        assessment: ayush,
      });
      toast.success("AYUSH assessment saved");
      await generateSummary();
    } catch (e) {
      handleApiError(e, "Could not save the AYUSH assessment");
    } finally {
      setAyushSaving(false);
    }
  }

  /* ---------------- Step 5: submit ---------------- */
  async function submitToDoctor() {
    setSubmitting(true);
    try {
      await api.submitSession(persist.sessionId);
      setDone(true);
      cancelSpeech();
      toast.success("Sent to your doctor");
    } catch (e) {
      handleApiError(e, "Could not submit");
    } finally {
      setSubmitting(false);
    }
  }

  const headerRight = (
    <div className="flex items-center gap-2">
      <LanguagePicker value={lang} onChange={setLang} />
      <Button variant="ghost" onClick={() => resetAll(true)} className="px-2.5">
        <RotateCcw className="h-4 w-4" />
        <span className="hidden sm:inline">New</span>
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-clinical-bg">
      <header className="sticky top-0 z-30 border-b border-clinical-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Logo />
          {headerRight}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6 overflow-x-auto">
          <ProgressSteps current={step} />
        </div>

        {triage?.red_flag && step >= 2 && step <= 4 && (
          <div className="mb-4">
            <RedFlagBanner triage={triage} />
          </div>
        )}

        {done ? (
          <DoneScreen name={form.full_name} triage={triage} onNew={() => resetAll(false)} />
        ) : (
          <Card className="p-5 sm:p-6">
            {step === 0 && (
              <StepDetails
                t={t}
                lang={lang}
                setLang={setLang}
                form={form}
                setForm={setForm}
                consent={consent}
                setConsent={setConsent}
                clinicalMode={persist.clinicalMode}
                setClinicalMode={(v) => setP({ clinicalMode: v })}
                canSubmit={canSubmitDetails}
                busy={busy}
                onNext={submitDetails}
              />
            )}

            {step === 1 && (
              <StepSymptoms
                t={t}
                lang={lang}
                mode={persist.mode}
                setMode={(m) => setP({ mode: m })}
                value={persist.chiefComplaint}
                setValue={(v) => setP({ chiefComplaint: v })}
                busy={busy}
                onBack={() => setStep(0)}
                onNext={startInterview}
              />
            )}

            {step === 2 && (
              <div className="space-y-4">
                <SectionTitle hint="One question at a time. This records your history — it does not diagnose.">
                  {t("history.title")}
                </SectionTitle>
                <ChatPanel
                  transcript={transcript}
                  langCode={lang}
                  mode={persist.mode}
                  pending={sending}
                  speakAloud={speakAloud}
                  onToggleSpeak={() => setSpeakAloud((v) => !v)}
                  onSend={(text) => sendMessage(text)}
                  suggestions={suggestions}
                  isComplete={interviewComplete}
                  onFinish={() => setStep(3)}
                />
                <div className="flex items-center justify-between">
                  <Button variant="ghost" onClick={() => setStep(1)}>
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  {!interviewComplete && (
                    <Button
                      variant="outline"
                      onClick={() => sendMessage("I have answered enough for now.", true)}
                      loading={sending}
                    >
                      {t("history.finish")}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <SectionTitle hint={t("documents.hint")}>{t("documents.title")}</SectionTitle>
                <DocumentUploader onPick={pickDocument} busy={docBusy} />
                <div className="space-y-3">
                  {documents.length === 0 && (
                    <EmptyState
                      title="No documents yet"
                      subtitle="You can skip this step if you have nothing to upload."
                    />
                  )}
                  {documents.map((doc) => (
                    <DocumentCard
                      key={doc.id}
                      doc={doc}
                      processing={processingId === doc.id}
                      onProcess={processDocument}
                      onSaveCorrection={saveCorrection}
                    />
                  ))}
                </div>
                <StepNav onBack={() => setStep(2)} onNext={() => setStep(4)} nextLabel="Continue to review" />
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <SectionTitle hint={t("review.disclaimer")}>{t("review.title")}</SectionTitle>
                {summaryLoading && !summary ? (
                  <div className="py-10 text-center">
                    <Spinner label="Building your clinical summary…" className="justify-center" />
                  </div>
                ) : (
                  <>
                    {persist.clinicalMode === "ayush" && (
                      <AyushForm
                        value={ayush}
                        onChange={setAyush}
                        onSave={saveAyush}
                        saving={ayushSaving}
                      />
                    )}
                    <SummaryReview summary={summary} />
                    <div className="flex justify-end">
                      <Button variant="outline" onClick={generateSummary} loading={summaryLoading}>
                        Regenerate
                      </Button>
                    </div>
                  </>
                )}
                <StepNav
                  onBack={() => setStep(3)}
                  onNext={() => setStep(5)}
                  nextLabel="Continue to submit"
                  nextDisabled={!summary}
                />
              </div>
            )}

            {step === 5 && (
              <div className="space-y-5 text-center">
                <SectionTitle>{t("submit.title")}</SectionTitle>
                <AiDraftNotice className="justify-center" />
                <p className="mx-auto max-w-md text-sm text-clinical-muted">
                  Your structured history and any uploaded documents will be made available on your doctor’s
                  dashboard before your consultation.
                </p>
                <Button className="mx-auto px-6 py-3 text-base" loading={submitting} onClick={submitToDoctor}>
                  {t("common.submit")}
                </Button>
                <div>
                  <Button variant="ghost" onClick={() => setStep(4)}>
                    <ArrowLeft className="h-4 w-4" /> Back to review
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}

/* ===================================================================== */
function StepNav({ onBack, onNext, nextLabel = "Next", nextDisabled }) {
  return (
    <div className="flex items-center justify-between pt-1">
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <Button onClick={onNext} disabled={nextDisabled}>
        {nextLabel} <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function StepDetails({
  t,
  form,
  setForm,
  consent,
  setConsent,
  clinicalMode,
  setClinicalMode,
  canSubmit,
  busy,
  onNext,
}) {
  return (
    <div className="space-y-5">
      <SectionTitle hint="Large text and simple controls — for every patient.">{t("details.title")}</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("details.name")} required>
          <TextInput
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            placeholder="e.g. Asha Rao"
            autoFocus
          />
        </Field>
        <Field label={t("details.age")} hint={t("common.optional")}>
          <TextInput
            type="number"
            min="0"
            max="130"
            value={form.age}
            onChange={(e) => setForm({ ...form, age: e.target.value })}
            placeholder="Years"
          />
        </Field>
        <Field label={t("details.gender")}>
          <Select
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}
            options={GENDERS}
          />
        </Field>
        <Field label={t("details.phone")} hint={t("common.optional")}>
          <TextInput
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="For appointment updates"
          />
        </Field>
        <Field label="Intake mode">
          <Select
            value={clinicalMode}
            onChange={(e) => setClinicalMode(e.target.value)}
            options={CLINICAL_MODES}
          />
        </Field>
      </div>

      <div>
        <p className="label">{t("details.consentTitle")} <span className="text-rose-500">*</span></p>
        <div className="space-y-2">
          <Checkbox
            id="c1"
            checked={consent.data}
            onChange={(v) => setConsent({ ...consent, data: v })}
            label={t("details.consent.data")}
          />
          <Checkbox
            id="c2"
            checked={consent.ai}
            onChange={(v) => setConsent({ ...consent, ai: v })}
            label={t("details.consent.ai")}
          />
          <Checkbox
            id="c3"
            checked={consent.share}
            onChange={(v) => setConsent({ ...consent, share: v })}
            label={t("details.consent.share")}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button className="px-6 py-3 text-base" disabled={!canSubmit} loading={busy} onClick={onNext}>
          {t("common.continue")} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StepSymptoms({ t, lang, mode, setMode, value, setValue, busy, onBack, onNext }) {
  return (
    <div className="space-y-5">
      <SectionTitle>{t("symptoms.title")}</SectionTitle>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          onClick={() => setMode("voice")}
          className={`kiosk-btn ${mode === "voice" ? "btn-primary" : "btn-outline"}`}
        >
          🎙️ {t("symptoms.modeVoice")}
        </button>
        <button
          onClick={() => setMode("text")}
          className={`kiosk-btn ${mode === "text" ? "btn-primary" : "btn-outline"}`}
        >
          ⌨️ {t("symptoms.modeText")}
        </button>
      </div>

      <Field label="Your main problem" required>
        <textarea
          className="input min-h-[130px] text-base"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("symptoms.placeholder")}
        />
      </Field>

      {mode === "voice" && (
        <div className="rounded-xl border border-clinical-line bg-clinical-bg/60 p-3">
          <MicButton
            langCode={lang}
            onTranscript={(txt) => setValue(value ? `${value} ${txt}` : txt)}
            large
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button className="px-6 py-3 text-base" loading={busy} onClick={onNext}>
          Start questions <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function DoneScreen({ name, triage, onNew }) {
  return (
    <Card className="p-8 text-center">
      <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
      <h2 className="mt-4 text-2xl font-extrabold text-clinical-ink">All done{name ? `, ${name.split(" ")[0]}` : ""}!</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-clinical-muted">
        Your clinical history has been sent to your doctor and will be ready before your consultation.
      </p>
      {triage?.red_flag && (
        <div className="mx-auto mt-4 max-w-md rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          A possible urgent symptom was noted and marked high priority for the care team. If you feel worse,
          tell the staff at the desk now.
        </div>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={onNew}>
          <RotateCcw className="h-4 w-4" /> Start another intake
        </Button>
        <Link to="/" className="btn-outline px-4 py-2.5">
          Home
        </Link>
      </div>
    </Card>
  );
}
