import { Octokit } from '@octokit/rest';
import pLimit from 'p-limit';
import { z } from 'zod';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { nanoid } from 'nanoid';

// src/github.ts
var OptionsSchema = z.object({
  token: z.string().min(1, "token is required"),
  branch: z.string().default("main"),
  dir: z.string().default(".repossess/data.db"),
  storage: z.enum(["json", "sqlite"]).default("sqlite"),
  tmpTtlMinutes: z.number().int().min(0).default(10),
  concurrency: z.number().int().positive().max(20).default(4),
  committer: z.object({ name: z.string().min(1), email: z.string().email() }).default({ name: "repossess", email: "repossess@users.noreply.github.com" })
});
var RepoSlugSchema = z.string().regex(/^[\w.-]+\/[\w.-]+$/, "repo must be 'owner/name'");
var UploadInputSchema = z.object({
  buffer: z.union([z.instanceof(Uint8Array), z.string()]).optional(),
  url: z.string().url().optional(),
  namefile: z.string().min(1).optional(),
  tmp: z.boolean().default(false)
}).refine((v) => v.buffer !== void 0 || v.url !== void 0, {
  message: "either 'buffer' or 'url' is required"
});
var UploadResultSchema = z.object({
  path: z.string(),
  url: z.string(),
  raw: z.string(),
  sha: z.string(),
  size: z.number(),
  tmp: z.boolean()
});
var ListItemSchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.enum(["file", "dir"]),
  size: z.number().optional(),
  sha: z.string().optional(),
  url: z.string().optional(),
  raw: z.string().optional()
});
var DocSchema = z.record(z.string(), z.unknown());
var IdSchema = z.string().min(1, "id is required");

