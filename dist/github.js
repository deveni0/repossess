import { Octokit } from "@octokit/rest";
import pLimit from "p-limit";
import { RepoSlugSchema } from "./types.js";
export class GitHub {
    api;
    owner;
    repo;
    branch;
    limit;
    committer;
    constructor(slug, opts) {
        RepoSlugSchema.parse(slug);
        const [owner, repo] = slug.split("/");
        this.owner = owner;
        this.repo = repo;
        this.branch = opts.branch;
        this.committer = opts.committer;
        this.api = new Octokit({ auth: opts.token });
        this.limit = pLimit(opts.concurrency);
    }
    getFile(path) {
        return this.limit(async () => {
            try {
                const { data } = await this.api.repos.getContent({
                    owner: this.owner, repo: this.repo, path, ref: this.branch,
                });
                const d = data;
                if (Array.isArray(d) || d.type !== "file")
                    return null;
                return { content: Buffer.from(d.content, "base64"), sha: d.sha };
            }
            catch (e) {
                if (e.status === 404)
                    return null;
                throw e;
            }
        });
    }
    getFileMeta(path) {
        return this.limit(async () => {
            try {
                const { data: commits } = await this.api.repos.listCommits({
                    owner: this.owner, repo: this.repo, path, sha: this.branch, per_page: 1,
                });
                if (!commits.length)
                    return null;
                const { data } = await this.api.repos.getContent({
                    owner: this.owner, repo: this.repo, path, ref: this.branch,
                });
                const d = data;
                if (Array.isArray(d) || d.type !== "file")
                    return null;
                return {
                    sha: d.sha,
                    size: d.size,
                    committedAt: commits[0].commit.committer?.date ?? new Date().toISOString(),
                    downloadUrl: d.download_url ?? "",
                };
            }
            catch (e) {
                if (e.status === 404)
                    return null;
                throw e;
            }
        });
    }
    putFile(path, content, message, sha) {
        const b64 = typeof content === "string"
            ? Buffer.from(content, "utf8").toString("base64")
            : Buffer.from(content).toString("base64");
        return this.limit(async () => {
            const res = await this.api.repos.createOrUpdateFileContents({
                owner: this.owner, repo: this.repo, path, message,
                content: b64, branch: this.branch,
                committer: this.committer, author: this.committer,
                ...(sha ? { sha } : {}),
            });
            const data = res.data;
            return {
                data: {
                    content: data?.content
                        ? { sha: data.content.sha, download_url: data.content.download_url, size: data.content.size }
                        : null,
                    commit: data?.commit ? { sha: data.commit.sha } : undefined,
                },
                status: res.status,
                url: res.url,
            };
        });
    }
    deleteFile(path, message) {
        return this.limit(async () => {
            const f = await this.getFile(path);
            if (!f)
                return false;
            await this.api.repos.deleteFile({
                owner: this.owner, repo: this.repo, path, message,
                sha: f.sha, branch: this.branch,
                committer: this.committer, author: this.committer,
            });
            return true;
        });
    }
    listDir(path) {
        return this.limit(async () => {
            try {
                const { data } = await this.api.repos.getContent({
                    owner: this.owner, repo: this.repo, path: path || "", ref: this.branch,
                });
                return Array.isArray(data) ? data : null;
            }
            catch (e) {
                if (e.status === 404)
                    return null;
                throw e;
            }
        });
    }
}
