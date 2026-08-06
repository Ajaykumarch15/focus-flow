// @vitest-environment node
// EEP2-P3.1.2 / DDS §4.6–4.7: Phase and Module schemas match spec. Validation
// is exercised via `validate()` (no DB connection needed).
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Phase = require('../models/Phase');
const Module = require('../models/Module');
const { Types } = require('mongoose');

const milestoneId = new Types.ObjectId();
const phaseId = new Types.ObjectId();
const projectId = new Types.ObjectId();
const workspaceId = new Types.ObjectId();
const userId = new Types.ObjectId();
const ownerId = new Types.ObjectId();

function validate(doc) {
  return doc.validate().then(() => null).catch((err) => err);
}

describe('EEP2-P3.1.2 · Phase schema (DDS §4.6)', () => {
  function makePhase(overrides = {}) {
    return new Phase({
      milestoneRef: milestoneId,
      projectRef: projectId,
      workspaceRef: workspaceId,
      name: 'Phase 1: Core Platform',
      createdBy: userId,
      ...overrides,
    });
  }

  it('accepts a healthy phase with optional fields', async () => {
    const err = await validate(
      makePhase({
        description: 'Foundational platform work.',
        status: 'active',
        order: 1,
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-12-01'),
      })
    );
    expect(err).toBeNull();
  });

  it('defaults status to planned, order to 0 and dates to null', () => {
    const doc = makePhase();
    expect(doc.status).toBe('planned');
    expect(doc.order).toBe(0);
    expect(doc.startDate).toBeNull();
    expect(doc.endDate).toBeNull();
  });

  it('requires milestoneRef, projectRef, workspaceRef, name and createdBy', async () => {
    for (const field of ['milestoneRef', 'projectRef', 'workspaceRef', 'name', 'createdBy']) {
      const err = await validate(makePhase({ [field]: undefined }));
      expect(err.errors[field], `expected ${field} to be required`).toBeDefined();
    }
  });

  it('rejects an over-long name (>150)', async () => {
    const err = await validate(makePhase({ name: 'y'.repeat(151) }));
    expect(err.errors.name).toBeDefined();
  });

  it('accepts only the planned/active/completed status enum', async () => {
    for (const status of ['planned', 'active', 'completed']) {
      const err = await validate(makePhase({ status }));
      expect(err).toBeNull();
    }
    const err = await validate(makePhase({ status: 'paused' }));
    expect(err.errors.status).toBeDefined();
  });

  it('rejects endDate not after startDate', async () => {
    const err = await validate(
      makePhase({ startDate: new Date('2026-12-01'), endDate: new Date('2026-09-01') })
    );
    expect(err.errors.endDate).toBeDefined();
  });

  it('accepts either date alone (optional)', async () => {
    expect(await validate(makePhase({ startDate: new Date('2026-09-01') }))).toBeNull();
    expect(await validate(makePhase({ endDate: new Date('2026-12-01') }))).toBeNull();
  });

  it('declares the within-milestone ordering and scope indexes', () => {
    const keys = Phase.schema.indexes().map(([key]) => key);
    expect(keys).toContainEqual({ milestoneRef: 1, order: 1 });
    expect(keys).toContainEqual({ projectRef: 1 });
    expect(keys).toContainEqual({ workspaceRef: 1 });
  });
});

describe('EEP2-P3.1.2 · Module schema (DDS §4.7)', () => {
  function makeModule(overrides = {}) {
    return new Module({
      phaseRef: phaseId,
      projectRef: projectId,
      workspaceRef: workspaceId,
      name: 'Auth Module',
      createdBy: userId,
      ...overrides,
    });
  }

  it('accepts a healthy module with optional fields', async () => {
    const err = await validate(
      makeModule({
        description: 'Authentication and authorization.',
        status: 'active',
        order: 0,
        ownerId,
      })
    );
    expect(err).toBeNull();
  });

  it('defaults status to planned, order to 0, description to empty and owner to null', () => {
    const doc = makeModule();
    expect(doc.status).toBe('planned');
    expect(doc.order).toBe(0);
    expect(doc.description).toBe('');
    expect(doc.ownerId).toBeNull();
  });

  it('requires phaseRef, projectRef, workspaceRef, name and createdBy', async () => {
    for (const field of ['phaseRef', 'projectRef', 'workspaceRef', 'name', 'createdBy']) {
      const err = await validate(makeModule({ [field]: undefined }));
      expect(err.errors[field], `expected ${field} to be required`).toBeDefined();
    }
  });

  it('rejects an over-long name (>150)', async () => {
    const err = await validate(makeModule({ name: 'z'.repeat(151) }));
    expect(err.errors.name).toBeDefined();
  });

  it('accepts only the planned/active/completed status enum', async () => {
    for (const status of ['planned', 'active', 'completed']) {
      const err = await validate(makeModule({ status }));
      expect(err).toBeNull();
    }
    const err = await validate(makeModule({ status: 'archived' }));
    expect(err.errors.status).toBeDefined();
  });

  it('declares the within-phase ordering and scope indexes', () => {
    const keys = Module.schema.indexes().map(([key]) => key);
    expect(keys).toContainEqual({ phaseRef: 1, order: 1 });
    expect(keys).toContainEqual({ projectRef: 1 });
    expect(keys).toContainEqual({ workspaceRef: 1 });
  });
});
