import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Select,
  MenuItem,
  TextField,
  IconButton,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import DescriptionIcon from '@mui/icons-material/Description';
import { enqueueSnackbar } from 'notistack';
import { apiUrl } from './LoginSignup';

const STAGE_KEYS = {
  agreementSent: { label: 'Agreement Sent', docType: 'fa_agreement_sent', sla: 'within 2 days' },
  agreementReceived: { label: 'Agreement Received', docType: 'fa_agreement_received', sla: 'within 5 days' },
  dprPitchDeckDataCollection: { label: 'DPR & Pitch deck data Collection', docType: 'fa_dpr_data', sla: 'within 24 hours after Agreement Received' },
  dpr: { label: 'DPR', docType: 'fa_dpr', sla: '10 days after Collection Received' },
  pitchDeck: { label: 'Pitch Deck', docType: 'fa_pitch_deck', sla: '10 days after Collection Received' },
  applicationDetailsCoordination: { label: 'Application Details Coordination', docType: 'fa_app_coordination', sla: 'within 10 days of Agreement Received' },
};

const FileActivityTable = ({ booking, userSession, isAdmin }) => {
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  
  // Dialog States
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadStage, setUploadStage] = useState(null); // { key, docType, serviceName? }
  const [uploadFiles, setUploadFiles] = useState([]);
  
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewDocs, setViewDocs] = useState([]);

  useEffect(() => {
    if (booking && booking._id) {
      fetchActivity();
      fetchDocuments();
    }
  }, [booking]);

  const fetchActivity = async () => {
    try {
      const res = await fetch(`${apiUrl}/file-activity/${booking._id}`, {
        headers: { authorization: userSession.token }
      });
      if (res.ok) {
        const data = await res.json();
        setActivity(data);
      }
    } catch (error) {
      console.error('Failed to fetch file activity', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${apiUrl}/booking-documents/booking/${booking._id}`, {
        headers: { authorization: userSession.token }
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error('Failed to fetch documents', error);
    }
  };

  const handleStatusChange = async (type, key, value, serviceName = null) => {
    if (!isAdmin) return;
    
    let updates = {};
    if (type === 'stage') {
      updates = { stages: { [key]: { status: value } } };
      setActivity(prev => ({
        ...prev,
        stages: { ...prev.stages, [key]: { ...prev.stages[key], status: value } }
      }));
    } else if (type === 'application') {
      updates = { application: [{ serviceName, status: value }] };
      setActivity(prev => ({
        ...prev,
        application: prev.application.map(s => s.serviceName === serviceName ? { ...s, status: value } : s)
      }));
    } else if (type === 'acknowledgement') {
      updates = { acknowledgement: [{ serviceName, status: value }] };
      setActivity(prev => ({
        ...prev,
        acknowledgement: prev.acknowledgement.map(s => s.serviceName === serviceName ? { ...s, status: value } : s)
      }));
    }

    try {
      await fetch(`${apiUrl}/file-activity/${booking._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: userSession.token,
          'user-role': userSession.user_role
        },
        body: JSON.stringify(updates)
      });
      enqueueSnackbar('Status updated', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar('Failed to update status', { variant: 'error' });
      fetchActivity(); // Revert on failure
    }
  };

  const handleTextUpdate = async (field, value) => {
    if (!isAdmin) return;

    try {
      await fetch(`${apiUrl}/file-activity/${booking._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: userSession.token,
          'user-role': userSession.user_role
        },
        body: JSON.stringify({ [field]: value })
      });
      enqueueSnackbar('Saved', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar('Failed to save', { variant: 'error' });
    }
  };

  // Upload Logic
  const handleOpenUpload = (stageConfig) => {
    if (!isAdmin) return;
    setUploadStage(stageConfig);
    setUploadFiles([]);
    setUploadDialogOpen(true);
  };

  const handleFileSelect = (e) => {
    setUploadFiles(Array.from(e.target.files));
  };

  const handleUploadSubmit = async () => {
    if (!uploadFiles.length || !uploadStage) return;

    let uploaded = 0;
    for (const file of uploadFiles) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bookingId', booking._id);
      formData.append('documentType', uploadStage.docType);
      
      let note = `Uploaded to ${uploadStage.label}`;
      if (uploadStage.serviceName) {
        note += ` (${uploadStage.serviceName})`;
      }
      formData.append('notes', note);

      try {
        const res = await fetch(`${apiUrl}/booking-documents/upload`, {
          method: 'POST',
          headers: { authorization: userSession.token },
          body: formData
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          uploaded++;
        } else {
          console.error('Upload failed', data);
          enqueueSnackbar(data.message || `Failed to upload ${file.name}`, { variant: 'error' });
        }
      } catch (err) {
        console.error('Upload err', err);
        enqueueSnackbar(`Failed to upload ${file.name}`, { variant: 'error' });
      }
    }

    if (uploaded > 0) {
      enqueueSnackbar(`${uploaded} file(s) uploaded successfully`, { variant: 'success' });
      fetchDocuments();
    } else {
      enqueueSnackbar(`Upload failed`, { variant: 'error' });
    }

    setUploadDialogOpen(false);
  };

  const handleViewDocs = (docType, serviceName = null) => {
    // Filter documents by docType and optionally by serviceName substring in notes
    let filtered = documents.filter(d => d.documentType === docType);
    if (serviceName) {
      filtered = filtered.filter(d => d.notes?.includes(serviceName));
    }
    
    if (filtered.length === 0) {
      enqueueSnackbar('No documents uploaded for this stage', { variant: 'info' });
      return;
    }

    setViewDocs(filtered);
    setViewDialogOpen(true);
  };

  if (loading || !activity) {
    return <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress /></Box>;
  }

  // Helper to render standard stage cell
  const renderStageCell = (key, config) => {
    const stageData = activity.stages[key] || {};
    const hasDocs = documents.some(d => d.documentType === config.docType);

    return (
      <TableCell sx={{ minWidth: 200, verticalAlign: 'top', borderRight: '1px solid rgba(0,0,0,0.05)' }}>
        <Typography variant="subtitle2" fontWeight="bold">{config.label}</Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1, fontStyle: 'italic' }}>
          {config.sla}
        </Typography>
        
        {isAdmin && (
          <Select
            size="small"
            fullWidth
            value={stageData.status || 'Pending'}
            onChange={(e) => handleStatusChange('stage', key, e.target.value)}
            sx={{ mb: 1, fontSize: '0.85rem' }}
          >
            <MenuItem value="Pending">Pending</MenuItem>
            <MenuItem value="In Progress">In Progress</MenuItem>
            <MenuItem value="Completed">Completed</MenuItem>
          </Select>
        )}
        {!isAdmin && (
          <Chip 
            size="small" 
            label={stageData.status || 'Pending'} 
            color={stageData.status === 'Completed' ? 'success' : stageData.status === 'In Progress' ? 'warning' : 'default'}
            sx={{ mb: 1, width: '100%' }} 
          />
        )}

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button 
            size="small" 
            variant="outlined" 
            startIcon={<CloudUploadIcon />}
            onClick={() => handleOpenUpload(config)}
            disabled={!isAdmin}
            fullWidth
          >
            Upload
          </Button>
          <Button 
            size="small" 
            variant="outlined" 
            color={hasDocs ? 'primary' : 'inherit'}
            onClick={() => handleViewDocs(config.docType)}
          >
            <VisibilityIcon fontSize="small" />
          </Button>
        </Box>
      </TableCell>
    );
  };

  // Helper to render Service Arrays (Application & Acknowledgement)
  const renderServiceArray = (type, title, sla, docType) => {
    const services = activity[type] || [];
    return (
      <TableCell sx={{ minWidth: 250, verticalAlign: 'top', borderRight: '1px solid rgba(0,0,0,0.05)' }}>
        <Typography variant="subtitle2" fontWeight="bold">{title}</Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1, fontStyle: 'italic' }}>
          {sla}
        </Typography>
        
        {services.length === 0 && <Typography variant="caption" color="text.secondary">No services</Typography>}
        
        {services.map((svc, idx) => {
          const hasDocs = documents.some(d => d.documentType === docType && d.notes?.includes(svc.serviceName));
          return (
            <Box key={idx} sx={{ mb: 2, p: 1, bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 1 }}>
              <Typography variant="caption" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>
                {svc.serviceName}
              </Typography>
              
              {isAdmin && (
                <Select
                  size="small"
                  fullWidth
                  value={svc.status || 'Pending'}
                  onChange={(e) => handleStatusChange(type, null, e.target.value, svc.serviceName)}
                  sx={{ mb: 1, fontSize: '0.8rem' }}
                >
                  <MenuItem value="Pending">Pending</MenuItem>
                  <MenuItem value="In Progress">In Progress</MenuItem>
                  <MenuItem value="Completed">Completed</MenuItem>
                </Select>
              )}
              {!isAdmin && (
                <Chip 
                  size="small" 
                  label={svc.status || 'Pending'} 
                  color={svc.status === 'Completed' ? 'success' : svc.status === 'In Progress' ? 'warning' : 'default'}
                  sx={{ mb: 1, width: '100%', height: 20, fontSize: '0.7rem' }} 
                />
              )}

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button 
                  size="small" 
                  variant="outlined" 
                  onClick={() => handleOpenUpload({ label: title, docType, serviceName: svc.serviceName })}
                  disabled={!isAdmin}
                  sx={{ minWidth: 0, p: 0.5, flexGrow: 1 }}
                >
                  <CloudUploadIcon fontSize="small" />
                </Button>
                <Button 
                  size="small" 
                  variant="outlined" 
                  color={hasDocs ? 'primary' : 'inherit'}
                  onClick={() => handleViewDocs(docType, svc.serviceName)}
                  sx={{ minWidth: 0, p: 0.5, flexGrow: 1 }}
                >
                  <VisibilityIcon fontSize="small" />
                </Button>
              </Box>
            </Box>
          );
        })}
      </TableCell>
    );
  };

  return (
    <Box>
      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid rgba(0,0,0,0.1)', overflowX: 'auto' }}>
        <Table>
          <TableBody>
            <TableRow>
              {renderStageCell('agreementSent', STAGE_KEYS.agreementSent)}
              {renderStageCell('agreementReceived', STAGE_KEYS.agreementReceived)}
              {renderStageCell('dprPitchDeckDataCollection', STAGE_KEYS.dprPitchDeckDataCollection)}
              {renderStageCell('dpr', STAGE_KEYS.dpr)}
              {renderStageCell('pitchDeck', STAGE_KEYS.pitchDeck)}
              {renderStageCell('applicationDetailsCoordination', STAGE_KEYS.applicationDetailsCoordination)}
              
              {renderServiceArray('application', 'Application', 'Within 5 days after App Data Coordination', 'fa_application_service')}
              {renderServiceArray('acknowledgement', 'Acknowledgement', 'Within 1 day after application done', 'fa_acknowledgement_service')}
              
              <TableCell sx={{ minWidth: 250, verticalAlign: 'top', borderRight: '1px solid rgba(0,0,0,0.05)' }}>
                <Typography variant="subtitle2" fontWeight="bold">Any Updates</Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  Visible to BDMs
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  minRows={4}
                  value={activity.anyUpdates || ''}
                  onChange={(e) => setActivity({...activity, anyUpdates: e.target.value})}
                  onBlur={(e) => handleTextUpdate('anyUpdates', e.target.value)}
                  disabled={!isAdmin}
                  InputProps={{ style: { fontSize: '0.85rem' } }}
                />
              </TableCell>

              {isAdmin && (
                <TableCell sx={{ minWidth: 250, verticalAlign: 'top' }}>
                  <Typography variant="subtitle2" fontWeight="bold">Notes (Client ID & Password)</Typography>
                  <Typography variant="caption" color="error" display="block" sx={{ mb: 1 }}>
                    Hidden from BDMs
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    minRows={4}
                    value={activity.adminNotes || ''}
                    onChange={(e) => setActivity({...activity, adminNotes: e.target.value})}
                    onBlur={(e) => handleTextUpdate('adminNotes', e.target.value)}
                    InputProps={{ style: { fontSize: '0.85rem' } }}
                  />
                </TableCell>
              )}
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          Upload to {uploadStage?.label}
          <IconButton onClick={() => setUploadDialogOpen(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {uploadStage?.serviceName && (
            <Typography variant="body2" color="primary" sx={{ mb: 2, fontWeight: 'bold' }}>
              Service: {uploadStage.serviceName}
            </Typography>
          )}
          <Button component="label" variant="outlined" fullWidth sx={{ py: 3, borderStyle: 'dashed' }}>
            <CloudUploadIcon sx={{ mr: 1 }} /> Select Files
            <input type="file" hidden multiple onChange={handleFileSelect} />
          </Button>
          {uploadFiles.length > 0 && (
            <Box sx={{ mt: 2 }}>
              {uploadFiles.map((f, i) => (
                <Typography key={i} variant="caption" display="block">{f.name}</Typography>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUploadSubmit} disabled={!uploadFiles.length}>
            Upload
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Documents Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Documents
          <IconButton onClick={() => setViewDialogOpen(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {viewDocs.map(doc => (
            <Box key={doc._id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, borderBottom: '1px solid #eee' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DescriptionIcon color="primary" />
                <Box>
                  <Typography variant="body2">{doc.fileName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </Typography>
                </Box>
              </Box>
              <Button size="small" variant="outlined" onClick={() => window.open(doc.fileUrl, '_blank')}>
                Download
              </Button>
            </Box>
          ))}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default FileActivityTable;
