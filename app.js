“use strict”;

/* =========================
ADMIN LOGIN
========================= */

const ADMIN_PASSWORD = “9”;

const $ = id => document.getElementById(id);

let files = {};
let currentFile = “withdrawal”;
let editingUID = null;
let selectedUID = null;
let searchText = “”;
let profilePasswordVisible = false;

/* =========================
LOGIN
========================= */

function unlockDashboard() {
$(“loginScreen”).classList.add(“hidden”);
document.body.classList.remove(“locked”);

sessionStorage.setItem("admin_logged_in", "true");
setTimeout(() => {
    loadData();
}, 150);

}

function lockDashboard() {
sessionStorage.removeItem(“admin_logged_in”);

$("loginScreen").classList.remove("hidden");
document.body.classList.add("locked");
$("adminPassword").value = "";
$("loginError").textContent = "";
$("adminPassword").focus();

}

function login() {

const password = $("adminPassword").value;
if (password === ADMIN_PASSWORD) {
    $("loginButton").classList.add("loading");
    $("loginButton").innerHTML =
        "<span>Unlocking...</span><b>✓</b>";
    setTimeout(() => {
        unlockDashboard();
    }, 300);
} else {
    $("loginError").textContent =
        "❌ Incorrect admin password";
    $("adminPassword").classList.add("shake");
    setTimeout(() => {
        $("adminPassword").classList.remove("shake");
    }, 500);
    $("adminPassword").focus();
}

}

$(“loginButton”).onclick = login;

$(“adminPassword”).onkeydown = event => {
if (event.key === “Enter”) {
login();
}
};

$(“passwordEye”).onclick = function () {

const input = $("adminPassword");
if (input.type === "password") {
    input.type = "text";
    this.textContent = "🙈";
} else {
    input.type = "password";
    this.textContent = "👁";
}
input.focus();

};

$(“logoutBtn”).onclick = lockDashboard;

/* =========================
MESSAGE
========================= */

let messageTimer;

function showMessage(text, type = “”) {

const box = $("message");
clearTimeout(messageTimer);
box.textContent = text;
box.className = "message " + type;
requestAnimationFrame(() => {
    box.classList.add("show");
});
messageTimer = setTimeout(() => {
    box.classList.remove("show");
}, 4500);

}

/* =========================
DATA
========================= */

const fileNames = {
withdrawal: “Withdrawal.json”,
yns: “yns.json”,
wns: “wns.json”
};

async function loadData() {

$("backendStatus").textContent = "Loading";
$("backendStatus").className = "loading-status";
try {
    const response = await fetch(
        "/api/get-data",
        {
            cache: "no-store"
        }
    );
    const result = await response.json();
    if (!response.ok || !result.success) {
        throw new Error(
            result.error ||
            "Unable to load GitHub data"
        );
    }
    files = result.files || {};
    $("backendStatus").textContent = "Online";
    $("backendStatus").className = "online-status";
    render();
} catch (error) {
    console.error(error);
    $("backendStatus").textContent = "Error";
    $("backendStatus").className = "error-status";
    showMessage(
        "❌ " + error.message,
        "error"
    );
}

}

function getCurrentData() {

if (!files[currentFile]) {
    return {};
}
return files[currentFile].data || {};

}

/* =========================
RENDER
========================= */

function render() {

const data = getCurrentData();
$("currentFile").textContent =
    fileNames[currentFile];
if (currentFile === "withdrawal") {
    $("settingsCard").style.display = "";
    $("activeToggle").checked =
        data.active === true;
    $("passwordToggle").checked =
        data.password_required === true;
} else {
    $("settingsCard").style.display = "none";
}
renderUsers();
renderBlocked();
renderStats();

}

