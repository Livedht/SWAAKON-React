// Utility function to calculate cosine similarity between two vectors
export const cosineSimilarity = (vecA, vecB) => {
    try {
        if (!Array.isArray(vecA) || !Array.isArray(vecB)) {
            console.error('Invalid vectors:', { vecA, vecB });
            throw new Error('Invalid vectors provided to cosineSimilarity');
        }

        // Log first few values of each vector for debugging
        console.log('Vector samples:', {
            vecA: vecA.slice(0, 5),
            vecB: vecB.slice(0, 5)
        });

        const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
        const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
        const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

        console.log('Vector magnitudes:', { magnitudeA, magnitudeB, dotProduct });

        if (magnitudeA === 0 || magnitudeB === 0) {
            console.error('Zero magnitude vector detected:', { magnitudeA, magnitudeB });
            return 0;
        }

        const similarity = dotProduct / (magnitudeA * magnitudeB);
        console.log('Raw cosine similarity:', similarity);

        // Ensure similarity is within [-1, 1] range
        if (similarity < -1.0001 || similarity > 1.0001) {
            console.error('Invalid similarity value:', similarity);
            return 0;
        }

        // Clamp similarity to [-1, 1] range
        const clampedSimilarity = Math.max(-1, Math.min(1, similarity));

        // Convert from [-1,1] to [0,1] range
        const normalizedSimilarity = (clampedSimilarity + 1) / 2;
        console.log('Normalized similarity [0,1]:', normalizedSimilarity);

        // Apply a more aggressive scaling to differentiate similarities:
        // - Below 0.6 will result in very low scores
        // - 0.6-0.8 will give moderate scores
        // - Only very similar content (>0.8) will give high scores
        const scaledSimilarity = Math.pow(normalizedSimilarity, 2) * 100;

        // Apply additional scaling to spread out the scores
        let finalScore;
        if (scaledSimilarity < 40) {
            finalScore = scaledSimilarity * 0.5; // Reduce low similarities
        } else if (scaledSimilarity < 70) {
            finalScore = 20 + (scaledSimilarity - 40) * 0.8; // Moderate scaling
        } else {
            finalScore = 44 + (scaledSimilarity - 70) * 1.5; // Higher scaling for high similarities
        }

        console.log('Similarity calculation:', {
            rawSimilarity: similarity,
            normalizedSimilarity,
            scaledSimilarity,
            finalScore
        });

        return Math.round(Math.min(finalScore, 100) * 10) / 10; // Round to 1 decimal
    } catch (error) {
        console.error('Error in cosineSimilarity calculation:', error);
        return 0;
    }
};

// Calculate cosine similarity between two vectors
const calculateCosineSimilarity = (vectorA, vectorB) => {
    try {
        if (vectorA.length !== vectorB.length) {
            console.error('Embedding length mismatch:', { targetLength: vectorA.length, courseLength: vectorB.length });
            throw new Error('Vector dimensions do not match');
        }

        console.log('=== Starting similarity calculation ===');
        console.log('Vector A first 5 values:', vectorA.slice(0, 5));
        console.log('Vector B first 5 values:', vectorB.slice(0, 5));

        // Check if vectors are identical
        const areIdentical = vectorA.every((val, i) => Math.abs(val - vectorB[i]) < 0.000001);
        if (areIdentical) {
            console.log('Vectors are identical!');
            return 1;
        }

        const dotProduct = vectorA.reduce((sum, a, i) => sum + a * vectorB[i], 0);
        const magnitudeA = Math.sqrt(vectorA.reduce((sum, a) => sum + a * a, 0));
        const magnitudeB = Math.sqrt(vectorB.reduce((sum, b) => sum + b * b, 0));

        console.log('Vector properties:', {
            magnitudeA,
            magnitudeB,
            dotProduct,
            shouldBeNearOne: magnitudeA.toFixed(6),
            shouldAlsoBeNearOne: magnitudeB.toFixed(6)
        });

        if (magnitudeA === 0 || magnitudeB === 0) {
            console.error('Zero magnitude vector detected:', { magnitudeA, magnitudeB });
            return 0;
        }

        const similarity = dotProduct / (magnitudeA * magnitudeB);
        console.log('Raw similarity score:', similarity);
        console.log('=== Similarity calculation complete ===');

        return Math.max(-1, Math.min(1, similarity));
    } catch (error) {
        console.error('Error calculating similarity:', error);
        throw error;
    }
};

