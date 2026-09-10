import juice from 'juice';
import html2pdf from 'html2pdf.js';
import { resolveCssVars } from './resolveCssVars';

const PDF_OVERRIDES = `<style>
  .cover { min-height: 297mm !important; }
  @page { size: A4; margin: 0; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>`;

interface PdfMeta {
  title: string;
  generatedAt: string;
}

export async function exportToPdf(html: string, filename: string, meta: PdfMeta): Promise<void> {
  await document.fonts.ready;

  const resolved = resolveCssVars(html);
  const inlined = juice(resolved, {
    preserveMediaQueries: true,
    preserveFontFaces: true,
    preserveImportant: true,
    removeStyleTags: false,
  });

  const withOverrides = inlined.replace('</head>', `${PDF_OVERRIDES}</head>`);

  const el = document.createElement('div');
  el.innerHTML = withOverrides;
  el.style.position = 'fixed';
  el.style.left = '-9999px';
  el.style.top = '0';
  el.style.width = '794px';
  document.body.appendChild(el);

  try {
    const pdfPromise = html2pdf()
      .set({
        margin: [18, 10, 28, 10],
        filename: `${filename}.pdf`,
        image: { type: 'png' },
        html2canvas: {
          scale: 3,
          useCORS: true,
          letterRendering: true,
          logging: false,
          windowWidth: 794,
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait',
        },
      })
      .from(el)
      .toPdf()
      .get('pdf');

    const pdf = await pdfPromise;
    const totalPages = pdf.getNumberOfPages();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);

      // ── Header ──
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(26, 26, 46);
      pdf.text(meta.title, 10, 10);

      pdf.setFontSize(10);
      pdf.setTextColor(14, 165, 233);
      pdf.text('FocusFlow', pageWidth - 10, 10, { align: 'right' });

      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.3);
      pdf.line(10, 13, pageWidth - 10, 13);

      // ── Footer ──
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.3);
      pdf.line(10, pageHeight - 14, pageWidth - 10, pageHeight - 14);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(26, 26, 46);
      pdf.text('FocusFlow', 10, pageHeight - 10);

      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139);
      pdf.text('Engineering Documentation', 10, pageHeight - 6);

      pdf.text(meta.generatedAt, pageWidth / 2, pageHeight - 10, { align: 'center' });

      pdf.setFont('helvetica', 'italic');
      pdf.text('Confidential — For Internal Use Only', pageWidth - 10, pageHeight - 10, { align: 'right' });

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(148, 163, 184);
      pdf.text(`Page ${i} of ${totalPages}`, pageWidth - 10, pageHeight - 6, { align: 'right' });
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(el);
  }
}
