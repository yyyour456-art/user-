/**
 * ============================================================================
 * FILE 4: app.js
 * Complete Working Logic: Auth & 5-Min Anti-Brute Force Lock, E2EE Messaging,
 * 1x View-Once Self-Destruct, Auto-Reply Engine, Stories, Calls, Blue Tick
 * (Google @gmail.com & 10-Digit Mobile Reverse Code), App Disguise & Themes
 * ============================================================================
 */

const AppState = {
  currentUser: null,
  contacts: [],
  messages: {},
  stories: [],
  prefs: {},
  activeChatId: null,
  replyingToMsgId: null,
  selectedContextMsgId: null,
  activeViewOnceMsgId: null,
  isViewOnceMode: false,
  selectedFontId: "standard",
  pendingReverseCode: null,
  pendingMobileNumber: null,
  lockoutInterval: null,
  voiceRecInterval: null,
  voiceRecSeconds: 0,
  callTimerInterval: null,
  callSeconds: 0,
  storyTimerInterval: null
};

/* ============================================================================
 * 1. INITIALIZATION & BOOTSTRAP
 * ============================================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  initDemoStorage();
  await loadCoreData();
  applySavedPreferences();
  bindAuthEvents();
  bindMainNavbarEvents();
  bindChatEvents();
  bindContextMenuEvents();
  bindChatMenuModalEvents();
  bindStoryEvents();
  bindCallEvents();
  bindSettingsModalEvents();
  bindGlobalModalClosers();
  checkLockoutStatus();

  const savedSession = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  if (savedSession) {
    try {
      AppState.currentUser = JSON.parse(savedSession);
      launchMainApp();
    } catch (e) {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }
});

async function loadCoreData() {
  AppState.contacts = await apiCall("/contacts", "GET");
  AppState.messages = await apiCall("/messages", "GET");
  AppState.stories = await apiCall("/stories", "GET");
  AppState.prefs = await apiCall("/prefs", "GET");
}

function showToast(message) {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "toast-item";
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3200);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function getCurrentTimeStr() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* ============================================================================
 * 2. PREFERENCES, DISGUISE MODE (LOGO/NAME), WALLPAPERS & BUBBLE THEMES
 * ============================================================================ */

function applySavedPreferences() {
  const prefs = AppState.prefs || {};

  // Apply Bubble Color Theme on <body>
  document.body.classList.remove(
    "theme-instagram",
    "theme-whatsapp",
    "theme-telegram",
    "theme-cyberpink"
  );
  document.body.classList.add(prefs.bubbleTheme || "theme-instagram");

  // Apply Wallpaper on #chat-screen
  const chatScreen = document.getElementById("chat-screen");
  if (chatScreen) {
    chatScreen.classList.remove(
      "wallpaper-default",
      "wallpaper-midnight",
      "wallpaper-emerald",
      "wallpaper-sunset",
      "wallpaper-royal"
    );
    if (prefs.customWallpaperUrl) {
      chatScreen.style.backgroundImage = `linear-gradient(rgba(9,11,16,0.72), rgba(9,11,16,0.78)), url('${prefs.customWallpaperUrl}')`;
    } else {
      chatScreen.style.backgroundImage = "";
      chatScreen.classList.add(prefs.wallpaper || "wallpaper-default");
    }
  }

  // Apply App Disguise (Name + Logo + Browser Favicon)
  const appName = prefs.customAppName || DISGUISE_PRESETS.default.name;
  const appIcon = prefs.customAppIcon || DISGUISE_PRESETS.default.icon;

  document.getElementById("dynamic-page-title").textContent = appName;
  const favicon = document.getElementById("dynamic-favicon");
  if (favicon) favicon.href = appIcon;

  document.querySelectorAll(".dynamic-app-name").forEach((el) => {
    el.textContent = appName;
  });
  document.querySelectorAll(".dynamic-app-logo").forEach((img) => {
    img.src = appIcon;
  });
}

async function savePreferences() {
  await apiCall("/prefs", "PUT", AppState.prefs);
  applySavedPreferences();
}

/* ============================================================================
 * 3. AUTHENTICATION & 5-MINUTE ANTI-BRUTE FORCE LOCKOUT ENGINE
 * ============================================================================ */

function bindAuthEvents() {
  const authForm = document.getElementById("auth-form");
  const togglePassBtn = document.getElementById("toggle-password-btn");
  const passInput = document.getElementById("auth-password");
  const googleLoginBtn = document.getElementById("google-login-btn");

  // Show/Hide Password Eye Button
  togglePassBtn.addEventListener("click", () => {
    const isPassword = passInput.type === "password";
    passInput.type = isPassword ? "text" : "password";
    togglePassBtn.innerHTML = isPassword
      ? '<i class="ri-eye-line"></i>'
      : '<i class="ri-eye-off-line"></i>';
  });

  // Primary Login / Auto-Register Submit
  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isLockedOut()) return;

    let rawId = document.getElementById("auth-identifier").value.trim();
    const rawPass = passInput.value.trim();

    if (!rawId || !rawPass) {
      showToast("⚠️ Please enter both username/mobile and password.");
      return;
    }

    if (rawId.length > APP_CONFIG.MAX_INPUT_LENGTH || rawPass.length > APP_CONFIG.MAX_INPUT_LENGTH) {
      showToast(`⚠️ Max ${APP_CONFIG.MAX_INPUT_LENGTH} characters allowed.`);
      return;
    }

    const users = await apiCall("/users", "GET");
    const hashedInputPass = hashPassword(rawPass);
    const isMobileLogin = /^[0-9]{10}$/.test(rawId);

    if (isMobileLogin) {
      // Login via Verified 10-Digit Mobile Number
      const matchedUser = users.find(
        (u) => u.verifiedMobile === rawId && u.verified === true
      );
      if (!matchedUser) {
        showToast("🚫 Mobile number not found or not Blue-Tick verified yet!");
        return;
      }
      if (matchedUser.passwordHash !== hashedInputPass) {
        handleFailedLoginAttempt();
        return;
      }
      resetLockoutState();
      loginSuccess(matchedUser);
      return;
    }

    // Normalize @username
    const username = rawId.startsWith("@") ? rawId.toLowerCase() : "@" + rawId.toLowerCase();
    const existingUser = users.find((u) => u.username.toLowerCase() === username);

    if (existingUser) {
      if (existingUser.passwordHash !== hashedInputPass) {
        handleFailedLoginAttempt();
        return;
      }
      resetLockoutState();
      loginSuccess(existingUser);
    } else {
      // Auto-Register New Account
      const cleanName = username.slice(1).replace(/[^a-zA-Z0-9_]/g, "") || "User";
      const newUser = {
        id: "usr_" + Date.now(),
        username: username,
        profileId: "#" + Math.floor(10000 + Math.random() * 90000),
        baseName: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
        stylishName: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
        fontId: "standard",
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`,
        passwordHash: hashedInputPass,
        verified: false,
        verifiedEmail: "",
        verifiedMobile: ""
      };
      users.push(newUser);
      await apiCall("/users", "PUT", users);
      resetLockoutState();
      showToast("🎉 New E2EE Account Auto-Registered!");
      loginSuccess(newUser);
    }
  });

  // Secondary 1-Click Login with Verified Google
  googleLoginBtn.addEventListener("click", async () => {
    if (isLockedOut()) return;
    const users = await apiCall("/users", "GET");
    const googleVerifiedUser = users.find((u) => u.verified && u.verifiedEmail);

    if (googleVerifiedUser) {
      resetLockoutState();
      showToast(`🔵 Logged in via Verified Google (${googleVerifiedUser.verifiedEmail})`);
      loginSuccess(googleVerifiedUser);
    } else {
      // Create or login instant Demo Google Verified account
      const emailInput = prompt(
        "Enter your Official @gmail.com address for 1-Click Verified Login:",
        "alex.architect@gmail.com"
      );
      if (!emailInput) return;

      const validation = validateStrictGmail(emailInput);
      if (!validation.valid) {
        showToast(validation.error);
        return;
      }

      const handle = "@" + validation.cleanEmail.split("@")[0].replace(/[^a-z0-9_]/gi, "").slice(0, 15);
      let user = users.find((u) => u.username === handle);
      if (!user) {
        user = {
          id: "usr_" + Date.now(),
          username: handle,
          profileId: "#" + Math.floor(10000 + Math.random() * 90000),
          baseName: handle.slice(1).toUpperCase(),
          stylishName: STYLISH_FONTS[1].transform(handle.slice(1).toUpperCase()),
          fontId: "serif_bold",
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(handle)}`,
          passwordHash: hashPassword("google_oauth_demo"),
          verified: true,
          verifiedEmail: validation.cleanEmail,
          verifiedMobile: ""
        };
        users.push(user);
      } else {
        user.verified = true;
        user.verifiedEmail = validation.cleanEmail;
      }
      await apiCall("/users", "PUT", users);
      showToast("🔵 Official Google Blue Tick Activated & Logged In!");
      loginSuccess(user);
    }
  });
}

