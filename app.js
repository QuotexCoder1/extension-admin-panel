“use strict”;

/* =========================================================
EXTENSION CONTROL PANEL
Same backend API:
/api/admin-login
/api/get-data
/api/save-data
========================================================= */

let files = {};
let currentFile = “withdrawal”;
let editingUID = null;
let selectedUID = null;
let searchText = “”;
let confirmAction = null;

const fileNames = {
withdrawal: “Withdrawal.json”,
yns: “yns.json”,
wns: “wns.json”
};

const $ = id => document.getElementById(id);

/* =========================================================
MESSAGE
========================================================= */

function showMessage(text, type = “”) {

const box = $("message");
box.textContent = text;
box.className = "message " + type;
clearTimeout(window.messageTimer);
window.messageTimer = setTimeout(() => {
    box.textContent = "";
    box.className = "message";
}, 4500);

}

/* =========================================================
ADMIN LOGIN
========================================================= */

const loginBox = $(“adminLogin”);
const passwordInput = $(“adminPassword”);
const loginBtn = $(“loginBtn”);
const loginStatus = $(“loginStatus”);
const loginEye = $(“loginEye”);

function setLoginStatus(text, type = “”) {

loginStatus.textContent = text;
loginStatus.className =
    "login-status " + type;

}

function unlockDashboard() {

loginBox.classList.add("hidden");
document.body.classList.remove("login-locked");
setTimeout(() => {
    loadData();
}, 100);

}

function lockDashboard() {

loginBox.classList.remove("hidden");
document.body.classList.add("login-locked");
passwordInput.value = "";
setLoginStatus("");
setTimeout(() => {
    passwordInput.focus();
}, 150);

}

loginEye.onclick = function () {

if (passwordInput.type === "password") {
    passwordInput.type = "text";
    loginEye.textContent = "🙈";
} else {
    passwordInput.type = "password";
    loginEye.textContent = "👁";
}
passwordInput.focus();

};

async function login() {

const password =
    passwordInput.value.trim();
if (!password) {
    setLoginStatus(
        "Enter admin password.",
        "error"
    );
    passwordInput.focus();
    return;
}
loginBtn.disabled = true;
loginBtn.innerHTML =
    "<span>VERIFYING...</span><span>•••</span>";
setLoginStatus(
    "Checking secure access...",
    "loading"
);
try {
    const response =
        await fetch(
            "/api/admin-login",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({
                    password: password
                })
            }
        );
    let data = {};
    try {
        data = await response.json();
    } catch {
        data = {};
    }
    if (!response.ok || !data.success) {
        setLoginStatus(
            data.error ||
            "Invalid admin password.",
            "error"
        );
        loginBtn.disabled = false;
        loginBtn.innerHTML =
            "<span>LOGIN</span><span>→</span>";
        passwordInput.focus();
        return;
    }
    setLoginStatus(
        "Access granted.",
        "success"
    );
    loginBtn.innerHTML =
        "<span>ACCESS GRANTED</span><span>✓</span>";
    setTimeout(unlockDashboard, 300);
} catch (error) {
    console.error(error);
    setLoginStatus(
        "Backend connection error.",
        "error"
    );
    loginBtn.disabled = false;
    loginBtn.innerHTML =
        "<span>LOGIN</span><span>→</span>";
}

}

loginBtn.onclick = login;

passwordInput.onkeydown = event => {

if (event.key === "Enter") {
    login();
}

};

$(“logoutBtn”).onclick = () => {
lockDashboard();
};

/* =========================================================
DATA
========================================================= */

