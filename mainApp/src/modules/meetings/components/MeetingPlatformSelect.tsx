import { Select, type SelectProps } from '@shared/components/ui/Select';
import type { MeetingPlatform } from '../types/meeting';
import { MEETING_PLATFORM_LABELS } from '../types/meeting';

interface MeetingPlatformSelectProps extends Omit<SelectProps, 'value' | 'onChange'> {
  value: MeetingPlatform;
  onChange: (platform: MeetingPlatform) => void;
}

const PLATFORM_ICONS: Record<MeetingPlatform, string> = {
  google_meet: '🟢',
  zoom: '🔵',
  teams: '🟣',
  other: '⚪',
};

export function MeetingPlatformSelect({ value, onChange, ...rest }: MeetingPlatformSelectProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-surface-400">Platform</label>
      <div className="flex items-center gap-2">
        <span className="text-sm">{PLATFORM_ICONS[value]}</span>
        <Select
          value={value}
          onChange={(e) => onChange(e.target.value as MeetingPlatform)}
          {...rest}
        >
          {Object.entries(MEETING_PLATFORM_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
