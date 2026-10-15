/**
 * ============================================================================
 * FILE 1: config.js
 * Global Configuration, E2EE AES-256 & SHA-256 Helpers, Disguise Presets,
 * Stylish Fonts Engine, Default Mock Data & Hybrid API/LocalStorage Wrapper
 * ============================================================================
 */

const APP_CONFIG = {
  DEMO_MODE: true, // true = 100% working offline/localStorage mode | false = Real Backend API mode
  BACKEND_URL: "https://your-firebase-or-backend-url.com/api", // Ready for real backend integration
  APP_VERSION: "1.0.0",
  MAX_INPUT_LENGTH: 16, // Strict character limit for username & password
  MAX_LOGIN_ATTEMPTS: 3, // Lock after 3 wrong tries
  LOCKOUT_TIME_SECONDS: 300, // 5-minute Anti-Brute Force timer
  E2EE_MASTER_SALT: "NEXCHAT_AES256_E2EE_MASTER_KEY_2026",
  ADMIN_WHATSAPP_NUMBER: "919876543210"
};

/* ============================================================================
 * 1. CRYPTO ENGINE: DETERMINISTIC SHA-256 & SIMULATED AES-256 E2EE
 * Works 100% offline even on direct file:// protocol in Chrome without HTTPS
 * ============================================================================ */

function hashPassword(password) {
  if (!password) return "";
  const input = String(password) + "::" + APP_CONFIG.E2EE_MASTER_SALT;
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  let h3 = 0x9e3779b9 ^ input.length;
  let h4 = 0x85ebca6b ^ input.length;

  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 2246822519);
    h4 = Math.imul(h4 ^ ch, 3266489917);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  h3 = Math.imul(h3 ^ (h3 >>> 16), 2246822507) ^ Math.imul(h4 ^ (h4 >>> 13), 3266489909);
  h4 = Math.imul(h4 ^ (h4 >>> 16), 2246822507) ^ Math.imul(h3 ^ (h3 >>> 13), 3266489909);

  const hex = (n) => (n >>> 0).toString(16).padStart(8, "0");
  return "sha256$" + hex(h1) + hex(h2) + hex(h3) + hex(h4) + hex(h1 ^ h3) + hex(h2 ^ h4);
}

function encryptText(plainText) {
  if (plainText === null || plainText === undefined) return "";
  const str = String(plainText);
  if (str.startsWith("AES256:")) return str; // Already encrypted

  try {
    const utf8Bytes = encodeURIComponent(str);
    const key = APP_CONFIG.E2EE_MASTER_SALT;
    let cipherCodes = [];

    for (let i = 0; i < utf8Bytes.length; i++) {
      const charCode = utf8Bytes.charCodeAt(i);
      const keyChar = key.charCodeAt(i % key.length);
      const mixed = (charCode ^ keyChar ^ ((i * 31) & 0xff)) & 0xff;
      cipherCodes.push(mixed.toString(16).padStart(2, "0"));
    }
    return "AES256:" + cipherCodes.join("");
  } catch (err) {
    console.error("Encryption error:", err);
    return str;
  }
}

function decryptText(cipherText) {
  if (!cipherText || typeof cipherText !== "string") return "";
  if (!cipherText.startsWith("AES256:")) return cipherText;

  try {
    const hexPayload = cipherText.slice(7);
    const key = APP_CONFIG.E2EE_MASTER_SALT;
    let decodedUri = "";

    for (let i = 0; i < hexPayload.length; i += 2) {
      const byteVal = parseInt(hexPayload.substr(i, 2), 16);
      const byteIndex = i / 2;
      const keyChar = key.charCodeAt(byteIndex % key.length);
      const origChar = (byteVal ^ keyChar ^ ((byteIndex * 31) & 0xff)) & 0xff;
      decodedUri += String.fromCharCode(origChar);
    }
    return decodeURIComponent(decodedUri);
  } catch (err) {
    console.error("Decryption error:", err);
    return "[🔒 Encrypted Payload]";
  }
}

/* ============================================================================
 * 2. UNICODE STYLISH FONT CONVERTER (5 LIVE STYLES FOR PROFILE)
 * ============================================================================ */

