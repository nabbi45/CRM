import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  CircularProgress,
  Badge,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import { apiUrl } from './LoginSignup';
import { canAccessFeature, isHigherAuthority } from '../utils/featureAccess';

const DOCUMENT_TYPES = [
  { key: 'agreement', label: 'Agreement', color: '#8b5cf6' },
  { key: 'pitch_deck', label: 'Pitch Deck', color: '#06b6d4' },
  { key: 'dpr', label: 'DPR', color: '#f59e0b' },
  { key: 'application', label: 'Application', color: '#10b981' },
  { key: 'others', label: 'Others', color: '#64748b' },
];

const ProcessDocuments = () => {
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState({
    agreement: 0,
    pitch_deck: 0,
    dpr: 0,
    application: 0,
    others: 0,
    totalBookings: 0
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [userSession, setUserSession] = useState(null);
  
  // Dialog states
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [viewDocumentsDialogOpen, setViewDocumentsDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadType, setUploadType] = useState('others');
  const [documentNotes, setDocumentNotes] = useState('');
  const [selectedDocumentForNotes, setSelectedDocumentForNotes] = useState(null);
  const [documentTypeFilter, setDocumentTypeFilter] = useState(null);

  useEffect(() => {
    const session = JSON.parse(localStorage.getItem('userSession'));
    setUserSession(session);
  }, []);

  const fetchData = useCallback(async () => {
    if (!userSession?.token) return;
    
    setLoading(true);
    try {
      // Fetch stats
      const statsRes = await fetch(`${apiUrl}/booking-documents/stats`, {
        headers: { authorization: userSession.token }
      });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // Fetch bookings with documents
      const bookingsRes = await fetch(`${apiUrl}/booking-documents/all?limit=50`, {
        headers: { authorization: userSession.token }
      });
      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json();
        setBookings(bookingsData);
      }
    } catch (error) {
      enqueueSnackbar('Error loading documents data. Please try again.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [userSession]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = async () => {
    if (!userSession?.token) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/booking-documents/all?search=${encodeURIComponent(searchQuery)}&limit=50`, {
        headers: { authorization: userSession.token }
      });
      if (res.ok) {
        const data = await res.json();
        setBookings(data);
      }
    } catch (error) {
      enqueueSnackbar('Error searching documents. Please try again.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const canManageDocuments = () => {
    return isHigherAuthority(userSession) || 
           canAccessFeature(userSession, 'manage_documents') ||
           canAccessFeature(userSession, 'edit_documents');
  };

  const openUploadDialog = (booking) => {
    setSelectedBooking(booking);
    setUploadFiles([]);
    setUploadType('others');
    setUploadDialogOpen(true);
  };

  const openNotesDialog = (booking, doc) => {
    setSelectedBooking(booking);
    setSelectedDocumentForNotes(doc);
    setDocumentNotes(doc.notes || '');
    setNotesDialogOpen(true);
  };

  const openViewDocumentsDialog = async (booking, docTypeFilter = null) => {
    setSelectedBooking(booking);
    setDocumentTypeFilter(docTypeFilter);
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/booking-documents/booking/${booking._id}`, {
        headers: { authorization: userSession.token }
      });
      if (res.ok) {
        const docs = await res.json();
        // Filter by document type if specified
        const filteredDocs = docTypeFilter 
          ? docs.filter(d => d.documentType === docTypeFilter)
          : docs;
        setSelectedDocuments(filteredDocs);
        setViewDocumentsDialogOpen(true);
      }
    } catch (error) {
      enqueueSnackbar('Error loading documents', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setUploadFiles(files);
  };

  const handleUpload = async () => {
    if (!uploadFiles.length || !selectedBooking) return;

    let uploaded = 0;
    let failed = 0;

    for (const file of uploadFiles) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('bookingId', selectedBooking._id);
        formData.append('documentType', uploadType);
        formData.append('notes', '');

        const res = await fetch(`${apiUrl}/booking-documents/upload`, {
          method: 'POST',
          headers: { authorization: userSession.token },
          body: formData
        });

        if (res.ok) {
          uploaded++;
        } else {
          failed++;
        }
      } catch (err) {
        failed++;
      }
    }

    if (uploaded > 0) {
      enqueueSnackbar(`${uploaded} document(s) uploaded successfully`, { variant: 'success' });
    }
    if (failed > 0) {
      enqueueSnackbar(`${failed} document(s) failed to upload`, { variant: 'warning' });
    }

    setUploadDialogOpen(false);
    fetchData();
  };

  const handleSaveNotes = async () => {
    if (!selectedDocumentForNotes) return;

    try {
      const res = await fetch(`${apiUrl}/booking-documents/${selectedDocumentForNotes._id}/notes`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: userSession.token
        },
        body: JSON.stringify({ notes: documentNotes })
      });

      if (res.ok) {
        enqueueSnackbar('Notes saved successfully', { variant: 'success' });
        setNotesDialogOpen(false);
        if (viewDocumentsDialogOpen) {
          openViewDocumentsDialog(selectedBooking);
        }
      } else {
        enqueueSnackbar('Failed to save notes', { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar('Error saving notes', { variant: 'error' });
    }
  };

  const handleDeleteDocument = async (doc) => {
    if (!doc || !doc._id) {
      enqueueSnackbar('Invalid document', { variant: 'error' });
      return;
    }

    if (!canManageDocuments()) {
      enqueueSnackbar('You do not have permission to delete documents', { variant: 'warning' });
      return;
    }

    if (!window.confirm('Are you sure you want to delete this document?')) return;

    try {
      const res = await fetch(`${apiUrl}/booking-documents/${doc._id}`, {
        method: 'DELETE',
        headers: { authorization: userSession.token }
      });

      if (res.ok) {
        enqueueSnackbar('Document deleted successfully', { variant: 'success' });
        openViewDocumentsDialog(selectedBooking);
        fetchData();
      } else {
        enqueueSnackbar('Failed to delete document', { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar('Error deleting document', { variant: 'error' });
    }
  };

  const downloadDocument = (doc) => {
    if (!doc || !doc.fileUrl) {
      enqueueSnackbar('Invalid document or no file available', { variant: 'error' });
      return;
    }
    window.open(doc.fileUrl, '_blank');
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const StatCard = ({ title, count, total, color }) => {
    const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
    
    return (
      <Card
        sx={{
          borderRadius: 3,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          },
          background: (theme) => theme.palette.mode === 'dark' 
            ? 'rgba(30, 41, 59, 0.8)' 
            : 'rgba(255, 255, 255, 0.9)',
          border: (theme) => `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
        }}
      >
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'text.secondary', 
              mb: 1,
              fontWeight: 500,
              fontSize: '0.85rem'
            }}
          >
            {title}
          </Typography>
          <Typography 
            variant="h3" 
            sx={{ 
              color: color,
              fontWeight: 700,
              fontSize: '2rem',
              lineHeight: 1.2
            }}
          >
            {count}
          </Typography>
          <Typography 
            variant="caption" 
            sx={{ 
              color: 'text.disabled',
              fontSize: '0.75rem'
            }}
          >
            {percentage}%
          </Typography>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1600, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Process Documents
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {stats.totalBookings} bookings found
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {DOCUMENT_TYPES.map((type) => (
          <Grid item xs={12} sm={6} md={2.4} key={type.key}>
            <StatCard
              title={type.label}
              count={stats[type.key] || 0}
              total={Object.values(stats).reduce((a, b) => a + b, 0) - stats.totalBookings}
              color={type.color}
            />
          </Grid>
        ))}
      </Grid>

      {/* Search Bar */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 3,
          display: 'flex',
          gap: 2,
          alignItems: 'center',
          background: (theme) => theme.palette.mode === 'dark'
            ? 'rgba(30, 41, 59, 0.6)'
            : 'rgba(255, 255, 255, 0.8)',
          border: (theme) => `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
        }}
      >
        <TextField
          fullWidth
          placeholder="Search by company name or mobile number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
          size="small"
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
            }
          }}
        />
        <Button
          variant="contained"
          onClick={handleSearch}
          sx={{
            borderRadius: 2,
            px: 3,
            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
            }
          }}
        >
          Search
        </Button>
        <IconButton onClick={fetchData} sx={{ color: 'text.secondary' }}>
          <RefreshIcon />
        </IconButton>
      </Paper>

      {/* Bookings Table */}
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          borderRadius: 3,
          border: (theme) => `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
          overflow: 'hidden',
        }}
      >
        <Table>
          <TableHead>
            <TableRow sx={{ background: (theme) => theme.palette.mode === 'dark' ? 'rgba(30,41,59,0.8)' : '#f8fafc' }}>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>Company</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>Phone</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>Services</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>Received</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>Date</TableCell>
              {DOCUMENT_TYPES.map(type => (
                <TableCell 
                  key={type.key}
                  align="center"
                  sx={{ 
                    fontWeight: 600, 
                    fontSize: '0.7rem', 
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    color: type.color,
                    minWidth: 60
                  }}
                >
                  {type.label.split(' ')[0]}
                </TableCell>
              ))}
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={14} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={32} />
                </TableCell>
              </TableRow>
            ) : bookings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No bookings found
                </TableCell>
              </TableRow>
            ) : (
              bookings.map((booking) => (
                <TableRow 
                  key={booking._id}
                  sx={{ 
                    '&:hover': { 
                      background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' 
                    }
                  }}
                >
                  <TableCell>
                    <Badge
                      variant="dot"
                      color={booking.status === 'Completed' ? 'success' : booking.status === 'Pending' ? 'warning' : 'default'}
                      sx={{ mr: 1 }}
                    />
                    {booking.status || 'Pending'}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {booking.company_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {booking.contact_person}
                    </Typography>
                  </TableCell>
                  <TableCell>{booking.contact_no}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(booking.services || []).slice(0, 2).map((service, i) => (
                        <Chip 
                          key={i} 
                          label={service} 
                          size="small" 
                          sx={{ fontSize: '0.7rem', height: 20 }}
                        />
                      ))}
                      {(booking.services || []).length > 2 && (
                        <Chip 
                          label={`+${booking.services.length - 2}`}
                          size="small"
                          sx={{ fontSize: '0.7rem', height: 20 }}
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>₹{booking.total_amount?.toLocaleString()}</TableCell>
                  <TableCell>
                    <Typography color="success.main" fontWeight={500}>
                      ₹{((booking.term_1 || 0) + (booking.term_2 || 0) + (booking.term_3 || 0))?.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {booking.date ? new Date(booking.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                  </TableCell>
                  {DOCUMENT_TYPES.map(type => {
                    const count = booking.documentCounts?.[type.key] || 0;
                    const hasDocs = count > 0;
                    
                    return (
                      <TableCell key={type.key} align="center">
                        <Button
                          size="small"
                          onClick={() => {
                            if (hasDocs) {
                              // View documents filtered by type
                              openViewDocumentsDialog(booking, type.key);
                            } else {
                              // Open upload dialog with this type pre-selected
                              setSelectedBooking(booking);
                              setUploadType(type.key);
                              setUploadDialogOpen(true);
                            }
                          }}
                          sx={{
                            minWidth: 32,
                            height: 28,
                            px: 1,
                            fontSize: '0.85rem',
                            fontWeight: hasDocs ? 600 : 400,
                            color: hasDocs ? type.color : 'text.disabled',
                            backgroundColor: hasDocs ? `${type.color}15` : 'transparent',
                            border: `1px solid ${hasDocs ? type.color : 'transparent'}`,
                            borderRadius: 1.5,
                            '&:hover': {
                              backgroundColor: hasDocs ? `${type.color}25` : 'action.hover',
                              borderColor: hasDocs ? type.color : 'divider',
                            },
                          }}
                        >
                          {count}
                        </Button>
                      </TableCell>
                    );
                  })}
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="View Documents">
                        <IconButton 
                          size="small" 
                          onClick={() => openViewDocumentsDialog(booking)}
                          sx={{ color: '#8b5cf6' }}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Upload Document">
                        <IconButton 
                          size="small" 
                          onClick={() => openUploadDialog(booking)}
                          sx={{ color: '#10b981' }}
                        >
                          <CloudUploadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Document Notes">
                        <IconButton 
                          size="small"
                          sx={{ color: '#f59e0b' }}
                          onClick={() => {
                            const docs = Object.values(booking.documents || {}).flat();
                            if (docs.length > 0) {
                              openNotesDialog(booking, docs[0]);
                            } else {
                              enqueueSnackbar('No documents to add notes', { variant: 'info' });
                            }
                          }}
                        >
                          <NoteAddIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Upload Document - {selectedBooking?.company_name}
          <IconButton
            onClick={() => setUploadDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
            <InputLabel>Document Type</InputLabel>
            <Select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value)}
              label="Document Type"
            >
              {DOCUMENT_TYPES.map(type => (
                <MenuItem key={type.key} value={type.key}>{type.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            component="label"
            variant="outlined"
            startIcon={<CloudUploadIcon />}
            fullWidth
            sx={{ py: 2, borderStyle: 'dashed' }}
          >
            Select Files
            <input type="file" hidden multiple onChange={handleFileSelect} />
          </Button>
          {uploadFiles.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Selected files:
              </Typography>
              {uploadFiles.map((file, i) => (
                <Chip
                  key={i}
                  icon={<DescriptionIcon />}
                  label={`${file.name} (${formatFileSize(file.size)})`}
                  onDelete={() => setUploadFiles(uploadFiles.filter((_, idx) => idx !== i))}
                  sx={{ m: 0.5 }}
                  size="small"
                />
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleUpload} 
            variant="contained"
            disabled={uploadFiles.length === 0}
          >
            Upload
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Documents Dialog */}
      <Dialog 
        open={viewDocumentsDialogOpen} 
        onClose={() => setViewDocumentsDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          Documents - {selectedBooking?.company_name}
          <IconButton
            onClick={() => setViewDocumentsDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedDocuments.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                {documentTypeFilter 
                  ? `No ${DOCUMENT_TYPES.find(t => t.key === documentTypeFilter)?.label} documents found for this booking`
                  : 'No documents found for this booking'
                }
              </Typography>
              <Button
                variant="contained"
                startIcon={<CloudUploadIcon />}
                onClick={() => {
                  setViewDocumentsDialogOpen(false);
                  setUploadType(documentTypeFilter || 'others');
                  setUploadDialogOpen(true);
                }}
                sx={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  },
                }}
              >
                Upload Document
              </Button>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>File Name</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Uploaded By</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedDocuments.map((doc) => (
                    <TableRow key={doc._id}>
                      <TableCell>
                        <Chip
                          label={DOCUMENT_TYPES.find(t => t.key === doc.documentType)?.label || doc.documentType}
                          size="small"
                          sx={{
                            bgcolor: DOCUMENT_TYPES.find(t => t.key === doc.documentType)?.color + '20',
                            color: DOCUMENT_TYPES.find(t => t.key === doc.documentType)?.color,
                            fontWeight: 500,
                            fontSize: '0.75rem'
                          }}
                        />
                      </TableCell>
                      <TableCell>{doc.fileName}</TableCell>
                      <TableCell>{formatFileSize(doc.fileSize)}</TableCell>
                      <TableCell>{doc.uploadedByName}</TableCell>
                      <TableCell>
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                          <Tooltip title="Download">
                            <IconButton 
                              size="small" 
                              onClick={() => downloadDocument(doc)}
                              sx={{ color: '#3b82f6' }}
                            >
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Notes">
                            <IconButton 
                              size="small"
                              onClick={() => openNotesDialog(selectedBooking, doc)}
                              sx={{ color: '#f59e0b' }}
                            >
                              <NoteAddIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {canManageDocuments() && (
                            <Tooltip title="Delete">
                              <IconButton 
                                size="small"
                                onClick={() => handleDeleteDocument(doc)}
                                sx={{ color: '#ef4444' }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDocumentsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Notes Dialog */}
      <Dialog open={notesDialogOpen} onClose={() => setNotesDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Document Notes
          <IconButton
            onClick={() => setNotesDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {selectedDocumentForNotes?.fileName}
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Notes"
            value={documentNotes}
            onChange={(e) => setDocumentNotes(e.target.value)}
            placeholder="Add notes about this document..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotesDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveNotes} variant="contained">Save Notes</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProcessDocuments;
