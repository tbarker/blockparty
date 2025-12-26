import React, { useState, useEffect, useCallback } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

/**
 * Notification component using MUI Snackbar and Alert
 * Replaces react-notifications to avoid deprecated findDOMNode usage
 */
function Notification({ eventEmitter }) {
  const [notifications, setNotifications] = useState([]);

  // Map status names to MUI severity
  const getSeverity = useCallback(status => {
    switch (status) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
      default:
        return 'info';
    }
  }, []);

  useEffect(() => {
    const handleNotification = obj => {
      const id = Date.now();
      setNotifications(prev => [
        ...prev,
        {
          id,
          message: obj.message,
          severity: getSeverity(obj.status),
        },
      ]);
    };

    eventEmitter.on('notification', handleNotification);

    return () => {
      eventEmitter.off('notification', handleNotification);
    };
  }, [eventEmitter, getSeverity]);

  const handleClose = useCallback(id => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return (
    <>
      {notifications.map((notification, index) => (
        <Snackbar
          key={notification.id}
          open={true}
          autoHideDuration={5000}
          onClose={() => handleClose(notification.id)}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          sx={{ top: `${24 + index * 60}px !important` }}
        >
          <Alert
            onClose={() => handleClose(notification.id)}
            severity={notification.severity}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      ))}
    </>
  );
}

export default Notification;