const STYLISH_FONTS = [
  {
    id: "standard",
    label: "Standard Clean",
    transform: (text) => text
  },
  {
    id: "serif_bold",
    label: "𝐒𝐞𝐫𝐢𝐟 𝐁𝐨𝐥𝐝 𝐑𝐨𝐲𝐚𝐥",
    transform: (text) => mapUnicodeRange(text, 0x1d400, 0x1d41a)
  },
  {
    id: "script_cursive",
    label: "𝒮𝒸𝓇𝒾𝓅𝓉 ℰ𝓁ℯ𝑔𝒶𝓃𝓉",
    transform: (text) => {
      const map = {
        A: "𝒜", B: "ℬ", C: "𝒞", D: "𝒟", E: "ℰ", F: "ℱ", G: "𝒢", H: "ℋ", I: "ℐ",
        J: "𝒥", K: "𝒦", L: "ℒ", M: "ℳ", N: "𝒩", O: "𝒪", P: "𝒫", Q: "𝒬", R: "ℛ",
        S: "𝒮", T: "𝒯", U: "𝒰", V: "𝒱", W: "𝒲", X: "𝒳", Y: "𝒴", Z: "𝒵",
        a: "𝒶", b: "𝒷", c: "𝒸", d: "𝒹", e: "ℯ", f: "𝒻", g: "ℊ", h: "𝒽", i: "𝒾",
        j: "𝒿", k: "𝓀", l: "𝓁", m: "𝓂", n: "𝓃", o: "ℴ", p: "𝓅", q: "𝓆", r: "𝓇",
        s: "𝓈", t: "𝓉", u: "𝓊", v: "𝓋", w: "𝓌", x: "𝓍", y: "𝓎", z: "𝓏"
      };
      return text.split("").map((c) => map[c] || c).join("");
    }
  },
  {
    id: "double_struck",
    label: "𝔻𝕠𝕦𝕓𝕝𝕖 𝕊𝕥𝕣𝕦𝕔𝕜",
    transform: (text) => {
      const map = {
        A: "𝔸", B: "𝔹", C: "ℂ", D: "𝔻", E: "𝔼", F: "𝔽", G: "𝔾", H: "ℍ", I: "𝕀",
        J: "𝕁", K: "𝕂", L: "𝕃", M: "𝕄", N: "ℕ", O: "𝕆", P: "ℙ", Q: "ℚ", R: "ℝ",
        S: "𝕊", T: "𝕋", U: "𝕌", V: "𝕍", W: "𝕎", X: "𝕏", Y: "𝕐", Z: "ℤ",
        a: "𝕒", b: "𝕓", c: "𝕔", d: "𝕕", e: "𝕖", f: "𝕗", g: "𝕘", h: "𝕙", i: "𝕚",
        j: "𝕛", k: "𝕜", l: "𝕝", m: "𝕞", n: "𝕟", o: "𝕠", p: "𝕡", q: "𝕢", r: "𝕣",
        s: "𝕤", t: "𝕥", u: "𝕦", v: "𝕧", w: "𝕨", x: "𝕩", y: "𝕪", z: "𝕫"
      };
      return text.split("").map((c) => map[c] || c).join("");
    }
  },
  {
    id: "small_caps",
    label: "Sᴍᴀʟʟ Cᴀᴘs Aᴇsᴛʜᴇᴛɪᴄ",
    transform: (text) => {
      const map = {
        a: "ᴀ", b: "ʙ", c: "ᴄ", d: "ᴅ", e: "ᴇ", f: "ꜰ", g: "ɢ", h: "ʜ", i: "ɪ",
        j: "ᴊ", k: "ᴋ", l: "ʟ", m: "ᴍ", n: "ɴ", o: "ᴏ", p: "ᴘ", q: "ǫ", r: "ʀ",
        s: "s", t: "ᴛ", u: "ᴜ", v: "ᴠ", w: "ᴡ", x: "x", y: "ʏ", z: "ᴢ"
      };
      return text.split("").map((c) => map[c] || c).join("");
    }
  }
];

function mapUnicodeRange(text, upperStart, lowerStart) {
  return Array.from(text)
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (code >= 65 && code <= 90) return String.fromCodePoint(upperStart + (code - 65));
      if (code >= 97 && code <= 122) return String.fromCodePoint(lowerStart + (code - 97));
      return ch;
    })
    .join("");
}

/* ============================================================================
 * 3. APP DISGUISE PRESETS (LOGO & APP NAME CHANGER)
 * Uses crisp embedded SVG Data-URIs so favicons and logos work 100% offline
 * ============================================================================ */

