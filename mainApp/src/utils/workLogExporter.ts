/**
 * workLogExporter.ts — Work Log Export & AI Ready Summary Formatter
 *
 * Supports Markdown (.md), JSON (.json), and AI Standup / Sprint Summary export formats.
 */

import { WorkLog } from '../store/useWorkLogStore';
import { calculateWorkLogMetrics } from './workLogMetrics';
import { saveAs } from 'file-saver';

export function exportWorkLogToMarkdown(log: WorkLog): string {
  const metrics = calculateWorkLogMetrics(log);
  const dateStr = new Date(log.createdAt).toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  let md = `# 📝 Engineering Work Log: ${log.title}\n\n`;
  md += `**Date:** ${dateStr}  \n`;
  md += `**Status:** ${log.status.toUpperCase()} | **Total Focus:** ${metrics.formattedTotalFocus}  \n`;
  if (log.gitRef?.branch || log.gitBranch) {
    md += `**Git Branch:** \`${log.gitRef?.branch || log.gitBranch}\`  \n`;
  }
  if (log.taskRef?.title) {
    md += `**Linked Task:** ${log.taskRef.title}  \n`;
  }
  md += `\n---\n\n`;

  // 1. Timeline
  md += `## 🕒 Daily Chronological Timeline\n\n`;
  if (log.timelineEntries?.length) {
    log.timelineEntries.forEach(entry => {
      const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      md += `- **${time}** - *${entry.title}*: ${entry.description || ''}\n`;
    });
  } else {
    md += `*No timeline entries recorded.*\n`;
  }
  md += `\n`;

  // 2. Problem & Solution Flow
  md += `## 🔍 Problem & Solution Flow\n\n`;
  if (log.problemFlow?.problem || log.problem) {
    md += `### Problem\n${log.problemFlow?.problem || log.problem}\n\n`;
  }
  if (log.problemFlow?.investigation) {
    md += `### Investigation & Diagnosis\n${log.problemFlow.investigation}\n\n`;
  }
  if (log.problemFlow?.rootCause) {
    md += `### Root Cause\n${log.problemFlow.rootCause}\n\n`;
  }
  if (log.problemFlow?.solution) {
    md += `### Solution\n${log.problemFlow.solution}\n\n`;
  }
  if (log.problemFlow?.lessonsLearned) {
    md += `### Lessons Learned\n${log.problemFlow.lessonsLearned}\n\n`;
  }

  // 3. Technical Decisions Log
  if (log.decisions?.length) {
    md += `## 💡 Technical Decisions\n\n`;
    log.decisions.forEach(d => {
      md += `### ${d.title}\n`;
      if (d.context) md += `**Context:** ${d.context}  \n`;
      if (d.decision) md += `**Decision:** ${d.decision}  \n`;
      if (d.rationale) md += `**Rationale:** ${d.rationale}  \n`;
      if (d.alternatives) md += `**Alternatives Considered:** ${d.alternatives}  \n`;
      md += `\n`;
    });
  }

  // 4. Completed Work
  if (log.completedItems?.length) {
    md += `## ✅ Completed Deliverables\n\n`;
    log.completedItems.forEach(item => {
      md += `- [x] **[${item.category.toUpperCase()}]** ${item.text}\n`;
    });
    md += `\n`;
  }

  // 5. Blockers
  if (log.blockerList?.length) {
    md += `## 🚧 Blockers & Impediments\n\n`;
    log.blockerList.forEach(b => {
      md += `- **[${b.severity.toUpperCase()}] ${b.title}** (${b.status}): ${b.notes || ''}\n`;
    });
    md += `\n`;
  }

  // 6. Plan for Tomorrow
  if (log.tomorrowPlan?.topPriority || log.tomorrowPlan?.unfinishedItems?.length) {
    md += `## 🎯 Plan for Tomorrow\n\n`;
    if (log.tomorrowPlan.topPriority) {
      md += `**Top Priority:** ${log.tomorrowPlan.topPriority}\n\n`;
    }
    if (log.tomorrowPlan.unfinishedItems?.length) {
      md += `**Unfinished Items:**\n`;
      log.tomorrowPlan.unfinishedItems.forEach(item => {
        md += `- ${item}\n`;
      });
      md += `\n`;
    }
  }

  // 7. Daily Reflection
  if (log.reflection?.wentWell || log.reflection?.learned) {
    md += `## 🌟 Daily Reflection\n\n`;
    if (log.reflection.wentWell) md += `**What went well:** ${log.reflection.wentWell}\n\n`;
    if (log.reflection.slowedDown) md += `**What slowed me down:** ${log.reflection.slowedDown}\n\n`;
    if (log.reflection.learned) md += `**Key learning:** ${log.reflection.learned}\n\n`;
    if (log.reflection.improvement) md += `**One improvement for tomorrow:** ${log.reflection.improvement}\n\n`;
  }

  return md;
}

export function downloadWorkLogMarkdown(log: WorkLog): void {
  const content = exportWorkLogToMarkdown(log);
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const filename = `${log.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_worklog.md`;
  saveAs(blob, filename);
}

export function downloadWorkLogJSON(log: WorkLog): void {
  const content = JSON.stringify(log, null, 2);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const filename = `${log.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_worklog.json`;
  saveAs(blob, filename);
}

/**
 * AI Ready Standup Prompt Formatter
 */
export function generateAIStandupSummary(log: WorkLog): string {
  const metrics = calculateWorkLogMetrics(log);
  const completed = (log.completedItems || []).map(i => `• ${i.text}`).join('\n') || '• Continuous progress on ' + log.title;
  const blockers = (log.blockerList || []).filter(b => b.status !== 'resolved').map(b => `• ${b.title}`).join('\n') || 'None';
  const tomorrow = log.tomorrowPlan?.topPriority || 'Continue work item implementation';

  return `
🤖 AI Standup Summary for ${log.title}:

Yesterday / Today:
${completed}
(Total Focus: ${metrics.formattedTotalFocus}, ${metrics.sessionCount} sessions)

Blockers:
${blockers}

Today / Tomorrow Next Steps:
• ${tomorrow}
`.trim();
}
