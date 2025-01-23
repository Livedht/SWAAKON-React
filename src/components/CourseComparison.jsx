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
    Card,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Switch,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Slider,
    Chip,
} from '@mui/material';
import styled from '@emotion/styled';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import InfoIcon from '@mui/icons-material/Info';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';
import SettingsIcon from '@mui/icons-material/Settings';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { alpha } from '@mui/material/styles';
import Papa from 'papaparse';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ClearIcon from '@mui/icons-material/Clear';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import SWAAKONLogo from '../assets/SWAAKONLogo.png';

const MIN_INPUT_LENGTH = 10;
const MAX_INPUT_LENGTH = 5000;
const COLUMN_SETTINGS_KEY = 'courseComparisonColumns';

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

const ExplanationButton = styled(Button)(({ theme }) => ({
    minWidth: 'auto',
    padding: '6px 12px',
    transition: 'all 0.2s ease',
    backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.1),
    color: theme.palette.primary.main,
    '&:hover': {
        backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.3 : 0.2),
        transform: 'scale(1.02)'
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

const ErrorDisplay = ({ error, onRetry }) => (
    <Box sx={{ textAlign: 'center', p: 4 }}>
        <Typography color="error" gutterBottom>
            {error}
        </Typography>
        <Button onClick={onRetry} variant="contained" sx={{ mt: 2 }}>
            Prøv igjen
        </Button>
    </Box>
);

const MobileResultCard = ({ course }) => (
    <Card sx={{ mb: 2, p: 2 }}>
        <Typography variant="h6">{course.kurskode}</Typography>
        <Typography variant="body2" color="textSecondary" gutterBottom>
            {course.kursnavn}
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            <Typography>Likhet: {course.similarity}%</Typography>
            <Typography>{course.credits} stp</Typography>
        </Box>
    </Card>
);

// Hjelpefunksjon for å formatere studiepoeng
const formatCredits = (credits) => {
    if (!credits) return '';
    // Konverter fra 75 til 7.5 og 25 til 2.5
    switch (credits) {
        case 75:
            return '7.5';
        case 25:
            return '2.5';
        default:
            return credits.toString();
    }
};

const ColumnListItem = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(1),
    marginBottom: theme.spacing(1),
    backgroundColor: theme.palette.background.paper,
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    '&:hover': {
        backgroundColor: theme.palette.action.hover
    }
}));

const FilterSection = styled(Box)(({ theme }) => ({
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.background.paper,
    marginBottom: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
}));