function validateStrictGmail(email) {
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!cleanEmail.endsWith("@gmail.com")) {
    return {
      valid: false,
      error: "🚫 Only official @gmail.com addresses are allowed! Temp-mail & other domains are blocked."
    };
  }
  const localPart = cleanEmail.slice(0, -10);
  if (localPart.includes("+")) {
    return {
      valid: false,
      error: "🚫 Gmail '+' alias tricks (e.g. user+1@gmail.com) are strictly blocked!"
    };
  }
  if (!/^[a-z0-9.]{3,30}$/.test(localPart)) {
    return {
      valid: false,
      error: "🚫 Invalid @gmail.com username format."
    };
  }
  return { valid: true, cleanEmail };
}

function getLockoutData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.LOCKOUT) || '{"attempts":0,"lockUntil":0}');
  } catch (e) {
    return { attempts: 0, lockUntil: 0 };
  }
}

function setLockoutData(data) {
  localStorage.setItem(STORAGE_KEYS.LOCKOUT, JSON.stringify(data));
}

function isLockedOut() {
  const data = getLockoutData();
  return data.lockUntil > Date.now();
}

function handleFailedLoginAttempt() {
  const data = getLockoutData();
  data.attempts += 1;

  const remaining = APP_CONFIG.MAX_LOGIN_ATTEMPTS - data.attempts;
  if (data.attempts >= APP_CONFIG.MAX_LOGIN_ATTEMPTS) {
    data.lockUntil = Date.now() + APP_CONFIG.LOCKOUT_TIME_SECONDS * 1000;
    setLockoutData(data);
    showToast("🔒 3 failed attempts! Anti-Brute Force Lock activated for 5 minutes.");
    checkLockoutStatus();
  } else {
    setLockoutData(data);
    showToast(`❌ Wrong password! ${remaining} attempt(s) left before 5-min lockout.`);
  }
}

function resetLockoutState() {
  setLockoutData({ attempts: 0, lockUntil: 0 });
  checkLockoutStatus();
}

function checkLockoutStatus() {
  const lockBox = document.getElementById("lockout-box");
  const timerEl = document.getElementById("lockout-timer");
  const idInput = document.getElementById("auth-identifier");
  const passInput = document.getElementById("auth-password");
  const submitBtn = document.getElementById("auth-submit-btn");
  const googleBtn = document.getElementById("google-login-btn");

  if (AppState.lockoutInterval) {
    clearInterval(AppState.lockoutInterval);
    AppState.lockoutInterval = null;
  }

  const updateTick = () => {
    const data = getLockoutData();
    const diffSec = Math.ceil((data.lockUntil - Date.now()) / 1000);

    if (diffSec <= 0) {
      if (data.lockUntil > 0) {
        setLockoutData({ attempts: 0, lockUntil: 0 });
      }
      lockBox.classList.add("hidden");
      idInput.disabled = false;
      passInput.disabled = false;
      submitBtn.disabled = false;
      googleBtn.disabled = false;
      if (AppState.lockoutInterval) {
        clearInterval(AppState.lockoutInterval);
        AppState.lockoutInterval = null;
      }
      return;
    }

    lockBox.classList.remove("hidden");
    idInput.disabled = true;
    passInput.disabled = true;
    submitBtn.disabled = true;
    googleBtn.disabled = true;

    const mins = String(Math.floor(diffSec / 60)).padStart(2, "0");
    const secs = String(diffSec % 60).padStart(2, "0");
    timerEl.textContent = `${mins}:${secs}`;
  };

  updateTick();
  if (isLockedOut()) {
    AppState.lockoutInterval = setInterval(updateTick, 1000);
  }
}

function loginSuccess(user) {
  AppState.currentUser = user;
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  launchMainApp();
}

function launchMainApp() {
  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("main-app").classList.remove("hidden");

  updateNavbarProfileUI();
  renderStoriesBar();
  renderChatList();
  renderNotificationsList();
}

function updateNavbarProfileUI() {
  const user = AppState.currentUser;
  if (!user) return;

  document.getElementById("nav-current-user").textContent = `${user.username} • ${user.profileId}`;
  const verifiedBadge = document.getElementById("nav-user-verified");
  if (user.verified) {
    verifiedBadge.classList.remove("hidden");
  } else {
    verifiedBadge.classList.add("hidden");
  }
}

/* ============================================================================
 * 4. NAVBAR, USER SEARCH (@username / #ProfileID) & INBOX LIST
 * ============================================================================ */

function bindMainNavbarEvents() {
  const searchBtn = document.getElementById("nav-search-btn");
  const searchInput = document.getElementById("user-search-input");
  const clearSearchBtn = document.getElementById("clear-search-btn");
  const notifBtn = document.getElementById("nav-notif-btn");
  const settingsBtn = document.getElementById("nav-settings-btn");

  searchBtn.addEventListener("click", () => {
    searchInput.focus();
  });

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim();
    clearSearchBtn.classList.toggle("hidden", !query);
    renderChatList(query);
  });

  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    clearSearchBtn.classList.add("hidden");
    renderChatList("");
  });

  notifBtn.addEventListener("click", () => {
    document.getElementById("notif-badge").classList.add("hidden");
    openModal("notifications-modal");
  });

  settingsBtn.addEventListener("click", () => {
    populateSettingsModal();
    openModal("settings-modal");
  });
}

