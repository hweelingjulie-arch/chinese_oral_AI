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
      mediaType,
      imageDataUrl,
      videoUrl,
      teacherContext,
      level,
      rubricText
    } = req.body || {};

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Missing OPENAI_API_KEY in Vercel Environment Variables."
      });
    }

    const systemText = `
You are a Singapore Primary Chinese oral examiner.
Generate oral conversation questions in Chinese.
The questions must be suitable for ${level || "Primary school"} students.
Return STRICT JSON only, with this shape:
{
  "mediaDescription": "Chinese description of the picture/video context",
  "mainQuestion": "Chinese main oral question",
  "followUpQuestions": ["question 1", "question 2", "question 3"],
  "expectedAnswerPoints": ["point 1", "point 2", "point 3"],
  "teacherTips": "Short teaching tip in Chinese"
}
Do not include markdown.
`;

    let userContent = [];

    if (mediaType === "image" && imageDataUrl) {
      userContent = [
        {
          type: "input_text",
text: `
Generate oral questions mainly based on the teacher context and topic summary below.

Teacher context:
${teacherContext || "No context provided"}

Video link:
${videoUrl || "No link"}

Rubric:
${rubricText || "Assess relevance, elaboration, vocabulary, sentence structure, fluency."}

Important:
Do NOT guess random video content.
The teacher context is the PRIMARY source of truth.
The video link is only supplementary reference.
Generate Singapore Chinese oral exam style questions suitable for students.

Return:
1. Media description
2. Main question
3. 3 follow-up questions
4. Expected answer points
5. Teacher teaching tip
`


          
        }
      ];
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemText }]
          },
          {
            role: "user",
            content: userContent
          }
        ],
        temperature: 0.4,
        max_output_tokens: 900
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error: data.error?.message || "OpenAI question generation failed."
      });
    }

    const text = extractTextFromOpenAI(data);
    const parsed = safeJsonParse(text);

    if (!parsed) {
      return res.status(200).json({
        mediaDescription: "",
        mainQuestion: text || "请你描述图片或视频中的内容，并说说你的看法。",
        followUpQuestions: [],
        expectedAnswerPoints: [],
        teacherTips: ""
      });
    }

    return res.status(200).json(parsed);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
