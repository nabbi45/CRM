import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const normalizeRole = (role = '') => role.toString().trim().toLowerCase();
const MANAGER_ROLES = ['hr', 'admin', 'super admin', 'dev', 'srdev', 'senior admin'];

const formatDateInput = (value) => {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
};

const EmployeeProfiles = ({ apiUrl, userSession }) => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [hasOwnProfile, setHasOwnProfile] = useState(false);

  const [profileOptions, setProfileOptions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');

  const [formState, setFormState] = useState({
    dateOfJoining: '',
    reportingManager: '',
    offeredSalary: '',
    totalWorkExperience: '',
    compensationDetails: {
      ctc: '',
      basicSalary: '',
      variablePay: '',
      currency: 'INR',
    },
  });

  const [documentFiles, setDocumentFiles] = useState({
    experienceLetter: null,
    offerLetter: null,
    joiningLetter: null,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const canEdit = MANAGER_ROLES.includes(normalizeRole(userSession?.user_role));

  const selectedProfile = useMemo(() => {
    if (!selectedUserId) return null;
    return employees.find((emp) => emp.userId === selectedUserId) || null;
  }, [employees, selectedUserId]);

  const loadData = async () => {
    if (!userSession?.token) return;
    setLoading(true);
    setError('');

    try {
      const headers = { authorization: userSession.token };

      const [ownRes, optionsRes, allRes] = await Promise.all([
        axios.get(`${apiUrl}/employee/profile/${userSession.user_id}`, { headers }).catch(() => ({ data: {} })),
        axios.get(`${apiUrl}/employee/options`, { headers }),
        axios.get(`${apiUrl}/employee/all`, { headers }),
      ]);

      setHasOwnProfile(!!ownRes?.data?.profile);

      const options = Array.isArray(optionsRes?.data?.users) ? optionsRes.data.users : [];
      const all = Array.isArray(allRes?.data?.employees) ? allRes.data.employees : [];

      setProfileOptions(options);
      setEmployees(all);

      const initialSelected = options[0]?.user_id || '';
      setSelectedUserId((prev) => prev || initialSelected);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load employee profiles data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [apiUrl, userSession?.token, userSession?.user_id]);

  useEffect(() => {
    if (!selectedProfile) return;
    setFormState({
      dateOfJoining: formatDateInput(selectedProfile.dateOfJoining),
      reportingManager: selectedProfile.reportingManager || '',
      offeredSalary: selectedProfile.offeredSalary || '',
      totalWorkExperience: selectedProfile.totalWorkExperience || '',
      compensationDetails: {
        ctc: selectedProfile?.compensationDetails?.ctc || '',
        basicSalary: selectedProfile?.compensationDetails?.basicSalary || '',
        variablePay: selectedProfile?.compensationDetails?.variablePay || '',
        currency: selectedProfile?.compensationDetails?.currency || 'INR',
      },
    });
    setDocumentFiles({
      experienceLetter: null,
      offerLetter: null,
      joiningLetter: null,
    });
  }, [selectedProfile]);

  const handleSave = async () => {
    if (!selectedProfile?.userId || !canEdit) return;
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = new FormData();
      payload.append('dateOfJoining', formState.dateOfJoining || '');
      payload.append('reportingManager', formState.reportingManager || '');
      payload.append('offeredSalary', formState.offeredSalary || '');
      payload.append('totalWorkExperience', formState.totalWorkExperience || '');
      payload.append('compensationDetails', JSON.stringify(formState.compensationDetails || {}));

      if (documentFiles.experienceLetter) payload.append('experienceLetter', documentFiles.experienceLetter);
      if (documentFiles.offerLetter) payload.append('offerLetter', documentFiles.offerLetter);
      if (documentFiles.joiningLetter) payload.append('joiningLetter', documentFiles.joiningLetter);

      await axios.put(`${apiUrl}/employee/update/${selectedProfile.userId}`, payload, {
        headers: { authorization: userSession.token },
      });

      setSuccess('Employee profile details updated successfully.');
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.message || 'Failed to update employee profile.');
    } finally {
      setSaving(false);
    }
  };

  const detailDisabled = !hasOwnProfile;

  if (loading) {
    return <Box sx={{ p: 3 }}><Typography>Loading Employee Profiles...</Typography></Box>;
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>Employee Profiles</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Create your profile first. After that, employee details/documents are visible to all and editable only by HR/Admin/Super Admin/Dev.
      </Typography>

      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 2, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 } }}>
        <Tab label="Dashboard" />
        <Tab label="Employee Details" />
      </Tabs>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {success ? <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert> : null}

      {tab === 0 && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <PersonAddAlt1OutlinedIcon />
                  <Typography variant="h6">Create Profile</Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Submit your own employee profile details.
                </Typography>
                <Button variant="contained" fullWidth onClick={() => navigate('/dashboard/create-profile')}>
                  Open Create Profile
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <PeopleAltOutlinedIcon />
                  <Typography variant="h6">Fill Employee Details</Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Choose employees (only profile-created users) and view/update details.
                </Typography>
                <Button variant="outlined" fullWidth onClick={() => setTab(1)} disabled={detailDisabled}>
                  Open Details
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <DescriptionOutlinedIcon />
                  <Typography variant="h6">Documents & Compensation</Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  View all docs and compensation. Edit/upload allowed only for manager roles.
                </Typography>
                <Chip label={canEdit ? 'Edit Access' : 'View Only'} color={canEdit ? 'success' : 'default'} />
              </CardContent>
            </Card>
          </Grid>

          {!hasOwnProfile && (
            <Grid item xs={12}>
              <Alert severity="info">
                Please create your own profile first. Employee detail operations unlock after profile creation.
              </Alert>
            </Grid>
          )}
        </Grid>
      )}

      {tab === 1 && (
        <Paper sx={{ p: 2 }}>
          {!hasOwnProfile ? (
            <Alert severity="info">Create your profile first to access employee details.</Alert>
          ) : (
            <>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={8}>
                  <FormControl fullWidth>
                    <InputLabel>Select Employee</InputLabel>
                    <Select
                      label="Select Employee"
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                    >
                      {profileOptions.map((opt) => (
                        <MenuItem key={opt.user_id} value={opt.user_id}>
                          {opt.name} ({opt.employeeId || 'N/A'})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Chip label={canEdit ? 'Editable by your role' : 'View only for your role'} color={canEdit ? 'success' : 'default'} sx={{ mt: 1.5 }} />
                </Grid>
              </Grid>

              {selectedProfile ? (
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Date of Joining"
                      type="date"
                      InputLabelProps={{ shrink: true }}
                      fullWidth
                      value={formState.dateOfJoining}
                      onChange={(e) => setFormState((prev) => ({ ...prev, dateOfJoining: e.target.value }))}
                      disabled={!canEdit}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Reporting Manager"
                      fullWidth
                      value={formState.reportingManager}
                      onChange={(e) => setFormState((prev) => ({ ...prev, reportingManager: e.target.value }))}
                      disabled={!canEdit}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Offered Salary"
                      fullWidth
                      value={formState.offeredSalary}
                      onChange={(e) => setFormState((prev) => ({ ...prev, offeredSalary: e.target.value }))}
                      disabled={!canEdit}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Total Work Experience"
                      fullWidth
                      value={formState.totalWorkExperience}
                      onChange={(e) => setFormState((prev) => ({ ...prev, totalWorkExperience: e.target.value }))}
                      disabled={!canEdit}
                    />
                  </Grid>

                  <Grid item xs={12}><Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Compensation Details</Typography></Grid>
                  <Grid item xs={12} md={3}>
                    <TextField label="CTC" fullWidth value={formState.compensationDetails.ctc} disabled={!canEdit}
                      onChange={(e) => setFormState((prev) => ({ ...prev, compensationDetails: { ...prev.compensationDetails, ctc: e.target.value } }))} />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField label="Basic Salary" fullWidth value={formState.compensationDetails.basicSalary} disabled={!canEdit}
                      onChange={(e) => setFormState((prev) => ({ ...prev, compensationDetails: { ...prev.compensationDetails, basicSalary: e.target.value } }))} />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField label="Variable Pay" fullWidth value={formState.compensationDetails.variablePay} disabled={!canEdit}
                      onChange={(e) => setFormState((prev) => ({ ...prev, compensationDetails: { ...prev.compensationDetails, variablePay: e.target.value } }))} />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField label="Currency" fullWidth value={formState.compensationDetails.currency} disabled={!canEdit}
                      onChange={(e) => setFormState((prev) => ({ ...prev, compensationDetails: { ...prev.compensationDetails, currency: e.target.value } }))} />
                  </Grid>

                  <Grid item xs={12}><Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Documents</Typography></Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>Experience Letter</Typography>
                    {selectedProfile.experienceLetter ? <a href={selectedProfile.experienceLetter} target="_blank" rel="noreferrer">View current</a> : <Typography variant="caption">Not uploaded</Typography>}
                    {canEdit && <TextField type="file" fullWidth sx={{ mt: 1 }} inputProps={{ accept: '.pdf,.doc,.docx,image/*' }} onChange={(e) => setDocumentFiles((prev) => ({ ...prev, experienceLetter: e.target.files?.[0] || null }))} />}
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>Offer Letter</Typography>
                    {selectedProfile.offerLetter ? <a href={selectedProfile.offerLetter} target="_blank" rel="noreferrer">View current</a> : <Typography variant="caption">Not uploaded</Typography>}
                    {canEdit && <TextField type="file" fullWidth sx={{ mt: 1 }} inputProps={{ accept: '.pdf,.doc,.docx,image/*' }} onChange={(e) => setDocumentFiles((prev) => ({ ...prev, offerLetter: e.target.files?.[0] || null }))} />}
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>Joining Letter</Typography>
                    {selectedProfile.joiningLetter ? <a href={selectedProfile.joiningLetter} target="_blank" rel="noreferrer">View current</a> : <Typography variant="caption">Not uploaded</Typography>}
                    {canEdit && <TextField type="file" fullWidth sx={{ mt: 1 }} inputProps={{ accept: '.pdf,.doc,.docx,image/*' }} onChange={(e) => setDocumentFiles((prev) => ({ ...prev, joiningLetter: e.target.files?.[0] || null }))} />}
                  </Grid>

                  {canEdit && (
                    <Grid item xs={12}>
                      <Button variant="contained" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Employee Details'}
                      </Button>
                    </Grid>
                  )}
                </Grid>
              ) : (
                <Alert severity="info">No employee profile found.</Alert>
              )}
            </>
          )}
        </Paper>
      )}
    </Box>
  );
};

export default EmployeeProfiles;
