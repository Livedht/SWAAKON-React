import React, { useState, useMemo, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, IconButton, Typography, CircularProgress, Button, Container } from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import CourseComparison from './components/CourseComparison';
import Login from './components/Login';
import { supabase, checkIsAdmin } from './services/supabase';
import AdminTools from './components/AdminTools';
import theme from './theme';
import UserInfo from './components/UserInfo';

const App = () => {
    const [mode, setMode] = useState(localStorage.getItem('theme') || 'light');

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

    const colorMode = useMemo(
        () => ({
            toggleColorMode: () => {
                setMode((prevMode) => {
                    const newMode = prevMode === 'light' ? 'dark' : 'light';
                    localStorage.setItem('theme', newMode);
                    return newMode;
                });
            },
        }),
        []
    );

    // Kombiner base-temaet med mode
    const currentTheme = useMemo(
        () => createTheme({
            ...theme,
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
        }),
        [mode]
    );

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showAdmin, setShowAdmin] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [currentView, setCurrentView] = useState('main');

    useEffect(() => {
        // Sjekk innlogget status ved oppstart
        const checkUser = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                setUser(user);
                console.log('Logged in user:', user?.email);
            } catch (error) {
                console.error('Error checking auth status:', error);
            } finally {
                setLoading(false);
            }
        };

        checkUser();

        // Lytt på auth endringer
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        const checkAdminStatus = async () => {
            if (user) {
                const adminStatus = await checkIsAdmin();
                console.log('Admin status:', adminStatus);
                setIsAdmin(adminStatus);
            }
        };
        
        checkAdminStatus();
    }, [user]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!user) {
        return (
            <ThemeProvider theme={currentTheme}>
                <CssBaseline />
                <Login onLogin={setUser} />
            </ThemeProvider>
        );
    }

    console.log('Render state:', { isAdmin, showAdmin, userEmail: user?.email });

    return (
        <ThemeProvider theme={currentTheme}>
            <CssBaseline />
            <Box sx={{
                minHeight: '100vh',
                bgcolor: 'background.default'
            }}>
                <Box sx={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 1100,
                    bgcolor: 'background.paper',
                    borderBottom: 1,
                    borderColor: 'divider',
                    px: 3,
                    py: 1,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box 
                            sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 1,
                                cursor: 'pointer'
                            }}
                            onClick={() => setCurrentView('main')}
                        >
                            <img 
                                src="/Logo.png" 
                                alt="SWAAKON Logo" 
                                style={{ 
                                    height: '32px',
                                    width: 'auto',
                                    marginRight: '8px'
                                }} 
                            />
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
                        </Box>
                        {isAdmin && (
                            <Button 
                                onClick={() => setCurrentView(currentView === 'admin' ? 'main' : 'admin')}
                                variant="outlined"
                                size="small"
                                color={currentView === 'admin' ? 'primary' : 'inherit'}
                            >
                                {currentView === 'admin' ? 'Tilbake til app' : 'Admin Panel'}
                            </Button>
                        )}
                        <IconButton 
                            onClick={colorMode.toggleColorMode} 
                            color="inherit"
                        >
                            {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
                        </IconButton>
                    </Box>
                    
                    {user && <UserInfo user={user} />}
                </Box>
                <Box sx={{ p: 2 }}>
                    {currentView === 'main' ? (
                        <CourseComparison />
                    ) : (
                        <AdminTools />
                    )}
                </Box>
            </Box>
        </ThemeProvider>
    );
};

export default App; 