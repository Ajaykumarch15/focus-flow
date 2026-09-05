import { describe, it, expect } from 'vitest';
import {
  isReflectionEmpty,
  composeReflection,
  buildJournalEntry,
  buildCompletedItemTitle,
  type ReflectionDraft,
} from '../focusCompletion';

const draft: ReflectionDraft = {
  wentWell: '  Shipped the focus loop  ',
  slowedDown: '  Tabs across test files  ',
  learned: '  Pause captures are sticky  ',
};

describe('focusCompletion helpers (S2-T3)', () => {
  describe('isReflectionEmpty', () => {
    it('is true when every field is blank or whitespace', () => {
      expect(isReflectionEmpty({ wentWell: '', slowedDown: '   ', learned: '' })).toBe(true);
    });

    it('is false when any field has content', () => {
      expect(isReflectionEmpty({ wentWell: 'good', slowedDown: '', learned: '' })).toBe(false);
      expect(isReflectionEmpty({ wentWell: '', slowedDown: 'slow', learned: '' })).toBe(false);
      expect(isReflectionEmpty({ wentWell: '', slowedDown: '', learned: 'learned' })).toBe(false);
    });
  });

  describe('composeReflection', () => {
    it('labels and trims each filled section, skipping empty ones', () => {
      const text = composeReflection(draft);
      expect(text).toBe([
        'What went well: Shipped the focus loop',
        'What slowed you down: Tabs across test files',
        'What you learned: Pause captures are sticky',
      ].join('\n'));
    });

    it('returns an empty string when nothing is filled', () => {
      expect(composeReflection({ wentWell: '', slowedDown: '', learned: '' })).toBe('');
    });

    it('drops only the empty sections', () => {
      const text = composeReflection({ wentWell: 'Good', slowedDown: '  ', learned: 'Learned' });
      expect(text).toBe('What went well: Good\nWhat you learned: Learned');
    });
  });

  describe('buildJournalEntry', () => {
    it('shapes the entry exactly for addJournal without id/timestamps', () => {
      const entry = buildJournalEntry(draft, 't-1', 4, 5);
      expect(entry).toEqual({
        taskId: 't-1',
        content: composeReflection(draft),
        mood: 4,
        focusRating: 5,
      });
    });

    it('keeps a blank reflection as empty content', () => {
      const entry = buildJournalEntry({ wentWell: '', slowedDown: '', learned: '' }, 't-1', 3, 3);
      expect(entry.content).toBe('');
    });
  });

  describe('buildCompletedItemTitle', () => {
    it('returns the trimmed task title when no tracked label is given', () => {
      expect(buildCompletedItemTitle('  Build focus loop  ')).toBe('Build focus loop');
    });

    it('appends a tracked label when provided', () => {
      expect(buildCompletedItemTitle('Build focus loop', '2h 10m')).toBe('Build focus loop (2h 10m)');
    });

    it('ignores a whitespace-only tracked label', () => {
      expect(buildCompletedItemTitle('Build focus loop', '   ')).toBe('Build focus loop');
    });
  });
});
