"use strict";

/* =========================================================
   EXTENSION CONTROL PANEL
   Same backend system + premium user-card interface
========================================================= */

let files = {};
let currentFile = "withdrawal";
let editingUID = null;
let selectedUID = null;
let searchText = "";
let pendingAction = null;

const fileNames = {
    withdrawal: "Withdrawal.json",
    yns: "yns.json",
    wns: "wns.json"
};

const $ = id => document.getElementById(id);


/* =========================================================
   LOGIN
========================================================= */

const adminLogin = $("adminLogin");
const adminPassword = $("adminPassword");
const loginBtn = $("loginBtn");
const loginStatus = $("loginStatus");
const loginEye = $("loginEye");
const app = $("app");

function setLoginStatus(text, type = "") {
    loginStatus.textContent = text;
    loginStatus.className = "login-status " + type;
}

function unlockDashboard() {

    adminLogin.classList.add("hidden");
    app.classList.remove("hidden");

    /*
     * Frontend session indicator.
     * Real authentication is handled by /api/login
     * through the HttpOnly admin_session cookie.
     */
    sessionStorage.setItem(
        "admin_logged_in",
        "1"
    );

    loadData();
}

function lockDashboard() {

    sessionStorage.removeItem(
        "admin_logged_in"
    );

    app.classList.add("hidden");
    adminLogin.classList.remove("hidden");

    adminPassword.value = "";

    setLoginStatus("");

    setTimeout(() => {
        adminPassword.focus();
    }, 100);
}


/* =========================================================
   LOGIN - BACKEND AUTHENTICATION
========================================================= */

