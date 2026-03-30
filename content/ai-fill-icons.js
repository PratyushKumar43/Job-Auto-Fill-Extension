// =============================================
// AI-Fill Icons — Injects a small ✨ AI button
// above textarea / paragraph fields. Clicking it
// sends the field label + profile to the LLM and
// fills the field with a concise, tailored answer.
// =============================================

(function () {
  'use strict';

  // Check if the extension context is still valid
  function isContextValid() {
    try { return !!chrome.runtime?.id; } catch { return false; }
  }

  const AI_ICON_ATTR = 'data-jaf-ai-icon';
  let iconsInjected = false;

  // ---------- Styles ----------
  function injectStyles() {
    if (document.getElementById('jaf-ai-icon-styles')) return;
    const style = document.createElement('style');
    style.id = 'jaf-ai-icon-styles';
    style.textContent = `
      .jaf-ai-btn {
        position: absolute;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        font-size: 11px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-weight: 600;
        color: #fff;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border: none;
        border-radius: 6px;
        cursor: pointer;
        z-index: 999999;
        box-shadow: 0 2px 6px rgba(102, 126, 234, 0.4);
        transition: all 0.2s ease;
        line-height: 1;
        white-space: nowrap;
      }
      .jaf-ai-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5);
        background: linear-gradient(135deg, #5a6fd6 0%, #6a4194 100%);
      }
      .jaf-ai-btn:active {
        transform: translateY(0);
      }
      .jaf-ai-btn.jaf-loading {
        pointer-events: none;
        opacity: 0.8;
      }
      .jaf-ai-btn.jaf-loading .jaf-ai-icon {
        animation: jaf-spin 1s linear infinite;
      }
      .jaf-ai-btn.jaf-done {
        background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
      }
      .jaf-ai-icon {
        font-size: 12px;
        line-height: 1;
      }
      @keyframes jaf-spin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  // ---------- Find paragraph-like fields ----------
  function findParagraphFields() {
    const fields = [];
    const seen = new Set();

    // Textareas
    document.querySelectorAll('textarea').forEach(el => {
      if (!isVisible(el) || seen.has(el)) return;
      seen.add(el);
      fields.push(el);
    });

    // Tall inputs (multi-line style) and contenteditable
    document.querySelectorAll('[contenteditable="true"]').forEach(el => {
      if (!isVisible(el) || seen.has(el)) return;
      const rect = el.getBoundingClientRect();
      if (rect.height > 50) {
        seen.add(el);
        fields.push(el);
      }
    });

    // Some sites use large inputs
    document.querySelectorAll('input[type="text"]').forEach(el => {
      if (!isVisible(el) || seen.has(el)) return;
      // Check if it looks like a paragraph field by label keywords
      const label = getFieldLabel(el).toLowerCase();
      const paragraphKeywords = ['cover letter', 'summary', 'about', 'describe', 'why', 'tell us', 'additional', 'note', 'message', 'comments', 'letter', 'introduction'];
      if (paragraphKeywords.some(k => label.includes(k))) {
        seen.add(el);
        fields.push(el);
      }
    });

    return fields;
  }

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  // ---------- Label extraction ----------
  function getFieldLabel(element) {
    // 1. Explicit label[for]
    if (element.id) {
      const labelEl = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (labelEl) return labelEl.textContent.trim();
    }
    // 2. Wrapping label
    const parentLabel = element.closest('label');
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true);
      clone.querySelectorAll('input, select, textarea').forEach(c => c.remove());
      const text = clone.textContent.trim();
      if (text) return text;
    }
    // 3. Previous sibling
    let prev = element.previousElementSibling;
    if (prev && ['LABEL', 'SPAN', 'DIV', 'P', 'H3', 'H4', 'H5', 'LEGEND'].includes(prev.tagName)) {
      const text = prev.textContent.trim();
      if (text.length > 0 && text.length < 500) return text;
    }
    // 4. Parent's preceding label
    const parent = element.parentElement;
    if (parent) {
      for (const child of parent.children) {
        if (child === element) break;
        if (['LABEL', 'SPAN', 'DIV', 'P', 'LEGEND', 'H2', 'H3', 'H4', 'H5'].includes(child.tagName)) {
          const text = child.textContent.trim();
          if (text.length > 0 && text.length < 500) return text;
        }
      }
    }
    // 5. Walk up ancestors looking for a heading/label (up to 5 levels)
    let ancestor = element.parentElement;
    for (let depth = 0; ancestor && depth < 5; depth++) {
      // Look for label/heading children that come before the element's subtree
      const headings = ancestor.querySelectorAll('label, legend, h1, h2, h3, h4, h5, p, span.question, [data-testid*="question"], [class*="question"], [class*="title"], [class*="label"]');
      for (const h of headings) {
        if (h.contains(element)) continue; // skip if it contains the field itself
        const text = h.textContent.trim();
        if (text.length > 3 && text.length < 500) return text;
      }
      ancestor = ancestor.parentElement;
    }
    // 6. aria-label, placeholder, name
    return element.getAttribute('aria-label') || element.placeholder || element.name || '';
  }

  // ---------- Inject icon above a field ----------
  function injectIcon(field) {
    if (field.getAttribute(AI_ICON_ATTR)) return; // already has icon
    field.setAttribute(AI_ICON_ATTR, '1');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'jaf-ai-btn';
    btn.innerHTML = '<span class="jaf-ai-icon">✨</span> AI Fill';
    btn.title = 'Generate AI-tailored answer for this field';

    // Position the button above the field
    const wrapper = field.parentElement;
    if (wrapper) {
      // Make parent relative if not already positioned
      const pos = window.getComputedStyle(wrapper).position;
      if (pos === 'static') wrapper.style.position = 'relative';
    }

    // Insert the button right before the field
    field.parentNode.insertBefore(btn, field);

    // Give the button a small margin
    btn.style.marginBottom = '4px';
    btn.style.display = 'inline-flex';
    btn.style.position = 'relative';

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await handleAIFillClick(btn, field);
    });
  }

  // ---------- AI Fill click handler ----------
  async function handleAIFillClick(btn, field) {
    const label = getFieldLabel(field);
    if (!label) {
      showFieldToast(field, 'Could not detect field label');
      return;
    }

    // Set loading state
    const origHTML = btn.innerHTML;
    btn.classList.add('jaf-loading');
    btn.innerHTML = '<span class="jaf-ai-icon">⚙️</span> Generating...';

    try {
      if (!isContextValid()) {
        showFieldToast(field, 'Extension was reloaded — please refresh this page (F5)');
        return;
      }

      // Ask background to generate a tailored answer
      const response = await chrome.runtime.sendMessage({
        type: 'llm:fieldFill',
        fieldLabel: label,
        currentValue: field.value || field.innerText || '',
      });

      if (!response || response.error) {
        throw new Error(response?.error || 'No response from AI');
      }

      // Fill the field with the AI response
      if (typeof EventSim !== 'undefined') {
        EventSim.setValue(field, response.text);
      } else {
        // Fallback
        if (field.isContentEditable) {
          field.innerText = response.text;
        } else {
          field.value = response.text;
        }
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Success state
      btn.classList.remove('jaf-loading');
      btn.classList.add('jaf-done');
      btn.innerHTML = '<span class="jaf-ai-icon">✅</span> Done';
      setTimeout(() => {
        btn.classList.remove('jaf-done');
        btn.innerHTML = origHTML;
      }, 2000);

    } catch (err) {
      console.error('AI Fill error:', err);
      btn.classList.remove('jaf-loading');
      btn.innerHTML = origHTML;
      const msg = (err.message || '').includes('Extension context invalidated')
        ? 'Extension was reloaded — please refresh this page (F5)'
        : (err.message || 'AI fill failed');
      showFieldToast(field, msg);
    }
  }

  // ---------- Toast utility ----------
  function showFieldToast(field, message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      background: #e53e3e; color: #fff; padding: 8px 16px; border-radius: 8px;
      font-size: 13px; font-family: -apple-system, sans-serif; z-index: 9999999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: opacity 0.3s;
    `;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; }, 2500);
    setTimeout(() => toast.remove(), 3000);
  }

  // ---------- Scan and inject ----------
  function scanAndInject() {
    injectStyles();
    const fields = findParagraphFields();
    fields.forEach(injectIcon);
    iconsInjected = fields.length > 0;
  }

  // Run on load and observe DOM changes
  scanAndInject();

  // Re-scan when DOM changes (SPA page transitions, lazy-loaded forms)
  const observer = new MutationObserver(() => {
    clearTimeout(observer._timer);
    observer._timer = setTimeout(scanAndInject, 500);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Also scan when explicitly told to
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'content:scanAIIcons') {
      scanAndInject();
      sendResponse({ injected: true });
      return true;
    }
  });

})();
