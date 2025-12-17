import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const USE_GEMINI = GEMINI_API_KEY;

export async function generateGameText(language) {
    const languageMap = {
        'Indonesia': 'Indonesian',
        'Inggris': 'English'
    };

    const targetLanguage = languageMap[language] || 'English';

    const prompt = `Generate a random, interesting fact or short story paragraph in ${targetLanguage} with approximately 30-40 words for a typing test. Plain text only, no formatting, no quotes.`;

    console.log(`🤖 Generating text in ${targetLanguage} using Gemini...`);

    if (USE_GEMINI) {
        return await generateWithGemini(prompt);
    } else if (OPENAI_API_KEY) {
        return await generateWithOpenAI(prompt);
    } else {
        throw new Error('No AI API key configured');
    }
}

async function generateWithGemini(prompt, retries = 2) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    for (let i = 0; i <= retries; i++) {
        try {
            const response = await axios.post(url, {
                contents: [{
                    parts: [{ text: prompt }]
                }]
            }, {
                timeout: 10000 // 10 second timeout
            });

            const text = response.data.candidates[0].content.parts[0].text;
            console.log(`✅ Gemini generated text: ${text.substring(0, 50)}...`);
            return text.trim();

        } catch (error) {
            console.error(`❌ Gemini API Error (attempt ${i + 1}/${retries + 1}):`, error.response?.data || error.message);

            if (i < retries && (error.response?.status === 503 || error.response?.status === 429)) {
                console.log(`⏳ Retrying in 1 second...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }
            throw error;
        }
    }
}

