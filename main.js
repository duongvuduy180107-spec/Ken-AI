document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const CONFIG = {
    defaultAIName: 'AI',
    groqApiKey: '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',
    translateScriptUrl: 'https://script.google.com/macros/s/AKfycbzAICigheXKYUsTbz40wBvBZoO7e1QwpnshdmXNKssfruroT7ATW6-kKr3fL-cDH7GG/exec',
    translatePageUrl: './Translate.html',
    dailyLimit: 50,
    storagePrefix: 'multi_chat_translate_groq_v8_',
    modelDefault: 'llama-3.3-70b-versatile',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions'
  };

  const DEFAULT_THREAD_SETTINGS = {
    mode: 'pure',
    aiName: CONFIG.defaultAIName,
    roleplayName: 'Miku',
    roleplayPersonality: '',
    roleplayUserName: '',
    roleplayRelation: 'cậu-tớ',
    roleplayAvatar: '',
    forceJP: false,
    autoTranslate: true,
    model: CONFIG.modelDefault,
    notebookPages: [],
    activeNotebookPageId: ''
  };

  const $ = (id) => document.getElementById(id);
  const on = (el, event, handler) => { if (el) el.addEventListener(event, handler); };
  const setText = (el, text) => { if (el) el.textContent = text; };

  const sidebar = $('sidebar');
  const mobileMenuBtn = $('mobileMenuBtn');
  const chatListEl = $('chatList');
  const activeChatTitleEl = $('activeChatTitle');
  const activeChatSubEl = $('activeChatSub');
  const modelEl = $('model');
  const messagesEl = $('messages');
  const messagesWrap = $('messagesWrap');
  const textInput = $('textInput');
  const sendBtn = $('sendBtn');
  const newChatBtn = $('newChatBtn');
  const deleteChatBtn = $('deleteChatBtn');
  const dailyInfo = $('dailyInfo');
  const toastEl = $('toast');
  const translatePageBtn = $('translatePageBtn');

  const settingsBtn = $('settingsBtn');
  const notebookBtn = $('notebookBtn');
  const settingsOverlay = $('settingsOverlay');
  const notebookOverlay = $('notebookOverlay');
  const settingsCloseBtn = $('settingsCloseBtn');
  const closeNotebookBtn = $('closeNotebookBtn');

  const aiNameInput = $('aiNameInput');
  const roleplayNameInput = $('roleplayNameInput');
  const roleplayPersonalityInput = $('roleplayPersonalityInput');
  const roleplayUserNameInput = $('roleplayUserNameInput');
  const roleplayRelationInput = $('roleplayRelationInput');
  const roleplayAvatarInput = $('roleplayAvatarInput');
  const clearAvatarBtn = $('clearAvatarBtn');

  const brandTitle = $('brandTitle');
  const brandSub = $('brandSub');
  const brandAvatarImg = $('brandAvatarImg');
  const brandAvatarText = $('brandAvatarText');
  const roleplayAvatarImg = $('roleplayAvatarImg');
  const roleplayAvatarText = $('roleplayAvatarText');

  const pureModeBtn = $('pureModeBtn');
  const roleplayModeBtn = $('roleplayModeBtn');
  const pureSettings = $('pureSettings');
  const roleplaySettings = $('roleplaySettings');

  const forceJpCheckbox = $('forceJP');
  const autoTranslateCheckbox = $('autoTranslate');

  const nbCountHint = $('nbCountHint');
  const nbPageList = $('nbPageList');
  const nbTitleInput = $('nbTitleInput');
  const nbContentInput = $('nbContentInput');
  const nbMetaHint = $('nbMetaHint');
  const nbPreviewBox = $('nbPreviewBox');
  const nbNewPageBtn = $('nbNewPageBtn');
  const nbFromChatBtn = $('nbFromChatBtn');
  const nbSaveBtn = $('nbSaveBtn');
  const nbDeleteBtn = $('nbDeleteBtn');
  const nbQuickAIBtn = $('nbQuickAIBtn');
  const notebookSettingsToggleBtn = $('notebookSettingsToggleBtn');
  const notebookSettingsPanel = $('notebookSettingsPanel');

  const STORAGE_THREADS = CONFIG.storagePrefix + 'threads';
  const STORAGE_ACTIVE = CONFIG.storagePrefix + 'active';
  const STORAGE_DAILY = CONFIG.storagePrefix + 'daily';
  const STORAGE_MODEL = CONFIG.storagePrefix + 'model';

  let threads = safeParse(localStorage.getItem(STORAGE_THREADS), []);
  let activeThreadId = localStorage.getItem(STORAGE_ACTIVE) || '';
  let dailyState = safeParse(localStorage.getItem(STORAGE_DAILY), {});
  let typingNode = null;
  let notebookSyncLock = false;

  if (translatePageBtn) translatePageBtn.href = CONFIG.translatePageUrl;

  initDaily();
  normalizeThreads();
  ensureActiveThread();
  initModel();
  applyThreadToUi(getActiveThread());
  updateDailyUi();
  renderAll();

  on(settingsBtn, 'click', () => openOverlay(settingsOverlay));
  on(settingsCloseBtn, 'click', () => closeOverlay(settingsOverlay));
  on(notebookBtn, 'click', () => {
    renderNotebook();
    openOverlay(notebookOverlay);
  });
  on(closeNotebookBtn, 'click', () => closeOverlay(notebookOverlay));
  on(notebookSettingsToggleBtn, 'click', () => {
    if (notebookSettingsPanel) notebookSettingsPanel.classList.toggle('open');
  });

  on(settingsOverlay, 'click', (e) => {
    if (e.target === settingsOverlay) closeOverlay(settingsOverlay);
  });
  on(notebookOverlay, 'click', (e) => {
    if (e.target === notebookOverlay) closeOverlay(notebookOverlay);
  });

  on(pureModeBtn, 'click', () => setMode('pure'));
  on(roleplayModeBtn, 'click', () => setMode('roleplay'));

  on(aiNameInput, 'input', commitSettingsChange);
  on(roleplayNameInput, 'input', commitSettingsChange);
  on(roleplayPersonalityInput, 'input', commitSettingsChange);
  on(roleplayUserNameInput, 'input', commitSettingsChange);
  on(roleplayRelationInput, 'change', commitSettingsChange);
  on(forceJpCheckbox, 'change', commitSettingsChange);
  on(autoTranslateCheckbox, 'change', commitSettingsChange);
  on(modelEl, 'change', commitSettingsChange);

  on(roleplayAvatarInput, 'change', () => {
    const file = roleplayAvatarInput?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const t = getActiveThread();
      if (!t) return;
      normalizeNotebook(t);
      t.settings.roleplayAvatar = String(reader.result || '');
      saveThreads();
      applyThreadToUi(t);
      renderAll();
      showToast('Đã cập nhật avatar');
    };
    reader.readAsDataURL(file);
  });

  on(clearAvatarBtn, 'click', () => {
    const t = getActiveThread();
    if (!t) return;
    normalizeNotebook(t);
    t.settings.roleplayAvatar = '';
    if (roleplayAvatarInput) roleplayAvatarInput.value = '';
    saveThreads();
    applyThreadToUi(t);
    renderAll();
    showToast('Đã xóa avatar');
  });

  on(newChatBtn, 'click', () => {
    const t = createThreadFromCurrentSettings();
    setActiveThread(t.id);
    showToast('Đã tạo chat mới');
  });

  on(deleteChatBtn, 'click', () => {
    const t = getActiveThread();
    if (!t) return;
    if (!confirm(`Xóa chat "${t.title}"?`)) return;
    deleteThread(t.id);
  });

  on(mobileMenuBtn, 'click', () => {
    if (sidebar) sidebar.classList.toggle('open');
  });

  on(textInput, 'keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  });
  on(sendBtn, 'click', onSend);

  on(nbNewPageBtn, 'click', () => {
    const t = getActiveThread();
    if (!t) return;
    normalizeNotebook(t);
    const page = createNotebookPage(t, `Trang ${t.settings.notebookPages.length + 1}`, '');
    t.settings.activeNotebookPageId = page.id;
    saveThreads();
    renderNotebook();
    showToast('Đã tạo trang mới');
  });

  on(nbFromChatBtn, 'click', () => {
    const t = getActiveThread();
    if (!t) return;
    normalizeNotebook(t);
    const title = makeNotebookTitleFromConversation(t);
    const content = summarizeNotebookText(makeNotebookContentFromConversation(t));
    const page = createNotebookPage(t, title, content);
    t.settings.activeNotebookPageId = page.id;
    saveThreads();
    renderNotebook();
    showToast('Đã tạo từ chat');
  });

  on(nbSaveBtn, 'click', () => {
    saveNotebookEditorToPage();
    showToast('Đã lưu trang');
  });

  on(nbDeleteBtn, 'click', () => {
    const t = getActiveThread();
    if (!t) return;
    const page = getActiveNotebookPage(t);
    if (!page) return;
    if (!confirm(`Xóa trang "${page.title}"?`)) return;
    deleteNotebookPage(t, page.id);
    renderNotebook();
    showToast('Đã xóa trang');
  });

  on(nbQuickAIBtn, 'click', () => {
    const t = getActiveThread();
    if (!t) return;
    const lastAssistant = [...t.messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant) {
      showToast('Chưa có nội dung AI để ghi');
      return;
    }
    const note = buildNotebookNoteFromText(lastAssistant.content || '');
    const page = writeNotebookPage(t, 'append_current', note.title, note.content);
    t.settings.activeNotebookPageId = page.id;
    saveThreads();
    renderNotebook();
    openOverlay(notebookOverlay);
    showToast('Đã ghi nhanh từ AI');
  });

  on(nbTitleInput, 'input', saveNotebookEditorToPage);
  on(nbContentInput, 'input', () => {
    saveNotebookEditorToPage();
    updateNotebookPreview();
  });

  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 900 && sidebar && sidebar.classList.contains('open')) {
      const inside = sidebar.contains(e.target) || (mobileMenuBtn && mobileMenuBtn.contains(e.target));
      if (!inside) sidebar.classList.remove('open');
    }
  });

  function safeParse(val, fallback) {
    try { return val ? JSON.parse(val) : fallback; } catch { return fallback; }
  }

  function structuredCloneSafe(obj) {
    try { return structuredClone(obj); } catch { return JSON.parse(JSON.stringify(obj)); }
  }

  function uid() {
    return 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function nowLabel() {
    return new Date().toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit'
    });
  }

  function formatDate(value) {
    if (!value) return 'Chưa có';
    try {
      return new Date(value).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit'
      });
    } catch {
      return 'Chưa có';
    }
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function normalizeText(value) {
    return String(value ?? '').replace(/\r/g, '').trim();
  }

  function saveThreads() {
    localStorage.setItem(STORAGE_THREADS, JSON.stringify(threads));
  }

  function saveActive() {
    localStorage.setItem(STORAGE_ACTIVE, activeThreadId || '');
  }

  function saveDaily() {
    localStorage.setItem(STORAGE_DAILY, JSON.stringify(dailyState));
  }

  function initDaily() {
    const today = new Date().toISOString().slice(0, 10);
    if (!dailyState.date || dailyState.date !== today) {
      dailyState = { date: today, used: 0 };
      saveDaily();
    }
  }

  function makePage(title, content) {
    const now = new Date().toISOString();
    return {
      id: uid(),
      title: title || 'Trang mới',
      content: content || '',
      createdAt: now,
      updatedAt: now
    };
  }

  function normalizeNotebook(thread) {
    thread.settings ||= {};
    const s = thread.settings;

    s.mode = s.mode === 'roleplay' ? 'roleplay' : 'pure';
    s.aiName = s.aiName || CONFIG.defaultAIName;
    s.roleplayName = s.roleplayName || 'Miku';
    s.roleplayPersonality = s.roleplayPersonality || '';
    s.roleplayUserName = s.roleplayUserName || '';
    s.roleplayRelation = s.roleplayRelation || 'cậu-tớ';
    s.roleplayAvatar = s.roleplayAvatar || '';
    s.forceJP = !!s.forceJP;
    s.autoTranslate = s.autoTranslate !== false;
    s.model = s.model || CONFIG.modelDefault;

    s.notebookPages = Array.isArray(s.notebookPages) ? s.notebookPages : [];
    if (!s.notebookPages.length) s.notebookPages.push(makePage('Trang 1', ''));
    s.activeNotebookPageId = s.activeNotebookPageId || s.notebookPages[0].id;

    if (!s.notebookPages.some(p => p.id === s.activeNotebookPageId)) {
      s.activeNotebookPageId = s.notebookPages[0].id;
    }
  }

  function normalizeThread(raw) {
    const thread = {
      id: raw.id || uid(),
      title: raw.title || 'Chat mới',
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString(),
      messages: Array.isArray(raw.messages) ? raw.messages : [],
      settings: {
        ...DEFAULT_THREAD_SETTINGS,
        ...(raw.settings || {})
      }
    };
    normalizeNotebook(thread);
    return thread;
  }

  function normalizeThreads() {
    if (!Array.isArray(threads)) threads = [];
    threads = threads.map(normalizeThread);

    if (!threads.length) {
      const t = createThread(false);
      activeThreadId = t.id;
      saveActive();
    } else {
      saveThreads();
    }
  }

  function ensureActiveThread() {
    const exists = threads.some(t => t.id === activeThreadId);
    if (!exists) {
      activeThreadId = threads[0]?.id || '';
      saveActive();
    }
  }

  function initModel() {
    const thread = getActiveThread();
    if (modelEl) {
      modelEl.value = thread?.settings?.model || localStorage.getItem(STORAGE_MODEL) || CONFIG.modelDefault;
    }
  }

  function getActiveThread() {
    return threads.find(t => t.id === activeThreadId) || threads[0] || null;
  }

  function createThread(save = true) {
    const thread = {
      id: uid(),
      title: 'Chat mới',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      settings: {
        ...DEFAULT_THREAD_SETTINGS,
        notebookPages: [makePage('Trang 1', '')]
      }
    };
    normalizeNotebook(thread);
    threads.unshift(thread);
    if (save) saveThreads();
    renderSidebar();
    return thread;
  }

  function createThreadFromCurrentSettings() {
    const current = getActiveThread();
    const clonedSettings = current?.settings ? structuredCloneSafe(current.settings) : { ...DEFAULT_THREAD_SETTINGS };
    clonedSettings.notebookPages = [makePage('Trang 1', '')];
    clonedSettings.activeNotebookPageId = clonedSettings.notebookPages[0].id;

    const thread = {
      id: uid(),
      title: 'Chat mới',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      settings: clonedSettings
    };

    normalizeNotebook(thread);
    threads.unshift(thread);
    saveThreads();
    renderSidebar();
    return thread;
  }

  function setActiveThread(id) {
    activeThreadId = id;
    saveActive();
    const thread = getActiveThread();
    applyThreadToUi(thread);
    updateBrandUi();
    renderAll();
    if (window.innerWidth <= 900 && sidebar) sidebar.classList.remove('open');
  }

  function deleteThread(id) {
    threads = threads.filter(t => t.id !== id);
    if (!threads.length) {
      const t = createThread(false);
      activeThreadId = t.id;
    } else if (activeThreadId === id) {
      activeThreadId = threads[0].id;
    }
    saveThreads();
    saveActive();
    const thread = getActiveThread();
    applyThreadToUi(thread);
    updateBrandUi();
    renderAll();
    showToast('Đã xóa chat');
  }

  function updateThreadTitle(thread) {
    const firstUser = thread.messages.find(m => m.role === 'user');
    if (!firstUser) return;
    const text = String(firstUser.content || '').trim().replace(/\s+/g, ' ');
    if (!text) return;
    thread.title = text.length > 24 ? text.slice(0, 24) + '…' : text;
  }

  function updateThreadMeta(thread) {
    thread.updatedAt = new Date().toISOString();
    updateThreadTitle(thread);
  }

  function getPersona() {
    const thread = getActiveThread();
    const s = thread?.settings || DEFAULT_THREAD_SETTINGS;

    if (s.mode === 'roleplay') {
      const name = (s.roleplayName || s.aiName || CONFIG.defaultAIName).trim();
      return {
        mode: 'roleplay',
        name,
        personality: (s.roleplayPersonality || '').trim(),
        userName: (s.roleplayUserName || '').trim(),
        relation: s.roleplayRelation || 'cậu-tớ',
        avatar: s.roleplayAvatar || ''
      };
    }

    return {
      mode: 'pure',
      name: (s.aiName || CONFIG.defaultAIName).trim(),
      personality: '',
      userName: '',
      relation: '',
      avatar: ''
    };
  }

  function relationInstructionVN(relation, userName) {
    const target = userName || 'người dùng';
    switch (relation) {
      case 'mình-bạn':
        return `Khi nói chuyện, hãy xưng "mình" và gọi người dùng là "bạn" (${target}).`;
      case 'ta-ngươi':
        return `Khi nói chuyện, hãy xưng "ta" và gọi người dùng là "ngươi" (${target}).`;
      case 'anh-em':
        return `Khi nói chuyện, hãy xưng "anh" và gọi người dùng là "em" (${target}).`;
      case 'cậu-tớ':
      default:
        return `Khi nói chuyện, hãy xưng "tớ" và gọi người dùng là "cậu" (${target}).`;
    }
  }

  function relationInstructionJP(relation, userName) {
    const label = userName
      ? `ユーザー名は「${userName}」です。自然にその名前を使ってください。`
      : 'ユーザーと自然に会話してください。';

    const relationHint = {
      'mình-bạn': '一人称は「わたし」寄り、相手には自然な呼び方で。',
      'ta-ngươi': '一人称は「俺」や「われ」寄り、相手には少し強めに。',
      'anh-em': '一人称は「お兄さん/お姉さん」寄り、親しい雰囲気で。',
      'cậu-tớ': '一人称は自然に「ぼく」または「わたし」、親しい感じで。'
    }[relation || 'cậu-tớ'] || '相手を自然に呼んでください。';

    return `${label} ${relationHint}`;
  }

  function buildSystemPrompt(inputMode) {
    const p = getPersona();
    const name = p.name || CONFIG.defaultAIName;
    const forceJP = !!getActiveThread()?.settings?.forceJP;

    if (p.mode === 'pure') {
      if (forceJP || inputMode === 'ja') {
        return `
あなたはAIアシスタントです。名前は「${name}」です。
自分自身を指す時は「${name}」と呼んでください。
日本語で自然に、簡潔に、わかりやすく返答してください。
`.trim();
      }

      if (inputMode === 'vi') {
        return `
Bạn là một trợ lý AI tên ${name}.
Khi nhắc đến bản thân, hãy tự xưng bằng tên ${name}.
Trả lời tự nhiên bằng tiếng Việt, ngắn gọn và đúng trọng tâm.
 bạn chỉ hỗ trợ học tiếng nhật, không trả lời vấn đề khác nếu không liên quan đến vấn đề học tiếng Nhật`.trim();
      }

      return `
You are an AI assistant named ${name}.
When referring to yourself, use the name ${name}.
Reply naturally in the same language as the user.
Keep responses concise and helpful.
`.trim();
    }

    if (forceJP || inputMode === 'ja') {
      return `
あなたは「${p.name}」という名前のキャラクターです。
性格: ${p.personality || '親しみやすい'}
${relationInstructionJP(p.relation, p.userName)}

ルール:
- 自然で会話らしく返答してください。
- 入力された性格をできるだけ保ってください。
- 名前を聞かれたら「${p.name}」と答えてください。
- AIだとは言わないでください。
- ユーザーを自然に呼んでください。
- Avatar は UI 用なので会話で言及しないでください。
- 日本語だけで返答してください。
`.trim();
    }

    return `
Bạn đang ở chế độ nhập vai.
Tên nhân vật: ${p.name}
Tính cách: ${p.personality || 'tự nhiên, thân thiện'}
${relationInstructionVN(p.relation, p.userName)}

Quy tắc:
- Luôn giữ đúng nhân vật này.
- Trả lời tự nhiên như đang trò chuyện thật.
- Nếu người dùng hỏi tên, hãy trả lời đúng tên nhân vật là "${p.name}".
- Không tự nói rằng bạn là AI thuần túy trừ khi người dùng yêu cầu thoát vai.
- Nếu avatar có, chỉ dùng để hiển thị giao diện, không nhắc lại trong câu trả lời.
- Giữ giọng điệu phù hợp với tính cách đã nhập.
`.trim();
  }

  function buildMessages(userText, inputMode, thread) {
    const msgs = [];
    const sys = buildSystemPrompt(inputMode);
    if (sys) msgs.push({ role: 'system', content: sys });

    for (const m of thread.messages) {
      if (m.role === 'user' || m.role === 'assistant') {
        msgs.push({ role: m.role, content: m.content || '' });
      }
    }

    msgs.push({ role: 'user', content: userText });
    return msgs;
  }

  function parseResponse(data) {
    if (!data) return '(No data)';
    if (typeof data === 'string') return data;
    if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
    if (data.error?.message) return data.error.message;
    if (data.message) return data.message;
    return JSON.stringify(data, null, 2);
  }

  async function callGroq(apiKeyValue, body) {
    const res = await fetch(CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKeyValue
      },
      body: JSON.stringify(body)
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { ok: res.ok, status: res.status, data };
  }

  async function translateViaScript(text, source = 'ja', target = 'vi') {
    const url = (CONFIG.translateScriptUrl || '').trim();
    if (!url || url.includes('YOUR_GOOGLE_SCRIPT_URL_HERE')) {
      return { error: 'Translate script URL chưa được cấu hình' };
    }
    const finalUrl = `${url}?text=${encodeURIComponent(text)}&source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}`;
    const res = await fetch(finalUrl, { method: 'GET' });
    if (!res.ok) return { error: 'Translate script returned ' + res.status };
    return await res.json();
  }

  function showToast(msg, ms = 1800) {
    if (!toastEl) return;
    toastEl.innerText = msg;
    toastEl.style.display = 'block';
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      toastEl.style.display = 'none';
    }, ms);
  }

  function showTyping() {
    if (typingNode || !messagesEl) return;
    typingNode = document.createElement('div');
    typingNode.className = 'msg assistant';
    typingNode.id = 'typingNode';
    typingNode.innerHTML = '<div class="meta-msg">AI đang soạn...</div><div class="typing dots"><span></span><span></span><span></span></div>';
    messagesEl.appendChild(typingNode);
    if (messagesWrap) messagesWrap.scrollTop = messagesWrap.scrollHeight;
  }

  function removeTyping() {
    if (!typingNode) return;
    typingNode.remove();
    typingNode = null;
  }

  function updateDailyUi() {
    setText(dailyInfo, `Lượt hôm nay: ${Number(dailyState.used || 0)}/${CONFIG.dailyLimit}`);
  }

  function hasDailyQuota() {
    return Number(dailyState.used || 0) < CONFIG.dailyLimit;
  }

  function incrementDailyCount() {
    dailyState.used = Number(dailyState.used || 0) + 1;
    saveDaily();
    updateDailyUi();
  }

  function decrementDailyCount() {
    dailyState.used = Math.max(0, Number(dailyState.used || 0) - 1);
    saveDaily();
    updateDailyUi();
  }

  function updateModeUi() {
    const p = getPersona();
    const isPure = p.mode === 'pure';
    if (pureModeBtn) pureModeBtn.classList.toggle('active', isPure);
    if (roleplayModeBtn) roleplayModeBtn.classList.toggle('active', !isPure);
    if (pureSettings) pureSettings.classList.toggle('hidden', !isPure);
    if (roleplaySettings) roleplaySettings.classList.toggle('hidden', isPure);
  }

  function updateAvatarElements() {
    const p = getPersona();
    const name = p.name || CONFIG.defaultAIName;
    const initial = getInitials(name);

    setText(brandTitle, name);
    setText(brandSub, p.mode === 'pure' ? 'AI thuần · Multi chat' : `Nhập vai · ${p.relation || 'cậu-tớ'}`);

    if (p.mode === 'pure' || !p.avatar) {
      if (brandAvatarImg) {
        brandAvatarImg.style.display = 'none';
        brandAvatarImg.removeAttribute('src');
      }
      if (brandAvatarText) {
        brandAvatarText.style.display = 'grid';
        brandAvatarText.textContent = initial;
      }

      if (roleplayAvatarImg) {
        roleplayAvatarImg.style.display = 'none';
        roleplayAvatarImg.removeAttribute('src');
      }
      if (roleplayAvatarText) {
        roleplayAvatarText.style.display = 'grid';
        roleplayAvatarText.textContent = getInitials(p.name || 'AI');
      }
      return;
    }

    if (brandAvatarImg) {
      brandAvatarImg.src = p.avatar;
      brandAvatarImg.style.display = 'block';
    }
    if (brandAvatarText) brandAvatarText.style.display = 'none';

    if (roleplayAvatarImg) {
      roleplayAvatarImg.src = p.avatar;
      roleplayAvatarImg.style.display = 'block';
    }
    if (roleplayAvatarText) roleplayAvatarText.style.display = 'none';
  }

  function applyThreadToUi(thread) {
    if (!thread) return;
    normalizeNotebook(thread);
    const s = thread.settings;

    if (aiNameInput) aiNameInput.value = s.aiName || CONFIG.defaultAIName;
    if (roleplayNameInput) roleplayNameInput.value = s.roleplayName || 'Miku';
    if (roleplayPersonalityInput) roleplayPersonalityInput.value = s.roleplayPersonality || '';
    if (roleplayUserNameInput) roleplayUserNameInput.value = s.roleplayUserName || '';
    if (roleplayRelationInput) roleplayRelationInput.value = s.roleplayRelation || 'cậu-tớ';
    if (forceJpCheckbox) forceJpCheckbox.checked = !!s.forceJP;
    if (autoTranslateCheckbox) autoTranslateCheckbox.checked = s.autoTranslate !== false;
    if (modelEl) modelEl.value = s.model || CONFIG.modelDefault;

    updateModeUi();
    updateAvatarElements();
  }

  function syncThreadFromUi(thread) {
    if (!thread) return;
    normalizeNotebook(thread);
    thread.settings.aiName = (aiNameInput?.value || '').trim() || CONFIG.defaultAIName;
    thread.settings.roleplayName = (roleplayNameInput?.value || '').trim() || 'Miku';
    thread.settings.roleplayPersonality = (roleplayPersonalityInput?.value || '').trim();
    thread.settings.roleplayUserName = (roleplayUserNameInput?.value || '').trim();
    thread.settings.roleplayRelation = roleplayRelationInput?.value || 'cậu-tớ';
    thread.settings.roleplayAvatar = thread.settings.roleplayAvatar || '';
    thread.settings.forceJP = !!forceJpCheckbox?.checked;
    thread.settings.autoTranslate = !!autoTranslateCheckbox?.checked;
    thread.settings.model = modelEl?.value || CONFIG.modelDefault;
  }

  function commitSettingsChange() {
    const thread = getActiveThread();
    if (!thread) return;
    syncThreadFromUi(thread);
    saveThreads();
    updateModeUi();
    updateAvatarElements();
    updateBrandUi();
    renderSidebar();
    renderMessages();
  }

  function setMode(mode) {
    const thread = getActiveThread();
    if (!thread) return;
    normalizeNotebook(thread);
    thread.settings.mode = mode === 'roleplay' ? 'roleplay' : 'pure';
    syncThreadFromUi(thread);
    saveThreads();
    applyThreadToUi(thread);
    updateBrandUi();
    renderSidebar();
    renderMessages();
    showToast(mode === 'roleplay' ? 'Đã chuyển sang nhập vai' : 'Đã chuyển sang giáo sư AI');
  }

  function updateBrandUi() {
    const p = getPersona();
    const name = p.name || CONFIG.defaultAIName;
    setText(brandTitle, name);
    setText(brandSub, p.mode === 'pure' ? 'AI thuần · Multi chat' : `Nhập vai · ${p.relation || 'cậu-tớ'}`);

    if (p.mode === 'pure' || !p.avatar) {
      if (brandAvatarImg) {
        brandAvatarImg.style.display = 'none';
        brandAvatarImg.removeAttribute('src');
      }
      if (brandAvatarText) {
        brandAvatarText.style.display = 'grid';
        brandAvatarText.textContent = getInitials(name);
      }
      return;
    }

    if (brandAvatarImg) {
      brandAvatarImg.src = p.avatar;
      brandAvatarImg.style.display = 'block';
    }
    if (brandAvatarText) brandAvatarText.style.display = 'none';
  }

  function renderSidebar() {
    if (!chatListEl) return;
    chatListEl.innerHTML = '';

    const sorted = [...threads].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    sorted.forEach(thread => {
      const item = document.createElement('button');
      item.className = 'chat-item' + (thread.id === activeThreadId ? ' active' : '');
      item.type = 'button';

      const info = document.createElement('div');
      info.className = 'info';

      const title = document.createElement('div');
      title.className = 'title';
      title.innerText = thread.title || 'Chat';

      const meta = document.createElement('div');
      meta.className = 'meta';
      const last = thread.messages.at(-1);
      const modeText = thread.settings?.mode === 'roleplay' ? 'Nhập vai' : 'Giáo sư AI';
      meta.innerText = last
        ? `${modeText} · ${(last.content || '').slice(0, 38)}`
        : `${modeText} · Chưa có tin nhắn`;

      info.appendChild(title);
      info.appendChild(meta);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'del-chat-btn';
      del.title = 'Xóa chat này';
      del.innerText = '🗑';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!confirm(`Xóa chat "${thread.title}"?`)) return;
        deleteThread(thread.id);
      });

      item.appendChild(info);
      item.appendChild(del);
      item.addEventListener('click', () => setActiveThread(thread.id));

      chatListEl.appendChild(item);
    });
  }

  function buildAvatarNode(name, avatarUrl) {
    const wrap = document.createElement('div');
    wrap.className = 'avatar sm';

    const img = document.createElement('img');
    const span = document.createElement('span');

    if (avatarUrl) {
      img.src = avatarUrl;
      img.style.display = 'block';
      span.style.display = 'none';
    } else {
      span.textContent = getInitials(name);
    }

    wrap.appendChild(img);
    wrap.appendChild(span);
    return wrap;
  }

  function renderMessages() {
    if (!messagesEl) return;
    messagesEl.innerHTML = '';

    const thread = getActiveThread();
    if (!thread) {
      setText(activeChatTitleEl, 'Chat');
      setText(activeChatSubEl, 'Chưa có chat');
      return;
    }

    const p = getPersona();
    setText(activeChatTitleEl, thread.title || 'Chat');
    setText(activeChatSubEl, `${thread.messages.length} tin nhắn · ${nowLabel()}`);

    thread.messages.forEach(msg => {
      const el = document.createElement('div');
      el.className = 'msg ' + (msg.role === 'user' ? 'user' : 'assistant');

      if (msg.role === 'assistant') {
        const top = document.createElement('div');
        top.className = 'assistant-head';

        const avatar = buildAvatarNode(p.name, p.avatar);
        top.appendChild(avatar);

        const right = document.createElement('div');
        right.className = 'assistant-head-right';

        const nameLine = document.createElement('div');
        nameLine.className = 'assistant-name';
        nameLine.innerText = p.name || 'AI';

        const subLine = document.createElement('div');
        subLine.className = 'assistant-sub';
        subLine.innerText = msg.meta ? msg.meta : (p.mode === 'roleplay' ? 'Nhập vai' : 'AI thuần');

        right.appendChild(nameLine);
        right.appendChild(subLine);
        top.appendChild(right);

        const actions = document.createElement('div');
        actions.className = 'assistant-top-actions';

        const noteBtn = document.createElement('button');
        noteBtn.type = 'button';
        noteBtn.className = 'note-btn';
        noteBtn.title = 'Ghi tóm tắt vào sổ tay';
        noteBtn.innerText = '📝';
        noteBtn.addEventListener('click', () => {
          const t = getActiveThread();
          if (!t) return;
          const note = buildNotebookNoteFromText(msg.content || '');
          const page = writeNotebookPage(t, 'append_current', note.title, note.content);
          t.settings.activeNotebookPageId = page.id;
          saveThreads();
          renderNotebook();
          openOverlay(notebookOverlay);
          showToast('Đã ghi vào sổ tay');
        });
        actions.appendChild(noteBtn);

        if (msg.voiceable) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'voice-btn';
          btn.title = 'Phát âm tiếng Nhật';
          btn.innerText = '🔊';
          btn.addEventListener('click', () => speakJapanese(msg.content || ''));
          actions.appendChild(btn);
        }

        top.appendChild(actions);
        el.appendChild(top);
      }

      const c = document.createElement('div');
      c.innerText = msg.content || '';
      el.appendChild(c);

      if (msg.translation) {
        const t = document.createElement('div');
        t.className = 'translated';
        t.innerHTML = '<strong>→ VI:</strong> ' + escapeHtml(msg.translation);
        el.appendChild(t);
      }

      if (msg.romanji) {
        const r = document.createElement('div');
        r.className = 'romanji';
        r.innerText = '→ Romanji: ' + msg.romanji;
        el.appendChild(r);
      }

      messagesEl.appendChild(el);
    });

    if (messagesWrap) messagesWrap.scrollTop = messagesWrap.scrollHeight;
  }

  function renderAll() {
    renderSidebar();
    updateThreadUiText();
    updateBrandUi();
    updateAvatarElements();
    renderMessages();
  }

  function updateThreadUiText() {
    const thread = getActiveThread();
    if (!thread) {
      setText(activeChatTitleEl, 'Chat');
      setText(activeChatSubEl, 'Chưa có chat');
      return;
    }
    setText(activeChatTitleEl, thread.title || 'Chat');
    setText(activeChatSubEl, `${thread.messages.length} tin nhắn · ${nowLabel()}`);
  }

  function getInitials(name) {
    const s = String(name || '').trim();
    if (!s) return 'AI';
    return s.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }

  function summarizeNotebookText(sourceText) {
    const raw = normalizeText(sourceText);
    if (!raw) return '';

    const lines = raw.split(/\n+/).map(s => s.trim()).filter(Boolean);
    const sentences = raw
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?。！？])\s+/)
      .map(s => s.trim())
      .filter(Boolean);

    const important = /(quan trọng|lưu ý|cần nhớ|nên|phải|bước|mẹo|kết luận|ý chính|tóm tắt|định nghĩa|công thức|bài học|ghi nhớ|note|lesson|tip)/i;
    const junk = /^(ai|okay|ok|oke|vâng|dạ|ừ|xin chào|chào|hello|hi|cảm ơn|cám ơn|không có gì|tất nhiên|được rồi|sure|of course|はい|うん)\b/i;

    const picked = [];
    for (const item of [...lines, ...sentences]) {
      const s = item.replace(/^[-*•\d.)\]]+\s*/, '').trim();
      if (!s || s.length < 6 || junk.test(s)) continue;
      if (important.test(s) || s.length > 24) picked.push(s);
    }

    const unique = [...new Set(picked)];
    const base = unique.length ? unique : [sentences[0] || lines[0] || raw];
    return base
      .slice(0, 5)
      .map(s => `- ${s.replace(/\s+/g, ' ').slice(0, 220)}`)
      .join('\n');
  }

  function makeNotebookTitleFromText(text) {
    const s = normalizeText(text).replace(/\s+/g, ' ');
    return s ? (s.length > 36 ? s.slice(0, 36) + '…' : s) : 'Ghi chú';
  }

  function makeNotebookTitleFromConversation(thread) {
    const lastUser = [...thread.messages].reverse().find(m => m.role === 'user');
    return makeNotebookTitleFromText(lastUser?.content || thread.title || 'Từ chat');
  }

  function makeNotebookContentFromConversation(thread) {
    const chunks = thread.messages
      .slice(-12)
      .map(m => {
        const speaker = m.role === 'user' ? 'Người dùng' : 'AI';
        return `${speaker}: ${m.content || ''}`;
      })
      .join('\n\n');
    return summarizeNotebookText(chunks);
  }

  function extractNotebookTitleFromRequest(text) {
    const raw = normalizeText(text);

    const patterns = [
      /(?:tiêu đề|title)\s*(?:là|:|=)\s*[“"']?(.+?)[”"']?(?:$|[.?!,\n])/i,
      /(?:đặt|đổi|set|rename)\s*(?:tiêu đề|title)\s*(?:là|thành|to|:|=)\s*[“"']?(.+?)[”"']?(?:$|[.?!,\n])/i,
      /(?:tạo|mở)\s+trang\s+[“"']?(.+?)[”"']?(?:$|[.?!,\n])/i
    ];

    for (const re of patterns) {
      const m = raw.match(re);
      if (m?.[1]) return makeNotebookTitleFromText(m[1]);
    }

    return makeNotebookTitleFromText(raw);
  }

  function parseNotebookIntent(userText) {
    const raw = normalizeText(userText).toLowerCase();
    if (!raw) return null;

    const hasTitleIntent =
      /(đặt|đổi|set|rename).*(tiêu đề|title)/i.test(raw) ||
      /(tiêu đề|title).*(là|thành|to|:|=)/i.test(raw);

    if (hasTitleIntent) {
      return { type: 'set_title', title: extractNotebookTitleFromRequest(userText) };
    }

    if (/(ghi vào cùng trang|thêm vào cùng trang|note vào cùng trang|ghi vào trang này|thêm vào trang này|trang hiện tại|trang này|append current|current page)/i.test(raw)) {
      return { type: 'append_current', title: extractNotebookTitleFromRequest(userText) };
    }

    if (/(tạo trang mới|tạo trang|trang mới|new page|mở trang mới)/i.test(raw)) {
      return { type: 'create_page', title: extractNotebookTitleFromRequest(userText) };
    }

    if (/(sổ tay|ghi chú|note|tóm tắt|lưu vào sổ tay|ghi vào sổ tay|viết vào sổ tay|làm trang|tạo note|notebook)/i.test(raw)) {
      return { type: 'auto', title: extractNotebookTitleFromRequest(userText) };
    }

    return null;
  }

  function formatNotebookAppend(existingContent, addition) {
    const a = normalizeText(existingContent);
    const b = normalizeText(addition);
    if (!a) return b;
    if (!b) return a;
    if (a.includes(b)) return a;
    return `${a}\n\n${b}`;
  }

  function getActiveNotebookPage(thread) {
    if (!thread) return null;
    normalizeNotebook(thread);
    const pages = thread.settings.notebookPages || [];
    return pages.find(p => p.id === thread.settings.activeNotebookPageId) || pages[0] || null;
  }

  function createNotebookPage(thread, title, content) {
    normalizeNotebook(thread);
    const page = makePage(title || 'Trang mới', content || '');
    thread.settings.notebookPages.unshift(page);
    thread.settings.activeNotebookPageId = page.id;
    updateThreadMeta(thread);
    saveThreads();
    return page;
  }

  function deleteNotebookPage(thread, pageId) {
    normalizeNotebook(thread);
    thread.settings.notebookPages = thread.settings.notebookPages.filter(p => p.id !== pageId);
    if (!thread.settings.notebookPages.length) {
      thread.settings.notebookPages.push(makePage('Trang 1', ''));
    }
    thread.settings.activeNotebookPageId = thread.settings.notebookPages[0].id;
    saveThreads();
  }

  function writeNotebookPage(thread, action, title, content) {
    normalizeNotebook(thread);
    let page = getActiveNotebookPage(thread);

    if (action === 'set_title') {
      const target = page || createNotebookPage(thread, title || 'Trang mới', '');
      target.title = title || target.title || 'Trang mới';
      if (content) {
        target.content = formatNotebookAppend(target.content, content);
      }
      target.updatedAt = new Date().toISOString();
      thread.settings.activeNotebookPageId = target.id;
      updateThreadMeta(thread);
      saveThreads();
      renderNotebook();
      return target;
    }

    if (action === 'append_current') {
      const target = page || createNotebookPage(thread, title || 'Trang mới', '');
      if (!target.title || target.title === 'Trang mới') {
        target.title = title || target.title || 'Trang mới';
      }
      target.content = formatNotebookAppend(target.content, content);
      target.updatedAt = new Date().toISOString();
      thread.settings.activeNotebookPageId = target.id;
      updateThreadMeta(thread);
      saveThreads();
      renderNotebook();
      return target;
    }

    if (action === 'create_page') {
      const newPage = createNotebookPage(thread, title || 'Trang mới', content || '');
      thread.settings.activeNotebookPageId = newPage.id;
      updateThreadMeta(thread);
      saveThreads();
      renderNotebook();
      return newPage;
    }

    page = page || createNotebookPage(thread, title || 'Trang mới', '');
    page.content = formatNotebookAppend(page.content, content);
    page.updatedAt = new Date().toISOString();
    thread.settings.activeNotebookPageId = page.id;
    updateThreadMeta(thread);
    saveThreads();
    renderNotebook();
    return page;
  }

  function buildNotebookNoteFromText(sourceText) {
    const title = makeNotebookTitleFromText(sourceText);
    const content = summarizeNotebookText(sourceText);
    return { title, content };
  }

  function maybeAutoWriteNotebook(thread, userText, assistantText) {
    const intent = parseNotebookIntent(userText);
    if (!intent) return;

    const note = buildNotebookNoteFromText(assistantText || userText);
    const targetTitle = intent.title || note.title || 'Ghi chú';
    const targetContent = note.content || summarizeNotebookText(userText) || normalizeText(assistantText || userText);

    if (intent.type === 'set_title') {
      writeNotebookPage(thread, 'set_title', targetTitle, targetContent);
      showToast('Đã đặt tiêu đề sổ tay');
      return;
    }

    if (intent.type === 'append_current') {
      writeNotebookPage(thread, 'append_current', targetTitle, targetContent);
      showToast('Đã ghi vào trang hiện tại');
      return;
    }

    if (intent.type === 'create_page') {
      writeNotebookPage(thread, 'create_page', targetTitle, targetContent);
      showToast('Đã tạo trang mới');
      return;
    }

    const currentPage = getActiveNotebookPage(thread);
    if (currentPage) {
      writeNotebookPage(thread, 'append_current', targetTitle, targetContent);
      showToast('Đã ghi vào sổ tay');
    } else {
      writeNotebookPage(thread, 'create_page', targetTitle, targetContent);
      showToast('Đã tạo và ghi vào sổ tay');
    }
  }

  function renderNotebookSidebarOnly(thread) {
    normalizeNotebook(thread);
    setText(nbCountHint, `${thread.settings.notebookPages.length} trang`);
    if (!nbPageList) return;
    nbPageList.innerHTML = '';
    thread.settings.notebookPages.forEach(page => nbPageList.appendChild(buildNotebookPageElement(thread, page)));
    const page = getActiveNotebookPage(thread);
    setText(nbMetaHint, page ? `Cập nhật: ${formatDate(page.updatedAt)}` : 'Chưa chọn trang');
  }

  function buildNotebookPageElement(thread, page) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'page-item' + (page.id === thread.settings.activeNotebookPageId ? ' active' : '');
    btn.innerHTML = `<div class="t">${escapeHtml(page.title || 'Trang mới')}</div><div class="m">${escapeHtml((page.content || '').slice(0, 56) || 'Chưa có nội dung')}</div>`;
    btn.addEventListener('click', () => {
      thread.settings.activeNotebookPageId = page.id;
      saveThreads();
      renderNotebook();
    });
    return btn;
  }

  function renderNotebook() {
    const thread = getActiveThread();
    if (!thread) return;

    normalizeNotebook(thread);
    const pages = thread.settings.notebookPages || [];
    setText(nbCountHint, `${pages.length} trang`);

    if (nbPageList) {
      nbPageList.innerHTML = '';
      pages.forEach(page => nbPageList.appendChild(buildNotebookPageElement(thread, page)));
    }

    const page = getActiveNotebookPage(thread);
    if (!page) {
      if (nbTitleInput) nbTitleInput.value = '';
      if (nbContentInput) nbContentInput.value = '';
      setText(nbMetaHint, 'Chưa chọn trang');
      setText(nbPreviewBox, 'Chưa có nội dung');
      updateNotebookButtonsState();
      return;
    }

    if (nbTitleInput) nbTitleInput.value = page.title || '';
    if (nbContentInput) nbContentInput.value = page.content || '';
    setText(nbMetaHint, `Cập nhật: ${formatDate(page.updatedAt)}`);
    setText(nbPreviewBox, page.content || 'Chưa có nội dung');
    updateNotebookButtonsState();
  }

  function saveNotebookEditorToPage() {
    if (notebookSyncLock) return;
    const thread = getActiveThread();
    if (!thread) return;

    normalizeNotebook(thread);
    const page = getActiveNotebookPage(thread);
    if (!page) return;

    page.title = (nbTitleInput?.value || '').trim() || 'Trang mới';
    page.content = nbContentInput?.value || '';
    page.updatedAt = new Date().toISOString();
    thread.settings.activeNotebookPageId = page.id;
    saveThreads();

    renderNotebookSidebarOnly(thread);
    updateNotebookPreview();
    renderSidebar();
  }

  function updateNotebookPreview() {
    setText(nbPreviewBox, nbContentInput?.value || 'Chưa có nội dung');
  }

  function updateNotebookButtonsState() {
    const t = getActiveThread();
    const page = getActiveNotebookPage(t);
    if (nbSaveBtn) nbSaveBtn.disabled = !page;
    if (nbDeleteBtn) nbDeleteBtn.disabled = !page;
  }

  function updateNotebookEditorFromPage() {
    const thread = getActiveThread();
    if (!thread) return;
    normalizeNotebook(thread);
    const page = getActiveNotebookPage(thread);
    if (!page) return;

    notebookSyncLock = true;
    if (nbTitleInput) nbTitleInput.value = page.title || '';
    if (nbContentInput) nbContentInput.value = page.content || '';
    setText(nbMetaHint, `Cập nhật: ${formatDate(page.updatedAt)}`);
    setText(nbPreviewBox, page.content || 'Chưa có nội dung');
    updateNotebookButtonsState();
    notebookSyncLock = false;
  }

  function renderNotebookAndSync() {
    updateNotebookEditorFromPage();
    renderNotebook();
  }

  function openOverlay(el) {
    if (!el) return;
    el.classList.add('open');
    el.setAttribute('aria-hidden', 'false');
  }

  function closeOverlay(el) {
    if (!el) return;
    el.classList.remove('open');
    el.setAttribute('aria-hidden', 'true');
  }

  function detectInputLanguage(text) {
    const raw = String(text || '').trim();
    if (!raw) return 'unknown';

    if (/[ぁ-んァ-ン一-龯々]/.test(raw)) return 'ja';
    if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(raw)) return 'vi';

    const viHints = [
      'xin','chào','chao','bạn','ban','tôi','toi','mình','minh',
      'hôm','hom','nay','qua','cảm','cam','ơn','on','không','khong',
      'có','co','giúp','giup','thế','the','nào','sao','được','duoc',
      'làm','lam','nha','nhé','nhe','rồi','roi','vì','vi','nên','nen',
      'đang','dang','đi','di','gì','gi','đâu','dau','đó','do'
    ];

    const lowered = raw.toLowerCase();
    for (const w of viHints) {
      const re = new RegExp(`(^|[^\\p{L}])${escapeRegex(w)}([^\\p{L}]|$)`, 'iu');
      if (re.test(lowered)) return 'vi';
    }

    return 'en';
  }

  function isJapaneseText(text) {
    return /[ぁ-んァ-ン一-龯々]/.test(String(text || ''));
  }

  function speakJapanese(text) {
    if (!('speechSynthesis' in window)) {
      showToast('Trình duyệt không hỗ trợ phát âm');
      return;
    }

    const raw = String(text || '').trim();
    if (!raw) return;

    speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(raw);
    utter.lang = 'ja-JP';
    utter.rate = 0.95;
    utter.pitch = 1;

    const voices = speechSynthesis.getVoices?.() || [];
    const jpVoice =
      voices.find(v => /ja/i.test(v.lang)) ||
      voices.find(v => /Japanese/i.test(v.name)) ||
      null;

    if (jpVoice) utter.voice = jpVoice;

    speechSynthesis.speak(utter);
  }

  async function onSend() {
    if (!hasDailyQuota()) {
      alert('Bạn đã hết lượt nhắn trong ngày. Vui lòng thử lại vào ngày mai 🙏');
      return;
    }

    const text = (textInput?.value || '').trim();
    if (!text) {
      alert('Nhập tin nhắn đi đã');
      return;
    }

    const thread = getActiveThread();
    if (!thread) {
      const t = createThread(false);
      setActiveThread(t.id);
      return;
    }

    const inputMode = detectInputLanguage(text);
    syncThreadFromUi(thread);
    thread.messages.push({ role: 'user', content: text });
    updateThreadMeta(thread);
    saveThreads();
    renderAll();

    if (textInput) textInput.value = '';

    const apiKeyValue = (CONFIG.groqApiKey || '').trim();
    if (!apiKeyValue || apiKeyValue.includes('YOUR_GROQ_API_KEY_HERE')) {
      alert('Chưa dán GROQ API key vào CONFIG.groqApiKey');
      thread.messages.pop();
      saveThreads();
      renderAll();
      return;
    }

    incrementDailyCount();
    showTyping();
    if (sendBtn) sendBtn.disabled = true;

    try {
      const body = {
        model: thread.settings.model || CONFIG.modelDefault,
        messages: buildMessages(text, inputMode, thread),
        temperature: 0.7
      };

      const response = await callGroq(apiKeyValue, body);

      if (response.status === 429) {
        dailyState.used = Math.max(0, Number(dailyState.used || 1) - 1);
        saveDaily();
        updateDailyUi();
        removeTyping();
        thread.messages.push({
          role: 'assistant',
          content: 'Bạn đã hết lượt gửi theo giới hạn server (429). Thử lại sau nhé.',
          meta: '',
          voiceable: false
        });
        updateThreadMeta(thread);
        saveThreads();
        renderAll();
        return;
      }

      if (!response.ok) {
        removeTyping();
        thread.messages.push({
          role: 'assistant',
          content: 'Lỗi từ API: ' + (typeof response.data === 'string' ? response.data : JSON.stringify(response.data)),
          meta: '',
          voiceable: false
        });
        updateThreadMeta(thread);
        saveThreads();
        renderAll();
        decrementDailyCount();
        return;
      }

      const assistantText = parseResponse(response.data);
      const assistantIsJP = isJapaneseText(assistantText);
      let translated = null;
      let romanji = null;

      const shouldTranslate = !!thread.settings.autoTranslate && inputMode !== 'vi';
      if (shouldTranslate && assistantIsJP) {
        try {
          const t = await translateViaScript(assistantText, 'ja', 'vi');
          if (!t.error) {
            translated = t.translated || null;
            romanji = t.romanji || null;
          }
        } catch (e) {
          console.warn('Translate failed:', e);
        }
      }

      thread.messages.push({
        role: 'assistant',
        content: assistantText,
        translation: translated,
        romanji,
        meta: response.data?.model || '',
        voiceable: assistantIsJP
      });

      updateThreadMeta(thread);
      saveThreads();
      renderAll();
      showToast('Hoàn thành');

      maybeAutoWriteNotebook(thread, text, assistantText);
    } catch (err) {
      dailyState.used = Math.max(0, Number(dailyState.used || 1) - 1);
      saveDaily();
      updateDailyUi();
      removeTyping();
      thread.messages.push({
        role: 'assistant',
        content: 'Lỗi network/khác: ' + (err?.message || String(err)),
        meta: '',
        voiceable: false
      });
      updateThreadMeta(thread);
      saveThreads();
      renderAll();
    } finally {
      removeTyping();
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  function renderNotebookPlaceholderSafe() {
    const thread = getActiveThread();
    if (!thread) return;
    normalizeNotebook(thread);
    setText(nbCountHint, `${thread.settings.notebookPages.length} trang`);
    if (nbPageList) nbPageList.innerHTML = '';
    thread.settings.notebookPages.forEach(page => {
      if (nbPageList) nbPageList.appendChild(buildNotebookPageElement(thread, page));
    });
    const page = getActiveNotebookPage(thread);
    setText(nbMetaHint, page ? `Cập nhật: ${formatDate(page.updatedAt)}` : 'Chưa chọn trang');
  }

  function renderNotebookIfAvailable() {
    const thread = getActiveThread();
    if (!thread) return;
    normalizeNotebook(thread);

    const pages = thread.settings.notebookPages || [];
    setText(nbCountHint, `${pages.length} trang`);

    if (nbPageList) {
      nbPageList.innerHTML = '';
      pages.forEach(page => nbPageList.appendChild(buildNotebookPageElement(thread, page)));
    }

    const page = getActiveNotebookPage(thread);
    if (!page) {
      if (nbTitleInput) nbTitleInput.value = '';
      if (nbContentInput) nbContentInput.value = '';
      setText(nbMetaHint, 'Chưa chọn trang');
      setText(nbPreviewBox, 'Chưa có nội dung');
      updateNotebookButtonsState();
      return;
    }

    if (nbTitleInput) nbTitleInput.value = page.title || '';
    if (nbContentInput) nbContentInput.value = page.content || '';
    setText(nbMetaHint, `Cập nhật: ${formatDate(page.updatedAt)}`);
    setText(nbPreviewBox, page.content || 'Chưa có nội dung');
    updateNotebookButtonsState();
  }

  function buildNotebookPageElement(thread, page) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'page-item' + (page.id === thread.settings.activeNotebookPageId ? ' active' : '');
    btn.innerHTML = `<div class="t">${escapeHtml(page.title || 'Trang mới')}</div><div class="m">${escapeHtml((page.content || '').slice(0, 56) || 'Chưa có nội dung')}</div>`;
    btn.addEventListener('click', () => {
      thread.settings.activeNotebookPageId = page.id;
      saveThreads();
      renderNotebook();
    });
    return btn;
  }

  function renderNotebook() {
    const thread = getActiveThread();
    if (!thread) return;
    normalizeNotebook(thread);
    renderNotebookIfAvailable();
  }

  function updateNotebookButtonsState() {
    const t = getActiveThread();
    const page = getActiveNotebookPage(t);
    if (nbSaveBtn) nbSaveBtn.disabled = !page;
    if (nbDeleteBtn) nbDeleteBtn.disabled = !page;
  }

  function normalizeNotebookText(value) {
    return String(value ?? '').replace(/\r/g, '').trim();
  }

  function makeNotebookTitleFromConversation(thread) {
    const lastUser = [...thread.messages].reverse().find(m => m.role === 'user');
    return makeNotebookTitleFromText(lastUser?.content || thread.title || 'Từ chat');
  }

  function makeNotebookContentFromConversation(thread) {
    const chunks = thread.messages.slice(-12).map(m => {
      const speaker = m.role === 'user' ? 'Người dùng' : 'AI';
      return `${speaker}: ${m.content || ''}`;
    }).join('\n\n');
    return summarizeNotebookText(chunks);
  }

  function renderMessagesQuickTitle() {
    const thread = getActiveThread();
    if (!thread) return;
    setText(activeChatTitleEl, thread.title || 'Chat');
    setText(activeChatSubEl, `${thread.messages.length} tin nhắn · ${nowLabel()}`);
  }

  function updateNotebookPreviewSafe() {
    setText(nbPreviewBox, nbContentInput?.value || 'Chưa có nội dung');
  }

  function saveNotebookEditorToPage() {
    if (notebookSyncLock) return;
    const thread = getActiveThread();
    if (!thread) return;

    normalizeNotebook(thread);
    const page = getActiveNotebookPage(thread);
    if (!page) return;

    page.title = (nbTitleInput?.value || '').trim() || 'Trang mới';
    page.content = nbContentInput?.value || '';
    page.updatedAt = new Date().toISOString();
    thread.settings.activeNotebookPageId = page.id;
    saveThreads();

    renderNotebookSidebarOnly(thread);
    updateNotebookPreviewSafe();
    renderSidebar();
  }

  function renderNotebookSidebarOnly(thread) {
    normalizeNotebook(thread);
    setText(nbCountHint, `${thread.settings.notebookPages.length} trang`);
    if (nbPageList) {
      nbPageList.innerHTML = '';
      thread.settings.notebookPages.forEach(page => nbPageList.appendChild(buildNotebookPageElement(thread, page)));
    }
    const page = getActiveNotebookPage(thread);
    setText(nbMetaHint, page ? `Cập nhật: ${formatDate(page.updatedAt)}` : 'Chưa chọn trang');
  }

  function updateNotebookEditorFromCurrentPage() {
    const thread = getActiveThread();
    if (!thread) return;
    normalizeNotebook(thread);
    const page = getActiveNotebookPage(thread);
    if (!page) return;

    notebookSyncLock = true;
    if (nbTitleInput) nbTitleInput.value = page.title || '';
    if (nbContentInput) nbContentInput.value = page.content || '';
    setText(nbMetaHint, `Cập nhật: ${formatDate(page.updatedAt)}`);
    setText(nbPreviewBox, page.content || 'Chưa có nội dung');
    updateNotebookButtonsState();
    notebookSyncLock = false;
  }

  function renderNotebookAndKeepEditorStable() {
    updateNotebookEditorFromCurrentPage();
    renderNotebookIfAvailable();
  }

  function buildNotebookNoteFromText(sourceText) {
    const title = makeNotebookTitleFromText(sourceText);
    const content = summarizeNotebookText(sourceText);
    return { title, content };
  }

  function parseNotebookIntent(userText) {
    const raw = normalizeNotebookText(userText).toLowerCase();
    if (!raw) return null;

    const hasTitleIntent =
      /(đặt|đổi|set|rename).*(tiêu đề|title)/i.test(raw) ||
      /(tiêu đề|title).*(là|thành|to|:|=)/i.test(raw);

    if (hasTitleIntent) {
      return { type: 'set_title', title: extractNotebookTitleFromRequest(userText) };
    }

    if (/(ghi vào cùng trang|thêm vào cùng trang|note vào cùng trang|ghi vào trang này|thêm vào trang này|trang hiện tại|trang này|append current|current page)/i.test(raw)) {
      return { type: 'append_current', title: extractNotebookTitleFromRequest(userText) };
    }

    if (/(tạo trang mới|tạo trang|trang mới|new page|mở trang mới)/i.test(raw)) {
      return { type: 'create_page', title: extractNotebookTitleFromRequest(userText) };
    }

    if (/(sổ tay|ghi chú|note|tóm tắt|lưu vào sổ tay|ghi vào sổ tay|viết vào sổ tay|làm trang|tạo note|notebook)/i.test(raw)) {
      return { type: 'auto', title: extractNotebookTitleFromRequest(userText) };
    }

    return null;
  }

  function extractNotebookTitleFromRequest(text) {
    const raw = normalizeNotebookText(text);

    const patterns = [
      /(?:tiêu đề|title)\s*(?:là|:|=)\s*[“"']?(.+?)[”"']?(?:$|[.?!,\n])/i,
      /(?:đặt|đổi|set|rename)\s*(?:tiêu đề|title)\s*(?:là|thành|to|:|=)\s*[“"']?(.+?)[”"']?(?:$|[.?!,\n])/i,
      /(?:tạo|mở)\s+trang\s+[“"']?(.+?)[”"']?(?:$|[.?!,\n])/i
    ];

    for (const re of patterns) {
      const m = raw.match(re);
      if (m?.[1]) return makeNotebookTitleFromText(m[1]);
    }

    return makeNotebookTitleFromText(raw);
  }

  function writeNotebookPage(thread, action, title, content) {
    normalizeNotebook(thread);
    let page = getActiveNotebookPage(thread);

    if (action === 'set_title') {
      const target = page || createNotebookPage(thread, title || 'Trang mới', '');
      target.title = title || target.title || 'Trang mới';
      if (content) target.content = formatNotebookAppend(target.content, content);
      target.updatedAt = new Date().toISOString();
      thread.settings.activeNotebookPageId = target.id;
      updateThreadMeta(thread);
      saveThreads();
      renderNotebook();
      return target;
    }

    if (action === 'append_current') {
      const target = page || createNotebookPage(thread, title || 'Trang mới', '');
      if (!target.title || target.title === 'Trang mới') {
        target.title = title || target.title || 'Trang mới';
      }
      target.content = formatNotebookAppend(target.content, content);
      target.updatedAt = new Date().toISOString();
      thread.settings.activeNotebookPageId = target.id;
      updateThreadMeta(thread);
      saveThreads();
      renderNotebook();
      return target;
    }

    if (action === 'create_page') {
      const newPage = createNotebookPage(thread, title || 'Trang mới', content || '');
      thread.settings.activeNotebookPageId = newPage.id;
      updateThreadMeta(thread);
      saveThreads();
      renderNotebook();
      return newPage;
    }

    page = page || createNotebookPage(thread, title || 'Trang mới', '');
    page.content = formatNotebookAppend(page.content, content);
    page.updatedAt = new Date().toISOString();
    thread.settings.activeNotebookPageId = page.id;
    updateThreadMeta(thread);
    saveThreads();
    renderNotebook();
    return page;
  }

  function maybeAutoWriteNotebook(thread, userText, assistantText) {
    const intent = parseNotebookIntent(userText);
    if (!intent) return;

    const note = buildNotebookNoteFromText(assistantText || userText);
    const targetTitle = intent.title || note.title || 'Ghi chú';
    const targetContent = note.content || summarizeNotebookText(userText) || normalizeText(assistantText || userText);

    if (intent.type === 'set_title') {
      writeNotebookPage(thread, 'set_title', targetTitle, targetContent);
      showToast('Đã đặt tiêu đề sổ tay');
      return;
    }

    if (intent.type === 'append_current') {
      writeNotebookPage(thread, 'append_current', targetTitle, targetContent);
      showToast('Đã ghi vào trang hiện tại');
      return;
    }

    if (intent.type === 'create_page') {
      writeNotebookPage(thread, 'create_page', targetTitle, targetContent);
      showToast('Đã tạo trang mới');
      return;
    }

    const currentPage = getActiveNotebookPage(thread);
    if (currentPage) {
      writeNotebookPage(thread, 'append_current', targetTitle, targetContent);
      showToast('Đã ghi vào sổ tay');
    } else {
      writeNotebookPage(thread, 'create_page', targetTitle, targetContent);
      showToast('Đã tạo và ghi vào sổ tay');
    }
  }

  function renderNotebookSnapshot() {
    const thread = getActiveThread();
    if (!thread) return;
    normalizeNotebook(thread);
    setText(nbCountHint, `${thread.settings.notebookPages.length} trang`);
    if (nbPageList) {
      nbPageList.innerHTML = '';
      thread.settings.notebookPages.forEach(page => nbPageList.appendChild(buildNotebookPageElement(thread, page)));
    }
    const page = getActiveNotebookPage(thread);
    setText(nbMetaHint, page ? `Cập nhật: ${formatDate(page.updatedAt)}` : 'Chưa chọn trang');
  }

  function renderNotebookView() {
    const thread = getActiveThread();
    if (!thread) return;
    normalizeNotebook(thread);

    const pages = thread.settings.notebookPages || [];
    setText(nbCountHint, `${pages.length} trang`);
    if (nbPageList) {
      nbPageList.innerHTML = '';
      pages.forEach(page => nbPageList.appendChild(buildNotebookPageElement(thread, page)));
    }

    const page = getActiveNotebookPage(thread);
    if (!page) {
      if (nbTitleInput) nbTitleInput.value = '';
      if (nbContentInput) nbContentInput.value = '';
      setText(nbMetaHint, 'Chưa chọn trang');
      setText(nbPreviewBox, 'Chưa có nội dung');
      updateNotebookButtonsState();
      return;
    }

    if (nbTitleInput) nbTitleInput.value = page.title || '';
    if (nbContentInput) nbContentInput.value = page.content || '';
    setText(nbMetaHint, `Cập nhật: ${formatDate(page.updatedAt)}`);
    setText(nbPreviewBox, page.content || 'Chưa có nội dung');
    updateNotebookButtonsState();
  }

  function renderNotebookSafe() {
    renderNotebookView();
  }

  function renderNotebook() {
    renderNotebookView();
  }

  function renderMessagesAndNotebook() {
    renderMessages();
    renderNotebookView();
  }

  function maybeOpenNotebookForAssistantNote(msg) {
    const t = getActiveThread();
    if (!t) return;
    const note = buildNotebookNoteFromText(msg.content || '');
    const page = writeNotebookPage(t, 'append_current', note.title, note.content);
    t.settings.activeNotebookPageId = page.id;
    saveThreads();
    renderNotebook();
    openOverlay(notebookOverlay);
  }

  function showSafeStatus() {
    renderMessagesQuickTitle();
  }

  function initCurrentThreadUI() {
    const active = getActiveThread();
    if (active) applyThreadToUi(active);
    updateBrandUi();
    renderAll();
  }

  function openSettings() {
    const t = getActiveThread();
    if (t) applyThreadToUi(t);
    openOverlay(settingsOverlay);
  }

  function closeSettings() {
    closeOverlay(settingsOverlay);
  }

  function updateThreadSettingsFromNotebookControls() {
    const t = getActiveThread();
    if (!t) return;
    syncThreadFromUi(t);
    saveThreads();
  }

  function deleteNotebookPageAndRefresh() {
    const t = getActiveThread();
    if (!t) return;
    const page = getActiveNotebookPage(t);
    if (!page) return;
    deleteNotebookPage(t, page.id);
    renderNotebook();
  }

  function refreshAfterSettingsChange() {
    const t = getActiveThread();
    if (!t) return;
    applyThreadToUi(t);
    updateBrandUi();
    renderSidebar();
    renderMessages();
  }

  function updateThreadSettingsAndRender() {
    const t = getActiveThread();
    if (!t) return;
    syncThreadFromUi(t);
    saveThreads();
    updateModeUi();
    updateAvatarElements();
    updateBrandUi();
    renderSidebar();
    renderMessages();
  }

  function noteFromAssistantButtonFlow(msg) {
    const t = getActiveThread();
    if (!t) return;
    const note = buildNotebookNoteFromText(msg.content || '');
    const page = writeNotebookPage(t, 'append_current', note.title, note.content);
    t.settings.activeNotebookPageId = page.id;
    saveThreads();
    renderNotebook();
    openOverlay(notebookOverlay);
    showToast('Đã ghi nhanh từ AI');
  }

  initCurrentThreadUI();

  console.log('Multi-chat + Notebook initialized.');
});