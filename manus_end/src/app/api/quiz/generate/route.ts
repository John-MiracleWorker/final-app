// File: src/app/api/quiz/generate/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import protocolsData from "@/lib/protocols.json";

// 1) Request schema
const requestSchema = z.object({
  categories: z.array(z.string()).optional(),
  length: z.number().min(1).max(20),
});

// 2) Define your Question type (for clarity)
interface Question {
  id: string;
  questionText: string;
  questionType: "multiple-choice";
  options: { id: string; text: string }[];
  correctAnswerId: string;
  explanation: string;
}

export async function POST(request: Request) {
  // Parse & validate
  const body = await request.json();
  const result = requestSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  }
  const { categories = [], length } = result.data;

  // 3) Filter protocols by category
  let protocols: { id: string; title: string; content: string; categories?: string[] }[] =
    Object.entries(protocolsData).map(([id, p]) => ({ id, ...p }));
  if (categories.length) {
    protocols = protocols.filter(p =>
      p.categories?.some(cat => categories.includes(cat))
    );
  }
  if (!protocols.length) {
    return NextResponse.json(
      { error: "No protocols found for those categories." },
      { status: 400 }
    );
  }

  // 4) Shuffle + pick
  protocols.sort(() => Math.random() - 0.5);
  const selected = protocols.slice(0, length);

  // 5) Instantiate OpenAI client
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("OPENAI_API_KEY not set—falling back to mocks");
  }
  const openai = apiKey ? new OpenAI({ apiKey }) : null;

  const questions: Question[] = [];
  for (const proto of selected) {
    // 📋 System prompt: one MCQ, four options, strict JSON
    const systemPrompt = `
You are an EMS educator. Generate ONE multiple-choice question (exactly four options) testing knowledge of the following protocol.
Respond with ONLY valid JSON matching this schema:

{
  "id": "<unique-question-id>",
  "questionText": "Question stem here",
  "questionType": "multiple-choice",
  "options": [
    { "id": "1", "text": "Option A" },
    { "id": "2", "text": "Option B" },
    { "id": "3", "text": "Option C" },
    { "id": "4", "text": "Option D" }
  ],
  "correctAnswerId": "<one of 1,2,3,4>",
  "explanation": "One-sentence explanation"
}`;

    const userPrompt = `
Protocol Title: ${proto.title}
Protocol Content:
${proto.content}
`;

    let question: Question;
    if (openai) {
      try {
        const resp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
        });
        question = JSON.parse(resp.choices[0].message.content) as Question;
      } catch (err) {
        console.error(`❌ AI error for protocol ${proto.id}:`, err);
      }
    }
    // Fallback stub if AI is unavailable or errors
    if (!question) {
      question = {
        id: `fallback-${proto.id}-${Date.now()}`,
        questionText: `According to protocol "${proto.title}", what is the first step?`,
        questionType: "multiple-choice",
        options: [
          { id: "1", text: "Option A" },
          { id: "2", text: "Option B" },
          { id: "3", text: "Option C" },
          { id: "4", text: "Option D" },
        ],
        correctAnswerId: "1",
        explanation: "Fallback explanation because AI was unavailable.",
      };
    }

    questions.push(question);
  }

  return NextResponse.json({ questions });
}
