"use strict";

/*
|--------------------------------------------------------------------------
| CONFIG
|--------------------------------------------------------------------------
*/

const API = {
    login: "/api/admin-login",
    logout: "/api/admin-logout",
    getData: "/api/get-data",
    saveData: "/api/save-data"
};

const FILE_NAMES = {
    withdrawal: "Withdrawal.json",
    yns: "yns.json",
    wns: "wns.json",
    qx-control: "control1.json"
};


/*
|--------------------------------------------------------------------------
| STATE
|--------------------------------------------------------------------------
*/

let backendFiles = {};

let currentFile = "withdrawal";

let selectedUserUID = null;

let editingUID = null;

let pendingConfirmAction = null;

let dirty = false;


/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

const $ = id => document.getElementById(id);

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getCurrentData() {
    return backendFiles[currentFile]?.data || {};
}

function getUsersObject() {
    const data = getCurrentData();

    if (!data.users || typeof data.users !== "object") {
        data.users = {};
    }

    return data.users;
}

function getBlockedArray() {
    const data = getCurrentData();

    if (!Array.isArray(data.blocked)) {
        data.blocked = [];
    }

    return data.blocked;
}

function isBlocked(uid) {
    return getBlockedArray().includes(uid);
}

function markDirty() {
    dirty = true;

    document.body.classList.add("has-unsaved");

    const saveBar = document.querySelector(".save-bar");

    if (saveBar) {
        saveBar.classList.add("dirty");
    }
}

function markClean() {
    dirty = false;

    document.body.classList.remove("has-unsaved");

    const saveBar = document.querySelector(".save-bar");

    if (saveBar) {
        saveBar.classList.remove("dirty");
    }
}

function showMessage(text, type = "success") {
    const el = $("message");

    if (!el) return;

    el.textContent = text;

    el.className =
        `message ${type}`;

    clearTimeout(showMessage.timer);

    showMessage.timer = setTimeout(() => {
        el.textContent = "";
        el.className = "message";
    }, 4500);
}


/*
|--------------------------------------------------------------------------
| LOGIN
|--------------------------------------------------------------------------
*/

async function login() {
    const password =
        $("adminPassword").value.trim();

    const status =
        $("loginStatus");

    const button =
        $("loginBtn");

    if (!password) {
        status.textContent =
            "Please enter admin password.";

        status.className =
            "login-status error";

        return;
    }

    button.disabled = true;

    status.textContent =
        "Authenticating...";

    status.className =
        "login-status loading";

    try {
        const response =
            await fetch(
                API.login,
                {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify({
                        password
                    })
                }
            );

        const data =
            await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.error ||
                "Login failed"
            );
        }

        $("adminLogin")
            .classList.add("hidden");

        $("app")
            .classList.remove("hidden");

        status.textContent = "";

        await loadBackends();

    } catch (error) {

        status.textContent =
            error.message ||
            "Login failed.";

        status.className =
            "login-status error";

    } finally {
        button.disabled = false;
    }
}


/*
|--------------------------------------------------------------------------
| LOGOUT
|--------------------------------------------------------------------------
*/

async function logout() {
    try {
        await fetch(
            API.logout,
            {
                method: "POST",
                credentials: "include"
            }
        );
    } catch {}

    location.reload();
}


/*
|--------------------------------------------------------------------------
| LOAD BACKENDS
|--------------------------------------------------------------------------
*/

async function loadBackends() {
    setBackendStatus("Loading");

    try {
        const response =
            await fetch(
                API.getData,
                {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store"
                }
            );

        const result =
            await response.json();

        if (
            response.status === 401
        ) {
            location.reload();
            return;
        }

        if (
            !response.ok ||
            !result.success
        ) {
            throw new Error(
                result.error ||
                "Unable to load backend"
            );
        }

        backendFiles =
            result.files || {};

        setBackendStatus("Connected");

        renderCurrentFile();

        markClean();

        showMessage(
            "Backend data loaded successfully."
        );

    } catch (error) {

        setBackendStatus("Offline");

        showMessage(
            error.message ||
            "Unable to load backend.",
            "error"
        );
    }
}


/*
|--------------------------------------------------------------------------
| BACKEND STATUS
|--------------------------------------------------------------------------
*/

