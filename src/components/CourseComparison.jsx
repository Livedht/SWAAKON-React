import React, { useState, useEffect, useCallback } from 'react';
import { fetchStoredEmbeddings } from '../services/supabase';
import { generateHFEmbedding, findSimilarCourses } from '../services/similarity';
import { alpha } from '@mui/material/styles';
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
    IconButton,
    TablePagination,
    InputAdornment,
    Collapse,
    Grid,
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
import SearchIcon from '@mui/icons-material/Search';
import SettingsIcon from '@mui/icons-material/Settings';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import Papa from 'papaparse';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import SWAAKONLogo from '../assets/SWAAKONLogo.png';
import { supabase, checkRateLimit, trackApiCost, saveSearch } from '../services/supabase';
import { useSearch } from '../context/SearchContext';

const MIN_INPUT_LENGTH = 10;
const MAX_INPUT_LENGTH = 5000;
const COLUMN_SETTINGS_KEY = 'courseComparisonColumns';

const defaultColumns = [
    { id: 'col-kurskode', label: 'Kurs', enabled: true, required: true },
    { id: 'col-similarity', label: 'Likhet', enabled: true, required: true },
    { id: 'col-credits', label: 'Studiepoeng', enabled: true },
    { id: 'col-level', label: 'Studienivå', enabled: true },
    { id: 'col-språk', label: 'Språk', enabled: true },
    { id: 'col-semester', label: 'Semester', enabled: true },
    { id: 'col-portfolio', label: 'Portfolio', enabled: false },
    { id: 'col-område', label: 'Område', enabled: false },
    { id: 'col-academic-coordinator', label: 'Koordinator', enabled: false },
    { id: 'col-institutt', label: 'Institutt', enabled: false },
    { id: 'col-ai', label: 'AI Analyse', enabled: true }
];

const availableFilters = {
    studyLevel: ['Bachelor', 'Master', 'PhD'],
    language: ['Norsk', 'Engelsk'],
    credits: ['5', '7.5', '10', '15', '20', '30'],
    semester: ['Høst', 'Vår', 'Høst og vår'],
    portfolio: ['Obligatorisk', 'Valgfri'],
    område: ['Informatikk', 'Matematikk', 'Fysikk', 'Kjemi'],
    academic_coordinator: [],
    institutt: []
};

// Helper function to format credits
const formatCredits = (credits) => {
    if (!credits) return '';

    // Convert to string first to handle both string and number inputs
    const creditStr = credits.toString();

    // Handle special cases where we need to add a decimal point
    if (creditStr === '75') return '7.5 SP';
    if (creditStr === '25') return '2.5 SP';

    // For other cases, parse and format normally
    const numCredits = parseFloat(creditStr);
    if (isNaN(numCredits)) return creditStr;

    return `${numCredits} SP`;
};

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

