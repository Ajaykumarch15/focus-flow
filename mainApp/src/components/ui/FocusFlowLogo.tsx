import { useStore } from '../../store/useStore';

interface FocusFlowLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export function FocusFlowLogo({ size = 'md', showText = true, className = '' }: FocusFlowLogoProps) {
  const { theme } = useStore();
  const isDark = theme.mode === 'dark';

  const sizes = {
    sm: { box: 'w-7 h-7', icon: 14, text: 'text-sm' },
    md: { box: 'w-8 h-8', icon: 16, text: 'text-base' },
    lg: { box: 'w-10 h-10', icon: 20, text: 'text-lg' },
  };
  const s = sizes[size];
  const src = isDark ? '/darkicon.png' : '/lighticon.png';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className={`${s.box} rounded-xl overflow-hidden flex-shrink-0`}>
        <img src={src} alt="FocusFlow" className="w-full h-full" />
      </div>
      {showText && (
        <span className="font-display font-bold text-surface-50 whitespace-nowrap" style={{ fontSize: size === 'sm' ? '0.875rem' : size === 'lg' ? '1.25rem' : '1rem' }}>
          FocusFlow
        </span>
      )}
    </div>
  );
}