function renderChatList(searchQuery = "") {
  const listEl = document.getElementById("chat-list");
  listEl.innerHTML = "";

  const q = searchQuery.toLowerCase().trim();

  // Sort: Pinned Broadcast first, then others
  const sortedContacts = [...AppState.contacts].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  const filtered = sortedContacts.filter((c) => {
    if (!q) return true;
    return (
      c.username.toLowerCase().includes(q) ||
      c.profileId.toLowerCase().includes(q) ||
      c.stylishName.toLowerCase().includes(q)
    );
  });

  filtered.forEach((contact) => {
    const chatMsgs = AppState.messages[contact.id] || [];
    const lastMsgObj = chatMsgs[chatMsgs.length - 1];

    let lastMsgPreview = contact.bio || "Tap to start E2EE chat";
    let lastMsgTime = "";

    if (lastMsgObj) {
      lastMsgTime = lastMsgObj.time || "";
      if (lastMsgObj.viewOnce) {
        lastMsgPreview = lastMsgObj.viewed
          ? "🔥 View-Once message expired"
          : "1x 🔥 View-Once Secret Message";
      } else if (lastMsgObj.voiceDuration) {
        lastMsgPreview = `🎤 Voice Note (${lastMsgObj.voiceDuration})`;
      } else if (lastMsgObj.attachment) {
        lastMsgPreview = `📎 ${lastMsgObj.attachment.name}`;
      } else {
        lastMsgPreview = decryptText(lastMsgObj.text);
      }
    }

    const item = document.createElement("div");
    item.className = `chat-item ${contact.pinned ? "pinned" : ""} ${
      AppState.activeChatId === contact.id ? "active" : ""
    }`;

    item.innerHTML = `
      <div class="chat-item-avatar-wrap">
        <img src="${contact.avatar}" alt="DP" class="chat-item-dp" />
        ${contact.online ? '<span class="online-dot"></span>' : ""}
      </div>
      <div class="chat-item-body">
        <div class="chat-item-top">
          <div class="chat-item-name-wrap">
            <span class="chat-item-name">${escapeHtml(contact.stylishName)}</span>
            ${
              contact.verified
                ? '<span class="verified-badge" title="Official Blue Tick"><i class="ri-verified-badge-fill"></i></span>'
                : ""
            }
          </div>
          <span class="chat-item-time">${escapeHtml(lastMsgTime)}</span>
        </div>
        <div class="chat-item-bottom">
          <p class="chat-item-lastmsg">${escapeHtml(lastMsgPreview)}</p>
          <div class="chat-item-badges">
            ${contact.pinned ? '<i class="ri-pushpin-2-fill pin-icon" title="Pinned"></i>' : ""}
            ${
              contact.unread > 0
                ? `<span class="unread-badge">${contact.unread}</span>`
                : ""
            }
          </div>
        </div>
      </div>
    `;

    item.addEventListener("click", () => {
      openChatWindow(contact.id);
    });

    listEl.appendChild(item);
  });

  // Allow instant chat creation if user searches a new @username or #ProfileID
  if (q && filtered.length === 0 && (q.startsWith("@") || q.startsWith("#"))) {
    const createCard = document.createElement("div");
    createCard.className = "chat-item";
    createCard.innerHTML = `
      <div class="chat-item-body">
        <div class="chat-item-top">
          <span class="chat-item-name">➕ Start New E2EE Chat with "${escapeHtml(searchQuery)}"</span>
        </div>
        <p class="chat-item-lastmsg">Click to add user via Global Directory &amp; open encrypted tunnel</p>
      </div>
    `;
    createCard.addEventListener("click", async () => {
      const isId = q.startsWith("#");
      const newHandle = isId ? "@user_" + q.slice(1) : q;
      const newProfId = isId ? q : "#" + Math.floor(10000 + Math.random() * 90000);
      const newContact = {
        id: "contact_" + Date.now(),
        username: newHandle,
        profileId: newProfId,
        stylishName: newHandle.slice(1).toUpperCase(),
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(newHandle)}`,
        verified: false,
        pinned: false,
        isBroadcast: false,
        online: true,
        blocked: false,
        bio: "Connected via Global Directory",
        unread: 0
      };
      AppState.contacts.push(newContact);
      AppState.messages[newContact.id] = [];
      await apiCall("/contacts", "PUT", AppState.contacts);
      await apiCall("/messages", "PUT", AppState.messages);
      document.getElementById("user-search-input").value = "";
      document.getElementById("clear-search-btn").classList.add("hidden");
      renderChatList("");
      openChatWindow(newContact.id);
    });
    listEl.appendChild(createCard);
  }
}

/* ============================================================================
 * 5. FULL CHAT WINDOW, MESSAGING ENGINE, AUTO-LINKS & 1x VIEW-ONCE
 * ============================================================================ */

async function openChatWindow(contactId) {
  const contact = AppState.contacts.find((c) => c.id === contactId);
  if (!contact) return;

  AppState.activeChatId = contactId;
  AppState.replyingToMsgId = null;
  document.getElementById("reply-preview-bar").classList.add("hidden");

  // Clear unread count
  if (contact.unread > 0) {
    contact.unread = 0;
    await apiCall("/contacts", "PUT", AppState.contacts);
  }

  // Update mobile & desktop views
  document.getElementById("main-app").classList.add("mobile-chat-open");
  document.getElementById("empty-chat-placeholder").classList.add("hidden");
  document.getElementById("chat-screen").classList.remove("hidden");

  // Populate Chat Header
  document.getElementById("chat-header-avatar").src = contact.avatar;
  document.getElementById("chat-header-name").textContent = contact.stylishName;
  document.getElementById("chat-header-verified").classList.toggle("hidden", !contact.verified);
  document.getElementById("chat-header-online-dot").classList.toggle("hidden", !contact.online);
  document.getElementById("chat-header-status").textContent = contact.isBroadcast
    ? `Official Channel • ${contact.profileId}`
    : contact.online
    ? `Online • ${contact.username} (${contact.profileId})`
    : `Last seen recently • ${contact.profileId}`;

  updateBlockedUI(contact);
  renderChatList(document.getElementById("user-search-input").value);
  renderMessages();
}

function updateBlockedUI(contact) {
  const blockedBanner = document.getElementById("blocked-banner");
  const inputBar = document.getElementById("chat-input-bar");
  const blockBtnText = document.getElementById("block-user-btn-text");

  if (contact.blocked) {
    blockedBanner.classList.remove("hidden");
    inputBar.classList.add("hidden");
    if (blockBtnText) blockBtnText.textContent = "Unblock User";
  } else {
    blockedBanner.classList.add("hidden");
    inputBar.classList.remove("hidden");
    if (blockBtnText) blockBtnText.textContent = "Block User";
  }
}

function renderMessages() {
  const area = document.getElementById("messages-area");
  area.innerHTML = "";

  const chatMsgs = AppState.messages[AppState.activeChatId] || [];

  chatMsgs.forEach((msg) => {
    const row = document.createElement("div");
    row.className = `msg-row ${msg.sender === "me" ? "me" : "them"}`;

    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";

    // 1. Reply Quote Block
    if (msg.replyTo) {
      const quoteDiv = document.createElement("div");
      quoteDiv.className = "msg-reply-quote";
      quoteDiv.textContent = msg.replyTo;
      bubble.appendChild(quoteDiv);
    }

    // 2. View-Once (1x 🔥) Secret Logic
    if (msg.viewOnce) {
      if (msg.viewed) {
        const expDiv = document.createElement("div");
        expDiv.className = "msg-view-once-expired";
        expDiv.textContent = "🔥 View-Once message expired";
        bubble.appendChild(expDiv);
      } else {
        const voCard = document.createElement("div");
        voCard.className = "msg-view-once-card";
        voCard.innerHTML = `<span>1x 🔥</span> <span>Tap to view secret message once</span>`;
        voCard.addEventListener("click", (e) => {
          e.stopPropagation();
          openViewOnceSecretModal(msg);
        });
        bubble.appendChild(voCard);
      }
    } else {
      // 3. Attachments (Images or Downloadable Files)
      if (msg.attachment) {
        const attWrap = document.createElement("div");
        attWrap.className = "msg-attachment-card";

        if (msg.attachment.isImage) {
          attWrap.innerHTML = `
            <img src="${msg.attachment.dataUrl}" alt="${escapeHtml(msg.attachment.name)}" class="msg-image-preview" />
          `;
        } else {
          attWrap.innerHTML = `
            <div class="msg-file-card">
              <i class="ri-file-shield-2-fill"></i>
              <div class="msg-file-info">
                <div class="msg-file-name">${escapeHtml(msg.attachment.name)}</div>
                <small>${escapeHtml(msg.attachment.size || "Encrypted File")}</small>
              </div>
              <a href="${msg.attachment.dataUrl}" download="${escapeHtml(msg.attachment.name)}" class="msg-download-link">Download</a>
            </div>
          `;
        }
        bubble.appendChild(attWrap);
      }

      // 4. Voice Note Player
      if (msg.voiceDuration) {
        const voiceDiv = document.createElement("div");
        voiceDiv.className = "msg-voice-note";
        voiceDiv.innerHTML = `
          <button type="button" class="voice-play-btn"><i class="ri-play-fill"></i></button>
          <div class="voice-waveform"><div class="voice-waveform-fill"></div></div>
          <small>${escapeHtml(msg.voiceDuration)}</small>
        `;
        const playBtn = voiceDiv.querySelector(".voice-play-btn");
        const fillBar = voiceDiv.querySelector(".voice-waveform-fill");
        playBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          playBtn.innerHTML = '<i class="ri-volume-up-fill"></i>';
          fillBar.style.width = "100%";
          setTimeout(() => {
            playBtn.innerHTML = '<i class="ri-play-fill"></i>';
            fillBar.style.width = "0%";
          }, 2200);
        });
        bubble.appendChild(voiceDiv);
      }

      // 5. Unlimited Text + Auto-Detected Clickable URLs
      const plainText = decryptText(msg.text);
      if (plainText) {
        const textDiv = document.createElement("div");
        textDiv.className = "msg-text";
        textDiv.textContent = plainText;
        bubble.appendChild(textDiv);

        const urls = extractUrls(plainText);
        urls.forEach((url) => {
          const linkBtn = document.createElement("a");
          linkBtn.href = url;
          linkBtn.target = "_blank";
          linkBtn.rel = "noopener noreferrer";
          linkBtn.className = "msg-link-btn";
          linkBtn.innerHTML = `🔗 Open Link (${escapeHtml(new URL(url).hostname)})`;
          linkBtn.addEventListener("click", (e) => e.stopPropagation());
          bubble.appendChild(linkBtn);
        });
      }
    }

    // 6. Timestamp + Read Receipt Tick
    const meta = document.createElement("div");
    meta.className = "msg-meta";
    meta.innerHTML = `
      <span>${escapeHtml(msg.time || "")}</span>
      ${
        msg.sender === "me"
          ? `<i class="ri-check-double-line msg-status-icon" title="E2EE Delivered & Read"></i>`
          : ""
      }
    `;
    bubble.appendChild(meta);

    // Open Message Context Menu on Click
    bubble.addEventListener("click", () => {
      AppState.selectedContextMsgId = msg.id;
      openModal("msg-context-modal");
    });

    row.appendChild(bubble);

    // 7. Emoji Reactions Pill Bar
    if (msg.reactions && msg.reactions.length > 0) {
      const reactBar = document.createElement("div");
      reactBar.className = "msg-reactions-bar";
      msg.reactions.forEach((em) => {
        const pill = document.createElement("span");
        pill.className = "msg-reaction-pill";
        pill.textContent = em;
        reactBar.appendChild(pill);
      });
      row.appendChild(reactBar);
    }

    area.appendChild(row);
  });

  area.scrollTop = area.scrollHeight;
}

function extractUrls(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

function bindChatEvents() {
  const backBtn = document.getElementById("chat-back-btn");
  const msgInput = document.getElementById("message-input");
  const sendBtn = document.getElementById("send-msg-btn");
  const viewOnceBtn = document.getElementById("view-once-toggle");
  const attachBtn = document.getElementById("attach-file-btn");
  const fileInput = document.getElementById("file-attachment-input");
  const cancelReplyBtn = document.getElementById("cancel-reply-btn");
  const unblockBannerBtn = document.getElementById("unblock-banner-btn");
  const closeViewOnceBtn = document.getElementById("close-view-once-btn");

  // Voice Note Controls
  const voiceBtn = document.getElementById("voice-note-btn");
  const cancelVoiceBtn = document.getElementById("cancel-voice-btn");
  const finishVoiceBtn = document.getElementById("finish-voice-btn");

  backBtn.addEventListener("click", () => {
    document.getElementById("main-app").classList.remove("mobile-chat-open");
  });

  // Auto-resize unlimited textarea
  msgInput.addEventListener("input", () => {
    msgInput.style.height = "auto";
    msgInput.style.height = Math.min(msgInput.scrollHeight, 130) + "px";
  });

  // Enter to send (Shift+Enter for new line)
  msgInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendCurrentMessage();
    }
  });

  sendBtn.addEventListener("click", () => {
    sendCurrentMessage();
  });

  // Toggle 1x View-Once Mode
  viewOnceBtn.addEventListener("click", () => {
    AppState.isViewOnceMode = !AppState.isViewOnceMode;
    viewOnceBtn.classList.toggle("active", AppState.isViewOnceMode);
    showToast(
      AppState.isViewOnceMode
        ? "1x 🔥 View-Once Mode ON: Next message will self-destruct after 1 view!"
        : "1x View-Once Mode OFF"
    );
  });

  // File / Image Attachment
  attachBtn.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file || !AppState.activeChatId) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const isImage = file.type.startsWith("image/");
      const sizeKB = Math.round(file.size / 1024) + " KB";
      await pushMessageToActiveChat({
        text: msgInput.value.trim(),
        attachment: {
          name: file.name,
          size: sizeKB,
          isImage,
          dataUrl: ev.target.result
        }
      });
      msgInput.value = "";
      fileInput.value = "";
    };
    reader.readAsDataURL(file);
  });

  cancelReplyBtn.addEventListener("click", () => {
    AppState.replyingToMsgId = null;
    document.getElementById("reply-preview-bar").classList.add("hidden");
  });

  unblockBannerBtn.addEventListener("click", async () => {
    const contact = AppState.contacts.find((c) => c.id === AppState.activeChatId);
    if (!contact) return;
    contact.blocked = false;
    await apiCall("/contacts", "PUT", AppState.contacts);
    updateBlockedUI(contact);
    showToast(`✅ Unblocked ${contact.stylishName}`);
  });

  // Close 1x View-Once Modal & Permanently Destroy Message
  closeViewOnceBtn.addEventListener("click", async () => {
    if (AppState.activeViewOnceMsgId && AppState.activeChatId) {
      const chatMsgs = AppState.messages[AppState.activeChatId] || [];
      const target = chatMsgs.find((m) => m.id === AppState.activeViewOnceMsgId);
      if (target) {
        target.viewed = true;
        target.text = encryptText("🔥 View-Once message expired");
        target.attachment = null;
        await apiCall("/messages", "PUT", AppState.messages);
      }
    }
    AppState.activeViewOnceMsgId = null;
    closeModal("view-once-modal");
    renderMessages();
    renderChatList(document.getElementById("user-search-input").value);
    showToast("🔥 Secret 1x message permanently destroyed!");
  });

  // Simulated Voice Note Recorder
  voiceBtn.addEventListener("click", () => {
    const recBar = document.getElementById("voice-recording-bar");
    const timerEl = document.getElementById("voice-rec-timer");
    recBar.classList.remove("hidden");
    AppState.voiceRecSeconds = 0;
    timerEl.textContent = "00:00";

    if (AppState.voiceRecInterval) clearInterval(AppState.voiceRecInterval);
    AppState.voiceRecInterval = setInterval(() => {
      AppState.voiceRecSeconds += 1;
      const m = String(Math.floor(AppState.voiceRecSeconds / 60)).padStart(2, "0");
      const s = String(AppState.voiceRecSeconds % 60).padStart(2, "0");
      timerEl.textContent = `${m}:${s}`;
    }, 1000);
  });

  cancelVoiceBtn.addEventListener("click", () => {
    clearInterval(AppState.voiceRecInterval);
    document.getElementById("voice-recording-bar").classList.add("hidden");
  });

  finishVoiceBtn.addEventListener("click", async () => {
    clearInterval(AppState.voiceRecInterval);
    const duration = document.getElementById("voice-rec-timer").textContent;
    document.getElementById("voice-recording-bar").classList.add("hidden");
    await pushMessageToActiveChat({
      text: "",
      voiceDuration: duration === "00:00" ? "00:03" : duration
    });
  });
}

async function sendCurrentMessage() {
  const msgInput = document.getElementById("message-input");
  const rawText = msgInput.value.trim();
  if (!rawText || !AppState.activeChatId) return;

  await pushMessageToActiveChat({ text: rawText });
  msgInput.value = "";
  msgInput.style.height = "auto";
}

async function pushMessageToActiveChat({ text = "", attachment = null, voiceDuration = null }) {
  const contactId = AppState.activeChatId;
  if (!contactId) return;

  const chatMsgs = AppState.messages[contactId] || [];
  let replyQuoteText = null;

  if (AppState.replyingToMsgId) {
    const orig = chatMsgs.find((m) => m.id === AppState.replyingToMsgId);
    if (orig) {
      replyQuoteText = orig.viewOnce
        ? "1x Secret Message"
        : decryptText(orig.text).slice(0, 70);
    }
  }

  const newMsg = {
    id: "msg_" + Date.now(),
    sender: "me",
    text: encryptText(text),
    time: getCurrentTimeStr(),
    status: "read",
    reactions: [],
    viewOnce: AppState.isViewOnceMode,
    viewed: false,
    replyTo: replyQuoteText,
    attachment,
    voiceDuration
  };

  chatMsgs.push(newMsg);
  AppState.messages[contactId] = chatMsgs;

  // Reset states
  AppState.isViewOnceMode = false;
  document.getElementById("view-once-toggle").classList.remove("active");
  AppState.replyingToMsgId = null;
  document.getElementById("reply-preview-bar").classList.add("hidden");

  await apiCall("/messages", "PUT", AppState.messages);
  renderMessages();
  renderChatList(document.getElementById("user-search-input").value);

  // Trigger Realistic Friend Auto-Reply ("Typing..." -> Message -> Blue Tick)
  triggerRealisticAutoReply(contactId, text);
}

function openViewOnceSecretModal(msg) {
  AppState.activeViewOnceMsgId = msg.id;
  const box = document.getElementById("view-once-content-box");
  box.innerHTML = "";

  if (msg.attachment && msg.attachment.isImage) {
    const img = document.createElement("img");
    img.src = msg.attachment.dataUrl;
    img.className = "msg-image-preview";
    img.style.margin = "0 auto 10px";
    box.appendChild(img);
  }

  const p = document.createElement("p");
  p.textContent = decryptText(msg.text) || "🔒 Encrypted Secret Media";
  box.appendChild(p);

  openModal("view-once-modal");
}

function triggerRealisticAutoReply(contactId, userText) {
  const contact = AppState.contacts.find((c) => c.id === contactId);
  if (!contact || contact.isBroadcast || contact.blocked) return;

  const statusEl = document.getElementById("chat-header-status");
  if (AppState.activeChatId === contactId) {
    statusEl.textContent = "Typing encrypted reply...";
  }

  setTimeout(async () => {
    const replies = [
      "🔒 Got your AES-256 encrypted message loud and clear! 🚀",
      "That sounds awesome! Let's hop on an E2EE call soon.",
      "Just checked it! By the way, the new bubble theme looks super clean ✨",
      "100% agreed! Send me a 1x View-Once message if it's confidential 🔥",
      "Look at https://developer.mozilla.org — I was just reading about WebCrypto APIs!"
    ];
    const chosenReply = userText.toLowerCase().includes("hello") || userText.toLowerCase().includes("hi")
      ? `Hey ${AppState.currentUser ? AppState.currentUser.stylishName : "friend"}! How's it going? 😊`
      : replies[Math.floor(Math.random() * replies.length)];

    const replyMsg = {
      id: "msg_" + Date.now(),
      sender: "them",
      text: encryptText(chosenReply),
      time: getCurrentTimeStr(),
      status: "read",
      reactions: [],
      viewOnce: false,
      viewed: false,
      replyTo: null,
      attachment: null
    };

    if (!AppState.messages[contactId]) AppState.messages[contactId] = [];
    AppState.messages[contactId].push(replyMsg);
    await apiCall("/messages", "PUT", AppState.messages);

    if (AppState.activeChatId === contactId) {
      statusEl.textContent = `Online • ${contact.username} (${contact.profileId})`;
      renderMessages();
    } else {
      contact.unread = (contact.unread || 0) + 1;
      await apiCall("/contacts", "PUT", AppState.contacts);
    }
    renderChatList(document.getElementById("user-search-input").value);
  }, 1600);
}

/* ============================================================================
 * 6. MESSAGE CONTEXT MENU ACTIONS (REACT, REPLY, COPY, FORWARD, SHARE, DELETE)
 * ============================================================================ */

function bindContextMenuEvents() {
  // Emoji Reactions
  document.querySelectorAll(".react-emoji-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const emoji = btn.getAttribute("data-emoji");
      const msg = getSelectedMessage();
      if (!msg) return;
      if (!msg.reactions) msg.reactions = [];
      if (msg.reactions.includes(emoji)) {
        msg.reactions = msg.reactions.filter((r) => r !== emoji);
      } else {
        msg.reactions.push(emoji);
      }
      await apiCall("/messages", "PUT", AppState.messages);
      closeModal("msg-context-modal");
      renderMessages();
    });
  });

  // Reply
  document.getElementById("ctx-reply-btn").addEventListener("click", () => {
    const msg = getSelectedMessage();
    if (!msg) return;
    AppState.replyingToMsgId = msg.id;
    document.getElementById("reply-preview-text").textContent = msg.viewOnce
      ? "1x 🔥 Secret Message"
      : decryptText(msg.text);
    document.getElementById("reply-preview-bar").classList.remove("hidden");
    closeModal("msg-context-modal");
    document.getElementById("message-input").focus();
  });

  // Copy
  document.getElementById("ctx-copy-btn").addEventListener("click", () => {
    const msg = getSelectedMessage();
    if (!msg) return;
    const text = msg.viewOnce ? "[1x Secret Message]" : decryptText(msg.text);
    navigator.clipboard?.writeText(text);
    closeModal("msg-context-modal");
    showToast("📋 Message copied to clipboard!");
  });

  // Forward (Open Contact Picker)
  document.getElementById("ctx-forward-btn").addEventListener("click", () => {
    closeModal("msg-context-modal");
    renderForwardContactPicker();
    openModal("forward-modal");
  });

  // Share
  document.getElementById("ctx-share-btn").addEventListener("click", async () => {
    const msg = getSelectedMessage();
    if (!msg) return;
    const text = decryptText(msg.text);
    closeModal("msg-context-modal");
    if (navigator.share) {
      try {
        await navigator.share({ title: "Encrypted Message", text });
      } catch (e) {}
    } else {
      navigator.clipboard?.writeText(text);
      showToast("🔗 Share text copied to clipboard!");
    }
  });

  // Delete for Everyone
  document.getElementById("ctx-delete-btn").addEventListener("click", async () => {
    if (!AppState.activeChatId || !AppState.selectedContextMsgId) return;
    AppState.messages[AppState.activeChatId] = (
      AppState.messages[AppState.activeChatId] || []
    ).filter((m) => m.id !== AppState.selectedContextMsgId);

    await apiCall("/messages", "PUT", AppState.messages);
    closeModal("msg-context-modal");
    renderMessages();
    renderChatList(document.getElementById("user-search-input").value);
    showToast("🗑️ Message deleted for everyone.");
  });
}