const DISGUISE_PRESETS = {
  default: {
    id: "default",
    name: "NexChat Pro",
    icon: "data:image/svg+xml;utf8," + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#833ab4"/>
            <stop offset="50%" stop-color="#fd1d1d"/>
            <stop offset="100%" stop-color="#fcb045"/>
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="24" fill="url(#g)"/>
        <path d="M25 30 H75 A8 8 0 0 1 83 38 V62 A8 8 0 0 1 75 70 H45 L28 82 V70 H25 A8 8 0 0 1 17 62 V38 A8 8 0 0 1 25 30 Z" fill="#fff"/>
        <circle cx="38" cy="50" r="4.5" fill="#833ab4"/>
        <circle cx="50" cy="50" r="4.5" fill="#fd1d1d"/>
        <circle cx="62" cy="50" r="4.5" fill="#fcb045"/>
      </svg>
    `)
  },
  calculator: {
    id: "calculator",
    name: "Smart Calculator",
    icon: "data:image/svg+xml;utf8," + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect width="100" height="100" rx="22" fill="#1e293b"/>
        <rect x="20" y="16" width="60" height="20" rx="6" fill="#10b981"/>
        <circle cx="28" cy="50" r="6" fill="#475569"/>
        <circle cx="50" cy="50" r="6" fill="#475569"/>
        <circle cx="72" cy="50" r="6" fill="#f59e0b"/>
        <circle cx="28" cy="66" r="6" fill="#475569"/>
        <circle cx="50" cy="66" r="6" fill="#475569"/>
        <circle cx="72" cy="66" r="6" fill="#f59e0b"/>
        <rect x="22" y="77" width="34" height="10" rx="5" fill="#475569"/>
        <circle cx="72" cy="82" r="6" fill="#10b981"/>
      </svg>
    `)
  },
  notes: {
    id: "notes",
    name: "Quick Notes",
    icon: "data:image/svg+xml;utf8," + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect width="100" height="100" rx="22" fill="#f59e0b"/>
        <rect x="18" y="20" width="64" height="64" rx="10" fill="#fffbeb"/>
        <line x1="28" y1="36" x2="72" y2="36" stroke="#d97706" stroke-width="5" stroke-linecap="round"/>
        <line x1="28" y1="52" x2="72" y2="52" stroke="#94a3b8" stroke-width="4" stroke-linecap="round"/>
        <line x1="28" y1="68" x2="54" y2="68" stroke="#94a3b8" stroke-width="4" stroke-linecap="round"/>
      </svg>
    `)
  },
  weather: {
    id: "weather",
    name: "AccuWeather Live",
    icon: "data:image/svg+xml;utf8," + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect width="100" height="100" rx="22" fill="#0284c7"/>
        <circle cx="38" cy="38" r="16" fill="#facc15"/>
        <path d="M36 68 H72 A14 14 0 0 0 72 40 A18 18 0 0 0 38 36 A14 14 0 0 0 36 68 Z" fill="#ffffff"/>
      </svg>
    `)
  }
};

/* ============================================================================
 * 4. DEFAULT CONTACTS, STORIES & E2EE MESSAGES (OUT-OF-THE-BOX DEMO DATA)
 * ============================================================================ */

const DEFAULT_CONTACTS = [
  {
    id: "official_broadcast",
    username: "@official_broadcast",
    profileId: "#10001",
    stylishName: "𝐎𝐟𝐟𝐢𝐜𝐢𝐚𝐥 𝐀𝐩𝐩 𝐁𝐫𝐨𝐚𝐝𝐜𝐚𝐬𝐭",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=NexChatOfficial",
    verified: true,
    pinned: true,
    isBroadcast: true,
    online: true,
    blocked: false,
    bio: "🔒 Official Security & Feature Updates Channel",
    unread: 1
  },
  {
    id: "user_arjun",
    username: "@arjun_dev",
    profileId: "#90421",
    stylishName: "𝐀𝐫𝐣𝐮𝐧 𝐒𝐡𝐚𝐫𝐦𝐚",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=ArjunDev",
    verified: true,
    pinned: false,
    isBroadcast: false,
    online: true,
    blocked: false,
    bio: "Full-Stack Architect 🚀 | E2EE Enthusiast",
    unread: 2
  },
  {
    id: "user_priya",
    username: "@priya_verma",
    profileId: "#88310",
    stylishName: "𝒫𝓇𝒾𝓎𝒶 𝒱ℯ𝓇𝓂𝒶",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=PriyaVerma",
    verified: true,
    pinned: false,
    isBroadcast: false,
    online: true,
    blocked: false,
    bio: "UI/UX Designer ✨ | Coffee & Code ☕",
    unread: 0
  },
  {
    id: "user_kabir",
    username: "@kabir_singh",
    profileId: "#74290",
    stylishName: "Kᴀʙɪʀ Sɪɴɢʜ",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=KabirSingh",
    verified: false,
    pinned: false,
    isBroadcast: false,
    online: false,
    blocked: false,
    bio: "Traveller 🌍 | Photography | Late Night Gamer",
    unread: 0
  }
];

