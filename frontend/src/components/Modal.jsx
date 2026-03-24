export default function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  return (
    <div className="modal-shell" onClick={handleOverlayClick}>
      <div className="modal-card">
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-form">
          {children}
        </div>
      </div>
    </div>
  );
}
