let files = {};
let currentFile = "withdrawal";
let editingUID = null;
let searchText = "";

const fileNames = {
    withdrawal: "Withdrawal.json",
    yns: "yns.json",
    wns: "wns.json"
};

const $ = id => document.getElementById(id);

function showMessage(text, type = "") {
    const box = $("message");
    box.textContent = text;
    box.className = "message " + type;

    setTimeout(() => {
        box.textContent = "";
        box.className = "message";
    }, 5000);
}

async function loadData() {

    $("backendStatus").textContent = "Loading";

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

        render();

        showMessage(
            "GitHub data loaded successfully",
            "success"
        );

    } catch (error) {

        console.error(error);

        $("backendStatus").textContent = "Error";

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

function render() {

    const data = getCurrentData();

    $("currentFile").textContent =
        fileNames[currentFile];

    if (currentFile === "withdrawal") {

        $("settingsCard").style.display = "block";

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

    const table = $("usersTable");

    table.innerHTML = "";

    const entries = Object.entries(users);

    const filtered = entries.filter(
        ([uid, user]) => {

            const search =
                searchText.toLowerCase();

            return (
                uid.toLowerCase().includes(search) ||
                String(user?.name || "")
                    .toLowerCase()
                    .includes(search)
            );
        }
    );

    $("totalUsers").textContent =
        entries.length;

    if (!filtered.length) {
        $("emptyUsers").classList.remove("hidden");
    } else {
        $("emptyUsers").classList.add("hidden");
    }

    const blocked =
        Array.isArray(data.blocked)
            ? data.blocked
            : [];

    filtered.forEach(([uid, user]) => {

        const tr = document.createElement("tr");

        const uidTd =
            document.createElement("td");

        uidTd.textContent = uid;

        const nameTd =
            document.createElement("td");

        nameTd.textContent =
            user?.name || "—";

        const passwordTd =
            document.createElement("td");

        passwordTd.textContent =
            user?.password || "—";

        const statusTd =
            document.createElement("td");

        const status =
            document.createElement("span");

        const isBlocked =
            blocked.includes(uid);

        status.className =
            "status-badge " +
            (
                isBlocked
                    ? "status-blocked"
                    : "status-active"
            );

        status.textContent =
            isBlocked
                ? "BLOCKED"
                : "ACTIVE";

        statusTd.appendChild(status);

        const actionTd =
            document.createElement("td");

        const editBtn =
            document.createElement("button");

        editBtn.className =
            "btn secondary";

        editBtn.textContent = "Edit";

        editBtn.onclick =
            () => openEditUser(uid);

        const blockBtn =
            document.createElement("button");

        blockBtn.className =
            "btn secondary";

        blockBtn.textContent =
            isBlocked
                ? "Unblock"
                : "Block";

        blockBtn.onclick = () => {

            if (isBlocked) {
                unblockUser(uid);
            } else {
                blockUser(uid);
            }
        };

        const deleteBtn =
            document.createElement("button");

        deleteBtn.className =
            "btn secondary";

        deleteBtn.textContent = "Delete";

        deleteBtn.onclick =
            () => deleteUser(uid);

        actionTd.append(
            editBtn,
            blockBtn,
            deleteBtn
        );

        tr.append(
            uidTd,
            nameTd,
            passwordTd,
            statusTd,
            actionTd
        );

        table.appendChild(tr);
    });
}

function renderStats() {

    const data = getCurrentData();

    const users = data.users || {};

    const blocked =
        Array.isArray(data.blocked)
            ? data.blocked
            : [];

    $("totalUsers").textContent =
        Object.keys(users).length;

    $("blockedUsers").textContent =
        blocked.length;

    let active = 0;

    Object.keys(users).forEach(uid => {

        if (!blocked.includes(uid)) {
            active++;
        }
    });

    $("activeUsers").textContent =
        active;
}

function renderBlocked() {

    const data = getCurrentData();

    const blocked =
        Array.isArray(data.blocked)
            ? data.blocked
            : [];

    const box = $("blockedList");

    box.innerHTML = "";

    $("blockedCount").textContent =
        blocked.length;

    if (!blocked.length) {

        box.innerHTML =
            '<div class="empty">' +
            '<div>✓</div>' +
            '<strong>No blocked UIDs</strong>' +
            '<span>All users are currently allowed.</span>' +
            '</div>';

        return;
    }

    blocked.forEach(uid => {

        const item =
            document.createElement("div");

        item.className =
            "blocked-item";

        const text =
            document.createElement("span");

        text.textContent = uid;

        const button =
            document.createElement("button");

        button.textContent = "Unblock";

        button.onclick =
            () => unblockUser(uid);

        item.append(
            text,
            button
        );

        box.appendChild(item);
    });
}

$("addUserBtn").onclick = function () {

    editingUID = null;

    $("modalTitle").textContent =
        "Add UID";

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
        "Edit UID";

    $("uidInput").value = uid;

    $("nameInput").value =
        user.name || "";

    $("userPasswordInput").value =
        user.password || "";

    $("uidInput").disabled = true;

    $("userModal")
        .classList
        .remove("hidden");
}

$("confirmUserBtn").onclick = function () {

    const uid =
        $("uidInput").value.trim();

    const name =
        $("nameInput").value.trim();

    const password =
        $("userPasswordInput").value;

    if (!uid) {
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

    if (!editingUID && data.users[uid]) {

        showMessage(
            "This UID already exists",
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
        "User changed. Press Save to GitHub.",
        "success"
    );
};

function deleteUser(uid) {

    if (!confirm("Delete UID " + uid + "?")) {
        return;
    }

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

$("activeToggle").onchange =
    function (event) {

        const data = getCurrentData();

        data.active =
            event.target.checked;

        showMessage(
            "Active setting changed. Save to GitHub.",
            "success"
        );
    };

$("passwordToggle").onchange =
    function (event) {

        const data = getCurrentData();

        data.password_required =
            event.target.checked;

        showMessage(
            "Password setting changed. Save to GitHub.",
            "success"
        );
    };

$("searchInput").oninput =
    function (event) {

        searchText =
            event.target.value.trim();

        renderUsers();
    };

$("saveBtn").onclick =
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

        btn.textContent =
            "Saving to GitHub...";

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
                "✅ GitHub updated successfully!",
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

document
    .querySelectorAll(".tab")
    .forEach(tab => {

        tab.onclick = function () {

            document
                .querySelectorAll(".tab")
                .forEach(item =>
                    item.classList
                        .remove("active")
                );

            tab.classList.add("active");

            currentFile =
                tab.dataset.file;

            searchText = "";

            $("searchInput").value = "";

            render();
        };
    });

$("refreshBtn").onclick =
    function () {
        loadData();
    };

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
    function (event) {

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

            this.textContent = "🙈";

        } else {

            input.type = "password";

            this.textContent = "👁";
        }
    };

loadData();
