import React, { createContext, useContext, useState, useCallback } from 'react';

const GlobalAlertContext = createContext({
  showAlert: () => {},
  hideAlert: () => {},
});

export const useAlert = () => useContext(GlobalAlertContext);

export const GlobalAlertProvider = ({ children }) => {
  const [alert, setAlert] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  const showAlert = useCallback((message, title = 'Notification', type = 'info') => {
    setAlert({
      isOpen: true,
      title,
      message,
      type,
    });
  }, []);

  const hideAlert = useCallback(() => {
    setAlert(prev => ({ ...prev, isOpen: false }));
  }, []);

  const colorMap = {
    error: {
      bg: 'bg-red-500/10',
      icon: 'text-red-500',
      iconBg: 'bg-red-500/20',
      button: 'bg-red-500 hover:bg-red-600 shadow-red-500/20',
      border: 'border-red-500/20',
    },
    success: {
      bg: 'bg-emerald-500/10',
      icon: 'text-emerald-500',
      iconBg: 'bg-emerald-500/20',
      button: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20',
      border: 'border-emerald-500/20',
    },
    warning: {
      bg: 'bg-amber-500/10',
      icon: 'text-amber-500',
      iconBg: 'bg-amber-500/20',
      button: 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20',
      border: 'border-amber-500/20',
    },
    info: {
      bg: 'bg-bridged-teal/10',
      icon: 'text-bridged-teal',
      iconBg: 'bg-bridged-teal/20',
      button: 'bg-bridged-teal hover:opacity-95 shadow-bridged-teal/20',
      border: 'border-bridged-teal/20',
    },
  };

  const theme = colorMap[alert.type] || colorMap.info;

  return (
    <GlobalAlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      {alert.isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-bridged-primary/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="w-full max-w-sm bg-white dark:bg-bridged-primary rounded-2xl shadow-2xl border border-bridged-primary/10 dark:border-bridged-light/10 overflow-hidden transform transition-all animate-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`${theme.bg} p-5 flex items-center gap-4`}>
              <div className={`h-10 w-10 rounded-full ${theme.iconBg} flex items-center justify-center flex-shrink-0 ${theme.icon}`}>
                <i className={`fa-solid ${
                  alert.type === 'error' ? 'fa-circle-xmark' : 
                  alert.type === 'success' ? 'fa-circle-check' : 
                  alert.type === 'warning' ? 'fa-triangle-exclamation' : 
                  'fa-circle-info'
                } text-lg`} />
              </div>
              <div>
                <h3 className="text-base font-bold text-bridged-primary dark:text-bridged-light">{alert.title}</h3>
                <p className={`text-[9px] font-bold uppercase tracking-wider ${theme.icon}`}>
                  {alert.type === 'error' ? 'Attention Required' : 'System Notification'}
                </p>
              </div>
            </div>
            
            <div className="p-5">
              <p className="text-sm text-bridged-primary/70 dark:text-bridged-light/70 mb-6 leading-relaxed">
                {alert.message}
              </p>
              
              <button
                type="button"
                onClick={hideAlert}
                className={`w-full px-4 py-2.5 rounded-lg text-white text-sm font-bold shadow-lg transition-all ${theme.button}`}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </GlobalAlertContext.Provider>
  );
};
