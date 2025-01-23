import OpenAI from 'openai';
import { supabase } from './supabase';

const openai = new OpenAI({
    apiKey: process.env.REACT_APP_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true
});

// Legg til disse konstantene øverst i filen
const COST_PER_1K_TOKENS = {
    'gpt-3.5-turbo-0125': {  // Nyeste og billigste versjonen
        input: 0.0001,   // $0.0001 / 1K tokens
        output: 0.0002   // $0.0002 / 1K tokens
    },
    'text-embedding-3-large': {
        input: 0.00013,
        output: 0.00013
    }
};

// Cache for translations
const translationCache = new Map();
const analysisCache = new Map();

// Funksjon for å logge API-kostnader
const logApiCost = async (endpoint, model, inputTokens, outputTokens = 0) => {
    try {
        const inputCost = (inputTokens / 1000) * COST_PER_1K_TOKENS[model].input;
        const outputCost = (outputTokens / 1000) * COST_PER_1K_TOKENS[model].output;
        const totalCost = inputCost + outputCost;
        
        // Hent gjeldende bruker
        const { data: { user } } = await supabase.auth.getUser();
        
        console.log('Logging API cost:', {
            endpoint,
            model,
            inputTokens,
            outputTokens,
            totalCost,
            user: user?.email
        });

        const { data, error } = await supabase
            .from('api_costs')
            .insert([{
                endpoint,
                model,
                tokens_used: inputTokens + outputTokens,
                cost_usd: totalCost,
                user_id: user?.id,
                user_email: user?.email
            }])
            .select();

        if (error) {
            console.error('Error inserting API cost:', error);
            throw error;
        }

        console.log('Successfully logged API cost:', data);
        return data;
    } catch (error) {
        console.error('Error in logApiCost:', error);
    }
};

// Normalize the embedding vector to unit length
const normalizeVector = (vector) => {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return vector.map(val => val / magnitude);
};

// Clean and format text for validation
const cleanTextForValidation = (text) => {
    // Remove bullet points and other special characters but keep the text
    return text
        .replace(/[•·⋅‣⁃◦∙]/g, '') // Remove bullet points
        .replace(/[\n\r]+/g, ' ') // Replace newlines with spaces
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .trim();
};

// Validate text input
const isValidInput = (text) => {
    // First, let's clean the text for validation
    const cleanedText = cleanTextForValidation(text);

    // Split into words, filtering out empty strings
    const words = cleanedText.split(/\s+/).filter(word => word.length > 0);

    console.log('Validation stats:', {
        originalLength: text.length,
        cleanedLength: cleanedText.length,
        wordCount: words.length,
        sampleWords: words.slice(0, 5)
    });

    // Check word count
    if (words.length < 10) {
        console.log('Text too short, needs at least 10 words. Word count:', words.length);
        return false;
    }

    if (words.length > 2000) {
        console.log('Text too long, exceeds 2000 words');
        return false;
    }

    // Check for meaningful content
    const meaningfulWords = words.filter(word => word.length >= 2);
    const meaningfulRatio = meaningfulWords.length / words.length;

    if (meaningfulRatio < 0.5) {
        console.log('Too many short or meaningless words. Meaningful ratio:', meaningfulRatio);
        return false;
    }

    // Check character distribution
    const letterCount = cleanedText.replace(/[^a-zA-ZæøåÆØÅ]/g, '').length;
    const totalLength = cleanedText.length;
    const letterRatio = letterCount / totalLength;

    if (letterRatio < 0.3) {  // Reduced from 0.4 to 0.3 to accommodate more special characters
        console.log('Too few letters in text. Letter ratio:', letterRatio);
        return false;
    }

    return true;
};

// Simple hash function for text
const hashText = (text) => {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash;
};

// Function to detect if text is in English
const isEnglishText = (text) => {
    // Check for absence of Norwegian characters
    const hasNorwegianChars = /[æøåÆØÅ]/.test(text);
    if (hasNorwegianChars) return false;

    // Common English words that don't exist in Norwegian
    const englishWords = /\b(the|and|is|are|was|were|this|that|these|those|with|for)\b/i;
    return englishWords.test(text);
};

// Function to translate text between Norwegian and English
const translateText = async (text, targetLanguage) => {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: [
                {
                    role: "system",
                    content: `You are a professional translator specializing in academic and technical content. 
                    Translate the following text to ${targetLanguage === 'en' ? 'English' : 'Norwegian (Bokmål)'}, 
                    maintaining academic terminology and professional tone.`
                },
                {
                    role: "user",
                    content: text
                }
            ],
            temperature: 0.3
        });

        await logApiCost(
            'translation',
            'gpt-4-turbo-preview',
            response.usage.prompt_tokens,
            response.usage.completion_tokens
        );

        return response.choices[0].message.content;
    } catch (error) {
        console.error('Translation error:', error);
        throw error;
    }
};

