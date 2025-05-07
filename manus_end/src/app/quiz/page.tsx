import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import protocolsData from "@/lib/protocols.json";

// 1) Validate incoming request
const requestSchema = z.object({
  categories: z.array(z.string()).optional(),
  length: z.number().min(1).max(20),
});

type Protocol = {
  id: string;
  title: string;
  content: string;
  categories?: string[];
};

type Question = {
  id: string;
  questionText: string;
  questionType: "multiple-choice";
  options: { id: string; text: string }[];
  correctAnswerId: string;
  explanation: string;
};

export async function POST(request: Request) {
  // parse & validate payload
  const body = await request.json();
  const parseResult = requestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.flatten() },
      { status: 400 }
    );
  }
  const { categories = [], length } = parseResult.data;

  // build protocol list
  const allProtocols: Protocol[] = Object.entries(
    protocolsData as Record<string, Omit<Protocol, "id">>
  ).map(([id, proto]) => ({ id, ...proto }));

  // filter by category
  let pool = allProtocols;
  if (categories.length) {
    pool = pool.filter(p => p.categories?.some(c => categories.includes(c)));
  }
  if (!pool.length) {
    return NextResponse.json(
      { error: "No protocols found for selected categories." },
      { status: 400 }
    );
  }

  // shuffle & select
  pool.sort(() => Math.random() - 0.5);
  const selected = pool.slice(0, length);

  // prepare OpenAI client
  const apiKey = process.env.OPENAI_API_KEY;
  const openai = apiKey ? new OpenAI({ apiKey }) : null;

  const questions: Question[] = [];

  for (const proto of selected) {
    let question: Question | undefined;

    if (openai) {
      try {
        const systemPrompt = `
You are an EMS educator. Generate ONE multiple-choice question (exactly four options) testing knowledge of the protocol titled "${proto.title}". 
Respond with ONLY valid JSON matching this schema:
{
  "id": string,
  "questionText": string,
  "questionType": "multiple-choice",
  "options": [{ "id": string, "text": string }],
  "correctAnswerId": string,
  "explanation": string
}`;
        const userPrompt = `Protocol Content:
${proto.content}`;

        const resp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.7,
        });
        question = JSON.parse(resp.choices[0].message.content) as Question;
      } catch (e) {
        console.warn("OpenAI error generating question", e);
      }
    }

    // fallback stub if AI fails
    if (!question) {
      question = {
        id: `fallback-${proto.id}-${Date.now()}`,
        questionText: `According to protocol "${proto.title}", what is the first step?`,
        questionType: "multiple-choice",
        options: [
          { id: "1", text: "Step A" },
          { id: "2", text: "Step B" },
          { id: "3", text: "Step C" },
          { id: "4", text: "Step D" }
        ],
        correctAnswerId: "1",
        explanation: "Fallback: review the protocol for the correct first step.",
      };
    }

    questions.push(question);
  }

  return NextResponse.json({ questions });
}
