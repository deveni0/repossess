import { Octokit } from "@octokit/rest";
import pLimit from "p-limit";
import type { OptionsParsed } from "./types.js";
export interface PutFileResponse {
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
export interface FileMeta {
    sha: string;
    size: number;
    committedAt: string;
    downloadUrl: string;
}
export declare class GitHub {
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