const CourseComparison = ({ restoredSearch, onSearchComplete }) => {
    const { searchState, updateSearchState } = useSearch();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [loadingExplanations, setLoadingExplanations] = useState({});
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [showFilters, setShowFilters] = useState(false);
    const [expandedExplanations, setExpandedExplanations] = useState({});
    const [showColumnDialog, setShowColumnDialog] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Use values from context
    const { formData, results, showForm, filters, availableColumns, availableFilters } = searchState;

    // Update context when form data changes
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        updateSearchState({
            formData: {
                ...formData,
                [name]: value
            }
        });
    };

    // Update context when filters change
    const handleFilterChange = (newFilters) => {
        updateSearchState({ filters: newFilters });
    };

    // Update context when columns change
    const handleColumnsChange = (newColumns) => {
        updateSearchState({ availableColumns: newColumns });
    };

    // Effect for handling restored search
    useEffect(() => {
        if (restoredSearch) {
            updateSearchState({
                formData: restoredSearch.search_input,
                results: restoredSearch.results,
                showForm: false,
                filters: restoredSearch.table_settings?.filters || filters,
                availableColumns: restoredSearch.table_settings?.activeColumns ?
                    availableColumns.map(col => ({
                        ...col,
                        enabled: restoredSearch.table_settings.activeColumns.includes(col.id)
                    })) :
                    availableColumns
            });
            onSearchComplete();
        }
    }, [restoredSearch, onSearchComplete]);

    const handleCompare = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');

            // Check rate limit before making the request
            await checkRateLimit(user.id);

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
            const courseText = {
                name: formData.courseName.trim(),
                content: formData.courseDescription.trim(),
                literature: formData.courseLiterature?.trim() || ''
            };

            console.log('Generating embeddings...');
            let embedding;
            try {
                // Try with local inference first
                embedding = await generateHFEmbedding(courseText, true);
                console.log('Generated embedding:', { length: embedding.length, sample: embedding.slice(0, 5) });
            } catch (localError) {
                console.error('Local inference failed:', localError);
                setError('Failed to generate embeddings. Please try again or contact support if the issue persists.');
                return;
            }

            console.log('Fetching stored courses...');
            const storedCourses = await fetchStoredEmbeddings();

            if (!storedCourses || storedCourses.length === 0) {
                throw new Error('No stored courses found to compare against');
            }

            console.log('Finding similar courses...');
            const similarCourses = await findSimilarCourses({ embedding }, storedCourses);

            if (similarCourses.length === 0) {
                updateSearchState({ results: [] });
                throw new Error('No similar courses found. Try providing more detailed course information.');
            }

            // Update both context and local state
            updateSearchState({
                results: similarCourses,
                showForm: false
            });

            // Save search to history
            await saveSearch({
                search_input: formData,
                table_settings: {
                    activeColumns: availableColumns.filter(col => col.enabled).map(col => col.id),
                    filters: filters,
                    sortOrder: null
                },
                results: similarCourses
            });

            // Track API usage
            const estimatedCost = 0.001;
            await trackApiCost(user.id, estimatedCost, 'course_comparison');

        } catch (error) {
            setError(error.message);
            console.error('Comparison error:', error);
        } finally {
            setLoading(false);
        }
    }, [formData, filters, availableColumns, updateSearchState]);

    // Toggle form visibility
    const toggleForm = () => {
        updateSearchState({ showForm: !showForm });
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

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
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

    useEffect(() => {
        localStorage.setItem(COLUMN_SETTINGS_KEY, JSON.stringify(availableColumns));
    }, [availableColumns]);

    const handleGenerateExplanation = async (course, courseText) => {
        setLoadingExplanations(prev => ({ ...prev, [course.kurskode]: true }));

        try {
            const explanation = await generateHFEmbedding(
                {
                    name: formData.courseName,
                    content: courseText,
                },
                course,
                course.similarity
            );

            if (!explanation) {
                throw new Error('No explanation was generated');
            }

            // Update results in context
            updateSearchState({
                results: searchState.results.map(r =>
                    r.kurskode === course.kurskode
                        ? { ...r, explanation }
                        : r
                )
            });
        } catch (err) {
            console.error('Error generating explanation:', err);
            setError(`Failed to generate explanation for ${course.kurskode}: ${err.message}`);
        } finally {
            setLoadingExplanations(prev => ({ ...prev, [course.kurskode]: false }));
        }
    };

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
        const newColumns = [...availableColumns];
        const newIndex = direction === 'up' ? index - 1 : index + 1;

        if (newIndex >= 0 && newIndex < newColumns.length) {
            [newColumns[index], newColumns[newIndex]] = [newColumns[newIndex], newColumns[index]];
            updateSearchState({ availableColumns: newColumns });
            localStorage.setItem(COLUMN_SETTINGS_KEY, JSON.stringify(newColumns));
        }
    };

    const resetColumnSettings = () => {
        updateSearchState({ availableColumns: defaultColumns });
        localStorage.setItem(COLUMN_SETTINGS_KEY, JSON.stringify(defaultColumns));
    };

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
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        handleCompare();
                    }}>
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
                    updateSearchState({ results: null });
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
                            setFilters={handleFilterChange}
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
                                                const newColumns = availableColumns.map(col =>
                                                    col.id === column.id
                                                        ? { ...col, enabled: !col.enabled }
                                                        : col
                                                );
                                                updateSearchState({ availableColumns: newColumns });
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