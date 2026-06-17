/**
 * API Endpoint: /api/validate-fallacy
 * Analyzes arguments to detect logical fallacies using Azure OpenAI GPT-5-mini
 *
 * Supports multiple fallacy types:
 * - Appeal to Tradition
 * - Appeal to Nature
 * - Ad Hominem
 * - Straw Man
 * - False Equivalence
 */

import { NextRequest, NextResponse } from "next/server";
import { AzureOpenAI } from "openai";
import { getAzureOpenAIConfig } from "@/lib/get-azure-credentials";
import { FALLACY_TYPES, isValidFallacyType, getFallacyById } from "@/lib/fallacy-types";

// Build system prompt dynamically from fallacy types
// TODO(human): Refactor this function to read from /backend/prompts/fallacy-detection-system.md
function buildSystemPrompt(): string {
  const fallacyDescriptions = FALLACY_TYPES.map(fallacy => `
**${fallacy.name} (ID: ${fallacy.id}):**
${fallacy.definition}

Common keywords: ${fallacy.keywords.slice(0, 6).join(', ')}
Examples: ${fallacy.examples.slice(0, 3).map(ex => `"${ex}"`).join(', ')}
`).join('\n');

  return `You are an expert in logic and rhetoric, specializing in identifying logical fallacies in arguments related to veganism and animal rights.

Your task is to analyze arguments and detect if they contain any of the following logical fallacies:

${fallacyDescriptions}

**Your response format:**
Analyze the argument and respond with a JSON object:
{
  "detected": boolean,           // true if ANY fallacy is detected
  "fallacyType": string | null,  // ID of the primary fallacy (e.g., "appeal_to_tradition"), or null if none detected
  "fallacyName": string | null,  // Human-readable name (e.g., "Appeal to Tradition"), or null if none detected
  "confidence": number,          // 0-100, your confidence in this assessment
  "explanation": string,         // Brief explanation (1-2 sentences)
  "keywords": string[],          // Key phrases from the argument that indicate the fallacy
  "snippets": [                  // ONLY if detected=true, generate 5 counter-argument snippets
    {
      "style": "educational",    // Educational approach with historical context
      "title": string,           // Short title (e.g., "Educational - Historical Context")
      "content": string          // 2-3 sentence response tailored to THIS SPECIFIC argument
    },
    {
      "style": "empathetic",     // Empathetic approach finding common ground
      "title": string,
      "content": string
    },
    {
      "style": "assertive",      // Direct, assertive challenge
      "title": string,
      "content": string
    },
    {
      "style": "scientific",     // Evidence-based, data-driven response
      "title": string,
      "content": string
    },
    {
      "style": "philosophical",  // Philosophical/ethical focus
      "title": string,
      "content": string
    }
  ]
}

**Important guidelines:**
- Be strict: only mark detected=true if the argument explicitly contains a fallacy
- If multiple fallacies are detected, return the one most central to the structure of the argument
- Prioritize the fallacy that underpins the overall reasoning, even if others are present
- Only fall back to highest-confidence if the central fallacy cannot be determined
- If no fallacy is detected, set detected=false, fallacyType=null, fallacyName=null, confidence=0, snippets=[]
- Use the exact fallacy IDs provided above (e.g., "appeal_to_tradition", "ad_hominem")
- **CRITICAL**: Generate snippets that are SPECIFIC to the user's argument, not generic templates
- Each snippet should directly address the specific wording and context of the argument provided`;
}

const SYSTEM_PROMPT = buildSystemPrompt();

/**
 * Fallback detection using keyword matching
 * Used when GPT fails or returns low confidence
 */
