import * as React from 'react';
import { cn } from '@/lib/utils/cn';

interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | undefined>(undefined);

function useDialogContext() {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error('Dialog components must be used within a Dialog');
  }
  return context;
}

const DialogTitleIdContext = React.createContext<string | undefined>(undefined);

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Dialog({ open = false, onOpenChange, children }: DialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(open);

  const isControlled = onOpenChange !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setOpen = isControlled ? onOpenChange : setInternalOpen;

  return (
    <DialogContext.Provider value={{ open: isOpen, onOpenChange: setOpen }}>
      {children}
    </DialogContext.Provider>
  );
}

function DialogTrigger({
  children,
  asChild,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const { onOpenChange } = useDialogContext();

  if (asChild && React.isValidElement<{ onClick?: () => void }>(children)) {
    return React.cloneElement(children, {
      onClick: () => onOpenChange(true),
    });
  }

  return (
    <button type="button" onClick={() => onOpenChange(true)} {...props}>
      {children}
    </button>
  );
}

function DialogPortal({ children }: { children: React.ReactNode }) {
  const { open } = useDialogContext();
  if (!open) return null;

  return <>{children}</>;
}

function DialogOverlay({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { onOpenChange } = useDialogContext();

  return (
    <button
      type="button"
      aria-label="ダイアログを閉じる"
      className={cn(
        'fixed inset-0 z-50 bg-black/80 border-0 p-0',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        className,
      )}
      // ダイアログ内部のクリックで閉じるのを避けるため、オーバーレイ自身だけを対象にする。
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
      {...props}
    />
  );
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]';

const getTabbables = (root: HTMLElement): HTMLElement[] => {
  // 原則フォーカス可能な要素を集めたうえで、明示的にタブ順から外したものを除外する。
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.tabIndex !== -1,
  );
};

function DialogContent({
  className,
  children,
  'aria-labelledby': ariaLabelledBy,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const generatedId = React.useId();
  const titleId = ariaLabelledBy ?? generatedId;
  const { open, onOpenChange } = useDialogContext();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);
  // 親の再レンダーでフォーカスをトリガーへ戻さないため、開閉処理は ref 経由で参照する。
  const onOpenChangeRef = React.useRef(onOpenChange);
  React.useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  // モーダル外へ Tab が抜けたり Escape が効かなくなったりしないよう、文書全体で制御する。
  React.useEffect(() => {
    if (!open) return;
    const previousFocus = (document.activeElement as HTMLElement | null) ?? null;
    previousFocusRef.current = previousFocus;
    const content = contentRef.current;
    if (content) {
      const tabbables = getTabbables(content);
      if (tabbables.length > 0) {
        tabbables[0].focus();
      } else {
        // フォーカス可能な子がない場合でも、支援技術がモーダル外へ戻らないようにする。
        content.focus();
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // ブラウザ既定動作と親ダイアログへの伝播を抑え、意図しない多重クローズを防ぐ。
        event.preventDefault();
        event.stopPropagation();
        onOpenChangeRef.current(false);
        return;
      }
      if (event.key !== 'Tab' || !content) return;
      const tabbables = getTabbables(content);
      if (tabbables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = tabbables[0];
      const last = tabbables[tabbables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // 操作の文脈を失わないよう、開いた要素へフォーカスを戻す。
      previousFocusRef.current?.focus?.();
    };
  }, [open]);

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogTitleIdContext.Provider value={titleId}>
        <div
          ref={contentRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          // フォーカス可能な子がない場合の退避先として、コンテナ自身をフォーカス可能にする。
          tabIndex={-1}
          className={cn(
            'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%]',
            'gap-4 border bg-background p-6 shadow-lg duration-200',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
            'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
            'sm:rounded-lg',
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </DialogTitleIdContext.Provider>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
      {...props}
    />
  );
}

function DialogTitle({ className, id, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  const titleIdFromContext = React.useContext(DialogTitleIdContext);
  const resolvedId = id ?? titleIdFromContext;

  return (
    <h2
      id={resolvedId}
      className={cn('text-[1.125rem] font-semibold leading-tight tracking-tight', className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-[0.9375rem] text-muted-foreground leading-relaxed', className)}
      {...props}
    />
  );
}

function DialogClose({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { onOpenChange } = useDialogContext();

  return (
    <button type="button" onClick={() => onOpenChange(false)} {...props}>
      {children}
    </button>
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
