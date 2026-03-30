// =============================================
// Auto-Filler Content Script
// Receives profile + saved fields from background,
// detects form fields, matches, and fills them.
// =============================================

(function () {
  'use strict';

  // Check if the extension context is still valid
  function isContextValid() {
    try { return !!chrome.runtime?.id; } catch { return false; }
  }

  // Listen for fill commands from the background / side panel
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'content:fill') {
      fillPage(msg.profile, msg.savedFields).then(result => {
        sendResponse(result);
      }).catch(err => {
        sendResponse({ success: false, error: err.message });
      });
      return true; // async
    }

    if (msg.type === 'content:detectFields') {
      const fields = detectAllFields();
      sendResponse({
        fields: fields.map(f => ({
          label: f.label,
          name: f.name,
          type: f.type,
          placeholder: f.placeholder
        })),
        board: FieldDetector.detectBoard()
      });
      return true;
    }
  });

  /**
   * Main fill function.
   */
  async function fillPage(profile, savedFields) {
    const board = FieldDetector.detectBoard();
    reportProgress(0, `Detected board: ${board}`);

    // Step 1: Detect all fields
    const fields = detectAllFields();
    reportProgress(10, `Found ${fields.length} form fields`);

    if (fields.length === 0) {
      reportProgress(100, 'No fillable fields found');
      return { success: false, filled: 0, total: 0, board };
    }

    // Step 2: Match fields using alias matcher
    // Priority: Saved fields → Profile data
    let filled = 0;
    const total = fields.length;

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      const percent = 10 + Math.round((i / total) * 85);

      // Handle Google Forms radio buttons specially
      if (field.type === 'google-forms-radio') {
        const matched = matchGoogleFormsRadio(field, savedFields, profile);
        if (matched) filled++;
        reportProgress(percent, `Processing: ${field.label || 'field ' + (i + 1)}`);
        continue;
      }

      // Try saved fields first
      let value = matchSavedField(field.label || field.name || field.placeholder, savedFields);

      // Try profile data if no saved field match
      if (!value && profile) {
        value = matchProfileField(field.label || field.name || field.placeholder, profile);
      }

      if (value) {
        // Add small delay for realism
        await delay(50 + Math.random() * 100);
        const success = EventSim.setValue(field.element, value);
        if (success) filled++;
        reportProgress(percent, `Filled: ${field.label || field.name || 'field ' + (i + 1)}`);
      } else {
        reportProgress(percent, `Skipped: ${field.label || field.name || 'field ' + (i + 1)}`);
      }
    }

    reportProgress(100, `Done! Filled ${filled}/${total} fields`);

    return {
      success: true,
      filled,
      total,
      board
    };
  }

  /**
   * Detect fields using both generic and board-specific detectors.
   */
  function detectAllFields() {
    const board = FieldDetector.detectBoard();

    // Try board-specific first
    let fields = FieldDetector.detectBoardSpecificFields(board);

    // Merge with generic detection (avoid duplicates)
    const genericFields = FieldDetector.detectFields();
    const seen = new Set(fields.map(f => f.element));

    for (const f of genericFields) {
      if (!seen.has(f.element)) {
        fields.push(f);
        seen.add(f.element);
      }
    }

    return fields;
  }

  /**
   * Match a form label against saved fields.
   */
  function matchSavedField(label, savedFields) {
    if (!label || !savedFields || savedFields.length === 0) return null;

    const normalized = normalize(label);

    for (const field of savedFields) {
      if (!field.value) continue;

      const aliases = field.aliases || [field.label.toLowerCase()];
      for (const alias of aliases) {
        const normAlias = normalize(alias);
        // Exact or contains match
        if (normalized === normAlias) return field.value;
        if (normalized.includes(normAlias) || normAlias.includes(normalized)) return field.value;

        // Word overlap check
        const labelWords = new Set(normalized.split(/\s+/));
        const aliasWords = normAlias.split(/\s+/);
        const overlap = aliasWords.filter(w => labelWords.has(w)).length;
        if (overlap > 0 && overlap >= aliasWords.length * 0.6) return field.value;
      }
    }

    return null;
  }

  /**
   * Match a form label against profile data.
   */
  function matchProfileField(label, profile) {
    if (!label || !profile) return null;

    const normalized = normalize(label);

    // Direct profile field mappings
    const mappings = {
      'name|full name|your name|candidate name|applicant name': profile.name,
      'first name|given name|forename': profile.name ? profile.name.split(/\s+/)[0] : null,
      'last name|surname|family name': profile.name ? profile.name.split(/\s+/).slice(1).join(' ') : null,
      'email|email address|e-mail|mail|email id': profile.email,
      'phone|phone number|mobile|mobile number|cell|telephone|contact number|contact': profile.phone,
      'linkedin|linkedin url|linkedin profile': profile.linkedin,
      'summary|professional summary|cover letter|about|objective|about me|introduction|bio': profile.summary,
      'current title|current role|current position|job title|designation|title': profile.experience?.[0]?.title,
      'current company|current employer|company|organization|employer': profile.experience?.[0]?.company,
      'current location|location|city|current city': profile.city || profile.location || '',
      'github|github url|github profile|github link': profile.github || '',
      'website|portfolio|personal website|portfolio url|blog|personal url': profile.website || profile.portfolio || '',
      'current salary|current ctc|current compensation|ctc|annual salary|present salary': profile.currentSalary || '',
      'expected salary|expected ctc|expected compensation|desired salary|desired ctc|salary expectation': profile.expectedSalary || '',
      'notice period|notice|serving notice': profile.noticePeriod || '',
      'earliest available|available date|availability|start date|earliest start|earliest joining|joining date|date of joining': profile.availableDate || '',
      'cover letter|covering letter': profile.coverLetter || '',
      'gender|gender identity|sex': profile.gender || '',
      'race|ethnicity|race ethnicity|race or ethnicity': profile.race || '',
      'sexual orientation|orientation': profile.orientation || '',
      'disability|disability status|do you have a disability': profile.disability || '',
      'veteran|veteran status|are you a veteran|protected veteran': profile.veteran || '',
      'school|university name|college name|institution': profile.education?.[0]?.school,
      'degree|qualification': profile.education?.[0]?.degree,
      'field of study|major|specialization': profile.education?.[0]?.field,
    };

    for (const [patterns, value] of Object.entries(mappings)) {
      if (!value) continue;
      const patternList = patterns.split('|');
      for (const pattern of patternList) {
        if (normalized === pattern || normalized.includes(pattern) || pattern.includes(normalized)) {
          return value;
        }
      }
    }

    // Skills as comma-separated
    if (normalized.includes('skill') && profile.skills && profile.skills.length) {
      return profile.skills.join(', ');
    }

    return null;
  }

  /**
   * Handle Google Forms radio/checkbox selection.
   */
  function matchGoogleFormsRadio(field, savedFields, profile) {
    if (!field.options || field.options.length === 0) return false;

    // Try to find the value from saved fields or profile
    let targetValue = matchSavedField(field.label, savedFields);
    if (!targetValue) targetValue = matchProfileField(field.label, profile);
    if (!targetValue) return false;

    const normalizedTarget = normalize(targetValue);

    for (const opt of field.options) {
      const optText = normalize(opt.text);
      if (optText === normalizedTarget || optText.includes(normalizedTarget) || normalizedTarget.includes(optText)) {
        opt.element.click();
        return true;
      }
    }

    return false;
  }

  /**
   * Report fill progress back to the side panel.
   */
  function reportProgress(percent, status) {
    chrome.runtime.sendMessage({
      type: 'fill:progress',
      percent,
      status
    }).catch(() => {}); // Ignore if side panel is closed
  }

  /**
   * Normalize string for matching.
   */
  function normalize(str) {
    return (str || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Async delay.
   */
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

})();