function performFallbackDetection(argumentText: string): {
  detected: boolean;
  fallacyType: string | null;
  fallacyName: string | null;
  confidence: number;
  explanation: string;
  keywords: string[];
  snippets: any[];
} {
  const lowerText = argumentText.toLowerCase();
  let bestMatch: {
    fallacy: typeof FALLACY_TYPES[0];
    matchedKeywords: string[];
    score: number;
  } | null = null;

  // Check each fallacy type
  for (const fallacy of FALLACY_TYPES) {
    const matchedKeywords = fallacy.keywords.filter(keyword =>
      lowerText.includes(keyword.toLowerCase())
    );

    if (matchedKeywords.length > 0) {
      const score = matchedKeywords.length / fallacy.keywords.length * 100;

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { fallacy, matchedKeywords, score };
      }
    }
  }

  // Return best match if score is high enough
  if (bestMatch && bestMatch.score > 10) {
    const confidence = Math.min(Math.floor(bestMatch.score * 0.8), 75);

    return {
      detected: true,
      fallacyType: bestMatch.fallacy.id,
      fallacyName: bestMatch.fallacy.name,
      confidence,
      explanation: `Detected based on keywords: ${bestMatch.matchedKeywords.join(', ')}`,
      keywords: bestMatch.matchedKeywords,
      snippets: [] // Fallback doesn't generate snippets - frontend should handle this
    };
  }

  // No fallacy detected
  return {
    detected: false,
    fallacyType: null,
    fallacyName: null,
    confidence: 0,
    explanation: "No logical fallacy detected in this argument.",
    keywords: [],
    snippets: []
  };
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const { argumentText } = await request.json();

    if (!argumentText || typeof argumentText !== "string") {
      return NextResponse.json(
        { error: "argumentText is required and must be a string" },
        { status: 400 }
      );
    }

    if (argumentText.length > 1000) {
      return NextResponse.json(
        { error: "argumentText must be less than 1000 characters" },
        { status: 400 }
      );
    }

    // Get Azure OpenAI configuration
    const config = await getAzureOpenAIConfig();

    // Initialize Azure OpenAI client
    const client = new AzureOpenAI({
      apiKey: config.apiKey,
      endpoint: config.endpoint,
      apiVersion: "2024-08-01-preview",
      deployment: config.deployment,
    });

    // Call GPT-5-mini for analysis
    // Note: GPT-5-mini only supports default temperature (1), so we don't specify it
    const response = await client.chat.completions.create({
      model: config.deployment,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Analyze this argument for logical fallacies:\n\n"${argumentText}"`,
        },
      ],
      max_completion_tokens: 2000, // Increased to accommodate snippet generation
      response_format: { type: "json_object" },
    });

    // Parse GPT response
    const gptContent = response.choices[0]?.message?.content;

    if (!gptContent) {
      throw new Error("No response from GPT");
    }

    let analysis = JSON.parse(gptContent);

    // Validate response structure
    if (
      typeof analysis.detected !== "boolean" ||
      typeof analysis.confidence !== "number"
    ) {
      throw new Error("Invalid response format from GPT");
    }

    // Validate fallacyType if detected
    if (analysis.detected && analysis.fallacyType) {
      if (!isValidFallacyType(analysis.fallacyType)) {
        console.warn(`Invalid fallacy type returned: ${analysis.fallacyType}. Using fallback detection.`);
        analysis = performFallbackDetection(argumentText);
      }
    }

    // If GPT failed to detect but we have high keyword matches, use fallback
    if (!analysis.detected || analysis.confidence < 30) {
      const fallback = performFallbackDetection(argumentText);
      if (fallback.detected && fallback.confidence > analysis.confidence) {
        analysis = fallback;
      }
    }

    // Return analysis result
    return NextResponse.json({
      detected: analysis.detected,
      fallacyType: analysis.fallacyType,
      fallacyName: analysis.fallacyName,
      confidence: analysis.confidence,
      explanation: analysis.explanation || "",
      keywords: analysis.keywords || [],
      snippets: analysis.snippets || [], // Include GPT-generated snippets
      model: config.deployment,
    });
  } catch (error) {
    console.error("Error in validate-fallacy endpoint:", error);

    return NextResponse.json(
      {
        error: "Failed to validate argument",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Enable CORS for Chrome Extension
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
