import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  Slide,
  useTheme,
  Skeleton,
} from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CloseIcon from '@mui/icons-material/Close';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import { apiUrl } from './LoginSignup';

// Slide transition for the modal
const SlideTransition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const PaymentReminders = ({ onOpenBooking }) => {
  const theme = useTheme();
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const userSession = JSON.parse(localStorage.getItem('userSession'));

  useEffect(() => {
    fetchPaymentReminders();
  }, []);

  const fetchPaymentReminders = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiUrl}/booking/payment-reminders`, {
        headers: { authorization: userSession?.token }
      });
      
      if (res.ok) {
        const data = await res.json();
        setPendingCount(data.count || 0);
        setPendingBookings(data.bookings || []);
      }
    } catch (error) {
      console.error('Error fetching payment reminders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = () => {
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  const handleBookingClick = (bookingId) => {
    if (onOpenBooking) {
      onOpenBooking(bookingId);
    }
    handleCloseModal();
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'critical':
        return '#dc2626'; // Red
      case 'high':
        return '#ea580c'; // Orange
      case 'medium':
        return '#ca8a04'; // Yellow
      default:
        return '#16a34a'; // Green
    }
  };

  const getUrgencyBgColor = (urgency) => {
    const isDark = theme.palette.mode === 'dark';
    switch (urgency) {
      case 'critical':
        return isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(220, 38, 38, 0.08)';
      case 'high':
        return isDark ? 'rgba(249, 115, 22, 0.15)' : 'rgba(234, 88, 12, 0.08)';
      case 'medium':
        return isDark ? 'rgba(234, 179, 8, 0.15)' : 'rgba(202, 138, 4, 0.08)';
      default:
        return isDark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(22, 163, 74, 0.08)';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Banner Component
  const PaymentBanner = () => (
    <Paper
      elevation={0}
      sx={{
        background: theme.palette.mode === 'dark'
          ? 'linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)'
          : 'linear-gradient(135deg, #fef2f2 0%, #fff5f5 100%)',
        border: `1px solid ${theme.palette.mode === 'dark' ? '#991b1b' : '#fecaca'}`,
        borderRadius: 2,
        p: 2,
        mb: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        flexWrap: { xs: 'wrap', sm: 'nowrap' },
        transition: 'all 0.3s ease',
        '&:hover': {
          boxShadow: theme.palette.mode === 'dark'
            ? '0 4px 20px rgba(220, 38, 38, 0.3)'
            : '0 4px 20px rgba(220, 38, 38, 0.1)',
          transform: 'translateY(-1px)',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <NotificationsActiveIcon sx={{ color: 'white', fontSize: 22 }} />
        </Box>
        <Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              color: theme.palette.mode === 'dark' ? '#fca5a5' : '#991b1b',
              fontSize: { xs: '1rem', sm: '1.25rem' },
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            {loading ? <Skeleton width={40} /> : pendingCount} Payments to collect
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: theme.palette.mode === 'dark' ? '#fca5a5' : '#7f1d1d',
              fontSize: '0.85rem',
              mt: 0.3,
            }}
          >
            Pending collections that need follow-up from the team.
          </Typography>
        </Box>
      </Box>

      <Button
        variant="contained"
        onClick={handleOpenModal}
        endIcon={<ArrowForwardIcon />}
        sx={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
          borderRadius: 2,
          px: 3,
          py: 1,
          textTransform: 'none',
          fontWeight: 600,
          boxShadow: '0 4px 14px rgba(124, 58, 237, 0.4)',
          '&:hover': {
            background: 'linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%)',
            boxShadow: '0 6px 20px rgba(124, 58, 237, 0.5)',
          },
        }}
      >
        View All
      </Button>
    </Paper>
  );

  // Alert Card Component for Modal
  const AlertCard = ({ booking }) => {
    const urgencyColor = getUrgencyColor(booking.urgency);
    const urgencyBgColor = getUrgencyBgColor(booking.urgency);

    return (
      <Paper
        elevation={0}
        sx={{
          background: urgencyBgColor,
          border: `1px solid ${urgencyColor}${theme.palette.mode === 'dark' ? '40' : '30'}`,
          borderRadius: 3,
          p: 2.5,
          mb: 2,
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          '&:hover': {
            transform: 'translateX(4px)',
            boxShadow: theme.palette.mode === 'dark'
              ? `0 4px 12px rgba(0,0,0,0.4)`
              : `0 4px 12px ${urgencyColor}20`,
          },
        }}
        onClick={() => handleBookingClick(booking._id)}
      >
        {/* Alert Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1.5 }}>
          {booking.urgency === 'critical' ? (
            <ErrorOutlineIcon sx={{ color: urgencyColor, fontSize: 20 }} />
          ) : booking.urgency === 'high' ? (
            <WarningAmberIcon sx={{ color: urgencyColor, fontSize: 20 }} />
          ) : (
            <AccessTimeIcon sx={{ color: urgencyColor, fontSize: 20 }} />
          )}
          <Typography
            variant="body2"
            sx={{
              color: urgencyColor,
              fontWeight: 600,
              flex: 1,
              fontSize: '0.85rem',
            }}
          >
            {booking.alert_message}
          </Typography>
        </Box>

        {/* Company Name */}
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            color: theme.palette.mode === 'dark' ? '#f1f5f9' : '#1e293b',
            mb: 1.5,
            fontSize: { xs: '1rem', sm: '1.1rem' },
          }}
        >
          {booking.company_name || booking.contact_person}
        </Typography>

        {/* Amount Chips */}
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
          <Chip
            icon={<MonetizationOnIcon sx={{ fontSize: 16 }} />}
            label={formatCurrency(booking.total_amount)}
            size="small"
            sx={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              color: 'white',
              fontWeight: 600,
              '& .MuiChip-icon': { color: 'white' },
            }}
          />
          <Chip
            icon={<CheckCircleOutlineIcon sx={{ fontSize: 16 }} />}
            label={formatCurrency(booking.received_amount)}
            size="small"
            sx={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              fontWeight: 600,
              '& .MuiChip-icon': { color: 'white' },
            }}
          />
          <Chip
            icon={<WarningAmberIcon sx={{ fontSize: 16 }} />}
            label={formatCurrency(booking.pending_amount)}
            size="small"
            sx={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: 'white',
              fontWeight: 600,
              '& .MuiChip-icon': { color: 'white' },
            }}
          />
        </Box>

        {/* Service Tag */}
        <Chip
          label={Array.isArray(booking.services) ? booking.services[0] : booking.services}
          size="small"
          sx={{
            background: theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.15)',
            color: theme.palette.mode === 'dark' ? '#a78bfa' : '#7c3aed',
            fontWeight: 500,
            fontSize: '0.75rem',
          }}
        />
      </Paper>
    );
  };

  return (
    <>
      <PaymentBanner />

      {/* Payment Alerts Modal */}
      <Dialog
        open={modalOpen}
        onClose={handleCloseModal}
        fullScreen
        TransitionComponent={SlideTransition}
        sx={{
          '& .MuiDialog-paper': {
            background: theme.palette.mode === 'dark' 
              ? 'linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%)' 
              : 'linear-gradient(180deg, #f5f3ff 0%, #ffffff 100%)',
          },
        }}
      >
        {/* Header */}
        <DialogTitle
          sx={{
            background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
            color: 'white',
            p: 2.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MonetizationOnIcon sx={{ fontSize: 26 }} />
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, fontSize: '1.25rem' }}>
                Payment Alerts
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, fontSize: '0.85rem' }}>
                {pendingCount} pending collection{pendingCount !== 1 ? 's' : ''}
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={handleCloseModal}
            sx={{
              color: 'white',
              '&:hover': { background: 'rgba(255,255,255,0.2)' },
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          {loading ? (
            <Box sx={{ mt: 2 }}>
              {[1, 2, 3].map((i) => (
                <Skeleton
                  key={i}
                  variant="rounded"
                  height={140}
                  sx={{ mb: 2, borderRadius: 3 }}
                />
              ))}
            </Box>
          ) : pendingBookings.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 400,
                textAlign: 'center',
              }}
            >
              <Box
                sx={{
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 3,
                }}
              >
                <CheckCircleOutlineIcon sx={{ fontSize: 60, color: 'white' }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#10b981', mb: 1 }}>
                All Caught Up! 🎉
              </Typography>
              <Typography variant="body1" color="text.secondary">
                No pending payments to collect. Great job!
              </Typography>
            </Box>
          ) : (
            <>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  mb: 2,
                  fontSize: '0.85rem',
                }}
              >
                Sorted by longest waiting time (most urgent first)
              </Typography>
              {pendingBookings.map((booking) => (
                <AlertCard key={booking._id} booking={booking} />
              ))}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PaymentReminders;