function getSelectedMessage() {
  if (!AppState.activeChatId || !AppState.selectedContextMsgId) return null;
  const list = AppState.messages[AppState.activeChatId] || [];
  return list.find((m) => m.id === AppState.selectedContextMsgId) || null;
}

function renderForwardContactPicker() {
  const container = document.getElementById("forward-contacts-list");
  container.innerHTML = "";
  const msg = getSelectedMessage();
  if (!msg) return;

  AppState.contacts.forEach((c) => {
    const row = document.createElement("div");
    row.className = "forward-contact-item";
    row.innerHTML = `
      <div class="chat-item-name-wrap">
        <img src="${c.avatar}" alt="DP" style="width:32px;height:32px;border-radius:50%;margin-right:8px;" />
        <span>${escapeHtml(c.stylishName)}</span>
      </div>
      <button type="button" class="btn-xs-success">Send ➤</button>
    `;
    row.querySelector("button").addEventListener("click", async () => {
      if (!AppState.messages[c.id]) AppState.messages[c.id] = [];
      AppState.messages[c.id].push({
        id: "msg_" + Date.now(),
        sender: "me",
        text: msg.text,
        time: getCurrentTimeStr(),
        status: "read",
        reactions: [],
        viewOnce: false,
        viewed: false,
        replyTo: "↪ Forwarded Message",
        attachment: msg.attachment || null
      });
      await apiCall("/messages", "PUT", AppState.messages);
      closeModal("forward-modal");
      showToast(`↪ Forwarded to ${c.stylishName}`);
      openChatWindow(c.id);
    });
    container.appendChild(row);
  });
}