function setBackendStatus(status) {
    const el =
        $("backendStatus");

    const header =
        $("headerStatus");

    if (!el) return;

    el.textContent =
        status;

    if (header) {
        header.textContent =
            status === "Connected"
                ? "Online"
                : status;
    }
}


/*
|--------------------------------------------------------------------------
| TAB SWITCH
|--------------------------------------------------------------------------
*/

function switchFile(file) {
    if (!backendFiles[file]) {
        showMessage(
            "This backend file is not available.",
            "error"
        );
        return;
    }

    if (dirty) {
        const leave =
            confirm(
                "You have unsaved changes. Switch anyway?"
            );

        if (!leave) return;
    }

    currentFile = file;

    document
        .querySelectorAll(".tab")
        .forEach(tab => {
            tab.classList.toggle(
                "active",
                tab.dataset.file === file
            );
        });

    renderCurrentFile();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


/*
|--------------------------------------------------------------------------
| RENDER CURRENT FILE
|--------------------------------------------------------------------------
*/

function renderCurrentFile() {
    const file =
        backendFiles[currentFile];

    if (!file) return;

    $("currentFile").textContent =
        FILE_NAMES[currentFile] ||
        file.path ||
        "backend.json";

    const data =
        file.data || {};

    $("activeToggle").checked =
        data.active === true;

    $("passwordToggle").checked =
        data.password_required === true;

    renderUsers();

    renderBlocked();

    updateStats();
}


/*
|--------------------------------------------------------------------------
| USER CARDS
|--------------------------------------------------------------------------
*/

function renderUsers() {
    const grid =
        $("usersGrid");

    const empty =
        $("emptyUsers");

    const search =
        $("searchInput")
            .value
            .trim()
            .toLowerCase();

    const users =
        getUsersObject();

    const entries =
        Object.entries(users)
        .filter(([uid, user]) => {

            const name =
                user?.name || "";

            return (
                uid.toLowerCase()
                    .includes(search) ||
                name.toLowerCase()
                    .includes(search)
            );
        });

    grid.innerHTML = "";

    $("visibleUserCount")
        .textContent =
        entries.length;

    if (!entries.length) {
        empty.classList.remove("hidden");
        return;
    }

    empty.classList.add("hidden");

    entries.forEach(
        ([uid, user]) => {

            const blocked =
                isBlocked(uid);

            const name =
                user?.name || "Unnamed User";

            const initial =
                name
                    .charAt(0)
                    .toUpperCase();

            const card =
                document.createElement("button");

            card.type = "button";

            card.className =
                `user-card ${blocked ? "is-blocked" : ""}`;

            card.innerHTML = `
                <div class="user-card-top">

                    <div class="user-avatar">
                        ${escapeHTML(initial)}
                    </div>

                    <div class="user-main-info">

                        <strong>
                            ${escapeHTML(name)}
                        </strong>

                        <span>
                            ${escapeHTML(uid)}
                        </span>

                    </div>

                    <div class="user-status-dot ${blocked ? "blocked" : ""}">
                        ${blocked ? "⊘" : "✓"}
                    </div>

                </div>

                <div class="user-card-bottom">

                    <span class="mini-label">
                        ${blocked ? "BLOCKED" : "ACTIVE"}
                    </span>

                    <span class="open-card">
                        View details →
                    </span>

                </div>
            `;

            card.addEventListener(
                "click",
                () => openUserDetails(uid)
            );

            grid.appendChild(card);
        }
    );
}


/*
|--------------------------------------------------------------------------
| USER DETAILS
|--------------------------------------------------------------------------
*/

function openUserDetails(uid) {
    const users =
        getUsersObject();

    const user =
        users[uid];

    if (!user) return;

    selectedUserUID =
        uid;

    const blocked =
        isBlocked(uid);

    const name =
        user.name || "Unnamed User";

    $("detailAvatar")
        .textContent =
        name.charAt(0)
            .toUpperCase();

    $("detailName")
        .textContent =
        name;

    $("detailUID")
        .textContent =
        uid;

    $("detailNameValue")
        .textContent =
        name;

    $("detailUIDValue")
        .textContent =
        uid;

    $("detailPassword")
        .textContent =
        "••••••••";

    $("detailPassword")
        .dataset.password =
        user.password || "";

    $("detailAccess")
        .textContent =
        blocked
            ? "Blocked"
            : "Active";

    const status =
        $("detailStatus");

    status.className =
        `profile-status ${blocked ? "blocked" : ""}`;

    status.innerHTML =
        `<span></span>${blocked ? "BLOCKED" : "ACTIVE"}`;

    $("detailBlockBtn")
        .textContent =
        blocked
            ? "✓ Unblock User"
            : "⊘ Block User";

    $("userDetailModal")
        .classList.remove("hidden");
}


/*
|--------------------------------------------------------------------------
| CLOSE DETAIL
|--------------------------------------------------------------------------
*/

function closeDetails() {
    $("userDetailModal")
        .classList.add("hidden");

    selectedUserUID = null;
}


/*
|--------------------------------------------------------------------------
| ADD USER
|--------------------------------------------------------------------------
*/

function openAddUser() {
    editingUID = null;

    $("modalBadge")
        .textContent =
        "NEW USER";

    $("modalTitle")
        .textContent =
        "Add User";

    $("uidInput").value = "";
    $("nameInput").value = "";
    $("userPasswordInput").value = "";

    $("uidInput").disabled = false;

    $("userModal")
        .classList.remove("hidden");

    setTimeout(
        () => $("uidInput").focus(),
        100
    );
}


/*
|--------------------------------------------------------------------------
| EDIT USER
|--------------------------------------------------------------------------
*/

function openEditUser() {
    if (!selectedUserUID) return;

    const users =
        getUsersObject();

    const user =
        users[selectedUserUID];

    if (!user) return;

    editingUID =
        selectedUserUID;

    $("modalBadge")
        .textContent =
        "EDIT USER";

    $("modalTitle")
        .textContent =
        "Edit User";

    $("uidInput").value =
        selectedUserUID;

    $("nameInput").value =
        user.name || "";

    $("userPasswordInput").value =
        user.password || "";

    $("uidInput").disabled = false;

    $("userDetailModal")
        .classList.add("hidden");

    $("userModal")
        .classList.remove("hidden");

    $("nameInput").focus();
}


/*
|--------------------------------------------------------------------------
| SAVE USER LOCALLY
|--------------------------------------------------------------------------
*/

function saveUser() {
    const uid =
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

    if (!password) {
        showMessage(
            "Password is required.",
            "error"
        );
        return;
    }

    const users =
        getUsersObject();

    const oldUID =
        editingUID;

    if (
        !oldUID &&
        users[uid]
    ) {
        showMessage(
            "This UID already exists.",
            "error"
        );
        return;
    }

    if (
        oldUID &&
        oldUID !== uid &&
        users[uid]
    ) {
        showMessage(
            "New UID already exists.",
            "error"
        );
        return;
    }

    if (
        oldUID &&
        oldUID !== uid
    ) {
        users[uid] = {
            name,
            password
        };

        delete users[oldUID];

        const blocked =
            getBlockedArray();

        const index =
            blocked.indexOf(oldUID);

        if (index !== -1) {
            blocked[index] = uid;
        }

    } else {
        users[uid] = {
            name,
            password
        };
    }

    markDirty();

    closeUserModal();

    renderCurrentFile();

    showMessage(
        oldUID
            ? "User updated."
            : "User added."
    );
}


/*
|--------------------------------------------------------------------------
| DELETE
|--------------------------------------------------------------------------
*/

function deleteSelectedUser() {
    if (!selectedUserUID) return;

    const uid =
        selectedUserUID;

    askConfirm(
        "Delete User",
        `Delete ${uid}? This cannot be undone.`,
        "🗑",
        () => {

            const users =
                getUsersObject();

            delete users[uid];

            const blocked =
                getBlockedArray();

            const index =
                blocked.indexOf(uid);

            if (index !== -1) {
                blocked.splice(index, 1);
            }

            closeDetails();

            markDirty();

            renderCurrentFile();

            showMessage(
                "User deleted."
            );
        }
    );
}


/*
|--------------------------------------------------------------------------
| BLOCK / UNBLOCK
|--------------------------------------------------------------------------
*/

function toggleSelectedBlock() {
    if (!selectedUserUID) return;

    const uid =
        selectedUserUID;

    const blocked =
        getBlockedArray();

    const index =
        blocked.indexOf(uid);

    if (index === -1) {
        blocked.push(uid);
        showMessage(
            "User blocked."
        );
    } else {
        blocked.splice(index, 1);
        showMessage(
            "User unblocked."
        );
    }

    markDirty();

    openUserDetails(uid);

    renderUsers();
    renderBlocked();
    updateStats();
}


/*
|--------------------------------------------------------------------------
| BLOCKED LIST
|--------------------------------------------------------------------------
*/

function renderBlocked() {
    const list =
        $("blockedList");

    const blocked =
        getBlockedArray();

    const users =
        getUsersObject();

    $("blockedCount")
        .textContent =
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

        const user =
            users[uid];

        const name =
            user?.name ||
            "Unknown User";

        const item =
            document.createElement("div");

        item.className =
            "blocked-item";

        item.innerHTML = `
            <div>
                <strong>
                    ${escapeHTML(name)}
                </strong>

                <span>
                    ${escapeHTML(uid)}
                </span>
            </div>

            <button
                type="button"
                data-uid="${escapeHTML(uid)}"
            >
                Unblock
            </button>
        `;

        item
            .querySelector("button")
            .addEventListener(
                "click",
                () => {

                    const index =
                        getBlockedArray()
                            .indexOf(uid);

                    if (index !== -1) {
                        getBlockedArray()
                            .splice(index, 1);
                    }

                    markDirty();

                    renderCurrentFile();

                    showMessage(
                        "User unblocked."
                    );
                }
            );

        list.appendChild(item);
    });
}


