import { OpenAI } from 'openai';
import { config } from 'dotenv';
import type { TutorialResult } from './types.ts';

config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function analyzeCode(code: string): Promise<TutorialResult> {
  const prompt = `Explain the following code as a tutorial for beginners. Include step-by-step reasoning and note the language:

\n\n\`\`\`
${code}
\`\`\``;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
  });

  const response = completion.choices[0].message.content || '';
  return {
    tutorialText: response.trim(),
    language: 'typescript', // optionally detect via code parsing
  };
}

export async function enhanceScript(script: string): Promise<string> {
  try {
    const prompt = `
Explain this code in small, natural segments that can be shown on screen. Format your response as segments separated by [PAUSE] markers. Each segment should be 1-2 sentences that explain what's visible on screen at that moment. The video will scroll to show new code only after each segment is narrated.

For example:
"The first line imports the OpenAI client from the openai package, which we'll use to interact with GPT-4. [PAUSE]
Next, we import the config function from dotenv to handle our environment variables. [PAUSE]"

Keep each segment focused and concise. The video will scroll to reveal new code only after each [PAUSE].

Here's the code to explain:

${script}
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a code narrator creating synchronized voice-over for a scrolling code tutorial. Break your explanation into small segments marked with [PAUSE]. Each segment should match what's visible on screen at that moment. Never use phrases like 'as we can see' or 'looking at'. Just explain directly."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1500
    });

    return response.choices[0].message.content?.trim() || '';
  } catch (error) {
    console.error('Error enhancing script:', error);
    return '';
  }
}

// Alternative version with even more specific constraints
export async function enhanceScriptDirect(script: string): Promise<string> {
  try {
    const prompt = `
Narrate this code. Start with the first line and explain what's happening:

${script}
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "Narrate code directly. No introductions like 'This code does...' or 'Let's look at...'. Start immediately with 'Here we're importing...' or 'This line creates...' etc."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.2, // Very low for consistent behavior
      max_tokens: 1000
    });

    return response.choices[0].message.content?.trim() || '';
  } catch (error) {
    console.error('Error enhancing script:', error);
    return '';
  }
}