/* ============================================================================
 * 7. 3-DOT CHAT MENU: WALLPAPERS, BUBBLE THEMES, CLEAR & BLOCK USER
 * ============================================================================ */

function bindChatMenuModalEvents() {
  document.getElementById("chat-menu-btn").addEventListener("click", () => {
    openModal("chat-menu-modal");
  });

  // 4 Bubble Color Themes
  document.querySelectorAll(".bubble-theme-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const theme = btn.getAttribute("data-theme");
      AppState.prefs.bubbleTheme = theme;
      await savePreferences();
      showToast("🎨 Bubble color theme updated!");
    });
  });

  // 5 Chat Wallpapers
  document.querySelectorAll(".wallpaper-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const wp = btn.getAttribute("data-wallpaper");
      AppState.prefs.wallpaper = wp;
      AppState.prefs.customWallpaperUrl = "";
      await savePreferences();
      showToast("🖼️ Chat wallpaper preset applied!");
    });
  });

  // Custom Wallpaper Upload
  const wpUploadBtn = document.getElementById("upload-wallpaper-btn");
  const wpInput = document.getElementById("custom-wallpaper-input");

  wpUploadBtn.addEventListener("click", () => wpInput.click());
  wpInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      AppState.prefs.customWallpaperUrl = ev.target.result;
      await savePreferences();
      showToast("🖼️ Custom wallpaper image uploaded!");
    };
    reader.readAsDataURL(file);
  });

  // Clear Chat History
  document.getElementById("clear-chat-btn").addEventListener("click", async () => {
    if (!AppState.activeChatId) return;
    AppState.messages[AppState.activeChatId] = [];
    await apiCall("/messages", "PUT", AppState.messages);
    closeModal("chat-menu-modal");
    renderMessages();
    renderChatList();
    showToast("🧹 Chat history cleared.");
  });

  // Block / Unblock Contact
  document.getElementById("block-user-btn").addEventListener("click", async () => {
    const contact = AppState.contacts.find((c) => c.id === AppState.activeChatId);
    if (!contact) return;
    contact.blocked = !contact.blocked;
    await apiCall("/contacts", "PUT", AppState.contacts);
    updateBlockedUI(contact);
    closeModal("chat-menu-modal");
    showToast(
      contact.blocked
        ? `🚫 Blocked ${contact.stylishName}`
        : `✅ Unblocked ${contact.stylishName}`
    );
  });
}

