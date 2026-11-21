import { useStore } from '@worklog/services/useStore';

interface FocusFlowLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const heights = {
  sm: 'h-8',
  md: 'h-9',
  lg: 'h-11',
};

/** Complete FocusFlow wordmark (icon + name), theme-aware. */
export function FocusFlowLogo({ size = 'md', className = '' }: FocusFlowLogoProps) {
  const { theme } = useStore();
  const src = theme.mode === 'dark' ? '/focusflow-logo-dark.png' : '/focusflow-logo-light.png';

  return (
    <img
      src={src}
      alt="FocusFlow"
      className={`${heights[size]} w-auto flex-shrink-0 object-contain ${className}`}
    />
  );
}
