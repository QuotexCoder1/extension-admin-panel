import crypto from "crypto";

export default async function handler(req, res) {

    // ==========================================
    // CORS
    // ==========================================

    res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
    );

    res.setHeader(
        "Access-Control-Allow-Methods",
        "POST, OPTIONS"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({
            success: false,
            error: "Method not allowed"
        });
    }

    // ==========================================
    // VERIFY ADMIN SESSION
    // ==========================================

    const cookies =
        req.headers.cookie || "";

    const match =
        cookies.match(
            /(?:^|;\s*)admin_session=([^;]+)/
        );

    if (!match) {

        return res.status(401).json({
            success: false,
            error: "Admin login required"
        });
    }

    const sessionToken =
        match[1];

    try {

        const decoded =
            Buffer
                .from(
                    sessionToken,
                    "base64url"
                )
                .toString("utf8");

        const parts =
            decoded.split(":");

        if (parts.length !== 3) {
            throw new Error(
                "Invalid session"
            );
        }

        const type =
            parts[0];

        const expiresAt =
            parts[1];

        const signature =
            parts[2];

        if (type !== "admin") {
            throw new Error(
                "Invalid session type"
            );
        }

        if (
            !Number.isFinite(
                Number(expiresAt)
            )
        ) {
            throw new Error(
                "Invalid session expiry"
            );
        }

        if (
            Date.now() >
            Number(expiresAt)
        ) {
            throw new Error(
                "Session expired"
            );
        }

        const sessionSecret =
            process.env.ADMIN_SESSION_SECRET;

        if (!sessionSecret) {

            return res.status(500).json({
                success: false,
                error:
                    "ADMIN_SESSION_SECRET is not configured"
            });
        }

        const payload =
            `admin:${expiresAt}`;

        const expectedSignature =
            crypto
                .createHmac(
                    "sha256",
                    sessionSecret
                )
                .update(payload)
                .digest("hex");

        if (
            signature.length !==
            expectedSignature.length
        ) {
            throw new Error(
                "Invalid session signature"
            );
        }

        if (
            !crypto.timingSafeEqual(
                Buffer.from(signature),
                Buffer.from(expectedSignature)
            )
        ) {
            throw new Error(
                "Invalid session signature"
            );
        }

    } catch (error) {

        return res.status(401).json({
            success: false,
            error:
                "Invalid or expired admin session"
        });
    }

    // ==========================================
    // GITHUB TOKEN
    // ==========================================

    const token =
        process.env.GITHUB_TOKEN;

    if (!token) {

        return res.status(500).json({
            success: false,
            error:
                "GITHUB_TOKEN is not configured in Vercel"
        });
    }

    // ==========================================
    // REQUEST DATA
    // ==========================================

    const body =
        req.body || {};

    const file =
        body.file;

    const newData =
        body.data;

    // ==========================================
    // ALLOWED REPOSITORIES
    // ==========================================

    const repositories = {

        withdrawal: {
            owner: "QuotexCoder1",
            repo: "Withdrawal",
            path: "Withdrawal.json"
        },

        yns: {
            owner: "QuotexCoder1",
            repo: "yns",
            path: "yns.json"
        },

        wns: {
            owner: "QuotexCoder1",
            repo: "wns",
            path: "wns.json"
        }

    };

    // ==========================================
    // VALIDATION
    // ==========================================

    if (!repositories[file]) {

        return res.status(400).json({
            success: false,
            error:
                "Invalid backend file"
        });
    }

    if (
        !newData ||
        typeof newData !== "object" ||
        Array.isArray(newData)
    ) {

        return res.status(400).json({
            success: false,
            error:
                "Invalid JSON data"
        });
    }

    const config =
        repositories[file];

    const githubUrl =
        `https://api.github.com/repos/` +
        `${config.owner}/${config.repo}/contents/` +
        `${config.path}`;

    try {

        // ======================================
        // GET CURRENT SHA
        // ======================================

        const currentResponse =
            await fetch(
                githubUrl,
                {
                    method: "GET",

                    headers: {

                        "Authorization":
                            `Bearer ${token}`,

                        "Accept":
                            "application/vnd.github+json",

                        "X-GitHub-Api-Version":
                            "2022-11-28",

                        "User-Agent":
                            "Extension-Admin-Panel"
                    }
                }
            );

        const current =
            await currentResponse.json();

        if (!currentResponse.ok) {

            return res.status(
                currentResponse.status
            ).json({

                success: false,

                error:
                    `${config.repo}: GitHub HTTP ` +
                    `${currentResponse.status} - ` +
                    `${current.message || "Unable to read file"}`
            });
        }

        if (!current.sha) {

            return res.status(500).json({

                success: false,

                error:
                    `${config.repo}: GitHub SHA missing`
            });
        }

        // ======================================
        // JSON → BASE64
        // ======================================

        const jsonText =
            JSON.stringify(
                newData,
                null,
                2
            );

        const encoded =
            Buffer
                .from(
                    jsonText,
                    "utf8"
                )
                .toString("base64");

        // ======================================
        // UPDATE GITHUB
        // ======================================

        const updateResponse =
            await fetch(
                githubUrl,
                {

                    method: "PUT",

                    headers: {

                        "Authorization":
                            `Bearer ${token}`,

                        "Accept":
                            "application/vnd.github+json",

                        "Content-Type":
                            "application/json",

                        "X-GitHub-Api-Version":
                            "2022-11-28",

                        "User-Agent":
                            "Extension-Admin-Panel"
                    },

                    body: JSON.stringify({

                        message:
                            `Admin Panel: Update ${config.path}`,

                        content:
                            encoded,

                        sha:
                            current.sha

                    })
                }
            );

        const result =
            await updateResponse.json();

        if (!updateResponse.ok) {

            return res.status(
                updateResponse.status
            ).json({

                success: false,

                error:
                    `GitHub update failed: ` +
                    `${updateResponse.status} - ` +
                    `${result.message || "Unknown GitHub error"}`
            });
        }

        // ======================================
        // SUCCESS
        // ======================================

        return res.status(200).json({

            success: true,

            message:
                `${config.repo}/${config.path} updated successfully`,

            repository:
                config.repo,

            path:
                config.path,

            commit:
                result.commit?.sha || null

        });

    } catch (error) {

        console.error(
            "SAVE DATA ERROR:",
            error
        );

        return res.status(500).json({

            success: false,

            error:
                error.message ||
                "Server error"

        });
    }
}
