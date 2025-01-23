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
    CardContent,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    FormControl,
    InputLabel,
    Select,
    MenuItem
} from '@mui/material';
import { supabase } from '../services/supabase';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';

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
        admins: 0,
        dailySearches: 0,
        averageResponseTime: 0,
        popularCourses: [],
        apiUsage: {
            daily: 0,
            monthly: 0
        }
    });
    const [selectedUser, setSelectedUser] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [showPasswordDialog, setShowPasswordDialog] = useState(false);
    const [showFieldDialog, setShowFieldDialog] = useState(false);
    const [fieldData, setFieldData] = useState({
        name: '',
        type: 'text',
        description: ''
    });
    const [customFields, setCustomFields] = useState([]);

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
        fetchCustomFields();
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

    // Funksjon for å endre passord
    const handlePasswordChange = async () => {
        try {
            const { error } = await supabase.auth.admin.updateUserById(
                selectedUser.id,
                { password: newPassword }
            );

            if (error) throw error;

            setMessage(`Passord endret for ${selectedUser.email}`);
            setShowPasswordDialog(false);
            setNewPassword('');
            setSelectedUser(null);
        } catch (error) {
            setError('Kunne ikke endre passord: ' + error.message);
        }
    };

    const CostStatistics = () => {
        const [costData, setCostData] = useState({
            totalCost: 0,
            lastDayCost: 0,
            lastWeekCost: 0,
            lastMonthCost: 0,
            costByModel: {},
            costByEndpoint: {},
            recentTransactions: []
        });

        const fetchCostData = async () => {
            try {
                console.log('Fetching cost data...');
                
                // Hent total kostnad
                const { data: totalData, error: totalError } = await supabase
                    .from('api_costs')
                    .select('cost_usd');

                if (totalError) throw totalError;
                
                const totalCost = totalData.reduce((sum, item) => sum + parseFloat(item.cost_usd), 0);

                // Hent siste døgns kostnad
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                
                const { data: dayData, error: dayError } = await supabase
                    .from('api_costs')
                    .select('cost_usd')
                    .gte('timestamp', yesterday.toISOString());

                if (dayError) throw dayError;
                
                const dayCost = dayData.reduce((sum, item) => sum + parseFloat(item.cost_usd), 0);

                // Hent siste transaksjoner
                const { data: recentData, error: recentError } = await supabase
                    .from('api_costs')
                    .select('*')
                    .order('timestamp', { ascending: false })
                    .limit(10);

                if (recentError) throw recentError;

                console.log('Cost data fetched:', {
                    totalCost,
                    dayCost,
                    recentTransactions: recentData
                });

                setCostData({
                    totalCost,
                    lastDayCost: dayCost,
                    recentTransactions: recentData || []
                });
            } catch (error) {
                console.error('Error fetching cost data:', error);
            }
        };

        useEffect(() => {
            fetchCostData();
            const interval = setInterval(fetchCostData, 30000); // Oppdater hvert 30. sekund
            return () => clearInterval(interval);
        }, []);

        return (
            <Box>
                <Typography variant="h6" gutterBottom>
                    API Kostnadsstatistikk
                </Typography>

                <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', mb: 4 }}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Total kostnad
                            </Typography>
                            <Typography variant="h4">
                                ${costData.totalCost.toFixed(2)}
                            </Typography>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Siste 24 timer
                            </Typography>
                            <Typography variant="h4">
                                ${costData.lastDayCost.toFixed(2)}
                            </Typography>
                        </CardContent>
                    </Card>
                </Box>

                <TableContainer component={Paper} sx={{ mb: 4 }}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Tidspunkt</TableCell>
                                <TableCell>Bruker</TableCell>
                                <TableCell>Endpoint</TableCell>
                                <TableCell>Modell</TableCell>
                                <TableCell>Tokens</TableCell>
                                <TableCell align="right">Kostnad</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {costData.recentTransactions.map((transaction) => (
                                <TableRow key={transaction.id}>
                                    <TableCell>
                                        {new Date(transaction.timestamp).toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                        {transaction.user_email || 'Ukjent bruker'}
                                    </TableCell>
                                    <TableCell>{transaction.endpoint}</TableCell>
                                    <TableCell>{transaction.model}</TableCell>
                                    <TableCell>{transaction.tokens_used}</TableCell>
                                    <TableCell align="right">
                                        ${transaction.cost_usd.toFixed(4)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>

                <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
                    Brukerstatistikk
                </Typography>
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Bruker</TableCell>
                                <TableCell>Antall spørringer</TableCell>
                                <TableCell align="right">Total kostnad</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {Object.entries(
                                costData.recentTransactions.reduce((acc, curr) => {
                                    const email = curr.user_email || 'Ukjent bruker';
                                    if (!acc[email]) {
                                        acc[email] = {
                                            queries: 0,
                                            cost: 0
                                        };
                                    }
                                    acc[email].queries++;
                                    acc[email].cost += parseFloat(curr.cost_usd);
                                    return acc;
                                }, {})
                            ).map(([email, stats]) => (
                                <TableRow key={email}>
                                    <TableCell>{email}</TableCell>
                                    <TableCell>{stats.queries}</TableCell>
                                    <TableCell align="right">
                                        ${stats.cost.toFixed(4)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box>
        );
    };

    const fetchCustomFields = async () => {
        try {
            const { data, error } = await supabase
                .from('course_fields')
                .select('*')
                .order('name');

            if (error) throw error;
            setCustomFields(data || []);
        } catch (error) {
            setError('Kunne ikke hente kursfelt: ' + error.message);
        }
    };

    const handleAddField = async () => {
        try {
            // Legg til felt i course_fields tabellen
            const { error: fieldError } = await supabase
                .from('course_fields')
                .insert([fieldData]);

            if (fieldError) throw fieldError;

            // Legg til kolonnen i courses tabellen
            const { error: alterError } = await supabase
                .rpc('add_column_to_courses', { 
                    column_name: fieldData.name,
                    column_type: fieldData.type 
                });

            if (alterError) throw alterError;

            setMessage(`Felt "${fieldData.name}" lagt til`);
            setShowFieldDialog(false);
            setFieldData({ name: '', type: 'text', description: '' });
            fetchCustomFields();
        } catch (error) {
            setError('Kunne ikke legge til felt: ' + error.message);
        }
    };

    const handleDeleteField = async (id) => {
        try {
            // Slett feltet fra course_fields tabellen
            const { error: deleteError } = await supabase
                .from('course_fields')
                .delete()
                .eq('id', id);

            if (deleteError) throw deleteError;

            setMessage(`Felt med ID ${id} er slettet`);
            fetchCustomFields();
        } catch (error) {
            setError('Kunne ikke slette felt: ' + error.message);
        }
    };

    return (
        <Box sx={{ width: '100%', maxWidth: 800, mx: 'auto', p: 3 }}>
            <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
                <Tab label="Opprett Bruker" />
                <Tab label="Håndter Brukere" />
                <Tab label="Statistikk" />
                <Tab label="API Kostnader" />
                <Tab label="Kursfelt" />
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
                                <TableCell>Handlinger</TableCell>
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
                                    <TableCell>
                                        <Button
                                            size="small"
                                            onClick={() => {
                                                setSelectedUser(user);
                                                setShowPasswordDialog(true);
                                            }}
                                        >
                                            Endre passord
                                        </Button>
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

            {activeTab === 3 && <CostStatistics />}

            {activeTab === 4 && (
                <Box sx={{ mt: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                        <Typography variant="h6">
                            Administrer kursfelt
                        </Typography>
                        <Button
                            startIcon={<AddIcon />}
                            variant="contained"
                            onClick={() => setShowFieldDialog(true)}
                        >
                            Legg til felt
                        </Button>
                    </Box>

                    <TableContainer component={Paper}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Feltnavn</TableCell>
                                    <TableCell>Type</TableCell>
                                    <TableCell>Beskrivelse</TableCell>
                                    <TableCell>Handlinger</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {customFields.map((field) => (
                                    <TableRow key={field.id}>
                                        <TableCell>{field.name}</TableCell>
                                        <TableCell>{field.type}</TableCell>
                                        <TableCell>{field.description}</TableCell>
                                        <TableCell>
                                            <IconButton 
                                                size="small"
                                                onClick={() => handleDeleteField(field.id)}
                                            >
                                                <DeleteIcon />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            )}

            {/* Dialog for passordendring */}
            <Dialog 
                open={showPasswordDialog} 
                onClose={() => setShowPasswordDialog(false)}
            >
                <DialogTitle>
                    Endre passord for {selectedUser?.email}
                </DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        label="Nytt passord"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        margin="normal"
                        required
                    />
                </DialogContent>
                <DialogActions>
                    <Button 
                        onClick={() => setShowPasswordDialog(false)}
                    >
                        Avbryt
                    </Button>
                    <Button 
                        onClick={handlePasswordChange}
                        variant="contained"
                        disabled={!newPassword}
                    >
                        Lagre
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Dialog for å legge til nytt felt */}
            <Dialog 
                open={showFieldDialog} 
                onClose={() => setShowFieldDialog(false)}
            >
                <DialogTitle>Legg til nytt kursfelt</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        label="Feltnavn"
                        value={fieldData.name}
                        onChange={(e) => setFieldData(prev => ({ ...prev, name: e.target.value }))}
                        margin="normal"
                        required
                        helperText="Bruk kun små bokstaver og understrek (_)"
                    />
                    <FormControl fullWidth margin="normal">
                        <InputLabel>Felttype</InputLabel>
                        <Select
                            value={fieldData.type}
                            onChange={(e) => setFieldData(prev => ({ ...prev, type: e.target.value }))}
                        >
                            <MenuItem value="text">Tekst</MenuItem>
                            <MenuItem value="number">Tall</MenuItem>
                            <MenuItem value="boolean">Ja/Nei</MenuItem>
                            <MenuItem value="date">Dato</MenuItem>
                        </Select>
                    </FormControl>
                    <TextField
                        fullWidth
                        label="Beskrivelse"
                        value={fieldData.description}
                        onChange={(e) => setFieldData(prev => ({ ...prev, description: e.target.value }))}
                        margin="normal"
                        multiline
                        rows={2}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowFieldDialog(false)}>
                        Avbryt
                    </Button>
                    <Button 
                        onClick={handleAddField}
                        variant="contained"
                        disabled={!fieldData.name || !fieldData.type}
                    >
                        Legg til
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default AdminTools; 