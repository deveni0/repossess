import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { nanoid } from "nanoid";
import { DocSchema, IdSchema } from "./types.js";
export class DB {
    gh;
    repoPath;
    cachePath;
    store = null;
    sha = null;
    queue = Promise.resolve();
    table;
    mode;
    useCache;
    maxRetries = 3;
    sqlite = null;
    constructor(gh, opts, table) {
        this.gh = gh;
        this.table = table.replace(/[^a-zA-Z0-9_]/g, "");
        this.mode = opts.storage;
        this.useCache = opts.cache;
        this.repoPath = `collections/${this.table}/data.${this.mode === "sqlite" ? "db" : "json"}`;
        const abs = resolve(opts.dir);
        const base = abs.replace(/\.db$/, "");
        this.cachePath = `${base}.${this.table}.cache.${this.mode === "sqlite" ? "db" : "json"}`;
        if (this.useCache)
            mkdirSync(dirname(this.cachePath), { recursive: true });
    }
    kind = () => this.mode;
    async load() {
        if (this.store)
            return this.store;
        if (this.mode === "sqlite")
            return this.loadSqlite();
        return this.loadJson();
    }
    async loadJson() {
        try {
            const file = await this.gh.getFile(this.repoPath);
            if (file) {
                this.sha = file.sha;
                this.store = JSON.parse(file.content.toString("utf8"));
                if (!this.store.rows)
                    this.store = { version: 1, rows: [] };
                this.writeCache();
                return this.store;
            }
            this.store = { version: 1, rows: [] };
            return this.store;
        }
        catch {
            if (this.useCache && existsSync(this.cachePath)) {
                try {
                    this.store = JSON.parse(readFileSync(this.cachePath, "utf8"));
                    if (!this.store.rows)
                        this.store = { version: 1, rows: [] };
                    return this.store;
                }
                catch { }
            }
            this.store = { version: 1, rows: [] };
            return this.store;
        }
    }
    async loadSqlite() {
        let file = null;
        try {
            file = await this.gh.getFile(this.repoPath);
            if (file) {
                this.sha = file.sha;
                if (this.useCache)
                    writeFileSync(this.cachePath, file.content);
            }
        }
        catch { }
        const { DatabaseSync } = await import("node:sqlite");
        const path = this.useCache ? this.cachePath : ":memory:";
        this.sqlite = new DatabaseSync(path);
        if (file && !this.useCache) {
            const tmpPath = resolve(dirname(this.cachePath), `.tmp-${nanoid(6)}.db`);
            writeFileSync(tmpPath, file.content);
            this.sqlite.close();
            this.sqlite = new DatabaseSync(tmpPath);
        }
        this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS ${this.table} (
        id TEXT PRIMARY KEY, data TEXT NOT NULL,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      )`);
        const rows = this.sqlite.prepare(`SELECT id, data, created_at, updated_at FROM ${this.table}`).all();
        this.store = {
            version: 1,
            rows: rows.map((r) => ({
                id: r.id,
                data: JSON.parse(r.data),
                created_at: r.created_at,
                updated_at: r.updated_at,
            })),
        };
        return this.store;
    }
    writeCache() {
        if (!this.useCache)
            return;
        try {
            if (this.mode === "json")
                writeFileSync(this.cachePath, JSON.stringify(this.store, null, 2), "utf8");
        }
        catch { }
    }
    save() {
        this.queue = this.queue.then(async () => {
            if (this.mode === "sqlite")
                await this.saveSqlite();
            else
                await this.saveJson();
        });
        return this.queue;
    }
    async saveJson() {
        const content = JSON.stringify(this.store, null, 2);
        let attempt = 0;
        while (attempt < this.maxRetries) {
            try {
                const res = await this.gh.putFile(this.repoPath, content, `repossess: sync ${this.table}`, this.sha ?? undefined);
                this.sha = res.data.content?.sha ?? null;
                this.writeCache();
                return;
            }
            catch (e) {
                attempt++;
                if (e.status === 409 || e.status === 422) {
                    try {
                        const fresh = await this.gh.getFile(this.repoPath);
                        this.sha = fresh?.sha ?? null;
                        if (fresh) {
                            const remote = JSON.parse(fresh.content.toString("utf8"));
                            const localIds = new Set(this.store.rows.map((r) => r.id));
                            for (const r of remote.rows ?? [])
                                if (!localIds.has(r.id))
                                    this.store.rows.push(r);
                        }
                    }
                    catch { }
                    continue;
                }
                if (attempt >= this.maxRetries)
                    throw e;
            }
        }
    }
    async saveSqlite() {
        this.sqlite.exec(`DELETE FROM ${this.table}`);
        const insert = this.sqlite.prepare(`INSERT INTO ${this.table} (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)`);
        for (const r of this.store.rows)
            insert.run(r.id, JSON.stringify(r.data), r.created_at, r.updated_at);
        let buf;
        if (this.useCache) {
            buf = readFileSync(this.cachePath);
        }
        else {
            const tmpPath = resolve(dirname(this.cachePath), `.tmp-${nanoid(6)}.db`);
            this.sqlite.exec(`VACUUM INTO '${tmpPath}'`);
            buf = readFileSync(tmpPath);
            try {
                (await import("node:fs")).unlinkSync(tmpPath);
            }
            catch { }
        }
        let attempt = 0;
        while (attempt < this.maxRetries) {
            try {
                const res = await this.gh.putFile(this.repoPath, buf, `repossess: sync ${this.table}`, this.sha ?? undefined);
                this.sha = res.data.content?.sha ?? null;
                return;
            }
            catch (e) {
                attempt++;
                if (e.status === 409 || e.status === 422) {
                    try {
                        const fresh = await this.gh.getFile(this.repoPath);
                        this.sha = fresh?.sha ?? null;
                        if (fresh) {
                            const tmpPath = this.cachePath + ".remote";
                            writeFileSync(tmpPath, fresh.content);
                            const { DatabaseSync } = await import("node:sqlite");
                            const remoteDb = new DatabaseSync(tmpPath);
                            const remoteRows = remoteDb.prepare(`SELECT id, data, created_at, updated_at FROM ${this.table}`).all();
                            const localIds = new Set(this.store.rows.map((r) => r.id));
                            for (const r of remoteRows) {
                                if (!localIds.has(r.id)) {
                                    this.store.rows.push({
                                        id: r.id,
                                        data: JSON.parse(r.data),
                                        created_at: r.created_at,
                                        updated_at: r.updated_at,
                                    });
                                }
                            }
                            remoteDb.close();
                        }
                    }
                    catch { }
                    continue;
                }
                if (attempt >= this.maxRetries)
                    throw e;
            }
        }
    }
    async create(data) {
        DocSchema.parse(data);
        const store = await this.load();
        const id = nanoid(12);
        const now = Date.now();
        store.rows.push({ id, data, created_at: now, updated_at: now });
        await this.save();
        return { id, ...data };
    }
    async get(id) {
        IdSchema.parse(id);
        const store = await this.load();
        const row = store.rows.find((r) => r.id === id);
        return row ? { id, ...row.data } : null;
    }
    async update(id, patch) {
        IdSchema.parse(id);
        const store = await this.load();
        const row = store.rows.find((r) => r.id === id);
        if (!row)
            return null;
        row.data = { ...row.data, ...patch };
        row.updated_at = Date.now();
        await this.save();
        return { id, ...row.data };
    }
    async delete(id) {
        IdSchema.parse(id);
        const store = await this.load();
        const idx = store.rows.findIndex((r) => r.id === id);
        if (idx === -1)
            return false;
        store.rows.splice(idx, 1);
        await this.save();
        return true;
    }
    async find(filter) {
        const store = await this.load();
        const items = store.rows.slice()
            .sort((a, b) => b.created_at - a.created_at)
            .map((r) => ({ id: r.id, ...r.data }));
        if (!filter)
            return items;
        return items.filter((it) => Object.entries(filter).every(([k, v]) => it[k] === v));
    }
    all() { return this.find(); }
    async count() {
        return (await this.load()).rows.length;
    }
    async refresh() {
        this.store = null;
        this.sha = null;
        if (this.sqlite) {
            try {
                this.sqlite.close();
            }
            catch { }
            this.sqlite = null;
        }
        await this.load();
    }
}
