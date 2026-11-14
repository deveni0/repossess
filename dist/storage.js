import { GitHub } from "./github.js";
import { DB } from "./db.js";
import { OptionsSchema, RepoSlugSchema, UploadInputSchema, } from "./types.js";
export class StorageFiles {
    gh;
    tmpDir = ".repossess/tmp";
    opts;
    collections = new Map();
    tmpTimer = null;
    constructor(slug, opts) {
        RepoSlugSchema.parse(slug);
        this.opts = OptionsSchema.parse(opts);
        this.gh = new GitHub(slug, this.opts);
        if (this.opts.tmpTtlMinutes > 0) {
            this.tmpTimer = setInterval(() => {
                this.cleanupTmp().catch(() => { });
            }, 5 * 60 * 1000);
            this.tmpTimer.unref?.();
        }
    }
    collection(name) {
        const key = name.trim().toLowerCase();
        if (!this.collections.has(key)) {
            const db = new DB(this.gh, this.opts, key);
            this.collections.set(key, {
                create: (d) => db.create(d),
                get: (id) => db.get(id),
                update: (id, p) => db.update(id, p),
                delete: (id) => db.delete(id),
                find: (f) => db.find(f),
                all: () => db.all(),
                count: () => db.count(),
                refresh: () => db.refresh(),
                backend: db.kind(),
            });
        }
        return this.collections.get(key);
    }
    async upload(folder, input) {
        const p = UploadInputSchema.parse(input);
        const name = p.namefile ?? (p.url ? p.url.split("/").pop().split("?")[0] : `file-${Date.now()}`);
        const dir = p.tmp ? `${this.tmpDir}/${folder}` : folder;
        const path = [dir, name].filter(Boolean).join("/").replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
        let content;
        if (p.url) {
            const res = await fetch(p.url);
            if (!res.ok)
                throw new Error(`Download failed: ${res.status}`);
            content = new Uint8Array(await res.arrayBuffer());
        }
        else
            content = p.buffer;
        const existing = await this.gh.getFile(path);
        const res = await this.gh.putFile(path, content, `repossess: upload ${path}`, existing?.sha);
        return {
            path,
            url: res.data.content?.download_url ?? "",
            raw: res.data.content?.download_url
                ? res.data.content.download_url.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/")
                : "",
            sha: res.data.content?.sha ?? "",
            size: res.data.content?.size ?? 0,
            tmp: p.tmp,
        };
    }
    async list(folder) {
        const items = await this.gh.listDir(folder);
        if (!items)
            return [];
        return items.map((it) => ({
            name: it.name, path: it.path,
            type: it.type === "dir" ? "dir" : "file",
            size: it.size, sha: it.sha,
            url: it.download_url,
            raw: it.download_url
                ? it.download_url.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/")
                : "",
        }));
    }
    get(path) { return this.gh.getFile(path); }
    async remove(path) {
        return this.gh.deleteFile(path, `repossess: delete ${path}`);
    }
    async removeFolder(folder) {
        const items = await this.gh.listDir(folder);
        if (!items)
            return 0;
        let removed = 0;
        for (const it of items) {
            if (it.type === "dir")
                removed += await this.removeFolder(it.path);
            else {
                const ok = await this.gh.deleteFile(it.path, `repossess: delete ${it.path}`);
                if (ok)
                    removed++;
            }
        }
        return removed;
    }
    async cleanupTmp() {
        if (this.opts.tmpTtlMinutes <= 0)
            return 0;
        const ttlMs = this.opts.tmpTtlMinutes * 60 * 1000;
        const now = Date.now();
        let removed = 0;
        const dirs = await this.gh.listDir(this.tmpDir);
        if (!dirs)
            return 0;
        for (const d of dirs) {
            if (d.type !== "dir")
                continue;
            const files = await this.gh.listDir(d.path);
            if (!files)
                continue;
            for (const f of files) {
                if (f.type !== "file")
                    continue;
                try {
                    const meta = await this.gh.getFileMeta(f.path);
                    if (!meta)
                        continue;
                    if (now - new Date(meta.committedAt).getTime() > ttlMs) {
                        const ok = await this.gh.deleteFile(f.path, `repossess: tmp cleanup ${f.path}`);
                        if (ok)
                            removed++;
                    }
                }
                catch { }
            }
        }
        return removed;
    }
    destroy() {
        if (this.tmpTimer)
            clearInterval(this.tmpTimer);
        this.tmpTimer = null;
    }
}
