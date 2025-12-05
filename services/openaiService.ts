import OpenAI from 'openai';
import { DiagnosisIssue, DiffResult, SourceField } from "../types";

// Helper to convert file to base64
export const fileToGenerativePart = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            // Remove data url prefix (e.g. "data:image/jpeg;base64,")
            const base64 = base64String.split(",")[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const getClient = () => {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
        console.error("API Key not found. Please set VITE_OPENAI_API_KEY");
        // We don't throw here to allow mock fallback in the catch blocks
    }
    return new OpenAI({
        apiKey: apiKey || 'dummy', // Prevent crash if key missing, will fail on request
        baseURL: "https://zenmux.ai/api/v1",
        dangerouslyAllowBrowser: true // Required for client-side usage
    });
};

export const diagnoseImage = async (base64Image: string, mimeType: string): Promise<DiagnosisIssue[]> => {
    try {
        const client = getClient();
        const modelId = "gpt-4o";

        const prompt = `
      Role: Senior Pre-press Specialist and Packaging QC Expert.
      Task: Perform a rigorous 8-point "Pre-flight Check" on this packaging design image.
      
      You must inspect these 8 specific categories:
      1. File Settings: Layout issues, visual hierarchy, potential layer errors.
      2. Font/Copyright: Identify text that looks like system fonts (Arial/SimSun) which might be un-outlined, or very small text (<5pt) that may not print well.
      3. Image Quality: Look for pixelation, low-res bitmaps, or watermark artifacts indicating missing embeddings.
      4. Color Settings: CRITICAL - Identify small black text that might be "Rich Black" (CMYK) instead of "Single Black" (K100). This causes registration issues. 
      5. Bleed/Margins: Check if text/logos are too close to the edge (Safe Zone violations) or if bleed area seems missing.
      6. Content/Proofreading: Check for typos, homophones (e.g. 这里的 vs 这理的), missing spaces, or basic information errors.
      7. Annotations: Are die-lines (cut lines), fold lines, or dimensions visible? Are they clearly marked?
      8. Format: General output format issues.

      Return a JSON array of issues.
      Map 'type' to one of: 'file_setting', 'font', 'image_quality', 'color', 'bleed', 'content', 'annotation', 'format', 'compliance'.
      
      For 'box_2d', estimate the bounding box [ymin, xmin, ymax, xmax] on a 0-1000 scale.
      
      Output JSON format:
      {
        "issues": [
          { "type": "color", "text": "Ingredients Text", "suggestion": "Potential Rich Black detected...", "severity": "high", "box_2d": [400, 100, 450, 300] }
        ]
      }
    `;

        const response = await client.chat.completions.create({
            model: modelId,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${mimeType};base64,${base64Image}`,
                                detail: "high"
                            }
                        }
                    ]
                }
            ],
            response_format: { type: "json_object" }
        });

        const text = response.choices[0].message.content;
        if (!text) return [];

        const parsed = JSON.parse(text);
        const data = parsed.issues || parsed; // Handle if AI returns array directly or wrapped object

        if (!Array.isArray(data)) return [];

        return data.map((item: any, idx: number) => ({
            ...item,
            id: `diag-${idx}-${Date.now()}`,
            box_2d: item.box_2d && item.box_2d.length === 4 ? {
                ymin: item.box_2d[0],
                xmin: item.box_2d[1],
                ymax: item.box_2d[2],
                xmax: item.box_2d[3]
            } : undefined
        }));
    } catch (error) {
        console.error("Diagnosis failed:", error);
        throw error; // Re-throw to let UI handle it
    }
};

export const parseSourceText = async (sourceText: string): Promise<SourceField[]> => {
    try {
        const client = getClient();
        const modelId = "gpt-4o";

        const prompt = `
      Task: Parse the following packaging source text into structured Key-Value pairs.
      Identify categories: 'content' (marketing copy), 'compliance' (ingredients, warnings), 'specs' (weight, size).
      
      Input Text:
      "${sourceText.substring(0, 5000)}"
      
      Return JSON object with a key 'fields' containing an array of objects with keys: key, value, category.
    `;

        const response = await client.chat.completions.create({
            model: modelId,
            messages: [
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
        });

        const text = response.choices[0].message.content;
        if (!text) return [];
        const parsed = JSON.parse(text);
        return parsed.fields || [];

    } catch (error) {
        console.error("Parsing failed:", error);
        throw error;
    }
};

export const performSmartDiff = async (
    base64Image: string,
    sourceFields: SourceField[]
): Promise<DiffResult[]> => {
    try {
        const client = getClient();
        const modelId = "gpt-4o";

        const sourceJson = JSON.stringify(sourceFields);

        const prompt = `
      Task: Compare the text visible in the packaging image against the provided Source Data.
      
      Source Data: ${sourceJson}
      
      Rules:
      1. Strict Match: Ingredients, Barcodes (Must be exact).
      2. Semantic Match: Descriptions, Warnings (Meaning must match).
      3. Logic Match: Net Weight (e.g. 0.5kg matches 500g).
      
      For each field in Source Data, determine if it exists on the image and if it matches.
      If 'error', explain why. 
      Estimate the location box_2d [ymin, xmin, ymax, xmax] (0-1000) of the text on the image.

      Output JSON format:
      {
        "diffs": [
          { "field": "Product Name", "sourceValue": "...", "imageValue": "...", "status": "match", "matchType": "strict", "box_2d": [...] }
        ]
      }
    `;

        const response = await client.chat.completions.create({
            model: modelId,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`,
                                detail: "high"
                            }
                        }
                    ]
                }
            ],
            response_format: { type: "json_object" }
        });

        const text = response.choices[0].message.content;
        if (!text) return [];

        const parsed = JSON.parse(text);
        const data = parsed.diffs || parsed;

        if (!Array.isArray(data)) return [];

        return data.map((item: any, idx: number) => ({
            ...item,
            id: `diff-${idx}-${Date.now()}`,
            box_2d: item.box_2d && item.box_2d.length === 4 ? {
                ymin: item.box_2d[0],
                xmin: item.box_2d[1],
                ymax: item.box_2d[2],
                xmax: item.box_2d[3]
            } : undefined
        }));

    } catch (error) {
        console.error("Diff failed", error);
        throw error;
    }
};
