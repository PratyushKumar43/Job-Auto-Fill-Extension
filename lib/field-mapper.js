// =============================================
// Field Mapper — Maps form fields to profile data
// =============================================

const FieldMapper = {
  /**
   * Map profile data keys to common form field label patterns.
   * Returns the most likely profile value for a given label.
   */
  profileKeyMap: {
    // Name
    'name': ['name', 'full name', 'your name', 'candidate name', 'applicant name'],
    'firstName': ['first name', 'given name', 'forename'],
    'lastName': ['last name', 'surname', 'family name'],
    
    // Contact
    'email': ['email', 'email address', 'e-mail', 'mail', 'email id'],
    'phone': ['phone', 'phone number', 'mobile', 'mobile number', 'cell', 'telephone', 'contact number', 'contact'],
    
    // Links
    'linkedin': ['linkedin', 'linkedin url', 'linkedin profile'],
    'github': ['github', 'github url', 'github profile'],
    'website': ['website', 'portfolio', 'personal website', 'portfolio url', 'blog'],
    
    // Professional
    'summary': ['summary', 'professional summary', 'cover letter', 'about', 'objective', 'about me', 'introduction', 'bio'],
    'currentTitle': ['current title', 'current role', 'current position', 'job title', 'designation', 'title'],
    'currentCompany': ['current company', 'current employer', 'company', 'organization'],
    
    // Location
    'city': ['city', 'current city', 'location'],
    'state': ['state', 'province'],
    'country': ['country', 'nationality'],
    'address': ['address', 'street address', 'mailing address'],
    'zip': ['zip', 'zip code', 'postal code', 'pincode', 'pin code'],
  },

  /**
   * Extract the profile value for a given key, handling nested data.
   */
  getProfileValue(profile, key) {
    if (!profile) return null;

    // Direct key
    if (profile[key] !== undefined && profile[key] !== '') return profile[key];

    // Derived keys
    if (key === 'firstName' && profile.name) {
      return profile.name.trim().split(/\s+/)[0];
    }
    if (key === 'lastName' && profile.name) {
      const parts = profile.name.trim().split(/\s+/);
      return parts.length > 1 ? parts.slice(1).join(' ') : '';
    }
    if (key === 'currentTitle' && profile.experience && profile.experience[0]) {
      return profile.experience[0].title;
    }
    if (key === 'currentCompany' && profile.experience && profile.experience[0]) {
      return profile.experience[0].company;
    }

    return null;
  },

  /**
   * Given a form label, find the best matching profile key.
   */
  findProfileKey(label) {
    const normalized = label.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!normalized) return null;

    for (const [key, patterns] of Object.entries(this.profileKeyMap)) {
      for (const pattern of patterns) {
        if (normalized === pattern || normalized.includes(pattern) || pattern.includes(normalized)) {
          return key;
        }
      }
    }
    return null;
  },

  /**
   * Map a form field label to a profile value.
   */
  mapFieldToValue(label, profile) {
    const key = this.findProfileKey(label);
    if (!key) return null;
    return this.getProfileValue(profile, key);
  }
};

if (typeof window !== 'undefined') window.FieldMapper = FieldMapper;
if (typeof globalThis !== 'undefined') globalThis.FieldMapper = FieldMapper;