/*
|--------------------------------------------------------------------------
| STATS
|--------------------------------------------------------------------------
*/

function updateStats() {
    const users =
        getUsersObject();

    const blocked =
        getBlockedArray();

    const total =
        Object.keys(users).length;

    $("totalUsers")
        .textContent =
        total;

    $("blockedUsers")
        .textContent =
        blocked.length;

    $("activeUsers")
        .textContent =
        Math.max(
            0,
            total - blocked.length
        );
}


/*
|--------------------------------------------------------------------------
| SAVE TO GITHUB
|--------------------------------------------------------------------------
*/

async function saveToGitHub() {
    const file =
        backendFiles[currentFile];

    if (!file) {
        showMessage(
            "No backend file selected.",
            "error"
        );
        return;
    }

    const button =
        $("saveBtn");

    button.disabled = true;

    button.innerHTML =
        "<span>⏳</span> Saving...";

    try {
        const response =
            await fetch(
                API.saveData,
                {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify({
                        file: currentFile,
                        data: file.data
                    })
                }
            );

        const result =
            await response.json();

        if (response.status === 401) {
            location.reload();
            return;
        }

        if (
            !response.ok ||
            !result.success
        ) {
            throw new Error(
                result.error ||
                "Save failed"
            );
        }

        markClean();

        showMessage(
            `${FILE_NAMES[currentFile]} saved successfully.`
        );

        await loadBackends();

    } catch (error) {

        showMessage(
            error.message ||
            "Unable to save.",
            "error"
        );

    } finally {

        button.disabled = false;

        button.innerHTML =
            "<span>☁</span> Save to GitHub";
    }
}


