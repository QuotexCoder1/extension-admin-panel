export default async (req) => {
    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, OPTIONS"
    };

    if (req.method === "OPTIONS") {
        return new Response("", {
            status: 204,
            headers
        });
    }

    try {

        const token = process.env.GITHUB_TOKEN;

        if (!token) {
            throw new Error(
                "GITHUB_TOKEN is not configured in Netlify"
            );
        }

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
                    "User-Agent": "Extension-Control-Panel"
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
                throw new Error(
                    `${config.repo}: JSON file content missing`
                );
            }

            const decoded =
                Buffer.from(
                    data.content.replace(/\n/g, ""),
                    "base64"
                ).toString("utf8");

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
                sha: data.sha,
                repository: config.repo,
                path: config.path
            };
        }

        const results =
            await Promise.all(
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

        return new Response(
            JSON.stringify({
                success: true,
                files
            }),
            {
                status: 200,
                headers
            }
        );

    } catch (error) {

        console.error(
            "get-data error:",
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
