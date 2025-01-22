import React, { useState, useEffect } from 'react';
import { fetchStoredEmbeddings } from '../services/supabase';
import { generateEmbedding, generateOverlapExplanation } from '../services/openai';
import { findSimilarCourses } from '../services/similarity';
import {
    Box,
    Button,
    CircularProgress,
    Container,
    TextField,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Link,
    Tooltip,
    IconButton,
    TablePagination,
    Alert,
    InputAdornment,
    Collapse,
    Grid,
} from '@mui/material';
import styled from '@emotion/styled';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import InfoIcon from '@mui/icons-material/Info';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';
import { alpha } from '@mui/material/styles';

const MIN_INPUT_LENGTH = 10;
const MAX_INPUT_LENGTH = 5000;

const validateInput = (text) => {
    if (!text || typeof text !== 'string') return false;
    const cleaned = text.trim();
    return cleaned.length >= MIN_INPUT_LENGTH && cleaned.length <= MAX_INPUT_LENGTH;
};

// Styled components
const StyledCard = styled(Paper)(({ theme }) => ({
    borderRadius: '16px',
    padding: theme.spacing(3),
    background: theme.palette.mode === 'dark'
        ? 'linear-gradient(145deg, #1e1e1e, #2d2d2d)'
        : 'linear-gradient(145deg, #ffffff, #f5f5f5)',
    boxShadow: theme.palette.mode === 'dark'
        ? '0 8px 32px rgba(0, 0, 0, 0.3)'
        : '0 8px 32px rgba(0, 0, 0, 0.08)',
    transition: 'transform 0.2s ease',
    '&:hover': {
        transform: 'translateY(-2px)'
    }
}));

const AnimatedButton = styled(Button)(({ theme }) => ({
    borderRadius: '12px',
    padding: '12px 24px',
    transition: 'all 0.2s ease',
    fontWeight: 600,
    textTransform: 'none',
    '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
    }
}));

