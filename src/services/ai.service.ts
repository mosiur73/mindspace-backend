import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "../utils/logger";

const getModel = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const genAI = new GoogleGenerativeAI(key);
  return genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
};

const parseJSON = <T>(text: string, fallback: T): T => {
  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return fallback;
  }
};

export interface JournalAnalysis {
  tone: string;
  themes: string[];
  wellnessScore: number;
  advice: string;
}

export const analyzeJournal = async (content: string): Promise<JournalAnalysis> => {
  const model = getModel();

  if (!model) {
    logger.warn("GEMINI_API_KEY not set — using mock journal analysis");
    return mockJournalAnalysis(content);
  }

  const prompt = `You are a compassionate mental wellness AI assistant. Analyze this personal journal entry and provide structured insights.

Journal entry:
"${content}"

Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{
  "tone": "one word or short phrase describing emotional tone",
  "themes": ["theme1", "theme2", "theme3"],
  "wellnessScore": <integer 1-10>,
  "advice": "2-3 sentences of personalized, actionable wellness advice"
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return parseJSON<JournalAnalysis>(text, mockJournalAnalysis(content));
  } catch (err) {
    logger.error("Gemini journal analysis failed", err);
    return mockJournalAnalysis(content);
  }
};

export interface MoodPattern {
  trend: "improving" | "declining" | "stable";
  bestDays: string[];
  triggers: string[];
  recommendations: string[];
}

export const analyzeMoodPattern = async (
  moodLogs: { score: number; createdAt: Date; note?: string | null }[]
): Promise<MoodPattern> => {
  const model = getModel();

  if (!model || moodLogs.length < 3) {
    return mockMoodPattern(moodLogs);
  }

  const data = moodLogs.map((l) => ({
    date: l.createdAt.toISOString().split("T")[0],
    day: new Date(l.createdAt).toLocaleDateString("en-US", { weekday: "long" }),
    score: l.score,
    note: l.note,
  }));

  const prompt = `You are a mental wellness AI. Analyze these daily mood logs from the last 30 days.

Mood data (date, day of week, score 1-10, optional note):
${JSON.stringify(data, null, 2)}

Respond ONLY with valid JSON (no markdown):
{
  "trend": "improving" | "declining" | "stable",
  "bestDays": ["DayName1", "DayName2"],
  "triggers": ["trigger description 1", "trigger description 2"],
  "recommendations": ["actionable rec 1", "actionable rec 2", "actionable rec 3"]
}`;

  try {
    const result = await model.generateContent(prompt);
    return parseJSON<MoodPattern>(result.response.text(), mockMoodPattern(moodLogs));
  } catch (err) {
    logger.error("Gemini mood analysis failed", err);
    return mockMoodPattern(moodLogs);
  }
};

// ── Mock fallbacks (used when no API key or on error) ──────────────────────

const mockJournalAnalysis = (content: string): JournalAnalysis => {
  const words = content.toLowerCase();
  const positive = ["happy", "good", "great", "excited", "calm", "hope", "better"].some((w) => words.includes(w));
  const score = positive ? 7 : 5;
  return {
    tone: positive ? "Hopeful" : "Reflective",
    themes: ["Self-awareness", "Daily challenges", "Personal growth"],
    wellnessScore: score,
    advice:
      "Continue reflecting on your experiences through journaling. Consider identifying one small positive action you can take today. Remember that acknowledging your feelings is an important step toward wellness.",
  };
};

// ── Blog Generation ────────────────────────────────────────────────────────

export interface BlogContent {
  title: string;
  excerpt: string;
  content: string;
  tags: string[];
}

export const generateBlog = async (topic: string, category: string): Promise<BlogContent> => {
  const model = getModel();

  if (!model) {
    logger.warn("GEMINI_API_KEY not set — using mock blog content");
    return mockBlogContent(topic, category);
  }

  const prompt = `Write a professional, empathetic mental health blog post for MindSpace platform about "${topic}" in the "${category}" category.

Respond ONLY with valid JSON (no markdown, no extra text):
{
  "title": "Compelling SEO-friendly title (max 80 characters)",
  "excerpt": "2-sentence compelling summary shown in blog listings",
  "content": "Full blog post in markdown format (500-700 words). Start with a relatable intro paragraph, include 2-3 sections with ## headers, end with actionable takeaways. Use empathetic, professional tone.",
  "tags": ["tag1", "tag2", "tag3", "tag4"]
}`;

  try {
    const result = await model.generateContent(prompt);
    return parseJSON<BlogContent>(result.response.text(), mockBlogContent(topic, category));
  } catch (err) {
    logger.error("Gemini blog generation failed", err);
    return mockBlogContent(topic, category);
  }
};

const mockBlogContent = (topic: string, category: string): BlogContent => ({
  title: `Understanding ${topic}: A Mental Health Perspective`,
  excerpt: `${topic} affects millions of people worldwide. In this article, we explore evidence-based strategies to help you navigate this challenge and improve your mental wellbeing.`,
  content: `## Introduction\n\n${topic} is something many of us encounter in our daily lives. Whether it's the pressure of modern work, relationship challenges, or simply the weight of uncertainty, understanding how to address these feelings is the first step toward healing.\n\n## Why This Matters\n\nMental health is just as important as physical health. Research consistently shows that addressing emotional wellbeing proactively leads to better life outcomes, stronger relationships, and greater resilience.\n\n## Evidence-Based Strategies\n\nHere are proven approaches that mental health professionals recommend:\n\n1. **Practice mindfulness** — Even 5 minutes of daily meditation can significantly reduce stress levels\n2. **Maintain social connections** — Isolation worsens most mental health challenges\n3. **Establish healthy routines** — Sleep, exercise, and nutrition directly impact mood\n4. **Seek professional support** — Therapy provides tools tailored to your specific needs\n\n## Taking the First Step\n\nRemember that seeking help is a sign of strength, not weakness. If you're struggling with ${topic.toLowerCase()}, consider speaking with a licensed therapist who can provide personalised guidance.\n\nYour mental health journey is unique to you. Small, consistent steps lead to meaningful, lasting change.`,
  tags: [category, "Mental Health", "Wellness", "Self-Care"],
});

