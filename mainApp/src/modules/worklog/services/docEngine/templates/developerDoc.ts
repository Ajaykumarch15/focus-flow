import { renderMarkdown } from '@shared/utils/markdown';
import type { DocumentModel } from '@worklog/services/docEngine/types';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatMs(ms: number): string {
  if (!ms || ms < 0) return '0h 0m';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function renderMd(html: string): string {
  if (!html.trim()) return '';
  return renderMarkdown(html);
}

const STATUS_COLORS: Record<string, string> = {
  'planning': '#3b82f6',
  'in-progress': '#0ea5e9',
  'reviewing': '#a855f7',
  'blocked': '#ef4444',
  'done': '#22c55e',
};

export function renderDeveloperDoc(doc: DocumentModel): string {
  const { meta, sections, milestones, workEntries, links, stats } = doc;
  const statusColor = STATUS_COLORS[meta.status] || '#0ea5e9';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(meta.title)} — Engineering Documentation</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg: #ffffff;
    --text: #1a1a2e;
    --text-secondary: #64748b;
    --border: #e2e8f0;
    --surface: #f8fafc;
    --brand: #0ea5e9;
    --brand-light: #e0f2fe;
    --accent: #6366f1;
    --accent-light: #eef2ff;
    --green: #22c55e;
    --green-light: #f0fdf4;
    --red: #ef4444;
    --red-light: #fef2f2;
    --yellow: #f59e0b;
    --yellow-light: #fffbeb;
    --purple: #a855f7;
    --purple-light: #faf5ff;
    --code-bg: #f1f5f9;
    --font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    --mono: 'JetBrains Mono', 'Fira Code', monospace;
  }

  @page { size: A4; margin: 0; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }

  body {
    font-family: var(--font);
    color: var(--text);
    background: var(--bg);
    line-height: 1.6;
    font-size: 14px;
  }

  /* ── Cover Page ──────────────────────────────────────────────── */
  .cover {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 60px 48px;
    position: relative;
    overflow: hidden;
    page-break-after: always;
  }
  .cover::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 6px;
    background: linear-gradient(90deg, ${statusColor}, var(--accent));
  }
  .cover::after {
    content: '';
    position: absolute;
    bottom: -200px; right: -200px;
    width: 500px; height: 500px;
    border-radius: 50%;
    background: radial-gradient(circle, ${statusColor}08, transparent 70%);
  }
  .cover-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 16px;
    background: ${statusColor}10;
    border: 1px solid ${statusColor}25;
    border-radius: 100px;
    color: ${statusColor};
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    margin-bottom: 32px;
  }
  .cover-title {
    font-size: 36px;
    font-weight: 800;
    text-align: center;
    line-height: 1.2;
    margin-bottom: 8px;
    color: var(--text);
  }
  .cover-subtitle {
    font-size: 16px;
    color: var(--text-secondary);
    text-align: center;
    margin-bottom: 48px;
    font-weight: 500;
  }
  .cover-meta {
    display: flex;
    flex-direction: column;
    gap: 12px;
    text-align: center;
    font-size: 13px;
    color: var(--text-secondary);
  }
  .cover-meta strong { color: var(--text); }
  .cover-footer {
    position: absolute;
    bottom: 40px;
    text-align: center;
    font-size: 11px;
    color: var(--text-secondary);
    opacity: 0.6;
  }

  /* ── Content ─────────────────────────────────────────────────── */
  .content { max-width: 760px; margin: 0 auto; padding: 48px 40px; }

  .section {
    margin-bottom: 40px;
    page-break-inside: avoid;
  }
  .section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
    padding-bottom: 10px;
    border-bottom: 2px solid var(--border);
  }
  .section-icon {
    width: 32px; height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
  }
  .section-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--text);
    letter-spacing: -0.01em;
  }
  .section-body {
    color: var(--text);
    line-height: 1.75;
  }

  /* ── Feature Table ───────────────────────────────────────────── */
  .feature-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 40px;
    font-size: 13px;
  }
  .feature-table td {
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
  }
  .feature-table td:first-child {
    font-weight: 600;
    color: var(--text-secondary);
    width: 140px;
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.5px;
  }
  .feature-table td:last-child { color: var(--text); }

  /* ── Status Badge ────────────────────────────────────────────── */
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    background: ${statusColor}12;
    color: ${statusColor};
    border: 1px solid ${statusColor}25;
  }

  /* ── Stats Grid ──────────────────────────────────────────────── */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 40px;
  }
  .stat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px;
    text-align: center;
  }
  .stat-value {
    font-size: 24px;
    font-weight: 800;
    color: var(--text);
    line-height: 1;
    margin-bottom: 4px;
  }
  .stat-label {
    font-size: 11px;
    color: var(--text-secondary);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  /* ── Milestones ──────────────────────────────────────────────── */
  .milestone {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 0;
    border-bottom: 1px solid var(--border);
  }
  .milestone:last-child { border-bottom: none; }
  .milestone-check {
    width: 22px; height: 22px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 12px;
    margin-top: 1px;
  }
  .milestone-check.done { background: var(--green-light); color: var(--green); }
  .milestone-check.pending { background: var(--surface); color: #cbd5e1; border: 1.5px solid var(--border); }
  .milestone-text { font-size: 13px; line-height: 1.5; }
  .milestone-text.done { color: var(--text); }
  .milestone-text.pending { color: var(--text-secondary); }
  .milestone-num {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-secondary);
    font-family: var(--mono);
    flex-shrink: 0;
    margin-top: 2px;
  }

  /* ── Work Log Timeline ───────────────────────────────────────── */
  .timeline-entry {
    display: flex;
    gap: 14px;
    padding: 12px 0;
    border-bottom: 1px solid var(--border);
  }
  .timeline-entry:last-child { border-bottom: none; }
  .timeline-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--brand);
    flex-shrink: 0;
    margin-top: 6px;
  }
  .timeline-date {
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 2px;
  }
  .timeline-time {
    font-size: 11px;
    color: var(--brand);
    font-weight: 500;
    margin-left: 8px;
  }
  .timeline-what {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  /* ── Links ────────────────────────────────────────────────────── */
  .link-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    margin-bottom: 8px;
    font-size: 13px;
    color: var(--brand);
    text-decoration: none;
    word-break: break-all;
  }
  .link-item:hover { background: var(--brand-light); }

  /* ── Prose ────────────────────────────────────────────────────── */
  .prose h1 { font-size: 20px; font-weight: 700; margin: 24px 0 12px; color: var(--text); border-bottom: 1px solid var(--border); padding-bottom: 8px; }
  .prose h2 { font-size: 17px; font-weight: 700; margin: 20px 0 10px; color: var(--text); }
  .prose h3 { font-size: 15px; font-weight: 600; margin: 16px 0 8px; color: var(--text); }
  .prose p { margin: 8px 0; color: var(--text); line-height: 1.75; }
  .prose ul, .prose ol { padding-left: 24px; margin: 8px 0; }
  .prose li { margin: 4px 0; line-height: 1.65; color: var(--text); }
  .prose code { font-family: var(--mono); background: var(--code-bg); border: 1px solid var(--border); padding: 2px 6px; border-radius: 4px; font-size: 0.88em; color: #e11d48; }
  .prose pre { background: var(--code-bg); border: 1px solid var(--border); border-radius: 8px; padding: 16px; overflow-x: auto; margin: 12px 0; }
  .prose pre code { background: none; border: none; padding: 0; color: var(--text); font-size: 12px; line-height: 1.6; }
  .prose blockquote { border-left: 3px solid var(--brand); padding: 8px 16px; margin: 12px 0; background: var(--brand-light); border-radius: 0 6px 6px 0; color: var(--text-secondary); font-style: italic; }
  .prose a { color: var(--brand); text-decoration: underline; }
  .prose strong { font-weight: 600; color: var(--text); }
  .prose hr { border: none; border-top: 1px solid var(--border); margin: 16px 0; }
  .prose table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
  .prose th, .prose td { padding: 8px 12px; border: 1px solid var(--border); text-align: left; }
  .prose th { background: var(--surface); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; }

  /* ── Footer ──────────────────────────────────────────────────── */
  .doc-footer {
    margin-top: 60px;
    padding-top: 24px;
    border-top: 2px solid var(--border);
    text-align: center;
    font-size: 11px;
    color: var(--text-secondary);
    page-break-inside: avoid;
  }
  .doc-footer-brand { font-weight: 700; font-size: 13px; color: var(--text); margin-bottom: 4px; }
  .doc-footer p { margin: 2px 0; }
</style>
</head>
<body>

<!-- COVER -->
<div class="cover">
  <div class="cover-badge">● ${escapeHtml(meta.statusLabel)}</div>
  <h1 class="cover-title">${escapeHtml(meta.title)}</h1>
  <p class="cover-subtitle">${escapeHtml(meta.projectName)} — Engineering Documentation</p>
  <div class="cover-meta">
    <span><strong>Project:</strong> ${escapeHtml(meta.projectName)}</span>
    ${meta.branch ? `<span><strong>Branch:</strong> <code style="font-family:var(--mono);background:var(--code-bg);padding:2px 6px;border-radius:4px;font-size:12px;">${escapeHtml(meta.branch)}</code></span>` : ''}
    <span><strong>Started:</strong> ${escapeHtml(meta.startedAt)}</span>
    <span><strong>Last Updated:</strong> ${escapeHtml(meta.updatedAt)}</span>
    <span><strong>Generated:</strong> ${escapeHtml(meta.generatedAt)}</span>
  </div>
  <div class="cover-footer">Generated by FocusFlow · Engineering Documentation Generator</div>
</div>

<!-- CONTENT -->
<div class="content">

  <!-- Feature Information Table -->
  <table class="feature-table">
    <tr><td>Project</td><td>${escapeHtml(meta.projectName)}</td></tr>
    <tr><td>Feature</td><td>${escapeHtml(meta.featureName)}</td></tr>
    ${meta.branch ? `<tr><td>Branch</td><td style="font-family:var(--mono);font-size:12px;">${escapeHtml(meta.branch)}</td></tr>` : ''}
    <tr><td>Status</td><td><span class="status-badge">● ${escapeHtml(meta.statusLabel)}</span></td></tr>
    <tr><td>Started</td><td>${escapeHtml(meta.startedAt)}</td></tr>
    <tr><td>Updated</td><td>${escapeHtml(meta.updatedAt)}</td></tr>
  </table>

  <!-- Executive Summary -->
  <div class="section">
    <div class="section-header">
      <div class="section-icon" style="background:var(--brand-light);color:var(--brand);">📄</div>
      <h2 class="section-title">Executive Summary</h2>
    </div>
    <div class="section-body prose">
      <p>This document describes the implementation of <strong>${escapeHtml(meta.featureName)}</strong> for <strong>${escapeHtml(meta.projectName)}</strong>. The work log captures the engineering process from problem definition through implementation, including architecture decisions, progress tracking, and completion status.</p>
      ${stats.blockersPresent ? '<p><strong>Note:</strong> There are active blockers that may impact delivery timeline.</p>' : ''}
    </div>
  </div>

  <!-- Document Statistics -->
  <div class="section">
    <div class="section-header">
      <div class="section-icon" style="background:var(--purple-light);color:var(--purple);">📊</div>
      <h2 class="section-title">Document Statistics</h2>
    </div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${stats.sectionsWritten}/${stats.totalSections}</div>
        <div class="stat-label">Sections Written</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.totalDays}</div>
        <div class="stat-label">Days Active</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.totalMilestones > 0 ? `${stats.completedMilestones}/${stats.totalMilestones}` : '—'}</div>
        <div class="stat-label">Milestones</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:var(--brand);">${Math.floor(stats.totalTimeMs / 3600000)}h</div>
        <div class="stat-label">Total Time</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:${stats.blockersPresent ? 'var(--red)' : 'var(--green)'};">
          ${stats.blockersPresent ? 'Yes' : 'None'}
        </div>
        <div class="stat-label">Blockers</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:var(--accent);">${stats.completionPercent}%</div>
        <div class="stat-label">Completion</div>
      </div>
    </div>
  </div>

  ${sections.filter(s => !s.hidden && s.id !== 'blockers').map(section => `
  <div class="section">
    <div class="section-header">
      <div class="section-icon" style="background:var(--surface);">${section.icon}</div>
      <h2 class="section-title">${escapeHtml(section.title)}</h2>
    </div>
    <div class="section-body prose">
      ${renderMd(section.content)}
    </div>
  </div>
  `).join('')}

  <!-- Implementation Roadmap -->
  ${milestones.length > 0 ? `
  <div class="section">
    <div class="section-header">
      <div class="section-icon" style="background:var(--green-light);color:var(--green);">✅</div>
      <h2 class="section-title">Implementation Roadmap</h2>
    </div>
    <div class="section-body">
      ${milestones.map((m, i) => `
      <div class="milestone">
        <span class="milestone-num">${String(i + 1).padStart(2, '0')}</span>
        <div class="milestone-check ${m.done ? 'done' : 'pending'}">${m.done ? '✓' : '○'}</div>
        <span class="milestone-text ${m.done ? 'done' : 'pending'}">${escapeHtml(m.text)}</span>
      </div>
      `).join('')}
    </div>
  </div>
  ` : ''}

  <!-- Blockers (only if present) -->
  ${sections.find(s => s.id === 'blockers' && !s.hidden) ? `
  <div class="section">
    <div class="section-header">
      <div class="section-icon" style="background:var(--red-light);color:var(--red);">🚧</div>
      <h2 class="section-title">Current Blockers</h2>
    </div>
    <div class="section-body prose">
      ${renderMd(sections.find(s => s.id === 'blockers')!.content)}
    </div>
  </div>
  ` : ''}

  <!-- Work History -->
  ${workEntries.length > 0 ? `
  <div class="section">
    <div class="section-header">
      <div class="section-icon" style="background:var(--brand-light);color:var(--brand);">📅</div>
      <h2 class="section-title">Development Log</h2>
    </div>
    <div class="section-body">
      ${workEntries.slice(0, 20).map(e => `
      <div class="timeline-entry">
        <div class="timeline-dot"></div>
        <div>
          <div>
            <span class="timeline-date">${escapeHtml(e.date)}</span>
            ${e.activeMs > 0 ? `<span class="timeline-time">${formatMs(e.activeMs)}</span>` : ''}
          </div>
          ${e.what ? `<div class="timeline-what prose">${renderMd(e.what)}</div>` : ''}
        </div>
      </div>
      `).join('')}
    </div>
  </div>
  ` : ''}

  <!-- Links -->
  ${links.length > 0 ? `
  <div class="section">
    <div class="section-header">
      <div class="section-icon" style="background:var(--accent-light);color:var(--accent);">🔗</div>
      <h2 class="section-title">References</h2>
    </div>
    <div class="section-body">
      ${links.map(l => `<a href="${escapeHtml(l.url)}" class="link-item" target="_blank">🔗 ${escapeHtml(l.label)} — ${escapeHtml(l.url)}</a>`).join('')}
    </div>
  </div>
  ` : ''}

  <!-- Footer -->
  <div class="doc-footer">
    <div class="doc-footer-brand">FocusFlow</div>
    <p>Engineering Documentation Generator</p>
    <p>Generated ${escapeHtml(meta.generatedAt)}</p>
    <p style="margin-top:8px;opacity:0.5;">Confidential — For Internal Use Only</p>
  </div>
</div>
</body>
</html>`;
}
