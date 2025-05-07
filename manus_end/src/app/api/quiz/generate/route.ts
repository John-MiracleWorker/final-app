import { NextResponse } from "next/server";


import MistralClient from "@mistralai/mistralai"; // Corrected import
import protocols from "@/lib/protocols.json";

interface Protocol {
  id: string;
  title: string;
  content: string;
  categories?: string[];
}

interface ProtocolData {
  [key: string]: Omit<Protocol, "id" | "categories"> & { categories?: string[] };
}

const allProtocols: Protocol[] = Object.entries(protocols as ProtocolData).map(([id, protocol]) => ({
  id,
  ...protocol,
}));

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
if (!MISTRAL_API_KEY) {
  console.warn("MISTRAL_API_KEY environment variable is not set. Quiz generation will use mock questions if AI calls fail or are skipped.");
}

const mistral = MISTRAL_API_KEY ? new MistralClient(MISTRAL_API_KEY) : null;

if (mistral) {
    console.log("Mistral client initialized successfully with MistralClient.");
} else if (MISTRAL_API_KEY) {
    console.error("Mistral client FAILED to initialize with MistralClient despite API key being present.");
} else {
    console.log("Mistral client not initialized as MISTRAL_API_KEY is not set.");
}

async function generateQuizQuestion(protocolContent: string, protocolTitle: string, existingQuestionTexts: string[]): Promise<any> {
  if (!mistral) {
    console.warn("Mistral client not available (likely no API key). Returning a mock question.");
    return {
        id: `mock-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        questionText: `This is a mock question about ${protocolTitle}. What is the primary intervention?`,
        questionType: "multiple-choice",
        options: [
            { id: "1", text: "Mock Option A" },
            { id: "2", text: "Mock Option B" },
            { id: "3", text: "Mock Option C" },
            { id: "4", text: "Mock Option D" },
        ],
        correctAnswerId: "1",
        explanation: "This is a mock explanation because the AI service is not available or not configured.",
    };
  }

  const questionTypes = ["multiple-choice", "scenario"];
  const selectedQuestionType = questionTypes[Math.floor(Math.random() * questionTypes.length)];

  let prompt = `Based on the following EMS protocol titled "${protocolTitle}" and its content:\n\n${protocolContent}\n\n`;
  const existingQuestionsClause = existingQuestionTexts.length > 0 ? ` The question should be different from these existing questions: ${existingQuestionTexts.join("; ")}.` : "";

  if (selectedQuestionType === "multiple-choice") {
    prompt += `Generate a unique multiple-choice question with 4 options (A, B, C, D) and identify the correct answer.${existingQuestionsClause} Provide the answer options as a numbered list (1. Option A, 2. Option B, etc.). Also provide a brief explanation for why the correct answer is correct. Format the output as a JSON object with keys: "questionText", "options" (an array of objects, each with "id" and "text"), "correctAnswerId" (e.g., "1", "2", "3", or "4"), and "explanation".`;
  } else { // scenario
    prompt += `Generate a unique, brief clinical scenario relevant to this protocol, followed by a question about the scenario.${existingQuestionsClause} Then, provide 4 multiple-choice options (A, B, C, D) for the question and identify the correct answer. Provide the answer options as a numbered list (1. Option A, 2. Option B, etc.). Also provide a brief explanation for why the correct answer is correct. Format the output as a JSON object with keys: "scenarioText", "questionText", "options" (an array of objects, each with "id" and "text"), "correctAnswerId" (e.g., "1", "2", "3", or "4"), and "explanation".`;
  }
  console.log(`[QUIZ API] Attempting to generate ${selectedQuestionType} question for protocol: "${protocolTitle}". Prompt length: ${prompt.length}`);
  console.log(`[QUIZ API] Prompt: ${prompt}`); // Added detailed prompt logging

  try {
    console.log("[QUIZ API] Calling mistral.chat()...");
    const chatResponse = await mistral.chat({
        model: "mistral-small-latest",
        messages: [{ role: "user", content: prompt }],
    });
    console.log("[QUIZ API] Mistral AI chat API call successful. Raw response received.");
    console.log("[QUIZ API] Raw Mistral Response:", JSON.stringify(chatResponse, null, 2)); // Log raw response

    if (!chatResponse || !chatResponse.choices || chatResponse.choices.length === 0 || !chatResponse.choices[0].message || !chatResponse.choices[0].message.content) {
        console.error("[QUIZ API] Invalid or empty response structure from Mistral AI:", chatResponse);
        throw new Error("Invalid or empty response structure from Mistral AI.");
    }

    const responseContent = chatResponse.choices[0].message.content;
    console.log("[QUIZ API] Response content from Mistral:", responseContent);
    const jsonMatch = responseContent.match(/\{\s*[\s\S]*\}/);
    if (!jsonMatch) {
        console.error("[QUIZ API] AI response did not contain valid JSON:", responseContent);
        throw new Error("AI response was not in the expected JSON format.");
    }
    const parsedResponse = JSON.parse(jsonMatch[0]);
    console.log("[QUIZ API] Successfully parsed JSON from AI response:", parsedResponse);
    
    if (parsedResponse.options && Array.isArray(parsedResponse.options)) {
        parsedResponse.options = parsedResponse.options.map((opt: any, index: number) => ({
            id: opt.id ? String(opt.id) : String(index + 1),
            text: opt.text
        }));
    }
    if (parsedResponse.correctAnswerId) {
        parsedResponse.correctAnswerId = String(parsedResponse.correctAnswerId);
    }

    return {
        id: `ai-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        questionType: selectedQuestionType,
        ...parsedResponse,
    };

  } catch (error: any) {
    console.error("[QUIZ API] Error during Mistral AI call or response processing:", error.message);
    console.error("[QUIZ API] Error stack:", error.stack);
    console.warn("[QUIZ API] Falling back to a mock question due to AI error.");
    return {
        id: `mock-error-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        questionText: `Mock question for ${protocolTitle} (AI error). What is the primary intervention?`,
        questionType: "multiple-choice",
        options: [
            { id: "1", text: "Mock Option A (AI Error)" },
            { id: "2", text: "Mock Option B (AI Error)" },
            { id: "3", text: "Mock Option C (AI Error)" },
            { id: "4", text: "Mock Option D (AI Error)" },
        ],
        correctAnswerId: "1",
        explanation: "This is a mock explanation because an error occurred during AI question generation.",
    };
  }
}

export async function POST(request: Request) {
  console.log("[QUIZ API] Received POST request to /api/quiz/generate");
  try {
    const { categories, length } = await request.json();
    console.log("[QUIZ API] Request body:", { categories, length });

    if (!categories || !Array.isArray(categories) || categories.length === 0 || !length || typeof length !== "number") {
      console.error("[QUIZ API] Invalid input to quiz generation:", { categories, length });
      return NextResponse.json({ error: "Invalid input: categories (array) and length (number) are required." }, { status: 400 });
    }

    const filteredProtocols = allProtocols.filter(p => 
      categories.some(cat => p.categories?.includes(cat))
    );
    console.log(`[QUIZ API] Found ${filteredProtocols.length} protocols for categories: ${categories.join(", ")}`);

    if (filteredProtocols.length === 0 && !(!mistral)) { 
      console.warn("[QUIZ API] No protocols found for selected categories, but AI client is available. Cannot generate specific questions.");
      return NextResponse.json({ error: "No protocols found for the selected categories to generate AI questions." }, { status: 404 });
    }

    const generatedQuestions = [];
    const existingQuestionTexts: string[] = [];
    const maxAttemptsPerQuestion = 3;

    for (let i = 0; i < length; i++) {
      console.log(`[QUIZ API] Generating question ${i + 1} of ${length}`);
      let questionGenerated = false;
      for (let attempt = 0; attempt < maxAttemptsPerQuestion; attempt++) {
        const randomProtocol = filteredProtocols.length > 0 
            ? filteredProtocols[Math.floor(Math.random() * filteredProtocols.length)] 
            : { id: "mock-protocol", title: "General EMS Knowledge", content: "Basic EMS procedures." };
        
        try {
          const newQuestion = await generateQuizQuestion(randomProtocol.content, randomProtocol.title, existingQuestionTexts);
          if (newQuestion && newQuestion.questionText) {
            if (newQuestion.id.startsWith("ai-") && existingQuestionTexts.includes(newQuestion.questionText)) {
                console.warn(`[QUIZ API] Duplicate AI question text detected: ${newQuestion.questionText}. Retrying attempt ${attempt + 1}...`);
                continue; 
            }
            generatedQuestions.push(newQuestion);
            if (newQuestion.id.startsWith("ai-")) {
                existingQuestionTexts.push(newQuestion.questionText);
            }
            questionGenerated = true;
            console.log(`[QUIZ API] Successfully generated question ${i + 1}`);
            break; 
          }
        } catch (genError: any) { 
          console.warn(`[QUIZ API] Outer catch: Attempt ${attempt + 1} to generate question ${i + 1} failed:`, genError.message);
        }
      }
      if (!questionGenerated) {
        console.warn(`[QUIZ API] Could not generate a unique question for slot ${i+1} after ${maxAttemptsPerQuestion} attempts. Adding fallback mock.`);
        generatedQuestions.push({
            id: `fallback-mock-${Date.now()}-${i}`,
            questionText: `Fallback mock question ${i + 1}. Please review protocol knowledge. What is X?`,
            questionType: "multiple-choice",
            options: [{ id: "1", text: "A" },{ id: "2", text: "B" },{ id: "3", text: "C" },{ id: "4", text: "D" }],
            correctAnswerId: "1",
            explanation: "This is a fallback mock explanation.",
        });
      }
    }
    console.log(`[QUIZ API] Finished generating ${generatedQuestions.length} questions.`);
    return NextResponse.json({ questions: generatedQuestions });

  } catch (error: any) {
    console.error("[QUIZ API] Critical Error in POST /api/quiz/generate:", error.message);
    console.error("[QUIZ API] Error stack:", error.stack);
    return NextResponse.json({ error: error.message || "An unexpected server error occurred while generating the quiz." }, { status: 500 });
  }
}

