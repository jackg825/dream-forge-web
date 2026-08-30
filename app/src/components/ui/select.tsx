'use client';

import * as React from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectContextType {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean, restoreFocus?: boolean) => void;
  disabled: boolean;
  contentId: string;
  selectedLabel?: React.ReactNode;
  registerItem: (value: string, label: React.ReactNode) => () => void;
}

const SelectContext = React.createContext<SelectContextType | null>(null);

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}

function Select({ value, onValueChange, children, disabled = false }: SelectProps) {
  const [open, setOpenState] = React.useState(false);
  const [labels, setLabels] = React.useState(() => new Map<string, React.ReactNode>());
  const contentId = React.useId();

  const setOpen = React.useCallback((nextOpen: boolean, restoreFocus = true) => {
    if (disabled && nextOpen) return;
    setOpenState(nextOpen);
    if (!nextOpen && restoreFocus) {
      requestAnimationFrame(() => {
        document.querySelector<HTMLButtonElement>(`button[aria-controls="${contentId}"]`)?.focus();
      });
    }
  }, [contentId, disabled]);

  const registerItem = React.useCallback((itemValue: string, label: React.ReactNode) => {
    setLabels((current) => {
      const next = new Map(current);
      next.set(itemValue, label);
      return next;
    });
    return () => {
      setLabels((current) => {
        const next = new Map(current);
        next.delete(itemValue);
        return next;
      });
    };
  }, []);

  return (
    <SelectContext.Provider
      value={{
        value,
        onValueChange,
        open,
        setOpen,
        disabled,
        contentId,
        selectedLabel: labels.get(value),
        registerItem,
      }}
    >
      <div className={cn('relative', disabled && 'opacity-50')}>{children}</div>
    </SelectContext.Provider>
  );
}

interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

function SelectTrigger({ className, children, onKeyDown, ...props }: SelectTriggerProps) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('SelectTrigger must be used within Select');

  return (
    <button
      type="button"
      aria-haspopup="listbox"
      aria-expanded={context.open}
      aria-controls={context.contentId}
      disabled={context.disabled}
      onClick={() => context.setOpen(!context.open)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
          event.preventDefault();
          context.setOpen(true, false);
        }
        if (event.key === 'Escape') context.setOpen(false);
      }}
      className={cn(
        'flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background',
        'focus:outline-none focus:ring-1 focus:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        '[&>span]:line-clamp-1',
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 opacity-50" aria-hidden="true" />
    </button>
  );
}

function SelectValue({ placeholder }: { placeholder?: string }) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('SelectValue must be used within Select');
  return <span>{context.selectedLabel ?? (context.value || placeholder)}</span>;
}

function SelectContent({ children }: { children: React.ReactNode }) {
  const context = React.useContext(SelectContext);
  const contentRef = React.useRef<HTMLDivElement>(null);
  if (!context) throw new Error('SelectContent must be used within Select');

  React.useEffect(() => {
    if (!context.open) return;
    requestAnimationFrame(() => {
      const selected = contentRef.current?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]');
      const first = contentRef.current?.querySelector<HTMLElement>('[role="option"]');
      (selected || first)?.focus();
    });
  }, [context.open]);

  // Keep items mounted while closed so SelectValue can render their visible
  // label instead of leaking the raw stored value (for example "TW").
  if (!context.open) return <div id={context.contentId} role="listbox" hidden>{children}</div>;

  const moveFocus = (direction: 1 | -1) => {
    const options = Array.from(contentRef.current?.querySelectorAll<HTMLElement>('[role="option"]') || []);
    if (options.length === 0) return;
    const index = options.indexOf(document.activeElement as HTMLElement);
    const nextIndex = index < 0 ? 0 : (index + direction + options.length) % options.length;
    options[nextIndex].focus();
  };

  return (
    <>
      <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => context.setOpen(false)} />
      <div
        ref={contentRef}
        id={context.contentId}
        role="listbox"
        className="absolute z-50 mt-1 max-h-60 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            moveFocus(1);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            moveFocus(-1);
          } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            const options = contentRef.current?.querySelectorAll<HTMLElement>('[role="option"]');
            options?.[event.key === 'Home' ? 0 : options.length - 1]?.focus();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            context.setOpen(false);
          } else if (event.key === 'Tab') {
            context.setOpen(false, false);
          } else if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
            const options = Array.from(contentRef.current?.querySelectorAll<HTMLElement>('[role="option"]') || []);
            const query = event.key.toLocaleLowerCase();
            const currentIndex = options.indexOf(document.activeElement as HTMLElement);
            const ordered = [...options.slice(currentIndex + 1), ...options.slice(0, currentIndex + 1)];
            ordered.find((option) => option.textContent?.trim().toLocaleLowerCase().startsWith(query))?.focus();
          }
        }}
      >
        <div className="max-h-60 overflow-y-auto p-1">{children}</div>
      </div>
    </>
  );
}

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

function SelectItem({ value, children, className }: SelectItemProps) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('SelectItem must be used within Select');
  const isSelected = context.value === value;
  const registerItem = context.registerItem;

  React.useLayoutEffect(
    () => registerItem(value, children),
    [children, registerItem, value]
  );

  const selectItem = () => {
    context.onValueChange(value);
    context.setOpen(false);
  };

  return (
    <div
      role="option"
      aria-selected={isSelected}
      tabIndex={-1}
      onClick={selectItem}
      onMouseMove={(event) => event.currentTarget.focus()}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectItem();
        }
      }}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none',
        'hover:bg-accent hover:text-accent-foreground',
        'focus:bg-accent focus:text-accent-foreground',
        isSelected && 'bg-accent',
        className
      )}
    >
      {children}
      {isSelected && (
        <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
          <Check className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
    </div>
  );
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
