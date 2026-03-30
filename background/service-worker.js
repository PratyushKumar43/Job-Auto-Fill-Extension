// Background Service Worker — Job Auto-Filler
// Handles: side panel toggling, message routing, LLM API calls

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// ---------- Message router ----------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handlers = {
    'llm:extract': handleLLMExtract,
    'llm:fieldFill': handleFieldFill,
    'fill:start': handleFillStart,
    'fill:progress': handleFillProgress,
    'storage:get': handleStorageGet,
    'storage:set': handleStorageSet,
  };

  const handler = handlers[msg.type];
  if (handler) {
    handler(msg, sender).then(sendResponse).catch(err => sendResponse({ error: err.message }));
    return true; // async
  }
});

// ---------- LLM Extraction ----------
async function handleLLMExtract({ text, apiKey, model, endpoint }) {
  const systemPrompt = `You are a resume parser. Extract structured data from the resume text below.
The text preserves the original layout: sections are separated by blank lines, columns by " | ", and bullets by "•".
Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{
  "name": "string",
  "email": "string",
  "phone": "string",
  "linkedin": "string",
  "summary": "string",
  "experience": [{"company":"string","title":"string","start":"string","end":"string","description":"string"}],
  "education": [{"school":"string","degree":"string","field":"string","start":"string","end":"string"}],
  "skills": ["string"],
  "certifications": ["string"],
  "projects": [{"title":"string","description":"string","url":"string"}]
}
If a field is not found, use an empty string or empty array. Do not invent data.`;

  if (!endpoint) throw new Error('API endpoint not configured. Open the side panel and set your endpoint URL.');
  if (!apiKey) throw new Error('API key not set. Open the side panel and add your key.');

  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const raw = await callEndpoint(endpoint, apiKey, model || 'default', systemPrompt, text);
      // Extract JSON from response (handle markdown-wrapped JSON)
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, raw];
      const cleaned = jsonMatch[1].trim();
      const parsed = JSON.parse(cleaned);
      return { success: true, data: parsed };
    } catch (err) {
      lastError = err;
      // Don't retry on client errors (bad API key, invalid model, etc.)
      const msg = err.message || '';
      if (/4[0-9]{2}:/.test(msg) || msg.includes('not found')) break;
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  throw lastError;
}

// ---------- Single endpoint implementation ----------
async function callEndpoint(endpoint, apiKey, model, systemPrompt, userText) {
  // Auto-append /chat/completions if the endpoint doesn't already include it
  let url = endpoint.replace(/\/+$/, '');
  if (!url.endsWith('/chat/completions')) {
    url += '/chat/completions';
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: model || 'default',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText.substring(0, 30000) }
      ],
      temperature: 0.1
    })
  });
  if (!res.ok) {
    const errBody = await res.text();
    if (res.status === 404) {
      throw new Error(`Model "${model}" not found or endpoint unavailable. Check your settings.`);
    }
    throw new Error(`API ${res.status}: ${errBody}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content || JSON.stringify(json);
}

// ---------- Single-field AI fill ----------
async function handleFieldFill({ fieldLabel, currentValue }) {
  const { apiKey, customEndpoint, profile, settingsModel } = await chrome.storage.local.get([
    'apiKey', 'customEndpoint', 'profile', 'settingsModel'
  ]);

  if (!customEndpoint) throw new Error('API endpoint not configured — open the Auto-Filler side panel and set your endpoint URL.');
  if (!apiKey) throw new Error('API key not set — open the Auto-Filler side panel and add your key.');
  if (!profile || !profile.name) throw new Error('No profile found — upload a resume first.');

  // Build concise profile context
  const profileSnippet = [
    `Name: ${profile.name || ''}`,
    `Email: ${profile.email || ''}`,
    `Phone: ${profile.phone || ''}`,
    profile.linkedin ? `LinkedIn: ${profile.linkedin}` : '',
    profile.summary ? `Summary: ${profile.summary}` : '',
    profile.skills?.length ? `Skills: ${profile.skills.join(', ')}` : '',
    profile.experience?.length ? `Experience: ${profile.experience.map(e => `${e.title} at ${e.company} (${e.start}–${e.end}): ${e.description}`).join(' | ')}` : '',
    profile.education?.length ? `Education: ${profile.education.map(e => `${e.degree} ${e.field} from ${e.school} (${e.start}–${e.end})`).join(' | ')}` : '',
    profile.projects?.length ? `Projects: ${profile.projects.map(p => `${p.title}: ${p.description}`).join(' | ')}` : '',
  ].filter(Boolean).join('\n');

  const systemPrompt =
`You are a job application assistant. Given the candidate's profile and a form field question/label, write a concise, professional, tailored answer for that specific question.
Rules:
- READ THE QUESTION CAREFULLY and answer exactly what is asked
- Be direct and concise (1-3 sentences for paragraph fields, single value for simple fields)
- For yes/no or choice questions, give the appropriate short answer
- Tailor the response using the candidate's real data from the profile
- Do NOT dump the entire resume or experience — only include what's relevant to the question
- Do NOT wrap in quotes or repeat the question
- Return ONLY the answer text, nothing else`;

  const userText = `CANDIDATE PROFILE:
${profileSnippet}

QUESTION: "${fieldLabel}"
${currentValue ? `CURRENT VALUE: "${currentValue}"` : ''}

Answer this specific question concisely:`;

  const raw = await callEndpoint(customEndpoint, apiKey, settingsModel || 'default', systemPrompt, userText);
  // Clean up — remove wrapping quotes if the LLM adds them
  const cleaned = raw.replace(/^["']|["']$/g, '').trim();
  return { text: cleaned };
}

// ---------- Fill orchestration ----------
async function handleFillStart({ tabId }) {
  // Inject content scripts programmatically so it works on ANY page
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/events.js', 'content/detector.js', 'content/filler.js', 'content/ai-fill-icons.js']
    });
  } catch (e) {
    // Scripts may already be injected (from manifest match), ignore
    console.warn('Script injection note:', e.message);
  }

  // Small delay to let scripts initialise
  await new Promise(r => setTimeout(r, 150));

  // Get profile + saved fields, send to content script
  const data = await chrome.storage.local.get(['profile', 'savedFields']);
  const result = await chrome.tabs.sendMessage(tabId, {
    type: 'content:fill',
    profile: data.profile || {},
    savedFields: data.savedFields || []
  });
  return result || { success: true };
}

async function handleFillProgress(msg) {
  // Relay progress from content script to side panel
  chrome.runtime.sendMessage({ type: 'ui:fillProgress', ...msg });
  return { success: true };
}

// ---------- Storage helpers ----------
async function handleStorageGet({ keys }) {
  return chrome.storage.local.get(keys);
}

async function handleStorageSet({ data }) {
  await chrome.storage.local.set(data);
  return { success: true };
}


