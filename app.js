"use strict";
/* =========================================================
   ADMIN PASSWORD
   ========================================================= */
const ADMIN_PASSWORD = "9";
/* =========================================================
   GLOBAL STATE
   ========================================================= */
let files = {};
let currentFile = "withdrawal";
let editingUID = null;
let selectedUID = null;
let searchText = "";
const fileNames = {
    withdrawal: "Withdrawal.json",
    yns: "yns.json",
    wns: "wns.json"
};
/* =========================================================
   SHORTCUT
   ========================================================= */
const $ = id => document.getElementById(id);
/* =========================================================
   LOGIN
   ========================================================= */
const loginBtn = $("loginBtn");
const passwordInput = $("adminPassword");
const loginEye = $("loginEye");
const loginStatus = $("loginStatus");
function unlockDashboard() {
    document.body.classList.remove("locked");
    $("adminLogin").classList.add("hidden");
    passwordInput.value = "";
}
function lockDashboard() {
    document.body.classList.add("locked");
    $("adminLogin").classList.remove("hidden");
    passwordInput.value = "";
    loginStatus.textContent = "";
    loginBtn.disabled = false;
    loginBtn.innerHTML =
        "<span>Unlock Dashboard</span><b>→</b>";
}
function login() {
    const password = passwordInput.value;
    if (!password) {
        loginStatus.textContent =
            "Please enter your admin password.";
        loginStatus.className =
            "login-status error";
        passwordInput.focus();
        return;
    }
    loginBtn.disabled = true;
    loginBtn.innerHTML =
        "<span>Checking...</span><b>•••</b>";
    setTimeout(() => {
        if (password === ADMIN_PASSWORD) {
            loginStatus.textContent =
                "✓ Access granted";
            loginStatus.className =
                "login-status success";
            setTimeout(() => {
                unlockDashboard();
                loadData();
            }, 300);
        } else {
            loginStatus.textContent =
                "✕ Incorrect password";
            loginStatus.className =
                "login-status error";
            loginBtn.disabled = false;
            loginBtn.innerHTML =
                "<span>Unlock Dashboard</span><b>→</b>";
            passwordInput.select();
        }
    }, 250);
}
loginBtn.onclick = login;
passwordInput.onkeydown = event => {
    if (event.key === "Enter") {
        login();
    }
};
loginEye.onclick = () => {
    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        loginEye.textContent = "🙈";
    } else {
        passwordInput.type = "password";
        loginEye.textContent = "👁";
    }
    passwordInput.focus();
};
$("logoutBtn").onclick = () => {
    lockDashboard();
    setTimeout(() => {
        passwordInput.focus();
    }, 100);
};
/* =========================================================
   MESSAGE
   ========================================================= */
let messageTimer;
function showMessage(text, type = "") {
    const box = $("message");
    clearTimeout(messageTimer);
    box.textContent = text;
    box.className =
        "message " + type;
    messageTimer = setTimeout(() => {
        box.textContent = "";
        box.className = "message";
    }, 4500);
}
/* =========================================================
   LOAD DATA
   ========================================================= */
async function loadData() {
    $("backendStatus").textContent = "Loading";
    $("backendStatus").className = "loading-text";
    try {
        const response = await fetch(
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
                "Unable to load backend data"
            );
        }
        files =
            result.files || {};
        $("backendStatus").textContent =
            "Online";
        $("backendStatus").className =
            "online-text";
        render();
    } catch (error) {
        console.error(error);
        $("backendStatus").textContent =
            "Error";
        $("backendStatus").className =
            "error-text";
        showMessage(
            "❌ " + error.message,
            "error"
        );
    }
}
/* =========================================================
   CURRENT DATA
   ========================================================= */
