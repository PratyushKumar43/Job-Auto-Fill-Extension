// =============================================
// DOM Field Detector
// Scans the page for fillable form fields and
// extracts their labels/names for matching
// =============================================

const FieldDetector = {

  /**
   * Scan the page and return all detected form fields.
   * @returns {Array<{ element, label, name, placeholder, type, tagName }>}
   */
  detectFields() {
    const fields = [];
    const seen = new Set();

    // 1. Standard form inputs
    const inputs = document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]):not([type="reset"]):not([type="file"]), ' +
      'textarea, ' +
      'select, ' +
      '[contenteditable="true"]'
    );

    inputs.forEach(el => {
      if (seen.has(el)) return;
      if (!this.isVisible(el)) return;
      seen.add(el);

      const info = this.getFieldInfo(el);
      if (info.label || info.name || info.placeholder) {
        fields.push(info);
      }
    });

    return fields;
  },

  /**
   * Check if element is visible in viewport.
   */
  isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  },

  /**
   * Extract label/name/placeholder/type info from a field element.
   */
  getFieldInfo(element) {
    const tagName = element.tagName.toLowerCase();
    const type = (element.type || '').toLowerCase();
    const name = element.name || element.id || '';
    const placeholder = element.placeholder || '';
    const ariaLabel = element.getAttribute('aria-label') || '';

    // Try to find associated <label>
    let label = '';

    // 1. Explicit <label for="...">
    if (element.id) {
      const labelEl = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (labelEl) label = labelEl.textContent.trim();
    }

    // 2. Wrapping <label>
    if (!label) {
      const parentLabel = element.closest('label');
      if (parentLabel) {
        // Get text excluding the input itself
        const clone = parentLabel.cloneNode(true);
        clone.querySelectorAll('input, select, textarea').forEach(c => c.remove());
        label = clone.textContent.trim();
      }
    }

    // 3. Adjacent label (sibling or close ancestor text)
    if (!label) {
      label = this.findNearbyLabel(element);
    }

    // 4. Aria-label
    if (!label && ariaLabel) {
      label = ariaLabel;
    }

    // 5. Placeholder as fallback
    if (!label && placeholder) {
      label = placeholder;
    }

    // 6. Name attribute as last resort
    if (!label && name) {
      label = this.humanize(name);
    }

    return {
      element,
      label: label.replace(/\*$/, '').trim(), // Remove trailing asterisk (required markers)
      name,
      placeholder,
      type,
      tagName,
      ariaLabel
    };
  },

  /**
   * Look for nearby text that acts as a label.
   */
  findNearbyLabel(element) {
    // Check previous sibling
    let prev = element.previousElementSibling;
    if (prev && ['LABEL', 'SPAN', 'DIV', 'P', 'H3', 'H4', 'H5'].includes(prev.tagName)) {
      const text = prev.textContent.trim();
      if (text.length > 0 && text.length < 100) return text;
    }

    // Check parent's first text-bearing child
    const parent = element.parentElement;
    if (parent) {
      for (const child of parent.children) {
        if (child === element) break;
        if (['LABEL', 'SPAN', 'DIV', 'P', 'LEGEND'].includes(child.tagName)) {
          const text = child.textContent.trim();
          if (text.length > 0 && text.length < 100) return text;
        }
      }
    }

    // Google Forms specific: look for data-params or item-title
    const formItem = element.closest('[data-params]') || element.closest('.freebirdFormviewItemViewItemItem');
    if (formItem) {
      const titleEl = formItem.querySelector('[role="heading"], .freebirdFormviewItemViewItemItemTitle, .M7eMe');
      if (titleEl) return titleEl.textContent.trim();
    }

    return '';
  },

  /**
   * Convert camelCase or snake_case to human-readable.
   */
  humanize(str) {
    return str
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  },

  /**
   * Detect which job board we're on.
   */
  detectBoard() {
    const url = window.location.href;
    if (url.includes('linkedin.com')) return 'linkedin';
    if (url.includes('greenhouse.io')) return 'greenhouse';
    if (url.includes('lever.co')) return 'lever';
    if (url.includes('myworkdayjobs.com')) return 'workday';
    if (url.includes('ashbyhq.com')) return 'ashby';
    if (url.includes('docs.google.com/forms')) return 'google-forms';
    return 'generic';
  },

  /**
   * Board-specific field detection overrides.
   */
  detectBoardSpecificFields(board) {
    switch (board) {
      case 'google-forms':
        return this.detectGoogleFormsFields();
      case 'greenhouse':
        return this.detectGreenhouseFields();
      case 'lever':
        return this.detectLeverFields();
      default:
        return [];
    }
  },

  /**
   * Google Forms: Fields use different structure.
   */
  detectGoogleFormsFields() {
    const fields = [];
    const questions = document.querySelectorAll('[data-params], .freebirdFormviewItemViewItemItem, .Qr7Oae');

    questions.forEach(q => {
      // Get question title
      const titleEl = q.querySelector('[role="heading"], .freebirdFormviewItemViewItemItemTitle, .M7eMe, .HoXoMd');
      const label = titleEl ? titleEl.textContent.trim() : '';

      // Find the input within this question
      const input = q.querySelector('input[type="text"], input[type="email"], input[type="url"], input[type="tel"], textarea, select');
      if (input && label) {
        fields.push({
          element: input,
          label,
          name: input.name || '',
          placeholder: input.placeholder || '',
          type: input.type || 'text',
          tagName: input.tagName.toLowerCase()
        });
      }

      // Radio buttons / checkboxes in Google Forms
      const radios = q.querySelectorAll('[role="radio"], [data-value]');
      if (radios.length > 0 && label) {
        // We'll try to click the matching radio based on value
        fields.push({
          element: q, // Pass the container
          label,
          name: '',
          placeholder: '',
          type: 'google-forms-radio',
          tagName: 'div',
          options: Array.from(radios).map(r => ({
            element: r,
            text: r.textContent.trim() || r.getAttribute('data-value') || ''
          }))
        });
      }
    });

    return fields;
  },

  detectGreenhouseFields() {
    // Greenhouse uses standard form elements, but wrapped in specific containers
    const fields = [];
    const fieldContainers = document.querySelectorAll('.field, [class*="field"]');

    fieldContainers.forEach(container => {
      const label = container.querySelector('label');
      const input = container.querySelector('input, textarea, select');
      if (label && input) {
        fields.push({
          element: input,
          label: label.textContent.trim().replace(/\*$/, '').trim(),
          name: input.name || '',
          placeholder: input.placeholder || '',
          type: input.type || 'text',
          tagName: input.tagName.toLowerCase()
        });
      }
    });

    return fields;
  },

  detectLeverFields() {
    const fields = [];
    const groups = document.querySelectorAll('.application-question, .posting-category');

    groups.forEach(group => {
      const labelEl = group.querySelector('label, .posting-category-title');
      const input = group.querySelector('input, textarea, select');
      if (labelEl && input) {
        fields.push({
          element: input,
          label: labelEl.textContent.trim().replace(/\*$/, '').trim(),
          name: input.name || '',
          placeholder: input.placeholder || '',
          type: input.type || 'text',
          tagName: input.tagName.toLowerCase()
        });
      }
    });

    return fields;
  }
};
