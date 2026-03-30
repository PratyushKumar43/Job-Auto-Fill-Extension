// =============================================
// Alias Matcher Engine
// Fuzzy-matches form field labels to saved field aliases
// =============================================

const AliasMatcher = {

  /**
   * Find the best matching saved field for a given form field label.
   * @param {string} formLabel - The label/name/placeholder text from a form field
   * @param {Array} savedFields - Array of { label, value, aliases }
   * @returns {{ field: object, score: number } | null}
   */
  findMatch(formLabel, savedFields) {
    if (!formLabel || !savedFields || savedFields.length === 0) return null;

    const normalized = this.normalize(formLabel);
    if (!normalized) return null;

    let bestMatch = null;
    let bestScore = 0;

    for (const field of savedFields) {
      if (!field.value) continue; // Skip empty fields

      const aliases = field.aliases || [field.label.toLowerCase()];
      for (const alias of aliases) {
        const score = this.matchScore(normalized, this.normalize(alias));
        if (score > bestScore && score >= 0.6) {
          bestScore = score;
          bestMatch = { field, score };
        }
      }
    }

    return bestMatch;
  },

  /**
   * Compute match score between a form label and an alias.
   * Returns 0-1 (1 = perfect match).
   */
  matchScore(formLabel, alias) {
    if (!formLabel || !alias) return 0;

    // Exact match
    if (formLabel === alias) return 1.0;

    // Contains match
    if (formLabel.includes(alias) || alias.includes(formLabel)) return 0.9;

    // Word overlap
    const formWords = new Set(formLabel.split(/\s+/));
    const aliasWords = new Set(alias.split(/\s+/));
    const intersection = [...formWords].filter(w => aliasWords.has(w));
    const union = new Set([...formWords, ...aliasWords]);

    if (intersection.length === 0) return 0;

    // Jaccard similarity
    const jaccard = intersection.length / union.size;

    // Bonus if first word matches (often most important)
    const formFirst = formLabel.split(/\s+/)[0];
    const aliasFirst = alias.split(/\s+/)[0];
    const firstWordBonus = formFirst === aliasFirst ? 0.15 : 0;

    // Levenshtein for close misspellings
    const levScore = 1 - (this.levenshtein(formLabel, alias) / Math.max(formLabel.length, alias.length));
    const levBonus = levScore > 0.7 ? (levScore - 0.7) * 0.5 : 0;

    return Math.min(jaccard + firstWordBonus + levBonus, 1.0);
  },

  /**
   * Normalize a string for matching.
   */
  normalize(str) {
    return (str || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  /**
   * Levenshtein distance between two strings.
   */
  levenshtein(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = b[i - 1] === a[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[b.length][a.length];
  },

  /**
   * Match all form fields at once, returning a map of fieldElement → value.
   * Saved fields get priority; unmatched fields fall through to profile data.
   * @param {Array} formFields - Array of { element, label, name, placeholder, type }
   * @param {Array} savedFields - Array of { label, value, aliases, group }
   * @param {Object} profile - LLM-extracted profile data
   * @returns {Array} Array of { element, value, source: 'saved'|'profile'|'unmatched', fieldLabel }
   */
  matchAllFields(formFields, savedFields, profile) {
    const results = [];
    const profileMap = this._buildProfileMap(profile);

    for (const ff of formFields) {
      const labelText = ff.label || ff.name || ff.placeholder || '';
      
      // 1. Try saved fields first (no LLM needed)
      const savedMatch = this.findMatch(labelText, savedFields);
      if (savedMatch) {
        results.push({
          element: ff.element,
          value: savedMatch.field.value,
          source: 'saved',
          fieldLabel: labelText,
          matchedAlias: savedMatch.field.label,
          score: savedMatch.score
        });
        continue;
      }

      // 2. Try profile data
      const profileMatch = this.findMatch(labelText, profileMap);
      if (profileMatch) {
        results.push({
          element: ff.element,
          value: profileMatch.field.value,
          source: 'profile',
          fieldLabel: labelText,
          matchedAlias: profileMatch.field.label,
          score: profileMatch.score
        });
        continue;
      }

      // 3. Unmatched
      results.push({
        element: ff.element,
        value: null,
        source: 'unmatched',
        fieldLabel: labelText,
        score: 0
      });
    }

    return results;
  },

  /**
   * Convert profile object into saved-fields-like format for matching.
   */
  _buildProfileMap(profile) {
    if (!profile) return [];
    const map = [];

    const simple = {
      'Full Name': { keys: ['name'], aliases: ['full name', 'name', 'first name', 'your name', 'candidate name', 'applicant name'] },
      'Email': { keys: ['email'], aliases: ['email', 'email address', 'e-mail', 'email id', 'mail'] },
      'Phone': { keys: ['phone'], aliases: ['phone', 'phone number', 'mobile', 'mobile number', 'contact number', 'telephone', 'cell'] },
      'LinkedIn': { keys: ['linkedin'], aliases: ['linkedin', 'linkedin url', 'linkedin profile', 'linkedin link'] },
      'Summary': { keys: ['summary'], aliases: ['summary', 'professional summary', 'objective', 'about', 'bio', 'about me', 'cover letter', 'introduction'] },
    };

    for (const [label, config] of Object.entries(simple)) {
      const value = config.keys.map(k => profile[k]).find(v => v);
      if (value) {
        map.push({ label, value, aliases: config.aliases });
      }
    }

    // First name / Last name split
    if (profile.name) {
      const parts = profile.name.trim().split(/\s+/);
      if (parts.length >= 2) {
        map.push({ label: 'First Name', value: parts[0], aliases: ['first name', 'given name', 'forename'] });
        map.push({ label: 'Last Name', value: parts.slice(1).join(' '), aliases: ['last name', 'surname', 'family name'] });
      }
    }

    return map;
  }
};

if (typeof window !== 'undefined') window.AliasMatcher = AliasMatcher;
