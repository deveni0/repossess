import type { Doc, OptionsParsed } from "./types.js";
import type { GitHub } from "./github.js";
type Mode = "sqlite" | "json";
export declare class DB<T extends Doc = Doc> {
    private gh;
    private repoPath;
    private cachePath;
    private store;
    private sha;
    private queue;
    private table;
    private mode;
    private maxRetries;
    private sqlite;
    constructor(gh: GitHub, opts: OptionsParsed, table: string);
    readonly kind: () => Mode;
    private load;
    private loadJson;
    private loadSqlite;
    private writeCache;
    private save;
    private saveJson;
    private saveSqlite;
    create(data: T): Promise<T & {
        id: string;
    }>;
    get(id: string): Promise<(T & {
        id: string;
    }) | null>;
    update(id: string, patch: Partial<T>): Promise<(T & {
        id: string;
    }) | null>;
    delete(id: string): Promise<boolean>;
    find(filter?: Partial<T>): Promise<(T & {
        id: string;
    })[]>;
    all(): Promise<(T & {
        id: string;
    })[]>;
    count(): Promise<number>;
    refresh(): Promise<void>;
}
export {};
