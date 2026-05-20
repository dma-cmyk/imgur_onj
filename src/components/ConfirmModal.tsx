import { AlertCircle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'はい',
  cancelText = 'いいえ',
  variant = 'primary'
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="custom-modal-overlay" onClick={onCancel}>
      <div className="custom-modal-content" onClick={e => e.stopPropagation()}>
        <div className={`custom-modal-icon ${variant}`}>
          <AlertCircle size={28} />
        </div>
        
        <h2 className="custom-modal-title">{title}</h2>
        <div className="custom-modal-message">
          {message.split('\n').map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
        
        <div className="custom-modal-actions">
          <button className="modal-btn cancel" onClick={onCancel}>
            {cancelText}
          </button>
          <button className={`modal-btn confirm ${variant}`} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
