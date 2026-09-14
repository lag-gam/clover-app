import { GARMENT_ANALYSIS_PROMPT, GARMENT_EMBEDDING_PROMPT } from "@/constants/prompts";

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY!;
const VISION_MODEL = "gpt-4o";
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 256;

interface GarmentMetadata {
  name: string;
  category: string;
  color: string;
  secondary_color: string | null;
  pattern: string;
  material: string;
  fit: string;
  formality: number;
  tags: string[];
}

export async function extractGarmentMetadata(
  base64Image: string
): Promise<GarmentMetadata> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: GARMENT_ANALYSIS_PROMPT },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "low",
              },
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI Vision API error: ${err}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  // Parse JSON from response (handle markdown code blocks)
  const jsonStr = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  return JSON.parse(jsonStr) as GarmentMetadata;
}

export async function generateEmbedding(
  metadata: GarmentMetadata
): Promise<number[]> {
  const text = GARMENT_EMBEDDING_PROMPT(metadata);

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI Embeddings API error: ${err}`);
  }

  const data = await response.json();
  return data.data[0].embedding as number[];
}