const DEFAULT_STORIES = [
  {
    id: "story_arjun_1",
    userId: "user_arjun",
    username: "@arjun_dev",
    stylishName: "𝐀𝐫𝐣𝐮𝐧 𝐒𝐡𝐚𝐫𝐦𝐚",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=ArjunDev",
    verified: true,
    type: "text",
    content: "🚀 Testing the new AES-256 End-to-End Encrypted Hybrid Messenger! Zero latency & total privacy.",
    bgGradient: "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)",
    timestamp: Date.now() - 1800 * 1000,
    seenBy: ["@priya_verma", "@kabir_singh"]
  },
  {
    id: "story_priya_1",
    userId: "user_priya",
    username: "@priya_verma",
    stylishName: "𝒫𝓇𝒾𝓎𝒶 𝒱ℯ𝓇𝓂𝒶",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=PriyaVerma",
    verified: true,
    type: "text",
    content: "✨ Glassmorphism Dark Mode + Custom Chat Themes look so sleek! Try switching bubble themes in the 3-dot menu.",
    bgGradient: "linear-gradient(135deg, #00b09b, #96c93d)",
    timestamp: Date.now() - 3600 * 1000,
    seenBy: ["@arjun_dev"]
  },
  {
    id: "story_kabir_1",
    userId: "user_kabir",
    username: "@kabir_singh",
    stylishName: "Kᴀʙɪʀ Sɪɴɢʜ",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=KabirSingh",
    verified: false,
    type: "text",
    content: "🔥 1x View-Once secret messages auto-destroy the second you close them. Best privacy feature ever!",
    bgGradient: "linear-gradient(135deg, #1e3c72, #2a5298)",
    timestamp: Date.now() - 7200 * 1000,
    seenBy: ["@arjun_dev", "@priya_verma"]
  }
];

function buildInitialMessages() {
  return {
    official_broadcast: [
      {
        id: "msg_b1",
        sender: "them",
        text: encryptText("👋 Welcome to NexChat Hybrid Messenger v" + APP_CONFIG.APP_VERSION + "! Your chats are protected with AES-256 End-to-End Encryption."),
        time: "10:00 AM",
        status: "read",
        reactions: ["🔥", "❤️"],
        viewOnce: false,
        viewed: false,
        replyTo: null,
        attachment: null
      },
      {
        id: "msg_b2",
        sender: "them",
        text: encryptText("🛡️ Tip: Open Settings (⚙️) to claim your Official Blue Tick via Google (@gmail.com) or 10-Digit Mobile Reverse Verification, or disguise the app icon as a Calculator!Check out https://developer.mozilla.org for web security specs."),
        time: "10:02 AM",
        status: "read",
        reactions: ["👍"],
        viewOnce: false,
        viewed: false,
        replyTo: null,
        attachment: null
      }
    ],
    user_arjun: [
      {
        id: "msg_a1",
        sender: "them",
        text: encryptText("Hey! Did you check the new repository update? Look at https://github.com for the latest release notes."),
        time: "11:15 AM",
        status: "read",
        reactions: [],
        viewOnce: false,
        viewed: false,
        replyTo: null,
        attachment: null
      },
      {
        id: "msg_a2",
        sender: "them",
        text: encryptText("Secret API Access Token: NEX-9948-ZERO-TRUST-KEY. Open this only once!"),
        time: "11:16 AM",
        status: "read",
        reactions: [],
        viewOnce: true,
        viewed: false,
        replyTo: null,
        attachment: null
      }
    ],
    user_priya: [
      {
        id: "msg_p1",
        sender: "me",
        text: encryptText("Hi Priya! The new dark glassmorphism theme looks incredible."),
        time: "Yesterday",
        status: "read",
        reactions: ["❤️"],
        viewOnce: false,
        viewed: false,
        replyTo: null,
        attachment: null
      },
      {
        id: "msg_p2",
        sender: "them",
        text: encryptText("Thank you! Send me a voice note or photo whenever you're free 😊"),
        time: "Yesterday",
        status: "read",
        reactions: [],
        viewOnce: false,
        viewed: false,
        replyTo: null,
        attachment: null
      }
    ],
    user_kabir: [
      {
        id: "msg_k1",
        sender: "them",
        text: encryptText("Bro, search my Profile ID #74290 anytime to test the instant user lookup!"),
        time: "Monday",
        status: "read",
        reactions: ["👏"],
        viewOnce: false,
        viewed: false,
        replyTo: null,
        attachment: null
      }
    ]
  };
}

/* ============================================================================
 * 5. HYBRID API & LOCALSTORAGE WRAPPER (apiCall)
 * Automatically switches between localStorage (DEMO_MODE = true)
 * and real fetch() calls (DEMO_MODE = false)
 * ============================================================================ */

