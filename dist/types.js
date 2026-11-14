import { z } from "zod";
export const OptionsSchema = z.object({
    token: z.string().min(1, "token is required"),
    branch: z.string().default("main"),
    dir: z.string().default(".repossess/data.db"),
    storage: z.enum(["json", "sqlite"]).default("sqlite"),
    tmpTtlMinutes: z.number().int().min(0).default(10),
    concurrency: z.number().int().positive().max(20).default(4),
    committer: z
        .object({ name: z.string().min(1), email: z.string().email() })
        .default({ name: "repossess", email: "repossess@users.noreply.github.com" }),
});
export const RepoSlugSchema = z.string().regex(/^[\w.-]+\/[\w.-]+$/, "repo must be 'owner/name'");
export const UploadInputSchema = z
    .object({
    buffer: z.union([z.instanceof(Uint8Array), z.string()]).optional(),
    url: z.string().url().optional(),
    namefile: z.string().min(1).optional(),
    tmp: z.boolean().default(false),
})
    .refine((v) => v.buffer !== undefined || v.url !== undefined, {
    message: "either 'buffer' or 'url' is required",
});
export const UploadResultSchema = z.object({
    path: z.string(),
    url: z.string(),
    raw: z.string(),
    sha: z.string(),
    size: z.number(),
    tmp: z.boolean(),
});
export const ListItemSchema = z.object({
    name: z.string(),
    path: z.string(),
    type: z.enum(["file", "dir"]),
    size: z.number().optional(),
    sha: z.string().optional(),
    url: z.string().optional(),
    raw: z.string().optional(),
});
export const DocSchema = z.record(z.string(), z.unknown());
export const IdSchema = z.string().min(1, "id is required");
