import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, TableRow, TableCell, Table, WidthType,
  BorderStyle, ShadingType, PageBreak, Footer, PageNumber,
  NumberFormat, TabStopType, TabStopPosition,
} from 'docx';
import { saveAs } from 'file-saver';
import type { DocumentModel } from '../types';
import { renderMarkdown } from '../../../components/ui/proEditor';

function mdToDocxParagraphs(md: string): Paragraph[] {
  if (!md.trim()) return [new Paragraph({ children: [new TextRun({ text: '', size: 22 })] })];
  const html = renderMarkdown(md);
  const div = document.createElement('div');
  div.innerHTML = html;

  const paragraphs: Paragraph[] = [];
  const nodes = div.querySelectorAll('p, h1, h2, h3, li, pre, blockquote, hr');

  if (nodes.length === 0) {
    return [new Paragraph({ children: [new TextRun({ text: md, size: 22, font: 'Calibri' })] })];
  }

  nodes.forEach(node => {
    const tag = node.tagName.toLowerCase();
    const text = node.textContent || '';

    if (tag === 'h1') {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 120 },
        children: [new TextRun({ text, bold: true, size: 32, font: 'Calibri' })],
      }));
    } else if (tag === 'h2') {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 100 },
        children: [new TextRun({ text, bold: true, size: 26, font: 'Calibri' })],
      }));
    } else if (tag === 'h3') {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 80 },
        children: [new TextRun({ text, bold: true, size: 24, font: 'Calibri' })],
      }));
    } else if (tag === 'li') {
      paragraphs.push(new Paragraph({
        bullet: { level: 0 },
        spacing: { before: 40, after: 40 },
        children: [new TextRun({ text, size: 22, font: 'Calibri' })],
      }));
    } else if (tag === 'pre') {
      paragraphs.push(new Paragraph({
        spacing: { before: 120, after: 120 },
        shading: { type: ShadingType.SOLID, color: 'F1F5F9', fill: 'F1F5F9' },
        indent: { left: 360 },
        children: [new TextRun({ text, size: 20, font: 'Consolas' })],
      }));
    } else if (tag === 'blockquote') {
      paragraphs.push(new Paragraph({
        spacing: { before: 120, after: 120 },
        indent: { left: 480 },
        children: [new TextRun({ text, italics: true, size: 22, font: 'Calibri', color: '64748B' })],
      }));
    } else if (tag === 'hr') {
      paragraphs.push(new Paragraph({
        spacing: { before: 200, after: 200 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'E2E8F0' } },
        children: [],
      }));
    } else {
      paragraphs.push(new Paragraph({
        spacing: { before: 80, after: 80 },
        children: [new TextRun({ text, size: 22, font: 'Calibri' })],
      }));
    }
  });

  return paragraphs.length > 0 ? paragraphs : [
    new Paragraph({ children: [new TextRun({ text: md, size: 22, font: 'Calibri' })] }),
  ];
}