// Legg til export for generateEmbedding
export const generateEmbedding = async (text, translateFirst = false) => {
    try {
        let norwegianText = text;
        let englishText = text;
        const isEnglish = isEnglishText(text);

        if (isEnglish) {
            norwegianText = await translateText(text, 'nb');
        } else if (translateFirst) {
            englishText = await translateText(text, 'en');
        }

        const contextualizeText = (inputText) => `Task: Compare academic course descriptions to find similarities in learning outcomes, content, and themes.

Course Information:
${inputText}

Consider:
- Learning outcomes and competencies
- Course content and themes
- Academic level and complexity
- Teaching methods and approach`;

        const [norwegianEmbedding, englishEmbedding] = await Promise.all([
            openai.embeddings.create({
                model: "text-embedding-3-large",
                input: contextualizeText(norwegianText),
                encoding_format: "float",
                dimensions: 2000
            }),
            openai.embeddings.create({
                model: "text-embedding-3-large",
                input: contextualizeText(englishText),
                encoding_format: "float",
                dimensions: 2000
            })
        ]);

        await logApiCost(
            'embeddings',
            'text-embedding-3-large',
            norwegianEmbedding.usage.total_tokens
        );
        await logApiCost(
            'embeddings',
            'text-embedding-3-large',
            englishEmbedding.usage.total_tokens
        );

        return {
            norwegian: norwegianEmbedding.data[0].embedding,
            english: englishEmbedding.data[0].embedding,
            isEnglishInput: isEnglish
        };
    } catch (error) {
        console.error('Error generating embeddings:', error);
        throw error;
    }
};

// Legg til export for generateOverlapExplanation
export const generateOverlapExplanation = async (courseA, courseB, similarityScore) => {
    const cacheKey = `${courseA.name}-${courseB.kurskode}`;
    
    if (analysisCache.has(cacheKey)) {
        return analysisCache.get(cacheKey);
    }
    
    const isSameCourse = courseA.name === courseB.kursnavn ||
        (courseA.code && courseA.code === courseB.kurskode);

    const prompt = `
Du er en akademisk rådgiver som skal forklare overlapp mellom to kurs. 
${isSameCourse ? 'Dette er samme kurs som sammenlignes med seg selv.' : ''}
Generer en strukturert forklaring på norsk (maks 250 ord) som sammenligner disse kursene:

Kurs A: ${courseA.name}
${courseA.content}
${courseA.literature ? `Pensum: ${courseA.literature}` : ''}

Kurs B: ${courseB.kursnavn} (${courseB.kurskode})
${courseB.description || courseB.course_content || 'Ingen beskrivelse tilgjengelig'}
${courseB.pensum ? `Pensum: ${courseB.pensum}` : ''}

Similaritet: ${similarityScore}%

Formater svaret slik:

### KURSSAMMENLIGNING
▸ ${isSameCourse ? 'Dette er samme kurs sammenlignet med seg selv' : 'Kort introduksjon av begge kursene'}
▸ Overordnet vurdering av overlapp (${similarityScore}% likhet)

### HOVEDFOKUS
• Sentrale temaer og konsepter${isSameCourse ? ' i kurset' : ' som overlapper'}
${!isSameCourse ? `• Unike aspekter i ${courseA.name}
• Unike aspekter i ${courseB.kursnavn}` : ''}

### LÆRINGSUTBYTTE
• Sentrale kompetanser${isSameCourse ? ' som kurset gir' : ' som overlapper'}:
  - [Liste med kompetanser]
${!isSameCourse ? `• Unike kompetanser i ${courseA.name}:
  - [Liste med unike ferdigheter]
• Unike kompetanser i ${courseB.kursnavn}:
  - [Liste med unike ferdigheter]` : ''}

### ANBEFALING
▸ ${isSameCourse ? 'Dette er samme kurs, så det er ikke relevant å ta det flere ganger' : 'Er det hensiktsmessig å ta begge kursene?'}
${!isSameCourse ? `▸ Anbefalt rekkefølge (hvis relevant)
▸ Målgruppe og tilpasning` : ''}`;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo-0125",  // Nyeste og billigste versjonen
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 1000
        });

        await logApiCost(
            'explanations',
            'gpt-3.5-turbo-0125',
            response.usage.prompt_tokens,
            response.usage.completion_tokens
        );

        const explanation = response.choices[0].message.content.trim();
        analysisCache.set(cacheKey, explanation);
        return explanation;
    } catch (error) {
        console.error('Error generating overlap explanation:', error);
        throw error;
    }
};