import { NextResponse } from "next/server";
import OpenAI from "openai";
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

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY environment variable is not set. Quiz generation will use mock questions if AI calls fail or are skipped.");
}

const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

if (openai) {
    console.log("OpenAI client initialized successfully.");
} else if (OPENAI_API_KEY) {
    console.error("OpenAI client FAILED to initialize despite API key being present.");
} else {
    console.log("OpenAI client not initialized as OPENAI_API_KEY is not set.");
}

async function generateQuizQuestion(protocolContent: string, protocolTitle: string, existingQuestionTexts: string[]): Promise<any> {
  if (!openai) {
    console.warn("[QUIZ API - OpenAI] OpenAI client not available (likely no API key). Returning a mock question.");
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
        explanation: "This is a mock explanation because the AI service (OpenAI) is not available or not configured.",
    };
  }

  const questionTypes = ["multiple-choice", "scenario"];
  const selectedQuestionType = questionTypes[Math.floor(Math.random() * questionTypes.length)];

  let systemPrompt = "You are an assistant that generates EMS quiz questions based on provided protocols. Format your response as a valid JSON object.";
  let userPrompt = `Based on the following EMS protocol titled "${protocolTitle}" and its content:\n\n${protocolContent}\n\n`;
  const existingQuestionsClause = existingQuestionTexts.length > 0 ? ` The question should be different from these existing questions: ${existingQuestionTexts.join("; ")}.` : "";

  if (selectedQuestionType === "multiple-choice") {
    userPrompt += `Generate a unique multiple-choice question with 4 options and identify the correct answer.${existingQuestionsClause} Provide the answer options as a numbered list (1. Option A, 2. Option B, etc.). Also provide a brief explanation for why the correct answer is correct. Format the output as a JSON object with keys: "questionText", "options" (an array of objects, each with "id" and "text"), "correctAnswerId" (e.g., "1", "2", "3", or "4"), and "explanation". Ensure the entire response is a single JSON object.`;
  } else { // scenario
    userPrompt += `Generate a unique, brief clinical scenario relevant to this protocol, followed by a question about the scenario.${existingQuestionsClause} Then, provide 4 multiple-choice options for the question and identify the correct answer. Provide the answer options as a numbered list (1. Option A, 2. Option B, etc.). Also provide a brief explanation for why the correct answer is correct. Format the output as a JSON object with keys: "scenarioText", "questionText", "options" (an array of objects, each with "id" and "text"), "correctAnswerId" (e.g., "1", "2", "3", or "4"), and "explanation". Ensure the entire response is a single JSON object.`;
  }
  console.log(`[QUIZ API - OpenAI] Attempting to generate ${selectedQuestionType} question for protocol: "${protocolTitle}".`);
  // console.log(`[QUIZ API - OpenAI] User Prompt: ${userPrompt}`); // Log prompt if needed for debugging, can be verbose

  try {
    console.log("[QUIZ API - OpenAI] Calling openai.chat.completions.create()...");
    const chatCompletion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-0125", // Or another suitable model like gpt-4o-mini if available and preferred
        response_format: { type: "json_object" }, // Request JSON output
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
    });
    console.log("[QUIZ API - OpenAI] OpenAI API call successful. Raw response received.");
    // console.log("[QUIZ API - OpenAI] Raw OpenAI Response:", JSON.stringify(chatCompletion, null, 2)); // Log raw response if needed

    if (!chatCompletion || !chatCompletion.choices || chatCompletion.choices.length === 0 || !chatCompletion.choices[0].message || !chatCompletion.choices[0].message.content) {
        console.error("[QUIZ API - OpenAI] Invalid or empty response structure from OpenAI:", chatCompletion);
        throw new Error("Invalid or empty response structure from OpenAI.");
    }

    const responseContent = chatCompletion.choices[0].message.content;
    console.log("[QUIZ API - OpenAI] Response content from OpenAI (expecting JSON string):", responseContent);
    
    let parsedResponse;
    try {
        parsedResponse = JSON.parse(responseContent);
    } catch (parseError: any) {
        console.error("[QUIZ API - OpenAI] Failed to parse JSON from OpenAI response content:", responseContent, "Error:", parseError.message);
        throw new Error("AI response was not valid JSON, despite requesting JSON output.");
    }

    console.log("[QUIZ API - OpenAI] Successfully parsed JSON from AI response:", parsedResponse);
    
    if (parsedResponse.options && Array.isArray(parsedResponse.options)) {
        parsedResponse.options = parsedResponse.options.map((opt: any, index: number) => ({
            id: opt.id ? String(opt.id) : String(index + 1), // Ensure ID is a string
            text: opt.text
        }));
    }
    if (parsedResponse.correctAnswerId) {
        parsedResponse.correctAnswerId = String(parsedResponse.correctAnswerId); // Ensure correctAnswerId is a string
    }

    return {
        id: `ai-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        questionType: selectedQuestionType,
        ...parsedResponse,
    };

  } catch (error: any) {
    console.error("[QUIZ API - OpenAI] Error during OpenAI API call or response processing:", error.message);
    if (error.stack) console.error("[QUIZ API - OpenAI] Error stack:", error.stack);
    console.warn("[QUIZ API - OpenAI] Falling back to a mock question due to AI error.");
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
        explanation: "This is a mock explanation because an error occurred during AI question generation (OpenAI).",
    };
  }
}

export async function POST(request: Request) {
  console.log("[QUIZ API - OpenAI] Received POST request to /api/quiz/generate");
  try {
    const { categories, length } = await request.json();
    console.log("[QUIZ API - OpenAI] Request body:", { categories, length });

    if (!categories || !Array.isArray(categories) || categories.length === 0 || !length || typeof length !== "number") {
      console.error("[QUIZ API - OpenAI] Invalid input to quiz generation:", { categories, length });
      return NextResponse.json({ error: "Invalid input: categories (array) and length (number) are required." }, { status: 400 });
    }

    const filteredProtocols = allProtocols.filter(p => 
      categories.some(cat => p.categories?.includes(cat))
    );
    console.log(`[QUIZ API - OpenAI] Found ${filteredProtocols.length} protocols for categories: ${categories.join(", ")}`);

    if (filteredProtocols.length === 0 && !(!openai)) { 
      console.warn("[QUIZ API - OpenAI] No protocols found for selected categories, but AI client is available. Cannot generate specific questions.");
      return NextResponse.json({ error: "No protocols found for the selected categories to generate AI questions." }, { status: 404 });
    }

    const generatedQuestions = [];
    const existingQuestionTexts: string[] = [];
    const maxAttemptsPerQuestion = 3; // To avoid infinite loops on duplicate questions

    for (let i = 0; i < length; i++) {
      console.log(`[QUIZ API - OpenAI] Generating question ${i + 1} of ${length}`);
      let questionGenerated = false;
      for (let attempt = 0; attempt < maxAttemptsPerQuestion; attempt++) {
        const randomProtocol = filteredProtocols.length > 0 
            ? filteredProtocols[Math.floor(Math.random() * filteredProtocols.length)] 
            : { id: "mock-protocol", title: "General EMS Knowledge", content: "Basic EMS procedures for mock generation." }; // Provide some content for mock if no protocols
        
        try {
          const newQuestion = await generateQuizQuestion(randomProtocol.content, randomProtocol.title, existingQuestionTexts);
          if (newQuestion && newQuestion.questionText) {
            // Check for duplicates only if it's an AI generated question and not a mock one from error/no-key
            if (newQuestion.id.startsWith("ai-") && existingQuestionTexts.includes(newQuestion.questionText)) {
                console.warn(`[QUIZ API - OpenAI] Duplicate AI question text detected: ${newQuestion.questionText}. Retrying attempt ${attempt + 1}...`);
                continue; 
            }
            generatedQuestions.push(newQuestion);
            if (newQuestion.id.startsWith("ai-")) { // Add to existing texts only if AI generated
                existingQuestionTexts.push(newQuestion.questionText);
            }
            questionGenerated = true;
            console.log(`[QUIZ API - OpenAI] Successfully generated question ${i + 1}`);
            break; 
          }
        } catch (genError: any) { 
          console.warn(`[QUIZ API - OpenAI] Outer catch: Attempt ${attempt + 1} to generate question ${i + 1} failed:`, genError.message);
        }
      }
      if (!questionGenerated) {
        console.warn(`[QUIZ API - OpenAI] Could not generate a unique question for slot ${i+1} after ${maxAttemptsPerQuestion} attempts. Adding fallback mock.`);
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
    console.log(`[QUIZ API - OpenAI] Finished generating ${generatedQuestions.length} questions.`);
    return NextResponse.json({ questions: generatedQuestions });

  } catch (error: any) {
    console.error("[QUIZ API - OpenAI] Critical Error in POST /api/quiz/generate:", error.message);
    if (error.stack) console.error("[QUIZ API - OpenAI] Error stack:", error.stack);
    return NextResponse.json({ error: error.message || "An unexpected server error occurred while generating the quiz." }, { status: 500 });
  }
}

