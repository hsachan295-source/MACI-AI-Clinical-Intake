import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Keyboard,
  Mic,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Logo, LanguagePicker } from "../components/layout.jsx";
import {
  AyushForm,
  ChatPanel,
  ClinicalIntelligencePanel,
  DocumentCard,
  DocumentDropzone,
  ProgressStepper,
  RedFlagBanner,
  SummaryReview,
  VoiceOrb,
} from "../components/intake.jsx";
import {
  AiDraftNotice,
  AIStatus,
  Alert,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  RadioCards,
  SectionTitle,
  Select,
  TextInput,
} from "../components/ui.jsx";
import { ThemeSelector } from "../lib/theme.jsx";
import { CLINICAL_MODES, GENDERS, STEPS } from "../lib/constants";
import { useI18n } from "../lib/i18n";
import { speak, cancelSpeech } from "../lib/useVoice";
import { api, ApiError } from "../lib/api";

const LS_KEY = "maci.intake.v2";
const LAST = STEPS.length - 1; // 6

const emptyState = {
  step: 0,
  patientId: null,
  sessionId: null,
  mode: "text",
  clinicalMode: "general",
  chiefComplaint: "",
};

function prefIntakeMode() {
  try {
    const m = JSON.parse(localStorage.getItem("maci-prefs") || "{}")?.intakeMode;
    return m === "voice" || m === "text" ? m : "text";
  } catch {
    return "text";
  }
}

function loadPersisted() {
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (!stored) return { ...emptyState, mode: prefIntakeMode() }; // fresh intake honours the doctor's default
    return { ...emptyState, ...JSON.parse(stored) };
  } catch {
    return { ...emptyState, mode: prefIntakeMode() };
  }
}

