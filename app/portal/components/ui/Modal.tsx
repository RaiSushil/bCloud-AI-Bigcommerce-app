import { X } from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";

interface ModalProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, onClose, children }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="bc-modal-backdrop">
      {/* Clicking the dimmed area closes the dialog; Escape does the same. */}
      <button type="button" className="bc-modal-scrim" onClick={onClose} aria-label="Close dialog" tabIndex={-1} />
      <div className="bc-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="bc-modal-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="bc-icon-btn" onClick={onClose} aria-label="Close">
            <X aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
