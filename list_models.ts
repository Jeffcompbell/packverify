import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local manually since we are running this script directly
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const apiKey = process.env.VITE_OPENAI_API_KEY;
const baseURL = "https://zenmux.ai/api/v1";

console.log("Checking models with:");
console.log("API Key:", apiKey ? "FOUND (" + apiKey.length + " chars)" : "MISSING");
console.log("Base URL:", baseURL);

if (!apiKey) {
    console.error("Please set VITE_OPENAI_API_KEY in .env.local");
    process.exit(1);
}

const client = new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL,
});

async function listModels() {
    try {
        const list = await client.models.list();
        console.log("\nAvailable Models:");
        list.data.forEach(model => console.log(`- ${model.id}`));
    } catch (error) {
        console.error("Failed to list models:", error);
    }
}

listModels();
