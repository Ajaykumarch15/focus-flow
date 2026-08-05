import { useState } from 'react';
import { ClipboardList, Plus } from 'lucide-react';
import { ProjectBacklog } from '../../components/collaboration/ProjectBacklog';
import { CreateFeatureModal } from '../../components/collaboration/CreateFeatureModal';
import { Button } from '../../components/ui/Button';

// ECIS B.8: the Backlog page answers "What is waiting to be scheduled?" — the
// Project Backlog with filter/search/drag into sprints preserved, plus the
// Create-Feature modal. Split out of the Sprint tab into its own routed page.

export function BacklogPage() {
  const [showCreateFeature, setShowCreateFeature] = useState(false);

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">

      {/* Backlog header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-display font-extrabold text-surface-50 flex items-center gap-2">
            <ClipboardList size={20} className="text-emerald-400" /> Backlog
          </h1>
          <p className="text-xs text-surface-400 mt-0.5">
            What is waiting to be scheduled? Drag a card onto a sprint to commit it.
          </p>
        </div>
        <Button onClick={() => setShowCreateFeature(true)}
          size="sm" leftIcon={<Plus size={14} />}>
          New Feature
        </Button>
      </div>

      <ProjectBacklog onCreateFeature={() => setShowCreateFeature(true)} />

      <CreateFeatureModal isOpen={showCreateFeature} onClose={() => setShowCreateFeature(false)} />
    </div>
  );
}
