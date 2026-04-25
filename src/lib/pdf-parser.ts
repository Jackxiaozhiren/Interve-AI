// Use dynamic import for pdfjsLib to avoid "DOMMatrix is not defined" error in Next.js SSR

/**
 * Parses a PDF file and extracts its text content locally in the browser.
 * @param file The PDF File object from an input element.
 * @returns A promise that resolves to the extracted text.
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('PDF parsing is only supported in the browser.');
  }

  try {
    // Dynamically import pdfjs-dist
    const pdfjsLib = await import('pdfjs-dist');
    
    // Use the locally hosted worker (copied to public/ dir via postinstall) for robustness and to avoid CDN issues
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument(new Uint8Array(arrayBuffer));
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        // @ts-expect-error - pdfjs items missing str typing
        .map((item) => item.str)
        .join(' ');
      
      fullText += pageText + '\n\n';
    }
    
    return fullText.trim();
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to parse PDF document.');
  }
}
