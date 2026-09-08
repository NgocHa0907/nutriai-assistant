/**
 * NutriAI - Firebase Authentication & Cloud Sync
 * Quản lý tài khoản người dùng và đồng bộ dữ liệu lên Firestore
 */

// =============================================================================
// FIREBASE CONFIG - Thay thế bằng config Firebase project của bạn
// =============================================================================
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyB_Va7QxikU-p0GvgdciPkpCYWV-ZQmB6k',
  authDomain: 'nutriai-6d154.firebaseapp.com',
  projectId: 'nutriai-6d154',
  storageBucket: 'nutriai-6d154.firebasestorage.app',
  messagingSenderId: '377754312296',
  appId: '1:377754312296:web:edf7b839630abb32b625dd'
};

// =============================================================================
// FIREBASE INITIALIZATION
// =============================================================================
let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;
let currentUser = null;
let isSyncing = false;
let unsubscribeSnapshot = null;

function initFirebase() {
  if (!FIREBASE_CONFIG.apiKey || !FIREBASE_CONFIG.projectId) {
    console.warn('NutriAI: Firebase chưa được cấu hình. Chỉ dùng localStorage.');
    updateAuthUI(null);
    return;
  }

  try {
    if (typeof firebase === 'undefined') {
      console.warn('NutriAI: Firebase SDK chưa được tải.');
      updateAuthUI(null);
      return;
    }

    if (!firebase.apps.length) {
      firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
    } else {
      firebaseApp = firebase.apps[0];
    }

    firebaseAuth = firebase.auth();
    firebaseDb = firebase.firestore();

    firebaseAuth.onAuthStateChanged(handleAuthStateChanged);
  } catch (err) {
    console.error('NutriAI: Lỗi khởi tạo Firebase:', err);
    updateAuthUI(null);
  }
}

// =============================================================================
// AUTH STATE HANDLER
// =============================================================================
function handleAuthStateChanged(user) {
  currentUser = user;
  updateAuthUI(user);

  if (user) {
    startCloudSync(user.uid);
    if (typeof showToast === 'function') {
      showToast('Đã đăng nhập: ' + (user.displayName || user.email), 'success');
    }
  } else {
    stopCloudSync();
  }
}
// =============================================================================
// AUTH ACTIONS
// =============================================================================
async function signInWithGoogle() {
  if (!firebaseAuth) { showFirebaseNotConfigured(); return; }
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await firebaseAuth.signInWithPopup(provider);
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      console.error('Lỗi đăng nhập Google:', err);
      if (typeof showToast === 'function') showToast('Đăng nhập thất bại: ' + err.message, 'error');
    }
  }
}

async function signInWithEmail(email, password) {
  if (!firebaseAuth) { showFirebaseNotConfigured(); return; }
  try {
    await firebaseAuth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      try {
        const cred = await firebaseAuth.createUserWithEmailAndPassword(email, password);
        await cred.user.updateProfile({ displayName: email.split('@')[0] });
        if (typeof showToast === 'function') showToast('Tạo tài khoản thành công!', 'success');
      } catch (regErr) {
        console.error('Lỗi tạo tài khoản:', regErr);
        if (typeof showToast === 'function') showToast('Lỗi: ' + regErr.message, 'error');
      }
    } else {
      console.error('Lỗi đăng nhập:', err);
      if (typeof showToast === 'function') showToast('Đăng nhập thất bại: ' + err.message, 'error');
    }
  }
}

async function signOutUser() {
  if (!firebaseAuth) return;
  try {
    stopCloudSync();
    await firebaseAuth.signOut();
    if (typeof showToast === 'function') showToast('Đã đăng xuất thành công.', 'info');
  } catch (err) {
    console.error('Lỗi đăng xuất:', err);
  }
}

function showFirebaseNotConfigured() {
  if (typeof showToast === 'function') {
    showToast('Firebase chưa được cấu hình. Vui lòng thêm Firebase Config vào firebase-config.js', 'error');
  }
}
// =============================================================================
// CLOUD SYNC - Firestore
// =============================================================================
function getUserDocRef(uid) {
  return firebaseDb.collection('users').doc(uid);
}

