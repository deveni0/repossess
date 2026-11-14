import { GitHub } from "./github.js";
import { type Options, type UploadInput, type UploadResult, type ListItem, type Doc } from "./types.js";
export interface Collection<T extends Doc> {
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
    readonly backend: "sqlite" | "json";
}
export declare class StorageFiles {
    readonly gh: GitHub;
    readonly tmpDir = ".repossess/tmp";
    private opts;
    private collections;
    private tmpTimer;
    constructor(slug: string, opts: Options);
    collection<T extends Doc = Doc>(name: string): Collection<T>;
    upload(folder: string, input: UploadInput): Promise<UploadResult>;
    list(folder: string): Promise<ListItem[]>;
    get(path: string): Promise<{
        content: Buffer;
        sha: string;
    } | null>;
    remove(path: string): Promise<boolean>;
    removeFolder(folder: string): Promise<number>;
    cleanupTmp(): Promise<number>;
    destroy(): void;
}
