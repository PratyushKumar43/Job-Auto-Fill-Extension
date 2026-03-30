// =============================================
// Event Simulation — Dispatches realistic input events
// Required for React/Vue/Angular form bindings
// =============================================

const EventSim = {
  /**
   * Set a value on an input/textarea and fire all necessary events.
   * Handles React synthetic events via native input value setter.
   */
  setValue(element, value) {
    if (!element || value === null || value === undefined) return false;

    const tag = element.tagName.toLowerCase();
    const type = (element.type || '').toLowerCase();

    // Focus first
    element.focus();
    this.dispatch(element, 'focus');
    this.dispatch(element, 'focusin', { bubbles: true });

    if (tag === 'select') {
      return this.setSelectValue(element, value);
    }

    if (tag === 'input' && (type === 'checkbox' || type === 'radio')) {
      return this.setCheckboxValue(element, value);
    }

    if (element.isContentEditable) {
      return this.setContentEditableValue(element, value);
    }

    // Standard input/textarea
    // Use React-compatible setter
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      tag === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(element, value);
    } else {
      element.value = value;
    }

    // Fire events in realistic order
    this.dispatch(element, 'input', { bubbles: true, inputType: 'insertText' });
    this.dispatch(element, 'change', { bubbles: true });
    this.dispatch(element, 'blur');
    this.dispatch(element, 'focusout', { bubbles: true });

    return true;
  },

  /**
   * Set a select element's value.
   */
  setSelectValue(select, value) {
    const normalizedValue = (value || '').toLowerCase().trim();
    let matched = false;

    // Try exact value match
    for (const opt of select.options) {
      if (opt.value.toLowerCase() === normalizedValue || opt.textContent.toLowerCase().trim() === normalizedValue) {
        select.value = opt.value;
        matched = true;
        break;
      }
    }

    // Try fuzzy match on option text
    if (!matched) {
      for (const opt of select.options) {
        const optText = opt.textContent.toLowerCase().trim();
        if (optText.includes(normalizedValue) || normalizedValue.includes(optText)) {
          select.value = opt.value;
          matched = true;
          break;
        }
      }
    }

    if (matched) {
      this.dispatch(select, 'input', { bubbles: true });
      this.dispatch(select, 'change', { bubbles: true });
    }

    return matched;
  },

  /**
   * Set checkbox or radio.
   */
  setCheckboxValue(element, value) {
    const boolVal = typeof value === 'boolean' ? value :
      ['true', 'yes', '1', 'on'].includes(String(value).toLowerCase());
    
    if (element.checked !== boolVal) {
      element.checked = boolVal;
      this.dispatch(element, 'click');
      this.dispatch(element, 'input', { bubbles: true });
      this.dispatch(element, 'change', { bubbles: true });
    }
    return true;
  },

  /**
   * Set contentEditable element.
   */
  setContentEditableValue(element, value) {
    element.innerText = value;
    this.dispatch(element, 'input', { bubbles: true, inputType: 'insertText' });
    this.dispatch(element, 'change', { bubbles: true });
    this.dispatch(element, 'blur');
    return true;
  },

  /**
   * Dispatch a DOM event.
   */
  dispatch(element, eventName, options = {}) {
    const defaults = { bubbles: true, cancelable: true, ...options };
    let event;

    if (['input'].includes(eventName)) {
      event = new InputEvent(eventName, defaults);
    } else if (['focus', 'blur', 'focusin', 'focusout'].includes(eventName)) {
      event = new FocusEvent(eventName, defaults);
    } else if (['click', 'mousedown', 'mouseup'].includes(eventName)) {
      event = new MouseEvent(eventName, defaults);
    } else if (['keydown', 'keyup', 'keypress'].includes(eventName)) {
      event = new KeyboardEvent(eventName, defaults);
    } else {
      event = new Event(eventName, defaults);
    }

    element.dispatchEvent(event);
  }
};