async function uploadAllDataToCloud(uid) {
  if (!firebaseDb || !uid || isSyncing) return;
  isSyncing = true;
  try {
    const docRef = getUserDocRef(uid);
    const data = {
      profile: typeof state !== 'undefined' ? state.profile : JSON.parse(safeStorage.getItem('nutriai_user_profile') || '{}'),
      dailyLogs: typeof state !== 'undefined' ? state.dailyLogs : JSON.parse(safeStorage.getItem('nutriai_daily_logs') || '{}'),
      chatMessages: typeof state !== 'undefined' ? state.chatMessages.filter(function(m) { return !m.isTyping; }) : JSON.parse(safeStorage.getItem('nutriai_chat_messages') || '[]'),
      apiConfig: typeof state !== 'undefined' ? state.apiConfig : JSON.parse(safeStorage.getItem('nutriai_api_config') || '{}'),
      systemPrompt: typeof state !== 'undefined' ? state.systemPrompt : (safeStorage.getItem('nutriai_system_prompt') || ''),
      personality: typeof state !== 'undefined' ? state.personality : (safeStorage.getItem('nutriai_personality') || 'cheerful'),
      theme: safeStorage.getItem('nutriai_theme') || 'light',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await docRef.set(data, { merge: true });
  } catch (err) {
    console.error('NutriAI: Lỗi đồng bộ lên cloud:', err);
  } finally {
    isSyncing = false;
  }
}

async function downloadDataFromCloud(uid) {
  if (!firebaseDb || !uid) return false;
  try {
    const docRef = getUserDocRef(uid);
    const doc = await docRef.get();
    if (!doc.exists) { await uploadAllDataToCloud(uid); return false; }
    const data = doc.data();
    let hasData = false;
    if (data.profile && Object.keys(data.profile).length > 0) {
      safeStorage.setItem('nutriai_user_profile', JSON.stringify(data.profile));
      if (typeof state !== 'undefined') state.profile = data.profile;
      hasData = true;
    }
    if (data.dailyLogs && Object.keys(data.dailyLogs).length > 0) {
      safeStorage.setItem('nutriai_daily_logs', JSON.stringify(data.dailyLogs));
      if (typeof state !== 'undefined') state.dailyLogs = data.dailyLogs;
      hasData = true;
    }
    if (data.chatMessages && data.chatMessages.length > 0) {
      safeStorage.setItem('nutriai_chat_messages', JSON.stringify(data.chatMessages));
      if (typeof state !== 'undefined') state.chatMessages = data.chatMessages;
      hasData = true;
    }
    if (data.apiConfig && Object.keys(data.apiConfig).length > 0) {
      safeStorage.setItem('nutriai_api_config', JSON.stringify(data.apiConfig));
      if (typeof state !== 'undefined') state.apiConfig = data.apiConfig;
      hasData = true;
    }
    if (data.systemPrompt) {
      safeStorage.setItem('nutriai_system_prompt', data.systemPrompt);
      if (typeof state !== 'undefined') state.systemPrompt = data.systemPrompt;
      hasData = true;
    }
    if (data.personality) {
      safeStorage.setItem('nutriai_personality', data.personality);
      if (typeof state !== 'undefined') state.personality = data.personality;
      hasData = true;
    }
    if (data.theme) {
      safeStorage.setItem('nutriai_theme', data.theme);
      document.documentElement.setAttribute('data-theme', data.theme);
    }
    if (hasData && typeof renderChatMessages === 'function') {
      renderChatMessages();
      renderHealthTracker();
      syncApiSettingsUI();
      if (typeof renderPersonalityUI === 'function') renderPersonalityUI();
    }
    return hasData;
  } catch (err) {
    console.error('NutriAI: Lỗi tải dữ liệu từ cloud:', err);
    return false;
  }
}

function startCloudSync(uid) {
  stopCloudSync();
  downloadDataFromCloud(uid);
  if (!firebaseDb) return;
  unsubscribeSnapshot = getUserDocRef(uid).onSnapshot(function(doc) {
    if (!doc.exists || isSyncing) return;
    const data = doc.data();
    if (!data || !data.updatedAt) return;
    if (data.profile) {
      if (typeof state !== 'undefined') state.profile = data.profile;
      safeStorage.setItem('nutriai_user_profile', JSON.stringify(data.profile));
    }
    if (data.dailyLogs) {
      if (typeof state !== 'undefined') state.dailyLogs = data.dailyLogs;
      safeStorage.setItem('nutriai_daily_logs', JSON.stringify(data.dailyLogs));
    }
    if (data.chatMessages) {
      if (typeof state !== 'undefined') state.chatMessages = data.chatMessages;
      safeStorage.setItem('nutriai_chat_messages', JSON.stringify(data.chatMessages));
    }
    if (typeof renderHealthTracker === 'function') renderHealthTracker();
  }, function(err) {
    console.error('NutriAI: Lỗi realtime sync:', err);
  });
}

function stopCloudSync() {
  if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
}

function syncToCloudIfLoggedIn() {
  if (currentUser && firebaseDb) {
    if (window._nutriaiSyncTimer) clearTimeout(window._nutriaiSyncTimer);
    window._nutriaiSyncTimer = setTimeout(function() {
      uploadAllDataToCloud(currentUser.uid);
    }, 1500);
  }
}

// =============================================================================
// AUTH UI
// =============================================================================
function updateAuthUI(user) {
  const authArea = document.getElementById('auth-area');
  if (!authArea) return;

  if (user) {
    const displayName = user.displayName || user.email || 'Người dùng';
    const photoURL = user.photoURL;
    const initial = displayName.charAt(0).toUpperCase();

    const avatarInner = photoURL
      ? '<img src="' + photoURL + '" alt="" referrerpolicy="no-referrer">'
      : '<span>' + initial + '</span>';

    authArea.innerHTML =
      '<div class="auth-user-info" id="auth-user-toggle">' +
        '<div class="auth-avatar">' + avatarInner + '</div>' +
        '<span class="auth-user-name">' + displayName + '</span>' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>' +
      '</div>' +
      '<div class="auth-dropdown" id="auth-dropdown">' +
        '<div class="auth-dropdown-header">' +
          '<div style="font-weight:600;">' + displayName + '</div>' +
          '<div style="font-size:0.75rem; color:var(--text-muted);">' + (user.email || '') + '</div>' +
        '</div>' +
        '<div class="auth-dropdown-divider"></div>' +
        '<button class="auth-dropdown-item" onclick="syncNow()">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>' +
          '<span>Đồng bộ ngay</span>' +
        '</button>' +
        '<button class="auth-dropdown-item" onclick="exportDataAsJson()">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>' +
          '<span>Xuất dữ liệu (JSON)</span>' +
        '</button>' +
        '<button class="auth-dropdown-item" onclick="document.getElementById(\x27import-file-input\x27).click()">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>' +
          '<span>Nhập dữ liệu (JSON)</span>' +
        '</button>' +
        '<input type="file" id="import-file-input" accept=".json" style="display:none" onchange="importDataFromJson(event)">' +
        '<div class="auth-dropdown-divider"></div>' +
        '<button class="auth-dropdown-item auth-logout" onclick="signOutUser()">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>' +
          '<span>Đăng xuất</span>' +
        '</button>' +
      '</div>';

    const toggle = document.getElementById('auth-user-toggle');
    const dropdown = document.getElementById('auth-dropdown');
    if (toggle && dropdown) {
      toggle.addEventListener('click', function(e) {
        e.stopPropagation();
        dropdown.classList.toggle('open');
      });
      document.addEventListener('click', function() {
        dropdown.classList.remove('open');
      });
    }
  } else {
    const hasFirebase = FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId;

    if (hasFirebase) {
      authArea.innerHTML =
        '<div class="auth-login-area">' +
          '<button class="btn-auth-google" onclick="signInWithGoogle()" title="Đăng nhập bằng Google">' +
            '<svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>' +
            '<span>Đăng nhập</span>' +
          '</button>' +
          '<button class="btn-auth-email" onclick="showEmailLoginModal()" title="Đăng nhập bằng Email">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>' +
          '</button>' +
        '</div>';
    } else {
      authArea.innerHTML =
        '<div class="auth-login-area">' +
          '<button class="btn-auth-local" onclick="exportDataAsJson()" title="Xuất dữ liệu">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>' +
            '<span>Xuất</span>' +
          '</button>' +
          '<button class="btn-auth-local" onclick="document.getElementById(\x27import-file-input-guest\x27).click()" title="Nhập dữ liệu">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>' +
            '<span>Nhập</span>' +
          '</button>' +
          '<input type="file" id="import-file-input-guest" accept=".json" style="display:none" onchange="importDataFromJson(event)">' +
        '</div>';
    }
  }
}


// =============================================================================
// EMAIL LOGIN MODAL
// =============================================================================
function showEmailLoginModal() {
  let modal = document.getElementById('modal-email-login');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-email-login';
    modal.className = 'modal-overlay';
    modal.innerHTML =
      '<div class="modal-card" style="max-width:380px;">' +
        '<div class="modal-header">' +
          '<h3 class="modal-title">Đăng nhập / Đăng ký</h3>' +
          '<button class="modal-close-btn" onclick="closeEmailLoginModal()">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
          '</button>' +
        '</div>' +
        '<form id="form-email-login" onsubmit="handleEmailLogin(event)">' +
          '<div class="form-group" style="margin-bottom:0.75rem;">' +
            '<label class="form-label" for="login-email">Email</label>' +
            '<input type="email" id="login-email" class="form-input" placeholder="email@example.com" required>' +
          '</div>' +
          '<div class="form-group" style="margin-bottom:1rem;">' +
            '<label class="form-label" for="login-password">Mật khẩu (tối thiểu 6 ký tự)</label>' +
            '<input type="password" id="login-password" class="form-input" placeholder="••••••" minlength="6" required>' +
          '</div>' +
          '<p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:1rem;">Nếu chưa có tài khoản, hệ thống sẽ tự động tạo mới cho bạn.</p>' +
          '<div style="display:flex; gap:0.5rem;">' +
            '<button type="submit" class="btn-primary" style="flex:1;">Đăng nhập / Đăng ký</button>' +
          '</div>' +
        '</form>' +
      '</div>';
    document.body.appendChild(modal);
  }
  modal.classList.add('open');
  var emailInput = document.getElementById('login-email');
  if (emailInput) emailInput.focus();
}