function renderUsers() {

const data = getCurrentData();
const users = data.users || {};
const blocked = Array.isArray(data.blocked)
    ? data.blocked
    : [];
const grid = $("usersGrid");
grid.innerHTML = "";
const entries = Object.entries(users);
const search = searchText.toLowerCase();
const filtered = entries.filter(([uid, user]) => {
    return (
        uid.toLowerCase().includes(search) ||
        String(user?.name || "")
            .toLowerCase()
            .includes(search)
    );
});
$("resultCount").textContent =
    filtered.length;
if (!filtered.length) {
    $("emptyUsers").classList.remove("hidden");
} else {
    $("emptyUsers").classList.add("hidden");
}
filtered.forEach(([uid, user]) => {
    const isBlocked = blocked.includes(uid);
    const card = document.createElement("div");
    card.className =
        "user-card " +
        (isBlocked ? "blocked-card-user" : "");
    const name =
        user?.name || "Unnamed User";
    const firstLetter =
        name.charAt(0).toUpperCase() || "U";
    card.innerHTML = `
        <div class="user-card-top">
            <div class="user-avatar">
                ${escapeHTML(firstLetter)}
            </div>
            <div class="user-main-info">
                <strong>
                    ${escapeHTML(name)}
                </strong>
                <span>
                    ${escapeHTML(uid)}
                </span>
            </div>
            <div class="user-menu-dot">
                •••
            </div>
        </div>
        <div class="user-card-middle">
            <div>
                <span class="mini-label">PASSWORD</span>
                <code>••••••••</code>
            </div>
            <span class="mini-status ${
                isBlocked ? "blocked" : "active"
            }">
                ${isBlocked ? "BLOCKED" : "ACTIVE"}
            </span>
        </div>
        <div class="user-card-bottom">
            <span>
                ${isBlocked
                    ? "Access restricted"
                    : "Access allowed"}
            </span>
            <b>
                View Profile →
            </b>
        </div>
    `;
    card.onclick = () => openUserProfile(uid);
    grid.appendChild(card);
});

}

/* =========================
STATS
========================= */

function renderStats() {

const data = getCurrentData();
const users = data.users || {};
const blocked = Array.isArray(data.blocked)
    ? data.blocked
    : [];
const total = Object.keys(users).length;
const active = Object.keys(users)
    .filter(uid => !blocked.includes(uid))
    .length;
$("totalUsers").textContent = total;
$("activeUsers").textContent = active;
$("blockedUsers").textContent = blocked.length;

}

/* =========================
BLOCKED
========================= */

function renderBlocked() {

const data = getCurrentData();
const blocked = Array.isArray(data.blocked)
    ? data.blocked
    : [];
const box = $("blockedList");
box.innerHTML = "";
$("blockedCount").textContent =
    blocked.length;
if (!blocked.length) {
    box.innerHTML = `
        <div class="blocked-empty">
            <span>✓</span>
            <div>
                <strong>No blocked UIDs</strong>
                <small>All users currently have access.</small>
            </div>
        </div>
    `;
    return;
}
blocked.forEach(uid => {
    const item = document.createElement("div");
    item.className = "blocked-item";
    item.innerHTML = `
        <div>
            <strong>${escapeHTML(uid)}</strong>
            <span>Access blocked</span>
        </div>
        <button>Unblock</button>
    `;
    item.querySelector("button").onclick =
        event => {
            event.stopPropagation();
            unblockUser(uid);
        };
    box.appendChild(item);
});

}

/* =========================
USER PROFILE
========================= */

function openUserProfile(uid) {

const data = getCurrentData();
const user = data.users?.[uid];
if (!user) return;
selectedUID = uid;
const blocked =
    Array.isArray(data.blocked)
        ? data.blocked.includes(uid)
        : false;
const name = user.name || "Unnamed User";
$("profileAvatar").textContent =
    name.charAt(0).toUpperCase();
$("profileName").textContent = name;
$("profileUID").textContent = uid;
$("profileUserName").textContent = name;
profilePasswordVisible = false;
$("profilePassword").textContent =
    "••••••••";
$("profileAccountStatus").textContent =
    blocked ? "Blocked" : "Active";
$("profileStatus").textContent =
    blocked ? "BLOCKED" : "ACTIVE";
$("profileStatus").className =
    "profile-status " +
    (blocked ? "blocked" : "active");
$("profileBlockBtn").textContent =
    blocked ? "Unblock User" : "Block User";
$("profileBlockBtn").className =
    blocked
        ? "primary-btn"
        : "secondary-btn";
$("userDetailModal")
    .classList
    .remove("hidden");

}

function closeProfile() {

$("userDetailModal")
    .classList
    .add("hidden");
selectedUID = null;

}

$(“closeDetailBtn”).onclick = closeProfile;

$(“userDetailModal”).onclick = event => {

if (event.target === $("userDetailModal")) {
    closeProfile();
}

};

