'use client';
import { LABEL_SLOTS, labelColor } from '@/lib/labels';
import { COPY } from '@/lib/copy';

// 6色それぞれの「柄」。色だけに頼らず、柄でも見分けられるようにしている
function patternOf(slot: number, c: string): string {
  switch (slot) {
    case 2:
      return `repeating-linear-gradient(45deg, ${c} 0 1.5px, transparent 1.5px 4px)`;
    case 3:
      return `radial-gradient(${c} 1.2px, transparent 1.6px)`;
    case 4:
      return `repeating-linear-gradient(0deg, ${c} 0 1.5px, transparent 1.5px 4px)`;
    case 5:
      return `repeating-linear-gradient(0deg, ${c} 0 1px, transparent 1px 4px), repeating-linear-gradient(90deg, ${c} 0 1px, transparent 1px 4px)`;
    case 6:
      return `repeating-linear-gradient(90deg, ${c} 0 1.5px, transparent 1.5px 4px)`;
    default:
      return 'none';
  }
}

export function LabelSwatch({ slot, size = 16 }: { slot: number; size?: number }) {
  const c = labelColor(slot);
  return (
    <span
      aria-hidden
      className="inline-block shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: 2,
        border: `1px solid ${c}`,
        backgroundColor: slot === 1 ? c : `color-mix(in srgb, ${c} 14%, transparent)`,
        backgroundImage: patternOf(slot, c),
        backgroundSize: slot === 3 ? '4px 4px' : undefined,
      }}
    />
  );
}

export function LabelTag({ slot, name }: { slot: number; name: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted">
      <LabelSwatch slot={slot} size={10} />
      <span className="truncate">{name}</span>
    </span>
  );
}

export function LabelPicker(props: {
  value: number | null;
  onChange: (v: number | null) => void;
  nameOf: (slot: number) => string;
}) {
  const { value, onChange, nameOf } = props;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={COPY.labels.noLabel}
          title={COPY.labels.noLabel}
          className={`flex h-7 items-center rounded-md border px-2 text-xs transition ${
            value === null ? 'border-accent text-text' : 'border-border text-muted hover:text-text'
          }`}
        >
          {COPY.labels.none}
        </button>
        {LABEL_SLOTS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            aria-label={nameOf(s)}
            title={nameOf(s)}
            className={`flex h-7 w-7 items-center justify-center rounded-md border transition ${
              value === s ? 'border-accent ring-1 ring-accent' : 'border-transparent hover:border-border'
            }`}
          >
            <LabelSwatch slot={s} size={16} />
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">{value ? nameOf(value) : COPY.labels.noLabel}</p>
    </div>
  );
}