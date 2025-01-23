import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.REACT_APP_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true
});

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

// Cache for translations
const translationCache = new Map();

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
                    maintaining academic terminology and professional tone. 
                    Keep the structure and formatting of the original text.
                    For Norwegian translations, use modern Bokmål.`
                },
                {
                    role: "user",
                    content: text
                }
            ],
            temperature: 0.3
        });

        return response.choices[0].message.content;
    } catch (error) {
        console.error('Translation error:', error);
        throw error;
    }
};

// Generate embedding for text
export const generateEmbedding = async (text, translateFirst = false) => {
    try {
        let norwegianText = text;
        let englishText = text;
        const isEnglish = isEnglishText(text);

        console.log('Input text language detection:', {
            isEnglish,
            textSample: text.slice(0, 100) + '...'
        });

        // Handle translations if needed
        if (isEnglish) {
            // If text is English, translate to Norwegian
            norwegianText = await translateText(text, 'nb');
            console.log('Translated to Norwegian');
        } else if (translateFirst) {
            // If text is Norwegian and translation is requested, translate to English
            englishText = await translateText(text, 'en');
            console.log('Translated to English');
        }

        // Add context about the task
        const contextualizeText = (inputText) => `Task: Compare academic course descriptions to find similarities in learning outcomes, content, and themes.

Course Information:
${inputText}

Consider:
- Learning outcomes and competencies
- Course content and themes
- Academic level and complexity
- Teaching methods and approach`;

        // Generate embeddings for both language versions
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

        console.log('Generated embeddings for both language versions:', {
            norwegianLength: norwegianEmbedding.data[0].embedding.length,
            englishLength: englishEmbedding.data[0].embedding.length
        });

        // Return both embeddings
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

export const generateOverlapExplanation = async (courseA, courseB, similarityScore) => {
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

Formater svaret slik, og bruk NØYAKTIG denne formateringen:

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

${courseA.literature || courseB.pensum ? `### PENSUM
• ${isSameCourse ? 'Kursets pensum og kilder' : 'Overlappende litteratur og kilder'}
${!isSameCourse ? `• Unike kilder i ${courseA.name}
• Unike kilder i ${courseB.kursnavn}` : ''}` : ''}

### ANBEFALING
▸ ${isSameCourse ? 'Dette er samme kurs, så det er ikke relevant å ta det flere ganger' : 'Er det hensiktsmessig å ta begge kursene?'}
${!isSameCourse ? `▸ Anbefalt rekkefølge (hvis relevant)
▸ Målgruppe og tilpasning` : ''}

Bruk kun punktlister (• og -) og piler (▸) som vist over.
Unngå bruk av stjerner (**) eller annen formatering.
Hold teksten konsis og fokusert på praktisk informasjon.
${isSameCourse ? 'Siden dette er samme kurs, fokuser på å beskrive kursets innhold og læringsutbytte, ikke på forskjeller.' : ''}`;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 1000
        });

        const explanation = response.choices[0].message.content.trim();
        console.log('Generated explanation:', explanation);
        return explanation;
    } catch (error) {
        console.error('Error generating overlap explanation:', error);
        throw error;
    }
}; 