/* ============================================================================
 * 8. 24-HOUR STORIES BAR, STORY VIEWER & STORY CREATOR
 * ============================================================================ */

function renderStoriesBar() {
  const bar = document.getElementById("stories-bar");
  bar.innerHTML = "";

  // "+ Add Story" Button
  const addItem = document.createElement("div");
  addItem.className = "story-item";
  const myAvatar = AppState.currentUser
    ? AppState.currentUser.avatar
    : "https://api.dicebear.com/7.x/avataaars/svg?seed=Me";
  addItem.innerHTML = `
    <div class="story-ring add-story">
      <img src="${myAvatar}" alt="Add" class="story-avatar" />
      <span class="story-plus-badge">+</span>
    </div>
    <span class="story-username">Add Story</span>
  `;
  addItem.addEventListener("click", () => {
    openModal("story-creator-modal");
  });
  bar.appendChild(addItem);

  // Friends' & User's Active 24h Stories
  AppState.stories.forEach((story) => {
    const item = document.createElement("div");
    item.className = "story-item";
    item.innerHTML = `
      <div class="story-ring ${story.seen ? "seen" : ""}">
        <img src="${story.avatar}" alt="Story" class="story-avatar" />
      </div>
      <span class="story-username">${escapeHtml(story.stylishName)}</span>
    `;
    item.addEventListener("click", () => {
      openStoryViewer(story);
    });
    bar.appendChild(item);
  });
}

function openStoryViewer(story) {
  story.seen = true;
  if (AppState.currentUser && !story.seenBy.includes(AppState.currentUser.username)) {
    story.seenBy.push(AppState.currentUser.username);
  }
  apiCall("/stories", "PUT", AppState.stories);
  renderStoriesBar();

  document.getElementById("story-view-avatar").src = story.avatar;
  document.getElementById("story-view-name").textContent = story.stylishName;
  document.getElementById("story-view-verified").classList.toggle("hidden", !story.verified);
  document.getElementById("story-view-time").textContent = "24h Encrypted Story";
  document.getElementById("story-seen-by-list").textContent =
    story.seenBy.length > 0 ? story.seenBy.join(", ") : "Just you";

  const stage = document.getElementById("story-stage-content");
  stage.innerHTML = "";
  stage.style.background = story.bgGradient || "linear-gradient(135deg, #833ab4, #fd1d1d)";

  if (story.imageUrl) {
    const img = document.createElement("img");
    img.src = story.imageUrl;
    stage.appendChild(img);
  } else {
    const p = document.createElement("p");
    p.textContent = story.content;
    stage.appendChild(p);
  }

  openModal("story-viewer-modal");

  const progressFill = document.getElementById("story-progress-bar");
  progressFill.style.width = "0%";
  let progress = 0;

  if (AppState.storyTimerInterval) clearInterval(AppState.storyTimerInterval);
  AppState.storyTimerInterval = setInterval(() => {
    progress += 2;
    progressFill.style.width = `${progress}%`;
    if (progress >= 100) {
      clearInterval(AppState.storyTimerInterval);
      closeModal("story-viewer-modal");
    }
  }, 100);
}