function closeEmailLoginModal() {
  var modal = document.getElementById('modal-email-login');
  if (modal) modal.classList.remove('open');
}

function handleEmailLogin(e) {
  e.preventDefault();
  var email = document.getElementById('login-email').value.trim();
  var password = document.getElementById('login-password').value;
  if (email && password) {
    signInWithEmail(email, password);
    closeEmailLoginModal();
  }
}

// =============================================================================
// EXPORT / IMPORT DATA
// =============================================================================
function exportDataAsJson() {
  var data = {
    exportedAt: new Date().toISOString(),
    app: 'NutriAI',
    profile: typeof state !== 'undefined' ? state.profile : JSON.parse(safeStorage.getItem('nutriai_user_profile') || '{}'),
    dailyLogs: typeof state !== 'undefined' ? state.dailyLogs : JSON.parse(safeStorage.getItem('nutriai_daily_logs') || '{}'),
    chatMessages: typeof state !== 'undefined'
      ? state.chatMessages.filter(function(m) { return !m.isTyping; })
      : JSON.parse(safeStorage.getItem('nutriai_chat_messages') || '[]'),
    apiConfig: typeof state !== 'undefined' ? state.apiConfig : JSON.parse(safeStorage.getItem('nutriai_api_config') || '{}'),
    systemPrompt: typeof state !== 'undefined' ? state.systemPrompt : (safeStorage.getItem('nutriai_system_prompt') || ''),
    personality: typeof state !== 'undefined' ? state.personality : (safeStorage.getItem('nutriai_personality') || 'cheerful')
  };

  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'nutriai-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  if (typeof showToast === 'function') showToast('Đã xuất dữ liệu thành công!', 'success');
}

