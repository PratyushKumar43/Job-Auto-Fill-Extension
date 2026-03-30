// =============================================
// PDF Parser — Uses pdf.js to extract structured text
// Preserves layout using spatial coordinates from pdf.js
// =============================================

const PdfParser = {
  _pdfjsLoaded: false,

  async _loadPdfJs() {
    if (this._pdfjsLoaded) return;
    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.js');
      this._pdfjsLoaded = true;
      return;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('lib/pdf.min.js');
      script.onload = () => {
        pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.js');
        this._pdfjsLoaded = true;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load PDF.js library'));
      document.head.appendChild(script);
    });
  },

  async extractText(file) {
    await this._loadPdfJs();

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = this._buildStructuredText(content.items);
      if (pageText.trim()) pages.push(pageText);
    }

    return pages.join('\n\n---\n\n');
  },

  /**
   * Reconstruct readable text from pdf.js text items using spatial coordinates.
   * Groups items into lines by Y-position, sorts by X within each line,
   * and detects section breaks from vertical gaps.
   */
  _buildStructuredText(items) {
    if (!items || items.length === 0) return '';

    // Extract position + text from each item
    const positioned = items
      .filter(item => item.str && item.str.trim())
      .map(item => ({
        text: item.str,
        x: item.transform ? item.transform[4] : 0,
        y: item.transform ? item.transform[5] : 0,
        fontSize: item.transform ? Math.abs(item.transform[0]) : 12,
        width: item.width || 0,
        hasEOL: item.hasEOL || false
      }));

    if (positioned.length === 0) return '';

    // Sort by Y descending (PDF coordinates: bottom = 0), then X ascending
    positioned.sort((a, b) => {
      const yDiff = b.y - a.y;
      if (Math.abs(yDiff) > 2) return yDiff; // different lines
      return a.x - b.x; // same line, sort left to right
    });

    // Group into lines by Y-coordinate proximity
    const lines = [];
    let currentLine = [positioned[0]];
    const LINE_THRESHOLD = 3; // points — items within this Y range are same line

    for (let i = 1; i < positioned.length; i++) {
      const prev = currentLine[0];
      const curr = positioned[i];

      if (Math.abs(prev.y - curr.y) <= LINE_THRESHOLD) {
        currentLine.push(curr);
      } else {
        // Sort current line left-to-right and push
        currentLine.sort((a, b) => a.x - b.x);
        lines.push(currentLine);
        currentLine = [curr];
      }
    }
    currentLine.sort((a, b) => a.x - b.x);
    lines.push(currentLine);

    // Build text with intelligent spacing
    const textLines = [];
    let prevY = null;
    let prevFontSize = 12;

    for (const line of lines) {
      const lineY = line[0].y;
      const lineFontSize = Math.max(...line.map(i => i.fontSize));

      // Detect vertical gaps for section breaks
      if (prevY !== null) {
        const gap = prevY - lineY;
        const expectedGap = prevFontSize * 1.4; // normal line spacing ~1.4x font size
        if (gap > expectedGap * 2) {
          textLines.push(''); // blank line = section break
        }
      }

      // Join items within a line with appropriate spacing
      let lineText = '';
      for (let i = 0; i < line.length; i++) {
        const item = line[i];
        if (i > 0) {
          const prevItem = line[i - 1];
          const gap = item.x - (prevItem.x + prevItem.width);
          // Large horizontal gap = column separator or tab
          if (gap > prevFontSize * 2) {
            lineText += '  |  ';
          } else if (gap > prevFontSize * 0.3) {
            lineText += ' ';
          }
        }
        lineText += item.text;
      }

      // Detect bullet points and list items
      const trimmed = lineText.trim();
      if (/^[•▪▸►◆○●\-–—]\s/.test(trimmed)) {
        lineText = '• ' + trimmed.replace(/^[•▪▸►◆○●\-–—]\s*/, '');
      }

      textLines.push(lineText.trim());
      prevY = lineY;
      prevFontSize = lineFontSize;
    }

    // Clean up: collapse excessive blank lines, trim
    return textLines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
};

if (typeof window !== 'undefined') window.PdfParser = PdfParser;