// src/github.ts
var GitHub = class {
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
          owner: this.owner,
          repo: this.repo,
          path,
          ref: this.branch
        });
        const d = data;
        if (Array.isArray(d) || d.type !== "file") return null;
        return { content: Buffer.from(d.content, "base64"), sha: d.sha };
      } catch (e) {
        if (e.status === 404) return null;
        throw e;
      }
    });
  }
  getFileMeta(path) {
    return this.limit(async () => {
      try {
        const { data: commits } = await this.api.repos.listCommits({
          owner: this.owner,
          repo: this.repo,
          path,
          sha: this.branch,
          per_page: 1
        });
        if (!commits.length) return null;
        const { data } = await this.api.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path,
          ref: this.branch
        });
        const d = data;
        if (Array.isArray(d) || d.type !== "file") return null;
        return {
          sha: d.sha,
          size: d.size,
          committedAt: commits[0].commit.committer?.date ?? (/* @__PURE__ */ new Date()).toISOString(),
          downloadUrl: d.download_url ?? ""
        };
      } catch (e) {
        if (e.status === 404) return null;
        throw e;
      }
    });
  }
  putFile(path, content, message, sha) {
    const b64 = typeof content === "string" ? Buffer.from(content, "utf8").toString("base64") : Buffer.from(content).toString("base64");
    return this.limit(async () => {
      const res = await this.api.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path,
        message,
        content: b64,
        branch: this.branch,
        committer: this.committer,
        author: this.committer,
        ...sha ? { sha } : {}
      });
      const data = res.data;
      return {
        data: {
          content: data?.content ? { sha: data.content.sha, download_url: data.content.download_url, size: data.content.size } : null,
          commit: data?.commit ? { sha: data.commit.sha } : void 0
        },
        status: res.status,
        url: res.url
      };
    });
  }
  deleteFile(path, message) {
    return this.limit(async () => {
      const f = await this.getFile(path);
      if (!f) return false;
      await this.api.repos.deleteFile({
        owner: this.owner,
        repo: this.repo,
        path,
        message,
        sha: f.sha,
        branch: this.branch,
        committer: this.committer,
        author: this.committer
      });
      return true;
    });
  }
  listDir(path) {
    return this.limit(async () => {
      try {
        const { data } = await this.api.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path: path || "",
          ref: this.branch
        });
        return Array.isArray(data) ? data : null;
      } catch (e) {
        if (e.status === 404) return null;
        throw e;
      }
    });
  }
};
var DB = class {
  gh;
  repoPath;
  cachePath;
  store = null;
  sha = null;
  queue = Promise.resolve();
  table;
  mode;
  maxRetries = 3;
  sqlite = null;
  constructor(gh, opts, table) {
    this.gh = gh;
    this.table = table.replace(/[^a-zA-Z0-9_]/g, "");
    this.mode = opts.storage;
    this.repoPath = `collections/${this.table}/data.${this.mode === "sqlite" ? "db" : "json"}`;
    const abs = resolve(opts.dir);
    const base = abs.replace(/\.db$/, "");
    this.cachePath = `${base}.${this.table}.cache.${this.mode === "sqlite" ? "db" : "json"}`;
    mkdirSync(dirname(this.cachePath), { recursive: true });
  }
  kind = () => this.mode;
  async load() {
    if (this.store) return this.store;
    if (this.mode === "sqlite") return this.loadSqlite();
    return this.loadJson();
  }
  async loadJson() {
    try {
      const file = await this.gh.getFile(this.repoPath);
      if (file) {
        this.sha = file.sha;
        this.store = JSON.parse(file.content.toString("utf8"));
        if (!this.store.rows) this.store = { version: 1, rows: [] };
        this.writeCache();
        return this.store;
      }
      this.store = { version: 1, rows: [] };
      return this.store;
    } catch {
      if (existsSync(this.cachePath)) {
        try {
          this.store = JSON.parse(readFileSync(this.cachePath, "utf8"));
          if (!this.store.rows) this.store = { version: 1, rows: [] };
          return this.store;
        } catch {
        }
      }
      this.store = { version: 1, rows: [] };
      return this.store;
    }
  }
  async loadSqlite() {
    try {
      const file = await this.gh.getFile(this.repoPath);
      if (file) {
        this.sha = file.sha;
        writeFileSync(this.cachePath, file.content);
      }
    } catch {
    }
    const { DatabaseSync } = await import('sqlite');
    if (!existsSync(this.cachePath)) {
      this.sqlite = new DatabaseSync(this.cachePath);
      this.sqlite.exec(`
        CREATE TABLE IF NOT EXISTS ${this.table} (
          id TEXT PRIMARY KEY, data TEXT NOT NULL,
          created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
        )`);
    } else {
      this.sqlite = new DatabaseSync(this.cachePath);
    }
    const rows = this.sqlite.prepare(
      `SELECT id, data, created_at, updated_at FROM ${this.table}`
    ).all();
    this.store = {
      version: 1,
      rows: rows.map((r) => ({
        id: r.id,
        data: JSON.parse(r.data),
        created_at: r.created_at,
        updated_at: r.updated_at
      }))
    };
    return this.store;
  }
  writeCache() {
    try {
      if (this.mode === "json")
        writeFileSync(this.cachePath, JSON.stringify(this.store, null, 2), "utf8");
    } catch {
    }
  }
  save() {
    this.queue = this.queue.then(async () => {
      if (this.mode === "sqlite") await this.saveSqlite();
      else await this.saveJson();
    });
    return this.queue;
  }
  async saveJson() {
    const content = JSON.stringify(this.store, null, 2);
    let attempt = 0;
    while (attempt < this.maxRetries) {
      try {
        const res = await this.gh.putFile(
          this.repoPath,
          content,
          `repossess: sync ${this.table}`,
          this.sha ?? void 0
        );
        this.sha = res.data.content?.sha ?? null;
        this.writeCache();
        return;
      } catch (e) {
        attempt++;
        if (e.status === 409 || e.status === 422) {
          try {
            const fresh = await this.gh.getFile(this.repoPath);
            this.sha = fresh?.sha ?? null;
            if (fresh) {
              const remote = JSON.parse(fresh.content.toString("utf8"));
              const localIds = new Set(this.store.rows.map((r) => r.id));
              for (const r of remote.rows ?? [])
                if (!localIds.has(r.id)) this.store.rows.push(r);
            }
          } catch {
          }
          continue;
        }
        if (attempt >= this.maxRetries) throw e;
      }
    }
  }
  async saveSqlite() {
    this.sqlite.exec(`DELETE FROM ${this.table}`);
    const insert = this.sqlite.prepare(
      `INSERT INTO ${this.table} (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)`
    );
    for (const r of this.store.rows)
      insert.run(r.id, JSON.stringify(r.data), r.created_at, r.updated_at);
    const buf = readFileSync(this.cachePath);
    let attempt = 0;
    while (attempt < this.maxRetries) {
      try {
        const res = await this.gh.putFile(
          this.repoPath,
          buf,
          `repossess: sync ${this.table}`,
          this.sha ?? void 0
        );
        this.sha = res.data.content?.sha ?? null;
        return;
      } catch (e) {
        attempt++;
        if (e.status === 409 || e.status === 422) {
          try {
            const fresh = await this.gh.getFile(this.repoPath);
            this.sha = fresh?.sha ?? null;
            if (fresh) {
              const tmpPath = this.cachePath + ".remote";
              writeFileSync(tmpPath, fresh.content);
              const { DatabaseSync } = await import('sqlite');
              const remoteDb = new DatabaseSync(tmpPath);
              const remoteRows = remoteDb.prepare(
                `SELECT id, data, created_at, updated_at FROM ${this.table}`
              ).all();
              const localIds = new Set(this.store.rows.map((r) => r.id));
              for (const r of remoteRows) {
                if (!localIds.has(r.id)) {
                  this.store.rows.push({
                    id: r.id,
                    data: JSON.parse(r.data),
                    created_at: r.created_at,
                    updated_at: r.updated_at
                  });
                }
              }
              remoteDb.close();
            }
          } catch {
          }
          continue;
        }
        if (attempt >= this.maxRetries) throw e;
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
    if (!row) return null;
    row.data = { ...row.data, ...patch };
    row.updated_at = Date.now();
    await this.save();
    return { id, ...row.data };
  }
  async delete(id) {
    IdSchema.parse(id);
    const store = await this.load();
    const idx = store.rows.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    store.rows.splice(idx, 1);
    await this.save();
    return true;
  }
  async find(filter) {
    const store = await this.load();
    const items = store.rows.slice().sort((a, b) => b.created_at - a.created_at).map((r) => ({ id: r.id, ...r.data }));
    if (!filter) return items;
    return items.filter(
      (it) => Object.entries(filter).every(([k, v]) => it[k] === v)
    );
  }
  all() {
    return this.find();
  }
  async count() {
    return (await this.load()).rows.length;
  }
  async refresh() {
    this.store = null;
    this.sha = null;
    if (this.sqlite) {
      try {
        this.sqlite.close();
      } catch {
      }
      this.sqlite = null;
    }
    await this.load();
  }
};

// src/storage.ts
var StorageFiles = class {
  gh;
  tmpDir = ".repossess/tmp";
  opts;
  collections = /* @__PURE__ */ new Map();
  tmpTimer = null;
  constructor(slug, opts) {
    RepoSlugSchema.parse(slug);
    this.opts = OptionsSchema.parse(opts);
    this.gh = new GitHub(slug, this.opts);
    if (this.opts.tmpTtlMinutes > 0) {
      this.tmpTimer = setInterval(() => {
        this.cleanupTmp().catch(() => {
        });
      }, 5 * 60 * 1e3);
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
        backend: db.kind()
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
      const res2 = await fetch(p.url);
      if (!res2.ok) throw new Error(`Download failed: ${res2.status}`);
      content = new Uint8Array(await res2.arrayBuffer());
    } else content = p.buffer;
    const existing = await this.gh.getFile(path);
    const res = await this.gh.putFile(path, content, `repossess: upload ${path}`, existing?.sha);
    return {
      path,
      url: res.data.content?.download_url ?? "",
      raw: res.data.content?.download_url ? res.data.content.download_url.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/") : "",
      sha: res.data.content?.sha ?? "",
      size: res.data.content?.size ?? 0,
      tmp: p.tmp
    };
  }
  async list(folder) {
    const items = await this.gh.listDir(folder);
    if (!items) return [];
    return items.map((it) => ({
      name: it.name,
      path: it.path,
      type: it.type === "dir" ? "dir" : "file",
      size: it.size,
      sha: it.sha,
      url: it.download_url,
      raw: it.download_url ? it.download_url.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/") : ""
    }));
  }
  get(path) {
    return this.gh.getFile(path);
  }
  async remove(path) {
    return this.gh.deleteFile(path, `repossess: delete ${path}`);
  }
  async removeFolder(folder) {
    const items = await this.gh.listDir(folder);
    if (!items) return 0;
    let removed = 0;
    for (const it of items) {
      if (it.type === "dir") removed += await this.removeFolder(it.path);
      else {
        const ok = await this.gh.deleteFile(it.path, `repossess: delete ${it.path}`);
        if (ok) removed++;
      }
    }
    return removed;
  }
  async cleanupTmp() {
    if (this.opts.tmpTtlMinutes <= 0) return 0;
    const ttlMs = this.opts.tmpTtlMinutes * 60 * 1e3;
    const now = Date.now();
    let removed = 0;
    const dirs = await this.gh.listDir(this.tmpDir);
    if (!dirs) return 0;
    for (const d of dirs) {
      if (d.type !== "dir") continue;
      const files = await this.gh.listDir(d.path);
      if (!files) continue;
      for (const f of files) {
        if (f.type !== "file") continue;
        try {
          const meta = await this.gh.getFileMeta(f.path);
          if (!meta) continue;
          if (now - new Date(meta.committedAt).getTime() > ttlMs) {
            const ok = await this.gh.deleteFile(f.path, `repossess: tmp cleanup ${f.path}`);
            if (ok) removed++;
          }
        } catch {
        }
      }
    }
    return removed;
  }
  destroy() {
    if (this.tmpTimer) clearInterval(this.tmpTimer);
    this.tmpTimer = null;
  }
};

export { DB, DocSchema, GitHub, IdSchema, ListItemSchema, OptionsSchema, RepoSlugSchema, StorageFiles, UploadInputSchema, UploadResultSchema };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map