/*
|--------------------------------------------------------------------------
| CONFIRM MODAL
|--------------------------------------------------------------------------
*/

function askConfirm(
    title,
    text,
    icon,
    callback
) {
    $("confirmIcon")
        .textContent =
        icon;

    $("confirmTitle")
        .textContent =
        title;

    $("confirmText")
        .textContent =
        text;

    pendingConfirmAction =
        callback;

    $("confirmModal")
        .classList.remove("hidden");
}

function closeConfirm() {
    pendingConfirmAction = null;

    $("confirmModal")
        .classList.add("hidden");
}


/*
|--------------------------------------------------------------------------
| MODALS
|--------------------------------------------------------------------------
*/

function closeUserModal() {
    $("userModal")
        .classList.add("hidden");

    editingUID = null;
}

function closeAllModals() {
    $("userModal")
        .classList.add("hidden");

    $("userDetailModal")
        .classList.add("hidden");

    $("confirmModal")
        .classList.add("hidden");

    editingUID = null;

    selectedUserUID = null;

    pendingConfirmAction = null;
}


/*
|--------------------------------------------------------------------------
| PASSWORD VISIBILITY
|--------------------------------------------------------------------------
*/

function toggleInputPassword() {
    const input =
        $("userPasswordInput");

    input.type =
        input.type === "password"
            ? "text"
            : "password";
}