const stepMotion = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, x: -24, transition: { duration: 0.2 } },
};

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
  const setStep = (n) => setP({ step: Math.max(0, Math.min(LAST, n)) });

  const [form, setForm] = useState({ full_name: "", age: "", gender: "undisclosed", phone: "" });
  const [consent, setConsent] = useState({ data: false, ai: false, share: false });
  const [busy, setBusy] = useState(false);

  const [transcript, setTranscript] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [triage, setTriage] = useState(null);
  const [partialHistory, setPartialHistory] = useState(null);
  const [completionPct, setCompletionPct] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const [interviewComplete, setInterviewComplete] = useState(false);
  const [sending, setSending] = useState(false);
  const [speakAloud, setSpeakAloud] = useState(false);

  const [documents, setDocuments] = useState([]);
  const [docBusy, setDocBusy] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [ayush, setAyush] = useState({});
  const [ayushSaving, setAyushSaving] = useState(false);

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
        setCompletionPct(iv.completion_pct || 0);
        setQuestionCount(iv.question_count || 0);
        setPartialHistory(iv.partial_history || null);
        setDocuments(docs || []);
        if (persist.step >= 5) {
          try {
            setSummary(await api.getSessionSummary(persist.sessionId));
          } catch {
            /* not generated yet */
          }
        }
      } catch {
        resetAll(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApiError = (e, fallback) => {
    toast.error(e instanceof ApiError ? e.message : fallback || "Something went wrong");
  };

  function resetAll(confirmFirst = true) {
    if (confirmFirst && !window.confirm("Start a new intake and clear this one?")) return;
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* ignore */
    }
    setPersist({ ...emptyState, mode: prefIntakeMode() });
    setForm({ full_name: "", age: "", gender: "undisclosed", phone: "" });
    setConsent({ data: false, ai: false, share: false });
    setTranscript([]);
    setSuggestions([]);
    setTriage(null);
    setPartialHistory(null);
    setCompletionPct(0);
    setQuestionCount(0);
    setInterviewComplete(false);
    setDocuments([]);
    setSummary(null);
    setAyush({});
    setDone(false);
    restoredRef.current = true;
  }

  /* -------- step 0: details -------- */
  const canContinueDetails = form.full_name.trim().length > 1;

  /* -------- step 1: consent -> create patient + record consent -------- */
  const canConsent = consent.data && consent.ai && consent.share;
  async function agreeAndContinue() {
    if (!canConsent) return;
    setBusy(true);
    try {
      let patientId = persist.patientId;
      if (!patientId) {
        const patient = await api.createPatient({
          full_name: form.full_name,
          age: form.age ? Number(form.age) : null,
          gender: form.gender,
          preferred_language: lang,
          phone: form.phone || null,
        });
        patientId = patient.id;
      }
      await api.recordConsent(patientId, {
        patient_id: patientId,
        data_processing: consent.data,
        ai_assistance: consent.ai,
        share_with_clinician: consent.share,
      });
      setP({ patientId, step: 2 });
      toast.success("Consent recorded");
    } catch (e) {
      handleApiError(e, "Could not record consent");
    } finally {
      setBusy(false);
    }
  }

  /* -------- step 2: symptoms -> create session + first message -------- */
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
      setP({ sessionId, step: 3 });
    } catch (e) {
      handleApiError(e, "Could not start the interview");
    } finally {
      setBusy(false);
    }
  }

  /* -------- step 3: interview -------- */
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
    if (res.partial_history) setPartialHistory(res.partial_history);
    if (typeof res.completion_pct === "number") setCompletionPct(res.completion_pct);
    if (typeof res.question_count === "number") setQuestionCount(res.question_count);
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

  /* -------- step 4: documents -------- */
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

  /* -------- step 5: review -------- */
  const generateSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const s = await api.generateSummary({ session_id: persist.sessionId, patient_id: persist.patientId });
      setSummary(s);
    } catch (e) {
      handleApiError(e, "Could not generate the summary");
    } finally {
      setSummaryLoading(false);
    }
  }, [persist.sessionId, persist.patientId]);

  useEffect(() => {
    if (step === 5 && persist.sessionId && !summary && !summaryLoading) generateSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function saveAyush() {
    setAyushSaving(true);
    try {
      await api.saveAyush({ session_id: persist.sessionId, patient_id: persist.patientId, assessment: ayush });
      toast.success("AYUSH assessment saved");
      await generateSummary();
    } catch (e) {
      handleApiError(e, "Could not save the AYUSH assessment");
    } finally {
      setAyushSaving(false);
    }
  }

  /* -------- step 6: submit -------- */
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

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border bg-card/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <div className="flex items-center gap-2">
            <LanguagePicker value={lang} onChange={setLang} className="hidden sm:inline-flex" />
            <ThemeSelector className="hidden sm:inline-flex" />
            <ThemeSelector variant="compact" className="sm:hidden" />
            <Button variant="ghost" size="sm" onClick={() => resetAll(true)} className="px-2.5">
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">New</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6">
          <ProgressStepper current={step} onJump={done ? undefined : setStep} />
        </div>

        <AnimatePresence>
          {triage?.red_flag && step >= 3 && step <= 5 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-4">
              <RedFlagBanner triage={triage} />
            </motion.div>
          )}
        </AnimatePresence>

        {done ? (
          <DoneScreen name={form.full_name} triage={triage} onNew={() => resetAll(false)} />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={step} variants={stepMotion} initial="initial" animate="animate" exit="exit">
              {step === 0 && (
                <StepDetails
                  t={t}
                  form={form}
                  setForm={setForm}
                  clinicalMode={persist.clinicalMode}
                  setClinicalMode={(v) => setP({ clinicalMode: v })}
                  canContinue={canContinueDetails}
                  onNext={() => setStep(1)}
                />
              )}

              {step === 1 && (
                <StepConsent
                  t={t}
                  consent={consent}
                  setConsent={setConsent}
                  canConsent={canConsent}
                  busy={busy}
                  onBack={() => setStep(0)}
                  onNext={agreeAndContinue}
                />
              )}

              {step === 2 && (
                <StepSymptoms
                  t={t}
                  lang={lang}
                  mode={persist.mode}
                  setMode={(m) => setP({ mode: m })}
                  value={persist.chiefComplaint}
                  setValue={(v) => setP({ chiefComplaint: v })}
                  busy={busy}
                  onBack={() => setStep(1)}
                  onNext={startInterview}
                />
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <SectionTitle hint="One question at a time. This records your history — it does not diagnose.">
                    {t("history.title")}
                  </SectionTitle>
                  <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
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
                      onFinish={() => setStep(4)}
                    />
                    <ClinicalIntelligencePanel
                      chiefComplaint={persist.chiefComplaint}
                      history={partialHistory}
                      triage={triage}
                      completionPct={completionPct}
                      questionCount={questionCount}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" onClick={() => setStep(2)}>
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

              {step === 4 && (
                <div className="space-y-4">
                  <SectionTitle hint={t("documents.hint")}>{t("documents.title")}</SectionTitle>
                  <DocumentDropzone onPick={pickDocument} busy={docBusy} />
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
                  <StepNav onBack={() => setStep(3)} onNext={() => setStep(5)} nextLabel="Continue to review" />
                </div>
              )}

              {step === 5 && (
                <div className="space-y-4">
                  <SectionTitle hint={t("review.disclaimer")}>{t("review.title")}</SectionTitle>
                  {summaryLoading && !summary ? (
                    <Card className="space-y-3 p-6">
                      <AIStatus
                        steps={[
                          "Retrieving relevant history…",
                          "Structuring medical information…",
                          "Checking safety indicators…",
                          "Preparing clinical summary…",
                        ]}
                      />
                      <div className="space-y-2">
                        <div className="skeleton h-3 w-2/3" />
                        <div className="skeleton h-3 w-full" />
                        <div className="skeleton h-3 w-5/6" />
                        <div className="skeleton h-28 w-full" />
                      </div>
                    </Card>
                  ) : (
                    <>
                      {persist.clinicalMode === "ayush" && (
                        <AyushForm value={ayush} onChange={setAyush} onSave={saveAyush} saving={ayushSaving} />
                      )}
                      <SummaryReview summary={summary} />
                      <div className="flex justify-end">
                        <Button variant="outline" onClick={generateSummary} loading={summaryLoading}>
                          <RotateCcw className="h-4 w-4" /> Regenerate
                        </Button>
                      </div>
                    </>
                  )}
                  <StepNav
                    onBack={() => setStep(4)}
                    onNext={() => setStep(6)}
                    nextLabel="Continue to submit"
                    nextDisabled={!summary}
                  />
                </div>
              )}

              {step === 6 && (
                <Card className="space-y-5 p-6 text-center sm:p-8">
                  <SectionTitle right={null}>{t("submit.title")}</SectionTitle>
                  <AiDraftNotice className="mx-auto w-fit" />
                  <p className="mx-auto max-w-md text-sm text-fg-muted">
                    Your structured history and any uploaded documents will be made available on your doctor’s
                    dashboard before your consultation.
                  </p>
                  <Button className="mx-auto" size="xl" loading={submitting} onClick={submitToDoctor}>
                    <Sparkles className="h-5 w-5" /> {t("common.submit")}
                  </Button>
                  <div>
                    <Button variant="ghost" onClick={() => setStep(5)}>
                      <ArrowLeft className="h-4 w-4" /> Back to review
                    </Button>
                  </div>
                </Card>
              )}
            </motion.div>
          </AnimatePresence>
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

function StepDetails({ t, form, setForm, clinicalMode, setClinicalMode, canContinue, onNext }) {
  return (
    <Card className="space-y-6 p-5 sm:p-6">
      <SectionTitle hint="Large text and simple controls — for every patient.">{t("details.title")}</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("details.name")} required htmlFor="pt-name">
          <TextInput
            id="pt-name"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            placeholder="e.g. Asha Rao"
            autoFocus
          />
        </Field>
        <Field label={t("details.age")} hint={t("common.optional")} htmlFor="pt-age">
          <TextInput
            id="pt-age"
            type="number"
            min="0"
            max="130"
            value={form.age}
            onChange={(e) => setForm({ ...form, age: e.target.value })}
            placeholder="Years"
          />
        </Field>
        <Field label={t("details.gender")} htmlFor="pt-gender">
          <Select id="pt-gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} options={GENDERS} />
        </Field>
        <Field label={t("details.phone")} hint={t("common.optional")} htmlFor="pt-phone">
          <TextInput
            id="pt-phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="For appointment updates"
          />
        </Field>
      </div>
      <Field label="Intake mode">
        <RadioCards
          value={clinicalMode}
          onChange={setClinicalMode}
          options={CLINICAL_MODES.map((m) => ({ value: m.value, label: m.label }))}
        />
      </Field>
      <div className="flex justify-end">
        <Button size="lg" disabled={!canContinue} onClick={onNext}>
          {t("common.continue")} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

function StepConsent({ t, consent, setConsent, canConsent, busy, onBack, onNext }) {
  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <SectionTitle hint="You are in control of your information.">{t("details.consentTitle")}</SectionTitle>
      <div className="space-y-2.5">
        <Checkbox id="c1" checked={consent.data} onChange={(v) => setConsent({ ...consent, data: v })} label={t("details.consent.data")} />
        <Checkbox id="c2" checked={consent.ai} onChange={(v) => setConsent({ ...consent, ai: v })} label={t("details.consent.ai")} />
        <Checkbox id="c3" checked={consent.share} onChange={(v) => setConsent({ ...consent, share: v })} label={t("details.consent.share")} />
      </div>
      <Alert tone="info" title="What happens next" icon={ShieldCheck}>
        An assistant asks a few short questions to build your history. A deterministic safety check runs on every
        answer. Nothing is diagnosed — a clinician reviews everything.
      </Alert>
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button size="lg" disabled={!canConsent} loading={busy} onClick={onNext}>
          Agree &amp; continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

function StepSymptoms({ t, lang, mode, setMode, value, setValue, busy, onBack, onNext }) {
  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <SectionTitle>{t("symptoms.title")}</SectionTitle>

      <RadioCards
        value={mode}
        onChange={setMode}
        options={[
          { value: "voice", label: t("symptoms.modeVoice"), hint: "Speak your answers", icon: Mic },
          { value: "text", label: t("symptoms.modeText"), hint: "Type or tap", icon: Keyboard },
        ]}
      />

      <Field label="Your main problem" required htmlFor="cc">
        <textarea
          id="cc"
          className="input min-h-[130px] text-base"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("symptoms.placeholder")}
        />
      </Field>

      {mode === "voice" && (
        <div className="rounded-2xl border border-border bg-surface/60 p-5">
          <VoiceOrb langCode={lang} onFinalTranscript={(txt) => setValue(value ? `${value} ${txt}` : txt)} />
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button size="lg" loading={busy} onClick={onNext}>
          Start questions <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

function DoneScreen({ name, triage, onNew }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
      <Card className="p-8 text-center sm:p-10">
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
          className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/12 text-success"
        >
          <CheckCircle2 className="h-9 w-9" />
        </motion.span>
        <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-fg">
          All done{name ? `, ${name.split(" ")[0]}` : ""}!
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">
          Your clinical history has been sent to your doctor and will be ready before your consultation.
        </p>
        {triage?.red_flag && (
          <Alert tone="critical" title="Please tell the front desk now" className="mx-auto mt-4 max-w-md text-left">
            A possible urgent symptom was noted and marked high priority for the care team. If you feel worse, alert
            staff immediately.
          </Alert>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={onNew}>
            <RotateCcw className="h-4 w-4" /> Start another intake
          </Button>
          <Link to="/" className="btn-outline h-10 px-4">
            Home
          </Link>
        </div>
      </Card>
    </motion.div>
  );
}
