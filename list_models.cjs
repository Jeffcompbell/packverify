const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
let apiKey = '';
if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    const match = content.match(/VITE_OPENAI_API_KEY=(.*)/);
    if (match) {
        apiKey = match[1].trim();
    }
}

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
