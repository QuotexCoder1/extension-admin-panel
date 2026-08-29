export default async (req) => {
    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
    };

    if (req.method === "OPTIONS") {
        return new Response("", {
            status: 204,
            headers
        });
    }

    if (req.method !== "POST") {
        return new Response(
            JSON.stringify({
                success: false,
                error: "Method not allowed"
            }),
            {
                status: 405,
                headers
            }
        );
    }

    try {

        const token = process.env.GITHUB_TOKEN;

        if (!token) {
            throw new Error(
                "GITHUB_TOKEN is not configured in Netlify"
            );
        }

        const body = await req.json();

        const file = body.file;
        const newData = body.data;
        const sha = body.sha;

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

        if (!repositories[file]) {
            throw new Error(
                "Invalid backend file"
            );
        }

        if (
            !newData ||
            typeof newData !== "object"
        ) {
            throw new Error(
                "Invalid JSON data"
            );
        }

        const config =
            repositories[file];

        const url =
            `https://api.github.com/repos/` +
            `${config.owner}/${config.repo}/contents/` +
            `${config.path}`;

        /*
         * Get latest SHA from GitHub.
         * This prevents an old SHA from causing
         * unnecessary update failures.
         */

        const latestResponse =
            await fetch(url, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                    "User-Agent": "Extension-Control-Panel"
                }
            });

        const latest =
            await latestResponse.json();

        if (!latestResponse.ok) {
            throw new Error(
                `GitHub read failed: ${latestResponse.status} - ` +
                `${latest.message || "Unknown error"}`
            );
        }

        const latestSha =
            latest.sha || sha;

        if (!latestSha) {
            throw new Error(
                "GitHub file SHA is missing"
            );
        }

        /*
         * Convert JSON into Base64
         */

        const content =
            JSON.stringify(
                newData,
                null,
                2
            );

        const encoded =
            Buffer
                .from(content, "utf8")
                .toString("base64");

        /*
         * Update GitHub file
         */

        const updateResponse =
            await fetch(url, {
                method: "PUT",

                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Accept": "application/vnd.github+json",
                    "Content-Type": "application/json",
                    "X-GitHub-Api-Version": "2022-11-28",
                    "User-Agent": "Extension-Control-Panel"
                },

                body: JSON.stringify({
                    message:
                        `Update ${config.path} from Admin Panel`,

                    content: encoded,

                    sha: latestSha
                })
            });

        const result =
            await updateResponse.json();

        if (!updateResponse.ok) {

            throw new Error(
                `GitHub update failed: ` +
                `${updateResponse.status} - ` +
                `${result.message || "Unknown error"}`
            );
        }

        return new Response(
            JSON.stringify({
                success: true,
                message:
                    `${config.path} updated successfully`,
                repository:
                    config.repo,
                path:
                    config.path,
                commit:
                    result.commit?.sha || null
            }),
            {
                status: 200,
                headers
            }
        );

    } catch (error) {

        console.error(
            "save-data error:",
            error
        );

        return new Response(
            JSON.stringify({
                success: false,
                error: error.message
            }),
            {
                status: 500,
                headers
            }
        );
    }
};
