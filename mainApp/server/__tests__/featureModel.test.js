// @vitest-environment node
// EEP2-P3.1.3 / DDS §4.7: Feature gains an optional `moduleRef` link to its
// owning Roadmap Module (`null` ⇒ not roadmap-planned — legacy/personal docs
// untouched). Validated via `validate()` (no DB connection needed).
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Feature = require('../models/Feature');
const { Types } = require('mongoose');

const projectId = new Types.ObjectId();
const workspaceId = new Types.ObjectId();
const moduleId = new Types.ObjectId();
const userId = new Types.ObjectId();

function makeFeature(overrides = {}) {
  return new Feature({
    projectRef: projectId,
    workspaceRef: workspaceId,
    name: 'Password reset flow',
    createdBy: userId,
    ...overrides,
  });
}

function validate(doc) {
  return doc.validate().then(() => null).catch((err) => err);
}

describe('EEP2-P3.1.3 · Feature.moduleRef (DDS §4.7)', () => {
  it('accepts a feature linked to a Module', async () => {
    const err = await validate(makeFeature({ moduleRef: moduleId }));
    expect(err).toBeNull();
    expect(makeFeature({ moduleRef: moduleId }).moduleRef.toString()).toBe(moduleId.toString());
  });

  it('defaults moduleRef to null (backlog / not roadmap-planned)', () => {
    expect(makeFeature().moduleRef).toBeNull();
  });

  it('still requires the pre-existing fields', async () => {
    const err = await validate(makeFeature({ name: undefined }));
    expect(err.errors.name).toBeDefined();
    const err2 = await validate(makeFeature({ projectRef: undefined }));
    expect(err2.errors.projectRef).toBeDefined();
  });

  it('declares the moduleRef lookup index', () => {
    const keys = Feature.schema.indexes().map(([key]) => key);
    expect(keys).toContainEqual({ moduleRef: 1 });
  });
});
