// users.js - User management front-end with slide-in drawer (cleaned)

/* =====================================
   DYNAMIC API URL (NO HARDCODED LINKS)
   ===================================== */
const API_URL = "https://script.google.com/macros/s/AKfycbwGFL1xNeJ4E78CVpnaQKMdx_RFYDm0jVMbVJ-KnWTE2NbNrhin6bIgr5_R8sEgC4ZGeA/exec";

/* ===================================== */

let ALL_USERS = [];
let EDIT_TARGET = null;

document.addEventListener("DOMContentLoaded", () => {
  if(!localStorage.getItem("loggedIn")) 
    return window.location.href = "index.html";

  document.getElementById("userName").innerText =
      localStorage.getItem("staffName") || '';

  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "index.html";
  });

  // Drawer controls
  const overlay = document.getElementById('userPanelOverlay');
  const drawer = document.getElementById('userDrawer');
  const openBtn = document.getElementById('openAddUser');
  const cancelDrawer = document.getElementById('cancelUserDrawer');
  const drawerBack = document.getElementById('drawerBack');
  const saveBtn = document.getElementById('saveUserBtn');

  overlay?.addEventListener('click', closeUserDrawer);
  openBtn?.addEventListener('click', () => openUserDrawer('add'));
  cancelDrawer?.addEventListener('click', closeUserDrawer);
  drawerBack?.addEventListener('click', closeUserDrawer);

  document.getElementById('filterUser')?.addEventListener('input', (e) => {
    renderUsers(e.target.value.trim().toLowerCase());
  });

  document.getElementById('viewLogsBtn')?.addEventListener('click', loadLogs);
  document.getElementById('closeLogs')?.addEventListener('click', () => {
    document.getElementById('logsModal').style.display = 'none';
  });

  saveBtn?.addEventListener('click', async () => {
    if (EDIT_TARGET) await updateUser();
    else await createUser();
  });

  loadUsers();
});

/* ---------- Load Users ---------- */
async function loadUsers(){
  try {
    const username = localStorage.getItem('username');
    const pwHash = localStorage.getItem('pwHash');

    if (!username || !pwHash) {
      localStorage.clear();
      return window.location.href = 'index.html';
    }

    const url = `${API_URL}?action=users&username=${encodeURIComponent(username)}&pwHash=${encodeURIComponent(pwHash)}`;
    const res = await fetch(url);

    if (!res.ok) throw new Error("Unable to fetch users");

    const data = await res.json();
    if (!data.success) {
      alert(data.message || "Permission denied");
      return;
    }

    ALL_USERS = data.users || [];
    renderUsers();

  } catch (err) {
    console.error(err);
    alert("Failed to load users.");
  }
}

/* ---------- Render Users Table ---------- */
function renderUsers(filter = ''){
  const tbody = document.getElementById('usersBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const q = filter.trim().toLowerCase();

  const list = ALL_USERS.filter(u => {
    if (!q) return true;
    return `${u.Username} ${u.FullName} ${u.Role} ${u.AssignedBarangay}`
      .toLowerCase().includes(q);
  });

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">No users found.</td></tr>`;
    return;
  }

  list.forEach(user => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(user.Username)}</td>
      <td>${escapeHtml(user.FullName)}</td>
      <td>${escapeHtml(user.Role)}</td>
      <td>${escapeHtml(user.AssignedBarangay)}</td>
      <td class="actions-cell">
        <button class="icon-btn" title="Edit User" data-username="${escapeHtml(user.Username)}" data-action="edit">✏️</button>
        <button class="icon-btn" title="Reset Password" data-username="${escapeHtml(user.Username)}" data-action="resetpw">🔑</button>
        <button class="icon-btn" title="Delete User" data-username="${escapeHtml(user.Username)}" data-action="delete">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("button[data-action]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.action;
      const username = btn.dataset.username;
      const target = ALL_USERS.find(u => u.Username === username);

      if (action === "edit") openEditDrawer(target);
      if (action === "resetpw") {
        openEditDrawer(target);
        setTimeout(() => document.getElementById("user_password").focus(), 300);
      }
      if (action === "delete") deleteUser(username);
    });
  });
}

/* ---------- Utility escape ---------- */
function escapeHtml(s){
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ---------- Create User ---------- */
async function createUser(){
  const u = document.getElementById('user_username').value.trim();
  const fullname = document.getElementById('user_fullname').value.trim();
  const role = document.getElementById('user_role').value;
  const barangay = document.getElementById('user_barangay').value;
  const password = document.getElementById('user_password').value;

  if (!u || !password) {
    document.getElementById('userFormStatus').innerText = "Username and password required.";
    return;
  }

  try {
    document.getElementById('saveUserBtn').disabled = true;

    const pwHash = await sha256Hex(password);

    const body = {
      action: "createUser",
      auth: {
        username: localStorage.getItem("username"),
        pwHash: localStorage.getItem("pwHash")
      },
      user: {
        Username: u,
        PasswordHash: pwHash,
        Role: role,
        FullName: fullname,
        AssignedBarangay: barangay
      }
    };

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(body)
    });

    const out = await res.json();
    document.getElementById('saveUserBtn').disabled = false;
    document.getElementById('userFormStatus').innerText =
      out.message || (out.success ? "User created." : "Failed");

    if (out.success) {
      alert(`User created: ${u}`);
      closeUserDrawer();
      loadUsers();
    }

  } catch (err) {
    console.error(err);
    document.getElementById('userFormStatus').innerText = "Create failed.";
    document.getElementById('saveUserBtn').disabled = false;
  }
}

