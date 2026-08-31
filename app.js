const API = {
    get: "/api/get-data",
    save: "/api/save-data"
};
const FILE_NAMES = {
    withdrawal: "Withdrawal.json",
    yns: "yns.json",
    wns: "wns.json",
    qxControl: "control1.json"
};
let files = {};
let currentFile = "withdrawal";
let selectedUID = null;
let editingUID = null;
let passwordVisible = false;
let dirty = false;
const $ = id => document.getElementById(id);
document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    checkLogin();
});
function bindEvents() {
    $("loginBtn")?.addEventListener("click", login);
    $("adminPassword")?.addEventListener("keydown", e => {
        if (e.key === "Enter") login();
    });
    $("loginEye")?.addEventListener("click", () => {
        const input = $("adminPassword");
        input.type = input.type === "password"
            ? "text"
            : "password";
    });
    $("logoutBtn")?.addEventListener("click", logout);
    $("refreshBtn")?.addEventListener("click", loadData);
    $("saveBtn")?.addEventListener("click", saveCurrentFile);
    $("searchInput")?.addEventListener("input", renderUsers);
    $("clearSearch")?.addEventListener("click", () => {
        $("searchInput").value = "";
        renderUsers();
    });
    $("addUserBtn")?.addEventListener("click", () => openUserForm());
    $("emptyAddBtn")?.addEventListener("click", () => openUserForm());
    $("closeDetailBtn")?.addEventListener("click", closeDetail);
    $("detailEditBtn")?.addEventListener("click", () => {
        if (selectedUID) openUserForm(selectedUID);
    });
    $("detailBlockBtn")?.addEventListener("click", toggleSelectedBlock);
    $("detailDeleteBtn")?.addEventListener("click", deleteSelectedUser);
    $("closeModalBtn")?.addEventListener("click", closeUserForm);
    $("cancelBtn")?.addEventListener("click", closeUserForm);
    $("confirmUserBtn")?.addEventListener("click", saveUser);
    $("showPasswordBtn")?.addEventListener("click", () => {
        const input = $("userPasswordInput");
        input.type =
            input.type === "password"
                ? "text"
                : "password";
    });
    $("detailPasswordEye")?.addEventListener("click", () => {
        passwordVisible = !passwordVisible;
        renderDetailPassword();
    });
    $("confirmCancel")?.addEventListener("click", closeConfirm);
    document.querySelectorAll(".tab").forEach(tab => {
        tab.addEventListener("click", () => {
            switchFile(tab.dataset.file);
        });
    });
    document.addEventListener("keydown", e => {
        if (
            (e.metaKey || e.ctrlKey) &&
            e.key.toLowerCase() === "k"
        ) {
            e.preventDefault();
            $("searchInput")?.focus();
        }
        if (e.key === "Escape") {
            closeDetail();
            closeUserForm();
            closeConfirm();
        }
    });
}
async function checkLogin() {
    try {
        const response = await fetch(API.get, {
            credentials: "include"
        });
        if (response.status === 401) {
            showLogin();
            return;
        }
        if (!response.ok) {
            showLogin();
            return;
        }
        hideLogin();
        await loadData();
    } catch {
        showLogin();
    }
}
async function login() {
    const password = $("adminPassword").value.trim();
    const status = $("loginStatus");
    if (!password) {
        status.textContent = "Enter admin password.";
        status.className = "login-status error";
        return;
    }
    $("loginBtn").disabled = true;
    status.textContent = "Checking...";
    status.className = "login-status";
    try {
        const response = await fetch("/api/admin-login", {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ password })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(
                data.error || "Invalid password"
            );
        }
        hideLogin();
        await loadData();
    } catch (error) {
        status.textContent = error.message;
        status.className = "login-status error";
    } finally {
        $("loginBtn").disabled = false;
    }
}
function logout() {
    fetch("/api/admin-logout", {
        method: "POST",
        credentials: "include"
    }).finally(() => {
        location.reload();
    });
}
function showLogin() {
    $("adminLogin")?.classList.remove("hidden");
    $("app")?.classList.add("hidden");
}
function hideLogin() {
    $("adminLogin")?.classList.add("hidden");
    $("app")?.classList.remove("hidden");
}
async function loadData() {
    setMessage("Loading backend data...", "");
    $("backendStatus").textContent = "Loading";
    try {
        const response = await fetch(API.get, {
            credentials: "include",
            cache: "no-store"
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(
                result.error || "Unable to load backend"
            );
        }
        files = result.files || {};
        if (!files.qxControl) {
            throw new Error(
                "QX Control backend file is not available"
            );
        }
        $("backendStatus").textContent = "Connected";
        $("headerStatus").textContent = "Online";
        renderCurrentFile();
        setMessage("Backend loaded successfully.", "success");
        dirty = false;
        updateSaveBar();
    } catch (error) {
        $("backendStatus").textContent = "Error";
        $("headerStatus").textContent = "Offline";
        setMessage(error.message, "error");
    }
}
function switchFile(file) {
    if (!files[file]) {
        setMessage(
            `${FILE_NAMES[file] || file} is not available.`,
            "error"
        );
        return;
    }
    currentFile = file;
    document.querySelectorAll(".tab").forEach(tab => {
        tab.classList.toggle(
            "active",
            tab.dataset.file === file
        );
    });
    $("currentFile").textContent =
        FILE_NAMES[file] || file;
    closeDetail();
    renderCurrentFile();
}
function renderCurrentFile() {
    const data = files[currentFile]?.data;
    if (!data) return;
    $("activeToggle").checked =
        Boolean(data.active);
    $("passwordToggle").checked =
        Boolean(data.password_required);
    $("activeToggle").onchange = () => {
        data.active = $("activeToggle").checked;
        markDirty();
    };
    $("passwordToggle").onchange = () => {
        data.password_required =
            $("passwordToggle").checked;
        markDirty();
    };
    renderUsers();
    renderBlocked();
    updateStats();
}
function getUsers() {
    const data = files[currentFile]?.data;
    if (!data) return {};
    if (
        !data.users ||
        typeof data.users !== "object"
    ) {
        data.users = {};
    }
    return data.users;
}
function getBlocked() {
    const data = files[currentFile]?.data;
    if (!data) return [];
    if (!Array.isArray(data.blocked)) {
        data.blocked = [];
    }
    return data.blocked;
}
function renderUsers() {
    const grid = $("usersGrid");
    const empty = $("emptyUsers");
    if (!grid) return;
    const users = getUsers();
    const search =
        ($("searchInput")?.value || "")
            .trim()
            .toLowerCase();
    const entries = Object.entries(users)
        .filter(([uid, user]) => {
            if (!search) return true;
            return (
                uid.toLowerCase().includes(search) ||
                String(user.name || "")
                    .toLowerCase()
                    .includes(search)
            );
        });
    $("visibleUserCount").textContent =
        entries.length;
    grid.innerHTML = "";
    if (!entries.length) {
        empty?.classList.remove("hidden");
        return;
    }
    empty?.classList.add("hidden");
    entries.forEach(([uid, user]) => {
        const blocked =
            getBlocked().includes(uid);
        const card =
            document.createElement("button");
        card.type = "button";
        card.className =
            `user-card ${blocked ? "is-blocked" : ""}`;
        const name =
            escapeHTML(user.name || "Unnamed User");
        const initials =
            getInitials(user.name || uid);
        card.innerHTML = `
            <div class="user-card-top">
                <div class="user-avatar">
                    ${escapeHTML(initials)}
                </div>
                <div class="user-status ${blocked ? "blocked" : "active"}">
                    <span></span>
                    ${blocked ? "BLOCKED" : "ACTIVE"}
                </div>
            </div>
            <div class="user-name">
                ${name}
            </div>
            <div class="user-uid">
                ${escapeHTML(uid)}
            </div>
            <div class="user-card-bottom">
                <span>
                    ${blocked ? "Access restricted" : "Access allowed"}
                </span>
                <b>→</b>
            </div>
        `;
        card.addEventListener("click", () => {
            openDetail(uid);
        });
        grid.appendChild(card);
    });
}
function openDetail(uid) {
    const user = getUsers()[uid];
    if (!user) return;
    selectedUID = uid;
    passwordVisible = false;
    $("detailAvatar").textContent =
        getInitials(user.name || uid);
    $("detailName").textContent =
        user.name || "Unnamed User";
    $("detailUID").textContent = uid;
    $("detailNameValue").textContent =
        user.name || "—";
    $("detailUIDValue").textContent =
        uid;
    $("detailAccess").textContent =
        getBlocked().includes(uid)
            ? "Blocked"
            : "Active";
    $("detailStatus").innerHTML =
        getBlocked().includes(uid)
            ? "<span></span> BLOCKED"
            : "<span></span> ACTIVE";
    $("detailStatus").className =
        `profile-status ${
            getBlocked().includes(uid)
                ? "blocked"
                : "active"
        }`;
    renderDetailPassword();
    const blockBtn = $("detailBlockBtn");
    blockBtn.textContent =
        getBlocked().includes(uid)
            ? "✓ Unblock User"
            : "⊘ Block User";
    $("userDetailModal").classList.remove("hidden");
}
function renderDetailPassword() {
    if (!selectedUID) return;
    const user = getUsers()[selectedUID];
    if (!user) return;
    $("detailPassword").textContent =
        passwordVisible
            ? (user.password || "—")
            : "••••••••";
}
function closeDetail() {
    $("userDetailModal")?.classList.add("hidden");
    selectedUID = null;
}
function openUserForm(uid = null) {
    editingUID = uid;
    $("modalBadge").textContent =
        uid ? "EDIT USER" : "NEW USER";
    $("modalTitle").textContent =
        uid ? "Edit User" : "Add User";
    if (uid) {
        const user = getUsers()[uid];
        $("uidInput").value = uid;
        $("nameInput").value = user?.name || "";
        $("userPasswordInput").value =
            user?.password || "";
    } else {
        $("uidInput").value = "";
        $("nameInput").value = "";
        $("userPasswordInput").value = "";
    }
    $("userModal").classList.remove("hidden");
}
function closeUserForm() {
    $("userModal")?.classList.add("hidden");
    editingUID = null;
}
function saveUser() {
    const uid =
        $("uidInput").value.trim();
    const name =
        $("nameInput").value.trim();
    const password =
        $("userPasswordInput").value;
    if (!uid) {
        alert("UID is required.");
        return;
    }
    if (!name) {
        alert("User name is required.");
        return;
    }
    if (!password) {
        alert("Password is required.");
        return;
    }
    const users = getUsers();
    if (
        !editingUID &&
        users[uid]
    ) {
        alert("This UID already exists.");
        return;
    }
    if (
        editingUID &&
        editingUID !== uid
    ) {
        delete users[editingUID];
        const blocked =
            getBlocked();
        const index =
            blocked.indexOf(editingUID);
        if (index !== -1) {
            blocked[index] = uid;
        }
    }
    users[uid] = {
        name,
        password
    };
    markDirty();
    closeUserForm();
    renderCurrentFile();
    openDetail(uid);
    setMessage(
        "User changes are ready to save.",
        "success"
    );
}
function toggleSelectedBlock() {
    if (!selectedUID) return;
    const blocked = getBlocked();
    const index =
        blocked.indexOf(selectedUID);
    if (index === -1) {
        blocked.push(selectedUID);
    } else {
        blocked.splice(index, 1);
    }
    markDirty();
    openDetail(selectedUID);
    renderUsers();
    renderBlocked();
    updateStats();
}
function deleteSelectedUser() {
    if (!selectedUID) return;
    const uid = selectedUID;
    if (
        !confirm(
            `Delete ${uid} from this backend?`
        )
    ) {
        return;
    }
    const users = getUsers();
    delete users[uid];
    const blocked = getBlocked();
    const index = blocked.indexOf(uid);
    if (index !== -1) {
        blocked.splice(index, 1);
    }
    closeDetail();
    markDirty();
    renderCurrentFile();
    setMessage(
        "User deleted locally. Save to GitHub to apply.",
        "success"
    );
}
function renderBlocked() {
    const list = $("blockedList");
    if (!list) return;
    const blocked = getBlocked();
    $("blockedCount").textContent =
        blocked.length;
    list.innerHTML = "";
    if (!blocked.length) {
        list.innerHTML = `
            <div class="blocked-empty">
                ✓ No blocked users
            </div>
        `;
        return;
    }
    blocked.forEach(uid => {
        const user = getUsers()[uid];
        const item =
            document.createElement("div");
        item.className = "blocked-item";
        item.innerHTML = `
            <div>
                <strong>
                    ${escapeHTML(user?.name || "Unknown User")}
                </strong>
                <span>
                    ${escapeHTML(uid)}
                </span>
            </div>
            <button type="button">
                Unblock
            </button>
        `;
        item.querySelector("button")
            .addEventListener("click", () => {
                const index =
                    getBlocked().indexOf(uid);
                if (index !== -1) {
                    getBlocked().splice(index, 1);
                }
                markDirty();
                renderCurrentFile();
            });
        list.appendChild(item);
    });
}
function updateStats() {
    const users =
        Object.keys(getUsers());
    const blocked =
        getBlocked();
    $("totalUsers").textContent =
        users.length;
    $("blockedUsers").textContent =
        blocked.length;
    $("activeUsers").textContent =
        Math.max(
            0,
            users.length -
            blocked.filter(uid => users.includes(uid)).length
        );
}
async function saveCurrentFile() {
    const saveBtn = $("saveBtn");
    if (!files[currentFile]) {
        setMessage(
            "This backend file is not available.",
            "error"
        );
        return;
    }
    saveBtn.disabled = true;
    const oldHTML = saveBtn.innerHTML;
    saveBtn.innerHTML = "Saving...";
    try {
        const response =
            await fetch(API.save, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    file: currentFile,
                    data: files[currentFile].data
                })
            });
        const result =
            await response.json();
        if (!response.ok || !result.success) {
            throw new Error(
                result.error ||
                "Unable to save backend"
            );
        }
        dirty = false;
        updateSaveBar();
        setMessage(
            `${FILE_NAMES[currentFile]} updated successfully.`,
            "success"
        );
        await loadData();
    } catch (error) {
        setMessage(
            error.message,
            "error"
        );
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = oldHTML;
    }
}
function markDirty() {
    dirty = true;
    updateSaveBar();
}
function updateSaveBar() {
    const bar =
        document.querySelector(".save-bar");
    if (!bar) return;
    bar.classList.toggle(
        "has-changes",
        dirty
    );
    const title =
        bar.querySelector("strong");
    const subtitle =
        bar.querySelector("span");
    if (dirty) {
        title.textContent =
            "Unsaved changes";
        subtitle.textContent =
            "Save your changes to update GitHub.";
    } else {
        title.textContent =
            "Everything is saved";
        subtitle.textContent =
            "Your current backend is up to date.";
    }
}
function setMessage(text, type = "") {
    const el = $("message");
    if (!el) return;
    el.textContent = text;
    el.className =
        `message ${type}`;
    if (text) {
        clearTimeout(setMessage.timer);
        setMessage.timer =
            setTimeout(() => {
                el.textContent = "";
            }, 5000);
    }
}
function getInitials(name) {
    const words =
        String(name)
            .trim()
            .split(/\s+/)
            .filter(Boolean);
    if (!words.length) return "U";
    if (words.length === 1) {
        return words[0]
            .slice(0, 2)
            .toUpperCase();
    }
    return (
        words[0][0] +
        words[words.length - 1][0]
    ).toUpperCase();
}
function escapeHTML(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
