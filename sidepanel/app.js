// =============================================
// Job Auto-Filler — Side Panel Application Logic
// =============================================

(function () {
  'use strict';

  // ---- State ----
  let currentTab = 'upload';
  let uploadedFile = null;
  let extractedText = '';
  let profile = {};
  let savedFields = [];
  let isProcessing = false;

  // ---- DOM refs ----
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // Tabs
  const tabs = $$('.tab');
  const tabContents = $$('.tab-content');

  // Upload
  const uploadZone = $('#uploadZone');
  const fileInput = $('#fileInput');
  const fileInfo = $('#fileInfo');
  const fileName = $('#fileName');
  const fileSize = $('#fileSize');
  const btnRemoveFile = $('#btnRemoveFile');
  const btnExtract = $('#btnExtract');

  // Processing
  const processingCard = $('#processingCard');
  const progressBar = $('#progressBar');
  const processingPercent = $('#processingPercent');
  const processingStatus = $('#processingStatus');

  // AI Settings
  const apiKeyInput = $('#apiKey');
  const btnToggleKey = $('#btnToggleKey');
  const btnSaveKey = $('#btnSaveKey');
  const customEndpointInput = $('#customEndpoint');
  const settingsModelInput = $('#settingsModelName');

  // Profile
  const profileName = $('#profileName');
  const profileEmail = $('#profileEmail');
  const profilePhone = $('#profilePhone');
  const profileLinkedin = $('#profileLinkedin');
  const profileSummary = $('#profileSummary');
  const profileCurrentSalary = $('#profileCurrentSalary');
  const profileExpectedSalary = $('#profileExpectedSalary');
  const profileNoticePeriod = $('#profileNoticePeriod');
  const profileAvailableDate = $('#profileAvailableDate');
  const profileCoverLetter = $('#profileCoverLetter');
  const profileGender = $('#profileGender');
  const profileRace = $('#profileRace');
  const profileOrientation = $('#profileOrientation');
  const profileDisability = $('#profileDisability');
  const profileVeteran = $('#profileVeteran');
  const experienceList = $('#experienceList');
  const educationList = $('#educationList');
  const skillsTags = $('#skillsTags');
  const skillInput = $('#skillInput');
  const btnAddSkill = $('#btnAddSkill');
  const btnAddExp = $('#btnAddExp');
  const btnAddEdu = $('#btnAddEdu');
  const btnSaveProfile = $('#btnSaveProfile');
  const btnResetProfile = $('#btnResetProfile');

  // Saved Fields
  const savedFieldsList = $('#savedFieldsList');
  const newFieldLabel = $('#newFieldLabel');
  const newFieldValue = $('#newFieldValue');
  const newFieldAliases = $('#newFieldAliases');
  const newFieldGroup = $('#newFieldGroup');
  const btnSaveNewField = $('#btnSaveNewField');
  const btnAddSavedField = $('#btnAddSavedField');
  const btnExportFields = $('#btnExportFields');
  const btnImportFields = $('#btnImportFields');
  const importFieldsInput = $('#importFieldsInput');

  // Settings
  const btnExportProfile = $('#btnExportProfile');
  const btnClearAll = $('#btnClearAll');

  // Footer
  const btnAutoFill = $('#btnAutoFill');
  const statusBadge = $('#statusBadge');

  // Theme
  const btnThemeToggle = $('#btnThemeToggle');

  // ============================================
  // INIT
  // ============================================
  async function init() {
    await loadStoredData();
    bindEvents();
    renderProfile();
    renderSavedFields();
    renderSkills();
  }

  async function loadStoredData() {
    const data = await chrome.storage.local.get(['profile', 'savedFields', 'apiKey', 'customEndpoint', 'theme', 'settingsModel']);
    if (data.profile) profile = data.profile;
    if (data.savedFields) savedFields = data.savedFields;
    if (data.apiKey) apiKeyInput.value = data.apiKey;
    if (data.customEndpoint) customEndpointInput.value = data.customEndpoint;
    if (data.settingsModel && settingsModelInput) settingsModelInput.value = data.settingsModel;
    if (data.theme === 'dark') document.documentElement.classList.add('dark');
  }

  // ============================================
  // EVENT BINDINGS
  // ============================================
  function bindEvents() {
    // Tab switching
    tabs.forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));

    // Theme toggle
    btnThemeToggle.addEventListener('click', toggleTheme);

    // Auto-save endpoint and model when user types
    customEndpointInput.addEventListener('change', () => {
      chrome.storage.local.set({ customEndpoint: customEndpointInput.value.trim() });
    });
    settingsModelInput.addEventListener('change', () => {
      chrome.storage.local.set({ settingsModel: settingsModelInput.value.trim() });
    });

    // API key toggle visibility
    btnToggleKey.addEventListener('click', () => {
      const isPassword = apiKeyInput.type === 'password';
      apiKeyInput.type = isPassword ? 'text' : 'password';
      btnToggleKey.querySelector('.material-symbols-outlined').textContent = isPassword ? 'visibility_off' : 'visibility';
    });

    // Save API key
    btnSaveKey.addEventListener('click', saveApiKey);

    // File upload
    uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
    uploadZone.addEventListener('drop', handleFileDrop);
    fileInput.addEventListener('change', handleFileSelect);
    btnRemoveFile.addEventListener('click', removeFile);

    // Extract
    btnExtract.addEventListener('click', extractResume);

    // Profile
    btnSaveProfile.addEventListener('click', saveProfile);
    btnResetProfile.addEventListener('click', resetProfile);
    btnAddExp.addEventListener('click', () => addExperienceItem());
    btnAddEdu.addEventListener('click', () => addEducationItem());
    btnAddSkill.addEventListener('click', addSkill);
    skillInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addSkill(); });

    // Saved Fields
    btnSaveNewField.addEventListener('click', saveNewField);
    btnExportFields.addEventListener('click', exportFields);
    btnImportFields.addEventListener('click', () => importFieldsInput.click());
    importFieldsInput.addEventListener('change', importFields);

    // Settings
    btnExportProfile.addEventListener('click', exportAllData);
    btnClearAll.addEventListener('click', clearAllData);

    // Auto-Fill
    btnAutoFill.addEventListener('click', triggerAutoFill);

    // Listen for fill progress from background
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'ui:fillProgress') {
        updateFillProgress(msg);
      }
    });
  }

  // ============================================
  // TAB SWITCHING
  // ============================================
  function switchTab(tabName) {
    currentTab = tabName;
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    tabContents.forEach(tc => tc.classList.toggle('active', tc.id === `tab-${tabName}`));
  }

  // ============================================
  // THEME
  // ============================================
  function toggleTheme() {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    chrome.storage.local.set({ theme: isDark ? 'dark' : 'light' });
  }

  // ============================================
  // API KEY
  // ============================================
  async function saveApiKey() {
    const key = apiKeyInput.value.trim();
    if (!key) return showToast('Please enter an API key', 'error');

    await chrome.storage.local.set({
      apiKey: key,
      customEndpoint: customEndpointInput.value.trim(),
      settingsModel: (settingsModelInput?.value || '').trim()
    });
    showToast('Settings saved!', 'success');
  }

  // ============================================
  // FILE HANDLING
  // ============================================
  function handleFileDrop(e) {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) processFile(file);
  }

  function processFile(file) {
    // Validate type
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!validTypes.includes(file.type) && !['pdf', 'docx'].includes(ext)) {
      return showToast('Only PDF and DOCX files are supported', 'error');
    }
    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return showToast('File must be under 5MB', 'error');
    }

    uploadedFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    uploadZone.style.display = 'none';
    fileInfo.style.display = 'flex';
    btnExtract.disabled = false;
  }

  function removeFile() {
    uploadedFile = null;
    extractedText = '';
    fileInput.value = '';
    uploadZone.style.display = '';
    fileInfo.style.display = 'none';
    btnExtract.disabled = true;
    processingCard.style.display = 'none';
  }

  // ============================================
  // RESUME EXTRACTION
  // ============================================
  async function extractResume() {
    if (!uploadedFile || isProcessing) return;

    const key = apiKeyInput.value.trim();
    const endpoint = customEndpointInput.value.trim();
    if (!key) {
      showToast('Please set your API key first', 'error');
      return;
    }
    if (!endpoint) {
      showToast('Please enter an API endpoint URL', 'error');
      return;
    }

    // Save endpoint before extraction
    await chrome.storage.local.set({ customEndpoint: endpoint });

    isProcessing = true;
    setStatus('processing', 'Processing');
    btnExtract.disabled = true;
    processingCard.style.display = '';
    updateProgress(10, 'Extracting text from resume...');

    try {
      // Step 1: Extract text from file
      const ext = uploadedFile.name.split('.').pop().toLowerCase();
      if (ext === 'pdf') {
        extractedText = await PdfParser.extractText(uploadedFile);
      } else if (ext === 'docx') {
        extractedText = await extractDocxText(uploadedFile);
      }

      if (!extractedText || extractedText.trim().length < 20) {
        throw new Error('Could not extract meaningful text from the file. Please try a different file.');
      }

      updateProgress(40, 'Sending to AI for analysis...');

      // Step 2: Send to LLM
      const customModel = (settingsModelInput?.value || '').trim();
      const result = await chrome.runtime.sendMessage({
        type: 'llm:extract',
        text: extractedText,
        endpoint: endpoint,
        apiKey: key,
        model: customModel
      });

      if (!result) throw new Error('No response from background worker. Try reloading the extension.');
      if (result.error) throw new Error(result.error);
      if (!result.data) throw new Error('AI returned an empty response. Please try again.');

      updateProgress(80, 'Building profile...');

      // Step 3: Store profile
      profile = result.data;
      await chrome.storage.local.set({ profile });

      updateProgress(100, 'Done!');
      setStatus('done', 'Done');
      showToast(`Extracted ${countDataPoints(profile)} data points!`, 'success');

      // Render profile and switch tab
      renderProfile();
      renderSkills();
      setTimeout(() => switchTab('profile'), 500);

    } catch (err) {
      console.error('Extraction error:', err);
      setStatus('error', 'Error');
      showToast(err.message || 'Extraction failed', 'error');
    } finally {
      isProcessing = false;
      btnExtract.disabled = false;
    }
  }

  async function extractDocxText(file) {
    // Simple DOCX extractor — reads the document.xml inside the ZIP
    const arrayBuffer = await file.arrayBuffer();
    try {
      // Try using JSZip-like approach with the built-in DecompressionStream
      const blob = new Blob([arrayBuffer]);
      const entries = await readZipEntries(blob);
      const docXml = entries['word/document.xml'];
      if (!docXml) throw new Error('Invalid DOCX');
      // Strip XML tags to get text
      const text = docXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return text;
    } catch {
      // Fallback: just read as text (won't work well but better than nothing)
      return new TextDecoder().decode(arrayBuffer);
    }
  }

  // Minimal ZIP reader for DOCX
  async function readZipEntries(blob) {
    const buffer = await blob.arrayBuffer();
    const view = new DataView(buffer);
    const entries = {};

    let offset = 0;
    while (offset < buffer.byteLength - 4) {
      const sig = view.getUint32(offset, true);
      if (sig !== 0x04034b50) break; // Local file header signature

      const compMethod = view.getUint16(offset + 8, true);
      const compSize = view.getUint32(offset + 18, true);
      const uncompSize = view.getUint32(offset + 22, true);
      const nameLen = view.getUint16(offset + 26, true);
      const extraLen = view.getUint16(offset + 28, true);
      const name = new TextDecoder().decode(new Uint8Array(buffer, offset + 30, nameLen));

      const dataStart = offset + 30 + nameLen + extraLen;
      const rawData = buffer.slice(dataStart, dataStart + compSize);

      if (name.endsWith('.xml') || name.endsWith('.rels')) {
        if (compMethod === 0) {
          entries[name] = new TextDecoder().decode(rawData);
        } else if (compMethod === 8) {
          try {
            const ds = new DecompressionStream('deflate-raw');
            const writer = ds.writable.getWriter();
            writer.write(new Uint8Array(rawData));
            writer.close();
            const reader = ds.readable.getReader();
            const chunks = [];
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              chunks.push(value);
            }
            const totalLen = chunks.reduce((a, c) => a + c.length, 0);
            const result = new Uint8Array(totalLen);
            let pos = 0;
            for (const chunk of chunks) {
              result.set(chunk, pos);
              pos += chunk.length;
            }
            entries[name] = new TextDecoder().decode(result);
          } catch { /* skip */ }
        }
      }

      offset = dataStart + compSize;
    }
    return entries;
  }

  // ============================================
  // PROFILE RENDERING
  // ============================================
  function renderProfile() {
    profileName.value = profile.name || '';
    profileEmail.value = profile.email || '';
    profilePhone.value = profile.phone || '';
    profileLinkedin.value = profile.linkedin || '';
    profileSummary.value = profile.summary || '';
    profileCurrentSalary.value = profile.currentSalary || '';
    profileExpectedSalary.value = profile.expectedSalary || '';
    profileNoticePeriod.value = profile.noticePeriod || '';
    profileAvailableDate.value = profile.availableDate || '';
    profileCoverLetter.value = profile.coverLetter || '';
    profileGender.value = profile.gender || '';
    profileRace.value = profile.race || '';
    profileOrientation.value = profile.orientation || '';
    profileDisability.value = profile.disability || '';
    profileVeteran.value = profile.veteran || '';

    // Experience
    experienceList.innerHTML = '';
    (profile.experience || []).forEach((exp, i) => {
      experienceList.appendChild(createItemCard(
        exp.title || 'Untitled',
        `${exp.company || ''} • ${exp.start || ''} – ${exp.end || 'Present'}`,
        exp.description || '',
        'experience', i
      ));
    });

    // Education
    educationList.innerHTML = '';
    (profile.education || []).forEach((edu, i) => {
      educationList.appendChild(createItemCard(
        edu.degree || 'Degree',
        `${edu.school || ''} • ${edu.start || ''} – ${edu.end || ''}`,
        edu.field || '',
        'education', i
      ));
    });
  }

  function createItemCard(title, subtitle, desc, type, index) {
    const div = document.createElement('div');
    div.className = 'item-card';
    div.innerHTML = `
      <div class="item-card-top">
        <div>
          <div class="item-title">${escapeHtml(title)}</div>
          <div class="item-subtitle">${escapeHtml(subtitle)}</div>
        </div>
        <div class="item-actions">
          <button data-action="edit" data-type="${type}" data-index="${index}" title="Edit">
            <span class="material-symbols-outlined">edit</span>
          </button>
          <button data-action="delete" data-type="${type}" data-index="${index}" title="Delete">
            <span class="material-symbols-outlined">delete</span>
          </button>
        </div>
      </div>
      ${desc ? `<div class="item-desc">${escapeHtml(desc)}</div>` : ''}
    `;
    // Bind actions
    div.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index);
      if (type === 'experience') profile.experience.splice(idx, 1);
      else profile.education.splice(idx, 1);
      renderProfile();
    });
    div.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index);
      editItem(type, idx);
    });
    return div;
  }

  function editItem(type, index) {
    const item = type === 'experience' ? profile.experience[index] : profile.education[index];
    if (!item) return;

    const overlay = document.createElement('div');
    overlay.className = 'edit-overlay';

    let fieldsHtml = '';
    if (type === 'experience') {
      fieldsHtml = `
        <div class="form-group"><label>Title</label><input type="text" id="editTitle" value="${escapeAttr(item.title || '')}" /></div>
        <div class="form-group"><label>Company</label><input type="text" id="editCompany" value="${escapeAttr(item.company || '')}" /></div>
        <div class="form-group"><label>Start</label><input type="text" id="editStart" value="${escapeAttr(item.start || '')}" /></div>
        <div class="form-group"><label>End</label><input type="text" id="editEnd" value="${escapeAttr(item.end || '')}" /></div>
        <div class="form-group"><label>Description</label><textarea id="editDesc" rows="3">${escapeHtml(item.description || '')}</textarea></div>
      `;
    } else {
      fieldsHtml = `
        <div class="form-group"><label>Degree</label><input type="text" id="editDegree" value="${escapeAttr(item.degree || '')}" /></div>
        <div class="form-group"><label>School</label><input type="text" id="editSchool" value="${escapeAttr(item.school || '')}" /></div>
        <div class="form-group"><label>Field</label><input type="text" id="editField" value="${escapeAttr(item.field || '')}" /></div>
        <div class="form-group"><label>Start</label><input type="text" id="editStart" value="${escapeAttr(item.start || '')}" /></div>
        <div class="form-group"><label>End</label><input type="text" id="editEnd" value="${escapeAttr(item.end || '')}" /></div>
      `;
    }

    overlay.innerHTML = `
      <div class="edit-panel">
        <h3>Edit ${type === 'experience' ? 'Experience' : 'Education'}</h3>
        ${fieldsHtml}
        <div class="btn-row mt-2">
          <button id="editCancel" class="btn btn-outline flex-1">Cancel</button>
          <button id="editSave" class="btn btn-primary flex-1">Save</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#editCancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#editSave').addEventListener('click', () => {
      if (type === 'experience') {
        item.title = overlay.querySelector('#editTitle').value;
        item.company = overlay.querySelector('#editCompany').value;
        item.start = overlay.querySelector('#editStart').value;
        item.end = overlay.querySelector('#editEnd').value;
        item.description = overlay.querySelector('#editDesc').value;
      } else {
        item.degree = overlay.querySelector('#editDegree').value;
        item.school = overlay.querySelector('#editSchool').value;
        item.field = overlay.querySelector('#editField').value;
        item.start = overlay.querySelector('#editStart').value;
        item.end = overlay.querySelector('#editEnd').value;
      }
      overlay.remove();
      renderProfile();
    });
  }

  function addExperienceItem() {
    if (!profile.experience) profile.experience = [];
    profile.experience.push({ company: '', title: '', start: '', end: '', description: '' });
    renderProfile();
    editItem('experience', profile.experience.length - 1);
  }

  function addEducationItem() {
    if (!profile.education) profile.education = [];
    profile.education.push({ school: '', degree: '', field: '', start: '', end: '' });
    renderProfile();
    editItem('education', profile.education.length - 1);
  }

  // Skills
  function renderSkills() {
    skillsTags.innerHTML = '';
    (profile.skills || []).forEach((skill, i) => {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.innerHTML = `${escapeHtml(skill)}<span class="remove-tag material-symbols-outlined" data-index="${i}">close</span>`;
      tag.querySelector('.remove-tag').addEventListener('click', () => {
        profile.skills.splice(i, 1);
        renderSkills();
      });
      skillsTags.appendChild(tag);
    });
  }

  function addSkill() {
    const val = skillInput.value.trim();
    if (!val) return;
    if (!profile.skills) profile.skills = [];
    if (!profile.skills.includes(val)) {
      profile.skills.push(val);
      renderSkills();
    }
    skillInput.value = '';
  }

  // Save / Reset
  async function saveProfile() {
    profile.name = profileName.value;
    profile.email = profileEmail.value;
    profile.phone = profilePhone.value;
    profile.linkedin = profileLinkedin.value;
    profile.summary = profileSummary.value;
    profile.currentSalary = profileCurrentSalary.value;
    profile.expectedSalary = profileExpectedSalary.value;
    profile.noticePeriod = profileNoticePeriod.value;
    profile.availableDate = profileAvailableDate.value;
    profile.coverLetter = profileCoverLetter.value;
    profile.gender = profileGender.value;
    profile.race = profileRace.value;
    profile.orientation = profileOrientation.value;
    profile.disability = profileDisability.value;
    profile.veteran = profileVeteran.value;
    await chrome.storage.local.set({ profile });
    showToast('Profile saved!', 'success');
  }

  function resetProfile() {
    if (!confirm('Reset all profile data?')) return;
    profile = {};
    chrome.storage.local.remove('profile');
    renderProfile();
    renderSkills();
    showToast('Profile cleared', 'info');
  }

  // ============================================
  // SAVED FIELDS
  // ============================================
  function renderSavedFields() {
    savedFieldsList.innerHTML = '';
    if (savedFields.length === 0) {
      savedFieldsList.innerHTML = '<p style="font-size:11px;color:var(--text-muted);text-align:center;padding:16px;">No saved fields yet. Add your first one below!</p>';
      return;
    }
    savedFields.forEach((field, i) => {
      const div = document.createElement('div');
      div.className = 'saved-field-item';
      div.innerHTML = `
        <div class="saved-field-info">
          <div class="saved-field-label">${escapeHtml(field.label)}</div>
          <div class="saved-field-value">${escapeHtml(field.value)}</div>
          ${field.aliases && field.aliases.length ? `<div class="saved-field-aliases">Aliases: ${escapeHtml(field.aliases.join(', '))}</div>` : ''}
        </div>
        <span class="saved-field-group-badge">${escapeHtml(field.group || 'other')}</span>
        <div class="item-actions" style="margin-left:8px">
          <button data-action="edit-field" data-index="${i}" title="Edit">
            <span class="material-symbols-outlined">edit</span>
          </button>
          <button data-action="delete-field" data-index="${i}" title="Delete">
            <span class="material-symbols-outlined">delete</span>
          </button>
        </div>
      `;
      div.querySelector('[data-action="delete-field"]').addEventListener('click', () => {
        savedFields.splice(i, 1);
        chrome.storage.local.set({ savedFields });
        renderSavedFields();
      });
      div.querySelector('[data-action="edit-field"]').addEventListener('click', () => editSavedField(i));
      savedFieldsList.appendChild(div);
    });
  }

  function editSavedField(index) {
    const field = savedFields[index];
    newFieldLabel.value = field.label;
    newFieldValue.value = field.value;
    newFieldAliases.value = (field.aliases || []).join(', ');
    newFieldGroup.value = field.group || 'other';
    // Remove the old one, save will add it back
    savedFields.splice(index, 1);
    renderSavedFields();
    // Scroll to the add form
    newFieldLabel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    newFieldLabel.focus();
  }

  function saveNewField() {
    const label = newFieldLabel.value.trim();
    const value = newFieldValue.value.trim();
    if (!label || !value) {
      return showToast('Label and value are required', 'error');
    }
    const aliases = newFieldAliases.value.split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
    // Always include the label itself as an alias
    if (!aliases.includes(label.toLowerCase())) aliases.unshift(label.toLowerCase());

    savedFields.push({
      label,
      value,
      aliases,
      group: newFieldGroup.value
    });

    chrome.storage.local.set({ savedFields });
    renderSavedFields();

    // Clear form
    newFieldLabel.value = '';
    newFieldValue.value = '';
    newFieldAliases.value = '';
    showToast('Field saved!', 'success');
  }

  function exportFields() {
    const blob = new Blob([JSON.stringify(savedFields, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'saved-fields.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importFields(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (Array.isArray(imported)) {
          savedFields = [...savedFields, ...imported];
          chrome.storage.local.set({ savedFields });
          renderSavedFields();
          showToast(`Imported ${imported.length} fields`, 'success');
        }
      } catch {
        showToast('Invalid JSON file', 'error');
      }
    };
    reader.readAsText(file);
    importFieldsInput.value = '';
  }

  // ============================================
  // AUTO-FILL
  // ============================================
  async function triggerAutoFill() {
    // First save current profile
    await saveProfile();

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return showToast('No active tab found', 'error');

      setStatus('processing', 'Filling');

      await chrome.runtime.sendMessage({
        type: 'fill:start',
        tabId: tab.id
      });

      showToast('Auto-fill triggered!', 'info');
    } catch (err) {
      console.error('Fill error:', err);
      showToast('Could not fill — make sure you are on a job application page', 'error');
      setStatus('error', 'Error');
    }
  }

  function updateFillProgress(msg) {
    if (msg.percent !== undefined) {
      updateProgress(msg.percent, msg.status || 'Filling...');
      processingCard.style.display = '';
    }
    if (msg.percent >= 100) {
      setStatus('done', 'Done');
      setTimeout(() => {
        processingCard.style.display = 'none';
      }, 2000);
    }
  }

  // ============================================
  // SETTINGS
  // ============================================
  function exportAllData() {
    const data = { profile, savedFields };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'job-auto-filler-data.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearAllData() {
    if (!confirm('This will delete ALL your data including profile and saved fields. Continue?')) return;
    chrome.storage.local.clear();
    profile = {};
    savedFields = [];
    renderProfile();
    renderSkills();
    renderSavedFields();
    apiKeyInput.value = '';
    removeFile();
    showToast('All data cleared', 'info');
  }

  // ============================================
  // HELPERS
  // ============================================
  function setStatus(type, text) {
    statusBadge.className = `status-badge status-${type}`;
    statusBadge.querySelector('.status-text').textContent = text;
  }

  function updateProgress(percent, statusText) {
    progressBar.style.width = `${percent}%`;
    processingPercent.textContent = `${percent}%`;
    if (statusText) {
      processingStatus.innerHTML = `<span class="material-symbols-outlined spin">refresh</span> ${escapeHtml(statusText)}`;
    }
  }

  function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function countDataPoints(p) {
    let count = 0;
    if (p.name) count++;
    if (p.email) count++;
    if (p.phone) count++;
    if (p.linkedin) count++;
    if (p.summary) count++;
    count += (p.experience || []).length;
    count += (p.education || []).length;
    count += (p.skills || []).length;
    count += (p.certifications || []).length;
    count += (p.projects || []).length;
    return count;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ---- Start ----
  init();
})();