const FilterBar = ({ filters, setFilters, availableFilters, availableColumns }) => {
    const handleClearFilters = () => {
        setFilters({
            searchTerm: '',
            similarityRange: [0, 100],
            studyLevel: 'all',
            language: 'all',
            credits: 'all',
            semester: 'all',
            portfolio: 'all',
            område: 'all',
            academic_coordinator: 'all',
            kursnavn: '',
            institutt: 'all'
        });
    };

    const activeFilterCount = Object.values(filters).filter(value => 
        value !== 'all' && value !== '' && 
        !(Array.isArray(value) && value[0] === 0 && value[1] === 100)
    ).length;

    return (
        <FilterSection>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FilterAltIcon />
                    Aktive filtre
                    {activeFilterCount > 0 && (
                        <Chip label={activeFilterCount} size="small" color="primary" />
                    )}
                </Typography>
                {activeFilterCount > 0 && (
                    <Button startIcon={<ClearIcon />} onClick={handleClearFilters} size="small">
                        Nullstill filtre
                    </Button>
                )}
            </Box>
            
            <Grid container spacing={2}>
                {availableColumns
                    .filter(col => col.enabled)
                    .map(column => (
                        <Grid item xs={12} sm={6} md={4} key={column.id}>
                            {column.id === 'col-similarity' ? (
                                <Box>
                                    <Typography gutterBottom>
                                        Likhet: {filters.similarityRange[0]}% - {filters.similarityRange[1]}%
                                    </Typography>
                                    <Slider
                                        value={filters.similarityRange}
                                        onChange={(e, newValue) => setFilters({ ...filters, similarityRange: newValue })}
                                        valueLabelDisplay="auto"
                                        min={0}
                                        max={100}
                                    />
                                </Box>
                            ) : (
                                <FormControl fullWidth size="small">
                                    <InputLabel>{column.label}</InputLabel>
                                    <Select
                                        value={filters[column.field] || 'all'}
                                        onChange={(e) => setFilters({ ...filters, [column.field]: e.target.value })}
                                        label={column.label}
                                    >
                                        <MenuItem value="all">Alle {column.label.toLowerCase()}</MenuItem>
                                        {availableFilters[column.field]?.map(option => (
                                            <MenuItem key={option} value={option}>
                                                {option}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            )}
                        </Grid>
                    ))}
            </Grid>
        </FilterSection>
    );
};

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
        searchTerm: '',
        similarityRange: [0, 100],
        studyLevel: 'all',
        language: 'all',
        credits: 'all',
        semester: 'all',
        portfolio: 'all',
        område: 'all',
        academic_coordinator: 'all',
        kursnavn: '',
        institutt: 'all'
    });

    const [availableFilters, setAvailableFilters] = useState({
        studyLevels: [],
        languages: [],
        creditOptions: []
    });

    const [showColumnDialog, setShowColumnDialog] = useState(false);
    const defaultColumns = [
        { id: 'col-kurskode', label: 'Kurs', enabled: true, required: true, field: 'kurskode' },
        { id: 'col-semester', label: 'Semester', enabled: true, field: 'semester' },
        { id: 'col-språk', label: 'Språk (Original)', enabled: false, field: 'språk' },
        { id: 'col-kursnavn', label: 'Kursnavn', enabled: false, field: 'kursnavn' },
        { id: 'col-academic-coordinator', label: 'Academic Coordinator', enabled: false, field: 'academic_coordinator' },
        { id: 'col-credits', label: 'Studiepoeng', enabled: true, field: 'credits' },
        { id: 'col-portfolio', label: 'Portfolio', enabled: true, field: 'portfolio' },
        { id: 'col-institutt', label: 'Institutt', enabled: false, field: 'ansvarlig_institutt' },
        { id: 'col-område', label: 'Forretningsområde', enabled: true, field: 'ansvarlig_område' },
        { id: 'col-level', label: 'Nivå', enabled: true, field: 'level_of_study' },
        { id: 'col-pensum', label: 'Pensum', enabled: false, field: 'pensum' },
        { id: 'col-similarity', label: 'Likhet', enabled: true, required: true, field: 'similarity' },
        { id: 'col-ai', label: 'AI Analyse', enabled: true, required: true, field: 'ai_analyse' }
    ];

    const [availableColumns, setAvailableColumns] = useState(() => {
        const savedColumns = localStorage.getItem(COLUMN_SETTINGS_KEY);
        if (savedColumns) {
            return JSON.parse(savedColumns);
        }
        return defaultColumns;
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
            
            // Skjul analyseformen når resultatene er klare
            setShowForm(false);

        } catch (err) {
            console.error('Error in course analysis:', err);
            setError({
                message: 'Kunne ikke fullføre analysen',
                details: err.message,
                type: err.name
            });
            setResults(null);
        } finally {
            setLoading(false);
        }
    };

    const getFilteredResults = () => {
        return results.filter(course => {
            // Søketekst
            const searchMatch = !filters.searchTerm || 
                course.kurskode.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
                course.kursnavn.toLowerCase().includes(filters.searchTerm.toLowerCase());

            // Similarity score range
            const similarityMatch = course.similarity >= filters.similarityRange[0] && 
                                  course.similarity <= filters.similarityRange[1];

            // Studienivå
            const levelMatch = filters.studyLevel === 'all' || 
                             course.level_of_study === filters.studyLevel;

            // Språk
            const languageMatch = filters.language === 'all' || 
                                course.språk === filters.language;

            // Studiepoeng
            const creditsMatch = filters.credits === 'all' || 
                               course.credits === filters.credits;

            return searchMatch && similarityMatch && levelMatch && 
                   languageMatch && creditsMatch;
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

    // Hent tilgjengelige filtervalg når komponentet lastes
    useEffect(() => {
        const extractFilters = (courses) => {
            const filterValues = {};
            
            // Gå gjennom alle kolonner og samle unike verdier
            availableColumns.forEach(column => {
                if (column.field && column.field !== 'similarity') {
                    const values = new Set();
                    courses.forEach(course => {
                        if (course[column.field]) {
                            values.add(course[column.field]);
                        }
                    });
                    filterValues[column.field] = Array.from(values).sort();
                }
            });

            setAvailableFilters(filterValues);
        };

        if (results && results.length > 0) {
            extractFilters(results);
        }
    }, [results, availableColumns]);

    const exportResults = () => {
        if (!results || results.length === 0) return;

        // Få alle aktive kolonner
        const activeColumns = availableColumns.filter(col => col.enabled);
        
        // Lag CSV-innhold basert på aktive kolonner
        const csvContent = getFilteredResults().map(course => {
            const row = {};
            activeColumns.forEach(col => {
                switch (col.id) {
                    case 'col-kurskode':
                        row['Kurs'] = `${course.kurskode} - ${course.kursnavn?.replace('No', '')}`;
                        break;
                    case 'col-similarity':
                        row['Likhet'] = `${course.similarity}%`;
                        break;
                    case 'col-credits':
                        row['Studiepoeng'] = formatCredits(course.credits);
                        break;
                    default:
                        // For alle andre kolonner, bruk feltnavnet fra kolonnedefinisjonen
                        if (col.field && course[col.field]) {
                            row[col.label] = course[col.field]?.replace('No', '');
                        }
                }
            });
            return row;
        });

        const csv = Papa.unparse(csvContent);
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const date = new Date().toISOString().split('T')[0];
        link.href = URL.createObjectURL(blob);
        link.download = `kursanalyse_resultater_${date}.csv`;
        link.click();
    };

    const moveColumn = (index, direction) => {
        setAvailableColumns(prevColumns => {
            const newColumns = [...prevColumns];
            const newIndex = direction === 'up' ? index - 1 : index + 1;
            
            if (newIndex >= 0 && newIndex < newColumns.length) {
                [newColumns[index], newColumns[newIndex]] = [newColumns[newIndex], newColumns[index]];
                localStorage.setItem(COLUMN_SETTINGS_KEY, JSON.stringify(newColumns));
            }
            
            return newColumns;
        });
    };

    const resetColumnSettings = () => {
        setAvailableColumns(defaultColumns);
        localStorage.setItem(COLUMN_SETTINGS_KEY, JSON.stringify(defaultColumns));
    };

    useEffect(() => {
        localStorage.setItem(COLUMN_SETTINGS_KEY, JSON.stringify(availableColumns));
    }, [availableColumns]);

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            {/* Logo og Hero Section */}
            <Box sx={{
                textAlign: 'center',
                mb: 4,
                background: theme => theme.palette.mode === 'dark'
                    ? 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
                    : 'linear-gradient(135deg, #f6f9fe 0%, #f1f4f9 100%)',
                borderRadius: '24px',
                p: 3,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2
            }}>
                <img 
                    src={SWAAKONLogo} 
                    alt="SWAAKON Logo"
                    style={{ 
                        height: '40px',
                        width: 'auto',
                        marginBottom: '16px'
                    }} 
                />
                <AnimatedButton
                    variant="contained"
                    onClick={toggleForm}
                    startIcon={showForm ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                    disabled={loading}
                >
                    {loading ? 'Analyserer...' : (showForm ? 'Skjul analyseskjema' : 'Start ny analyse')}
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
                <ErrorDisplay error={error.message} onRetry={() => {
                    setError(null);
                    setResults(null);
                    setLoading(true);
                }} />
            )}

            {results && (
                <StyledCard>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Box sx={{ display: 'flex', gap: 2 }}>
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
                            <AnimatedButton
                                variant="outlined"
                                onClick={exportResults}
                                startIcon={<FileDownloadIcon />}
                                disabled={!results || results.length === 0}
                            >
                                Eksporter til Excel
                            </AnimatedButton>
                        </Box>
                        <Button
                            startIcon={<SettingsIcon />}
                            onClick={() => setShowColumnDialog(true)}
                        >
                            Tilpass kolonner
                        </Button>
                    </Box>

                    {/* Search and Filters */}
                    <Collapse in={showFilters}>
                        <FilterBar 
                            filters={filters}
                            setFilters={setFilters}
                            availableFilters={availableFilters}
                            availableColumns={availableColumns}
                        />
                    </Collapse>

                    {/* Results Table */}
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    {availableColumns
                                        .filter(col => col.enabled)
                                        .map(col => (
                                            <StyledTableCell key={col.id}>
                                                {col.label}
                                            </StyledTableCell>
                                        ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {getFilteredResults()
                                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                    .map((course) => (
                                        <React.Fragment key={course.kurskode}>
                                            <StyledTableRow>
                                                {availableColumns
                                                    .filter(col => col.enabled)
                                                    .map(col => (
                                                        <StyledTableCell key={col.id}>
                                                            {col.id === 'col-kurskode' && (
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
                                                                        {course.kursnavn?.replace('No', '')}
                                                                    </Typography>
                                                                </Box>
                                                            )}
                                                            {col.id === 'col-semester' && course.semester}
                                                            {col.id === 'col-språk' && course.språk}
                                                            {col.id === 'col-kursnavn' && course.kursnavn?.replace('No', '')}
                                                            {col.id === 'col-academic-coordinator' && course.academic_coordinator}
                                                            {col.id === 'col-portfolio' && course.portfolio}
                                                            {col.id === 'col-credits' && formatCredits(course.credits)}
                                                            {col.id === 'col-institutt' && course.ansvarlig_institutt}
                                                            {col.id === 'col-område' && course.ansvarlig_område}
                                                            {col.id === 'col-level' && course.level_of_study?.replace('No', '')}
                                                            {col.id === 'col-pensum' && course.pensum}
                                                            {col.id === 'col-similarity' && (
                                                                <SimilarityBadge similarity={course.similarity}>
                                                                    {course.similarity}%
                                                                </SimilarityBadge>
                                                            )}
                                                            {col.id === 'col-ai' && (
                                                                <Button
                                                                    size="small"
                                                                    onClick={() => toggleExplanation(course)}
                                                                    disabled={loadingExplanations[course.kurskode]}
                                                                    variant="contained"
                                                                >
                                                                    {loadingExplanations[course.kurskode] ? (
                                                                        <CircularProgress size={20} />
                                                                    ) : (
                                                                        course.explanation ? 
                                                                            (expandedExplanations[course.kurskode] ? 'Skjul' : 'Vis') 
                                                                            : 'Analyser'
                                                                    )}
                                                                </Button>
                                                            )}
                                                        </StyledTableCell>
                                                    ))}
                                            </StyledTableRow>
                                            {course.explanation && expandedExplanations[course.kurskode] && (
                                                <TableRow>
                                                    <TableCell colSpan={availableColumns.length} sx={{ p: 0 }}>
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

            {/* Dialog for kolonnetilpasning */}
            <Dialog
                open={showColumnDialog}
                onClose={() => setShowColumnDialog(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    Tilpass kolonner
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                        Bruk pilene for å endre rekkefølgen. Velg hvilke kolonner som skal vises.
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {availableColumns.map((column, index) => (
                            <ColumnListItem key={column.id}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                                    <Switch
                                        checked={column.enabled}
                                        onChange={() => {
                                            if (!column.required) {
                                                setAvailableColumns(cols =>
                                                    cols.map(col =>
                                                        col.id === column.id
                                                            ? { ...col, enabled: !col.enabled }
                                                            : col
                                                    )
                                                );
                                            }
                                        }}
                                        disabled={column.required}
                                        inputProps={{
                                            'aria-label': `Toggle ${column.label}`
                                        }}
                                    />
                                    <Typography flex={1}>
                                        {column.label}
                                        {column.required && (
                                            <Typography
                                                component="span"
                                                variant="caption"
                                                color="text.secondary"
                                                sx={{ ml: 1 }}
                                            >
                                                (Påkrevd)
                                            </Typography>
                                        )}
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                                        <IconButton 
                                            size="small"
                                            onClick={() => moveColumn(index, 'up')}
                                            disabled={index === 0}
                                        >
                                            <ArrowUpwardIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton 
                                            size="small"
                                            onClick={() => moveColumn(index, 'down')}
                                            disabled={index === availableColumns.length - 1}
                                        >
                                            <ArrowDownwardIcon fontSize="small" />
                                        </IconButton>
                                    </Box>
                                </Box>
                            </ColumnListItem>
                        ))}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button 
                        onClick={resetColumnSettings}
                        color="secondary"
                    >
                        Tilbakestill
                    </Button>
                    <Button onClick={() => setShowColumnDialog(false)}>
                        Lukk
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default CourseComparison; 