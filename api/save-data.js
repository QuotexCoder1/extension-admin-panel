export default async function handler(req, res) {

    // ==========================================
    // CORS
    // ==========================================

    res.setHeader("Access-Control-Allow-Origin", "*");
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
    // GITHUB TOKEN
    // ==========================================

    const token = process.env.GITHUB_TOKEN;

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

    let body;

    try {
        body = req.body || {};
    } catch (error) {
        return res.status(400).json({
            success: false,
            error: "Invalid request body"
        });
    }

    const file = body.file;
    const newData = body.data;

    // ==========================================
    // ALLOWED BACKEND FILES
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
            error: "Invalid backend file"
        });
    }

    if (
        !newData ||
        typeof newData !== "object" ||
        Array.isArray(newData)
    ) {

        return res.status(400).json({
            success: false,
            error: "Invalid JSON data"
        });
    }

    const config =
        repositories[file];

    const githubUrl =
        `https://api.github.com/repos/` +
        `${config.owner}/${config.repo}/contents/` +
        `${config.path}`;

    try {

        // ==========================================
        // GET CURRENT FILE + CURRENT SHA
        // ==========================================

        const currentResponse =
            await fetch(githubUrl, {

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
            });

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

        // ==========================================
        // CONVERT JSON → BASE64
        // ==========================================

        const jsonText =
            JSON.stringify(
                newData,
                null,
                2
            );

        const encoded =
            Buffer
                .from(jsonText, "utf8")
                .toString("base64");

        // ==========================================
        // UPDATE GITHUB
        // ==========================================

        const updateResponse =
            await fetch(githubUrl, {

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
            });

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

        // ==========================================
        // SUCCESS
        // ==========================================

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
