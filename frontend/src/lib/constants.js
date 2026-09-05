export const STEPS = [
  { key: "details", label: "Patient Details" },
  { key: "symptoms", label: "Symptoms" },
  { key: "history", label: "Medical History" },
  { key: "documents", label: "Documents" },
  { key: "review", label: "AI Review" },
  { key: "submit", label: "Submit" },
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
