import { useMemo } from 'react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { Select } from '../ui/Select';
import type { Feature } from '../../types/collaboration';

// EEP2-P3.4.4 / DDS §4.8: the module ownership picker. Moving a Feature between
// Modules (or dropping it back to project-level with `null`) only ever PATCHes
// `moduleId` — `sprintId` is never touched (the flex point). Options are the
// Modules of the Feature's own Project (same-project invariant).
export function ModulePicker({ feature, className }: { feature: Feature; className?: string }) {
  const { modules, moveFeatureModule } = useCollaborationStore();

  const projectModules = useMemo(
    () =>
      modules
        .filter((m) => m.projectId === feature.projectId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [modules, feature.projectId],
  );

  const value = feature.moduleId ?? '__unassigned__';

  return (
    <Select
      aria-label={`Assign ${feature.name} to a module`}
      value={value}
      onChange={(e) => {
        const next = e.target.value;
        if (next !== value) moveFeatureModule(feature.id, next === '__unassigned__' ? null : next);
      }}
      className={className}
    >
      <option value="__unassigned__">No module (project-level)</option>
      {projectModules.map((m) => (
        <option key={m.id} value={m.id}>{m.name}</option>
      ))}
    </Select>
  );
}