async function loadData() {

$("backendStatus").textContent = "Loading";
try {
    const response =
        await fetch(
            "/api/get-data",
            {
                cache: "no-store"
            }
        );
    const result =
        await response.json();
    if (!response.ok || !result.success) {
        throw new Error(
            result.error ||
            "Unable to load GitHub data"
        );
    }
    files = result.files || {};
    $("backendStatus").textContent =
        "Online";
    render();
} catch (error) {
    console.error(error);
    $("backendStatus").textContent =
        "Error";
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
if (!files[currentFile].data) {
    files[currentFile].data = {};
}
return files[currentFile].data;

}

/* =========================================================
RENDER
========================================================= */

function render() {

const data = getCurrentData();
$("currentFile").textContent =
    fileNames[currentFile];
if (currentFile === "withdrawal") {
    $("settingsCard").style.display =
        "block";
    $("activeToggle").checked =
        data.active === true;
    $("passwordToggle").checked =
        data.password_required === true;
} else {
    $("settingsCard").style.display =
        "none";
}
renderUsers();
renderBlocked();
renderStats();

}

function renderUsers() {

const data = getCurrentData();
const users = data.users || {};
const entries =
    Object.entries(users);
const search =
    searchText.toLowerCase();
const filtered =
    entries.filter(([uid, user]) => {
        const name =
            String(user?.name || "")
                .toLowerCase();
        return (
            uid.toLowerCase()
                .includes(search) ||
            name.includes(search)
        );
    });
const grid = $("usersGrid");
grid.innerHTML = "";
$("visibleUsers").textContent =
    filtered.length;
if (!filtered.length) {
    $("emptyUsers")
        .classList
        .remove("hidden");
} else {
    $("emptyUsers")
        .classList
        .add("hidden");
}
const blocked =
    Array.isArray(data.blocked)
        ? data.blocked
        : [];
filtered.forEach(([uid, user]) => {
    const isBlocked =
        blocked.includes(uid);
    const name =
        user?.name || "Unnamed User";
    const initial =
        name
            .trim()
            .charAt(0)
            .toUpperCase() || "U";
    const card =
        document.createElement("button");
    card.type = "button";
    card.className =
        "user-card " +
        (isBlocked ? "is-blocked" : "");
    card.onclick =
        () => openProfile(uid);
    card.innerHTML = `
        <div class="user-card-top">
            <div class="user-avatar">
                ${escapeHtml(initial)}
            </div>
            <div class="user-card-arrow">
                →
            </div>
        </div>
        <div class="user-card-name">
            ${escapeHtml(name)}
        </div>
        <div class="user-card-uid">
            # ${escapeHtml(uid)}
        </div>
        <div class="user-card-bottom">
            <span class="user-status ${
                isBlocked
                    ? "blocked"
                    : "active"
            }">
                <i></i>
                ${
                    isBlocked
                        ? "BLOCKED"
                        : "ACTIVE"
                }
            </span>
            <span class="view-text">
                View profile
            </span>
        </div>
    `;
    grid.appendChild(card);
});

}

function renderStats() {

const data = getCurrentData();
const users =
    data.users || {};
const blocked =
    Array.isArray(data.blocked)
        ? data.blocked
        : [];
const total =
    Object.keys(users).length;
const active =
    Object.keys(users)
        .filter(uid =>
            !blocked.includes(uid)
        ).length;
$("totalUsers").textContent =
    total;
$("activeUsers").textContent =
    active;
$("blockedUsers").textContent =
    blocked.length;

}

function renderBlocked() {

const data = getCurrentData();
const blocked =
    Array.isArray(data.blocked)
        ? data.blocked
        : [];
const box =
    $("blockedList");
box.innerHTML = "";
$("blockedCount").textContent =
    blocked.length;
if (!blocked.length) {
    box.innerHTML = `
        <div class="blocked-empty">
            <span>✓</span>
            <div>
                <strong>No blocked users</strong>
                <small>All users currently have access.</small>
            </div>
        </div>
    `;
    return;
}
blocked.forEach(uid => {
    const item =
        document.createElement("div");
    item.className =
        "blocked-item";
    item.innerHTML = `
        <div class="blocked-user-icon">⊘</div>
        <div class="blocked-user-info">
            <strong>${escapeHtml(uid)}</strong>
            <small>Access restricted</small>
        </div>
        <button type="button">
            Unblock
        </button>
    `;
    item.querySelector("button")
        .onclick = () => unblockUser(uid);
    box.appendChild(item);
});

}

/* =========================================================
PROFILE
========================================================= */

function openProfile(uid) {

const data = getCurrentData();
const user =
    data.users?.[uid];
if (!user) return;
selectedUID = uid;
const blocked =
    Array.isArray(data.blocked)
        ? data.blocked
        : [];
const isBlocked =
    blocked.includes(uid);
const name =
    user.name || "Unnamed User";
const initial =
    name
        .trim()
        .charAt(0)
        .toUpperCase() || "U";
$("profileAvatar").textContent =
    initial;
$("profileName").textContent =
    name;
$("profileName2").textContent =
    name;
$("profileUID").textContent =
    uid;
$("profilePassword").textContent =
    "••••••••";
$("profilePassword").dataset.password =
    user.password || "";
const status =
    $("profileStatus");
status.className =
    "profile-status " +
    (isBlocked ? "blocked" : "active");
status.textContent =
    isBlocked
        ? "● BLOCKED"
        : "● ACTIVE";
$("profileBlockBtn").textContent =
    isBlocked
        ? "✓ Unblock User"
        : "⊘ Block User";
$("profileBlockBtn").className =
    "btn " +
    (isBlocked ? "primary" : "secondary");
$("profileModal")
    .classList
    .remove("hidden");

}

function closeProfile() {

$("profileModal")
    .classList
    .add("hidden");
selectedUID = null;
$("profilePassword").textContent =
    "••••••••";

}

$(“closeProfileBtn”).onclick =
closeProfile;

$(“profileModal”).onclick =
event => {

    if (
        event.target ===
        $("profileModal")
    ) {
        closeProfile();
    }
};

$(“copyUidBtn”).onclick =
async () => {

    if (!selectedUID) return;
    try {
        await navigator.clipboard
            .writeText(selectedUID);
        $("copyUidBtn").textContent =
            "Copied ✓";
        setTimeout(() => {
            $("copyUidBtn").textContent =
                "Copy";
        }, 1200);
    } catch {
        showMessage(
            "Unable to copy UID.",
            "error"
        );
    }
};

$(“profilePasswordBtn”).onclick =
function () {

    const password =
        $("profilePassword")
            .dataset.password || "";
    if (
        $("profilePassword")
            .textContent ===
        "••••••••"
    ) {
        $("profilePassword")
            .textContent =
            password || "No password";
        this.textContent =
            "Hide";
    } else {
        $("profilePassword")
            .textContent =
            "••••••••";
        this.textContent =
            "Show";
    }
};

$(“profileEditBtn”).onclick =
() => {

    if (!selectedUID) return;
    const uid =
        selectedUID;
    closeProfile();
    openEditUser(uid);
};

$(“profileBlockBtn”).onclick =
() => {

    if (!selectedUID) return;
    const data =
        getCurrentData();
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
        if (
            data.users &&
            data.users[selectedUID]
        ) {
            openProfile(selectedUID);
        }
    }, 100);
};

