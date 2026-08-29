export default async function handler(req, res) {
    // ================================
    // CORS
    // ================================

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, OPTIONS"
    );
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    if (req.method !== "GET") {
        return res.status(405).json({
            success: false,
            error: "Method not allowed"
        });
    }

    // ================================
    // GITHUB TOKEN
    // ================================

    const token = process.env.GITHUB_TOKEN;

    if (!token) {
        return res.status(500).json({
            success: false,
            error: "GITHUB_TOKEN is not configured in Vercel"
        });
    }

    // ================================
    // BACKEND REPOSITORIES
    // ================================

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

    // ================================
    // READ GITHUB JSON
    // ================================

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

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                `${config.repo}: GitHub HTTP ${response.status} - ` +
                `${data.message || "GitHub request failed"}`
            );
        }

        if (!data.content) {
            throw new Error(
                `${config.repo}: File content missing`
            );
        }

        // GitHub Base64 → normal text
        const decoded = Buffer.from(
            data.content.replace(/\n/g, ""),
            "base64"
        ).toString("utf8");

        let json;

        try {
            json = JSON.parse(decoded);
        } catch (error) {
            throw new Error(
                `${config.repo}: Invalid JSON`
            );
        }

        return {
            data: json,
            sha: data.sha,
            repository: config.repo,
            path: config.path
        };
    }

    // ================================
    // LOAD ALL 3 BACKENDS
    // ================================

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

        const files =
            Object.fromEntries(results);

        // ================================
        // SUCCESS
        // ================================

        return res.status(200).json({
            success: true,
            files
        });

    } catch (error) {

        console.error(
            "GET DATA ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
