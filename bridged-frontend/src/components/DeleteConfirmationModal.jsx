const DeleteConfirmationModal = ({ target, onCancel, onConfirm, processing }) => {
  if (!target) return null;
  
  const isJob = target.type === 'job';
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-bridged-primary/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-bridged-primary rounded-2xl shadow-2xl border border-red-500/20 overflow-hidden transform transition-all animate-in fade-in zoom-in duration-200">
        <div className="bg-red-500/10 p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 text-red-500">
            <i className="fa-solid fa-triangle-exclamation text-xl" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-bridged-primary dark:text-bridged-light">
              Delete {isJob ? 'Job Listing' : 'User Account'}?
            </h3>
            <p className="text-xs text-red-500 font-medium uppercase tracking-wider">Irreversible Action</p>
          </div>
        </div>
        
        <div className="p-6">
          <p className="text-sm text-bridged-primary/70 dark:text-bridged-light/70 mb-2 leading-relaxed">
            Are you absolutely sure you want to delete <strong className="text-bridged-primary dark:text-bridged-light">{target.name}</strong>?
          </p>
          <p className="text-xs text-bridged-primary/50 dark:text-bridged-light/50 mb-8">
            {isJob 
              ? 'This listing will be removed from all student dashboards and matches.'
              : 'This will permanently delete the user and all associated data across the platform.'}
          </p>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={processing}
              className="flex-1 px-4 py-2.5 rounded-lg border border-bridged-primary/10 dark:border-bridged-light/10 text-sm font-semibold text-bridged-primary dark:text-bridged-light hover:bg-bridged-primary/5 dark:hover:bg-bridged-light/5 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm(target.id)}
              disabled={processing}
              className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 text-white text-sm font-bold hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all disabled:opacity-50"
            >
              {processing ? 'Deleting...' : 'Yes, Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