const StyledTableCell = styled(TableCell)(({ theme }) => ({
    '&.MuiTableCell-head': {
        backgroundColor: 'transparent',
        color: theme.palette.text.primary,
        fontWeight: 600,
        fontSize: '0.95rem',
        borderBottom: `2px solid ${alpha(theme.palette.primary.main, 0.1)}`
    },
    '&.MuiTableCell-body': {
        fontSize: '0.9rem',
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`
    }
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
    transition: 'all 0.2s ease',
    '&:hover': {
        backgroundColor: alpha(theme.palette.primary.main, 0.05),
        '& .row-explanation': {
            opacity: 1,
            height: 'auto',
            padding: theme.spacing(2)
        }
    }
}));

const ExplanationButton = styled(IconButton)(({ theme }) => ({
    transition: 'all 0.2s ease',
    backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.1),
    '&:hover': {
        backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.3 : 0.2),
        transform: 'scale(1.1)'
    },
    '&.Mui-disabled': {
        backgroundColor: alpha(theme.palette.action.disabled, theme.palette.mode === 'dark' ? 0.2 : 0.1)
    }
}));

const RowExplanation = styled(Box)(({ theme }) => ({
    opacity: 0,
    height: 0,
    overflow: 'hidden',
    transition: 'all 0.3s ease',
    backgroundColor: alpha(
        theme.palette.primary.main,
        theme.palette.mode === 'dark' ? 0.15 : 0.05
    ),
    borderRadius: theme.spacing(1),
    margin: theme.spacing(1, 3),
    padding: 0,
    '&.visible': {
        opacity: 1,
        height: 'auto',
        padding: theme.spacing(2)
    }
}));

const SimilarityBadge = styled(Box)(({ theme, similarity }) => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 12px',
    borderRadius: '20px',
    fontWeight: 600,
    fontSize: '0.85rem',
    backgroundColor: similarity >= 70
        ? alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.2 : 0.1)
        : similarity >= 50
            ? alpha(theme.palette.warning.main, theme.palette.mode === 'dark' ? 0.2 : 0.1)
            : alpha(theme.palette.error.main, theme.palette.mode === 'dark' ? 0.2 : 0.1),
    color: theme.palette.mode === 'dark'
        ? similarity >= 70
            ? theme.palette.success.light
            : similarity >= 50
                ? theme.palette.warning.light
                : theme.palette.error.light
        : similarity >= 70
            ? theme.palette.success.dark
            : similarity >= 50
                ? theme.palette.warning.dark
                : theme.palette.error.dark
}));

const FilterChip = styled(Box)(({ theme, active }) => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 16px',
    borderRadius: '20px',
    fontSize: '0.9rem',
    cursor: 'pointer',
    backgroundColor: active
        ? theme.palette.primary.main
        : theme.palette.mode === 'dark' ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
    color: active
        ? theme.palette.mode === 'dark' ? theme.palette.common.black : theme.palette.common.white
        : theme.palette.text.primary,
    border: `1px solid ${active ? theme.palette.primary.main : theme.palette.divider}`,
    transition: 'all 0.2s ease',
    '&:hover': {
        backgroundColor: active
            ? theme.palette.primary.dark
            : alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.05)
    }
}));

const CourseComparison = () => {
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);
    const [loadingExplanations, setLoadingExplanations] = useState({});
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [showForm, setShowForm] = useState(true);
    const [formData, setFormData] = useState({
        courseName: '',
        courseDescription: '',
        courseLiterature: ''
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [expandedExplanations, setExpandedExplanations] = useState({});
    const [filters, setFilters] = useState({
        level: '',
        portfolio: '',
        credits: '',
        instructor: '',
        course: '',
    });

    // Handle page change
    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    // Handle rows per page change
    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleGenerateExplanation = async (course, courseText) => {
        console.log('Starting explanation generation for:', {
            courseCode: course.kurskode,
            inputData: {
                name: formData.courseName,
                content: courseText,
            },
            similarity: course.similarity
        });

        setLoadingExplanations(prev => ({ ...prev, [course.kurskode]: true }));

        try {
            console.log('Calling generateOverlapExplanation with:', {
                inputCourse: {
                    name: formData.courseName,
                    content: courseText,
                },
                storedCourse: course,
                similarity: course.similarity
            });

            const explanation = await generateOverlapExplanation(
                {
                    name: formData.courseName,
                    content: courseText,
                },
                course,
                course.similarity
            );

            console.log('Received explanation:', explanation);

            if (!explanation) {
                throw new Error('No explanation was generated');
            }

            setResults(prevResults =>
                prevResults.map(r =>
                    r.kurskode === course.kurskode
                        ? { ...r, explanation }
                        : r
                )
            );
        } catch (err) {
            console.error('Error generating explanation:', err);
            setError(`Failed to generate explanation for ${course.kurskode}: ${err.message}`);
        } finally {
            // Always clear loading state, whether successful or not
            setLoadingExplanations(prev => ({ ...prev, [course.kurskode]: false }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setResults(null);
        setLoadingExplanations({});

        try {
            // Validate inputs
            if (!validateInput(formData.courseName)) {
                throw new Error('Course name must be between 10 and 5000 characters');
            }
            if (!validateInput(formData.courseDescription)) {
                throw new Error('Course description must be between 10 and 5000 characters');
            }
            if (formData.courseLiterature && !validateInput(formData.courseLiterature)) {
                throw new Error('Course literature must be between 10 and 5000 characters if provided');
            }

            // Combine course information for embedding
            const courseText = `
                Course Name: ${formData.courseName.trim()}
                Course Description: ${formData.courseDescription.trim()}
                ${formData.courseLiterature ? `Course Literature: ${formData.courseLiterature.trim()}` : ''}
            `.trim();

            console.log('Starting course analysis with text length:', courseText.length);

            // Generate embeddings for both Norwegian and English versions
            const embeddings = await generateEmbedding(courseText);
            console.log('Generated embeddings:', {
                norwegianLength: embeddings.norwegian.length,
                englishLength: embeddings.english.length
            });

            // Fetch stored courses
            const storedCourses = await fetchStoredEmbeddings();
            if (!storedCourses || storedCourses.length === 0) {
                throw new Error('No stored courses found to compare against');
            }
            console.log(`Fetched ${storedCourses.length} stored courses`);

            // Find similar courses using the Norwegian embedding since our stored courses are in Norwegian
            const similarCourses = await findSimilarCourses(embeddings.norwegian, storedCourses);
            console.log(`Found ${similarCourses.length} similar courses`);

            if (similarCourses.length === 0) {
                setResults([]);
                setError('No similar courses found. Try providing more detailed course information.');
                return;
            }

            // Set results without explanations
            setResults(similarCourses.map(course => ({
                ...course,
                explanation: null
            })));

        } catch (err) {
            console.error('Error in course analysis:', err);
            setError('Failed to analyze course overlap: ' + (err.message || 'Unknown error'));
            setResults(null);
        } finally {
            setLoading(false);
        }
    };

    const getFilteredResults = () => {
        if (!results) return [];

        return results.filter(course => {
            const matchesSearch = searchTerm === '' ||
                course.kurskode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                course.kursnavn.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesLevel = filters.level === '' || course.level_of_study === filters.level;
            const matchesPortfolio = filters.portfolio === '' ||
                (filters.portfolio === 'yes' && course.portfolio) ||
                (filters.portfolio === 'no' && !course.portfolio);
            const matchesCredits = filters.credits === '' || course.credits === Number(filters.credits);
            const matchesInstructor = filters.instructor === '' ||
                course.academic_coordinator?.toLowerCase().includes(filters.instructor.toLowerCase());
            const matchesCourse = filters.course === '' ||
                course.kurskode.toLowerCase().includes(filters.course.toLowerCase()) ||
                course.kursnavn.toLowerCase().includes(filters.course.toLowerCase());

            return matchesSearch && matchesLevel && matchesPortfolio &&
                matchesCredits && matchesInstructor && matchesCourse;
        });
    };

    // Add toggle function
    const toggleForm = () => {
        setShowForm(!showForm);
    };

    const toggleExplanation = (course) => {
        if (course.explanation) {
            // If explanation exists, just toggle visibility
            setExpandedExplanations(prev => ({
                ...prev,
                [course.kurskode]: !prev[course.kurskode]
            }));
        } else {
            // If no explanation exists, generate one
            handleGenerateExplanation(course, formData.courseDescription);
            setExpandedExplanations(prev => ({
                ...prev,
                [course.kurskode]: true
            }));
        }
    };

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            {/* Hero Section */}
            <Box sx={{
                textAlign: 'center',
                mb: 4,
                background: theme => theme.palette.mode === 'dark'
                    ? 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
                    : 'linear-gradient(135deg, #f6f9fe 0%, #f1f4f9 100%)',
                borderRadius: '24px',
                p: 3
            }}>
                <AnimatedButton
                    variant="contained"
                    onClick={toggleForm}
                    startIcon={showForm ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                >
                    {showForm ? 'Hide Analysis Form' : 'Start New Analysis'}
                </AnimatedButton>
            </Box>

            {/* Analysis Form */}
            <Collapse in={showForm}>
                <StyledCard sx={{ mb: 4 }}>
                    <form onSubmit={handleSubmit}>
                        <Grid container spacing={3}>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    name="courseName"
                                    label="Course Name"
                                    value={formData.courseName}
                                    onChange={handleInputChange}
                                    required
                                    variant="filled"
                                    InputProps={{
                                        sx: {
                                            borderRadius: '12px',
                                            backgroundColor: 'rgba(0,0,0,0.02)'
                                        }
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    name="courseDescription"
                                    label="Course Description"
                                    value={formData.courseDescription}
                                    onChange={handleInputChange}
                                    required
                                    multiline
                                    rows={4}
                                    variant="filled"
                                    InputProps={{
                                        sx: {
                                            borderRadius: '12px',
                                            backgroundColor: 'rgba(0,0,0,0.02)'
                                        }
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    name="courseLiterature"
                                    label="Course Literature (Optional)"
                                    value={formData.courseLiterature}
                                    onChange={handleInputChange}
                                    multiline
                                    rows={3}
                                    variant="filled"
                                    InputProps={{
                                        sx: {
                                            borderRadius: '12px',
                                            backgroundColor: 'rgba(0,0,0,0.02)'
                                        }
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <AnimatedButton
                                    type="submit"
                                    variant="contained"
                                    size="large"
                                    disabled={loading}
                                    fullWidth
                                >
                                    {loading ? (
                                        <CircularProgress size={24} sx={{ mr: 1 }} />
                                    ) : (
                                        <SearchIcon sx={{ mr: 1 }} />
                                    )}
                                    Analyze Course Overlap
                                </AnimatedButton>
                            </Grid>
                        </Grid>
                    </form>
                </StyledCard>
            </Collapse>

            {error && (
                <Alert
                    severity="error"
                    sx={{
                        mb: 4,
                        borderRadius: '12px',
                        '& .MuiAlert-icon': {
                            fontSize: '2rem'
                        }
                    }}
                >
                    {error}
                </Alert>
            )}

            {results && (
                <StyledCard>
                    {/* Search and Filters */}
                    <Box sx={{ mb: 3 }}>
                        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                            <TextField
                                fullWidth
                                size="small"
                                placeholder="Search courses..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon />
                                        </InputAdornment>
                                    ),
                                    sx: {
                                        borderRadius: '12px',
                                        backgroundColor: 'rgba(0,0,0,0.02)'
                                    }
                                }}
                            />
                            <AnimatedButton
                                variant="outlined"
                                onClick={() => setShowFilters(!showFilters)}
                                startIcon={<FilterListIcon />}
                            >
                                Filters
                            </AnimatedButton>
                        </Box>

                        <Collapse in={showFilters}>
                            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                {['Bachelor', 'Master'].map(level => (
                                    <FilterChip
                                        key={level}
                                        active={filters.level === level}
                                        onClick={() => setFilters(prev => ({
                                            ...prev,
                                            level: prev.level === level ? '' : level
                                        }))}
                                    >
                                        {level}
                                    </FilterChip>
                                ))}
                                {['7.5', '15', '30'].map(credit => (
                                    <FilterChip
                                        key={credit}
                                        active={filters.credits === credit}
                                        onClick={() => setFilters(prev => ({
                                            ...prev,
                                            credits: prev.credits === credit ? '' : credit
                                        }))}
                                    >
                                        {credit} credits
                                    </FilterChip>
                                ))}
                                <FilterChip
                                    active={filters.portfolio === 'yes'}
                                    onClick={() => setFilters(prev => ({
                                        ...prev,
                                        portfolio: prev.portfolio === 'yes' ? '' : 'yes'
                                    }))}
                                >
                                    Portfolio
                                </FilterChip>
                            </Box>
                        </Collapse>
                    </Box>

                    {/* Results Table */}
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <StyledTableCell>Course</StyledTableCell>
                                    <StyledTableCell>Instructor</StyledTableCell>
                                    <StyledTableCell>Level</StyledTableCell>
                                    <StyledTableCell>Credits</StyledTableCell>
                                    <StyledTableCell>Portfolio</StyledTableCell>
                                    <StyledTableCell align="right">Similarity</StyledTableCell>
                                    <StyledTableCell padding="checkbox" />
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {getFilteredResults()
                                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                    .map((course) => (
                                        <React.Fragment key={course.kurskode}>
                                            <StyledTableRow>
                                                <StyledTableCell>
                                                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                                        <Link
                                                            href={course.link_nb}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            sx={{
                                                                color: 'primary.main',
                                                                textDecoration: 'none',
                                                                fontWeight: 600,
                                                                '&:hover': {
                                                                    textDecoration: 'underline'
                                                                }
                                                            }}
                                                        >
                                                            {course.kurskode}
                                                        </Link>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {course.kursnavn}
                                                        </Typography>
                                                    </Box>
                                                </StyledTableCell>
                                                <StyledTableCell>{course.academic_coordinator}</StyledTableCell>
                                                <StyledTableCell>{course.level_of_study}</StyledTableCell>
                                                <StyledTableCell>{course.credits}</StyledTableCell>
                                                <StyledTableCell>
                                                    {course.portfolio ? 'Yes' : 'No'}
                                                </StyledTableCell>
                                                <StyledTableCell align="right">
                                                    <SimilarityBadge similarity={course.similarity}>
                                                        {course.similarity}%
                                                    </SimilarityBadge>
                                                </StyledTableCell>
                                                <StyledTableCell padding="checkbox">
                                                    <Tooltip title={course.explanation ? (expandedExplanations[course.kurskode] ? 'Hide analysis' : 'Show analysis') : 'Generate analysis'}>
                                                        <ExplanationButton
                                                            size="small"
                                                            onClick={() => toggleExplanation(course)}
                                                            disabled={loadingExplanations[course.kurskode]}
                                                        >
                                                            {loadingExplanations[course.kurskode] ? (
                                                                <CircularProgress size={20} />
                                                            ) : course.explanation ? (
                                                                expandedExplanations[course.kurskode] ? (
                                                                    <KeyboardArrowUpIcon />
                                                                ) : (
                                                                    <KeyboardArrowDownIcon />
                                                                )
                                                            ) : (
                                                                <InfoIcon fontSize="small" />
                                                            )}
                                                        </ExplanationButton>
                                                    </Tooltip>
                                                </StyledTableCell>
                                            </StyledTableRow>
                                            {course.explanation && expandedExplanations[course.kurskode] && (
                                                <TableRow>
                                                    <TableCell colSpan={7} sx={{ p: 0 }}>
                                                        <RowExplanation
                                                            className={`row-explanation ${expandedExplanations[course.kurskode] ? 'visible' : ''}`}
                                                        >
                                                            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600, p: 2 }}>
                                                                Course Overlap Analysis
                                                            </Typography>
                                                            <Box sx={{ px: 2, pb: 2 }}>
                                                                {course.explanation.split('\n').map((line, index) => {
                                                                    if (line.startsWith('###')) {
                                                                        return (
                                                                            <Typography
                                                                                key={index}
                                                                                variant="subtitle2"
                                                                                sx={{
                                                                                    mt: 2,
                                                                                    mb: 1,
                                                                                    color: 'primary.main',
                                                                                    fontWeight: 600
                                                                                }}
                                                                            >
                                                                                {line.replace('###', '').trim()}
                                                                            </Typography>
                                                                        );
                                                                    }
                                                                    return (
                                                                        <Typography
                                                                            key={index}
                                                                            variant="body2"
                                                                            sx={{
                                                                                mb: 1,
                                                                                pl: line.startsWith('▸') || line.startsWith('•') ? 2 : line.startsWith('-') ? 4 : 0
                                                                            }}
                                                                        >
                                                                            {line}
                                                                        </Typography>
                                                                    );
                                                                })}
                                                            </Box>
                                                        </RowExplanation>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                        <TablePagination
                            component="div"
                            count={getFilteredResults().length}
                            page={page}
                            onPageChange={handleChangePage}
                            rowsPerPage={rowsPerPage}
                            onRowsPerPageChange={handleChangeRowsPerPage}
                            rowsPerPageOptions={[5, 10, 25]}
                        />
                    </Box>
                </StyledCard>
            )}
        </Container>
    );
};

export default CourseComparison; 