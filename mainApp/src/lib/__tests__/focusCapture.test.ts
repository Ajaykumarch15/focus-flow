import { describe, it, expect } from 'vitest';
import {
  buildBlockerPayload,
  buildDecisionPayload,
  canCaptureOnPause,
  type DecisionDraft,
} from '../focusCapture';

describe('focusCapture helpers (S2-T2)', () => {
  describe('buildBlockerPayload', () => {
    it('trims title and notes and sets status open', () => {
      const payload = buildBlockerPayload({ title: '  Blocked on OAuth  ', severity: 'high', notes: '  waiting on review  ' });
      expect(payload).toEqual({ title: 'Blocked on OAuth', severity: 'high', status: 'open', notes: 'waiting on review' });
    });

    it('defaults severity to medium when the draft severity is empty', () => {
      const payload = buildBlockerPayload({ title: 'No severity', severity: '', notes: '' });
      expect(payload.severity).toBe('medium');
    });

    it('keeps an explicit low severity', () => {
      const payload = buildBlockerPayload({ title: 'Low', severity: 'low', notes: '' });
      expect(payload.severity).toBe('low');
    });

    it('handles an all-whitespace notes field', () => {
      const payload = buildBlockerPayload({ title: 'T', severity: '', notes: '   ' });
      expect(payload.notes).toBe('');
    });
  });

  describe('buildDecisionPayload', () => {
    it('maps and trims every decision field', () => {
      const draft: DecisionDraft = {
        title: '  Zustand  ',
        context: ' state for the app ',
        decision: ' pick zustand ',
        rationale: ' simple ',
        alternatives: ' redux ',
      };
      const payload = buildDecisionPayload(draft);
      expect(payload).toEqual({
        title: 'Zustand',
        context: 'state for the app',
        decision: 'pick zustand',
        rationale: 'simple',
        alternatives: 'redux',
      });
    });

    it('allows empty optional fields', () => {
      const payload = buildDecisionPayload({ title: 'T', context: '', decision: '', rationale: '', alternatives: '' });
      expect(payload.context).toBe('');
      expect(payload.decision).toBe('');
      expect(payload.rationale).toBe('');
      expect(payload.alternatives).toBe('');
    });
  });

  describe('canCaptureOnPause', () => {
    it('is false while the session is running', () => {
      expect(canCaptureOnPause(false, 'log-1')).toBe(false);
    });

    it('is false when paused with no linked work log', () => {
      expect(canCaptureOnPause(true, null)).toBe(false);
    });

    it('is false when paused with an empty work log id', () => {
      expect(canCaptureOnPause(true, '')).toBe(false);
    });

    it('is true when paused with a linked work log', () => {
      expect(canCaptureOnPause(true, 'log-1')).toBe(true);
    });
  });
});
