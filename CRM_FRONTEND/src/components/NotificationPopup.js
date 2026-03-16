import React, { useEffect, useState } from 'react';
import './NotificationPopup.css';

const NotificationPopup = ({ isOpen, message, type, duration = 1000 }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);

      // Automatically close the popup after `duration` (1 second by default)
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, duration);

      return () => clearTimeout(timer); // Cleanup timer when the component unmounts or is updated
    }
  }, [isOpen, duration]);

  if (!isOpen && !isVisible) return null; // Hide the component if it's not open or not visible

  return (
    <div className={`notification-popup ${isVisible ? 'show' : ''} ${type}`}>
      <div className="notification-content">
        <p>{message}</p>
      </div>
    </div>
  );
};

export default NotificationPopup;