$(“toggleProfilePassword”).onclick = function () {

if (!selectedUID) return;
const user =
    getCurrentData().users?.[selectedUID];
if (!user) return;
profilePasswordVisible =
    !profilePasswordVisible;
$("profilePassword").textContent =
    profilePasswordVisible
        ? (user.password || "—")
        : "••••••••";
this.textContent =
    profilePasswordVisible
        ? "🙈"
        : "👁";

};

$(“copyUID”).onclick = async function () {

if (!selectedUID) return;
try {
    await navigator.clipboard.writeText(selectedUID);
    this.textContent = "✓";
    showMessage(
        "UID copied successfully",
        "success"
    );
    setTimeout(() => {
        this.textContent = "⧉";
    }, 1200);
} catch {
    showMessage(
        "Unable to copy UID",
        "error"
    );
}

};

$(“profileEditBtn”).onclick = function () {

if (!selectedUID) return;
const uid = selectedUID;
closeProfile();
openEditUser(uid);

};

$(“profileBlockBtn”).onclick = function () {

if (!selectedUID) return;
const data = getCurrentData();
const blocked =
    Array.isArray(data.blocked)
        ? data.blocked
        : [];
if (blocked.includes(selectedUID)) {
    unblockUser(selectedUID);
} else {
    blockUser(selectedUID);
}
setTimeout(() => {
    if (selectedUID) {
        openUserProfile(selectedUID);
    }
}, 50);

};

$(“profileDeleteBtn”).onclick = function () {

if (!selectedUID) return;
const uid = selectedUID;
if (!confirm(
    "Delete user " + uid + "?"
)) {
    return;
}
deleteUser(uid);
closeProfile();

};

/* =========================
ADD USER
========================= */

$(“addUserBtn”).onclick = function () {

editingUID = null;
$("modalTitle").textContent =
    "Add User";
$("uidInput").value = "";
$("nameInput").value = "";
$("userPasswordInput").value = "";
$("uidInput").disabled = false;
$("userModal")
    .classList
    .remove("hidden");
$("uidInput").focus();

};

function openEditUser(uid) {

const data = getCurrentData();
const user = data.users?.[uid];
if (!user) return;
editingUID = uid;
$("modalTitle").textContent =
    "Edit User";
$("uidInput").value = uid;
$("nameInput").value =
    user.name || "";
$("userPasswordInput").value =
    user.password || "";
/*
   UID IS EDITABLE.
   We keep it enabled so admin can change it.
*/
$("uidInput").disabled = false;
$("userModal")
    .classList
    .remove("hidden");
$("nameInput").focus();

}

/* =========================
SAVE USER
========================= */

$(“confirmUserBtn”).onclick = function () {

const newUID =
    $("uidInput").value.trim();
const name =
    $("nameInput").value.trim();
const password =
    $("userPasswordInput").value;
if (!newUID) {
    showMessage(
        "UID is required",
        "error"
    );
    return;
}
if (!name) {
    showMessage(
        "User name is required",
        "error"
    );
    return;
}
const data = getCurrentData();
if (!data.users) {
    data.users = {};
}
/*
   EDIT UID
*/
if (
    editingUID &&
    editingUID !== newUID
) {
    if (data.users[newUID]) {
        showMessage(
            "New UID already exists",
            "error"
        );
        return;
    }
    data.users[newUID] =
        data.users[editingUID];
    delete data.users[editingUID];
    if (Array.isArray(data.blocked)) {
        data.blocked =
            data.blocked.map(uid =>
                uid === editingUID
                    ? newUID
                    : uid
            );
    }
    editingUID = newUID;
}
if (
    !editingUID &&
    data.users[newUID]
) {
    showMessage(
        "This UID already exists",
        "error"
    );
    return;
}
data.users[newUID] = {
    name: name,
    password: password
};
if (Array.isArray(data.blocked)) {
    /*
       New/editing user remains
       in current access state.
    */
}
closeUserModal();
render();
showMessage(
    editingUID
        ? "User updated. Press Save to GitHub."
        : "User added. Press Save to GitHub.",
    "success"
);

};

/* =========================
DELETE
========================= */

