import React, { useEffect, useState } from 'react';
import { apiUrl } from '../components/LoginSignup';
import { Button } from '@mui/material';
import { enqueueSnackbar } from 'notistack';

const Trash = () => {
  const [trashedBookings, setTrashedBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const userSession = JSON.parse(localStorage.getItem('userSession'));

  useEffect(() => {
    fetch(`${apiUrl}/booking/trash`, {
      headers: {
        Authorization: userSession?.token,
        'user-role': userSession?.user_role,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTrashedBookings(data);
        } else {
          enqueueSnackbar(data.message || 'Failed to load trash.', { variant: 'error' });
          setTrashedBookings([]);
        }
      })
      .catch(() => {
        enqueueSnackbar('Failed to load trash.', { variant: 'error' });
        setTrashedBookings([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleRestore = (id) => {
    fetch(`${apiUrl}/booking/restore/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: userSession?.token,
        'user-role': userSession?.user_role,
      },
    })
      .then((res) => res.json())
      .then(() => {
        enqueueSnackbar('Booking restored!', { variant: 'success' });
        setTrashedBookings((prev) => prev.filter((b) => b._id !== id));
      });
  };

  const handleDeletePermanent = (id) => {
    fetch(`${apiUrl}/booking/deletebooking/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: userSession?.token,
        'user-role': userSession?.user_role,
      },
    })
      .then((res) => res.json())
      .then(() => {
        enqueueSnackbar('Booking permanently deleted!', { variant: 'info' });
        setTrashedBookings((prev) => prev.filter((b) => b._id !== id));
      });
  };

  const handleEmptyTrash = () => {
    if (!window.confirm("Are you sure you want to permanently delete ALL items in the trash? This cannot be undone.")) {
      return;
    }

    setLoading(true);
    fetch(`${apiUrl}/booking/emptytrash`, {
      method: 'DELETE',
      headers: {
        Authorization: userSession?.token,
        'user-role': userSession?.user_role,
      },
    })
      .then((res) => res.json())
      .then(() => {
        enqueueSnackbar('Trash emptied successfully!', { variant: 'info' });
        setTrashedBookings([]);
      })
      .catch(() => {
        enqueueSnackbar('Failed to empty trash.', { variant: 'error' });
      })
      .finally(() => setLoading(false));
  };

  if (loading) return <p>Loading trashed bookings...</p>;

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Trashed Bookings</h2>
        {trashedBookings.length > 0 && (
          <Button
            variant="contained"
            color="error"
            onClick={handleEmptyTrash}
          >
            Empty Trash
          </Button>
        )}
      </div>

      {trashedBookings.length === 0 ? (
        <p>No trashed bookings.</p>
      ) : (
        trashedBookings.map((booking) => (
          <div
            key={booking._id}
            style={{
              border: '1px solid #ccc',
              padding: '10px',
              marginBottom: '15px',
              borderRadius: '6px',
            }}
          >
            <strong>{booking.company_name}</strong> – {booking.email}
            <br />
            <small>Deleted At: {new Date(booking.deletedAt).toLocaleString()}</small>
            <br />
            <small>
              Deleted By: <strong>{booking.deletedBy || "N/A"}</strong>
            </small>

            <br />
            <Button
              variant="outlined"
              color="success"
              size="small"
              onClick={() => handleRestore(booking._id)}
              sx={{ marginRight: 1, marginTop: 1 }}
            >
              Restore
            </Button>
            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={() => handleDeletePermanent(booking._id)}
              sx={{ marginTop: 1 }}
            >
              Delete Permanently
            </Button>
          </div>
        ))
      )}
    </div>
  );
};

export default Trash;
