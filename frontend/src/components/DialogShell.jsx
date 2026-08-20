import { useEffect, useRef } from 'react';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function DialogShell({ children, onClose, labelledBy, describedBy, maxWidth = 'max-w-lg', panelClassName = 'p-5' }) {
    const panelRef = useRef(null);
    const previousFocus = useRef(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        previousFocus.current = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const panel = panelRef.current;
        const firstFocusable = panel?.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled])') || panel?.querySelector(FOCUSABLE);
        (firstFocusable || panel)?.focus();

        function onKeyDown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                onCloseRef.current();
                return;
            }
            if (event.key !== 'Tab' || !panel) return;
            const focusable = [...panel.querySelectorAll(FOCUSABLE)];
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }

        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
            previousFocus.current?.focus?.();
        };
    }, []);

    return (
        <div
            className="dialog-backdrop fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto p-3 sm:p-5"
            onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelledBy}
                aria-describedby={describedBy}
                tabIndex="-1"
                className={`dialog-panel w-full ${maxWidth} rounded-xl border border-slate-200 bg-white shadow-2xl ${panelClassName}`}
            >
                {children}
            </div>
        </div>
    );
}
