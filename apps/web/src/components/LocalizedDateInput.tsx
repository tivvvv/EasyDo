import { format, parseISO } from 'date-fns';
import { CalendarDays } from 'lucide-react';

type LocalizedDateInputProps = {
  ariaLabel: string;
  disabled?: boolean;
  min?: string;
  onChange: (value: string) => void;
  value: string;
};

export function LocalizedDateInput({
  ariaLabel,
  disabled = false,
  min,
  onChange,
  value,
}: LocalizedDateInputProps) {
  return (
    <span className={`localized-date-input${disabled ? ' disabled' : ''}`}>
      <CalendarDays size={14} />
      <span>{value ? format(parseISO(value), 'yyyy年M月d日') : '选择日期'}</span>
      <input
        aria-label={ariaLabel}
        disabled={disabled}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={value}
      />
    </span>
  );
}
