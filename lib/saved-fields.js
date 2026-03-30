// =============================================
// Saved Fields Manager
// Manages quick-fill key-value pairs with aliases
// =============================================

const SavedFieldsManager = {
  // Default template fields users can fill in
  getTemplateFields() {
    return [
      {
        label: 'College / University',
        value: '',
        aliases: ['college', 'university', 'institute', 'institution', 'college name', 'university name', 'school', 'alma mater', 'institution name'],
        group: 'academic'
      },
      {
        label: 'Roll Number',
        value: '',
        aliases: ['roll number', 'roll no', 'student id', 'enrollment number', 'enrollment no', 'registration number', 'reg no', 'matric number', 'id number'],
        group: 'academic'
      },
      {
        label: 'Degree',
        value: '',
        aliases: ['degree', 'qualification', 'course', 'program', 'programme', 'major', 'branch', 'specialization', 'stream'],
        group: 'academic'
      },
      {
        label: 'Graduation Year',
        value: '',
        aliases: ['graduation year', 'year of passing', 'year of graduation', 'batch', 'passing year', 'expected graduation', 'completion year', 'end year'],
        group: 'academic'
      },
      {
        label: 'GPA / CGPA',
        value: '',
        aliases: ['gpa', 'cgpa', 'grade', 'percentage', 'marks', 'score', 'grade point', 'cumulative gpa', 'academic score', 'aggregate'],
        group: 'academic'
      },
      {
        label: 'Date of Birth',
        value: '',
        aliases: ['date of birth', 'dob', 'birth date', 'birthday', 'born on'],
        group: 'personal'
      },
      {
        label: 'Address',
        value: '',
        aliases: ['address', 'residential address', 'current address', 'mailing address', 'home address', 'street address', 'permanent address'],
        group: 'personal'
      },
      {
        label: 'City',
        value: '',
        aliases: ['city', 'current city', 'hometown', 'town', 'location city'],
        group: 'personal'
      },
      {
        label: 'State',
        value: '',
        aliases: ['state', 'province', 'region', 'territory'],
        group: 'personal'
      },
      {
        label: 'Country',
        value: '',
        aliases: ['country', 'nationality', 'nation', 'country of residence'],
        group: 'personal'
      },
      {
        label: 'Zip / Pin Code',
        value: '',
        aliases: ['zip code', 'zipcode', 'zip', 'pin code', 'pincode', 'postal code', 'postcode', 'pin'],
        group: 'personal'
      },
      {
        label: 'Gender',
        value: '',
        aliases: ['gender', 'sex'],
        group: 'personal'
      },
      {
        label: 'GitHub',
        value: '',
        aliases: ['github', 'github url', 'github profile', 'github link', 'github username'],
        group: 'professional'
      },
      {
        label: 'Portfolio / Website',
        value: '',
        aliases: ['portfolio', 'website', 'personal website', 'portfolio url', 'blog', 'personal site', 'homepage'],
        group: 'professional'
      },
      {
        label: 'Years of Experience',
        value: '',
        aliases: ['years of experience', 'experience years', 'total experience', 'work experience years', 'professional experience'],
        group: 'professional'
      },
      {
        label: 'Current Company',
        value: '',
        aliases: ['current company', 'current employer', 'current organization', 'present company', 'company name'],
        group: 'professional'
      },
      {
        label: 'Current Designation',
        value: '',
        aliases: ['current designation', 'current title', 'current role', 'current position', 'job title', 'designation'],
        group: 'professional'
      },
      {
        label: 'Notice Period',
        value: '',
        aliases: ['notice period', 'notice', 'availability', 'joining time', 'start date availability'],
        group: 'professional'
      },
      {
        label: 'Expected CTC / Salary',
        value: '',
        aliases: ['expected ctc', 'expected salary', 'salary expectation', 'expected compensation', 'desired salary', 'expected package'],
        group: 'professional'
      },
      {
        label: 'Current CTC / Salary',
        value: '',
        aliases: ['current ctc', 'current salary', 'current compensation', 'present salary', 'current package'],
        group: 'professional'
      }
    ];
  },

  // Merge template with saved (user) fields — fill template values from saved
  mergeWithTemplate(savedFields) {
    const template = this.getTemplateFields();
    const savedMap = new Map(savedFields.map(f => [f.label.toLowerCase(), f]));

    return template.map(t => {
      const saved = savedMap.get(t.label.toLowerCase());
      if (saved) {
        return { ...t, value: saved.value, aliases: [...new Set([...t.aliases, ...(saved.aliases || [])])] };
      }
      return t;
    }).concat(
      // Add any custom fields not in template
      savedFields.filter(f => !template.find(t => t.label.toLowerCase() === f.label.toLowerCase()))
    );
  }
};

if (typeof window !== 'undefined') window.SavedFieldsManager = SavedFieldsManager;
