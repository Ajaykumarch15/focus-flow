// @vitest-environment node
// EEP2-P3.1.1 / DDS §4.5: Milestone schema matches spec. Validation is
// exercised via `validate()` (no DB connection needed).
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Milestone = require('../models/Milestone');
const { Types } = require('mongoose');

const projectId = new Types.ObjectId();
const workspaceId = new Types.ObjectId();
const userId = new Types.ObjectId();

function makeMilestone(overrides = {}) {
  return new Milestone({
    projectRef: projectId,
    workspaceRef: workspaceId,
    name: 'GA Launch',
    createdBy: userId,
    ...overrides,
  });
}

function validate(doc) {
  return doc.validate().then(() => null).catch((err) => err);
}

describe('EEP2-P3.1.1 · Milestone schema (DDS §4.5)', () => {
  it('accepts a healthy milestone with optional fields', async () => {
    const err = await validate(
      makeMilestone({
        description: 'Public launch of the platform.',
        targetDate: new Date('2027-01-15'),
        order: 3,
        status: 'active',
      })
    );
    expect(err).toBeNull();
  });

  it('accepts an unset targetDate (optional — roadmap shows "-")', async () => {
    const err = await validate(makeMilestone());
    expect(err).toBeNull();
    expect(makeMilestone().targetDate).toBeNull();
  });

  it('defaults status to planned, order to 0 and description to empty', () => {
    const doc = makeMilestone();
    expect(doc.status).toBe('planned');
    expect(doc.order).toBe(0);
    expect(doc.description).toBe('');
  });

  it('requires projectRef, workspaceRef, name and createdBy', async () => {
    const err = await validate(makeMilestone({ projectRef: undefined }));
    expect(err.errors.projectRef).toBeDefined();

    const err2 = await validate(makeMilestone({ workspaceRef: undefined }));
    expect(err2.errors.workspaceRef).toBeDefined();

    const err3 = await validate(makeMilestone({ name: undefined }));
    expect(err3.errors.name).toBeDefined();

    const err4 = await validate(makeMilestone({ createdBy: undefined }));
    expect(err4.errors.createdBy).toBeDefined();
  });

  it('rejects an over-long name (>150)', async () => {
    const err = await validate(makeMilestone({ name: 'x'.repeat(151) }));
    expect(err.errors.name).toBeDefined();
  });

  it('trims the name', () => {
    expect(makeMilestone({ name: '  GA Launch  ' }).name).toBe('GA Launch');
  });

  it('accepts only the planned/active/completed status enum', async () => {
    for (const status of ['planned', 'active', 'completed']) {
      const err = await validate(makeMilestone({ status }));
      expect(err).toBeNull();
    }
    const err = await validate(makeMilestone({ status: 'archived' }));
    expect(err.errors.status).toBeDefined();
  });

  it('declares the roadmap ordering and workspace indexes', () => {
    const keys = Milestone.schema.indexes().map(([key]) => key);
    expect(keys).toContainEqual({ projectRef: 1, order: 1, targetDate: 1 });
    expect(keys).toContainEqual({ workspaceRef: 1 });
  });
});
