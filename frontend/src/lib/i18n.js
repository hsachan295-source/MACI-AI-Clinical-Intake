// Minimal i18n layer. Add a language by adding a key block below + an entry in
// LANGUAGES. Kept dependency-free on purpose so more Indian languages can be
// dropped in later.
import { createContext, useContext } from "react";

export const LANGUAGES = [
  { code: "en", label: "English", native: "English", bcp47: "en-IN" },
  { code: "hi", label: "Hindi", native: "हिन्दी", bcp47: "hi-IN" },
];

const STRINGS = {
  en: {
    "app.tagline": "Smarter Patient Intake. Better Clinical Conversations.",
    "nav.patient": "Patient Intake",
    "nav.doctor": "Doctor Dashboard",
    "common.next": "Next",
    "common.back": "Back",
    "common.continue": "Continue",
    "common.submit": "Submit",
    "common.saving": "Saving…",
    "common.loading": "Loading…",
    "common.optional": "Optional",
    "common.required": "Required",
    "steps.details": "Patient Details",
    "steps.symptoms": "Symptoms",
    "steps.history": "Medical History",
    "steps.documents": "Documents",
    "steps.review": "AI Review",
    "steps.submit": "Submit",
    "details.title": "Tell us who you are",
    "details.name": "Full name",
    "details.age": "Age",
    "details.gender": "Gender",
    "details.language": "Preferred language",
    "details.phone": "Phone number",
    "details.consentTitle": "Your consent",
    "details.consent.data": "I agree that my intake information will be processed to prepare my visit.",
    "details.consent.ai": "I understand an AI assistant will help collect my history (no diagnosis is given).",
    "details.consent.share": "I agree to share this summary with the treating doctor.",
    "symptoms.title": "What brings you in today?",
    "symptoms.placeholder": "Describe your main problem in your own words…",
    "symptoms.modeVoice": "Use Voice",
    "symptoms.modeText": "Use Touch / Text",
    "history.title": "A few questions about your health",
    "history.finish": "I've answered enough",
    "history.mic": "Tap to speak",
    "history.stop": "Stop",
    "history.send": "Send",
    "history.speakerOn": "Read questions aloud",
    "documents.title": "Add your medical documents",
    "documents.hint": "Prescriptions, lab reports, discharge summaries. Images or PDFs.",
    "documents.drop": "Tap to choose a file or drop it here",
    "documents.process": "Extract details",
    "documents.reprocess": "Re-extract",
    "review.title": "Review your information",
    "review.disclaimer": "This is a draft prepared for your doctor. It is not a diagnosis.",
    "submit.title": "Send to your doctor",
    "submit.done": "All done — your doctor has your history",
    "redflag.title": "Potential urgent symptom detected",
    "redflag.body": "Please contact medical staff immediately.",
  },
  hi: {
    "app.tagline": "बेहतर मरीज़ इनटेक। बेहतर नैदानिक बातचीत।",
    "nav.patient": "मरीज़ इनटेक",
    "nav.doctor": "डॉक्टर डैशबोर्ड",
    "common.next": "आगे",
    "common.back": "पीछे",
    "common.continue": "जारी रखें",
    "common.submit": "जमा करें",
    "common.saving": "सहेजा जा रहा है…",
    "common.loading": "लोड हो रहा है…",
    "common.optional": "वैकल्पिक",
    "common.required": "आवश्यक",
    "steps.details": "मरीज़ विवरण",
    "steps.symptoms": "लक्षण",
    "steps.history": "चिकित्सा इतिहास",
    "steps.documents": "दस्तावेज़",
    "steps.review": "एआई समीक्षा",
    "steps.submit": "जमा करें",
    "details.title": "बताइए आप कौन हैं",
    "details.name": "पूरा नाम",
    "details.age": "उम्र",
    "details.gender": "लिंग",
    "details.language": "पसंदीदा भाषा",
    "details.phone": "फ़ोन नंबर",
    "details.consentTitle": "आपकी सहमति",
    "details.consent.data": "मैं सहमत हूँ कि मेरी जानकारी मेरी विज़िट की तैयारी हेतु संसाधित की जाएगी।",
    "details.consent.ai": "मैं समझता/समझती हूँ कि एक एआई सहायक मेरा इतिहास एकत्र करने में मदद करेगा (कोई निदान नहीं दिया जाता)।",
    "details.consent.share": "मैं यह सारांश इलाज करने वाले डॉक्टर के साथ साझा करने के लिए सहमत हूँ।",
    "symptoms.title": "आज आप किस समस्या के लिए आए हैं?",
    "symptoms.placeholder": "अपनी मुख्य समस्या अपने शब्दों में बताइए…",
    "symptoms.modeVoice": "आवाज़ से बताएं",
    "symptoms.modeText": "टच / टेक्स्ट से",
    "history.title": "आपकी सेहत के बारे में कुछ सवाल",
    "history.finish": "मैंने पर्याप्त उत्तर दे दिए",
    "history.mic": "बोलने के लिए दबाएँ",
    "history.stop": "रोकें",
    "history.send": "भेजें",
    "history.speakerOn": "सवाल ज़ोर से पढ़ें",
    "documents.title": "अपने मेडिकल दस्तावेज़ जोड़ें",
    "documents.hint": "पर्चे, लैब रिपोर्ट, डिस्चार्ज सारांश। चित्र या पीडीएफ।",
    "documents.drop": "फ़ाइल चुनने के लिए टैप करें या यहाँ छोड़ें",
    "documents.process": "जानकारी निकालें",
    "documents.reprocess": "फिर से निकालें",
    "review.title": "अपनी जानकारी की समीक्षा करें",
    "review.disclaimer": "यह आपके डॉक्टर के लिए तैयार एक ड्राफ़्ट है। यह निदान नहीं है।",
    "submit.title": "अपने डॉक्टर को भेजें",
    "submit.done": "हो गया — आपके डॉक्टर के पास आपका इतिहास है",
    "redflag.title": "संभावित गंभीर लक्षण पाया गया",
    "redflag.body": "कृपया तुरंत चिकित्सा कर्मचारियों से संपर्क करें।",
  },
};

export function translate(lang, key) {
  return STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
}

export const I18nContext = createContext({ lang: "en", t: (k) => translate("en", k), setLang: () => {} });

export function useI18n() {
  return useContext(I18nContext);
}

export function bcp47For(code) {
  return LANGUAGES.find((l) => l.code === code)?.bcp47 || "en-IN";
}