async function login() {

    const password =
        adminPassword.value.trim();

    if (!password) {

        setLoginStatus(
            "Enter admin password.",
            "error"
        );

        adminPassword.focus();

        return;
    }

    loginBtn.disabled = true;

    loginBtn.innerHTML =
        "<span>Checking...</span>";

    try {

        /*
         * Send password to the backend.
         *
         * /api/login verifies ADMIN_PASSWORD
         * and creates the admin_session cookie.
         */

        const response =
            await fetch(
                "/api/login",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials: "include",

                    body: JSON.stringify({
                        password: password
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
                "Login failed"
            );
        }

        setLoginStatus(
            "✓ Access granted",
            "success"
        );

        /*
         * Give the browser a moment to store
         * the HttpOnly session cookie.
         */

        setTimeout(() => {

            unlockDashboard();

        }, 350);

    } catch (error) {

        console.error(
            "LOGIN ERROR:",
            error
        );

        setLoginStatus(
            "✕ " +
            (
                error.message ||
                "Login failed"
            ),
            "error"
        );

        adminPassword.value = "";

        adminPassword.focus();

        loginBtn.disabled = false;

        loginBtn.innerHTML =
            "<span>Login to Dashboard</span><b>→</b>";
    }
}

loginBtn.onclick = login;

adminPassword.onkeydown = event => {

    if (event.key === "Enter") {
        login();
    }
};

loginEye.onclick = () => {

    if (
        adminPassword.type ===
        "password"
    ) {

        adminPassword.type = "text";

        loginEye.textContent = "🙈";

    } else {

        adminPassword.type =
            "password";

        loginEye.textContent = "👁";
    }

    adminPassword.focus();
};

$("logoutBtn").onclick =
    lockDashboard;


/* =========================================================
   INITIAL LOGIN CHECK
========================================================= */

if (
    sessionStorage.getItem(
        "admin_logged_in"
    ) === "1"
) {

    adminLogin.classList.add("hidden");

    app.classList.remove("hidden");

    loadData();

} else {

    setTimeout(() => {

        adminPassword.focus();

    }, 200);
}


/* =========================================================
   MESSAGE
========================================================= */

let messageTimer;

function showMessage(
    text,
    type = ""
) {

    const box =
        $("message");

    clearTimeout(
        messageTimer
    );

    box.textContent =
        text;

    box.className =
        "message " + type;

    messageTimer =
        setTimeout(() => {

            box.textContent = "";

            box.className =
                "message";

        }, 4500);
}


/* =========================================================
   LOAD DATA
========================================================= */

async function loadData() {

    $("backendStatus").textContent =
        "Loading";

    $("headerStatus").textContent =
        "Syncing";

    try {

        const response =
            await fetch(
                "/api/get-data",
                {
                    method: "GET",

                    cache: "no-store",

                    /*
                     * IMPORTANT:
                     * Send admin_session cookie
                     * to the backend.
                     */

                    credentials: "include"
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
                "Unable to load GitHub data"
            );
        }

        files =
            result.files || {};

        $("backendStatus").textContent =
            "Online";

        $("headerStatus").textContent =
            "Online";

        render();

    } catch (error) {

        console.error(error);

        /*
         * If backend says session is invalid,
         * clear the frontend session and show login.
         */

        if (
            error.message ===
            "Admin login required" ||
            error.message ===
            "Invalid or expired admin session"
        ) {

            sessionStorage.removeItem(
                "admin_logged_in"
            );

            app.classList.add(
                "hidden"
            );

            adminLogin.classList.remove(
                "hidden"
            );

            setLoginStatus(
                "Session expired. Please login again.",
                "error"
            );

            adminPassword.value = "";

            setTimeout(() => {
                adminPassword.focus();
            }, 100);

            return;
        }

        $("backendStatus").textContent =
            "Error";

        $("headerStatus").textContent =
            "Offline";

        showMessage(
            "❌ " +
            error.message,
            "error"
        );
    }
}


/* =========================================================
   CURRENT DATA
========================================================= */

function getCurrentData() {

    if (!files[currentFile]) {
        return {};
    }

    return files[currentFile].data || {};
}


/* =========================================================
   RENDER
========================================================= */

function render() {

    const data =
        getCurrentData();

    $("currentFile").textContent =
        fileNames[currentFile];

    if (
        currentFile ===
        "withdrawal"
    ) {

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
   USER CARDS
========================================================= */

function renderUsers() {

    const data =
        getCurrentData();

    const users =
        data.users || {};

    const grid =
        $("usersGrid");

    grid.innerHTML = "";

    const entries =
        Object.entries(users);

    const search =
        searchText.toLowerCase();

    const blocked =
        Array.isArray(data.blocked)
            ? data.blocked
            : [];

    const filtered =
        entries.filter(
            ([uid, user]) => {

                return (
                    uid
                        .toLowerCase()
                        .includes(search) ||

                    String(
                        user?.name || ""
                    )
                        .toLowerCase()
                        .includes(search)
                );
            }
        );

    $("visibleUserCount").textContent =
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

    filtered.forEach(
        ([uid, user], index) => {

            const isBlocked =
                blocked.includes(uid);

            const card =
                document.createElement(
                    "div"
                );

            card.className =
                "user-card" +
                (
                    isBlocked
                        ? " is-blocked"
                        : ""
                );

            card.style.animationDelay =
                `${Math.min(
                    index * 45,
                    400
                )}ms`;

            const name =
                String(
                    user?.name ||
                    "Unnamed User"
                );

            const initial =
                name
                    .trim()
                    .charAt(0)
                    .toUpperCase() ||
                "U";

            card.innerHTML = `
                <div class="user-card-top">

                    <div class="user-avatar">
                        ${escapeHTML(initial)}
                    </div>

                    <div class="user-main-info">

                        <h3>
                            ${escapeHTML(name)}
                        </h3>

                        <p>
                            ${escapeHTML(uid)}
                        </p>

                    </div>

                    <div class="user-arrow">
                        →
                    </div>

                </div>

                <div class="user-card-divider"></div>

                <div class="user-card-bottom">

                    <div class="mini-info">
                        <span>ACCESS</span>

                        <strong class="${
                            isBlocked
                                ? "red-text"
                                : "green-text"
                        }">
                            ${
                                isBlocked
                                    ? "Blocked"
                                    : "Active"
                            }
                        </strong>
                    </div>

                    <div class="mini-info password-mini">

                        <span>PASSWORD</span>

                        <strong>
                            ••••••
                        </strong>

                    </div>

                    <div class="status-dot ${
                        isBlocked
                            ? "blocked-dot"
                            : ""
                    }">
                        ${
                            isBlocked
                                ? "⊘"
                                : "✓"
                        }
                    </div>

                </div>
            `;

            card.onclick = () =>
                openUserDetails(uid);

            grid.appendChild(card);
        }
    );
}


/* =========================================================
   USER DETAIL
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
        String(
            user.name ||
            "Unnamed User"
        );

    const initial =
        name
            .trim()
            .charAt(0)
            .toUpperCase() ||
        "U";

    $("detailAvatar").textContent =
        initial;

    $("detailName").textContent =
        name;

    $("detailUID").textContent =
        uid;

    $("detailNameValue").textContent =
        name;

    $("detailUIDValue").textContent =
        uid;

    $("detailPassword").textContent =
        "••••••••";

    $("detailPassword").dataset.password =
        user.password || "";

    $("detailAccess").textContent =
        isBlocked
            ? "Blocked"
            : "Active";

    const status =
        $("detailStatus");

    status.className =
        "profile-status " +
        (
            isBlocked
                ? "blocked"
                : ""
        );

    status.innerHTML = `
        <span></span>
        ${
            isBlocked
                ? "BLOCKED"
                : "ACTIVE"
        }
    `;

    const blockBtn =
        $("detailBlockBtn");

    blockBtn.textContent =
        isBlocked
            ? "✓ Unblock User"
            : "⊘ Block User";

    blockBtn.className =
        "detail-btn " +
        (
            isBlocked
                ? "unblock"
                : "block"
        );

    $("userDetailModal")
        .classList
        .remove("hidden");
}

function closeUserDetails() {

    $("userDetailModal")
        .classList
        .add("hidden");

    selectedUID = null;
}

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


/* =========================================================
   PASSWORD SHOW
========================================================= */

$("detailPasswordEye").onclick =
    function () {

        const password =
            $("detailPassword");

        if (
            password.textContent ===
            "••••••••"
        ) {

            password.textContent =
                password.dataset.password ||
                "—";

            this.textContent =
                "🙈";

        } else {

            password.textContent =
                "••••••••";

            this.textContent =
                "👁";
        }
    };


/* =========================================================
   DETAIL EDIT
========================================================= */

$("detailEditBtn").onclick = () => {

    if (!selectedUID) return;

    const uid =
        selectedUID;

    closeUserDetails();

    openEditUser(uid);
};


/* =========================================================
   DETAIL BLOCK
========================================================= */

$("detailBlockBtn").onclick = () => {

    if (!selectedUID) return;

    const uid =
        selectedUID;

    const data =
        getCurrentData();

    const blocked =
        Array.isArray(data.blocked)
            ? data.blocked
            : [];

    const isBlocked =
        blocked.includes(uid);

    closeUserDetails();

    if (isBlocked) {

        unblockUser(uid);

    } else {

        blockUser(uid);
    }
};


/* =========================================================
   DETAIL DELETE
========================================================= */

$("detailDeleteBtn").onclick = () => {

    if (!selectedUID) return;

    const uid =
        selectedUID;

    closeUserDetails();

    deleteUser(uid);
};


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

    let active = 0;

    Object.keys(users).forEach(
        uid => {

            if (
                !blocked.includes(uid)
            ) {
                active++;
            }
        }
    );

    $("totalUsers").textContent =
        total;

    $("activeUsers").textContent =
        active;

    $("blockedUsers").textContent =
        blocked.length;
}


/* =========================================================
   BLOCKED USERS
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
            <div class="no-blocked">

                <div>✓</div>

                <strong>
                    All users are active
                </strong>

                <span>
                    No blocked UIDs at the moment.
                </span>

            </div>
        `;

        return;
    }

    blocked.forEach(uid => {

        const item =
            document.createElement(
                "div"
            );

        item.className =
            "blocked-item";

        item.innerHTML = `
            <div class="blocked-avatar">
                ⊘
            </div>

            <div class="blocked-info">

                <strong>
                    ${escapeHTML(uid)}
                </strong>

                <span>
                    Access restricted
                </span>

            </div>

            <button>
                Unblock
            </button>
        `;

        item.querySelector(
            "button"
        ).onclick =
            () => unblockUser(uid);

        box.appendChild(item);
    });
}


/* =========================================================
   ADD USER
========================================================= */

$("addUserBtn").onclick =
    openAddUser;

$("emptyAddBtn").onclick =
    openAddUser;

function openAddUser() {

    editingUID = null;

    $("modalTitle").textContent =
        "Add User";

    $("modalBadge").textContent =
        "NEW USER";

    $("uidInput").value = "";

    $("nameInput").value = "";

    $("userPasswordInput").value =
        "";

    $("uidInput").disabled =
        false;

    $("userModal")
        .classList
        .remove("hidden");

    setTimeout(() => {

        $("uidInput").focus();

    }, 100);
}


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

    $("modalBadge").textContent =
        "EDIT USER";

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


/* =========================================================
   SAVE USER FORM
========================================================= */

$("confirmUserBtn").onclick =
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

        if (
            newUID !== editingUID &&
            data.users[newUID]
        ) {

            showMessage(
                "This UID already exists.",
                "error"
            );

            return;
        }

        if (
            editingUID &&
            newUID !== editingUID
        ) {

            const oldUser =
                data.users[editingUID];

            delete data.users[
                editingUID
            ];

            data.users[newUID] = {
                name: name,
                password: password
            };

            if (
                Array.isArray(
                    data.blocked
                )
            ) {

                data.blocked =
                    data.blocked.map(
                        uid =>
                            uid ===
                            editingUID
                                ? newUID
                                : uid
                    );
            }

        } else {

            data.users[newUID] = {
                name: name,
                password: password
            };
        }

        closeUserModal();

        render();

        showMessage(
            editingUID
                ? "✓ User updated. Save to GitHub."
                : "✓ User added. Save to GitHub.",
            "success"
        );

        editingUID = null;
    };


/* =========================================================
   DELETE
========================================================= */

function deleteUser(uid) {

    const data =
        getCurrentData();

    const user =
        data.users?.[uid];

    if (!user) return;

    openConfirm(
        "Delete User?",
        `Delete "${user.name || uid}" permanently?`,
        "🗑",
        "delete",
        () => {

            if (data.users) {

                delete data.users[uid];
            }

            if (
                Array.isArray(
                    data.blocked
                )
            ) {

                data.blocked =
                    data.blocked.filter(
                        x => x !== uid
                    );
            }

            render();

            showMessage(
                "✓ User deleted. Save to GitHub.",
                "success"
            );
        }
    );
}


/* =========================================================
   BLOCK
========================================================= */

function blockUser(uid) {

    const data =
        getCurrentData();

    if (
        !Array.isArray(
            data.blocked
        )
    ) {

        data.blocked = [];
    }

    if (
        data.blocked.includes(uid)
    ) {
        return;
    }

    data.blocked.push(uid);

    render();

    showMessage(
        "✓ " +
        uid +
        " blocked. Save to GitHub.",
        "success"
    );
}


/* =========================================================
   UNBLOCK
========================================================= */

function unblockUser(uid) {

    const data =
        getCurrentData();

    if (
        Array.isArray(
            data.blocked
        )
    ) {

        data.blocked =
            data.blocked.filter(
                x => x !== uid
            );
    }

    render();

    showMessage(
        "✓ " +
        uid +
        " unblocked. Save to GitHub.",
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

$("clearSearch").onclick = () => {

    $("searchInput").value = "";

    searchText = "";

    renderUsers();

    $("searchInput").focus();
};


/* =========================================================
   KEYBOARD SEARCH
========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (
            (event.metaKey ||
             event.ctrlKey) &&
            event.key.toLowerCase() === "k"
        ) {

            event.preventDefault();

            $("searchInput").focus();
        }

        if (
            event.key ===
            "Escape"
        ) {

            $("userDetailModal")
                .classList
                .add("hidden");

            $("userModal")
                .classList
                .add("hidden");

            $("confirmModal")
                .classList
                .add("hidden");
        }
    }
);


/* =========================================================
   TABS
========================================================= */

document
    .querySelectorAll(".tab")
    .forEach(tab => {

        tab.onclick =
            function () {

                document
                    .querySelectorAll(
                        ".tab"
                    )
                    .forEach(
                        item =>
                            item.classList
                                .remove(
                                    "active"
                                )
                    );

                tab.classList.add(
                    "active"
                );

                currentFile =
                    tab.dataset.file;

                searchText = "";

                $("searchInput")
                    .value = "";

                render();
            };
    });


/* =========================================================
   REFRESH
========================================================= */

$("refreshBtn").onclick =
    async function () {

        const button = this;

        button.disabled = true;

        button.textContent = "…";

        await loadData();

        setTimeout(() => {

            button.disabled = false;

            button.textContent = "↻";

        }, 500);
    };


/* =========================================================
   USER MODAL
========================================================= */

function closeUserModal() {

    $("userModal")
        .classList
        .add("hidden");

    editingUID = null;
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

        if (
            input.type ===
            "password"
        ) {

            input.type = "text";

            this.textContent =
                "🙈";

        } else {

            input.type =
                "password";

            this.textContent =
                "👁";
        }
    };


/* =========================================================
   CONFIRM MODAL
========================================================= */

function openConfirm(
    title,
    text,
    icon,
    type,
    callback
) {

    $("confirmTitle").textContent =
        title;

    $("confirmText").textContent =
        text;

    $("confirmIcon").textContent =
        icon;

    $("confirmOk").className =
        "btn " +
        (
            type === "delete"
                ? "danger"
                : "primary"
        );

    pendingAction =
        callback;

    $("confirmModal")
        .classList
        .remove("hidden");
}

function closeConfirm() {

    $("confirmModal")
        .classList
        .add("hidden");

    pendingAction = null;
}

$("confirmCancel").onclick =
    closeConfirm;

$("confirmOk").onclick = () => {

    if (
        typeof pendingAction ===
        "function"
    ) {

        pendingAction();
    }

    closeConfirm();
};

$("confirmModal").onclick =
    event => {

        if (
            event.target ===
            $("confirmModal")
        ) {

            closeConfirm();
        }
    };


/* =========================================================
   SAVE TO GITHUB
========================================================= */

$("saveBtn").onclick =
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
            "<span class='spinner'></span> Saving...";

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

                        /*
                         * Send admin_session
                         * cookie with the request.
                         */

                        credentials:
                            "include",

                        body:
                            JSON.stringify({

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
                "❌ " +
                error.message,
                "error"
            );

        } finally {

            btn.disabled = false;

            btn.innerHTML =
                "<span>☁</span> Save to GitHub";
        }
    };


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}