$(“profileDeleteBtn”).onclick =
() => {

    if (!selectedUID) return;
    const uid =
        selectedUID;
    closeProfile();
    askConfirm(
        "Delete User?",
        `This will permanently remove ${uid} from the current data.`,
        "Delete",
        () => deleteUser(uid)
    );
};

/* =========================================================
ADD / EDIT USER
========================================================= */

$(“addUserBtn”).onclick =
function () {

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
    setTimeout(() => {
        $("uidInput").focus();
    }, 100);
};

function openEditUser(uid) {

const data =
    getCurrentData();
const user =
    data.users?.[uid];
if (!user) return;
editingUID = uid;
$("modalTitle").textContent =
    "Edit User";
$("uidInput").value =
    uid;
$("nameInput").value =
    user.name || "";
$("userPasswordInput").value =
    user.password || "";
$("uidInput").disabled =
    false;
$("userModal")
    .classList
    .remove("hidden");
setTimeout(() => {
    $("nameInput").focus();
}, 100);

}

$(“confirmUserBtn”).onclick =
function () {

    const newUID =
        $("uidInput")
            .value
            .trim();
    const name =
        $("nameInput")
            .value
            .trim();
    const password =
        $("userPasswordInput")
            .value;
    if (!newUID) {
        showMessage(
            "UID is required.",
            "error"
        );
        return;
    }
    if (!name) {
        showMessage(
            "User name is required.",
            "error"
        );
        return;
    }
    const data =
        getCurrentData();
    if (!data.users) {
        data.users = {};
    }
    /*
     * ADD USER
     */
    if (!editingUID) {
        if (data.users[newUID]) {
            showMessage(
                "This UID already exists.",
                "error"
            );
            return;
        }
        data.users[newUID] = {
            name: name,
            password: password
        };
        closeUserModal();
        render();
        showMessage(
            "User added. Press Save to GitHub.",
            "success"
        );
        return;
    }
    /*
     * EDIT USER
     * Supports changing UID.
     */
    const oldUID =
        editingUID;
    if (
        newUID !== oldUID &&
        data.users[newUID]
    ) {
        showMessage(
            "New UID already exists.",
            "error"
        );
        return;
    }
    const oldUser =
        data.users[oldUID] || {};
    const newUser = {
        ...oldUser,
        name: name,
        password: password
    };
    if (newUID !== oldUID) {
        data.users[newUID] =
            newUser;
        delete data.users[oldUID];
        if (
            Array.isArray(data.blocked)
        ) {
            data.blocked =
                data.blocked.map(uid =>
                    uid === oldUID
                        ? newUID
                        : uid
                );
        }
    } else {
        data.users[oldUID] =
            newUser;
    }
    editingUID = null;
    closeUserModal();
    render();
    showMessage(
        "User updated. Press Save to GitHub.",
        "success"
    );
};

