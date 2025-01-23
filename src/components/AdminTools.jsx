import React, { useState, useEffect } from 'react';
import { 
    Box, 
    TextField, 
    Button, 
    Typography, 
    Alert,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Switch,
    Tabs,
    Tab,
    Grid,
    Card,
    CardContent
} from '@mui/material';
import { supabase } from '../services/supabase';

const AdminTools = () => {
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);
    const [users, setUsers] = useState([]);
    const [activeTab, setActiveTab] = useState(0);
    const [stats, setStats] = useState({
        totalUsers: 0,
        activeUsers: 0,
        admins: 0
    });

    // Hent alle brukere
    const fetchUsers = async () => {
        try {
            const { data: { users }, error } = await supabase.auth.admin.listUsers();
            if (error) throw error;

            // Hent admin-status for alle brukere
            const { data: roles } = await supabase
                .from('user_roles')
                .select('user_id, is_admin');

            const { data: userStats } = await supabase
                .from('user_stats')
                .select('*');

            const usersWithRoles = users.map(user => ({
                ...user,
                is_admin: roles?.find(role => role.user_id === user.id)?.is_admin || false,
                stats: userStats?.find(stat => stat.user_id === user.id)
            }));

            setUsers(usersWithRoles);
            
            // Oppdater statistikk
            setStats({
                totalUsers: users.length,
                activeUsers: users.filter(u => u.last_sign_in_at).length,
                admins: roles?.filter(r => r.is_admin).length || 0
            });
        } catch (error) {
            setError('Kunne ikke hente brukerliste: ' + error.message);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setMessage(null);
        setError(null);

        try {
            const { data, error } = await supabase.auth.admin.createUser({
                email: newUserEmail,
                password: newUserPassword,
                email_confirm: true
            });

            if (error) throw error;
            
            setMessage('Bruker opprettet!');
            setNewUserEmail('');
            setNewUserPassword('');
            fetchUsers(); // Oppdater brukerlisten
        } catch (error) {
            setError(error.message);
        }
    };

    const toggleAdminStatus = async (userId, currentStatus) => {
        try {
            const { error } = await supabase
                .from('user_roles')
                .upsert({ 
                    user_id: userId, 
                    is_admin: !currentStatus 
                });

            if (error) throw error;
            fetchUsers(); // Oppdater brukerlisten
            setMessage(`Admin-status oppdatert`);
        } catch (error) {
            setError('Kunne ikke oppdatere admin-status: ' + error.message);
        }
    };

    return (
        <Box sx={{ width: '100%', maxWidth: 800, mx: 'auto', p: 3 }}>
            <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
                <Tab label="Opprett Bruker" />
                <Tab label="Håndter Brukere" />
                <Tab label="Statistikk" />
            </Tabs>

            {message && <Alert severity="success" sx={{ mt: 2, mb: 2 }}>{message}</Alert>}
            {error && <Alert severity="error" sx={{ mt: 2, mb: 2 }}>{error}</Alert>}

            {activeTab === 0 && (
                <Box sx={{ mt: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Opprett ny bruker
                    </Typography>
                    
                    <form onSubmit={handleCreateUser}>
                        <TextField
                            fullWidth
                            label="E-post"
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                            margin="normal"
                            required
                        />
                        
                        <TextField
                            fullWidth
                            label="Passord"
                            value={newUserPassword}
                            onChange={(e) => setNewUserPassword(e.target.value)}
                            margin="normal"
                            required
                            type="password"
                        />
                        
                        <Button
                            fullWidth
                            type="submit"
                            variant="contained"
                            sx={{ mt: 2 }}
                        >
                            Opprett bruker
                        </Button>
                    </form>
                </Box>
            )}

            {activeTab === 1 && (
                <TableContainer component={Paper} sx={{ mt: 3 }}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>E-post</TableCell>
                                <TableCell>Sist innlogget</TableCell>
                                <TableCell>Admin</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>
                                        {user.last_sign_in_at 
                                            ? new Date(user.last_sign_in_at).toLocaleString('nb-NO')
                                            : 'Aldri'}
                                    </TableCell>
                                    <TableCell>
                                        <Switch
                                            checked={user.is_admin}
                                            onChange={() => toggleAdminStatus(user.id, user.is_admin)}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {activeTab === 2 && (
                <Box sx={{ mt: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Brukerstatistikk
                    </Typography>
                    <Grid container spacing={3}>
                        <Grid item xs={12} sm={4}>
                            <Card>
                                <CardContent>
                                    <Typography color="textSecondary" gutterBottom>
                                        Totalt antall brukere
                                    </Typography>
                                    <Typography variant="h4">
                                        {stats.totalUsers}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <Card>
                                <CardContent>
                                    <Typography color="textSecondary" gutterBottom>
                                        Aktive brukere
                                    </Typography>
                                    <Typography variant="h4">
                                        {stats.activeUsers}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <Card>
                                <CardContent>
                                    <Typography color="textSecondary" gutterBottom>
                                        Administratorer
                                    </Typography>
                                    <Typography variant="h4">
                                        {stats.admins}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Box>
            )}
        </Box>
    );
};

export default AdminTools; 