function deleteUser(uid) {

const data = getCurrentData();
if (data.users) {
    delete data.users[uid];
}
if (Array.isArray(data.blocked)) {
    data.blocked =
        data.blocked.filter(
            x => x !== uid
        );
}
render();
showMessage(
    "UID deleted. Press Save to GitHub.",
    "success"
);

}

/* =========================
BLOCK
========================= */

function blockUser(uid) {

const data = getCurrentData();
if (!Array.isArray(data.blocked)) {
    data.blocked = [];
}
if (!data.blocked.includes(uid)) {
    data.blocked.push(uid);
}
render();
showMessage(
    uid + " blocked. Press Save to GitHub.",
    "success"
);

}

function unblockUser(uid) {

const data = getCurrentData();
if (Array.isArray(data.blocked)) {
    data.blocked =
        data.blocked.filter(
            x => x !== uid
        );
}
render();
showMessage(
    uid + " unblocked. Press Save to GitHub.",
    "success"
);

}

/* =========================
SETTINGS
========================= */

$(“activeToggle”).onchange =
event => {

    const data = getCurrentData();
    data.active =
        event.target.checked;
    showMessage(
        "Active setting changed. Save to GitHub.",
        "success"
    );
};

$(“passwordToggle”).onchange =
event => {

    const data = getCurrentData();
    data.password_required =
        event.target.checked;
    showMessage(
        "Password setting changed. Save to GitHub.",
        "success"
    );
};

/* =========================
SEARCH
========================= */

$(“searchInput”).oninput =
event => {

    searchText =
        event.target.value.trim();
    renderUsers();
};

/* =========================
TABS
========================= */

document
.querySelectorAll(”.tab”)
.forEach(tab => {

    tab.onclick = function () {
        document
            .querySelectorAll(".tab")
            .forEach(item =>
                item.classList.remove("active")
            );
        this.classList.add("active");
        currentFile =
            this.dataset.file;
        searchText = "";
        $("searchInput").value = "";
        render();
    };
});

/* =========================
SAVE GITHUB
========================= */

$(“saveBtn”).onclick =
async function () {

    const file =
        files[currentFile];
    if (!file) {
        showMessage(
            "No backend file loaded",
            "error"
        );
        return;
    }
    const btn = $("saveBtn");
    btn.disabled = true;
    btn.innerHTML =
        "⏳ Saving...";
    try {
        const response =
            await fetch(
                "/api/save-data",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify({
                        file:
                            currentFile,
                        data:
                            file.data,
                        sha:
                            file.sha
                    })
                }
            );
        const result =
            await response.json();
        if (
            !response.ok ||
            !result.success
        ) {
            throw new Error(
                result.error ||
                "GitHub save failed"
            );
        }
        showMessage(
            "✓ GitHub updated successfully!",
            "success"
        );
        await loadData();
    } catch (error) {
        console.error(error);
        showMessage(
            "❌ " + error.message,
            "error"
        );
    } finally {
        btn.disabled = false;
        btn.innerHTML =
            "💾 Save to GitHub";
    }
};

/* =========================
REFRESH
========================= */

$(“refreshBtn”).onclick =
function () {

    this.classList.add("rotating");
    setTimeout(() => {
        this.classList.remove("rotating");
    }, 700);
    loadData();
};

/* =========================
USER MODAL
========================= */

function closeUserModal() {

$("userModal")
    .classList.add("hidden");

}

$(“cancelBtn”).onclick =
closeUserModal;

$(“closeModalBtn”).onclick =
closeUserModal;

$(“userModal”).onclick =
event => {

    if (
        event.target ===
        $("userModal")
    ) {
        closeUserModal();
    }
};

$(“showPasswordBtn”).onclick =
function () {

    const input =
        $("userPasswordInput");
    if (input.type === "password") {
        input.type = "text";
        this.textContent = "🙈";
    } else {
        input.type = "password";
        this.textContent = "👁";
    }
};

/* =========================
ESC CLOSE
========================= */

document.onkeydown = event => {

if (event.key !== "Escape") return;
closeProfile();
closeUserModal();

};

/* =========================
HTML ESCAPE
========================= */

function escapeHTML(value) {

return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}

/* =========================
START
========================= */

if (
sessionStorage.getItem(“admin_logged_in”)
=== “true”
) {

unlockDashboard();

} else {

$("adminPassword").focus();

}