function closeUserModal() {

$("userModal")
    .classList
    .add("hidden");
editingUID = null;

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

/* =========================================================
BLOCK / UNBLOCK / DELETE
========================================================= */

function blockUser(uid) {

const data =
    getCurrentData();
if (!Array.isArray(data.blocked)) {
    data.blocked = [];
}
if (!data.blocked.includes(uid)) {
    data.blocked.push(uid);
}
render();
showMessage(
    uid +
    " blocked. Press Save to GitHub.",
    "success"
);

}

function unblockUser(uid) {

const data =
    getCurrentData();
if (Array.isArray(data.blocked)) {
    data.blocked =
        data.blocked.filter(
            x => x !== uid
        );
}
render();
showMessage(
    uid +
    " unblocked. Press Save to GitHub.",
    "success"
);

}

function deleteUser(uid) {

const data =
    getCurrentData();
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
    "User deleted. Press Save to GitHub.",
    "success"
);

}

/* =========================================================
SETTINGS
========================================================= */

$(“activeToggle”).onchange =
event => {

    const data =
        getCurrentData();
    data.active =
        event.target.checked;
    showMessage(
        "Extension setting changed. Save to GitHub.",
        "success"
    );
};

$(“passwordToggle”).onchange =
event => {

    const data =
        getCurrentData();
    data.password_required =
        event.target.checked;
    showMessage(
        "Password setting changed. Save to GitHub.",
        "success"
    );
};

/* =========================================================
SEARCH
========================================================= */

$(“searchInput”).oninput =
event => {

    searchText =
        event.target.value.trim();
    renderUsers();
};

document.addEventListener(
“keydown”,
event => {

    if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
    ) {
        event.preventDefault();
        $("searchInput").focus();
    }
    if (
        event.key === "Escape"
    ) {
        if (
            !$("profileModal")
                .classList
                .contains("hidden")
        ) {
            closeProfile();
        }
        if (
            !$("userModal")
                .classList
                .contains("hidden")
        ) {
            closeUserModal();
        }
        if (
            !$("confirmModal")
                .classList
                .contains("hidden")
        ) {
            closeConfirm();
        }
    }
}

);

/* =========================================================
TABS
========================================================= */

document
.querySelectorAll(”.tab”)
.forEach(tab => {

    tab.onclick = function () {
        document
            .querySelectorAll(".tab")
            .forEach(item =>
                item.classList
                    .remove("active")
            );
        this.classList.add("active");
        currentFile =
            this.dataset.file;
        searchText = "";
        $("searchInput").value =
            "";
        render();
    };
});

/* =========================================================
REFRESH
========================================================= */

$(“refreshBtn”).onclick =
async function () {

    this.disabled = true;
    this.innerHTML =
        "<span>↻</span> Loading...";
    await loadData();
    this.disabled = false;
    this.innerHTML =
        "<span>↻</span> Refresh";
};

/* =========================================================
SAVE TO GITHUB
========================================================= */

$(“saveBtn”).onclick =
async function () {

    const file =
        files[currentFile];
    if (!file) {
        showMessage(
            "No backend file loaded.",
            "error"
        );
        return;
    }
    const btn =
        $("saveBtn");
    btn.disabled = true;
    btn.innerHTML =
        "<span>⟳</span> Saving...";
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
            "<span>💾</span> Save to GitHub";
    }
};

/* =========================================================
CONFIRMATION
========================================================= */

function askConfirm(
title,
text,
buttonText,
action
) {

$("confirmTitle").textContent =
    title;
$("confirmText").textContent =
    text;
$("confirmOk").textContent =
    buttonText;
confirmAction =
    action;
$("confirmModal")
    .classList
    .remove("hidden");

}

function closeConfirm() {

$("confirmModal")
    .classList
    .add("hidden");
confirmAction = null;

}

$(“confirmCancel”).onclick =
closeConfirm;

$(“confirmOk”).onclick =
function () {

    if (typeof confirmAction === "function") {
        confirmAction();
    }
    closeConfirm();
};

$(“confirmModal”).onclick =
event => {

    if (
        event.target ===
        $("confirmModal")
    ) {
        closeConfirm();
    }
};

/* =========================================================
HTML ESCAPE
========================================================= */

function escapeHtml(value) {

return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}

/* =========================================================
START
========================================================= */

setTimeout(() => {

passwordInput.focus();

}, 250);