/* ---------- Drawer Controls ---------- */
function openUserDrawer(mode='add', userObj=null){
  EDIT_TARGET = null;

  document.getElementById('userFormStatus').innerText = "";
  document.getElementById('userForm').reset();
  document.getElementById('drawerTitle').innerText = mode === "edit" ? "Edit User" : "Add New User";
  document.getElementById('saveUserBtn').innerText = mode === "edit" ? "Save Changes" : "Create";

  document.getElementById('user_username').disabled = (mode === "edit");

  if (mode === "edit" && userObj) {
    EDIT_TARGET = userObj.Username;
    document.getElementById('user_username').value = userObj.Username;
    document.getElementById('user_fullname').value = userObj.FullName;
    document.getElementById('user_role').value = userObj.Role;
    document.getElementById('user_barangay').value = userObj.AssignedBarangay;
    document.getElementById('user_password').placeholder = "Leave blank to keep current";
  }

  document.getElementById('userPanelOverlay').classList.add('show');
  document.getElementById('userDrawer').classList.add('show');
}

function closeUserDrawer(){
  EDIT_TARGET = null;
  document.getElementById('userForm').reset();
  document.getElementById('user_username').disabled = false;
  document.getElementById('userPanelOverlay').classList.remove('show');
  document.getElementById('userDrawer').classList.remove('show');
  document.getElementById('userFormStatus').innerText = "";
}

/* ---------- Update User ---------- */
async function updateUser(){
  if (!EDIT_TARGET) return;

  const username = EDIT_TARGET;
  const fullname = document.getElementById('user_fullname').value.trim();
  const role = document.getElementById('user_role').value;
  const barangay = document.getElementById('user_barangay').value;
  const password = document.getElementById('user_password').value;

  const updates = {
    Username: username,
    FullName: fullname,
    Role: role,
    AssignedBarangay: barangay
  };

  try {
    document.getElementById('saveUserBtn').disabled = true;

    if (password) {
      updates.PasswordHash = await sha256Hex(password);
    }

    const body = {
      action: "updateUser",
      auth: {
        username: localStorage.getItem("username"),
        pwHash: localStorage.getItem("pwHash")
      },
      targetUsername: username,
      updates: updates
    };

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(body)
    });

    const out = await res.json();
    document.getElementById('saveUserBtn').disabled = false;

    document.getElementById('userFormStatus').innerText =
      out.message || (out.success ? "Saved." : "Update failed");

    if (out.success) {
      alert(`User updated: ${username}`);
      closeUserDrawer();
      loadUsers();
    }

  } catch (err) {
    console.error(err);
    document.getElementById('saveUserBtn').disabled = false;
    document.getElementById('userFormStatus').innerText = "Update failed.";
  }
}

/* ---------- Delete User ---------- */
async function deleteUser(username){
  if (!confirm(`Delete user ${username}? This cannot be undone.`)) return;

  try {
    const body = {
      action: "deleteUser",
      auth: {
        username: localStorage.getItem("username"),
        pwHash: localStorage.getItem("pwHash")
      },
      targetUsername: username
    };

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(body)
    });

    const out = await res.json();

    if (out.success) {
      alert(`User deleted: ${username}`);
      loadUsers();
    } else {
      alert("Delete failed: " + (out.message || ""));
    }

  } catch (err) {
    console.error(err);
    alert("Delete failed.");
  }
}

/* ---------- Load Logs ---------- */
async function loadLogs(){
  try {
    const username = localStorage.getItem('username');
    const pwHash = localStorage.getItem('pwHash');

    const url = `${API_URL}?action=logs&username=${encodeURIComponent(username)}&pwHash=${encodeURIComponent(pwHash)}`;
    const res = await fetch(url);

    if (!res.ok) throw new Error("Unable to fetch logs");

    const data = await res.json();
    if (!data.success) {
      alert("Unable to load logs.");
      return;
    }

    const body = document.getElementById('logsBody');
    body.innerHTML = '';

    (data.logs || []).reverse().forEach(row => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(row.Timestamp)}</td>
        <td>${escapeHtml(row.Action)}</td>
        <td>${escapeHtml(row.Actor)}</td>
        <td>${escapeHtml(row.TargetSheet)}</td>
        <td>${escapeHtml(row.TargetID)}</td>
        <td>${escapeHtml(row.Details)}</td>
        <td>${escapeHtml(row.Duration)}</td>
      `;
      body.appendChild(tr);
    });

    document.getElementById('logsModal').style.display = 'flex';

  } catch (err) {
    console.error(err);
    alert("Failed to load logs.");
  }
}

/* ---------- SHA-256 Hash helper ---------- */
async function sha256Hex(message){
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2,"0")).join("");
}