// ── AI Chatbot ─────────────────────────────────────────────────────────────

const WELLNESS_SYSTEM = `You are Aria, a compassionate AI mental wellness companion on MindSpace. Your role:
- Provide warm, empathetic emotional support and validation
- Offer evidence-based coping strategies (breathing, grounding, mindfulness)
- Help users reflect on their feelings without judgment
- Keep responses concise: 2-4 sentences maximum
- For serious concerns, suggest speaking with a licensed therapist
- For crisis situations, always provide: "988 Suicide & Crisis Lifeline (call/text 988)"
- Never diagnose conditions or prescribe medications
- You are a wellness companion, NOT a replacement for professional therapy`;

export const chatWithAssistant = async (
  userMessage: string,
  history: { role: string; content: string }[]
): Promise<string> => {
  const model = getModel();
  if (!model) return mockChatResponse(userMessage);

  try {
    const geminiHistory = [
      { role: "user" as const, parts: [{ text: WELLNESS_SYSTEM }] },
      { role: "model" as const, parts: [{ text: "Understood. I'm Aria, your wellness companion. I'm here to support you with empathy and evidence-based guidance." }] },
      ...history.map((msg) => ({
        role: msg.role === "user" ? ("user" as const) : ("model" as const),
        parts: [{ text: msg.content }],
      })),
    ];

    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(userMessage);
    return result.response.text();
  } catch (err) {
    logger.error("Gemini chat failed", err);
    return mockChatResponse(userMessage);
  }
};