function getCurrentData() {
    if (!files[currentFile]) {
        files[currentFile] = {
            data: {}
        };
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
    const data =
        getCurrentData();
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
/* =========================================================
   USERS
   ========================================================= */
function renderUsers() {
    const data =
        getCurrentData();
    const users =
        data.users || {};
    const blocked =
        Array.isArray(data.blocked)
            ? data.blocked
            : [];
    const grid =
        $("usersGrid");
    grid.innerHTML = "";
    const search =
        searchText.toLowerCase();
    const entries =
        Object.entries(users);
    const filtered =
        entries.filter(([uid, user]) => {
            return (
                uid.toLowerCase().includes(search) ||
                String(user?.name || "")
                    .toLowerCase()
                    .includes(search)
            );
        });
    $("emptyUsers").classList.toggle(
        "hidden",
        filtered.length > 0
    );
    filtered.forEach(([uid, user]) => {
        const isBlocked =
            blocked.includes(uid);
        const card =
            document.createElement("button");
        card.type = "button";
        card.className =
            "user-card";
        card.onclick =
            () => openUserDetails(uid);
        const name =
            user?.name || "Unnamed User";
        const firstLetter =
            name.charAt(0).toUpperCase() || "U";
        card.innerHTML = `
            <div class="user-card-top">
                <div class="mini-avatar">
                    ${escapeHTML(firstLetter)}
                </div>
                <span class="status-dot ${
                    isBlocked
                        ? "blocked-dot"
                        : "active-dot"
                }"></span>
            </div>
            <div class="user-card-body">
                <strong>
                    ${escapeHTML(name)}
                </strong>
                <span class="user-uid">
                    ${escapeHTML(uid)}
                </span>
            </div>
            <div class="user-card-footer">
                <span class="${
                    isBlocked
                        ? "card-status blocked-text"
                        : "card-status active-text"
                }">
                    ${
                        isBlocked
                            ? "BLOCKED"
                            : "ACTIVE"
                    }
                </span>
                <span class="view-user">
                    View →
                </span>
            </div>
        `;
        grid.appendChild(card);
    });
}
/* =========================================================
   ESCAPE HTML
   ========================================================= */
function escapeHTML(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
/* =========================================================
   STATS
   ========================================================= */
function renderStats() {
    const data =
        getCurrentData();
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
            )
            .length;
    $("totalUsers").textContent =
        total;
    $("activeUsers").textContent =
        active;
    $("blockedUsers").textContent =
        blocked.length;
}
/* =========================================================
   BLOCKED
   ========================================================= */
function renderBlocked() {
    const data =
        getCurrentData();
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
                <div>✓</div>
                <span>No blocked users</span>
                <small>
                    All users currently have access.
                </small>
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
            <div>
                <span class="blocked-uid">
                    ${escapeHTML(uid)}
                </span>
                <small>
                    Access restricted
                </small>
            </div>
            <button>
                Unblock
            </button>
        `;
        item.querySelector("button")
            .onclick = () =>
                unblockUser(uid);
        box.appendChild(item);
    });
}
/* =========================================================
   USER DETAILS
   ========================================================= */
function openUserDetails(uid) {
    const data =
        getCurrentData();
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
    $("detailAvatar").textContent =
        name.charAt(0).toUpperCase();
    $("detailName").textContent =
        name;
    $("detailUID").textContent =
        uid;
    $("detailPassword").textContent =
        user.password || "—";
    const status =
        $("detailStatus");
    status.textContent =
        isBlocked
            ? "BLOCKED"
            : "ACTIVE";
    status.className =
        "status-badge " +
        (
            isBlocked
                ? "status-blocked"
                : "status-active"
        );
    $("detailBlockBtn").textContent =
        isBlocked
            ? "✓ Unblock User"
            : "⊘ Block User";
    $("userDetailModal")
        .classList
        .remove("hidden");
}
/* =========================================================
   DETAIL ACTIONS
   ========================================================= */
$("closeDetailBtn").onclick =
    closeUserDetails;
$("userDetailModal").onclick =
    event => {
        if (
            event.target ===
            $("userDetailModal")
        ) {
            closeUserDetails();
        }
    };
function closeUserDetails() {
    $("userDetailModal")
        .classList
        .add("hidden");
    selectedUID = null;
}
$("detailEditBtn").onclick = () => {
    if (!selectedUID) return;
    const uid = selectedUID;
    closeUserDetails();
    openEditUser(uid);
};
$("detailBlockBtn").onclick = () => {
    if (!selectedUID) return;
    const uid = selectedUID;
    const data =
        getCurrentData();
    const blocked =
        Array.isArray(data.blocked)
            ? data.blocked
            : [];
    if (blocked.includes(uid)) {
        unblockUser(uid);
    } else {
        blockUser(uid);
    }
    setTimeout(() => {
        if (data.users?.[uid]) {
            openUserDetails(uid);
        }
    }, 50);
};
$("detailDeleteBtn").onclick = () => {
    if (!selectedUID) return;
    const uid = selectedUID;
    closeUserDetails();
    deleteUser(uid);
};
/* =========================================================
   COPY
   ========================================================= */
async function copyText(text, button) {
    try {
        await navigator.clipboard.writeText(text);
        const old =
            button.textContent;
        button.textContent =
            "Copied ✓";
        setTimeout(() => {
            button.textContent = old;
        }, 1200);
    } catch {
        showMessage(
            "Unable to copy",
            "error"
        );
    }
}
$("copyUIDBtn").onclick = () => {
    copyText(
        $("detailUID").textContent,
        $("copyUIDBtn")
    );
};
$("copyPasswordBtn").onclick = () => {
    copyText(
        $("detailPassword").textContent,
        $("copyPasswordBtn")
    );
};
/* =========================================================
   ADD USER
   ========================================================= */
$("addUserBtn").onclick = () => {
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
/* =========================================================
   EDIT USER
   ========================================================= */
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
        true;
    $("userModal")
        .classList
        .remove("hidden");
    $("nameInput").focus();
}
/* =========================================================
   SAVE USER
   ========================================================= */
$("confirmUserBtn").onclick = () => {
    const uid =
        $("uidInput").value.trim();
    const name =
        $("nameInput").value.trim();
    const password =
        $("userPasswordInput").value;
    if (!uid) {
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
    if (!editingUID && data.users[uid]) {
        showMessage(
            "This UID already exists.",
            "error"
        );
        return;
    }
    data.users[uid] = {
        name: name,
        password: password
    };
    if (Array.isArray(data.blocked)) {
        data.blocked =
            data.blocked.filter(
                x => x !== uid
            );
    }
    closeUserModal();
    render();
    showMessage(
        "✓ User updated. Press Save to GitHub.",
        "success"
    );
};
/* =========================================================
   DELETE
   ========================================================= */
function deleteUser(uid) {
    const confirmed =
        window.confirm(
            "Delete user " + uid + "?"
        );
    if (!confirmed) return;
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
   BLOCK
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
        uid + " blocked. Press Save to GitHub.",
        "success"
    );
}
/* =========================================================
   UNBLOCK
   ========================================================= */
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
        uid + " unblocked. Press Save to GitHub.",
        "success"
    );
}
/* =========================================================
   SETTINGS
   ========================================================= */
$("activeToggle").onchange =
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
$("passwordToggle").onchange =
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
$("searchInput").oninput =
    event => {
        searchText =
            event.target.value.trim();
        renderUsers();
    };
/* =========================================================
   SAVE TO GITHUB
   ========================================================= */
$("saveBtn").onclick =
    async () => {
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
        btn.textContent =
            "Saving...";
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
            btn.textContent =
                "💾 Save to GitHub";
        }
    };
/* =========================================================
   TABS
   ========================================================= */
document
    .querySelectorAll(".tab")
    .forEach(tab => {
        tab.onclick = () => {
            document
                .querySelectorAll(".tab")
                .forEach(item =>
                    item.classList.remove("active")
                );
            tab.classList.add("active");
            currentFile =
                tab.dataset.file;
            searchText = "";
            $("searchInput").value = "";
            render();
        };
    });
/* =========================================================
   REFRESH
   ========================================================= */
$("refreshBtn").onclick = () => {
    loadData();
};
/* =========================================================
   MODALS
   ========================================================= */
function closeUserModal() {
    $("userModal")
        .classList
        .add("hidden");
}
$("cancelBtn").onclick =
    closeUserModal;
$("closeModalBtn").onclick =
    closeUserModal;
$("userModal").onclick =
    event => {
        if (
            event.target ===
            $("userModal")
        ) {
            closeUserModal();
        }
    };
$("showPasswordBtn").onclick =
    function () {
        const input =
            $("userPasswordInput");
        if (input.type === "password") {
            input.type = "text";
            this.textContent =
                "🙈";
        } else {
            input.type = "password";
            this.textContent =
                "👁";
        }
    };
/* =========================================================
   START
   ========================================================= */
document.body.classList.add("locked");
setTimeout(() => {
    passwordInput.focus();
}, 250);
