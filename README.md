# Chinese Oral AI Phase 4

This version includes:

- Reading aloud marking
- Picture oral examiner
- Video-link oral examiner
- AI-generated questions
- Student voice answer recording
- Google Speech-to-Text transcription
- OpenAI rubric scoring
- Feedback report

## Vercel Environment Variables

Add these in Vercel:

```text
GOOGLE_SPEECH_API_KEY=your_google_speech_key
OPENAI_API_KEY=your_openai_api_key
```

## Required files at GitHub root

Upload these extracted files/folders to GitHub:

```text
index.html
package.json
README.md
.gitignore
api/
```

Inside `api/`:

```text
transcribe-google.js
generate-question.js
score-answer.js
```

## Deployment

After uploading to GitHub:

1. Go to Vercel.
2. Import the GitHub repository.
3. Add both environment variables.
4. Deploy.
5. Visit the generated Vercel URL.

## Privacy note

Avoid asking students to say full names or sensitive details in recordings.
