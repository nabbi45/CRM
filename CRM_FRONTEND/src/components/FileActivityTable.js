import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Select,
  MenuItem,
  TextField,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  useTheme,
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

const STATUS_STYLES = {
  Pending: { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' },
  'In Progress': { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  Completed: { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
  Sent: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  Received: { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
};

const TECHNICAL_SERVICE_ENDINGS = [
  'REPORT',
  'WEBSITE',
  'CERTIFICATE',
  'CODE',
  'LICENSE',
  'REGISTRATION',
  'INCORPORATION',
  'CREATION',
  'DSC',
];

const isTechnicalOnlyService = (service = '') => {
  const upper = String(service || '').trim().toUpperCase();
  if (!upper) return false;
  if (upper.includes('ISO')) return true;
  return TECHNICAL_SERVICE_ENDINGS.some((ending) => upper.endsWith(ending));
};

const isTechnicalOnlyBooking = (services = []) => {
  const normalized = Array.isArray(services) ? services.filter(Boolean) : [];
  return normalized.length > 0 && normalized.every((service) => isTechnicalOnlyService(service));
};

const SENT_RECEIVED_STAGES = new Set([
  'dprPitchDeckDataCollection',
  'applicationDetailsCoordination',
  'acknowledgement',
]);

const getStatusOptions = (key) =>
  SENT_RECEIVED_STAGES.has(key)
    ? ['Sent', 'Received']
    : ['Pending', 'In Progress', 'Completed'];

const isPreviewableDocument = (doc = {}) => {
  const mime = String(doc.mimeType || '').toLowerCase();
  const name = String(doc.fileName || '').toLowerCase();
  return mime.startsWith('image/') || mime === 'application/pdf' || name.endsWith('.pdf');
};

const FileActivityTable = ({ booking, userSession, isAdmin }) => {
  const theme = useTheme();
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  
  // Dialog States
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadStage, setUploadStage] = useState(null); // { key, docType, serviceName? }
  const [uploadFiles, setUploadFiles] = useState([]);
  
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewDocs, setViewDocs] = useState([]);
  const technicalOnlyBooking = isTechnicalOnlyBooking(booking?.services || []);

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

  const openDocumentPreview = async (doc) => {
    if (!doc?.fileUrl) {
      enqueueSnackbar('Document URL not found', { variant: 'error' });
      return;
    }

    if (!isPreviewableDocument(doc)) {
      await handleDocumentDownload(doc);
      return;
    }

    try {
      const response = await fetch(doc.fileUrl);
      if (!response.ok) throw new Error('Failed to fetch document');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (error) {
      console.error('Preview failed', error);
      window.open(doc.fileUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDocumentDownload = async (doc) => {
    if (!doc?.fileUrl) {
      enqueueSnackbar('Document URL not found', { variant: 'error' });
      return;
    }

    try {
      const response = await fetch(doc.fileUrl);
      if (!response.ok) throw new Error('Failed to fetch document');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = doc.fileName || 'document';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Download failed', error);
      enqueueSnackbar(`Failed to download ${doc.fileName || 'document'}`, { variant: 'error' });
    }
  };

  if (loading || !activity) {
    return <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress /></Box>;
  }

  const statusChip = (status = 'Pending') => {
    const style = STATUS_STYLES[status] || STATUS_STYLES.Pending;
    return (
      <Chip
        size="small"
        label={status}
        sx={{
          bgcolor: style.bg,
          color: style.color,
          border: `1px solid ${style.border}`,
          fontWeight: 700,
          height: 28,
        }}
      />
    );
  };

  const ActionButtons = ({ config, hasDocs, compact = false }) => (
    <Box sx={{ display: 'flex', gap: 1, mt: 1.25 }}>
      <Button
        size="small"
        variant="outlined"
        startIcon={<CloudUploadIcon />}
        onClick={() => handleOpenUpload(config)}
        disabled={!isAdmin}
        sx={{
          flex: 1,
          borderColor: '#fecaca',
          color: '#dc2626',
          minHeight: compact ? 34 : 38,
          fontWeight: 700,
          '&:hover': { borderColor: '#ef4444', bgcolor: '#fef2f2' },
        }}
      >
        Upload
      </Button>
      <Button
        size="small"
        variant="outlined"
        color={hasDocs ? 'primary' : 'inherit'}
        onClick={() => handleViewDocs(config.docType, config.serviceName)}
        sx={{ minWidth: compact ? 42 : 48, minHeight: compact ? 34 : 38 }}
      >
        <VisibilityIcon fontSize="small" />
      </Button>
    </Box>
  );

  // Helper to render standard stage card
  const renderStageCard = (key, config) => {
    const stageData = activity.stages[key] || {};
    const hasDocs = documents.some(d => d.documentType === config.docType);

    return (
      <Paper
        key={key}
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: '8px',
          bgcolor: theme.palette.mode === 'dark' ? 'rgba(15,23,42,0.9)' : '#ffffff',
          borderColor: theme.palette.mode === 'dark' ? 'rgba(148,163,184,0.18)' : '#e5e7eb',
          minHeight: 172,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start', mb: 0.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#111827', lineHeight: 1.25 }}>
              {config.label}
            </Typography>
            {hasDocs && <Chip size="small" label={documents.filter(d => d.documentType === config.docType).length} color="primary" sx={{ height: 22, minWidth: 30 }} />}
          </Box>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5, fontStyle: 'italic', minHeight: 18 }}>
            {config.sla}
          </Typography>
        </Box>

        {isAdmin && (
          <Select
            size="small"
            fullWidth
            value={stageData.status || getStatusOptions(key)[0]}
            onChange={(e) => handleStatusChange('stage', key, e.target.value)}
            sx={{ fontSize: '0.85rem', bgcolor: '#f9fafb', borderRadius: 1.5 }}
          >
            {getStatusOptions(key).map((option) => (
              <MenuItem key={option} value={option}>{option}</MenuItem>
            ))}
          </Select>
        )}
        {!isAdmin && (
          <Box sx={{ mb: 0.25 }}>{statusChip(stageData.status || getStatusOptions(key)[0])}</Box>
        )}

        <ActionButtons config={config} hasDocs={hasDocs} />
      </Paper>
    );
  };

  // Helper to render Service Arrays (Application & Acknowledgement)
  const renderServiceGroup = (type, title, sla, docType) => {
    const services = activity[type] || [];
    return (
      <Paper key={type} variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#ffffff', borderColor: '#e5e7eb' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#111827' }}>{title}</Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5, fontStyle: 'italic' }}>
          {sla}
        </Typography>

        {services.length === 0 ? (
          <Box sx={{ py: 2, textAlign: 'center', color: 'text.secondary', border: '1px dashed #d1d5db', borderRadius: 1.5 }}>
            <Typography variant="caption">No services for this stage</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gap: 1.25 }}>
            {services.map((svc, idx) => {
              const hasDocs = documents.some(d => d.documentType === docType && d.notes?.includes(svc.serviceName));
              const config = { label: title, docType, serviceName: svc.serviceName };
              return (
                <Box key={`${svc.serviceName}-${idx}`} sx={{ p: 1.25, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#f9fafb', border: '1px solid', borderColor: theme.palette.mode === 'dark' ? 'rgba(148,163,184,0.15)' : '#eef2f7', borderRadius: '8px' }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#111827', display: 'block', mb: 0.75 }}>
                    {svc.serviceName}
                  </Typography>

                  {isAdmin ? (
                    <Select
                      size="small"
                      fullWidth
                      value={svc.status || getStatusOptions(type)[0]}
                      onChange={(e) => handleStatusChange(type, null, e.target.value, svc.serviceName)}
                      sx={{ fontSize: '0.8rem', bgcolor: '#fff', borderRadius: 1.5 }}
                    >
                      {getStatusOptions(type).map((option) => (
                        <MenuItem key={option} value={option}>{option}</MenuItem>
                      ))}
                    </Select>
                  ) : (
                    statusChip(svc.status || getStatusOptions(type)[0])
                  )}

                  <ActionButtons config={config} hasDocs={hasDocs} compact />
                </Box>
              );
            })}
          </Box>
        )}
      </Paper>
    );
  };

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#111827' }}>File Activity</Typography>
          <Typography variant="body2" color="text.secondary">Track agreement, DPR, pitch deck, applications, and acknowledgement work.</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {statusChip('Pending')}
          {statusChip('In Progress')}
          {statusChip('Completed')}
          {statusChip('Sent')}
          {statusChip('Received')}
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(3, minmax(0, 1fr))',
          },
          gap: 1.5,
        }}
      >
        {renderStageCard('agreementSent', STAGE_KEYS.agreementSent)}
        {renderStageCard('agreementReceived', STAGE_KEYS.agreementReceived)}
        {!technicalOnlyBooking && renderStageCard('dprPitchDeckDataCollection', STAGE_KEYS.dprPitchDeckDataCollection)}
        {!technicalOnlyBooking && renderStageCard('dpr', STAGE_KEYS.dpr)}
        {!technicalOnlyBooking && renderStageCard('pitchDeck', STAGE_KEYS.pitchDeck)}
        {renderStageCard('applicationDetailsCoordination', STAGE_KEYS.applicationDetailsCoordination)}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
          gap: 1.5,
        }}
      >
        {renderServiceGroup('application', 'Application', 'Within 5 days after App Data Coordination', 'fa_application_service')}
        {renderServiceGroup('acknowledgement', 'Acknowledgement', 'Within 1 day after application done', 'fa_acknowledgement_service')}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: isAdmin ? 'repeat(2, minmax(0, 1fr))' : '1fr' },
          gap: 1.5,
        }}
      >
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#ffffff', borderColor: '#e5e7eb' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Any Updates</Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Visible to BDMs
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={4}
            value={activity.anyUpdates || ''}
            onChange={(e) => setActivity({ ...activity, anyUpdates: e.target.value })}
            onBlur={(e) => handleTextUpdate('anyUpdates', e.target.value)}
            disabled={!isAdmin}
            InputProps={{ style: { fontSize: '0.9rem' } }}
          />
        </Paper>

        {isAdmin && (
          <Paper variant="outlined" sx={{ p: 2, borderRadius: '8px', bgcolor: theme.palette.mode === 'dark' ? 'rgba(15,23,42,0.9)' : '#ffffff', borderColor: theme.palette.mode === 'dark' ? 'rgba(148,163,184,0.18)' : '#e5e7eb' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Notes (Client ID & Password)</Typography>
            <Typography variant="caption" color="error" display="block" sx={{ mb: 1 }}>
              Hidden from BDMs
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={4}
              value={activity.adminNotes || ''}
              onChange={(e) => setActivity({ ...activity, adminNotes: e.target.value })}
              onBlur={(e) => handleTextUpdate('adminNotes', e.target.value)}
              InputProps={{ style: { fontSize: '0.9rem' } }}
            />
          </Paper>
        )}
      </Box>

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
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button size="small" variant="outlined" onClick={() => openDocumentPreview(doc)}>
                  View
                </Button>
                <Button size="small" variant="contained" onClick={() => handleDocumentDownload(doc)}>
                  Download
                </Button>
              </Box>
            </Box>
          ))}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default FileActivityTable;