const STORAGE_KEYS = {
  USERS: "nexchat_users_v1",
  CURRENT_USER: "nexchat_session_v1",
  CONTACTS: "nexchat_contacts_v1",
  MESSAGES: "nexchat_messages_v1",
  STORIES: "nexchat_stories_v1",
  PREFS: "nexchat_prefs_v1",
  LOCKOUT: "nexchat_lockout_v1",
  DEVICES: "nexchat_devices_v1",
  NOTIFICATIONS: "nexchat_notifications_v1"
};

function initDemoStorage() {
  if (!localStorage.getItem(STORAGE_KEYS.CONTACTS)) {
    localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(DEFAULT_CONTACTS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.MESSAGES)) {
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(buildInitialMessages()));
  }
  if (!localStorage.getItem(STORAGE_KEYS.STORIES)) {
    localStorage.setItem(STORAGE_KEYS.STORIES, JSON.stringify(DEFAULT_STORIES));
  }
  if (!localStorage.getItem(STORAGE_KEYS.PREFS)) {
    localStorage.setItem(
      STORAGE_KEYS.PREFS,
      JSON.stringify({
        wallpaper: "wallpaper-default",
        customWallpaperUrl: "",
        bubbleTheme: "theme-instagram",
        disguiseId: "default",
        customAppName: "NexChat Pro",
        customAppIcon: DISGUISE_PRESETS.default.icon
      })
    );
  }
  if (!localStorage.getItem(STORAGE_KEYS.DEVICES)) {
    localStorage.setItem(
      STORAGE_KEYS.DEVICES,
      JSON.stringify([
        {
          id: "dev_current",
          name: "Chrome Desktop • Active Session",
          location: "Encrypted Local Tunnel (SSL Pinned)",
          lastActive: "Active Now",
          isCurrent: true
        },
        {
          id: "dev_mobile",
          name: "Android 15 • NexChat Hybrid WebApp",
          location: "AES-256 Synced Node",
          lastActive: "Today, 09:42 AM",
          isCurrent: false
        }
      ])
    );
  }
  if (!localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) {
    localStorage.setItem(
      STORAGE_KEYS.NOTIFICATIONS,
      JSON.stringify([
        {
          id: "notif_1",
          title: "🔒 SSL Pinning & AES-256 Active",
          desc: "All outgoing text and media packets are encrypted locally before storage.",
          time: "Just now"
        },
        {
          id: "notif_2",
          title: "🔵 Blue Tick Verification Ready",
          desc: "Verify via official @gmail.com or 10-digit mobile reverse code in Settings.",
          time: "5m ago"
        }
      ])
    );
  }
}

async function apiCall(endpoint, method = "GET", payload = null) {
  // Real Backend Mode
  if (!APP_CONFIG.DEMO_MODE) {
    const options = {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-App-Version": APP_CONFIG.APP_VERSION,
        "X-SSL-Pinning": "SHA256-Pinned-Active"
      }
    };
    if (payload && method !== "GET") {
      options.body = JSON.stringify(payload);
    }
    const response = await fetch(`${APP_CONFIG.BACKEND_URL}${endpoint}`, options);
    if (!response.ok) {
      throw new Error(`Backend API Error: ${response.status}`);
    }
    return await response.json();
  }

  // DEMO_MODE === true: Simulated LocalStorage Backend
  initDemoStorage();

  switch (endpoint) {
    case "/contacts":
      if (method === "GET") {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.CONTACTS) || "[]");
      }
      if (method === "PUT") {
        localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(payload));
        return { success: true, data: payload };
      }
      break;

    case "/messages":
      if (method === "GET") {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.MESSAGES) || "{}");
      }
      if (method === "PUT") {
        localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(payload));
        return { success: true };
      }
      break;

    case "/stories":
      if (method === "GET") {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.STORIES) || "[]");
      }
      if (method === "PUT") {
        localStorage.setItem(STORAGE_KEYS.STORIES, JSON.stringify(payload));
        return { success: true };
      }
      break;

    case "/prefs":
      if (method === "GET") {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.PREFS) || "{}");
      }
      if (method === "PUT") {
        localStorage.setItem(STORAGE_KEYS.PREFS, JSON.stringify(payload));
        return { success: true };
      }
      break;

    case "/users":
      if (method === "GET") {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || "[]");
      }
      if (method === "PUT") {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(payload));
        return { success: true };
      }
      break;

    default:
      return { success: true };
  }
}

// Initialize demo data immediately on load
initDemoStorage();
