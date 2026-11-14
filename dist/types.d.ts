import { z } from "zod";
export declare const OptionsSchema: z.ZodObject<{
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
export declare const RepoSlugSchema: z.ZodString;
export declare const UploadInputSchema: z.ZodEffects<z.ZodObject<{
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
export declare const UploadResultSchema: z.ZodObject<{
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
export declare const ListItemSchema: z.ZodObject<{
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
export declare const DocSchema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
export declare const IdSchema: z.ZodString;
export type Options = z.input<typeof OptionsSchema>;
export type OptionsParsed = z.output<typeof OptionsSchema>;
export type UploadInput = z.input<typeof UploadInputSchema>;
export type UploadResult = z.infer<typeof UploadResultSchema>;
export type ListItem = z.infer<typeof ListItemSchema>;
export type Doc = z.infer<typeof DocSchema>;
