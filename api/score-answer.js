function extractTextFromOpenAI(data) {
  if (data.output_text) return data.output_text;

  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) {
        parts.push(content.text);
      }
      if (content.type === "text" && content.text) {
        parts.push(content.text);
      }
    }
  }
  return parts.join("\n").trim();
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const {
      question,
      followUpQuestions,
      transcript,
      mediaDescription,
      expectedAnswerPoints,
      rubricText,
      level
    } = req.body || {};

    if (!transcript) {
      return res.status(400).json({ error: "No student transcript received." });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Missing OPENAI_API_KEY in Vercel Environment Variables."
      });
    }

    const prompt = `
You are a Singapore Primary Chinese oral examiner.
Mark the student's spoken Chinese answer fairly according to the rubric.

Student level: ${level || "Primary school"}

Media description:
${mediaDescription || ""}

Main question:
${question || ""}

Follow-up questions:
${(followUpQuestions || []).join("\n")}

Expected answer points:
${(expectedAnswerPoints || []).join("\n")}

Teacher rubric:
${rubricText || `
内容切题 Content relevance: 5 marks
细节说明 Elaboration: 5 marks
词语运用 Vocabulary: 5 marks
句子表达 Sentence structure: 5 marks
流利度 Fluency: 5 marks
Total: 25 marks
`}

Student transcript:
${transcript}

Return STRICT JSON only:
{
  "scores": {
    "contentRelevance": 0,
    "elaboration": 0,
    "vocabulary": 0,
    "sentenceStructure": 0,
    "fluency": 0,
    "total": 0,
    "maxTotal": 25
  },
  "band": "优秀/良好/及格/需加强",
  "strengths": ["..."],
  "improvements": ["..."],
  "betterAnswer": "A better sample answer in Chinese suitable for the student level.",
  "teacherFeedback": "Friendly Chinese feedback to student.",
  "parentSummary": "Short English summary for parent."
}
Do not include markdown.
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt,
        temperature: 0.3,
        max_output_tokens: 1200
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error: data.error?.message || "OpenAI scoring failed."
      });
    }

    const text = extractTextFromOpenAI(data);
    const parsed = safeJsonParse(text);

    if (!parsed) {
      return res.status(200).json({
        rawFeedback: text,
        scores: {
          contentRelevance: 0,
          elaboration: 0,
          vocabulary: 0,
          sentenceStructure: 0,
          fluency: 0,
          total: 0,
          maxTotal: 25
        },
        band: "N/A",
        strengths: [],
        improvements: [],
        betterAnswer: "",
        teacherFeedback: text,
        parentSummary: ""
      });
    }

    return res.status(200).json(parsed);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
