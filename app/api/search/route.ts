import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";
import OpenAI from "openai";

// Anti-hallucination guard: AI får bara prata om data som faktiskt finns
function guardAgainstHallucination(aiText: string, rows: any[]) {
  const rowString = JSON.stringify(rows);

  // 1. Blockera siffror som inte finns i datan
  const numbersInAI: string[] = aiText.match(/\d+(\.\d+)?/g) || [];
  const numbersInData: string[] = rowString.match(/\d+(\.\d+)?/g) || [];
  const unknownNumbers = numbersInAI.filter(n => !numbersInData.includes(n));
  if (unknownNumbers.length > 0) {
    return "AI kunde inte ge ett säkert svar utan att gissa. Endast data från BigQuery används.";
  }

  // 2. Blockera produkter som inte finns i datan
  const productNames = rows.map(r => r.product_name?.toLowerCase()).filter(Boolean);
  if (productNames.length > 0) {
    const aiWords = aiText.toLowerCase().split(/\W+/);
    const unknownProducts = aiWords.filter(w => w.length > 2 && !productNames.includes(w));
    if (unknownProducts.length > 5) {
      return "AI försökte nämna produkter som inte finns i datan. Svaret blockeras.";
    }
  }

  // 3. Blockera spekulationer
  if (
    aiText.includes("kan bero på") ||
    aiText.includes("troligen") ||
    aiText.includes("förmodligen")
  ) {
    return "AI får inte spekulera. Endast datadrivna insikter är tillåtna.";
  }

  return aiText;
}

export async function POST(req: Request) {
  const { query } = await req.json();

  const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // 1. AI tolkar frågan
  const interpretation = await ai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "Du är en data-analysmotor som tolkar frågor och bestämmer vilka tabeller som behövs."
      },
      {
        role: "user",
        content: `Fråga: ${query}. Vilka tabeller i BigQuery behövs?`
      }
    ]
  });

  const tables = interpretation.choices[0].message.content;

  // 2. Kör BigQuery baserat på AI:s val
  const sql = `
    SELECT *
    FROM \`project-cb954e13-3b16-432f-aa7.analytics_lab.product_performance_master\`
    LIMIT 200
  `;

  const [rows] = await bigquery.query({ query: sql });

  // 3. AI skriver en förklaring
  const explanation = await ai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "Du är en analytics-AI som förklarar data för en CEO."
      },
      {
        role: "user",
        content: `Data: ${JSON.stringify(rows)}. Fråga: ${query}. Skriv en kort förklaring.`
      }
    ]
  });

  const rawExplanation = explanation.choices[0].message.content ?? "";
  const safeExplanation = guardAgainstHallucination(rawExplanation, rows);

  return NextResponse.json({
    tables,
    data: rows,
    explanation: safeExplanation
  });
}
