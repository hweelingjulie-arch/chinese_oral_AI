function extractTextFromOpenAI(data) {
  if (data.output_text) return data.output_text;

  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) parts.push(content.text);
      if (content.type === "text" && content.text) parts.push(content.text);
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

Return STRICT JSON only:
{
  "mediaDescription": "Chinese description",
  "mainQuestion": "Chinese main oral question",
  "followUpQuestions": ["question 1", "question 2", "question 3"],
  "expectedAnswerPoints": ["point 1", "point 2", "point 3", "point 4"],
  "teacherTips": "Short teaching tip in Chinese"
}

Rules:
- Suitable for ${level || "Primary school"} students.
- Use Singapore Chinese oral exam style.
- Do not include markdown.
- Do not invent scenes.
`;

    let userContent = [];

    if (mediaType === "image" && imageDataUrl) {
      userContent = [
        {
          type: "input_text",
          text: `
IMAGE MODE.

Look at the uploaded picture and generate Chinese oral questions.

Teacher context:
${teacherContext || "No extra context"}

Rubric:
${rubricText || "Assess relevance, elaboration, vocabulary, sentence structure, fluency."}

Important:
You may use visible picture details, but do not invent hidden events.
`
        },
        {
          type: "input_image",
          image_url: imageDataUrl
        }
      ];
    } else {
      if (!teacherContext || teacherContext.trim().length < 6) {
        return res.status(400).json({
          error: "For video mode, please provide a clear Video Summary / Teacher Context."
        });
      }

      userContent = [
        {
          type: "input_text",
          text: `
VIDEO MODE.

The AI CANNOT watch the video link.
The teacher summary below is the ONLY source of truth.

Teacher summary:
${teacherContext}

Video link, ignore for content:
${videoUrl || "No video link"}

Rubric:
${rubricText || "Content relevance, elaboration, vocabulary, sentence structure, fluency."}

Hard rules:
- Base every question on the teacher summary only.
- Do NOT mention picnic.
- Do NOT mention family outing.
- Do NOT mention park picnic.
- Do NOT mention zoo or elephant.
- Do NOT invent a picture scene.
- If the teacher summary says 校园环保, all questions and answer points must be about 校园环保.
- Use Primary School Singapore Chinese oral style.

Return JSON only.
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
        temperature: 0,
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
        mediaDescription: mediaType === "video" ? teacherContext : "",
        mainQuestion: "请你根据老师提供的主题，说说你的看法。",
        followUpQuestions: [
          "你认为这个主题为什么重要？",
          "如果你遇到类似情况，你会怎么做？",
          "我们可以从中学到什么？"
        ],
        expectedAnswerPoints: [
          "能围绕主题作答",
          "能说出原因",
          "能举出例子",
          "能表达个人看法"
        ],
        teacherTips: "请引导学生用“首先、其次、最后”组织答案。"
      });
    }

    if (mediaType !== "image") {
      parsed.mediaDescription = teacherContext;
    }

    return res.status(200).json(parsed);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
