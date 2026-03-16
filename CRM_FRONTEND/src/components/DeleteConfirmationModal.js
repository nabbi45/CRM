import React, { useEffect, useState } from 'react';
import './DeleteConfirmationModal.css';

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true); // Show the modal when isOpen is true
    } else {
      setIsVisible(false); // Hide the modal when isOpen is false
    }
  }, [isOpen]);

  if (!isOpen && !isVisible) return null;

  return (
    <div className={`delete-confirmation-modal ${isVisible ? 'slide-up' : ''}`}>
      <div className="modal-content">
        <h2 style={{color:'white'}}>Confirm Deletion</h2>
        <p>Are you sure you want to delete this booking?</p>
        <div className="modal-actions">
          <button onClick={onConfirm} className="btn-confirm">Yes</button>
          <button onClick={onClose} className="btn-cancel">No</button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
