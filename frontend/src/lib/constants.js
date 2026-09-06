import {
  Activity,
  Brain,
  CalendarClock,
  FileScan,
  FileText,
  Keyboard,
  LayoutDashboard,
  Leaf,
  Mic,
  Network,
  ScanText,
  ShieldAlert,
  Sparkles,
  UserRound,
} from "lucide-react";

/* Patient intake — 7 visible steps. The machine advances 0…6. */
export const STEPS = [
  { key: "details", label: "Patient Details", icon: UserRound },
  { key: "consent", label: "Consent", icon: ShieldAlert },
  { key: "symptoms", label: "Symptoms", icon: Activity },
  { key: "interview", label: "AI Interview", icon: Brain },
  { key: "documents", label: "Documents", icon: FileScan },
  { key: "review", label: "AI Review", icon: Sparkles },
  { key: "submit", label: "Submit", icon: LayoutDashboard },
];

export const GENDERS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
  { value: "undisclosed", label: "Prefer not to say" },
];

export const DOCUMENT_TYPES = [
  { value: "prescription", label: "Prescription" },
  { value: "lab_report", label: "Lab report" },
  { value: "discharge_summary", label: "Discharge summary" },
  { value: "imaging_report", label: "Imaging / radiology report" },
  { value: "referral", label: "Referral letter" },
  { value: "other", label: "Other" },
];

export const AYUSH_FIELDS = [
  ["prakriti", "Prakriti (constitution)"],
  ["vikriti", "Vikriti (current imbalance)"],
  ["sara", "Sara (tissue excellence)"],
  ["samhanana", "Samhanana (build / compactness)"],
  ["pramana", "Pramana (proportion)"],
  ["satmya", "Satmya (adaptability)"],
  ["sattva", "Sattva (mental strength)"],
  ["ahara_shakti", "Ahara Shakti (digestive capacity)"],
  ["vyayama_shakti", "Vyayama Shakti (exercise capacity)"],
  ["vaya", "Vaya (age category)"],
  ["ahara_vihara", "Ahara-Vihara (diet & routine)"],
];

export const CLINICAL_MODES = [
  { value: "general", label: "General Clinical" },
  { value: "ayush", label: "AYUSH / Ayurveda" },
];

/* Landing — how MACI works */
export const WORKFLOW = [
  { key: "patient", label: "Patient", icon: UserRound, note: "Walk-in or scheduled" },
  { key: "input", label: "Voice / Touch / Text", icon: Mic, note: "Whatever suits the patient" },
  { key: "interview", label: "Adaptive AI Interview", icon: Brain, note: "SOCRATES-style follow-ups" },
  { key: "ocr", label: "Document OCR", icon: ScanText, note: "Rx · labs · discharge" },
  { key: "rag", label: "Semantic Retrieval", icon: Network, note: "Per-patient prior context" },
  { key: "summary", label: "Structured Summary", icon: Sparkles, note: "Physician-ready draft" },
  { key: "doctor", label: "Doctor Dashboard", icon: LayoutDashboard, note: "Before the consult" },
];

export const FEATURES = [
  { icon: Brain, title: "AI Clinical Interview", body: "Adaptive, one-question-at-a-time history taking using recognised frameworks — never a diagnosis." },
  { icon: Mic, title: "Multilingual Voice Intake", body: "Speak in English or Hindi; a modular voice layer is ready for more Indian languages." },
  { icon: Keyboard, title: "Touch / Text Intake", body: "Large tap targets, symptom cards and quick-answer chips for kiosks and low-tech users." },
  { icon: FileScan, title: "Document Intelligence", body: "Drag in prescriptions, lab reports and discharge summaries — parsed into structured data." },
  { icon: ScanText, title: "OCR Extraction", body: "OCR.Space text with an AI layer that pulls medicines, doses, results, units and dates." },
  { icon: Network, title: "Semantic Medical Retrieval", body: "Pinecone RAG surfaces the patient's relevant prior records — strictly isolated per patient." },
  { icon: ShieldAlert, title: "Red-Flag Detection", body: "A deterministic safety layer runs on every message, independent of the LLM." },
  { icon: Sparkles, title: "Structured Clinical Summary", body: "Interview + documents + retrieved context become one validated, physician-ready summary." },
  { icon: CalendarClock, title: "Medical Timeline", body: "Dates are extracted and arranged chronologically so the illness story reads at a glance." },
  { icon: LayoutDashboard, title: "Doctor Dashboard", body: "Prioritised queue, editable summaries, attention points and clinical analytics." },
  { icon: Leaf, title: "AYUSH Mode", body: "Optional Ayurveda intake (Prakriti, Vikriti, Sara…) kept cleanly separate from the biomedical flow." },
];

export const DOC_PIPELINE = [
  { key: "uploaded", label: "Uploading" },
  { key: "ocr_running", label: "OCR processing" },
  { key: "ocr_done", label: "Extracting clinical data" },
  { key: "structured", label: "Structuring & indexed" },
];

export { FileText };