function toggleDetailPassword() {
    const el =
        $("detailPassword");

    if (
        el.textContent ===
        "••••••••"
    ) {
        el.textContent =
            el.dataset.password ||
            "—";
    } else {
        el.textContent =
            "••••••••";
    }
}


/*
|--------------------------------------------------------------------------
| KEYBOARD
|--------------------------------------------------------------------------
*/

document.addEventListener(
    "keydown",
    event => {

        if (
            (event.metaKey ||
             event.ctrlKey) &&
            event.key.toLowerCase() === "k"
        ) {
            event.preventDefault();

            $("searchInput")
                .focus();
        }

        if (
            event.key === "Escape"
        ) {
            closeAllModals();
        }

        if (
            event.key === "Enter" &&
            document.activeElement ===
            $("adminPassword")
        ) {
            login();
        }
    }
);


/*
|--------------------------------------------------------------------------
| EVENTS
|--------------------------------------------------------------------------
*/

document.addEventListener(
    "DOMContentLoaded",
    () => {

        $("loginBtn")
            .addEventListener(
                "click",
                login
            );

        $("logoutBtn")
            .addEventListener(
                "click",
                logout
            );

        $("refreshBtn")
            .addEventListener(
                "click",
                loadBackends
            );

        $("loginEye")
            .addEventListener(
                "click",
                () => {

                    const input =
                        $("adminPassword");

                    input.type =
                        input.type === "password"
                            ? "text"
                            : "password";
                }
            );

        document
            .querySelectorAll(".tab")
            .forEach(tab => {

                tab.addEventListener(
                    "click",
                    () => switchFile(
                        tab.dataset.file
                    )
                );

            });


        $("activeToggle")
            .addEventListener(
                "change",
                event => {

                    getCurrentData()
                        .active =
                        event.target.checked;

                    markDirty();
                }
            );


        $("passwordToggle")
            .addEventListener(
                "change",
                event => {

                    getCurrentData()
                        .password_required =
                        event.target.checked;

                    markDirty();
                }
            );


        $("searchInput")
            .addEventListener(
                "input",
                renderUsers
            );


        $("clearSearch")
            .addEventListener(
                "click",
                () => {

                    $("searchInput")
                        .value = "";

                    renderUsers();

                    $("searchInput")
                        .focus();
                }
            );


        $("addUserBtn")
            .addEventListener(
                "click",
                openAddUser
            );


        $("emptyAddBtn")
            .addEventListener(
                "click",
                openAddUser
            );


        $("closeDetailBtn")
            .addEventListener(
                "click",
                closeDetails
            );


        $("detailEditBtn")
            .addEventListener(
                "click",
                openEditUser
            );


        $("detailBlockBtn")
            .addEventListener(
                "click",
                toggleSelectedBlock
            );


        $("detailDeleteBtn")
            .addEventListener(
                "click",
                deleteSelectedUser
            );


        $("detailPasswordEye")
            .addEventListener(
                "click",
                toggleDetailPassword
            );


        $("showPasswordBtn")
            .addEventListener(
                "click",
                toggleInputPassword
            );


        $("closeModalBtn")
            .addEventListener(
                "click",
                closeUserModal
            );


        $("cancelBtn")
            .addEventListener(
                "click",
                closeUserModal
            );


        $("confirmUserBtn")
            .addEventListener(
                "click",
                saveUser
            );


        $("confirmCancel")
            .addEventListener(
                "click",
                closeConfirm
            );


        $("confirmOk")
            .addEventListener(
                "click",
                () => {

                    if (
                        typeof pendingConfirmAction ===
                        "function"
                    ) {
                        const action =
                            pendingConfirmAction;

                        closeConfirm();

                        action();
                    }
                }
            );


        $("saveBtn")
            .addEventListener(
                "click",
                saveToGitHub
            );


        // Close modal on background click

        [
            "userDetailModal",
            "userModal",
            "confirmModal"
        ].forEach(id => {

            $(id).addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        $(id)
                    ) {
                        $(id)
                            .classList
                            .add("hidden");
                    }

                }
            );

        });

    }
);