function bindStoryEvents() {
  const publishBtn = document.getElementById("publish-story-btn");
  const textInput = document.getElementById("story-text-input");
  const imgInput = document.getElementById("story-image-input");

  publishBtn.addEventListener("click", () => {
    const text = textInput.value.trim();
    const file = imgInput.files[0];

    if (!text && !file) {
      showToast("⚠️ Enter story caption or select a photo.");
      return;
    }

    const saveStoryObj = async (imageUrl = "") => {
      const user = AppState.currentUser;
      const newStory = {
        id: "story_" + Date.now(),
        userId: user.id,
        username: user.username,
        stylishName: user.stylishName,
        avatar: user.avatar,
        verified: user.verified,
        type: imageUrl ? "image" : "text",
        content: text || "✨ New Story Update",
        imageUrl,
        bgGradient: "linear-gradient(135deg, #7928ca, #ff0080)",
        timestamp: Date.now(),
        seenBy: ["@arjun_dev", "@priya_verma"]
      };
      AppState.stories.unshift(newStory);
      await apiCall("/stories", "PUT", AppState.stories);
      textInput.value = "";
      imgInput.value = "";
      closeModal("story-creator-modal");
      renderStoriesBar();
      showToast("✨ 24-Hour Story Published!");
    };

    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => saveStoryObj(e.target.result);
      reader.readAsDataURL(file);
    } else {
      saveStoryObj("");
    }
  });
}

/* ============================================================================
 * 9. AUDIO & VIDEO CALL OVERLAY ENGINE
 * ============================================================================ */

function bindCallEvents() {
  const audioBtn = document.getElementById("audio-call-btn");
  const videoBtn = document.getElementById("video-call-btn");
  const muteBtn = document.getElementById("call-mute-btn");
  const camBtn = document.getElementById("call-camera-btn");
  const screenBtn = document.getElementById("call-screen-btn");
  const endBtn = document.getElementById("call-end-btn");

  audioBtn.addEventListener("click", () => startCallSession(false));
  videoBtn.addEventListener("click", () => startCallSession(true));

  muteBtn.addEventListener("click", () => {
    muteBtn.classList.toggle("active-toggle");
    showToast(muteBtn.classList.contains("active-toggle") ? "🔇 Microphone Muted" : "🎙️ Microphone Unmuted");
  });

  camBtn.addEventListener("click", () => {
    camBtn.classList.toggle("active-toggle");
    const vidStage = document.getElementById("call-video-preview");
    vidStage.classList.toggle("hidden", !camBtn.classList.contains("active-toggle"));
    document.getElementById("video-stage-text").textContent = "📹 HD Encrypted Camera Stream Active";
  });

  screenBtn.addEventListener("click", () => {
    screenBtn.classList.toggle("active-toggle");
    const vidStage = document.getElementById("call-video-preview");
    vidStage.classList.toggle("hidden", !screenBtn.classList.contains("active-toggle"));
    document.getElementById("video-stage-text").textContent = "🖥️ Encrypted Screen Share Active";
  });

  endBtn.addEventListener("click", () => {
    clearInterval(AppState.callTimerInterval);
    document.getElementById("call-overlay").classList.add("hidden");
    showToast("📞 E2EE Call Ended.");
  });
}

function startCallSession(isVideo) {
  const contact = AppState.contacts.find((c) => c.id === AppState.activeChatId);
  if (!contact) return;

  document.getElementById("call-contact-avatar").src = contact.avatar;
  document.getElementById("call-contact-name").textContent = contact.stylishName;
  document.getElementById("call-type-label").textContent = isVideo
    ? "E2EE HD Video Call Connected"
    : "E2EE Voice Call Connected";

  const vidStage = document.getElementById("call-video-preview");
  const camBtn = document.getElementById("call-camera-btn");
  vidStage.classList.toggle("hidden", !isVideo);
  camBtn.classList.toggle("active-toggle", isVideo);

  AppState.callSeconds = 0;
  const timerEl = document.getElementById("call-timer-display");
  timerEl.textContent = "00:00";

  if (AppState.callTimerInterval) clearInterval(AppState.callTimerInterval);
  AppState.callTimerInterval = setInterval(() => {
    AppState.callSeconds += 1;
    const m = String(Math.floor(AppState.callSeconds / 60)).padStart(2, "0");
    const s = String(AppState.callSeconds % 60).padStart(2, "0");
    timerEl.textContent = `${m}:${s}`;
  }, 1000);

  document.getElementById("call-overlay").classList.remove("hidden");
}

/* ============================================================================
 * 10. SETTINGS & CUSTOMIZATION CENTER (ALL 4 TABS)
 * ============================================================================ */

function populateSettingsModal() {
  const user = AppState.currentUser;
  if (!user) return;

  document.getElementById("settings-profile-dp").src = user.avatar;
  document.getElementById("settings-username-display").textContent = user.username;
  document.getElementById("settings-profileid-display").textContent = user.profileId;

  const pill = document.getElementById("settings-verified-pill");
  if (user.verified) {
    pill.className = "status-pill verified";
    pill.innerHTML = `<i class="ri-verified-badge-fill"></i> Official Blue Tick Verified`;
  } else {
    pill.className = "status-pill unverified";
    pill.textContent = "Unverified Account";
  }

  const nameInput = document.getElementById("stylish-name-input");
  nameInput.value = user.baseName || user.stylishName || user.username.slice(1);
  AppState.selectedFontId = user.fontId || "standard";
  renderStylishFontPicker(nameInput.value);

  renderLinkedDevicesList();
}

function renderStylishFontPicker(rawName) {
  const container = document.getElementById("font-styles-list");
  container.innerHTML = "";
  const sample = rawName.trim() || "NexChat User";

  STYLISH_FONTS.forEach((font) => {
    const converted = font.transform(sample);
    const card = document.createElement("div");
    card.className = `font-style-card ${AppState.selectedFontId === font.id ? "selected" : ""}`;
    card.innerHTML = `
      <div>
        <strong>${escapeHtml(converted)}</strong>
        <div style="font-size:11px;color:var(--text-muted);">${escapeHtml(font.label)}</div>
      </div>
      <i class="ri-checkbox-circle-fill" style="color:var(--primary-accent);"></i>
    `;
    card.addEventListener("click", () => {
      AppState.selectedFontId = font.id;
      renderStylishFontPicker(sample);
    });
    container.appendChild(card);
  });
}

