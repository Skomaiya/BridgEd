import React from 'react';

const ConfirmationModal = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  loading = false,
  type = 'info',
}) => {
  if (!isOpen) return null;

  const colorMap = {
    danger: {
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
    info: {
      bg: 'bg-bridged-teal/10',
      icon: 'text-bridged-teal',
      iconBg: 'bg-bridged-teal/20',
      button: 'bg-bridged-teal hover:opacity-95 shadow-bridged-teal/20',
      border: 'border-bridged-teal/20',
    },
  };

  const theme = colorMap[type] || colorMap.info;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-bridged-primary/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-white dark:bg-bridged-primary rounded-2xl shadow-2xl border border-bridged-primary/10 dark:border-bridged-light/10 overflow-hidden transform transition-all animate-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`${theme.bg} p-6 flex items-center gap-4`}>
          <div className={`h-12 w-12 rounded-full ${theme.iconBg} flex items-center justify-center flex-shrink-0 ${theme.icon}`}>
            <i className={`fa-solid ${type === 'danger' ? 'fa-triangle-exclamation' : type === 'success' ? 'fa-check-circle' : 'fa-circle-info'} text-xl`} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-bridged-primary dark:text-bridged-light">{title}</h3>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${theme.icon}`}>
              {type === 'danger' ? 'High Priority Action' : 'Verification Required'}
            </p>
          </div>
        </div>
        
        <div className="p-6">
          <p className="text-sm text-bridged-primary/70 dark:text-bridged-light/70 mb-8 leading-relaxed">
            {message}
          </p>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-lg border border-bridged-primary/10 dark:border-bridged-light/10 text-sm font-semibold text-bridged-primary dark:text-bridged-light hover:bg-bridged-primary/5 dark:hover:bg-bridged-light/5 transition-colors disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 px-4 py-2.5 rounded-lg text-white text-sm font-bold shadow-lg transition-all disabled:opacity-50 ${theme.button}`}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Processing...</span>
                </div>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
