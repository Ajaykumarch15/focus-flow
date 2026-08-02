import html2pdf from 'html2pdf.js';

export async function exportToPdf(html: string, filename: string, sourceElement?: HTMLElement): Promise<void> {
  let container: HTMLElement;
  let created = false;

  if (sourceElement) {
    container = sourceElement;
  } else {
    const el = document.createElement('div');
    el.innerHTML = html;
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    el.style.top = '0';
    el.style.width = '210mm';
    document.body.appendChild(el);
    container = el;
    created = true;
  }

  try {
    await html2pdf()
      .set({
        margin: 0,
        filename: `${filename}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          logging: false,
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait',
        },
      })
      .from(container)
      .save();
  } finally {
    if (created) {
      document.body.removeChild(container);
    }
  }
}
