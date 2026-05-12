export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { audio, languageCode } = req.body || {};

    if (!audio) {
      return res.status(400).json({ error: "No audio received." });
    }

    const apiKey = process.env.GOOGLE_SPEECH_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Missing GOOGLE_SPEECH_API_KEY in Vercel Environment Variables."
      });
    }

    const googleResponse = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            encoding: "WEBM_OPUS",
            sampleRateHertz: 48000,
            languageCode: languageCode || "cmn-Hans-CN",
            enableAutomaticPunctuation: true
          },
          audio: { content: audio }
        })
      }
    );

    const data = await googleResponse.json();

    if (!googleResponse.ok) {
      return res.status(500).json({
        error: data.error?.message || "Google Speech-to-Text error."
      });
    }

    const transcript =
      data.results
        ?.map(result => result.alternatives?.[0]?.transcript)
        .filter(Boolean)
        .join(" ") || "";

    return res.status(200).json({ transcript });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
