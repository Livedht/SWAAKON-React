import React, { useState, useMemo, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, IconButton, Typography } from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import CourseComparison from './components/CourseComparison';

const App = () => {
    // Initialize theme from localStorage or system preference
    const [mode, setMode] = useState(() => {
        const savedMode = localStorage.getItem('themeMode');
        if (savedMode) {
            return savedMode;
        }
        // Check system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    });

    // Listen for system theme changes
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e) => {
            if (!localStorage.getItem('themeMode')) {
                setMode(e.matches ? 'dark' : 'light');
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    const theme = useMemo(
        () =>
            createTheme({
                palette: {
                    mode,
                    ...(mode === 'dark' ? {
                        background: {
                            default: '#121212',
                            paper: '#1e1e1e',
                        },
                        primary: {
                            main: '#90caf9',
                        },
                    } : {
                        background: {
                            default: '#f5f5f5',
                            paper: '#ffffff',
                        },
                    }),
                },
                components: {
                    MuiCssBaseline: {
                        styleOverrides: {
                            body: {
                                scrollbarColor: mode === 'dark' ? '#6b6b6b #2b2b2b' : '#959595 #f5f5f5',
                                '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
                                    width: '8px',
                                    height: '8px',
                                },
                                '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
                                    borderRadius: 8,
                                    backgroundColor: mode === 'dark' ? '#6b6b6b' : '#959595',
                                    border: '2px solid transparent',
                                },
                                '&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track': {
                                    backgroundColor: mode === 'dark' ? '#2b2b2b' : '#f5f5f5',
                                    borderRadius: 8,
                                },
                            },
                        },
                    },
                },
            }),
        [mode],
    );

    const toggleColorMode = () => {
        const newMode = mode === 'light' ? 'dark' : 'light';
        setMode(newMode);
        localStorage.setItem('themeMode', newMode);
    };

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Box sx={{
                minHeight: '100vh',
                bgcolor: 'background.default',
                position: 'relative',
                pb: 4
            }}>
                <Box sx={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 1100,
                    bgcolor: 'background.paper',
                    borderBottom: 1,
                    borderColor: 'divider',
                    px: 2,
                    py: 1,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 2
                }}>
                    <Typography
                        variant="h6"
                        sx={{
                            fontWeight: 700,
                            background: theme => theme.palette.mode === 'dark'
                                ? 'linear-gradient(45deg, #90caf9, #42a5f5)'
                                : 'linear-gradient(45deg, #1976d2, #42a5f5)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}
                    >
                        SWAAKON
                    </Typography>
                    <IconButton
                        onClick={toggleColorMode}
                        size="large"
                        sx={{
                            bgcolor: mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                            '&:hover': {
                                bgcolor: mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
                            },
                            borderRadius: 2,
                            p: 1,
                        }}
                        aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    >
                        {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
                    </IconButton>
                </Box>
                <CourseComparison />
            </Box>
        </ThemeProvider>
    );
};

export default App; 