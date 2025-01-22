import { createClient } from '@supabase/supabase-js';

// Make sure the URL includes the protocol
const supabaseUrl = 'https://eujzyvjnfcztlapsdybg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1anp5dmpuZmN6dGxhcHNkeWJnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxOTE0MTU5OCwiZXhwIjoyMDM0NzE3NTk4fQ.d0SYkqrEo6lsm08QLbjq0o2RWKsgrLY-4Q0TPKYLJKE';

console.log('Initializing Supabase client with URL:', supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false
    }
});

// Fetch all course data from original table
export const fetchAllCourses = async () => {
    try {
        console.log('Fetching all courses from Supabase');
        const { data, error } = await supabase
            .from('courses')
            .select('*');

        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }

        console.log('Sample course data structure:', data[0]);
        console.log(`Fetched ${data.length} courses`);
        return data;
    } catch (error) {
        console.error('Error fetching courses:', error);
        throw error;
    }
};

// Create new table for OpenAI embeddings
export const createOpenAIEmbeddingsTable = async () => {
    try {
        const { error } = await supabase
            .rpc('create_openai_embeddings_table');

        if (error) {
            console.error('Error creating table:', error);
            throw error;
        }
        console.log('Successfully created openai_embeddings table');
    } catch (error) {
        console.error('Error in createOpenAIEmbeddingsTable:', error);
        throw error;
    }
};

// Store course with OpenAI embedding
export const storeCourseWithEmbedding = async (courseData, embedding) => {
    try {
        const { error } = await supabase
            .from('openai_embeddings')
            .insert([{
                kurskode: courseData.kurskode,
                kursnavn: courseData.kursnavn,
                credits: courseData.credits,
                level_of_study: courseData.level_of_study,
                academic_coordinator: courseData.academic_coordinator,
                ansvarlig_institutt: courseData.ansvarlig_institutt,
                ansvarlig_område: courseData.ansvarlig_område,
                undv_språk: courseData.undv_språk,
                portfolio: courseData.portfolio,
                learning_outcome_knowledge: courseData.learning_outcome_knowledge,
                learning_outcome_skills: courseData.learning_outcome_skills,
                learning_outcome_general_competence: courseData.learning_outcome_general_competence,
                course_content: courseData.course_content,
                embedding: embedding
            }]);

        if (error) {
            console.error('Error storing course with embedding:', error);
            throw error;
        }
        console.log(`Successfully stored course ${courseData.kurskode} with OpenAI embedding`);
    } catch (error) {
        console.error(`Error storing course ${courseData.kurskode}:`, error);
        throw error;
    }
};

// Fetch courses with OpenAI embeddings
export const fetchOpenAIEmbeddings = async () => {
    try {
        console.log('Fetching courses with OpenAI embeddings');
        const { data, error } = await supabase
            .from('openai_embeddings')
            .select('*');

        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }

        const processedCourses = data.map(course => ({
            ...course,
            embedding: typeof course.embedding === 'string' ?
                JSON.parse(course.embedding) : course.embedding
        }));

        console.log(`Fetched ${processedCourses.length} courses with OpenAI embeddings`);
        return processedCourses;
    } catch (error) {
        console.error('Error fetching OpenAI embeddings:', error);
        throw error;
    }
};

export const fetchStoredEmbeddings = async () => {
    try {
        console.log('Fetching stored embeddings from Supabase');
        const { data, error } = await supabase
            .from('openai_embeddings')
            .select('*');

        if (error) {
            console.error('Supabase error:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            throw error;
        }

        console.log('Raw data from Supabase:', {
            totalCourses: data.length,
            sampleCourse: data[0] ? {
                kurskode: data[0].kurskode,
                embeddingType: typeof data[0].embedding,
                hasEmbedding: Boolean(data[0].embedding)
            } : 'No courses found'
        });

        // Process the embeddings
        const processedCourses = data.map(course => {
            // Handle the embedding field
            let processedEmbedding;
            if (course.embedding) {
                if (Array.isArray(course.embedding)) {
                    processedEmbedding = course.embedding;
                    console.log(`Course ${course.kurskode}: Embedding is already an array of length ${course.embedding.length}`);
                } else if (typeof course.embedding === 'string') {
                    try {
                        processedEmbedding = JSON.parse(course.embedding);
                        console.log(`Course ${course.kurskode}: Successfully parsed string embedding to array of length ${processedEmbedding.length}`);
                    } catch (e) {
                        console.error(`Error parsing embedding for course ${course.kurskode}:`, e);
                        return null;
                    }
                } else {
                    console.error(`Unknown embedding format for course ${course.kurskode}:`, {
                        type: typeof course.embedding,
                        value: course.embedding
                    });
                    return null;
                }
            } else {
                console.error(`No embedding found for course ${course.kurskode}`);
                return null;
            }

            // Verify embedding is valid
            if (!Array.isArray(processedEmbedding) || processedEmbedding.length !== 2000) {
                console.error(`Invalid embedding for course ${course.kurskode}:`, {
                    isArray: Array.isArray(processedEmbedding),
                    length: processedEmbedding ? processedEmbedding.length : 0,
                    expectedLength: 2000
                });
                return null;
            }

            return {
                ...course,
                embedding: processedEmbedding
            };
        }).filter(course => course !== null);

        // Log summary of processed courses
        console.log('Embedding processing summary:', {
            totalCoursesBeforeProcessing: data.length,
            validCoursesAfterProcessing: processedCourses.length,
            firstValidEmbedding: processedCourses[0] ? {
                kurskode: processedCourses[0].kurskode,
                embeddingLength: processedCourses[0].embedding.length,
                firstFewValues: processedCourses[0].embedding.slice(0, 5)
            } : 'No valid embeddings'
        });

        return processedCourses;
    } catch (error) {
        console.error('Detailed error in fetchStoredEmbeddings:', {
            message: error.message,
            stack: error.stack
        });
        throw error;
    }
};

export const updateCourseEmbedding = async (courseCode, embedding) => {
    try {
        console.log('Updating embedding for course:', courseCode);
        const { error } = await supabase
            .from('courses')
            .update({ embedding })
            .eq('kurskode', courseCode);

        if (error) {
            console.error('Supabase error:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            throw error;
        }

        console.log('Successfully updated embedding');
    } catch (error) {
        console.error('Detailed error in updateCourseEmbedding:', {
            message: error.message,
            stack: error.stack
        });
        throw error;
    }
}; 