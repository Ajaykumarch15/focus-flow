import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRoadmapStore } from '../useRoadmapStore';
import { api } from '@shared/utils/api';
import { toast } from '@shared/services/useToastStore';

// B3 (Basic Roadmap V1) · Roadmap CRUD lifecycle at the store level:
// loading, creation, updates (server-response merge, no raw client patch),
// deletion and error propagation.

vi.mock('@shared/utils/api', () => ({
  api: {
    personalRoadmaps: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      createPhase: vi.fn(),
      updatePhase: vi.fn(),
      removePhase: vi.fn(),
      reorderPhases: vi.fn(),
      createMilestone: vi.fn(),
      updateMilestone: vi.fn(),
      removeMilestone: vi.fn(),
      reorderMilestones: vi.fn(),
      linkTask: vi.fn(),
      unlinkTask: vi.fn(),
    },
  },
}));

vi.mock('@shared/services/useToastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const apiMock = api.personalRoadmaps as unknown as Record<
  string,
  ReturnType<typeof vi.fn>
>;

const LIST_ITEM = {
  _id: 'rm-1',
  userId: 'u-1',
  title: 'Learn Rust',
  description: '',
  type: 'learning' as const,
  status: 'active' as const,
  icon: 'BookOpen',
  color: '#0ea5e9',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  phaseCount: 2,
  milestoneTotal: 5,
  milestoneCompleted: 1,
  totalTasks: 4,
  completedTasks: 1,
  totalTime: 7200000,
  progress: 20,
};

const OTHER_ITEM = {
  ...LIST_ITEM,
  _id: 'rm-2',
  title: 'Ship Portfolio',
};

function resetState() {
  useRoadmapStore.setState({
    roadmaps: [],
    activeRoadmap: null,
    loading: false,
    detailLoading: false,
    error: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetState();
});

afterEach(resetState);

describe('loadRoadmaps', () => {
  it('fills the list and clears loading/error on success', async () => {
    apiMock.list.mockResolvedValue([LIST_ITEM]);

    await useRoadmapStore.getState().loadRoadmaps();

    expect(apiMock.list).toHaveBeenCalledOnce();
    const s = useRoadmapStore.getState();
    expect(s.roadmaps).toEqual([LIST_ITEM]);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('surfaces an error and stops loading without wiping existing data', async () => {
    useRoadmapStore.setState({ roadmaps: [LIST_ITEM] });
    apiMock.list.mockRejectedValue(new Error('Network down'));

    await useRoadmapStore.getState().loadRoadmaps();

    const s = useRoadmapStore.getState();
    expect(s.loading).toBe(false);
    expect(s.error).toBe('Network down');
    expect(s.roadmaps).toEqual([LIST_ITEM]);
  });
});

describe('getRoadmap', () => {
  it('stores the detail document on success', async () => {
    apiMock.get.mockResolvedValue({ ...LIST_ITEM, phases: [], milestones: [], tasks: [] });

    await useRoadmapStore.getState().getRoadmap('rm-1');

    const s = useRoadmapStore.getState();
    expect(s.activeRoadmap).toMatchObject({ _id: 'rm-1', phases: [] });
    expect(s.detailLoading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('sets error and stops detail loading on failure', async () => {
    apiMock.get.mockRejectedValue(new Error('Roadmap not found'));

    await useRoadmapStore.getState().getRoadmap('rm-1');

    const s = useRoadmapStore.getState();
    expect(s.error).toBe('Roadmap not found');
    expect(s.detailLoading).toBe(false);
    expect(s.activeRoadmap).toBeNull();
  });
});

describe('createRoadmap', () => {
  it('prepends the created roadmap and toasts success', async () => {
    useRoadmapStore.setState({ roadmaps: [OTHER_ITEM] });
    const created = { ...LIST_ITEM, _id: 'rm-new' };
    apiMock.create.mockResolvedValue(created);

    const result = await useRoadmapStore.getState().createRoadmap({ title: 'New Map' });

    expect(result).toEqual(created);
    expect(useRoadmapStore.getState().roadmaps).toEqual([created, OTHER_ITEM]);
    expect(toast.success).toHaveBeenCalledWith('Roadmap created');
  });

  it('propagates failures so the modal can render its own error UI', async () => {
    apiMock.create.mockRejectedValue(new Error('Title is required'));

    await expect(
      useRoadmapStore.getState().createRoadmap({ title: '' }),
    ).rejects.toThrow('Title is required');
    expect(toast.success).not.toHaveBeenCalled();
    expect(useRoadmapStore.getState().roadmaps).toHaveLength(0);
  });
});

describe('updateRoadmap', () => {
  it('merges the server response over the stale list item and active detail', async () => {
    const detail = { ...LIST_ITEM, phases: [], milestones: [], tasks: [] };
    useRoadmapStore.setState({
      roadmaps: [LIST_ITEM, OTHER_ITEM],
      activeRoadmap: detail,
    });
    // The PATCH endpoint returns the plain doc — no enrichment counts —
    // so merging must preserve locally-known values like progress.
    apiMock.update.mockResolvedValue({
      _id: 'rm-1',
      title: 'Master Rust',
      status: 'archived',
      startDate: null,
    });

    await useRoadmapStore.getState().updateRoadmap('rm-1', { status: 'archived' });

    const s = useRoadmapStore.getState();
    const updatedItem = s.roadmaps.find(r => r._id === 'rm-1')!;
    expect(updatedItem.title).toBe('Master Rust');
    expect(updatedItem.status).toBe('archived');
    // Enrichment survives the merge because the server response lacks those keys.
    expect(updatedItem.progress).toBe(20);
    expect(updatedItem.milestoneTotal).toBe(5);
    // Other items untouched.
    expect(s.roadmaps[1]).toEqual(OTHER_ITEM);
    // Active detail picks up the change too.
    expect(s.activeRoadmap!.status).toBe('archived');
    expect(s.activeRoadmap!.phases).toEqual([]);
    expect(toast.success).toHaveBeenCalledWith('Roadmap updated');
  });

  it('toasts, rethrows and leaves state untouched when the API fails', async () => {
    const before = useRoadmapStore.getState().roadmaps;
    useRoadmapStore.setState({ roadmaps: [LIST_ITEM] });
    apiMock.update.mockRejectedValue(new Error('Validation failed'));

    await expect(
      useRoadmapStore.getState().updateRoadmap('rm-1', { title: '' }),
    ).rejects.toThrow('Validation failed');

    expect(toast.error).toHaveBeenCalledWith('Failed to update roadmap', 'Validation failed');
    expect(useRoadmapStore.getState().roadmaps).toEqual([LIST_ITEM]);
    expect(before).toBeDefined();
  });
});

describe('reorderPhases', () => {
  it('sends the full ordered id list and refreshes detail + list', async () => {
    const detail = { ...LIST_ITEM, phases: [], milestones: [], tasks: [] };
    useRoadmapStore.setState({ roadmaps: [LIST_ITEM], activeRoadmap: detail });
    apiMock.reorderPhases.mockResolvedValue({ message: 'Phases reordered' });
    const getSpy = apiMock.get;

    await useRoadmapStore.getState().reorderPhases('rm-1', ['b', 'a']);

    expect(apiMock.reorderPhases).toHaveBeenCalledWith('rm-1', ['b', 'a']);
    // Detail refetched because the open roadmap is the one reordered.
    expect(getSpy).toHaveBeenCalledWith('rm-1');
    expect(apiMock.list).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('rethrows failures after toasting', async () => {
    apiMock.reorderPhases.mockRejectedValue(new Error('phaseIds must contain every phase'));

    await expect(
      useRoadmapStore.getState().reorderPhases('rm-1', ['a']),
    ).rejects.toThrow('phaseIds must contain every phase');
    expect(toast.error).toHaveBeenCalledWith(
      'Failed to reorder phases',
      'phaseIds must contain every phase',
    );
  });
});

describe('reorderMilestones', () => {
  it('sends the full ordered id list and refreshes detail + list', async () => {
    const detail = { ...LIST_ITEM, phases: [], milestones: [], tasks: [] };
    useRoadmapStore.setState({ roadmaps: [LIST_ITEM], activeRoadmap: detail });
    apiMock.reorderMilestones.mockResolvedValue({ message: 'Milestones reordered' });

    await useRoadmapStore.getState().reorderMilestones('ph-1', ['m2', 'm1']);

    expect(apiMock.reorderMilestones).toHaveBeenCalledWith('ph-1', ['m2', 'm1']);
    expect(apiMock.get).toHaveBeenCalledWith('rm-1');
    expect(apiMock.list).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('rethrows failures after toasting', async () => {
    apiMock.reorderMilestones.mockRejectedValue(new Error('milestoneIds must contain every milestone'));

    await expect(
      useRoadmapStore.getState().reorderMilestones('ph-1', ['m1']),
    ).rejects.toThrow('milestoneIds must contain every milestone');
    expect(toast.error).toHaveBeenCalledWith(
      'Failed to reorder milestones',
      'milestoneIds must contain every milestone',
    );
  });
});

describe('deleteRoadmap', () => {
  it('removes the roadmap from the list and clears a matching active detail', async () => {
    const detail = { ...LIST_ITEM, phases: [], milestones: [], tasks: [] };
    useRoadmapStore.setState({ roadmaps: [LIST_ITEM, OTHER_ITEM], activeRoadmap: detail });
    apiMock.remove.mockResolvedValue({ message: 'Roadmap deleted' });

    await useRoadmapStore.getState().deleteRoadmap('rm-1');

    const s = useRoadmapStore.getState();
    expect(s.roadmaps).toEqual([OTHER_ITEM]);
    expect(s.activeRoadmap).toBeNull();
    expect(toast.success).toHaveBeenCalledWith('Roadmap deleted');
  });

  it('keeps the open detail when a different roadmap is deleted', async () => {
    const detail = { ...OTHER_ITEM, phases: [], milestones: [], tasks: [] };
    useRoadmapStore.setState({ roadmaps: [LIST_ITEM, OTHER_ITEM], activeRoadmap: detail });
    apiMock.remove.mockResolvedValue({ message: 'Roadmap deleted' });

    await useRoadmapStore.getState().deleteRoadmap('rm-1');

    expect(useRoadmapStore.getState().activeRoadmap!._id).toBe('rm-2');
  });

  it('rethrows failures after toasting', async () => {
    apiMock.remove.mockRejectedValue(new Error('Roadmap not found'));

    await expect(useRoadmapStore.getState().deleteRoadmap('rm-1')).rejects.toThrow(
      'Roadmap not found',
    );
    expect(toast.error).toHaveBeenCalledWith('Failed to delete roadmap', 'Roadmap not found');
    expect(useRoadmapStore.getState().roadmaps).toHaveLength(0);
  });
});
