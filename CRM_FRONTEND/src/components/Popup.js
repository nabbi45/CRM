import React from 'react';
import './Popup.css';

const Popup = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null; // If popup is not open, return null

  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <button className="popup-close" onClick={onClose}>
          &times;
        </button>
        {children} {/* This will render the form passed as children */}
      </div>
    </div>
  );
};

export default Popup;