function bindSettingsModalEvents() {
  // Tab Switching
  document.querySelectorAll(".settings-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".settings-tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".settings-tab-pane").forEach((p) => p.classList.add("hidden"));

      btn.classList.add("active");
      const tabId = btn.getAttribute("data-tab");
      document.getElementById(tabId).classList.remove("hidden");
    });
  });

  // TAB 1: Profile & Stylish Font Name Converter
  const nameInput = document.getElementById("stylish-name-input");
  nameInput.addEventListener("input", () => {
    renderStylishFontPicker(nameInput.value);
  });

  document.getElementById("copy-username-btn").addEventListener("click", () => {
    navigator.clipboard?.writeText(AppState.currentUser.username);
    showToast("📋 @username copied!");
  });

  document.getElementById("copy-profileid-btn").addEventListener("click", () => {
    navigator.clipboard?.writeText(AppState.currentUser.profileId);
    showToast("📋 Unique #ProfileID copied!");
  });

  const dpBtn = document.getElementById("change-dp-btn");
  const dpInput = document.getElementById("profile-dp-input");
  dpBtn.addEventListener("click", () => dpInput.click());
  dpInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      AppState.currentUser.avatar = ev.target.result;
      document.getElementById("settings-profile-dp").src = ev.target.result;
      await syncCurrentUserToStorage();
      renderStoriesBar();
      showToast("📸 Profile DP updated!");
    };
    reader.readAsDataURL(file);
  });

  document.getElementById("save-profile-btn").addEventListener("click", async () => {
    const base = nameInput.value.trim() || "User";
    const fontObj = STYLISH_FONTS.find((f) => f.id === AppState.selectedFontId) || STYLISH_FONTS[0];
    AppState.currentUser.baseName = base;
    AppState.currentUser.fontId = fontObj.id;
    AppState.currentUser.stylishName = fontObj.transform(base);

    await syncCurrentUserToStorage();
    populateSettingsModal();
    showToast(`✨ Stylish Name saved as: ${AppState.currentUser.stylishName}`);
  });

  // TAB 2: Official Blue Tick Verification (Strictly 2 Methods)
  // Method A: 1-Click Verify with Official Google (@gmail.com only)
  document.getElementById("verify-google-btn").addEventListener("click", async () => {
    const emailVal = document.getElementById("google-verify-email").value;
    const check = validateStrictGmail(emailVal);
    if (!check.valid) {
      showToast(check.error);
      return;
    }

    AppState.currentUser.verified = true;
    AppState.currentUser.verifiedEmail = check.cleanEmail;
    await syncCurrentUserToStorage();
    updateNavbarProfileUI();
    populateSettingsModal();
    showToast("🔵 Official Blue Tick Activated via Verified Google (@gmail.com)!");
  });

  // Method B: 10-Digit Mobile Reverse Verification Code
  document.getElementById("generate-mobile-code-btn").addEventListener("click", () => {
    const mob = document.getElementById("mobile-verify-input").value.trim();
    if (!/^[0-9]{10}$/.test(mob)) {
      showToast("🚫 Please enter a valid 10-digit mobile number (digits only).");
      return;
    }
    AppState.pendingMobileNumber = mob;
    AppState.pendingReverseCode = "VERIFY-" + Math.floor(100000 + Math.random() * 900000);
    document.getElementById("generated-verify-code").textContent = AppState.pendingReverseCode;
    document.getElementById("mobile-reverse-code-box").classList.remove("hidden");
    showToast("📲 Reverse Verification Code Generated!");
  });

  document.getElementById("send-code-admin-btn").addEventListener("click", () => {
    if (!AppState.pendingReverseCode) return;
    const text = `Hello Admin, please verify my NexChat account (${AppState.currentUser.username}) from my mobile ${AppState.pendingMobileNumber}. Reverse Code: ${AppState.pendingReverseCode}`;
    const waUrl = `https://wa.me/${APP_CONFIG.ADMIN_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank");
  });

  document.getElementById("simulate-admin-approve-btn").addEventListener("click", async () => {
    if (!AppState.pendingMobileNumber) return;
    AppState.currentUser.verified = true;
    AppState.currentUser.verifiedMobile = AppState.pendingMobileNumber;
    await syncCurrentUserToStorage();
    updateNavbarProfileUI();
    populateSettingsModal();
    showToast(
      `🔵 Admin Approved! Official Blue Tick & Mobile Login (${AppState.pendingMobileNumber}) Activated!`
    );
  });

  // TAB 3: App Logo & App Name Changer (Disguise Mode)
  document.querySelectorAll(".disguise-preset-card").forEach((card) => {
    card.addEventListener("click", async () => {
      const presetKey = card.getAttribute("data-preset");
      const preset = DISGUISE_PRESETS[presetKey] || DISGUISE_PRESETS.default;
      AppState.prefs.disguiseId = preset.id;
      AppState.prefs.customAppName = preset.name;
      AppState.prefs.customAppIcon = preset.icon;
      await savePreferences();
      showToast(`🕵️ App disguised as "${preset.name}"!`);
    });
  });

  document.getElementById("apply-custom-disguise-btn").addEventListener("click", async () => {
    const customName = document.getElementById("custom-app-name-input").value.trim();
    const customUrl = document.getElementById("custom-app-icon-url").value.trim();
    const customFile = document.getElementById("custom-app-icon-file").files[0];

    if (customName) {
      AppState.prefs.customAppName = customName;
    }

    if (customFile) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        AppState.prefs.customAppIcon = e.target.result;
        await savePreferences();
        showToast("🕵️ Custom App Name & Uploaded Icon Applied!");
      };
      reader.readAsDataURL(customFile);
    } else {
      if (customUrl) AppState.prefs.customAppIcon = customUrl;
      await savePreferences();
      showToast("🕵️ Custom App Disguise Applied!");
    }
  });

  // TAB 4: Linked Devices & Multi-Device Code
  document.getElementById("generate-device-code-btn").addEventListener("click", () => {
    const p1 = Math.floor(100 + Math.random() * 900);
    const p2 = Math.floor(100 + Math.random() * 900);
    document.getElementById("device-link-code-display").textContent = `${p1}-${p2}`;
    showToast("🔑 6-Digit Encrypted Link Device Code Generated!");
  });

  document.getElementById("logout-other-devices-btn").addEventListener("click", () => {
    const onlyCurrent = [
      {
        id: "dev_current",
        name: "Chrome Desktop • Active Session",
        location: "Encrypted Local Tunnel (SSL Pinned)",
        lastActive: "Active Now",
        isCurrent: true
      }
    ];
    localStorage.setItem(STORAGE_KEYS.DEVICES, JSON.stringify(onlyCurrent));
    renderLinkedDevicesList();
    showToast("🛡️ Logged out from all other linked devices!");
  });

  document.getElementById("logout-current-session-btn").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    AppState.currentUser = null;
    closeModal("settings-modal");
    document.getElementById("main-app").classList.add("hidden");
    document.getElementById("auth-screen").classList.remove("hidden");
    showToast("👋 Logged out securely.");
  });
}

async function syncCurrentUserToStorage() {
  if (!AppState.currentUser) return;
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(AppState.currentUser));
  const users = await apiCall("/users", "GET");
  const idx = users.findIndex((u) => u.id === AppState.currentUser.id);
  if (idx !== -1) {
    users[idx] = AppState.currentUser;
    await apiCall("/users", "PUT", users);
  }
}

function renderLinkedDevicesList() {
  const listEl = document.getElementById("linked-devices-list");
  if (!listEl) return;
  const devices = JSON.parse(localStorage.getItem(STORAGE_KEYS.DEVICES) || "[]");
  listEl.innerHTML = "";

  devices.forEach((d) => {
    const div = document.createElement("div");
    div.className = "device-item";
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong>${escapeHtml(d.name)}</strong>
        <span style="font-size:11px;color:var(--online-green);">${escapeHtml(d.lastActive)}</span>
      </div>
      <div style="font-size:11.5px;color:var(--text-muted);margin-top:2px;">${escapeHtml(d.location)}</div>
    `;
    listEl.appendChild(div);
  });
}

function renderNotificationsList() {
  const listEl = document.getElementById("notifications-list");
  if (!listEl) return;
  const notifs = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || "[]");
  listEl.innerHTML = "";

  notifs.forEach((n) => {
    const div = document.createElement("div");
    div.className = "notif-item";
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;">
        <strong>${escapeHtml(n.title)}</strong>
        <small style="color:var(--text-dim);">${escapeHtml(n.time)}</small>
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin-top:4px;">${escapeHtml(n.desc)}</p>
    `;
    listEl.appendChild(div);
  });
}

/* ============================================================================
 * 11. MODAL HELPERS
 * ============================================================================ */

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("hidden");
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("hidden");
  if (id === "story-viewer-modal" && AppState.storyTimerInterval) {
    clearInterval(AppState.storyTimerInterval);
  }
}

function bindGlobalModalClosers() {
  document.querySelectorAll(".modal-close-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-close");
      if (targetId) closeModal(targetId);
    });
  });

  document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop && backdrop.id !== "view-once-modal") {
        closeModal(backdrop.id);
      }
    });
  });
}
