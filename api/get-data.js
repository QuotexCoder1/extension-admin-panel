import crypto from "crypto";

export default async function handler(req, res) {

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    if (req.method !== "GET") {
        return res.status(405).json({
            success: false,
            error: "Method not allowed"
        });
    }

    // ==========================================
    // ADMIN SESSION
    // ==========================================

    const cookies = req.headers.cookie || "";

    const match = cookies.match(
        /(?:^|;\s*)admin_session=([^;]+)/
    );

    if (!match) {
        return res.status(401).json({
            success: false,
            error: "Admin login required"
        });
    }

    try {

        const sessionToken = match[1];

        const decoded = Buffer
            .from(sessionToken, "base64url")
            .toString("utf8");

        const parts = decoded.split(":");

        if (parts.length !== 3) {
            throw new Error("Invalid session");
        }

        const type = parts[0];
        const expiresAt = parts[1];
        const signature = parts[2];

        if (type !== "admin") {
            throw new Error("Invalid session type");
        }

        if (!Number.isFinite(Number(expiresAt))) {
            throw new Error("Invalid expiry");
        }

        if (Date.now() > Number(expiresAt)) {
            throw new Error("Session expired");
        }

        const secret = process.env.ADMIN_SESSION_SECRET;

        if (!secret) {
            return res.status(500).json({
                success: false,
                error: "ADMIN_SESSION_SECRET is not configured"
            });
        }

        const payload = `admin:${expiresAt}`;

        const expectedSignature = crypto
            .createHmac("sha256", secret)
            .update(payload)
            .digest("hex");

        if (
            signature.length !==
            expectedSignature.length
        ) {
            throw new Error("Invalid signature");
        }

        if (
            !crypto.timingSafeEqual(
                Buffer.from(signature),
                Buffer.from(expectedSignature)
            )
        ) {
            throw new Error("Invalid signature");
        }

    } catch (error) {

        return res.status(401).json({
            success: false,
            error: "Invalid or expired admin session"
        });
    }

    // ==========================================
    // GITHUB TOKEN
    // ==========================================

    const token = process.env.GITHUB_TOKEN;

    if (!token) {
        return res.status(500).json({
            success: false,
            error: "GITHUB_TOKEN is not configured"
        });
    }

    // ==========================================
    // REPOSITORIES
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
        },

        qxcontrol: {
            owner: "nasir12736",
            repo: "qx-control",
            path: "control1.json"
        }
    };

    // ==========================================
    // READ FILE
    // ==========================================

    async function getGitHubFile(config) {

        const url =
            `https://api.github.com/repos/` +
            `${config.owner}/${config.repo}/contents/` +
            `${config.path}`;

        const response = await fetch(url, {
            method: "GET",

            headers: {
                "Authorization": `Bearer ${token}`,
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "Extension-Admin-Panel"
            }
        });

        const result = await response.json();

        if (!response.ok) {

            throw new Error(
                `${config.repo}: GitHub HTTP ${response.status} - ` +
                `${result.message || "GitHub request failed"}`
            );
        }

        if (!result.content) {
            throw new Error(
                `${config.repo}: File content missing`
            );
        }

        const decoded = Buffer
            .from(
                result.content.replace(/\n/g, ""),
                "base64"
            )
            .toString("utf8");

        let json;

        try {
            json = JSON.parse(decoded);
        } catch {
            throw new Error(
                `${config.repo}: Invalid JSON`
            );
        }

        return {
            data: json,
            sha: result.sha,
            repository: config.repo,
            path: config.path
        };
    }

    // ==========================================
    // LOAD ALL
    // ==========================================

    try {

        const results = await Promise.all(

            Object.entries(repositories).map(
                async ([name, config]) => {

                    const result =
                        await getGitHubFile(config);

                    return [
                        name,
                        result
                    ];
                }
            )
        );

        return res.status(200).json({
            success: true,
            files: Object.fromEntries(results)
        });

    } catch (error) {

        console.error("GET DATA ERROR:", error);

        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
