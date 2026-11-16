import { Octokit } from '@octokit/rest';
import pLimit from 'p-limit';
import { z } from 'zod';

declare const OptionsSchema: z.ZodObject<{
    token: z.ZodString;
    branch: z.ZodDefault<z.ZodString>;
    dir: z.ZodDefault<z.ZodString>;
    storage: z.ZodDefault<z.ZodEnum<["json", "sqlite"]>>;
    cache: z.ZodDefault<z.ZodBoolean>;
    tmpTtlMinutes: z.ZodDefault<z.ZodNumber>;
    concurrency: z.ZodDefault<z.ZodNumber>;
    committer: z.ZodDefault<z.ZodObject<{
        name: z.ZodString;
        email: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        email: string;
    }, {
        name: string;
        email: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    token: string;
    branch: string;
    dir: string;
    storage: "json" | "sqlite";
    cache: boolean;
    tmpTtlMinutes: number;
    concurrency: number;
    committer: {
        name: string;
        email: string;
    };
}, {
    token: string;
    branch?: string | undefined;
    dir?: string | undefined;
    storage?: "json" | "sqlite" | undefined;
    cache?: boolean | undefined;
    tmpTtlMinutes?: number | undefined;
    concurrency?: number | undefined;
    committer?: {
        name: string;
        email: string;
    } | undefined;
}>;
declare const UploadInputSchema: z.ZodEffects<z.ZodObject<{
    buffer: z.ZodOptional<z.ZodUnion<[z.ZodType<Uint8Array<ArrayBuffer>, z.ZodTypeDef, Uint8Array<ArrayBuffer>>, z.ZodString]>>;
    url: z.ZodOptional<z.ZodString>;
    namefile: z.ZodOptional<z.ZodString>;
    tmp: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    tmp: boolean;
    buffer?: string | Uint8Array<ArrayBuffer> | undefined;
    url?: string | undefined;
    namefile?: string | undefined;
}, {
    buffer?: string | Uint8Array<ArrayBuffer> | undefined;
    url?: string | undefined;
    namefile?: string | undefined;
    tmp?: boolean | undefined;
}>, {
    tmp: boolean;
    buffer?: string | Uint8Array<ArrayBuffer> | undefined;
    url?: string | undefined;
    namefile?: string | undefined;
}, {
    buffer?: string | Uint8Array<ArrayBuffer> | undefined;
    url?: string | undefined;
    namefile?: string | undefined;
    tmp?: boolean | undefined;
}>;
declare const UploadResultSchema: z.ZodObject<{
    path: z.ZodString;
    url: z.ZodString;
    raw: z.ZodString;
    sha: z.ZodString;
    size: z.ZodNumber;
    tmp: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    path: string;
    url: string;
    tmp: boolean;
    raw: string;
    sha: string;
    size: number;
}, {
    path: string;
    url: string;
    tmp: boolean;
    raw: string;
    sha: string;
    size: number;
}>;
declare const ListItemSchema: z.ZodObject<{
    name: z.ZodString;
    path: z.ZodString;
    type: z.ZodEnum<["file", "dir"]>;
    size: z.ZodOptional<z.ZodNumber>;
    sha: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
    raw: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    path: string;
    type: "dir" | "file";
    url?: string | undefined;
    raw?: string | undefined;
    sha?: string | undefined;
    size?: number | undefined;
}, {
    name: string;
    path: string;
    type: "dir" | "file";
    url?: string | undefined;
    raw?: string | undefined;
    sha?: string | undefined;
    size?: number | undefined;
}>;
declare const DocSchema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
type Options = z.input<typeof OptionsSchema>;
type OptionsParsed = z.output<typeof OptionsSchema>;
type UploadInput = z.input<typeof UploadInputSchema>;
type UploadResult = z.infer<typeof UploadResultSchema>;
type ListItem = z.infer<typeof ListItemSchema>;
type Doc = z.infer<typeof DocSchema>;

interface PutFileResponse {
    data: {
        content?: {
            sha?: string;
            download_url?: string;
            size?: number;
        } | null;
        commit?: {
            sha?: string;
        };
    };
    status: number;
    url: string;
}
interface FileMeta {
    sha: string;
    size: number;
    committedAt: string;
    downloadUrl: string;
}
declare class GitHub {
    readonly api: Octokit;
    readonly owner: string;
    readonly repo: string;
    readonly branch: string;
    readonly limit: ReturnType<typeof pLimit>;
    private committer;
    constructor(slug: string, opts: OptionsParsed);
    getFile(path: string): Promise<{
        content: Buffer;
        sha: string;
    } | null>;
    getFileMeta(path: string): Promise<FileMeta | null>;
    putFile(path: string, content: Uint8Array | string, message: string, sha?: string): Promise<PutFileResponse>;
    deleteFile(path: string, message: string): Promise<boolean>;
    listDir(path: string): Promise<any[] | null>;
}

interface Collection<T extends Doc> {
    create(data: T): Promise<T & {
        id: string;
    }>;
    get(id: string): Promise<(T & {
        id: string;
    }) | null>;
    update(id: string, patch: Partial<T>): Promise<(T & {
        id: string;
    }) | null>;
    unset(id: string, keys: string[]): Promise<(T & {
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
declare class StorageFiles {
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

export { type Collection, StorageFiles };
