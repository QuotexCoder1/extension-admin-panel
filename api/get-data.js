import crypto from "crypto";

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(204).end();

    if (req.method !== "GET") {
        return res.status(405).json({
            success: false,
            error: "Method not allowed"
        });
    }

    // ==============================
    // ADMIN SESSION
    // ==============================

    const cookies = req.headers.cookie || "";
    const match = cookies.match(/(?:^|;\s*)admin_session=([^;]+)/);

    if (!match) {
        return res.status(401).json({
            success: false,
            error: "Admin login required"
        });
    }

    try {
        const decoded = Buffer
            .from(match[1], "base64url")
            .toString("utf8");

        const parts = decoded.split(":");

        if (parts.length !== 3) throw new Error();

        const [type, expiresAt, signature] = parts;

        if (type !== "admin") throw new Error();

        if (!Number.isFinite(Number(expiresAt))) {
            throw new Error();
        }

        if (Date.now() > Number(expiresAt)) {
            throw new Error();
        }

        const secret = process.env.ADMIN_SESSION_SECRET;

        if (!secret) {
            return res.status(500).json({
                success: false,
                error: "ADMIN_SESSION_SECRET is not configured"
            });
        }

        const expected = crypto
            .createHmac("sha256", secret)
            .update(`admin:${expiresAt}`)
            .digest("hex");

        if (
            signature.length !== expected.length ||
            !crypto.timingSafeEqual(
                Buffer.from(signature),
                Buffer.from(expected)
            )
        ) {
            throw new Error();
        }

    } catch {
        return res.status(401).json({
            success: false,
            error: "Invalid or expired admin session"
        });
    }

    // ==============================
    // GITHUB
    // ==============================

    const token = process.env.GITHUB_TOKEN;

    if (!token) {
        return res.status(500).json({
            success: false,
            error: "GITHUB_TOKEN is not configured"
        });
    }

    // ==============================
    // ALL BACKENDS
    // ==============================

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

        qxControl: {
            owner: "nasir12736",
            repo: "qx-control",
            path: "control1.json"
        }
    };

    async function getGitHubFile(config) {
        const url =
            `https://api.github.com/repos/` +
            `${config.owner}/${config.repo}/contents/${config.path}`;

        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "Extension-Admin-Panel"
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                `${config.repo}: GitHub HTTP ${response.status} - ` +
                `${data.message || "Unable to read file"}`
            );
        }

        if (!data.content) {
            throw new Error(`${config.repo}: File content missing`);
        }

        const decoded = Buffer
            .from(data.content.replace(/\n/g, ""), "base64")
            .toString("utf8");

        let json;

        try {
            json = JSON.parse(decoded);
        } catch {
            throw new Error(`${config.repo}: Invalid JSON`);
        }

        return {
            data: json,
            sha: data.sha,
            repository: config.repo,
            path: config.path
        };
    }

    try {
        const results = await Promise.all(
            Object.entries(repositories).map(
                async ([name, config]) => [
                    name,
                    await getGitHubFile(config)
                ]
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