const mockChatResponse = (message: string): string => {
  const lower = message.toLowerCase();
  if (lower.includes("anxious") || lower.includes("anxiety") || lower.includes("nervous"))
    return "I hear you — anxiety can feel overwhelming. Try the 4-7-8 breathing technique: inhale for 4 counts, hold for 7, exhale for 8. This activates your parasympathetic nervous system and brings calm. Would you like to try it together?";
  if (lower.includes("sad") || lower.includes("depress") || lower.includes("unhappy"))
    return "I'm sorry you're feeling this way, and I want you to know you're not alone. Sometimes acknowledging the feeling is the first step. Can you tell me more about what's been happening?";
  if (lower.includes("stress") || lower.includes("overwhelm"))
    return "Feeling overwhelmed is your mind's signal that it needs a break. Take 5 minutes to step away, breathe deeply, and write down the one thing that feels most urgent. Tackling one thing at a time makes the load feel lighter.";
  if (lower.includes("sleep") || lower.includes("insomnia"))
    return "Sleep and mental health are deeply connected. Try keeping a consistent bedtime, avoiding screens 30 minutes before bed, and doing a brief body scan meditation as you lie down. Even small improvements in sleep quality can significantly lift your mood.";
  if (lower.includes("crisis") || lower.includes("suicid") || lower.includes("harm"))
    return "I'm really glad you reached out. If you're in crisis, please contact the 988 Suicide & Crisis Lifeline by calling or texting 988 — they're available 24/7. You don't have to face this alone. 💙";
  return "Thank you for sharing that with me. Your feelings are completely valid, and it takes courage to talk about them. Would you like to explore some strategies together, or would you simply like someone to listen right now?";
};

// ── Therapist Recommender ───────────────────────────────────────────────────

export interface TherapistRecommendation {
  specialties: string[];
  reasoning: string;
  matchCriteria: string[];
}

export const recommendTherapistSpecialties = async (
  avgMood: number,
  journalThemes: string[],
  concerns: string[]
): Promise<TherapistRecommendation> => {
  const model = getModel();
  if (!model) return mockRecommendation(concerns);

  const prompt = `A user on a mental health platform needs therapist recommendations. Analyze their data:

Average mood score (last 30 days): ${avgMood.toFixed(1)}/10 ${avgMood < 5 ? "(low — may indicate depression/burnout)" : avgMood < 7 ? "(moderate)" : "(good)"}
Recurring themes in journal entries: ${journalThemes.length > 0 ? journalThemes.join(", ") : "Not enough data"}
Self-reported concerns: ${concerns.length > 0 ? concerns.join(", ") : "General wellness"}

Recommend the most beneficial therapy specialties and explain why.

Respond ONLY with valid JSON:
{
  "specialties": ["Specialty1", "Specialty2", "Specialty3"],
  "reasoning": "2-3 sentence explanation of why these specialties match",
  "matchCriteria": ["key criterion 1", "key criterion 2", "key criterion 3"]
}`;

  try {
    const result = await model.generateContent(prompt);
    return parseJSON<TherapistRecommendation>(result.response.text(), mockRecommendation(concerns));
  } catch (err) {
    logger.error("Gemini recommender failed", err);
    return mockRecommendation(concerns);
  }
};

const mockRecommendation = (concerns: string[]): TherapistRecommendation => ({
  specialties: concerns.length > 0
    ? concerns.slice(0, 3)
    : ["Anxiety", "Stress Management", "Mindfulness"],
  reasoning: "Based on your mood patterns and journal themes, you would benefit most from a therapist who specialises in evidence-based approaches for emotional regulation and stress reduction. CBT and mindfulness-based therapies have strong research support for these concerns.",
  matchCriteria: ["Evidence-based approach (CBT)", "Emotional regulation skills", "Stress management techniques"],
});

const mockMoodPattern = (logs: { score: number; createdAt: Date }[]): MoodPattern => {
  if (logs.length === 0) {
    return { trend: "stable", bestDays: ["Friday", "Saturday"], triggers: ["Work stress"], recommendations: ["Log your mood daily", "Try a short meditation", "Get 7-8 hours of sleep"] };
  }
  const first = logs.slice(0, Math.floor(logs.length / 2)).reduce((s, l) => s + l.score, 0) / Math.floor(logs.length / 2);
  const last = logs.slice(-Math.floor(logs.length / 2)).reduce((s, l) => s + l.score, 0) / Math.floor(logs.length / 2);
  const trend = last > first + 0.5 ? "improving" : last < first - 0.5 ? "declining" : "stable";
  return {
    trend,
    bestDays: ["Friday", "Saturday"],
    triggers: ["Work pressure", "Sleep deprivation"],
    recommendations: [
      "Set a consistent sleep schedule — low mood often correlates with poor sleep",
      "Plan lighter tasks for days when your mood is typically low",
      "Celebrate small wins — notice what is going right each day",
    ],
  };
};