function importDataFromJson(event) {
  var file = event.target.files[0];
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = JSON.parse(e.target.result);
      if (data.app !== 'NutriAI') {
        if (typeof showToast === 'function') showToast('File không phải dữ liệu NutriAI hợp lệ!', 'error');
        return;
      }

      if (data.profile) {
        safeStorage.setItem('nutriai_user_profile', JSON.stringify(data.profile));
        if (typeof state !== 'undefined') state.profile = data.profile;
      }
      if (data.dailyLogs) {
        safeStorage.setItem('nutriai_daily_logs', JSON.stringify(data.dailyLogs));
        if (typeof state !== 'undefined') state.dailyLogs = data.dailyLogs;
      }
      if (data.chatMessages) {
        safeStorage.setItem('nutriai_chat_messages', JSON.stringify(data.chatMessages));
        if (typeof state !== 'undefined') state.chatMessages = data.chatMessages;
      }
      if (data.apiConfig) {
        safeStorage.setItem('nutriai_api_config', JSON.stringify(data.apiConfig));
        if (typeof state !== 'undefined') state.apiConfig = data.apiConfig;
      }
      if (data.systemPrompt) {
        safeStorage.setItem('nutriai_system_prompt', data.systemPrompt);
        if (typeof state !== 'undefined') state.systemPrompt = data.systemPrompt;
      }
      if (data.personality) {
        safeStorage.setItem('nutriai_personality', data.personality);
        if (typeof state !== 'undefined') state.personality = data.personality;
      }

      if (typeof renderChatMessages === 'function') renderChatMessages();
      if (typeof renderHealthTracker === 'function') renderHealthTracker();
      if (typeof syncApiSettingsUI === 'function') syncApiSettingsUI();
      if (typeof renderPersonalityUI === 'function') renderPersonalityUI();

      if (currentUser) syncToCloudIfLoggedIn();

      if (typeof showToast === 'function') showToast('Đã nhập dữ liệu thành công!', 'success');
    } catch (err) {
      console.error('Lỗi nhập dữ liệu:', err);
      if (typeof showToast === 'function') showToast('Lỗi đọc file: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function syncNow() {
  if (currentUser) {
    uploadAllDataToCloud(currentUser.uid);
    if (typeof showToast === 'function') showToast('Đang đồng bộ dữ liệu lên cloud...', 'info');
  }
}

// =============================================================================
// INIT ON LOAD
// =============================================================================
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function() {
    initFirebase();
  });
}