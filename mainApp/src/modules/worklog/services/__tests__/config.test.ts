import { describe, it, expect } from 'vitest';
import {
  STATUS_OPTIONS, STATUS_MAP, STATUS_LABELS, STATUS_CONFIG,
  MOOD_EMOJIS, MOOD_LABELS, MOOD_LABELS_WITH_EMOJI,
} from '../config';

describe('config (status/mood single source)', () => {
  it('STATUS_OPTIONS covers all five worklog statuses with complete fields', () => {
    const values = STATUS_OPTIONS.map((s) => s.value);
    expect(values).toEqual(['planning', 'in-progress', 'reviewing', 'blocked', 'done']);
    for (const s of STATUS_OPTIONS) {
      expect(s.label).toBeTruthy();
      expect(s.emoji).toBeTruthy();
      expect(s.chipClass).toBeTruthy();
      expect(s.color).toContain('text-');
      expect(s.bg).toContain('bg-');
      expect(s.border).toContain('border-');
    }
  });

  it('STATUS_MAP indexes the same options by value', () => {
    for (const s of STATUS_OPTIONS) {
      expect(STATUS_MAP[s.value]).toBe(s);
    }
    expect(STATUS_MAP['blocked']).toEqual(STATUS_OPTIONS[3]);
  });

  it('STATUS_LABELS combine emoji + label', () => {
    for (const s of STATUS_OPTIONS) {
      expect(STATUS_LABELS[s.value]).toBe(`${s.emoji} ${s.label}`);
    }
    expect(STATUS_LABELS['in-progress']).toBe('⚡ In Progress');
  });

  it('STATUS_CONFIG maps task statuses to label + classes', () => {
    expect(STATUS_CONFIG.todo.label).toBe('To Do');
    expect(STATUS_CONFIG.completed.label).toBe('Done');
    expect(STATUS_CONFIG.active.color).toContain('text-');
  });

  it('mood maps are consistent and derived from a single source', () => {
    expect(MOOD_EMOJIS).toHaveLength(5);
    expect(MOOD_LABELS).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect(MOOD_LABELS_WITH_EMOJI[i + 1]).toBe(`${MOOD_EMOJIS[i]} ${MOOD_LABELS[i]}`);
    }
  });
});
