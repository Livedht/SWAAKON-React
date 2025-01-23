import { fetchAllCourses, storeCourseWithEmbedding } from '../services/supabase';
import { generateEmbedding } from '../services/openai';

const generateCourseText = (course) => `
    Course Name: ${course.kursnavn}
    Knowledge Outcomes: ${course.learning_outcome_knowledge || ''}
    Skills Outcomes: ${course.learning_outcome_skills || ''}
    General Competence: ${course.learning_outcome_general_competence || ''}
    Course Content: ${course.course_content || ''}
`.trim();

const migrateEmbeddings = async () => {
    try {
        console.log('Starting embedding migration...');

        // 1. Fetch all courses
        const courses = await fetchAllCourses();
        console.log(`Found ${courses.length} courses to process`);

        // 2. Process each course
        for (let i = 0; i < courses.length; i++) {
            const course = courses[i];
            console.log(`Processing course ${i + 1}/${courses.length}: ${course.kurskode}`);

            try {
                // Generate course text for embedding
                const courseText = generateCourseText(course);

                // Generate OpenAI embedding
                const embedding = await generateEmbedding(courseText);

                // Store course with new embedding
                await storeCourseWithEmbedding(course, embedding);

                console.log(`Successfully processed ${course.kurskode}`);

                // Add a small delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
                console.error(`Error processing course ${course.kurskode}:`, error);
                // Continue with next course even if one fails
                continue;
            }
        }

        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
    }
};

// Run the migration
migrateEmbeddings(); 