export async function exportToDocx(doc: DocumentModel, filename: string): Promise<void> {
  const { meta, sections, milestones, stats } = doc;
  const children: (Paragraph | Table)[] = [];

  // Cover
  children.push(new Paragraph({ spacing: { before: 2400 }, children: [] }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: 'ENGINEERING DOCUMENTATION', size: 20, font: 'Calibri', color: '64748B', allCaps: true })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text: meta.title, bold: true, size: 48, font: 'Calibri' })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({ text: `${meta.projectName} — ${meta.statusLabel}`, size: 24, font: 'Calibri', color: '64748B' })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text: `Generated: ${meta.generatedAt}`, size: 20, font: 'Calibri', color: '94A3B8' })],
  }));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // Feature Info Table
  const tableRows = [
    ['Project', meta.projectName],
    ['Feature', meta.featureName],
    ['Branch', meta.branch || '—'],
    ['Status', meta.statusLabel],
    ['Started', meta.startedAt],
    ['Updated', meta.updatedAt],
  ];

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows.map(([label, value]) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: 'F8FAFC', fill: 'F8FAFC' },
            children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20, font: 'Calibri', color: '64748B' })] })],
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: value, size: 22, font: 'Calibri' })] })],
          }),
        ],
      })
    ),
  }));

  children.push(new Paragraph({ spacing: { after: 300 }, children: [] }));

  // Executive Summary
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text: 'Executive Summary', bold: true, size: 32, font: 'Calibri' })],
  }));
  children.push(new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({
      text: `This document describes the implementation of ${meta.featureName} for ${meta.projectName}. The work log captures the engineering process from problem definition through implementation, including architecture decisions, progress tracking, and completion status.`,
      size: 22, font: 'Calibri',
    })],
  }));
  if (stats.blockersPresent) {
    children.push(new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: 'Note: There are active blockers that may impact delivery timeline.', bold: true, size: 22, font: 'Calibri' })],
    }));
  }

  // Document Statistics
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text: 'Document Statistics', bold: true, size: 32, font: 'Calibri' })],
  }));
  const statRows = [
    ['Sections Written', `${stats.sectionsWritten}/${stats.totalSections}`],
    ['Days Active', String(stats.totalDays)],
    ['Milestones', stats.totalMilestones > 0 ? `${stats.completedMilestones}/${stats.totalMilestones}` : '—'],
    ['Total Time', `${Math.floor(stats.totalTimeMs / 3600000)}h`],
    ['Blockers', stats.blockersPresent ? 'Yes' : 'None'],
    ['Completion', `${stats.completionPercent}%`],
  ];
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: statRows.map(([label, value]) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: 'F8FAFC', fill: 'F8FAFC' },
            children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20, font: 'Calibri', color: '64748B' })] })],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: value, bold: true, size: 24, font: 'Calibri' })] })],
          }),
        ],
      })
    ),
  }));
  children.push(new Paragraph({ spacing: { after: 300 }, children: [] }));

  // Sections
  sections.filter(s => !s.hidden && s.id !== 'blockers').forEach(section => {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
      children: [new TextRun({ text: `${section.icon} ${section.title}`, bold: true, size: 32, font: 'Calibri' })],
    }));
    children.push(...mdToDocxParagraphs(section.content));
    children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
  });

  // Milestones
  if (milestones.length > 0) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
      children: [new TextRun({ text: 'Implementation Roadmap', bold: true, size: 32, font: 'Calibri' })],
    }));
    milestones.forEach((m, i) => {
      children.push(new Paragraph({
        bullet: { level: 0 },
        spacing: { before: 60, after: 60 },
        children: [
          new TextRun({ text: `${m.done ? '✓' : '○'} `, size: 22, font: 'Calibri', bold: true }),
          new TextRun({ text: m.text, size: 22, font: 'Calibri', strike: m.done }),
        ],
      }));
    });
  }

  // Blockers (if present)
  const blockerSection = sections.find(s => s.id === 'blockers' && !s.hidden);
  if (blockerSection) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
      children: [new TextRun({ text: '🚧 Current Blockers', bold: true, size: 32, font: 'Calibri' })],
    }));
    children.push(...mdToDocxParagraphs(blockerSection.content));
  }

  // Footer
  children.push(new Paragraph({ spacing: { before: 600 }, children: [] }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    border: { top: { style: BorderStyle.SINGLE, size: 6, color: 'E2E8F0' } },
    spacing: { before: 200 },
    children: [new TextRun({ text: 'Generated by FocusFlow · Engineering Documentation Generator', size: 18, font: 'Calibri', color: '94A3B8' })],
  }));

  const docxDoc = new Document({
    creator: 'FocusFlow',
    title: `${meta.title} — Engineering Documentation`,
    description: `Engineering documentation generated by FocusFlow for ${meta.title}`,
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'FocusFlow · ', size: 16, font: 'Calibri', color: '94A3B8' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Calibri', color: '94A3B8' }),
              new TextRun({ text: ' / ', size: 16, font: 'Calibri', color: '94A3B8' }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, font: 'Calibri', color: '94A3B8' }),
            ],
          })],
        }),
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(docxDoc);
  saveAs(blob, `${filename}.docx`);
}