// Calculate final similarity score
export const calculateCourseSimilarity = (targetEmbedding, courseEmbedding, targetLanguage, courseLanguage) => {
    try {
        // Log dimensions before calculation
        console.log('Embedding dimensions:', {
            target: targetEmbedding.length,
            course: courseEmbedding.length,
            targetSample: targetEmbedding.slice(0, 5),
            courseSample: courseEmbedding.slice(0, 5)
        });

        if (!Array.isArray(targetEmbedding) || !Array.isArray(courseEmbedding)) {
            console.error('Invalid embeddings:', {
                targetIsArray: Array.isArray(targetEmbedding),
                courseIsArray: Array.isArray(courseEmbedding)
            });
            return 0;
        }

        if (targetEmbedding.length !== courseEmbedding.length) {
            console.error('Embedding dimension mismatch:', {
                targetLength: targetEmbedding.length,
                courseLength: courseEmbedding.length
            });
            return 0;
        }

        const rawSimilarity = calculateCosineSimilarity(targetEmbedding, courseEmbedding);

        // Convert from [-1, 1] to [0, 1]
        const normalizedSimilarity = (rawSimilarity + 1) / 2;

        // Apply a language boost if comparing across languages
        const isLanguageDifferent = targetLanguage && courseLanguage && targetLanguage !== courseLanguage;
        const languageBoost = isLanguageDifferent ? 0.35 : 0; // 35% boost for cross-language matches

        // First calculate base similarity score
        let baseScore;
        if (rawSimilarity > 0.96) {  // Nearly identical
            baseScore = 90 + (rawSimilarity - 0.96) * 250;  // Maps 0.96-1.0 to 90-100
        } else if (rawSimilarity > 0.92) {  // Very similar
            baseScore = 70 + (rawSimilarity - 0.92) * 500;  // Maps 0.92-0.96 to 70-90
        } else if (rawSimilarity > 0.85) {  // Moderately similar
            baseScore = 40 + (rawSimilarity - 0.85) * 428.57;  // Maps 0.85-0.92 to 40-70
        } else {  // Less similar
            baseScore = rawSimilarity * 47.06;  // Maps 0-0.85 to 0-40
        }

        // Apply language boost and additional scaling for cross-language matches
        let finalScore;
        if (isLanguageDifferent && rawSimilarity > 0.8) {
            // For high-similarity cross-language matches, apply a more aggressive boost
            finalScore = baseScore * (1 + languageBoost) * 1.2;
        } else {
            finalScore = baseScore * (1 + languageBoost);
        }

        // Ensure final score doesn't exceed 100
        finalScore = Math.min(100, finalScore);

        console.log('Similarity calculation:', {
            rawSimilarity,
            normalizedSimilarity,
            isLanguageDifferent,
            languageBoost,
            baseScore,
            finalScore
        });

        return Math.round(Math.min(finalScore, 100) * 10) / 10;
    } catch (error) {
        console.error('Error in calculateCourseSimilarity:', error);
        return 0;
    }
};

// Find similar courses from a list
export const findSimilarCourses = async (newCourseEmbedding, storedCourses) => {
    console.log(`Processing ${storedCourses.length} courses for similarity`);

    try {
        // Log the first few stored courses to verify data
        console.log('Sample of stored courses:',
            storedCourses.slice(0, 3).map(c => ({
                kurskode: c.kurskode,
                kursnavn: c.kursnavn,
                hasEmbedding: Boolean(c.embedding),
                embeddingLength: c.embedding ? c.embedding.length : 0,
                language: c.undv_språk || 'nb'  // Default to Norwegian if not specified
            }))
        );

        const similarities = storedCourses
            .map(course => {
                if (!course.embedding || !Array.isArray(course.embedding)) {
                    console.log(`Missing or invalid embedding for course: ${course.kurskode}`);
                    return null;
                }

                console.log(`\nProcessing course: ${course.kurskode} - ${course.kursnavn}`);
                console.log('Course language:', course.undv_språk || 'nb');

                // Determine course language
                const courseLanguage = course.undv_språk || 'nb';  // Default to Norwegian
                const targetLanguage = course.kurskode?.startsWith('EXC') ? 'en' : 'nb';  // Assume EXC courses are in English

                // Calculate similarity with language information
                const similarity = calculateCourseSimilarity(
                    newCourseEmbedding,
                    course.embedding,
                    targetLanguage,
                    courseLanguage
                );

                // Log similarity with language information
                console.log('Similarity calculation result:', {
                    kurskode: course.kurskode,
                    kursnavn: course.kursnavn,
                    targetLanguage,
                    courseLanguage,
                    similarity
                });

                return {
                    ...course,
                    similarity
                };
            })
            .filter(course => course !== null)
            .filter(course => {
                const passed = course.similarity >= 40;
                if (!passed) {
                    console.log(`Course ${course.kurskode} filtered out with similarity ${course.similarity}%`);
                }
                return passed;
            })
            .sort((a, b) => b.similarity - a.similarity);

        // Log similarity distribution
        const allSimilarities = similarities.map(c => c.similarity).sort((a, b) => b - a);
        console.log('\nSimilarity distribution:', {
            max: Math.max(...allSimilarities),
            min: Math.min(...allSimilarities),
            average: allSimilarities.reduce((a, b) => a + b, 0) / allSimilarities.length,
            count: allSimilarities.length,
            top10: allSimilarities.slice(0, 10)
        });

        return similarities;
    } catch (error) {
        console.error('Error in findSimilarCourses:', error);
        throw error;
    }
}; 