import type { ButtonHTMLAttributes, ComponentType, SVGProps } from 'react';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

interface ListIconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  tone?: Tone;
}

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'text-slate-400 hover:border-slate-600 hover:bg-slate-800 hover:text-slate-200',
  accent: 'text-slate-400 hover:border-blue-800/70 hover:bg-blue-950/40 hover:text-blue-300',
  success: 'text-slate-400 hover:border-emerald-800/70 hover:bg-emerald-950/40 hover:text-emerald-300',
  warning: 'text-slate-400 hover:border-amber-800/70 hover:bg-amber-950/40 hover:text-amber-300',
  danger: 'text-slate-500 hover:border-rose-900/70 hover:bg-rose-950/40 hover:text-rose-300',
};

export default function ListIconButton({
  icon: Icon,
  label,
  tone = 'neutral',
  className = '',
  type = 'button',
  ...props
}: ListIconButtonProps) {
  return (
    <button
      type={type}
      title={label}
      aria-label={label}
      className={`inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent transition-colors ${TONE_CLASSES[tone]} ${className}`}
      {...props}
    >
      <Icon width={14} height={14} strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}
