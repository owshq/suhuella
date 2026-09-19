(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/packages/product/src/host/browser/connect-source.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "catalogCardHidden",
    ()=>catalogCardHidden,
    "commitSourceBeforeScan",
    ()=>commitSourceBeforeScan,
    "connectTrace",
    ()=>connectTrace,
    "homeSourceCount",
    ()=>homeSourceCount,
    "humanFolderName",
    ()=>humanFolderName,
    "isTechnicalSourceId",
    ()=>isTechnicalSourceId,
    "locationFromPending",
    ()=>locationFromPending,
    "mergeLiveSources",
    ()=>mergeLiveSources,
    "pendingBrowserSource",
    ()=>pendingBrowserSource
]);
function connectTrace(step, extra) {
    if (typeof console === "undefined") return;
    console.info(`[suhuella-connect] ${step}`, extra ?? {});
}
function isTechnicalSourceId(value) {
    return /^src_[a-z0-9]+_[a-z0-9]+$/i.test(value.trim());
}
function humanFolderName(handleName, fallback = "Folder") {
    const name = handleName?.trim();
    if (!name || isTechnicalSourceId(name)) return fallback;
    return name;
}
function pendingBrowserSource(input) {
    return {
        id: input.id,
        kind: "local",
        type: "local_folder",
        name: input.name,
        fileCount: 0,
        folderCount: 0,
        bytes: 0,
        lastIndexed: null,
        status: "indexing",
        access: input.access,
        wellKnownToken: input.wellKnownToken
    };
}
async function commitSourceBeforeScan(input) {
    await input.persist(input.source);
    connectTrace("source_persisted", {
        id: input.source.id,
        name: input.source.name
    });
    input.remember(input.source);
    connectTrace("memory_updated", {
        id: input.source.id
    });
    connectTrace("ui_should_render", {
        id: input.source.id,
        status: input.source.status
    });
    input.startScan(input.source);
    connectTrace("scan_start", {
        id: input.source.id
    });
    return input.source;
}
function homeSourceCount(sources) {
    return sources.length;
}
function mergeLiveSources(persisted, memory, removed) {
    const livePersisted = persisted.filter((source)=>!removed.has(source.id));
    if (!memory) return livePersisted;
    const persistedById = new Map(livePersisted.map((source)=>[
            source.id,
            source
        ]));
    return memory.filter((source)=>!removed.has(source.id)).map((source)=>({
            ...persistedById.get(source.id),
            ...source
        }));
}
function catalogCardHidden(catalogPath, locations, sameName) {
    return locations.some((location)=>location.path === catalogPath || location.catalogKey && location.catalogKey === catalogPath || sameName(location.name, catalogPath.replace(/^suhuella:/, "")));
}
function locationFromPending(source) {
    return {
        path: source.id,
        name: source.name,
        lastIndexed: source.lastIndexed,
        folderCount: source.folderCount,
        fileCount: source.fileCount,
        status: source.status === "indexing" ? "indexing" : "ready",
        usefulness: "useful",
        exists: true,
        catalogKey: source.wellKnownToken ?? null
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/product/src/host/browser/descriptors.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "describeLocalFile",
    ()=>describeLocalFile,
    "descriptorDisplayName",
    ()=>descriptorDisplayName
]);
const MIME_BY_EXTENSION = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    csv: "text/csv",
    txt: "text/plain",
    md: "text/markdown",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg"
};
function extensionOf(fileName) {
    return fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
}
function descriptorDisplayName(descriptor) {
    return descriptor.suggestedName.trim() || descriptor.displayName.trim();
}
function descriptorId(origin, displayName, locator) {
    const raw = `${origin}:${locator || displayName}`;
    return `kd_${btoa(unescape(encodeURIComponent(raw))).replace(/[+/=]/g, "")}`;
}
function describeLocalFile(displayName, locator) {
    const extension = extensionOf(displayName);
    return {
        id: descriptorId("local_file", displayName, locator),
        kind: "file",
        source: "local_folder",
        origin: "local_file",
        displayName,
        suggestedName: displayName,
        mimeType: extension ? MIME_BY_EXTENSION[extension] ?? null : null,
        language: [],
        entities: [],
        dates: [],
        topics: [],
        hints: [],
        metadata: {
            filePath: locator
        }
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/product/src/host/browser/dev-host.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DEV_DEMO_DISPLAY_NAME",
    ()=>DEV_DEMO_DISPLAY_NAME,
    "DEV_DEMO_FILES",
    ()=>DEV_DEMO_FILES,
    "DEV_DEMO_HINT",
    ()=>DEV_DEMO_HINT,
    "DEV_DEMO_SOURCE_ID",
    ()=>DEV_DEMO_SOURCE_ID,
    "demoFileDescriptors",
    ()=>demoFileDescriptors,
    "demoFolderDescriptors",
    ()=>demoFolderDescriptors,
    "isBrowserDevHost",
    ()=>isBrowserDevHost,
    "isDevDemoHint",
    ()=>isDevDemoHint
]);
const DEV_DEMO_HINT = "suhuella:dev-demo";
const DEV_DEMO_SOURCE_ID = "src_dev_demo";
const DEV_DEMO_DISPLAY_NAME = "dev-data";
const DEV_DEMO_FILES = [
    {
        name: "factura-enero.pdf",
        relativePath: "invoices/factura-enero.pdf",
        size: 24
    },
    {
        name: "factura-febrero.pdf",
        relativePath: "invoices/factura-febrero.pdf",
        size: 24
    },
    {
        name: "contrato-cliente.docx",
        relativePath: "contracts/contrato-cliente.docx",
        size: 28
    },
    {
        name: "captura-yala.png",
        relativePath: "pictures/captura-yala.png",
        size: 32
    },
    {
        name: "nota-reunion.txt",
        relativePath: "mixed/nota-reunion.txt",
        size: 18
    }
];
function isBrowserDevHost(hostname) {
    const host = hostname ?? (("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : window.location.hostname);
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}
function isDevDemoHint(hint) {
    return hint === DEV_DEMO_HINT;
}
function demoFileDescriptors(sourceId = DEV_DEMO_SOURCE_ID) {
    return DEV_DEMO_FILES.map((file)=>({
            id: `${sourceId}:${file.relativePath}`,
            sourceId,
            name: file.name,
            relativePath: file.relativePath,
            parentRelative: file.relativePath.includes("/") ? file.relativePath.slice(0, file.relativePath.lastIndexOf("/")) : "",
            size: file.size,
            lastModified: null
        }));
}
function demoFolderDescriptors(sourceId = DEV_DEMO_SOURCE_ID) {
    const folders = new Map();
    folders.set("", {
        relativePath: ".",
        name: DEV_DEMO_DISPLAY_NAME,
        depth: 0
    });
    for (const file of DEV_DEMO_FILES){
        const parent = file.relativePath.includes("/") ? file.relativePath.slice(0, file.relativePath.lastIndexOf("/")) : "";
        if (parent && !folders.has(parent)) {
            folders.set(parent, {
                relativePath: parent,
                name: parent.split("/").at(-1) ?? parent,
                depth: parent.split("/").length
            });
        }
    }
    return [
        ...folders.values()
    ].map((folder)=>({
            id: `${sourceId}:${folder.relativePath}`,
            sourceId,
            sourceType: "local_folder",
            kind: "folder",
            name: folder.name,
            locator: folder.relativePath === "." ? DEV_DEMO_DISPLAY_NAME : folder.relativePath,
            absolutePath: folder.relativePath === "." ? DEV_DEMO_DISPLAY_NAME : folder.relativePath,
            relativePath: folder.relativePath,
            folderName: folder.name,
            parentTokens: folder.relativePath === "." ? [] : folder.relativePath.split("/").slice(0, -1).map((part)=>part.toLowerCase()),
            depth: folder.depth,
            extensions: DEV_DEMO_FILES.filter((file)=>{
                const parent = file.relativePath.includes("/") ? file.relativePath.slice(0, file.relativePath.lastIndexOf("/")) : "";
                return folder.relativePath === "." || parent === folder.relativePath;
            }).map((file)=>file.name.split(".").pop() ?? "").filter(Boolean),
            fileCount: DEV_DEMO_FILES.filter((file)=>{
                const parent = file.relativePath.includes("/") ? file.relativePath.slice(0, file.relativePath.lastIndexOf("/")) : "";
                return folder.relativePath === "." ? true : parent === folder.relativePath;
            }).length,
            fileNames: DEV_DEMO_FILES.filter((file)=>{
                const parent = file.relativePath.includes("/") ? file.relativePath.slice(0, file.relativePath.lastIndexOf("/")) : "";
                return folder.relativePath === "." || parent === folder.relativePath;
            }).map((file)=>file.name),
            lastModified: null
        }));
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/product/src/host/browser/fs.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BrowserFileSystem",
    ()=>BrowserFileSystem,
    "FolderAccessError",
    ()=>FolderAccessError,
    "directoryAvailable",
    ()=>directoryAvailable,
    "ensurePermission",
    ()=>ensurePermission,
    "filePickerSupported",
    ()=>filePickerSupported,
    "fileSystemAccessSupported",
    ()=>fileSystemAccessSupported,
    "fileWriteSupported",
    ()=>fileWriteSupported,
    "folderAccessKind",
    ()=>folderAccessKind,
    "formatBytes",
    ()=>formatBytes,
    "isAbortError",
    ()=>isAbortError,
    "isProtectedFolderError",
    ()=>isProtectedFolderError,
    "loadHandle",
    ()=>loadHandle,
    "moveOrRenameFile",
    ()=>moveOrRenameFile,
    "persistHandle",
    ()=>persistHandle,
    "pickFolderViaWebkitDirectory",
    ()=>pickFolderViaWebkitDirectory,
    "pickLocalFolder",
    ()=>pickLocalFolder,
    "queryPermission",
    ()=>queryPermission,
    "removeHandle",
    ()=>removeHandle,
    "requestLocalFiles",
    ()=>requestLocalFiles,
    "requestLocalFolder",
    ()=>requestLocalFolder,
    "scanDirectory",
    ()=>scanDirectory,
    "scanFileList",
    ()=>scanFileList,
    "webkitDirectorySupported",
    ()=>webkitDirectorySupported
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$product$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/lib/product-copy.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/host/browser/idb.ts [app-client] (ecmascript)");
;
;
const SKIP_NAMES = new Set([
    "library",
    "system",
    "private",
    "etc",
    "proc",
    "dev",
    "bin",
    "sbin",
    "windows",
    "program files",
    "program files (x86)",
    "$recycle.bin",
    "node_modules",
    ".git",
    ".svn",
    "appdata",
    "application data"
]);
const MAX_FILES = 20_000;
const MAX_FILENAMES_PER_FOLDER = 50;
const MAX_DEPTH = 8;
async function* iterateDirectory(dir) {
    const directory = dir;
    if (typeof directory.entries === "function") {
        yield* directory.entries();
        return;
    }
    if (typeof directory.values === "function") {
        for await (const child of directory.values()){
            yield [
                child.name,
                child
            ];
        }
    }
}
class FolderAccessError extends Error {
    code;
    constructor(code, message){
        super(message);
        this.name = "FolderAccessError";
        this.code = code;
    }
}
function fileSystemAccessSupported() {
    return ("TURBOPACK compile-time value", "object") !== "undefined" && typeof window.showDirectoryPicker === "function";
}
function webkitDirectorySupported() {
    if (typeof document === "undefined") return false;
    const input = document.createElement("input");
    input.type = "file";
    return "webkitdirectory" in input;
}
function folderAccessKind() {
    if (fileSystemAccessSupported()) return "directory-picker";
    if (webkitDirectorySupported()) return "webkitdirectory";
    return "none";
}
function isAbortError(error) {
    return error instanceof DOMException && error.name === "AbortError" || error instanceof Error && error.name === "AbortError";
}
function isProtectedFolderError(error) {
    if (error instanceof FolderAccessError && error.code === "protected") return true;
    if (error instanceof DOMException && error.name === "SecurityError") return true;
    const text = (error instanceof Error ? error.message : String(error)).toLowerCase();
    const name = error instanceof Error ? error.name.toLowerCase() : "";
    return name === "securityerror" || text.includes("system file") || text.includes("contains system") || text.includes("can't open this folder") || text.includes("cannot open this folder") || text.includes("no se puede abrir esta carpeta") || text.includes("not allowed to access");
}
async function pickLocalFolder(startIn) {
    if (!window.showDirectoryPicker) {
        throw new FolderAccessError("unsupported", "Folder access is not available in this browser.");
    }
    try {
        return await window.showDirectoryPicker({
            id: startIn ?? "suhuella-source",
            mode: "read",
            startIn
        });
    } catch (error) {
        if (isProtectedFolderError(error)) {
            throw new FolderAccessError("protected", "This folder is not available in this browser.");
        }
        if (isAbortError(error)) throw error;
        if (error instanceof DOMException && error.name === "NotAllowedError") {
            throw new FolderAccessError("denied", "Folder permission was not granted.");
        }
        throw new FolderAccessError("failed", (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$product$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["productCopy"])("SuHuella could not open that folder."));
    }
}
function pickFolderViaWebkitDirectory() {
    return new Promise((resolve, reject)=>{
        if (!webkitDirectorySupported()) {
            reject(new FolderAccessError("unsupported", "Folder access is not available in this browser."));
            return;
        }
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = true;
        input.setAttribute("webkitdirectory", "");
        input.setAttribute("directory", "");
        input.style.position = "fixed";
        input.style.left = "-9999px";
        let settled = false;
        const finish = (next)=>{
            if (settled) return;
            settled = true;
            input.remove();
            next();
        };
        input.addEventListener("change", ()=>{
            finish(()=>resolve(Array.from(input.files ?? [])));
        });
        input.addEventListener("cancel", ()=>{
            finish(()=>reject(new DOMException("The user aborted a request.", "AbortError")));
        });
        document.body.appendChild(input);
        input.click();
    });
}
function filePickerSupported() {
    if (("TURBOPACK compile-time value", "object") !== "undefined" && typeof window.showOpenFilePicker === "function") return true;
    if (typeof document === "undefined") return false;
    const input = document.createElement("input");
    input.type = "file";
    return "multiple" in input;
}
function pickFilesViaInput() {
    return new Promise((resolve, reject)=>{
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = true;
        input.accept = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.csv,.png,.jpg,.jpeg,.gif,.webp,.heic,.tif,.tiff";
        input.style.position = "fixed";
        input.style.left = "-9999px";
        let settled = false;
        const finish = (next)=>{
            if (settled) return;
            settled = true;
            input.remove();
            next();
        };
        input.addEventListener("change", ()=>{
            finish(()=>resolve(Array.from(input.files ?? [])));
        });
        input.addEventListener("cancel", ()=>{
            finish(()=>reject(new DOMException("The user aborted a request.", "AbortError")));
        });
        document.body.appendChild(input);
        input.click();
    });
}
async function requestLocalFiles() {
    if (!filePickerSupported()) {
        throw new FolderAccessError("unsupported", "This browser cannot choose documents.");
    }
    if (typeof window.showOpenFilePicker === "function") {
        try {
            const handles = await window.showOpenFilePicker({
                multiple: true
            });
            return Promise.all(handles.map((handle)=>handle.getFile()));
        } catch (error) {
            if (isAbortError(error)) throw error;
        }
    }
    return pickFilesViaInput();
}
async function requestLocalFolder(startIn) {
    const access = folderAccessKind();
    if (access === "none") {
        throw new FolderAccessError("unsupported", "Folder access is not available in this browser.");
    }
    if (access === "directory-picker") {
        return {
            kind: "handle",
            handle: await pickLocalFolder(startIn)
        };
    }
    return {
        kind: "files",
        files: await pickFolderViaWebkitDirectory()
    };
}
async function persistHandle(sourceId, handle) {
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbSet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].handles, sourceId, handle);
}
async function loadHandle(sourceId) {
    return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbGet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].handles, sourceId) ?? null;
}
async function removeHandle(sourceId) {
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbDelete"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].handles, sourceId);
}
function permissionHandle(handle) {
    return handle;
}
async function queryPermission(handle, mode = "read") {
    return await permissionHandle(handle).queryPermission?.({
        mode
    }) ?? "granted";
}
async function ensurePermission(handle, mode = "read") {
    const current = await queryPermission(handle, mode);
    if (current === "granted") return true;
    const next = await permissionHandle(handle).requestPermission?.({
        mode
    }) ?? "denied";
    return next === "granted";
}
async function directoryAvailable(handle) {
    try {
        await iterateDirectory(handle).next();
        return true;
    } catch  {
        return false;
    }
}
function fileWriteSupported() {
    if (typeof FileSystemFileHandle === "undefined") return false;
    const proto = FileSystemFileHandle.prototype;
    return typeof proto.move === "function" || typeof proto.createWritable === "function";
}
function shouldSkip(name) {
    if (name.startsWith(".")) return true;
    return SKIP_NAMES.has(name.toLowerCase());
}
function joinRelative(parent, name) {
    return parent ? `${parent}/${name}` : name;
}
async function scanDirectory(handle, sourceId) {
    const folders = [];
    const files = [];
    let bytes = 0;
    async function walk(dir, relativePath, depth) {
        if (files.length >= MAX_FILES || depth > MAX_DEPTH) return;
        const fileNames = [];
        const extensions = new Set();
        let fileCount = 0;
        const parentTokens = relativePath.split("/").filter(Boolean).slice(0, -1).map((part)=>part.toLowerCase());
        for await (const [name, child] of iterateDirectory(dir)){
            if (shouldSkip(name)) continue;
            const childPath = joinRelative(relativePath, name);
            if (child.kind === "directory") {
                await walk(child, childPath, depth + 1);
                continue;
            }
            fileCount += 1;
            if (fileNames.length < MAX_FILENAMES_PER_FOLDER) fileNames.push(name);
            const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
            if (ext) extensions.add(ext);
            let size = 0;
            let lastModified = null;
            try {
                const file = await child.getFile();
                size = file.size;
                lastModified = new Date(file.lastModified).toISOString();
                bytes += size;
            } catch  {
            /* permission or file disappeared */ }
            files.push({
                id: `${sourceId}:${childPath}`,
                sourceId,
                name,
                relativePath: childPath,
                parentRelative: relativePath,
                size,
                lastModified
            });
            if (files.length >= MAX_FILES) break;
        }
        folders.push({
            id: `${sourceId}:${relativePath || "."}`,
            sourceId,
            sourceType: "local_folder",
            kind: "folder",
            name: relativePath ? relativePath.split("/").at(-1) ?? handle.name : handle.name,
            locator: relativePath || handle.name,
            absolutePath: relativePath || handle.name,
            relativePath: relativePath || ".",
            folderName: relativePath ? relativePath.split("/").at(-1) ?? handle.name : handle.name,
            parentTokens,
            depth,
            extensions: [
                ...extensions
            ],
            fileCount,
            fileNames,
            lastModified: null
        });
    }
    await walk(handle, "", 0);
    return {
        source: {
            kind: "local",
            type: "local_folder",
            name: handle.name,
            fileCount: files.length,
            folderCount: folders.length,
            bytes,
            lastIndexed: new Date().toISOString()
        },
        folders,
        files
    };
}
function rootNameFromFiles(files) {
    const first = files[0]?.webkitRelativePath || files[0]?.name || "Folder";
    return first.split(/[/\\]/).filter(Boolean)[0] ?? "Folder";
}
function relativeFromWebkitPath(file, rootName) {
    const relative = file.webkitRelativePath || file.name;
    const parts = relative.split(/[/\\]/).filter(Boolean);
    if (parts[0]?.toLowerCase() === rootName.toLowerCase()) parts.shift();
    return parts.join("/");
}
function scanFileList(fileList, sourceId, rootName = rootNameFromFiles(fileList)) {
    const files = [];
    const folderMap = new Map();
    let bytes = 0;
    const ensureFolder = (relativePath, depth)=>{
        const key = relativePath || ".";
        if (folderMap.has(key)) return folderMap.get(key);
        const name = relativePath ? relativePath.split("/").at(-1) ?? rootName : rootName;
        const parentTokens = relativePath.split("/").filter(Boolean).slice(0, -1).map((part)=>part.toLowerCase());
        const folder = {
            id: `${sourceId}:${key}`,
            sourceId,
            sourceType: "local_folder",
            kind: "folder",
            name,
            locator: relativePath || rootName,
            absolutePath: relativePath || rootName,
            relativePath: key,
            folderName: name,
            parentTokens,
            depth,
            extensions: [],
            fileCount: 0,
            fileNames: [],
            lastModified: null
        };
        folderMap.set(key, folder);
        return folder;
    };
    ensureFolder("", 0);
    for (const file of fileList){
        if (files.length >= MAX_FILES) break;
        const relativePath = relativeFromWebkitPath(file, rootName);
        if (!relativePath) continue;
        const parts = relativePath.split("/").filter(Boolean);
        const name = parts.at(-1);
        if (!name || shouldSkip(name)) continue;
        if (parts.slice(0, -1).some((part)=>shouldSkip(part))) continue;
        let parent = "";
        parts.slice(0, -1).forEach((part, index)=>{
            parent = joinRelative(parent, part);
            ensureFolder(parent, index + 1);
        });
        const folder = ensureFolder(parent, Math.max(0, parts.length - 1));
        folder.fileCount += 1;
        if (folder.fileNames.length < MAX_FILENAMES_PER_FOLDER) folder.fileNames.push(name);
        const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
        if (ext && !folder.extensions.includes(ext)) folder.extensions.push(ext);
        bytes += file.size;
        files.push({
            id: `${sourceId}:${relativePath}`,
            sourceId,
            name,
            relativePath,
            parentRelative: parent,
            size: file.size,
            lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null
        });
    }
    return {
        source: {
            kind: "local",
            type: "local_folder",
            name: rootName,
            fileCount: files.length,
            folderCount: folderMap.size,
            bytes,
            lastIndexed: new Date().toISOString()
        },
        folders: [
            ...folderMap.values()
        ],
        files
    };
}
async function directoryAt(root, relativePath, create = false) {
    if (!relativePath || relativePath === ".") return root;
    let current = root;
    for (const part of relativePath.split("/").filter(Boolean)){
        current = await current.getDirectoryHandle(part, {
            create
        });
    }
    return current;
}
async function moveOrRenameFile(root, fromRelative, toRelative) {
    const fromParts = fromRelative.split("/").filter(Boolean);
    const toParts = toRelative.split("/").filter(Boolean);
    const fromName = fromParts.at(-1);
    const toName = toParts.at(-1);
    if (!fromName || !toName) throw new Error("Invalid file path.");
    const fromDir = await directoryAt(root, fromParts.slice(0, -1).join("/"));
    const toDir = await directoryAt(root, toParts.slice(0, -1).join("/"), true);
    const fileHandle = await fromDir.getFileHandle(fromName);
    try {
        const existing = await toDir.getFileHandle(toName);
        if (existing && (fromDir !== toDir || fromName !== toName)) {
            throw new Error("Skipped to avoid overwrite.");
        }
    } catch (error) {
        if (error instanceof Error && error.message === "Skipped to avoid overwrite.") throw error;
    }
    if (typeof fileHandle.move === "function") {
        await fileHandle.move(toDir, toName);
        return;
    }
    const file = await fileHandle.getFile();
    const dest = await toDir.getFileHandle(toName, {
        create: true
    });
    const writable = await dest.createWritable();
    await writable.write(file);
    await writable.close();
    await fromDir.removeEntry(fromName);
}
const BrowserFileSystem = {
    supported: fileSystemAccessSupported,
    requestFolderAccess: pickLocalFolder,
    persistPermission: persistHandle,
    loadPermission: loadHandle,
    removePermission: removeHandle,
    ensurePermission,
    listAndRead: scanDirectory,
    moveFile: moveOrRenameFile,
    renameFile: moveOrRenameFile
};
function formatBytes(bytes) {
    if (bytes <= 0) return "0 B";
    const units = [
        "B",
        "KB",
        "MB",
        "GB",
        "TB"
    ];
    const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const value = bytes / 1024 ** index;
    return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/product/src/host/browser/idb.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "STORE",
    ()=>STORE,
    "idbClear",
    ()=>idbClear,
    "idbDelete",
    ()=>idbDelete,
    "idbGet",
    ()=>idbGet,
    "idbGetAll",
    ()=>idbGetAll,
    "idbKeys",
    ()=>idbKeys,
    "idbSet",
    ()=>idbSet
]);
const DB_NAME = "suhuella-web";
const DB_VERSION = 1;
const STORE = {
    meta: "meta",
    sources: "sources",
    folders: "folders",
    files: "files",
    activity: "activity",
    workflows: "workflows",
    handles: "handles"
};
function openDb() {
    return new Promise((resolve, reject)=>{
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = ()=>reject(request.error);
        request.onsuccess = ()=>resolve(request.result);
        request.onupgradeneeded = ()=>{
            const db = request.result;
            for (const name of Object.values(STORE)){
                if (!db.objectStoreNames.contains(name)) {
                    db.createObjectStore(name);
                }
            }
        };
    });
}
async function idbGet(store, key) {
    const db = await openDb();
    return new Promise((resolve, reject)=>{
        const tx = db.transaction(store, "readonly");
        const request = tx.objectStore(store).get(key);
        request.onsuccess = ()=>resolve(request.result);
        request.onerror = ()=>reject(request.error);
    });
}
async function idbSet(store, key, value) {
    const db = await openDb();
    await new Promise((resolve, reject)=>{
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).put(value, key);
        tx.oncomplete = ()=>resolve();
        tx.onerror = ()=>reject(tx.error);
    });
}
async function idbDelete(store, key) {
    const db = await openDb();
    await new Promise((resolve, reject)=>{
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).delete(key);
        tx.oncomplete = ()=>resolve();
        tx.onerror = ()=>reject(tx.error);
    });
}
async function idbGetAll(store) {
    const db = await openDb();
    return new Promise((resolve, reject)=>{
        const tx = db.transaction(store, "readonly");
        const request = tx.objectStore(store).getAll();
        request.onsuccess = ()=>resolve(request.result ?? []);
        request.onerror = ()=>reject(request.error);
    });
}
async function idbClear(store) {
    const db = await openDb();
    await new Promise((resolve, reject)=>{
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).clear();
        tx.oncomplete = ()=>resolve();
        tx.onerror = ()=>reject(tx.error);
    });
}
async function idbKeys(store) {
    const db = await openDb();
    return new Promise((resolve, reject)=>{
        const tx = db.transaction(store, "readonly");
        const request = tx.objectStore(store).getAllKeys();
        request.onsuccess = ()=>resolve(request.result.map(String));
        request.onerror = ()=>reject(request.error);
    });
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/product/src/host/browser/license.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "activateFromCheckout",
    ()=>activateFromCheckout,
    "activateLicense",
    ()=>activateLicense,
    "browserLicenseWasOffline",
    ()=>browserLicenseWasOffline,
    "checkLicense",
    ()=>checkLicense,
    "clearLicense",
    ()=>clearLicense,
    "createCheckoutAttempt",
    ()=>createCheckoutAttempt,
    "deactivateLicense",
    ()=>deactivateLicense,
    "editionLabel",
    ()=>editionLabel,
    "freeLicense",
    ()=>freeLicense,
    "getDevice",
    ()=>getDevice,
    "licenseErrorMessage",
    ()=>licenseErrorMessage,
    "loadLicense",
    ()=>loadLicense,
    "renameDevice",
    ()=>renameDevice,
    "requestLicenseEmailCode",
    ()=>requestLicenseEmailCode,
    "saveLicense",
    ()=>saveLicense,
    "updateBusinessBranding",
    ()=>updateBusinessBranding,
    "verifyLicenseEmailCode",
    ()=>verifyLicenseEmailCode
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f2e$build$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/brands/.build/entry.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/brands/suhuella/entry.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$product$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/lib/product-copy.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$device$2d$identity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/lib/device-identity.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/host/browser/idb.ts [app-client] (ecmascript)");
;
;
;
;
const DEVICE_KEY = "device";
const LICENSE_KEY = "license";
const APP_VERSION = __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["brand"].release.version;
function createId() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
    return `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
async function getDevice() {
    const existing = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbGet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].meta, DEVICE_KEY);
    if (existing?.deviceId) {
        const upgradedName = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$device$2d$identity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["upgradeGenericDeviceName"])(existing.deviceName);
        if (upgradedName !== existing.deviceName) {
            const next = {
                ...existing,
                deviceName: upgradedName
            };
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbSet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].meta, DEVICE_KEY, next);
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$device$2d$identity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["persistBrowserComputerName"])(upgradedName);
            return next;
        }
        return existing;
    }
    const deviceName = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$device$2d$identity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBrowserComputerName"])();
    const device = {
        deviceId: createId(),
        deviceName
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$device$2d$identity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["persistBrowserComputerName"])(deviceName);
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbSet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].meta, DEVICE_KEY, device);
    return device;
}
async function renameDevice(name) {
    const trimmed = name.trim();
    if (!trimmed) return (await getDevice()).deviceName;
    const existing = await getDevice();
    const next = {
        ...existing,
        deviceName: trimmed
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$device$2d$identity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["persistBrowserComputerName"])(trimmed);
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbSet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].meta, DEVICE_KEY, next);
    return trimmed;
}
async function loadLicense() {
    return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbGet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].meta, LICENSE_KEY) ?? null;
}
async function saveLicense(license) {
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbSet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].meta, LICENSE_KEY, license);
}
async function clearLicense() {
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbSet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].meta, LICENSE_KEY, null);
}
function editionLabel(edition) {
    if (edition === "personal_lifetime") return "Personal Lifetime";
    if (edition === "personal_monthly") return "Personal Monthly";
    if (edition === "business") return "Business";
    if (edition === "enterprise") return "Enterprise";
    return "Free";
}
function licenseErrorMessage(error) {
    if (error === "unknown_email" || error === "no_license") return "No active license was found for this email.";
    if (error === "device_limit") {
        return "This Personal license allows 3 devices. Deactivate another computer, then activate this one.";
    }
    if (error === "payment_incomplete") return "Payment was not completed.";
    if (error === "revoked") return "This complimentary license is no longer active.";
    if (error === "expired") return "This subscription is no longer active.";
    if (error === "not_activated") return "This device is not on your license.";
    if (error === "service_unavailable") {
        return "Some online functions are temporarily unavailable. Your local files are unaffected.";
    }
    if (error === "offline") return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$product$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["productCopy"])("SuHuella can keep working offline for a limited time.");
    return "We could not update your license. Try again later.";
}
function errorFromStatus(status) {
    if (status === 429) return "rate_limited";
    if (status === 503) return "service_unavailable";
    if (status >= 500) return "server_error";
    return "offline";
}
function isTransientLicenseError(error) {
    return error === "offline" || error === "server_error" || error === "service_unavailable" || error === "rate_limited";
}
let lastSeenOffline = false;
function browserLicenseWasOffline() {
    return lastSeenOffline;
}
async function postLicense(pathName, body) {
    const current = await loadLicense();
    try {
        const response = await fetch(pathName, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });
        let data;
        try {
            data = await response.json();
        } catch  {
            return {
                ok: false,
                error: errorFromStatus(response.status),
                license: current
            };
        }
        if (!data || typeof data !== "object") {
            return {
                ok: false,
                error: errorFromStatus(response.status),
                license: current
            };
        }
        if (!data.ok) {
            return {
                ok: false,
                error: data.error ?? errorFromStatus(response.status),
                license: current
            };
        }
        await saveLicense(data.license);
        lastSeenOffline = false;
        return {
            ok: true,
            license: data.license
        };
    } catch  {
        return {
            ok: false,
            error: "offline",
            license: current
        };
    }
}
async function postJson(pathName, body) {
    try {
        const response = await fetch(pathName, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });
        try {
            const data = await response.json();
            if (!data || typeof data !== "object") return {
                ok: false,
                error: errorFromStatus(response.status)
            };
            if (!data.ok && !("error" in data)) return {
                ok: false,
                error: errorFromStatus(response.status)
            };
            return data;
        } catch  {
            return {
                ok: false,
                error: errorFromStatus(response.status)
            };
        }
    } catch  {
        return {
            ok: false,
            error: "offline"
        };
    }
}
async function createCheckoutAttempt(plan) {
    const device = await getDevice();
    const result = await postJson("/api/license/checkout-attempt", {
        deviceId: device.deviceId,
        plan
    });
    if (!result.ok) return result;
    if (!result.activationAttemptId) return {
        ok: false,
        error: "server_error"
    };
    return {
        ok: true,
        activationAttemptId: result.activationAttemptId
    };
}
async function requestLicenseEmailCode(email) {
    const device = await getDevice();
    const result = await postJson("/api/license/email-code/request", {
        email: email.trim(),
        purpose: "LICENSE_ACTIVATION",
        deviceId: device.deviceId
    });
    if (!result.ok) return result;
    if (!result.challengeId) return {
        ok: false,
        error: "server_error"
    };
    return {
        ok: true,
        challengeId: result.challengeId,
        message: result.message ?? ""
    };
}
async function verifyLicenseEmailCode(challengeId, code) {
    const result = await postJson("/api/license/email-code/verify", {
        challengeId: challengeId.trim(),
        code: code.trim()
    });
    if (!result.ok) return result;
    if (!result.proofId) return {
        ok: false,
        error: "server_error"
    };
    return {
        ok: true,
        proofId: result.proofId
    };
}
async function activateFromCheckout(sessionId, activationAttemptId) {
    const device = await getDevice();
    return postLicense("/api/license/activate-from-checkout", {
        sessionId: sessionId.trim(),
        ...activationAttemptId?.trim() ? {
            activationAttemptId: activationAttemptId.trim()
        } : {},
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        platform: "web",
        appVersion: APP_VERSION
    });
}
async function updateBusinessBranding(dataUrl) {
    const current = await loadLicense();
    if (!current || current.edition !== "business" || !current.organisationId || !current.email) {
        return {
            ok: false,
            error: "invalid_request",
            license: current
        };
    }
    try {
        const response = await fetch("/api/business/branding", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                organisationId: current.organisationId,
                email: current.email,
                dataUrl
            })
        });
        const data = await response.json();
        if (!data.ok) return {
            ok: false,
            error: "invalid_request",
            license: current
        };
        return checkLicense();
    } catch  {
        return {
            ok: false,
            error: "offline",
            license: current
        };
    }
}
async function activateLicense(emailProofId) {
    const device = await getDevice();
    return postLicense("/api/license/activate", {
        emailProofId: emailProofId.trim(),
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        platform: "web",
        appVersion: APP_VERSION
    });
}
async function checkLicense() {
    const current = await loadLicense();
    if (!current || current.edition === "free") {
        lastSeenOffline = false;
        return {
            ok: true,
            license: current ?? freeLicense()
        };
    }
    const device = await getDevice();
    const result = await postLicense("/api/license/check", {
        deviceId: device.deviceId,
        licenseToken: current.licenseToken,
        deviceName: device.deviceName
    });
    if (!result.ok && isTransientLicenseError(result.error) && current) {
        lastSeenOffline = true;
        return {
            ok: true,
            license: current
        };
    }
    return result;
}
async function deactivateLicense() {
    const current = await loadLicense();
    const device = await getDevice();
    const result = await postLicense("/api/license/deactivate", {
        deviceId: device.deviceId,
        licenseToken: current?.licenseToken ?? ""
    });
    await clearLicense();
    return result.ok ? {
        ok: true,
        license: freeLicense()
    } : {
        ...result,
        license: freeLicense()
    };
}
function freeLicense() {
    const now = new Date().toISOString();
    return {
        licenseId: "free",
        customerId: "",
        email: "",
        edition: "free",
        status: "active",
        capabilities: [
            "recommend_folder",
            "explain_recommendation",
            "refresh_index"
        ],
        enabledKnowledgeSources: [
            "local_folder"
        ],
        deviceLimit: 1,
        activatedDevices: 1,
        validUntil: null,
        lastCheckedAt: now,
        offlineUntil: now,
        channel: "stable",
        licenseToken: ""
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/product/src/host/browser/organise-descriptors.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "clearOrganiseDescriptors",
    ()=>clearOrganiseDescriptors,
    "listOrganiseDescriptors",
    ()=>listOrganiseDescriptors,
    "rememberOrganiseDescriptors",
    ()=>rememberOrganiseDescriptors
]);
let transientFiles = [];
let transientFolders = [];
function rememberOrganiseDescriptors(files, folders = []) {
    const nextFiles = new Map(transientFiles.map((file)=>[
            file.id,
            file
        ]));
    for (const file of files)nextFiles.set(file.id, file);
    transientFiles = [
        ...nextFiles.values()
    ];
    const nextFolders = new Map(transientFolders.map((folder)=>[
            folder.id,
            folder
        ]));
    for (const folder of folders)nextFolders.set(folder.id, folder);
    transientFolders = [
        ...nextFolders.values()
    ];
}
function listOrganiseDescriptors() {
    return {
        files: transientFiles,
        folders: transientFolders
    };
}
function clearOrganiseDescriptors() {
    transientFiles = [];
    transientFolders = [];
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/product/src/host/browser/plan.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "applyNameEdit",
    ()=>applyNameEdit,
    "canConfirm",
    ()=>canConfirm,
    "executePlanItems",
    ()=>executePlanItems,
    "inverseItem",
    ()=>inverseItem,
    "previewPlan",
    ()=>previewPlan,
    "validateEditedName",
    ()=>validateEditedName
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$descriptors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/host/browser/descriptors.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/host/browser/fs.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$recommendations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/host/browser/recommendations.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$rename$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/host/browser/rename.ts [app-client] (ecmascript)");
;
;
;
;
const MIN_MOVE_SCORE = 30;
const READY_SCORE = 50;
function sameFolder(left, right) {
    return left.replace(/\/+$/, "").toLowerCase() === right.replace(/\/+$/, "").toLowerCase();
}
function joinPath(folder, fileName) {
    if (!folder || folder === ".") return fileName;
    return `${folder.replace(/\/+$/, "")}/${fileName}`;
}
function parentPath(filePath) {
    const parts = filePath.split("/").filter(Boolean);
    return parts.slice(0, -1).join("/") || ".";
}
function folderAt(folders, locator) {
    return folders.find((folder)=>sameFolder(folder.absolutePath, locator) || sameFolder(folder.relativePath, locator));
}
function previewPlan(files, folders) {
    return files.map((file)=>{
        const descriptor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$descriptors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["describeLocalFile"])(file.name, file.relativePath);
        const recommendations = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$recommendations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["recommendFolders"])({
            descriptor,
            folders
        });
        const top = recommendations[0];
        const currentDir = file.parentRelative || ".";
        if (!top || top.score < MIN_MOVE_SCORE) {
            return item({
                action: "none",
                currentPath: file.relativePath,
                proposedPath: null,
                fileName: file.name,
                sourceId: file.sourceId,
                explanation: "No confident destination found.",
                reviewGroup: "skipped",
                selected: false,
                score: top?.score ?? null,
                confidenceLabel: top?.confidenceLabel ?? null,
                skipReason: "No confident destination found"
            });
        }
        if (sameFolder(currentDir, top.folder) || sameFolder(currentDir, folderAt(folders, top.folder)?.relativePath ?? "")) {
            const destination = folderAt(folders, top.folder);
            const proposal = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$rename$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["proposeSafeRename"])(file.name, destination?.fileNames ?? []);
            if (!proposal) {
                return item({
                    action: "none",
                    currentPath: file.relativePath,
                    proposedPath: null,
                    fileName: file.name,
                    sourceId: file.sourceId,
                    explanation: `Already in ${top.label}.`,
                    reviewGroup: "skipped",
                    selected: false,
                    score: top.score,
                    confidenceLabel: top.confidenceLabel,
                    skipReason: "Already in the recommended folder"
                });
            }
            const proposedPath = joinPath(currentDir === "." ? "" : currentDir, proposal.name);
            const conflict = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$rename$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["renameNameConflicts"])(proposal.name, file.name, destination?.fileNames ?? []);
            if (conflict) {
                return item({
                    action: "rename",
                    currentPath: file.relativePath,
                    proposedPath,
                    fileName: file.name,
                    sourceId: file.sourceId,
                    explanation: `A file named ${proposal.name} already exists.`,
                    renameReasons: proposal.reasons,
                    reviewGroup: "skipped",
                    selected: false,
                    score: top.score,
                    confidenceLabel: top.confidenceLabel,
                    skipReason: "A file with that name already exists"
                });
            }
            const ready = top.score >= READY_SCORE;
            return item({
                action: "rename",
                currentPath: file.relativePath,
                proposedPath,
                fileName: file.name,
                sourceId: file.sourceId,
                explanation: proposal.explanation,
                renameReasons: proposal.reasons,
                reviewGroup: ready ? "ready" : "review",
                selected: ready,
                score: top.score,
                confidenceLabel: top.confidenceLabel,
                skipReason: null
            });
        }
        const destRelative = folderAt(folders, top.folder)?.relativePath ?? top.folder;
        const proposedPath = joinPath(destRelative === "." ? "" : destRelative, file.name);
        const destFolder = folderAt(folders, destRelative);
        if (destFolder?.fileNames.some((name)=>name.toLowerCase() === file.name.toLowerCase())) {
            return item({
                action: "none",
                currentPath: file.relativePath,
                proposedPath,
                fileName: file.name,
                sourceId: file.sourceId,
                explanation: top.reasons.join(" · ") || top.label,
                reviewGroup: "skipped",
                selected: false,
                score: top.score,
                confidenceLabel: top.confidenceLabel,
                skipReason: "Target already exists"
            });
        }
        const ready = top.score >= READY_SCORE;
        return item({
            action: "move",
            currentPath: file.relativePath,
            proposedPath,
            fileName: file.name,
            sourceId: file.sourceId,
            explanation: top.reasons.join(" · ") || `Move to ${top.label}.`,
            reviewGroup: ready ? "ready" : "review",
            selected: ready,
            score: top.score,
            confidenceLabel: top.confidenceLabel,
            skipReason: null
        });
    });
}
function item(partial) {
    return {
        status: "preview",
        warnings: partial.warnings ?? [],
        renameReasons: partial.renameReasons ?? [],
        ...partial
    };
}
function canConfirm(item) {
    return item.selected && Boolean(item.proposedPath) && (item.action === "move" || item.action === "rename" || item.action === "create_folder" || item.action === "create_structure");
}
function validateEditedName(name) {
    const result = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$rename$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validateSafeFileName"])(name);
    return result.ok ? null : result.reason;
}
function applyNameEdit(item, nextName) {
    const trimmed = nextName.trim();
    const invalid = validateEditedName(trimmed);
    if (invalid) {
        return {
            ...item,
            warnings: [
                invalid
            ],
            reviewGroup: "review"
        };
    }
    return {
        ...item,
        proposedPath: joinPath(parentPath(item.proposedPath || item.currentPath), trimmed),
        selected: true,
        reviewGroup: "ready",
        warnings: []
    };
}
function inverseItem(item) {
    if (!item.proposedPath || item.action !== "move" && item.action !== "rename") return null;
    return {
        ...item,
        currentPath: item.proposedPath,
        proposedPath: item.currentPath,
        fileName: item.proposedPath.split("/").at(-1) ?? item.fileName,
        status: "preview",
        selected: true,
        reviewGroup: "ready"
    };
}
async function executePlanItems(items) {
    const results = [];
    for (const item of items){
        if (!canConfirm(item) || !item.proposedPath) {
            results.push({
                ...item,
                status: "skipped",
                skipReason: item.skipReason ?? "Not selected"
            });
            continue;
        }
        const handle = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["loadHandle"])(item.sourceId);
        if (!handle) {
            results.push({
                ...item,
                status: "failed",
                skipReason: "This folder is no longer available."
            });
            continue;
        }
        if (!await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ensurePermission"])(handle, "readwrite")) {
            results.push({
                ...item,
                status: "failed",
                skipReason: "This folder needs permission."
            });
            continue;
        }
        try {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["moveOrRenameFile"])(handle, item.currentPath, item.proposedPath);
            results.push({
                ...item,
                status: "applied"
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Could not apply this action.";
            results.push({
                ...item,
                status: message.includes("overwrite") ? "skipped" : "failed",
                skipReason: message,
                warnings: [
                    ...item.warnings,
                    message
                ]
            });
        }
    }
    return results;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/product/src/host/browser/recommendations.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "buildFileProfile",
    ()=>buildFileProfile,
    "buildFileProfileFromDescriptor",
    ()=>buildFileProfileFromDescriptor,
    "buildFolderProfile",
    ()=>buildFolderProfile,
    "fileUnderstandingLabels",
    ()=>fileUnderstandingLabels,
    "folderLabel",
    ()=>folderLabel,
    "rankFolders",
    ()=>rankFolders,
    "recommendFolders",
    ()=>recommendFolders,
    "tokenize",
    ()=>tokenize
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$descriptors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/host/browser/descriptors.ts [app-client] (ecmascript)");
;
function enrichKnowledgeDescriptor(descriptor) {
    return descriptor;
}
const MAX_CANDIDATES = 100;
const FILE_STOP_WORDS = new Set([
    'untitled',
    'document',
    'file',
    'new',
    'copy',
    'final',
    'draft',
    'image',
    'img',
    'temp',
    'tmp',
    'the',
    'and',
    'for',
    'del',
    'de',
    'la',
    'el',
    'los',
    'las'
]);
const GENERIC_FOLDERS = new Set([
    'downloads',
    'desktop',
    'documents',
    'documentos',
    'docs',
    'misc',
    'general',
    'temp',
    'tmp',
    'old',
    'archive',
    'backup',
    'screenshots',
    'files'
]);
const TYPE_ORGANISED_FOLDERS = new Set([
    'pdf',
    'pdfs',
    'images',
    'photos',
    'pictures',
    'imagenes',
    'imágenes',
    'spreadsheets',
    'excel',
    'scans',
    'videos',
    'music',
    'audio'
]);
const MONTHS = new Set([
    'january',
    'february',
    'march',
    'april',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
    'gener',
    'febrer',
    'març',
    'abril',
    'maig',
    'juny',
    'juliol',
    'agost',
    'setembre',
    'octubre',
    'novembre',
    'desembre'
]);
const FILE_FAMILIES = {
    pdf: 'document',
    doc: 'document',
    docx: 'document',
    rtf: 'document',
    odt: 'document',
    pages: 'document',
    xls: 'spreadsheet',
    xlsx: 'spreadsheet',
    csv: 'spreadsheet',
    ods: 'spreadsheet',
    numbers: 'spreadsheet',
    ppt: 'presentation',
    pptx: 'presentation',
    key: 'presentation',
    jpg: 'image',
    jpeg: 'image',
    png: 'image',
    gif: 'image',
    heic: 'image',
    webp: 'image',
    tiff: 'image',
    tif: 'image',
    bmp: 'image',
    mp4: 'video',
    mov: 'video',
    avi: 'video',
    mkv: 'video',
    mp3: 'audio',
    wav: 'audio',
    m4a: 'audio',
    zip: 'archive',
    rar: 'archive',
    '7z': 'archive',
    eml: 'email',
    msg: 'email',
    js: 'code',
    ts: 'code',
    py: 'code',
    java: 'code',
    cs: 'code',
    html: 'code',
    css: 'code',
    json: 'code',
    md: 'text',
    txt: 'text',
    psd: 'design',
    ai: 'design',
    sketch: 'design',
    fig: 'design',
    dwg: 'design',
    sqlite: 'database',
    db: 'database',
    accdb: 'database'
};
const HINT_GROUPS = [
    {
        id: 'invoice',
        topic: 'finance',
        terms: [
            'invoice',
            'invoices',
            'factura',
            'facturas',
            'factures',
            'facturacion',
            'facturación'
        ]
    },
    {
        id: 'contract',
        topic: 'legal',
        terms: [
            'contract',
            'contracts',
            'contrato',
            'contratos',
            'contracte',
            'contractes'
        ]
    },
    {
        id: 'tax',
        topic: 'finance',
        terms: [
            'tax',
            'impuesto',
            'impuestos',
            'impost',
            'impostos',
            'iva'
        ]
    },
    {
        id: 'client',
        topic: 'client',
        terms: [
            'client',
            'clients',
            'cliente',
            'clientes'
        ]
    },
    {
        id: 'proposal',
        topic: 'project',
        terms: [
            'proposal',
            'proposals',
            'propuesta',
            'propuestas',
            'proposta',
            'propostes'
        ]
    },
    {
        id: 'grant',
        topic: 'finance',
        terms: [
            'grant',
            'grants',
            'subvencion',
            'subvención',
            'subvencions',
            'subvenció',
            'subvencio'
        ]
    },
    {
        id: 'receipt',
        topic: 'finance',
        terms: [
            'receipt',
            'receipts',
            'recibo',
            'recibos',
            'rebut',
            'rebuts'
        ]
    },
    {
        id: 'budget',
        topic: 'finance',
        terms: [
            'budget',
            'budgets',
            'presupuesto',
            'presupuestos',
            'pressupost',
            'pressupostos'
        ]
    },
    {
        id: 'cv',
        topic: 'personal',
        terms: [
            'cv',
            'resume',
            'curriculum'
        ]
    }
];
const TERM_TO_HINT = new Map();
for (const group of HINT_GROUPS){
    for (const term of group.terms){
        TERM_TO_HINT.set(term, group);
    }
}
function tokenize(value) {
    return value.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).map((token)=>token.trim()).filter((token)=>token.length >= 2);
}
function unique(tokens) {
    return [
        ...new Set(tokens)
    ];
}
function extensionOf(fileName) {
    const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
    return match?.[1] ?? null;
}
function baseNameOf(fileName) {
    return fileName.replace(/\.[^.]+$/, '');
}
function fileFamilyOf(extension) {
    if (!extension) return 'unknown';
    return FILE_FAMILIES[extension] ?? 'unknown';
}
function folderSegments(folderPath) {
    return folderPath.split(/[/\\]+/).filter(Boolean);
}
function folderLabel(folderPath) {
    const segments = folderSegments(folderPath);
    if (segments.length === 0) return folderPath;
    if (segments.length === 1) return segments[0];
    const last = segments[segments.length - 1];
    const parent = segments[segments.length - 2];
    const grandparent = segments[segments.length - 3];
    if (parent && [
        'users',
        'home'
    ].includes(parent.toLowerCase())) return last;
    if (grandparent && [
        'users',
        'home'
    ].includes(grandparent.toLowerCase())) return last;
    return `${parent} / ${last}`;
}
function tokensOverlap(a, b) {
    if (a === b) return 'exact';
    if (a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a))) {
        return 'partial';
    }
    return null;
}
function bestOverlap(token, haystack) {
    let best = null;
    for (const item of haystack){
        const overlap = tokensOverlap(token, item);
        if (overlap === 'exact') return 'exact';
        if (overlap === 'partial') best = 'partial';
    }
    return best;
}
function isYear(token) {
    return /^\d{4}$/.test(token) && Number(token) >= 1900 && Number(token) <= 2100;
}
function capitalizeToken(token) {
    if (!token) return token;
    return token.charAt(0).toUpperCase() + token.slice(1);
}
function prettyList(values) {
    return values.map(capitalizeToken).join(', ');
}
function countTokens(tokens) {
    const counts = new Map();
    for (const token of tokens){
        counts.set(token, (counts.get(token) ?? 0) + 1);
    }
    return counts;
}
function topTokens(tokens, limit, exclude = new Set()) {
    return [
        ...countTokens(tokens).entries()
    ].filter(([token])=>!exclude.has(token) && !FILE_STOP_WORDS.has(token)).sort((a, b)=>b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([token])=>token);
}
function buildFileProfile(fileName, sourceApp = '') {
    const extension = extensionOf(fileName);
    const baseName = baseNameOf(fileName);
    const rawTokens = unique(tokenize(baseName));
    const tokens = rawTokens.filter((token)=>!FILE_STOP_WORDS.has(token));
    const dates = [];
    const documentHints = [];
    const topicHints = [];
    const languageHints = [];
    const entities = [];
    const weakTokens = [];
    for (const token of tokens){
        const hint = TERM_TO_HINT.get(token);
        if (hint) {
            if (!documentHints.includes(hint.id)) documentHints.push(hint.id);
            if (!topicHints.includes(hint.topic)) topicHints.push(hint.topic);
            continue;
        }
        if (isYear(token) || MONTHS.has(token)) {
            dates.push(token);
            weakTokens.push(token);
            continue;
        }
        if (token === extension) {
            weakTokens.push(token);
            continue;
        }
        if (token.length >= 3) {
            entities.push(token);
        } else {
            weakTokens.push(token);
        }
    }
    const strongTokens = unique([
        ...documentHints,
        ...entities
    ]);
    return {
        originalName: fileName,
        baseName,
        extension,
        fileFamily: fileFamilyOf(extension),
        tokens,
        strongTokens,
        weakTokens,
        entities,
        dates,
        documentHints,
        topicHints,
        languageHints,
        sourceApp: sourceApp || undefined
    };
}
function buildFileProfileFromDescriptor(descriptor) {
    const profile = buildFileProfile((0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$descriptors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["descriptorDisplayName"])(descriptor));
    return {
        ...profile,
        entities: unique([
            ...profile.entities,
            ...descriptor.entities
        ]),
        dates: unique([
            ...profile.dates,
            ...descriptor.dates
        ]),
        documentHints: unique([
            ...profile.documentHints,
            ...descriptor.hints
        ]),
        topicHints: unique([
            ...profile.topicHints,
            ...descriptor.topics
        ]),
        languageHints: unique([
            ...profile.languageHints,
            ...descriptor.language
        ]),
        strongTokens: unique([
            ...profile.documentHints,
            ...descriptor.hints,
            ...profile.entities,
            ...descriptor.entities
        ])
    };
}
function fileUnderstandingLabels(profile) {
    const labels = [];
    for (const hint of profile.documentHints){
        labels.push(capitalizeToken(hint));
    }
    for (const entity of profile.entities.slice(0, 3)){
        labels.push(entity.toUpperCase() === entity ? entity : capitalizeToken(entity));
    }
    for (const date of profile.dates.slice(0, 2)){
        labels.push(capitalizeToken(date));
    }
    return unique(labels).slice(0, 5);
}
function buildFolderProfile(entry) {
    const absolutePath = entry.absolutePath || entry.locator;
    const folderNameTokens = unique(tokenize(entry.folderName || entry.name));
    const pathTokens = unique(tokenize(absolutePath));
    const parentTokens = unique(entry.parentTokens.flatMap((token)=>tokenize(token)));
    const existingFileTokens = unique(entry.fileNames.flatMap((name)=>tokenize(baseNameOf(name)).filter((token)=>!FILE_STOP_WORDS.has(token))));
    const documentHints = [];
    const topics = [];
    for (const token of [
        ...folderNameTokens,
        ...pathTokens,
        ...existingFileTokens
    ]){
        const hint = TERM_TO_HINT.get(token);
        if (!hint) continue;
        if (!documentHints.includes(hint.id)) documentHints.push(hint.id);
        if (!topics.includes(hint.topic)) topics.push(hint.topic);
    }
    const extensionDistribution = {};
    for (const name of entry.fileNames){
        const ext = extensionOf(name);
        if (!ext) continue;
        extensionDistribution[ext] = (extensionDistribution[ext] ?? 0) + 1;
    }
    for (const ext of entry.extensions){
        extensionDistribution[ext] = extensionDistribution[ext] ?? 1;
    }
    const lastSegment = folderNameTokens[folderNameTokens.length - 1] ?? entry.folderName.toLowerCase();
    const genericPenaltyHints = GENERIC_FOLDERS.has(lastSegment) ? [
        lastSegment
    ] : [];
    return {
        folderId: entry.id,
        sourceId: entry.sourceId,
        absolutePath,
        folderNameTokens,
        pathTokens,
        parentTokens,
        existingFileTokens,
        dominantEntities: topTokens([
            ...pathTokens,
            ...existingFileTokens
        ], 6, new Set([
            ...GENERIC_FOLDERS,
            ...MONTHS
        ])).filter((token)=>!TERM_TO_HINT.has(token) && !isYear(token)),
        dominantDocumentHints: documentHints,
        dominantTopics: topics,
        extensionDistribution,
        genericPenaltyHints
    };
}
function generateCandidates(file, folders) {
    if (folders.length <= MAX_CANDIDATES) return folders;
    const ranked = folders.map((folder)=>({
            folder,
            hits: candidateHits(file, folder)
        })).sort((a, b)=>b.hits - a.hits || a.folder.absolutePath.localeCompare(b.folder.absolutePath));
    const withHits = ranked.filter((item)=>item.hits > 0).slice(0, MAX_CANDIDATES);
    if (withHits.length >= 12) return withHits.map((item)=>item.folder);
    return ranked.slice(0, MAX_CANDIDATES).map((item)=>item.folder);
}
function candidateHits(file, folder) {
    const haystack = [
        ...folder.folderNameTokens,
        ...folder.pathTokens,
        ...folder.existingFileTokens,
        ...folder.dominantEntities,
        ...folder.dominantDocumentHints,
        ...folder.dominantTopics
    ];
    let hits = 0;
    for (const token of [
        ...file.strongTokens,
        ...file.documentHints,
        ...file.entities,
        ...file.topicHints
    ]){
        if (bestOverlap(token, haystack)) hits += 1;
    }
    return hits;
}
function result(scorerId, score, reasons, contributions) {
    return {
        scorerId,
        score,
        reasons,
        contributions
    };
}
function scoreEntityMatch(file, folder) {
    if (file.entities.length === 0) return result('entityMatchScorer', 0, [], []);
    let score = 0;
    const reasons = [];
    const contributions = [];
    const matched = [];
    for (const entity of file.entities){
        const nameHit = bestOverlap(entity, folder.folderNameTokens);
        const pathHit = bestOverlap(entity, folder.pathTokens);
        const fileHit = bestOverlap(entity, [
            ...folder.existingFileTokens,
            ...folder.dominantEntities
        ]);
        if (nameHit === 'exact') score += 30;
        else if (pathHit === 'exact') score += 24;
        else if (fileHit === 'exact') score += 20;
        else if (nameHit === 'partial' || pathHit === 'partial' || fileHit === 'partial') score += 10;
        else continue;
        matched.push(entity);
    }
    score = Math.min(30, score);
    if (matched.length > 0) {
        const label = `${prettyList(matched)} matches this folder`;
        reasons.push(label);
        contributions.push({
            label,
            points: score
        });
    }
    return result('entityMatchScorer', score, reasons, contributions);
}
function scorePathTokens(file, folder) {
    let score = 0;
    const haystack = unique([
        ...folder.folderNameTokens,
        ...folder.pathTokens
    ]);
    for (const token of unique([
        ...file.documentHints,
        ...file.entities,
        ...file.strongTokens
    ])){
        const hit = bestOverlap(token, haystack);
        if (hit === 'exact') {
            score += token === folder.folderNameTokens.at(-1) ? 18 : 12;
        } else if (hit === 'partial') {
            score += 6;
        }
    }
    score = Math.min(25, score);
    if (score <= 0) return result('pathTokenScorer', 0, [], []);
    const label = 'Folder path match';
    return result('pathTokenScorer', score, [
        label
    ], [
        {
            label,
            points: score
        }
    ]);
}
function scoreExistingFilenames(file, folder) {
    if (folder.existingFileTokens.length === 0) return result('existingFilenameScorer', 0, [], []);
    let score = 0;
    const matchedHints = [];
    const interesting = unique([
        ...file.documentHints,
        ...file.entities,
        ...file.strongTokens
    ]);
    for (const token of interesting){
        const hit = bestOverlap(token, folder.existingFileTokens);
        if (hit === 'exact') {
            score += 12;
            matchedHints.push(token);
        } else if (hit === 'partial') {
            score += 6;
            matchedHints.push(token);
        }
    }
    score = Math.min(25, score);
    if (score <= 0) return result('existingFilenameScorer', 0, [], []);
    const label = matchedHints.length > 0 ? `Similar ${prettyList(matchedHints.slice(0, 2))} files already exist here` : 'Similar files already exist here';
    return result('existingFilenameScorer', score, [
        label
    ], [
        {
            label,
            points: score
        }
    ]);
}
function scoreDocumentHints(file, folder) {
    if (file.documentHints.length === 0) return result('documentHintScorer', 0, [], []);
    const haystack = [
        ...folder.dominantDocumentHints,
        ...folder.folderNameTokens,
        ...folder.existingFileTokens
    ];
    let score = 0;
    const matched = [];
    for (const hint of file.documentHints){
        if (bestOverlap(hint, haystack)) {
            score += 12;
            matched.push(hint);
        }
    }
    score = Math.min(20, score);
    if (score <= 0) return result('documentHintScorer', 0, [], []);
    const label = `${prettyList(matched)} matches existing files`;
    return result('documentHintScorer', score, [
        label
    ], [
        {
            label,
            points: score
        }
    ]);
}
function scoreTopics(file, folder) {
    if (file.topicHints.length === 0) return result('topicScorer', 0, [], []);
    const matched = file.topicHints.filter((topic)=>folder.dominantTopics.some((item)=>tokensOverlap(topic, item)));
    if (matched.length === 0) {
        const pathHit = file.topicHints.some((topic)=>bestOverlap(topic, folder.pathTokens));
        if (!pathHit) return result('topicScorer', 0, [], []);
        const score = 8;
        const label = `${prettyList(file.topicHints)}-related folder`;
        return result('topicScorer', score, [
            label
        ], [
            {
                label,
                points: score
            }
        ]);
    }
    const score = Math.min(15, matched.length * 10);
    const label = `This folder is ${matched[0]}-related`;
    return result('topicScorer', score, [
        label
    ], [
        {
            label,
            points: score
        }
    ]);
}
function scoreParentContext(file, folder) {
    if (folder.parentTokens.length === 0) return result('parentContextScorer', 0, [], []);
    const interesting = unique([
        ...file.entities,
        ...file.documentHints,
        ...file.topicHints
    ]);
    let score = 0;
    for (const token of interesting){
        const hit = bestOverlap(token, folder.parentTokens);
        if (hit === 'exact') score += 8;
        else if (hit === 'partial') score += 4;
    }
    score = Math.min(10, score);
    if (score <= 0) return result('parentContextScorer', 0, [], []);
    const label = 'The parent folder suggests related work';
    return result('parentContextScorer', score, [
        label
    ], [
        {
            label,
            points: score
        }
    ]);
}
function scoreExtension(file, folder) {
    const ext = file.extension;
    if (!ext) return result('extensionScorer', 0, [], []);
    const lastName = folder.folderNameTokens.at(-1) ?? '';
    const typeOrganised = TYPE_ORGANISED_FOLDERS.has(lastName);
    const extCount = folder.extensionDistribution[ext] ?? 0;
    const total = Object.values(folder.extensionDistribution).reduce((sum, count)=>sum + count, 0);
    const share = total > 0 ? extCount / total : 0;
    let score = 0;
    if (typeOrganised && bestOverlap(ext, folder.folderNameTokens)) {
        score = 5;
    } else if (share >= 0.5) {
        score = 4;
    } else if (extCount > 0 || folder.pathTokens.includes(ext)) {
        score = 2;
    }
    if (score <= 0) return result('extensionScorer', 0, [], []);
    const label = `${ext.toUpperCase()} files are common here`;
    return result('extensionScorer', score, [
        label
    ], [
        {
            label,
            points: score
        }
    ]);
}
function scoreGenericPenalty(_file, folder) {
    if (folder.genericPenaltyHints.length === 0) {
        return result('genericFolderPenaltyScorer', 0, [], []);
    }
    const score = -6;
    const label = 'Generic folder';
    return result('genericFolderPenaltyScorer', score, [], [
        {
            label,
            points: score
        }
    ]);
}
const SCORERS = [
    scoreEntityMatch,
    scorePathTokens,
    scoreExistingFilenames,
    scoreDocumentHints,
    scoreTopics,
    scoreParentContext,
    scoreExtension,
    scoreGenericPenalty
];
function confidenceLabel(score) {
    if (score >= 70) return 'Strong match';
    if (score >= 50) return 'Good match';
    if (score >= 30) return 'Possible match';
    return 'Weak match';
}
function aggregateRanking(folder, scorerResults) {
    const contributions = scorerResults.flatMap((item)=>item.contributions).filter((item)=>item.points !== 0).sort((a, b)=>Math.abs(b.points) - Math.abs(a.points));
    const reasons = unique(scorerResults.flatMap((item)=>item.reasons)).slice(0, 4);
    const rawScore = scorerResults.reduce((sum, item)=>sum + item.score, 0);
    const score = Math.max(0, Math.min(100, Math.round(rawScore)));
    return {
        folder: folder.absolutePath,
        score,
        confidenceLabel: confidenceLabel(score),
        label: folderLabel(folder.absolutePath),
        reasons,
        contributions,
        scorers: scorerResults.map((item)=>({
                scorerId: item.scorerId,
                score: item.score
            }))
    };
}
function rankFolders(input) {
    const file = buildFileProfileFromDescriptor(enrichKnowledgeDescriptor(input.descriptor));
    const profiles = input.folders.filter((entry)=>entry.kind !== 'attachment').map(buildFolderProfile);
    const candidates = generateCandidates(file, profiles);
    return candidates.map((folder)=>aggregateRanking(folder, SCORERS.map((scorer)=>scorer(file, folder)))).sort((a, b)=>b.score - a.score || a.folder.localeCompare(b.folder));
}
function recommendFolders(input) {
    return rankFolders(input).filter((item)=>item.score > 0).slice(0, 5).map(({ scorers: _scorers, ...item })=>item);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/product/src/host/browser/rename.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "analyzeFilenameIssues",
    ()=>analyzeFilenameIssues,
    "proposeSafeRename",
    ()=>proposeSafeRename,
    "renameNameConflicts",
    ()=>renameNameConflicts,
    "validateSafeFileName",
    ()=>validateSafeFileName
]);
const ILLEGAL_CHARS = /[\\/:*?"<>|]/g;
const WINDOWS_RESERVED = new Set([
    'con',
    'prn',
    'aux',
    'nul',
    'com1',
    'com2',
    'com3',
    'com4',
    'lpt1',
    'lpt2',
    'lpt3'
]);
function splitFileName(fileName) {
    const lastDot = fileName.lastIndexOf('.');
    if (lastDot <= 0) return {
        stem: fileName,
        extension: ''
    };
    return {
        stem: fileName.slice(0, lastDot),
        extension: fileName.slice(lastDot)
    };
}
function nameTokens(stem) {
    return stem.replace(ILLEGAL_CHARS, ' ').split(/[\s_\-]+/).map((token)=>token.trim()).filter(Boolean);
}
function siblingUsesUnderscores(siblingNames) {
    return siblingNames.some((name)=>splitFileName(name).stem.includes('_'));
}
function analyzeFilenameIssues(fileName) {
    const { stem } = splitFileName(fileName);
    const issues = [];
    if (ILLEGAL_CHARS.test(stem)) issues.push('illegal_characters');
    if (/\s{2,}/.test(stem)) issues.push('repeated_spaces');
    else if (/\s/.test(stem)) issues.push('spaces');
    if (/\s$/.test(stem)) issues.push('trailing_space');
    if (/\.$/.test(stem)) issues.push('trailing_dot');
    if (/__|--|[_\-.]\s|\s[_\-.]/.test(stem)) issues.push('duplicate_separators');
    if (fileName.length > 255) issues.push('too_long');
    return issues;
}
function normalizeStem(stem) {
    const cleaned = stem.replace(ILLEGAL_CHARS, ' ').replace(/\s+/g, ' ').trim().replace(/\.+$/, '');
    return nameTokens(cleaned).join('_');
}
function shortenToMaxLength(name, max = 255) {
    if (name.length <= max) return name;
    const { stem, extension } = splitFileName(name);
    const maxStem = max - extension.length;
    if (maxStem <= 0) return name.slice(0, max);
    return `${stem.slice(0, maxStem)}${extension}`;
}
function buildRenameReasons(issues, matchStyle) {
    const reasons = [];
    if (issues.includes('illegal_characters')) {
        reasons.push('Invalid characters removed because Windows does not allow them.');
    }
    if (issues.includes('repeated_spaces') || issues.includes('duplicate_separators')) {
        reasons.push('Repeated spaces and separators collapsed for a cleaner name.');
    }
    if (issues.includes('trailing_space') || issues.includes('trailing_dot')) {
        reasons.push('Trailing spaces or dots removed so the name saves reliably.');
    }
    if (issues.includes('too_long')) {
        reasons.push('Name shortened to stay within the maximum file name length.');
    }
    if (matchStyle) {
        reasons.push('Underscores match your existing naming style in this folder.');
    } else if (issues.includes('spaces') || issues.includes('repeated_spaces')) {
        reasons.push('Spaces replaced with underscores so the name stays easy to find.');
    }
    return reasons.length > 0 ? reasons : [
        'Filename normalised for safe use on your system.'
    ];
}
function proposeSafeRename(fileName, siblingNames = []) {
    const issues = analyzeFilenameIssues(fileName);
    if (issues.length === 0) return null;
    const { stem, extension } = splitFileName(fileName);
    const proposedStem = normalizeStem(stem);
    if (!proposedStem) return null;
    if (WINDOWS_RESERVED.has(proposedStem.toLowerCase())) return null;
    let proposed = shortenToMaxLength(`${proposedStem}${extension}`);
    if (proposed.toLowerCase() === fileName.toLowerCase()) return null;
    const matchStyle = siblingUsesUnderscores(siblingNames);
    const reasons = buildRenameReasons(issues, matchStyle);
    return {
        name: proposed,
        explanation: reasons.join(' '),
        strategy: 'normalize',
        reasons
    };
}
function validateSafeFileName(fileName) {
    const trimmed = fileName.trim();
    if (!trimmed) {
        return {
            ok: false,
            reason: 'File name cannot be empty.'
        };
    }
    if (trimmed !== fileName) {
        return {
            ok: false,
            reason: 'File name cannot have leading or trailing spaces.'
        };
    }
    if (trimmed === '.' || trimmed === '..') {
        return {
            ok: false,
            reason: 'That file name is not allowed.'
        };
    }
    if (ILLEGAL_CHARS.test(trimmed)) {
        return {
            ok: false,
            reason: 'File name contains characters your system does not allow.'
        };
    }
    if (trimmed.length > 255) {
        return {
            ok: false,
            reason: 'File name is too long.'
        };
    }
    const { stem } = splitFileName(trimmed);
    if (/\s$/.test(stem) || /\.$/.test(stem)) {
        return {
            ok: false,
            reason: 'File name cannot end with a space or dot.'
        };
    }
    if (WINDOWS_RESERVED.has(stem.toLowerCase())) {
        return {
            ok: false,
            reason: 'That file name is reserved by Windows.'
        };
    }
    return {
        ok: true
    };
}
function renameNameConflicts(proposedName, currentName, siblingNames) {
    const proposed = proposedName.toLowerCase();
    const current = currentName.toLowerCase();
    if (proposed === current) return false;
    return siblingNames.some((name)=>name.toLowerCase() === proposed);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/product/src/host/browser/search.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "documentFilterForName",
    ()=>documentFilterForName,
    "searchKnowledge",
    ()=>searchKnowledge
]);
const IMAGE_EXTENSIONS = new Set([
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "heic",
    "heif",
    "tif",
    "tiff",
    "bmp",
    "svg"
]);
const ARCHIVE_EXTENSIONS = new Set([
    "zip",
    "rar",
    "7z",
    "tar",
    "gz",
    "tgz"
]);
function documentFilterForName(name) {
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "pdf") return "pdf";
    if (ext === "docx" || ext === "doc") return "docx";
    if (IMAGE_EXTENSIONS.has(ext)) return "images";
    if (ARCHIVE_EXTENSIONS.has(ext)) return "archives";
    return "other";
}
function tokens(value) {
    return value.toLowerCase().split(/[^a-z0-9áéíóúüñ]+/i).filter((token)=>token.length >= 2);
}
function matches(haystack, query) {
    const hay = haystack.toLowerCase();
    const q = query.trim().toLowerCase();
    if (!q) return false;
    if (hay.includes(q)) return true;
    const queryTokens = tokens(q);
    if (queryTokens.length === 0) return false;
    return queryTokens.every((token)=>hay.includes(token));
}
function searchKnowledge(input) {
    const query = input.query.trim();
    if (!query) return [];
    const hits = [];
    for (const file of input.files){
        if (matches(`${file.name} ${file.relativePath}`, query)) {
            const sourceName = input.sources.find((source)=>source.id === file.sourceId)?.name;
            hits.push({
                id: file.id,
                kind: "file",
                title: file.name,
                subtitle: sourceName || file.relativePath
            });
        }
        if (hits.length >= 24) break;
    }
    for (const folder of input.folders ?? []){
        if (matches(`${folder.folderName} ${folder.relativePath}`, query)) {
            hits.push({
                id: folder.id,
                kind: "folder",
                title: folder.folderName,
                subtitle: folder.relativePath === "." ? folder.name : folder.relativePath
            });
        }
        if (hits.length >= 32) break;
    }
    for (const source of input.sources){
        if (matches(source.name, query)) {
            hits.push({
                id: source.id,
                kind: "source",
                title: source.name,
                subtitle: `${source.fileCount.toLocaleString()} documents`
            });
        }
    }
    for (const workflow of input.workflows){
        if (matches(workflow.name, query)) {
            hits.push({
                id: workflow.id,
                kind: "workflow",
                title: workflow.name,
                subtitle: `${workflow.fileIds.length} files`
            });
        }
    }
    for (const run of input.activity){
        if (matches(run.message, query)) {
            hits.push({
                id: run.id,
                kind: "activity",
                title: run.message,
                subtitle: new Date(run.completedAt).toLocaleString()
            });
        }
    }
    return hits.slice(0, 40);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/product/src/host/browser/store.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "addSourceFromFiles",
    ()=>addSourceFromFiles,
    "addSourceFromHandle",
    ()=>addSourceFromHandle,
    "appStorageBytes",
    ()=>appStorageBytes,
    "clearActivityRuns",
    ()=>clearActivityRuns,
    "clearLocalKnowledge",
    ()=>clearLocalKnowledge,
    "connectDemoSource",
    ()=>connectDemoSource,
    "connectLocalFolder",
    ()=>connectLocalFolder,
    "deleteWorkflow",
    ()=>deleteWorkflow,
    "listActivity",
    ()=>listActivity,
    "listActivityRuns",
    ()=>listActivityRuns,
    "listFiles",
    ()=>listFiles,
    "listFolders",
    ()=>listFolders,
    "listSources",
    ()=>listSources,
    "listWorkflows",
    ()=>listWorkflows,
    "markWorkflowRan",
    ()=>markWorkflowRan,
    "onBrowserSourcesChanged",
    ()=>onBrowserSourcesChanged,
    "probeSourceStatus",
    ()=>probeSourceStatus,
    "reconcileSources",
    ()=>reconcileSources,
    "recordActivity",
    ()=>recordActivity,
    "recordActivityRun",
    ()=>recordActivityRun,
    "refreshSource",
    ()=>refreshSource,
    "removeSource",
    ()=>removeSource,
    "restoreSourceAccess",
    ()=>restoreSourceAccess,
    "saveWorkflow",
    ()=>saveWorkflow
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$connect$2d$source$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/host/browser/connect-source.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/host/browser/fs.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$dev$2d$host$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/host/browser/dev-host.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/host/browser/idb.ts [app-client] (ecmascript)");
;
;
;
;
function createId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
const grantedThisSession = new Set();
let memorySources = null;
let memoryFiles = null;
let memoryFolders = null;
const sourceChangeListeners = new Set();
const removedSourceIds = new Set();
function reclaimSource(sourceId) {
    removedSourceIds.delete(sourceId);
}
function rememberSource(source) {
    if (removedSourceIds.has(source.id)) return;
    const current = memorySources ?? [];
    memorySources = [
        ...current.filter((item)=>item.id !== source.id),
        source
    ];
}
function forgetSource(sourceId) {
    removedSourceIds.add(sourceId);
    if (!memorySources) {
        memorySources = [];
        return;
    }
    memorySources = memorySources.filter((item)=>item.id !== sourceId);
}
function notifySourcesChanged() {
    const snapshot = memorySources ?? [];
    for (const listener of sourceChangeListeners)listener(snapshot);
}
function onBrowserSourcesChanged(listener) {
    sourceChangeListeners.add(listener);
    return ()=>{
        sourceChangeListeners.delete(listener);
    };
}
async function rememberGrantedHandle(sourceId, handle) {
    try {
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["persistHandle"])(sourceId, handle);
        grantedThisSession.add(sourceId);
        return "persistent";
    } catch  {
        grantedThisSession.add(sourceId);
        return "limited";
    }
}
async function listSources() {
    const persisted = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbGetAll"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].sources);
    memorySources = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$connect$2d$source$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["mergeLiveSources"])(persisted, memorySources, removedSourceIds);
    return memorySources;
}
async function listFiles() {
    const persisted = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbGetAll"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].files);
    const livePersisted = persisted.filter((file)=>!removedSourceIds.has(file.sourceId));
    if (!memoryFiles) {
        memoryFiles = livePersisted;
        return memoryFiles;
    }
    const known = new Set(memoryFiles.map((file)=>file.id));
    memoryFiles = [
        ...memoryFiles.filter((file)=>!removedSourceIds.has(file.sourceId)),
        ...livePersisted.filter((file)=>!known.has(file.id))
    ];
    return memoryFiles;
}
async function listFolders() {
    const persisted = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbGetAll"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].folders);
    const livePersisted = persisted.filter((folder)=>!removedSourceIds.has(folder.sourceId));
    if (!memoryFolders) {
        memoryFolders = livePersisted;
        return memoryFolders;
    }
    const known = new Set(memoryFolders.map((folder)=>folder.id));
    memoryFolders = [
        ...memoryFolders.filter((folder)=>!removedSourceIds.has(folder.sourceId)),
        ...livePersisted.filter((folder)=>!known.has(folder.id))
    ];
    return memoryFolders;
}
async function listActivity() {
    const runs = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbGetAll"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].activity);
    return runs.sort((left, right)=>right.completedAt.localeCompare(left.completedAt)).slice(0, 500);
}
async function listWorkflows() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbGetAll"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].workflows);
}
async function probeSourceStatus(sourceId) {
    const source = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbGet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].sources, sourceId);
    if (source?.access === "limited") return "ready";
    if (grantedThisSession.has(sourceId)) return "ready";
    const handle = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["loadHandle"])(sourceId);
    if (!handle) return source ? "unavailable" : "unavailable";
    const read = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["queryPermission"])(handle, "read");
    if (read === "granted") {
        grantedThisSession.add(sourceId);
        return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["directoryAvailable"])(handle) ? "ready" : "unavailable";
    }
    return "needs_permission";
}
async function reconcileSources() {
    const sources = await listSources();
    for (const source of sources){
        if (removedSourceIds.has(source.id) || source.status === "indexing") continue;
        const status = await probeSourceStatus(source.id);
        const live = memorySources?.find((item)=>item.id === source.id);
        if (!live || removedSourceIds.has(source.id) || live.status === "indexing") continue;
        if (status === live.status) continue;
        const updated = {
            ...live,
            status
        };
        rememberSource(updated);
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbSet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].sources, source.id, updated);
    }
    return listSources();
}
async function finishSourceIndex(id, handle, access, _wellKnownToken) {
    if (removedSourceIds.has(id)) return;
    const existing = memorySources?.find((source)=>source.id === id) ?? await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbGet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].sources, id);
    if (!existing || removedSourceIds.has(id)) return;
    try {
        const scanned = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["scanDirectory"])(handle, id);
        const displayName = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$connect$2d$source$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["humanFolderName"])(handle.name, (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$connect$2d$source$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["humanFolderName"])(existing.name, "Folder"));
        const source = {
            ...existing,
            ...scanned.source,
            id,
            name: displayName,
            status: "ready",
            access,
            wellKnownToken: existing.wellKnownToken
        };
        if (removedSourceIds.has(id)) return;
        rememberSource(source);
        if (removedSourceIds.has(id)) return;
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbSet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].sources, id, source);
        if (removedSourceIds.has(id)) {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbDelete"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].sources, id);
            return;
        }
        await replaceSourceKnowledge(id, scanned.folders, scanned.files);
        if (removedSourceIds.has(id)) return;
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$connect$2d$source$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["connectTrace"])("scan_complete", {
            id,
            files: source.fileCount
        });
        notifySourcesChanged();
    } catch (error) {
        if (removedSourceIds.has(id)) return;
        const kept = {
            ...existing,
            status: "unavailable",
            lastIndexed: existing.lastIndexed
        };
        rememberSource(kept);
        if (removedSourceIds.has(id)) return;
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbSet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].sources, id, kept);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$connect$2d$source$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["connectTrace"])("scan_failed", {
            id,
            error: error instanceof Error ? error.message : "scan_failed"
        });
        notifySourcesChanged();
    }
}
async function connectDemoSource() {
    if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$dev$2d$host$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isBrowserDevHost"])()) {
        throw new Error("Demo sources are only available on localhost.");
    }
    const existing = (await listSources()).find((source)=>source.id === __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$dev$2d$host$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEV_DEMO_SOURCE_ID"] || source.wellKnownToken === __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$dev$2d$host$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEV_DEMO_HINT"]);
    const id = existing?.id ?? __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$dev$2d$host$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEV_DEMO_SOURCE_ID"];
    reclaimSource(id);
    const files = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$dev$2d$host$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["demoFileDescriptors"])(id);
    const folders = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$dev$2d$host$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["demoFolderDescriptors"])(id);
    const source = {
        id,
        kind: "local",
        type: "local_folder",
        name: __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$dev$2d$host$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEV_DEMO_DISPLAY_NAME"],
        fileCount: files.length,
        folderCount: folders.length,
        bytes: files.reduce((sum, file)=>sum + file.size, 0),
        lastIndexed: new Date().toISOString(),
        status: "ready",
        access: "limited",
        wellKnownToken: __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$dev$2d$host$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEV_DEMO_HINT"]
    };
    rememberSource(source);
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbSet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].sources, id, source);
    await replaceSourceKnowledge(id, folders, files);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$connect$2d$source$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["connectTrace"])("scan_complete", {
        id,
        files: source.fileCount,
        kind: "dev-demo"
    });
    notifySourcesChanged();
    return source;
}
async function addSourceFromHandle(handle, wellKnownToken) {
    const id = createId("src");
    reclaimSource(id);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$connect$2d$source$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["connectTrace"])("source_id_created", {
        id,
        name: handle.name,
        wellKnownToken
    });
    const access = await rememberGrantedHandle(id, handle);
    const pending = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$connect$2d$source$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pendingBrowserSource"])({
        id,
        name: (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$connect$2d$source$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["humanFolderName"])(handle.name, "Folder"),
        access,
        wellKnownToken
    });
    const committed = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$connect$2d$source$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["commitSourceBeforeScan"])({
        source: pending,
        persist: async (source)=>{
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbSet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].sources, source.id, source);
        },
        remember: rememberSource,
        startScan: (source)=>{
            void finishSourceIndex(source.id, handle, access, wellKnownToken);
        }
    });
    notifySourcesChanged();
    return committed;
}
async function addSourceFromFiles(files) {
    if (files.length === 0) {
        throw new DOMException("The user aborted a request.", "AbortError");
    }
    const id = createId("src");
    reclaimSource(id);
    const name = files[0]?.webkitRelativePath?.split(/[/\\]/).filter(Boolean)[0] || files[0]?.name || "Folder";
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$connect$2d$source$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["connectTrace"])("source_id_created", {
        id,
        name,
        kind: "files"
    });
    const pending = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$connect$2d$source$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pendingBrowserSource"])({
        id,
        name,
        access: "limited"
    });
    const committed = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$connect$2d$source$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["commitSourceBeforeScan"])({
        source: pending,
        persist: async (source)=>{
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbSet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].sources, source.id, source);
        },
        remember: rememberSource,
        startScan: (source)=>{
            void Promise.resolve().then(()=>{
                if (removedSourceIds.has(source.id)) return;
                const scanned = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["scanFileList"])(files, source.id);
                const next = {
                    ...source,
                    ...scanned.source,
                    id: source.id,
                    name: (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$connect$2d$source$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["humanFolderName"])(scanned.source.name, source.name),
                    status: "ready",
                    access: "limited"
                };
                rememberSource(next);
                if (removedSourceIds.has(source.id)) return;
                return Promise.all([
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbSet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].sources, source.id, next),
                    replaceSourceKnowledge(source.id, scanned.folders, scanned.files)
                ]).then(()=>{
                    if (removedSourceIds.has(source.id)) return;
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$connect$2d$source$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["connectTrace"])("scan_complete", {
                        id: source.id,
                        files: next.fileCount
                    });
                    notifySourcesChanged();
                });
            }).catch(async (error)=>{
                if (removedSourceIds.has(source.id)) return;
                const kept = {
                    ...pending,
                    status: "unavailable"
                };
                rememberSource(kept);
                if (removedSourceIds.has(source.id)) return;
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbSet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].sources, source.id, kept);
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$connect$2d$source$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["connectTrace"])("scan_failed", {
                    id: source.id,
                    error: error instanceof Error ? error.message : "scan_failed"
                });
                notifySourcesChanged();
            });
        }
    });
    notifySourcesChanged();
    return committed;
}
async function connectLocalFolder(startIn, wellKnownToken) {
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$connect$2d$source$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["connectTrace"])("picker_start", {
        startIn,
        wellKnownToken
    });
    const picked = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["requestLocalFolder"])(startIn);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$connect$2d$source$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["connectTrace"])("handle_returned", {
        kind: picked.kind
    });
    if (picked.kind === "handle") return addSourceFromHandle(picked.handle, wellKnownToken);
    return addSourceFromFiles(picked.files);
}
async function replaceSourceKnowledge(sourceId, folders, files) {
    if (removedSourceIds.has(sourceId)) return;
    const keptFolders = (memoryFolders ?? []).filter((folder)=>!folder.id.startsWith(`${sourceId}:`));
    const keptFiles = (memoryFiles ?? []).filter((file)=>!file.id.startsWith(`${sourceId}:`));
    memoryFolders = [
        ...keptFolders,
        ...folders
    ];
    memoryFiles = [
        ...keptFiles,
        ...files
    ];
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$connect$2d$source$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["connectTrace"])("scan_progress", {
        sourceId,
        filesWritten: files.length,
        foldersWritten: folders.length,
        indexStore: __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].files
    });
    const folderKeys = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbKeys"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].folders);
    const fileKeys = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbKeys"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].files);
    await Promise.all(folderKeys.filter((key)=>key.startsWith(`${sourceId}:`)).map((key)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbDelete"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].folders, key)));
    await Promise.all(fileKeys.filter((key)=>key.startsWith(`${sourceId}:`)).map((key)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbDelete"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].files, key)));
    if (removedSourceIds.has(sourceId)) return;
    await Promise.all(folders.map((folder)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbSet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].folders, folder.id, folder)));
    await Promise.all(files.map((file)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbSet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].files, file.id, file)));
}
async function restoreSourceAccess(sourceId) {
    const source = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbGet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].sources, sourceId);
    if (!source) return null;
    if (source.access === "limited") {
        const ready = {
            ...source,
            status: "ready"
        };
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbSet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].sources, sourceId, ready);
        return ready;
    }
    const handle = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["loadHandle"])(sourceId);
    if (!handle) {
        const missing = {
            ...source,
            status: "unavailable"
        };
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbSet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].sources, sourceId, missing);
        return missing;
    }
    if (!await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ensurePermission"])(handle, "read")) {
        const blocked = {
            ...source,
            status: "needs_permission"
        };
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbSet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].sources, sourceId, blocked);
        return blocked;
    }
    grantedThisSession.add(sourceId);
    return refreshSource(sourceId);
}
async function refreshSource(sourceId) {
    const source = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbGet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].sources, sourceId);
    if (!source) return null;
    if (source.access === "limited") {
        const limited = {
            ...source,
            status: "ready"
        };
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbSet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].sources, sourceId, limited);
        return limited;
    }
    const handle = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["loadHandle"])(sourceId);
    if (!handle) {
        const missing = {
            ...source,
            status: "unavailable"
        };
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbSet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].sources, sourceId, missing);
        return missing;
    }
    if (!await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ensurePermission"])(handle, "read")) {
        const blocked = {
            ...source,
            status: "needs_permission"
        };
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbSet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].sources, sourceId, blocked);
        return blocked;
    }
    if (!await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["directoryAvailable"])(handle)) {
        const missing = {
            ...source,
            status: "unavailable"
        };
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbSet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].sources, sourceId, missing);
        return missing;
    }
    grantedThisSession.add(sourceId);
    const scanning = {
        ...source,
        status: "indexing"
    };
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbSet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].sources, sourceId, scanning);
    try {
        const scanned = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["scanDirectory"])(handle, sourceId);
        const next = {
            ...source,
            ...scanned.source,
            status: "ready",
            access: "persistent"
        };
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbSet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].sources, sourceId, next);
        await replaceSourceKnowledge(sourceId, scanned.folders, scanned.files);
        return next;
    } catch  {
        const failed = {
            ...source,
            status: "unavailable"
        };
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbSet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].sources, sourceId, failed);
        return failed;
    }
}
async function removeSource(sourceId) {
    grantedThisSession.delete(sourceId);
    forgetSource(sourceId);
    if (memoryFiles) memoryFiles = memoryFiles.filter((file)=>!file.id.startsWith(`${sourceId}:`));
    if (memoryFolders) memoryFolders = memoryFolders.filter((folder)=>!folder.id.startsWith(`${sourceId}:`));
    notifySourcesChanged();
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbDelete"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].sources, sourceId);
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["removeHandle"])(sourceId);
    const folderKeys = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbKeys"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].folders);
    const fileKeys = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbKeys"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].files);
    await Promise.all(folderKeys.filter((key)=>key.startsWith(`${sourceId}:`)).map((key)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbDelete"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].folders, key)));
    await Promise.all(fileKeys.filter((key)=>key.startsWith(`${sourceId}:`)).map((key)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbDelete"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].files, key)));
}
async function recordActivity(run) {
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbSet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].activity, run.id, run);
}
async function listActivityRuns() {
    const runs = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbGetAll"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].activity);
    return runs.map((run)=>{
        if ("runId" in run && run.runId) return run;
        const legacy = run;
        return {
            runId: legacy.id,
            runNumber: 1,
            startedAt: legacy.completedAt,
            completedAt: legacy.completedAt,
            trigger: "organise_documents",
            summary: {
                moved: legacy.items.filter((item)=>item.status === "applied").length,
                skipped: legacy.items.filter((item)=>item.status === "skipped").length,
                failed: legacy.items.filter((item)=>item.status === "failed").length
            },
            items: legacy.items.map((item)=>({
                    sourcePath: item.currentPath,
                    targetPath: item.proposedPath,
                    fileName: item.fileName,
                    action: item.action === "none" ? "ignore" : item.action,
                    status: item.status === "applied" ? "moved" : item.status === "failed" ? "failed" : "skipped",
                    reason: item.skipReason || item.explanation,
                    confidence: item.score,
                    undoAvailable: item.status === "applied" && (item.action === "move" || item.action === "rename")
                }))
        };
    }).sort((left, right)=>right.completedAt.localeCompare(left.completedAt)).slice(0, 500);
}
async function recordActivityRun(run) {
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbSet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].activity, run.runId, run);
}
async function clearActivityRuns() {
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbClear"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].activity);
}
async function saveWorkflow(name, fileIds) {
    const workflow = {
        id: createId("wf"),
        name: name.trim() || "Untitled plan",
        createdAt: new Date().toISOString(),
        lastRunAt: null,
        fileIds
    };
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbSet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].workflows, workflow.id, workflow);
    return workflow;
}
async function markWorkflowRan(id) {
    const workflow = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbGet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].workflows, id);
    if (!workflow) return;
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbSet"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].workflows, id, {
        ...workflow,
        lastRunAt: new Date().toISOString()
    });
}
async function deleteWorkflow(id) {
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbDelete"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].workflows, id);
}
async function clearLocalKnowledge() {
    memorySources = [];
    memoryFiles = [];
    memoryFolders = [];
    notifySourcesChanged();
    await Promise.all([
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbClear"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].sources),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbClear"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].folders),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbClear"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].files),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbClear"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].activity),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbClear"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].workflows),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["idbClear"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$idb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORE"].handles)
    ]);
}
async function appStorageBytes() {
    if (!navigator.storage?.estimate) return null;
    const estimate = await navigator.storage.estimate();
    return estimate.usage ?? null;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/product/src/host/capabilities.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "capabilitiesFor",
    ()=>capabilitiesFor,
    "capabilitiesOf",
    ()=>capabilitiesOf,
    "folderAccessCopy",
    ()=>folderAccessCopy,
    "homeHeadline",
    ()=>homeHeadline,
    "homeKnowledgeLine",
    ()=>homeKnowledgeLine
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$product$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/lib/product-copy.ts [app-client] (ecmascript)");
;
function capabilitiesFor(input) {
    const desktop = input.host === 'electron';
    const folderAccess = desktop ? true : Boolean(input.folderAccess);
    const organise = desktop ? true : Boolean(input.organise ?? folderAccess);
    return {
        saveAs: desktop && input.platform === 'win32',
        tray: desktop,
        openFolder: desktop,
        reveal: desktop,
        filesystem: folderAccess,
        notifications: desktop,
        nativeDialogs: desktop,
        organise,
        search: true,
        activity: true,
        workflows: true,
        license: true
    };
}
function capabilitiesOf(info) {
    if (info?.capabilities) return info.capabilities;
    if (!info?.host) {
        const folderAccess = Boolean(info?.folderAccess);
        return {
            saveAs: false,
            tray: false,
            openFolder: false,
            reveal: false,
            filesystem: folderAccess,
            notifications: false,
            nativeDialogs: false,
            organise: folderAccess,
            search: true,
            activity: true,
            workflows: true,
            license: true
        };
    }
    return capabilitiesFor({
        host: info.host,
        platform: info.platform,
        folderAccess: info.folderAccess,
        organise: info.capabilities?.organise
    });
}
function homeHeadline(_info) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$product$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["productCopy"])('What SuHuella knows');
}
function homeKnowledgeLine(args) {
    if (args.sourceCount === 0) {
        return args.host === 'browser' ? 'Connect a source to begin' : 'Add a source to begin';
    }
    if (args.scanning) {
        if (args.learningFrom) return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$product$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["productCopy"])(`Learning from ${args.learningFrom}…`);
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$product$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["productCopy"])('Updating what SuHuella knows');
    }
    return '';
}
function folderAccessCopy(caps) {
    if (caps.filesystem) return null;
    return {
        title: 'Folder access is not available in this browser.',
        body: 'Use Chrome or Edge, or download the desktop app.',
        detail: 'Your documents stay on this device. Nothing is uploaded.',
        action: 'Use Chrome or Edge, or download the desktop app.'
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/product/src/host/install-browser-host.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "clearLocalKnowledge",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["clearLocalKnowledge"],
    "folderAccessSupported",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$install$2d$browser$2d$host$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["folderAccessSupported"],
    "formatBytes",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatBytes"],
    "installBrowserHost",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$install$2d$browser$2d$host$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["installBrowserHost"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$install$2d$browser$2d$host$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/product/src/host/install-browser-host.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/host/browser/fs.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/host/browser/store.ts [app-client] (ecmascript)");
}),
"[project]/packages/product/src/host/install-browser-host.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "folderAccessSupported",
    ()=>folderAccessSupported,
    "installBrowserHost",
    ()=>installBrowserHost
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f2e$build$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/brands/.build/entry.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/brands/suhuella/entry.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$device$2d$metrics$2d$view$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/lib/device-metrics-view.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$source$2d$appearance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/lib/source-appearance.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$capabilities$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/host/capabilities.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$license$2d$status$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/lib/license-status.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$host$2d$action$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/lib/host-action-copy.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$recognised$2d$names$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/lib/recognised-names.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$source$2d$browse$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/lib/source-browse.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/host/browser/fs.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$device$2d$identity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/lib/device-identity.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$license$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/host/browser/license.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$service$2d$health$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/lib/service-health.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$plan$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/host/browser/plan.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$search$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/host/browser/search.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$dev$2d$host$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/host/browser/dev-host.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/host/browser/store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$organise$2d$descriptors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/host/browser/organise-descriptors.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$browser$2d$organise$2d$selection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/lib/browser-organise-selection.ts [app-client] (ecmascript)");
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
const SUGGESTED_START = {
    'suhuella:desktop': 'desktop',
    'suhuella:documents': 'documents',
    'suhuella:downloads': 'downloads',
    'suhuella:pictures': 'pictures',
    'suhuella:videos': 'videos',
    'suhuella:movies': 'videos',
    'suhuella:music': 'music',
    'suhuella:icloud': 'documents',
    'suhuella:dropbox': 'documents',
    'suhuella:onedrive': 'documents',
    'suhuella:google-drive': 'documents'
};
function detectPlatform() {
    if (typeof navigator === 'undefined') return 'darwin';
    if (/Win/.test(navigator.userAgent)) return 'win32';
    if (/Linux/.test(navigator.userAgent)) return 'linux';
    return 'darwin';
}
function emptySettings(sources = []) {
    return {
        indexedLocations: sources.map((source)=>source.id),
        indexedFolderCount: sources.reduce((sum, source)=>sum + source.folderCount, 0),
        indexedFileCount: sources.reduce((sum, source)=>sum + source.fileCount, 0),
        lastIndexed: sources[0]?.lastIndexed ?? null,
        lastLearnedNewFiles: null,
        lastLearnedUpdatedFolders: null,
        firstRunCompleted: true,
        launchAtLogin: false,
        welcomeNotificationShown: true,
        knowledgeSourcesEnabled: {
            local_folder: true,
            google_drive: false,
            dropbox: false,
            onedrive: false,
            gmail: false,
            outlook: false,
            manual_import: false
        },
        recentFolders: sources.map((source)=>source.id),
        sourceAppearance: loadBrowserSourceAppearance()
    };
}
const BROWSER_SOURCE_APPEARANCE_KEY = 'suhuella-source-appearance';
function loadBrowserSourceAppearance() {
    if (typeof localStorage === 'undefined') return {};
    try {
        const parsed = JSON.parse(localStorage.getItem(BROWSER_SOURCE_APPEARANCE_KEY) ?? '{}');
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$source$2d$appearance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeSourceAppearanceStore"])(parsed, detectPlatform());
    } catch  {
        return {};
    }
}
function saveBrowserSourceAppearance(next) {
    const normalized = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$source$2d$appearance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeSourceAppearanceStore"])(next);
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(BROWSER_SOURCE_APPEARANCE_KEY, JSON.stringify(normalized));
    }
    return normalized;
}
async function applyBrowserSourceAppearance(path, update) {
    const key = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$source$2d$appearance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeSourceKey"])(path);
    const sources = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listSources"])();
    if (!key) return emptySettings(sources);
    const source = sources.find((item)=>item.id === path);
    const hints = source ? {
        name: source.name,
        kind: 'user_folder'
    } : (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$source$2d$appearance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["resolveSourceIdentity"])(path, detectPlatform());
    if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$source$2d$appearance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["canPersistSourceAppearanceColor"])(path, detectPlatform(), hints)) return emptySettings(sources);
    const current = loadBrowserSourceAppearance();
    const next = {
        ...current
    };
    const entry = {
        ...next[key]
    };
    if ('color' in update) {
        const color = update.color;
        if (color && (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$source$2d$appearance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isCorporateColor"])(color)) entry.color = color;
        else delete entry.color;
    }
    if ('iconId' in update) {
        const iconId = update.iconId;
        if (iconId && (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$source$2d$appearance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isCustomizableIconId"])(iconId)) entry.iconId = iconId;
        else delete entry.iconId;
    }
    if (Object.keys(entry).length === 0) delete next[key];
    else next[key] = entry;
    saveBrowserSourceAppearance(next);
    return emptySettings(sources);
}
function dropBrowserSourceAppearance(path) {
    const key = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$source$2d$appearance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeSourceKey"])(path);
    if (!key) return;
    const current = loadBrowserSourceAppearance();
    if (!current[key]) return;
    const next = {
        ...current
    };
    delete next[key];
    saveBrowserSourceAppearance(next);
}
function knowledgePath(sourceId, relativePath) {
    return `${sourceId}/${relativePath}`;
}
function parseKnowledgePath(path) {
    const slash = path.indexOf('/');
    if (slash <= 0) return {
        sourceId: path,
        relativePath: ''
    };
    return {
        sourceId: path.slice(0, slash),
        relativePath: path.slice(slash + 1)
    };
}
function toPlanItem(item) {
    return {
        action: item.action === 'create_folder' || item.action === 'create_structure' ? item.action : item.action,
        currentPath: item.currentPath.includes('/') ? item.currentPath : knowledgePath(item.sourceId, item.currentPath),
        proposedPath: item.proposedPath ? item.proposedPath.includes('/') ? `${item.sourceId}/${item.proposedPath}` : knowledgePath(item.sourceId, item.proposedPath) : null,
        explanation: item.explanation,
        status: item.status,
        warnings: item.warnings,
        reviewGroup: item.reviewGroup,
        selected: item.selected,
        fileName: item.fileName,
        score: item.score,
        confidenceLabel: item.confidenceLabel,
        alternatives: [],
        skipReason: item.skipReason,
        renameStrategy: item.action === 'rename' ? 'normalize' : null,
        renameReasons: item.renameReasons
    };
}
function fromPlanItem(item) {
    const current = parseKnowledgePath(item.currentPath);
    const proposed = item.proposedPath ? parseKnowledgePath(item.proposedPath).relativePath : null;
    return {
        action: item.action === 'archive' || item.action === 'ignore' ? 'none' : item.action,
        currentPath: current.relativePath || item.fileName,
        proposedPath: proposed,
        fileName: item.fileName,
        sourceId: current.sourceId,
        explanation: item.explanation,
        renameReasons: item.renameReasons ?? [],
        warnings: item.warnings,
        reviewGroup: item.reviewGroup,
        selected: item.selected,
        score: item.score,
        confidenceLabel: item.confidenceLabel,
        skipReason: item.skipReason,
        status: item.status
    };
}
function toWorkflow(item) {
    return {
        id: item.id,
        name: item.name,
        description: '',
        category: null,
        workflowVersion: 1,
        trigger: 'manual',
        plan: {
            knowledgeSet: {
                items: item.fileIds.map((path)=>({
                        path,
                        kind: 'file'
                    }))
            }
        },
        createdAt: item.createdAt,
        updatedAt: item.lastRunAt ?? item.createdAt,
        lastRunAt: item.lastRunAt,
        approvedPlan: null,
        approvedAt: null,
        autopilotEnabled: false
    };
}
function toActivityItems(items) {
    return items.map((item)=>({
            sourcePath: item.currentPath,
            targetPath: item.proposedPath,
            fileName: item.fileName,
            action: item.action,
            status: item.status === 'applied' ? 'moved' : item.status === 'failed' ? 'failed' : 'skipped',
            reason: item.skipReason || item.explanation,
            confidence: item.score,
            undoAvailable: item.status === 'applied' && (item.action === 'move' || item.action === 'rename')
        }));
}
async function browserComputerName() {
    try {
        return (await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$license$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDevice"])()).deviceName;
    } catch  {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$device$2d$identity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBrowserComputerName"])();
    }
}
async function licenseView(context) {
    const sources = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listSources"])();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$license$2d$status$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toLicenseStatusView"])(context ?? await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$license$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["loadLicense"])() ?? (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$license$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["freeLicense"])(), {
        computerName: await browserComputerName(),
        learningOk: sources.length > 0,
        saveAsActive: false,
        lastSeenOffline: (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$license$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["browserLicenseWasOffline"])()
    });
}
function locationStatus(status) {
    if (status === 'needs_permission') return 'permission_denied';
    if (status === 'unavailable') return 'unavailable';
    if (status === 'indexing') return 'indexing';
    return 'ready';
}
function storageStatus(status, supported) {
    if (!supported) return 'unsupported';
    if (status === 'needs_permission') return 'permission_required';
    if (status === 'unavailable') return 'unavailable';
    if (status === 'indexing') return 'measuring';
    return 'measured';
}
async function indexStatus() {
    const sources = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listSources"])();
    const [files, folders] = await Promise.all([
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listFiles"])(),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listFolders"])()
    ]);
    const settings = emptySettings(sources);
    const names = [
        ...sources.map((source)=>source.name),
        ...folders.flatMap((folder)=>[
                folder.folderName,
                folder.name,
                ...folder.fileNames
            ]),
        ...files.map((file)=>file.name)
    ];
    const extensions = [
        ...folders.flatMap((folder)=>folder.extensions),
        ...files.map((file)=>file.name.split('.').pop() ?? '')
    ].filter(Boolean);
    const recognised = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$recognised$2d$names$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["recognisedFromNames"])(names, extensions);
    const latest = sources.find((source)=>source.lastIndexed);
    const indexing = sources.some((source)=>source.status === 'indexing');
    return {
        settings: {
            ...settings,
            lastLearnedNewFiles: latest?.fileCount ?? null,
            lastLearnedUpdatedFolders: latest ? 1 : null
        },
        scan: {
            status: indexing ? 'scanning' : 'ready',
            foldersScanned: sources.reduce((sum, source)=>sum + source.folderCount, 0),
            filesSeen: sources.reduce((sum, source)=>sum + source.fileCount, 0),
            currentPath: indexing ? sources.find((source)=>source.status === 'indexing')?.name ?? '' : '',
            startedAt: indexing ? new Date().toISOString() : null,
            finishedAt: null,
            estimatedRemainingSeconds: indexing ? null : null
        },
        locations: sources.map((source)=>({
                path: source.id,
                name: source.name,
                lastIndexed: source.lastIndexed,
                folderCount: source.folderCount,
                fileCount: source.fileCount,
                status: locationStatus(source.status),
                usefulness: 'useful',
                exists: source.status !== 'unavailable',
                catalogKey: source.wellKnownToken ?? null
            })),
        summary: {
            topFolders: sources.map((source)=>source.name).slice(0, 3),
            languages: [],
            documentTypes: [],
            quality: sources.length > 0 ? 'good' : 'needs_more',
            lastLearnedNewFiles: latest?.fileCount ?? null,
            lastLearnedUpdatedFolders: latest ? 1 : null,
            historyYears: null,
            recognised,
            uniqueNames: (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$recognised$2d$names$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uniqueNameCount"])(names)
        }
    };
}
function folderAccessSupported() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["folderAccessKind"])() !== 'none';
}
function installBrowserHost() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    window.__suhuellaHost = 'browser';
    void (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$license$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDevice"])();
    const progressListeners = new Set();
    const emitIndexProgress = (sources)=>{
        const indexing = sources.some((source)=>source.status === 'indexing');
        const progress = {
            status: indexing ? 'scanning' : 'ready',
            foldersScanned: sources.reduce((sum, source)=>sum + source.folderCount, 0),
            filesSeen: sources.reduce((sum, source)=>sum + source.fileCount, 0),
            currentPath: sources.find((source)=>source.status === 'indexing')?.name ?? '',
            startedAt: indexing ? new Date().toISOString() : null,
            finishedAt: indexing ? null : new Date().toISOString(),
            estimatedRemainingSeconds: indexing ? null : 0
        };
        for (const listener of progressListeners)listener(progress);
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["onBrowserSourcesChanged"])((sources)=>{
        emitIndexProgress(sources);
    });
    void (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["reconcileSources"])();
    const api = {
        getSettings: async ()=>emptySettings(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listSources"])()),
        getIndexStatus: ()=>indexStatus(),
        browseSource: async (rootPath)=>{
            const requested = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$source$2d$browse$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeBrowsePath"])(rootPath);
            const name = requested.split('/').filter(Boolean).at(-1) ?? requested;
            const empty = {
                path: requested,
                name,
                parentPath: (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$source$2d$browse$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["browseParentPath"])(requested),
                entries: []
            };
            if (!requested) return empty;
            const { sourceId, relativePath } = parseKnowledgePath(requested);
            const [files, folders] = await Promise.all([
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listFiles"])(),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listFolders"])()
            ]);
            const sourceFiles = files.filter((file)=>file.sourceId === sourceId);
            const sourceFolders = folders.filter((folder)=>folder.sourceId === sourceId);
            const folderEntries = sourceFolders.filter((folder)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$source$2d$browse$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isDirectBrowseChild"])(relativePath || sourceId, knowledgePath(folder.sourceId, folder.relativePath))).map((folder)=>({
                    path: knowledgePath(folder.sourceId, folder.relativePath),
                    name: folder.folderName || folder.name,
                    kind: 'folder',
                    size: null,
                    lastModified: folder.lastModified
                }));
            const fileEntries = sourceFiles.filter((file)=>{
                const parent = knowledgePath(file.sourceId, file.parentRelative);
                return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$source$2d$browse$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeBrowsePath"])(parent).toLowerCase() === requested.toLowerCase() || relativePath === '' && file.parentRelative === '' && file.sourceId === sourceId && requested === sourceId;
            }).map((file)=>({
                    path: knowledgePath(file.sourceId, file.relativePath),
                    name: file.name,
                    kind: 'file',
                    extension: file.name.includes('.') ? file.name.split('.').pop() : undefined,
                    size: file.size,
                    lastModified: file.lastModified
                }));
            return {
                path: requested,
                name,
                parentPath: (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$source$2d$browse$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["browseParentPath"])(requested),
                entries: [
                    ...folderEntries,
                    ...fileEntries
                ].sort((left, right)=>{
                    if (left.kind !== right.kind) return left.kind === 'folder' ? -1 : 1;
                    return left.name.localeCompare(right.name, undefined, {
                        sensitivity: 'base'
                    });
                })
            };
        },
        getIndexBrowse: async ()=>{
            const folders = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listFolders"])();
            const files = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listFiles"])();
            return {
                folders: folders.map((folder)=>({
                        path: knowledgePath(folder.sourceId, folder.relativePath),
                        name: folder.folderName,
                        fileCount: folder.fileCount
                    })),
                files: files.map((file)=>({
                        path: knowledgePath(file.sourceId, file.relativePath),
                        name: file.name,
                        extension: file.name.split('.').pop()
                    }))
            };
        },
        searchDocuments: async (query)=>{
            const [files, folders, sources, workflows, activity] = await Promise.all([
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listFiles"])(),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listFolders"])(),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listSources"])(),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listWorkflows"])(),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listActivityRuns"])()
            ]);
            const hits = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$search$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["searchKnowledge"])({
                query: query.text,
                files,
                folders,
                sources,
                workflows,
                activity: activity.map((run)=>({
                        id: run.runId,
                        completedAt: run.completedAt,
                        message: run.workflowName ?? `${run.summary.moved} organised`,
                        items: []
                    }))
            });
            const mapped = hits.map((hit)=>{
                const extension = hit.kind === 'file' ? hit.title.split('.').pop() ?? null : null;
                const documentFilter = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$search$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["documentFilterForName"])(hit.title);
                const matchedOn = hit.kind === 'file' ? [
                    'filename'
                ] : hit.kind === 'folder' ? [
                    'folder'
                ] : [
                    'recent'
                ];
                return {
                    id: hit.id,
                    kind: hit.kind === 'source' ? 'folder' : hit.kind === 'file' ? 'file' : hit.kind === 'folder' ? 'folder' : hit.kind === 'workflow' ? 'workflow' : 'activity',
                    title: hit.title,
                    subtitle: hit.subtitle,
                    path: hit.id,
                    folderPath: hit.kind === 'folder' || hit.kind === 'source' ? hit.id : null,
                    extension,
                    documentFilter,
                    lastSeenAt: null,
                    matchedOn,
                    workflowId: hit.kind === 'workflow' ? hit.id : undefined,
                    activityRunId: hit.kind === 'activity' ? hit.id : undefined
                };
            });
            const filtered = query.filter === 'all' ? mapped : mapped.filter((hit)=>hit.kind !== 'file' || hit.documentFilter === query.filter);
            console.info('[suhuella-connect] search', {
                query: query.text,
                filter: query.filter,
                filesRead: files.length,
                sourcesRead: sources.length,
                resultCount: filtered.length
            });
            return {
                query: query.text,
                filter: query.filter,
                hits: filtered
            };
        },
        openSearchPath: async ()=>({
                ok: false,
                error: __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$host$2d$action$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["HOST_ACTION_COPY"].openFileDesktopOnly
            }),
        revealSearchPath: async ()=>({
                ok: false,
                error: __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$host$2d$action$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["HOST_ACTION_COPY"].revealUnavailable
            }),
        getKnowledgeIndexHealth: async ()=>{
            const sources = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listSources"])();
            const files = sources.reduce((sum, source)=>sum + source.fileCount, 0);
            return {
                status: 'ready',
                locationCount: sources.length,
                sourceCount: sources.length,
                folderCount: sources.reduce((sum, source)=>sum + source.folderCount, 0),
                fileCount: files,
                indexVersion: 1,
                lastIndexed: sources[0]?.lastIndexed ?? null,
                searchReady: true
            };
        },
        getSuggestedLocations: async ()=>{
            return [];
        },
        // Chrome picker in production. Localhost Dev Host can seed /dev-data without a picker.
        addIndexedLocation: async (hint)=>{
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$dev$2d$host$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isDevDemoHint"])(hint)) {
                if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$dev$2d$host$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isBrowserDevHost"])()) {
                    return emptySettings(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listSources"])());
                }
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["connectDemoSource"])();
                emitIndexProgress(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listSources"])());
                return emptySettings(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listSources"])());
            }
            const wellKnown = hint?.startsWith('suhuella:') ? hint : undefined;
            try {
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["connectLocalFolder"])(SUGGESTED_START[hint ?? ''] ?? undefined, wellKnown);
                emitIndexProgress(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listSources"])());
                return emptySettings(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listSources"])());
            } catch (error) {
                if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isProtectedFolderError"])(error)) {
                    throw error instanceof __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FolderAccessError"] ? error : new __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FolderAccessError"]('protected', 'This folder is not available in this browser.');
                }
                throw error;
            }
        },
        removeIndexedLocation: async (location)=>{
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["removeSource"])(location);
            dropBrowserSourceAppearance(location);
            return emptySettings(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listSources"])());
        },
        setIndexedLocations: async (locations)=>{
            const added = locations.filter((location)=>location.startsWith('suhuella:'));
            if (added[0]) {
                try {
                    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["connectLocalFolder"])(SUGGESTED_START[added[0]]);
                } catch (error) {
                    if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isAbortError"])(error)) throw error;
                }
                return emptySettings(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listSources"])());
            }
            return emptySettings(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listSources"])());
        },
        startIndexScan: async ()=>{
            const sources = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listSources"])();
            for (const source of sources){
                if (source.status === 'indexing') continue;
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["refreshSource"])(source.id);
            }
            emitIndexProgress(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listSources"])());
            return emptySettings(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listSources"])());
        },
        restoreSourceAccess: async (sourceId)=>{
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["restoreSourceAccess"])(sourceId);
            return emptySettings(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listSources"])());
        },
        cancelIndexScan: async ()=>{},
        onIndexProgress: (listener)=>{
            progressListeners.add(listener);
            return ()=>{
                progressListeners.delete(listener);
            };
        },
        droppedFilePath: ()=>null,
        matchFoldersForFile: async ()=>null,
        setLaunchAtLogin: async ()=>emptySettings(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listSources"])()),
        setSourceAppearanceColor: async (path, color)=>applyBrowserSourceAppearance(path, {
                color
            }),
        setSourceAppearance: applyBrowserSourceAppearance,
        getSettingsPath: async ()=>'This device',
        revealSettingsFile: async ()=>{},
        checkRelease: async ()=>({
                kind: 'current',
                installed: __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["brand"].release.version,
                latest: __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["brand"].release.version,
                minimum: __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["brand"].release.minimumVersion,
                notes: '',
                url: null,
                canInstall: false
            }),
        getAppInfo: async ()=>{
            const platform = detectPlatform();
            const access = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["folderAccessKind"])();
            const folderAccess = access !== 'none';
            return {
                name: __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["brand"].displayName,
                version: __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["brand"].release.version,
                buildVersion: __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["brand"].release.version,
                platform,
                development: false,
                host: 'browser',
                folderAccess,
                computerName: await browserComputerName(),
                osVersion: platform === 'win32' ? 'Windows' : platform === 'linux' ? 'Linux' : 'macOS',
                capabilities: (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$capabilities$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["capabilitiesFor"])({
                    host: 'browser',
                    platform,
                    folderAccess,
                    organise: access === 'directory-picker' && (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fileWriteSupported"])()
                })
            };
        },
        getLicense: async ()=>licenseView(),
        getServiceHealth: async ()=>{
            const health = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$service$2d$health$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fetchPublicServiceHealth"])();
            return health ?? __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$service$2d$health$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["NORMAL_SERVICE_HEALTH"];
        },
        openExternal: async (url)=>{
            window.open(url, '_blank', 'noopener,noreferrer');
            return true;
        },
        createCheckoutAttempt: async (plan)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$license$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createCheckoutAttempt"])(plan),
        openCheckout: async (plan, email)=>{
            const attempt = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$license$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createCheckoutAttempt"])(plan);
            const params = new URLSearchParams({
                return: 'settings'
            });
            if (email?.trim()) params.set('email', email.trim());
            if (attempt.ok) {
                sessionStorage.setItem('suhuella_activation_attempt_id', attempt.activationAttemptId);
                params.set('attempt', attempt.activationAttemptId);
            }
            window.location.assign(`/checkout/${plan}?${params.toString()}`);
            return true;
        },
        activateFromCheckout: async (sessionId, activationAttemptId)=>{
            const attemptId = activationAttemptId?.trim() || sessionStorage.getItem('suhuella_activation_attempt_id') || undefined;
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$license$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["activateFromCheckout"])(sessionId, attemptId);
            if (result.ok) sessionStorage.removeItem('suhuella_activation_attempt_id');
            const view = await licenseView(result.license);
            return result.ok ? {
                ok: true,
                license: view
            } : {
                ok: false,
                error: result.error,
                license: view
            };
        },
        requestLicenseEmailCode: async (email)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$license$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["requestLicenseEmailCode"])(email),
        verifyLicenseEmailCode: async (challengeId, code)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$license$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["verifyLicenseEmailCode"])(challengeId, code),
        updateBusinessBranding: async (dataUrl)=>{
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$license$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateBusinessBranding"])(dataUrl);
            const view = await licenseView(result.license);
            return result.ok ? {
                ok: true,
                license: view
            } : {
                ok: false,
                error: result.error,
                license: view
            };
        },
        activateLicense: async (emailProofId)=>{
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$license$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["activateLicense"])(emailProofId);
            const view = await licenseView(result.license);
            return result.ok ? {
                ok: true,
                license: view
            } : {
                ok: false,
                error: result.error,
                license: view
            };
        },
        checkLicense: async ()=>{
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$license$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["checkLicense"])();
            const view = await licenseView(result.license);
            return result.ok ? {
                ok: true,
                license: view
            } : {
                ok: false,
                error: result.error,
                license: view
            };
        },
        deactivateLicense: async ()=>{
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$license$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["deactivateLicense"])();
            const view = await licenseView(result.license);
            return result.ok ? {
                ok: true,
                license: view
            } : {
                ok: false,
                error: result.error,
                license: view
            };
        },
        deactivateRemoteDevice: async ()=>({
                ok: false,
                error: 'invalid_request',
                license: await licenseView()
            }),
        renameThisDevice: async (name)=>{
            const trimmed = name.trim();
            if (!trimmed) {
                return {
                    ok: false,
                    error: 'invalid_request',
                    license: await licenseView()
                };
            }
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$license$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["renameDevice"])(trimmed);
            const view = await licenseView();
            return {
                ok: true,
                license: view
            };
        },
        getCompatibilityDiagnostics: async ()=>({
                development: false,
                attemptCount: 0,
                lastAttempt: null,
                attempts: []
            }),
        exportCompatibilityDiagnostics: async ()=>{
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$host$2d$action$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["HostCapabilityError"](__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$host$2d$action$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["HOST_ACTION_COPY"].exportUnavailable);
        },
        finishOnboarding: async ()=>emptySettings(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listSources"])()),
        previewSuggestions: async ()=>{},
        previewSuggestionName: async (fileName)=>({
                fileName,
                sourceApp: 'browser',
                currentFolder: '',
                mode: 'preview',
                recommendations: []
            }),
        pickSuggestionFile: async ()=>null,
        getSuggestion: async ()=>null,
        onSuggestionUpdated: ()=>()=>{},
        chooseRecommendedFolder: async ()=>({
                ok: false,
                folder: '',
                error: __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$host$2d$action$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["HOST_ACTION_COPY"].saveAsPreviewOnly
            }),
        chooseAnotherFolder: async ()=>{},
        copyFolderPath: async ()=>{
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$host$2d$action$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["HostCapabilityError"](__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$host$2d$action$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["HOST_ACTION_COPY"].revealUnavailable);
        },
        openFolder: async ()=>({
                ok: false,
                error: __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$host$2d$action$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["HOST_ACTION_COPY"].openFolderUnavailable
            }),
        includeSource: async ()=>({
                ok: false,
                error: __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$host$2d$action$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["HOST_ACTION_COPY"].openFolderUnavailable
            }),
        closeSuggestion: async ()=>{},
        pickKnowledgeSetFiles: async ()=>{
            try {
                const files = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["requestLocalFiles"])();
                const stamp = Date.now();
                const descriptors = files.map((file, index)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$browser$2d$organise$2d$selection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["indexedFileFromBrowserFile"])(file, 'picked', `${stamp}-${index}/${file.name}`));
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$organise$2d$descriptors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["rememberOrganiseDescriptors"])(descriptors, [
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$browser$2d$organise$2d$selection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["transientFolderFromName"])('picked', 'Chosen files')
                ]);
                return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$browser$2d$organise$2d$selection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["knowledgeItemsFromBrowserFiles"])(files, (_file, index)=>knowledgePath('picked', `${stamp}-${index}/${files[index]?.name ?? 'file'}`));
            } catch (error) {
                if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isAbortError"])(error)) return [];
                throw error;
            }
        },
        pickKnowledgeSetFolders: async ()=>{
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["folderAccessKind"])() === 'none') {
                throw new __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FolderAccessError"]('unsupported', __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$browser$2d$organise$2d$selection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ORGANISE_FOLDER_UNSUPPORTED"]);
            }
            try {
                const picked = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["requestLocalFolder"])();
                const sourceId = `picked_${Date.now().toString(36)}`;
                if (picked.kind === 'handle') {
                    const scanned = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["scanDirectory"])(picked.handle, sourceId);
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$organise$2d$descriptors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["rememberOrganiseDescriptors"])(scanned.files, scanned.folders);
                    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$browser$2d$organise$2d$selection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["knowledgeItemsFromIndexedFiles"])(scanned.files, (file)=>knowledgePath(file.sourceId, file.relativePath));
                }
                const scanned = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["scanFileList"])(picked.files, sourceId);
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$organise$2d$descriptors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["rememberOrganiseDescriptors"])(scanned.files, scanned.folders);
                return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$browser$2d$organise$2d$selection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["knowledgeItemsFromIndexedFiles"])(scanned.files, (file)=>knowledgePath(file.sourceId, file.relativePath));
            } catch (error) {
                if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isAbortError"])(error)) return [];
                throw error;
            }
        },
        previewOrganisationPlan: async (knowledgeSet)=>{
            const transient = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$organise$2d$descriptors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listOrganiseDescriptors"])();
            const files = [
                ...await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listFiles"])(),
                ...transient.files
            ];
            const folders = [
                ...await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listFolders"])(),
                ...transient.folders
            ];
            const selected = knowledgeSet.items.flatMap((item)=>{
                const parsed = parseKnowledgePath(item.path);
                if (item.kind === 'file') {
                    const file = files.find((entry)=>entry.id === item.path || entry.sourceId === parsed.sourceId && entry.relativePath === parsed.relativePath);
                    if (file) return [
                        file
                    ];
                    if (parsed.sourceId === 'picked' || parsed.sourceId.startsWith('picked')) {
                        const name = parsed.relativePath.split('/').pop() || parsed.relativePath;
                        return [
                            {
                                id: item.path,
                                sourceId: parsed.sourceId,
                                name,
                                relativePath: parsed.relativePath || name,
                                parentRelative: parsed.relativePath.includes('/') ? parsed.relativePath.split('/').slice(0, -1).join('/') : '',
                                size: 0,
                                lastModified: null
                            }
                        ];
                    }
                    return [];
                }
                return files.filter((file)=>{
                    if (file.sourceId !== parsed.sourceId && file.sourceId !== item.path) return false;
                    if (!parsed.relativePath) return true;
                    return file.relativePath === parsed.relativePath || file.relativePath.startsWith(`${parsed.relativePath}/`);
                });
            });
            const items = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$plan$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["previewPlan"])(selected, folders).map((item)=>toPlanItem({
                    ...item,
                    currentPath: knowledgePath(item.sourceId, item.currentPath),
                    proposedPath: item.proposedPath ? knowledgePath(item.sourceId, item.proposedPath) : null
                }));
            const preview = {
                simulated: true,
                message: 'Review the plan. Confirm selected actions only.',
                knowledgeSet,
                items,
                proposedBy: 'engine'
            };
            return {
                ok: true,
                preview
            };
        },
        proposeOrganisationPlan: async (knowledgeSet)=>{
            const preview = await api.previewOrganisationPlan(knowledgeSet);
            if (!preview.ok) return {
                ok: false,
                error: preview.error
            };
            return {
                ok: true,
                kind: 'proposal',
                proposal: {
                    simulated: true,
                    source: 'assistant',
                    message: 'Review this plan. Confirm stays with you.',
                    knowledgeSet,
                    preview: preview.preview,
                    workflows: [],
                    note: null,
                    using: {
                        backend: 'on_device',
                        label: 'On this device'
                    }
                }
            };
        },
        getPlanAssistantStatus: async ()=>({
                using: {
                    backend: 'on_device',
                    label: 'On this device'
                }
            }),
        executeOrganisationPlan: async (request)=>{
            if (!request.confirmed) {
                return {
                    ok: false,
                    error: {
                        code: 'confirmation_required',
                        message: 'Confirm changes before executing.'
                    }
                };
            }
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["folderAccessKind"])() !== 'directory-picker' || !(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fileWriteSupported"])()) {
                return {
                    ok: false,
                    error: {
                        code: 'invalid_request',
                        message: __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$browser$2d$organise$2d$selection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ORGANISE_EXECUTION_LIMIT"]
                    }
                };
            }
            const executed = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$plan$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["executePlanItems"])(request.plan.items.map(fromPlanItem));
            const items = executed.map((item)=>toPlanItem(item));
            const appliedCount = items.filter((item)=>item.status === 'applied').length;
            const skippedCount = items.filter((item)=>item.status === 'skipped').length;
            const failedCount = items.filter((item)=>item.status === 'failed').length;
            const completedAt = new Date().toISOString();
            const result = {
                simulated: false,
                runId: `web-${Date.now().toString(36)}`,
                runNumber: request.runNumber ?? 1,
                completedAt,
                message: appliedCount > 0 ? `Confirmed ${appliedCount} action${appliedCount === 1 ? '' : 's'}` : 'No actions applied',
                knowledgeSet: request.plan.knowledgeSet,
                appliedCount,
                skippedCount,
                failedCount,
                items
            };
            const run = {
                runId: result.runId,
                runNumber: result.runNumber,
                startedAt: completedAt,
                completedAt,
                trigger: request.trigger ?? 'organise_documents',
                plan: {
                    knowledgeSet: request.plan.knowledgeSet,
                    items
                },
                inversePlan: {
                    knowledgeSet: request.plan.knowledgeSet,
                    items: items.filter((item)=>item.status === 'applied').map((item)=>({
                            ...item,
                            currentPath: item.proposedPath ?? item.currentPath,
                            proposedPath: item.currentPath,
                            status: 'preview',
                            selected: true
                        }))
                },
                summary: {
                    moved: appliedCount,
                    skipped: skippedCount,
                    failed: failedCount
                },
                items: toActivityItems(items)
            };
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["recordActivityRun"])(run);
            activityCache.unshift(run);
            for (const source of (await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listSources"])()))await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["refreshSource"])(source.id);
            return {
                ok: true,
                result
            };
        },
        getByokStatus: async ()=>({
                connected: false,
                assistant: null,
                assistantLabel: null,
                model: null,
                hasKey: false
            }),
        connectByok: async ()=>({
                ok: false,
                error: 'not_available'
            }),
        disconnectByok: async ()=>({
                connected: false,
                assistant: null,
                assistantLabel: null,
                model: null,
                hasKey: false
            }),
        assistWithByok: async ()=>({
                ok: false,
                error: 'not_available'
            }),
        getByokConversation: async ()=>[],
        clearByokConversation: async ()=>[],
        getActivity: async ()=>{
            if (activityCache.length === 0) {
                activityCache.push(...await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listActivityRuns"])());
            }
            return [
                ...activityCache
            ];
        },
        undoActivity: async (request)=>{
            if (!request.confirmed) {
                return {
                    ok: false,
                    error: {
                        code: 'confirmation_required',
                        message: 'Confirm changes before undoing.'
                    }
                };
            }
            const run = activityCache.find((item)=>item.runId === request.runId);
            if (!run?.inversePlan) {
                return {
                    ok: false,
                    error: {
                        code: 'invalid_request',
                        message: 'This run cannot be undone.'
                    }
                };
            }
            const executed = await api.executeOrganisationPlan({
                plan: run.inversePlan,
                confirmed: true,
                trigger: 'organise_documents',
                runNumber: activityCache.length + 1
            });
            if (!executed.ok) return executed;
            const undoRun = activityCache[0];
            if (undoRun) {
                undoRun.trigger = 'undo';
                undoRun.reversesRunId = run.runId;
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["recordActivityRun"])(undoRun);
            }
            return {
                ok: true,
                result: {
                    run: undoRun ?? run,
                    runs: activityCache
                }
            };
        },
        getStorageUsage: async ()=>({
                indexBytes: await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["appStorageBytes"])() ?? 0,
                activityBytes: 0,
                cacheBytes: 0,
                logsBytes: 0,
                workflowsBytes: 0,
                settingsBytes: 0,
                licenseBytes: 0,
                lastCleanupAt: null
            }),
        getDocumentStorageSummary: async ()=>{
            const sources = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listSources"])();
            return {
                measuredAt: new Date().toISOString(),
                totalBytes: sources.reduce((sum, source)=>sum + source.bytes, 0),
                sources: sources.map((source)=>({
                        id: source.id,
                        kind: 'local_folder',
                        label: source.name,
                        bytes: source.bytes,
                        fileCount: source.fileCount,
                        status: source.status === 'ready' ? 'ready' : 'unavailable'
                    }))
            };
        },
        getStorageOverview: async ()=>{
            const sources = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["reconcileSources"])();
            const supported = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$fs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["folderAccessKind"])() !== 'none';
            const appBytes = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["appStorageBytes"])() ?? 0;
            const now = new Date().toISOString();
            const mapped = sources.map((source)=>({
                    id: source.id,
                    name: source.name,
                    kind: 'local_folder',
                    locator: source.name,
                    bytes: source.bytes,
                    documentCount: source.fileCount,
                    folderCount: source.folderCount,
                    status: storageStatus(source.status, supported),
                    lastMeasuredAt: now
                }));
            const localBytes = mapped.reduce((sum, source)=>sum + (source.bytes ?? 0), 0);
            return {
                knowledgeTotalBytes: mapped.length > 0 ? localBytes : null,
                knowledgeDocumentCount: mapped.reduce((sum, source)=>sum + (source.documentCount ?? 0), 0),
                sourceCount: mapped.length,
                localBytes: mapped.length > 0 ? localBytes : null,
                cloudBytes: null,
                appStorageTotalBytes: appBytes,
                sources: mapped,
                appStorage: {
                    indexBytes: appBytes,
                    activityBytes: 0,
                    cacheBytes: 0,
                    logsBytes: 0,
                    workflowsBytes: 0,
                    settingsBytes: 0,
                    licenseBytes: 0
                },
                measuredAt: now,
                status: !supported ? 'unavailable' : mapped.length === 0 ? 'empty' : 'measured',
                warnings: !supported ? [
                    {
                        code: 'failed',
                        message: 'Folder access is not available in this browser. Use Chrome or Edge, or download the desktop app.'
                    }
                ] : []
            };
        },
        getDeviceMetrics: async ()=>{
            const overview = await api.getStorageOverview();
            const sources = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listSources"])();
            const memory = performance.memory?.usedJSHeapSize;
            let appBytes = overview.appStorage.indexBytes;
            try {
                const estimate = await navigator.storage?.estimate?.();
                if (estimate?.usage != null && estimate.usage > 0) {
                    appBytes = estimate.usage;
                }
            } catch  {
            // Browser quota is optional.
            }
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$device$2d$metrics$2d$view$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["assembleDeviceMetrics"])({
                host: 'web',
                platform: 'web',
                deviceName: await browserComputerName(),
                overview: {
                    ...overview,
                    appStorage: {
                        ...overview.appStorage,
                        indexBytes: appBytes
                    },
                    appStorageTotalBytes: appBytes
                },
                deviceStorage: {
                    status: 'unsupported'
                },
                performance: {
                    memoryBytes: memory && memory > 0 ? memory : undefined,
                    status: memory && memory > 0 ? 'measured' : 'not_measured'
                },
                folderCount: sources.reduce((sum, source)=>sum + source.folderCount, 0)
            });
        },
        clearCache: async ()=>api.getStorageUsage(),
        clearLogs: async ()=>api.getStorageUsage(),
        clearActivityHistory: async ()=>{
            activityCache.length = 0;
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["clearActivityRuns"])();
            return api.getStorageUsage();
        },
        exportActivity: async ()=>{
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$host$2d$action$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["HostCapabilityError"](__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$host$2d$action$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["HOST_ACTION_COPY"].exportUnavailable);
        },
        listWorkflows: async ()=>(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listWorkflows"])()).map(toWorkflow),
        saveWorkflow: async (draft)=>{
            const workflow = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["saveWorkflow"])(draft.name, draft.knowledgeSet.items.map((item)=>item.path));
            return {
                ok: true,
                workflow: toWorkflow(workflow)
            };
        },
        updateWorkflow: async (_id, draft)=>api.saveWorkflow(draft),
        deleteWorkflow: async (workflowId)=>{
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["deleteWorkflow"])(workflowId);
            return {
                ok: true,
                workflows: (await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listWorkflows"])()).map(toWorkflow)
            };
        },
        duplicateWorkflow: async (workflowId)=>{
            const workflows = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listWorkflows"])();
            const current = workflows.find((item)=>item.id === workflowId);
            if (!current) return {
                ok: false,
                error: {
                    code: 'invalid_workflow',
                    message: 'Workflow not found.'
                }
            };
            const copy = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["saveWorkflow"])(`${current.name} (copy)`, current.fileIds);
            return {
                ok: true,
                workflow: toWorkflow(copy)
            };
        },
        loadWorkflowForRun: async (workflowId)=>{
            const workflows = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listWorkflows"])();
            const current = workflows.find((item)=>item.id === workflowId);
            if (!current) return {
                ok: false,
                error: {
                    code: 'invalid_workflow',
                    message: 'Workflow not found.'
                }
            };
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$host$2f$browser$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["markWorkflowRan"])(workflowId);
            return {
                ok: true,
                workflow: toWorkflow(current),
                knowledgeSet: {
                    items: current.fileIds.map((path)=>({
                            path,
                            kind: 'file'
                        }))
                }
            };
        },
        setWorkflowAutopilot: async ()=>({
                ok: false,
                error: {
                    code: 'invalid_workflow',
                    message: 'Autopilot is not available in the browser.'
                }
            }),
        approveWorkflowPlan: async ()=>({
                ok: false,
                error: {
                    code: 'invalid_plan',
                    message: 'Autopilot is not available in the browser.'
                }
            }),
        runAutopilot: async ()=>({
                ok: false,
                error: {
                    code: 'invalid_request',
                    message: 'Autopilot is not available in the browser.'
                }
            })
    };
    window.suhuella = api;
}
const activityCache = [];
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/product/src/lib/browser-organise-selection.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ORGANISE_CHOOSE_FILES",
    ()=>ORGANISE_CHOOSE_FILES,
    "ORGANISE_CHOOSE_FOLDER",
    ()=>ORGANISE_CHOOSE_FOLDER,
    "ORGANISE_CONNECT_FOLDER",
    ()=>ORGANISE_CONNECT_FOLDER,
    "ORGANISE_DOCUMENTS_TITLE",
    ()=>ORGANISE_DOCUMENTS_TITLE,
    "ORGANISE_EMPTY_BODY",
    ()=>ORGANISE_EMPTY_BODY,
    "ORGANISE_EMPTY_NO_SOURCES",
    ()=>ORGANISE_EMPTY_NO_SOURCES,
    "ORGANISE_EXECUTION_LIMIT",
    ()=>ORGANISE_EXECUTION_LIMIT,
    "ORGANISE_FILE_ACCEPT",
    ()=>ORGANISE_FILE_ACCEPT,
    "ORGANISE_FOLDER_UNSUPPORTED",
    ()=>ORGANISE_FOLDER_UNSUPPORTED,
    "ORGANISE_SCREEN_SUBTITLE",
    ()=>ORGANISE_SCREEN_SUBTITLE,
    "ORGANISE_SELECT_FROM_SOURCES",
    ()=>ORGANISE_SELECT_FROM_SOURCES,
    "indexedFileFromBrowserFile",
    ()=>indexedFileFromBrowserFile,
    "knowledgeItemsFromBrowserFiles",
    ()=>knowledgeItemsFromBrowserFiles,
    "knowledgeItemsFromIndexedFiles",
    ()=>knowledgeItemsFromIndexedFiles,
    "organiseHasUploadLanguage",
    ()=>organiseHasUploadLanguage,
    "organisePickErrorMessage",
    ()=>organisePickErrorMessage,
    "organiseRequiresDesktop",
    ()=>organiseRequiresDesktop,
    "planUsesAbsoluteFilesystemPath",
    ()=>planUsesAbsoluteFilesystemPath,
    "transientFolderFromName",
    ()=>transientFolderFromName
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$sources$2d$ui$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/lib/sources-ui.ts [app-client] (ecmascript)");
;
const ORGANISE_DOCUMENTS_TITLE = 'Organise documents';
const ORGANISE_SCREEN_SUBTITLE = 'Select documents and review a Plan before anything changes.';
const ORGANISE_EMPTY_BODY = 'Select documents from a connected source or choose files from this device. SuHuella will create a Plan before anything changes.';
const ORGANISE_EMPTY_NO_SOURCES = 'No connected sources yet. You can connect a folder or choose files directly.';
const ORGANISE_SELECT_FROM_SOURCES = 'Select from Sources';
const ORGANISE_CHOOSE_FILES = 'Choose files';
const ORGANISE_CHOOSE_FOLDER = 'Choose folder';
const ORGANISE_CONNECT_FOLDER = 'Connect a folder';
const ORGANISE_FOLDER_UNSUPPORTED = 'This browser cannot choose folders. Choose files instead.';
const ORGANISE_EXECUTION_LIMIT = 'This browser can prepare the Plan. Some file changes may require additional permission.';
const ORGANISE_FILE_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.csv,.png,.jpg,.jpeg,.gif,.webp,.heic,.tif,.tiff';
const UPLOAD_WORDS = /\b(upload|uploaded|sube|subir|send files|cloud import)\b/i;
const DESKTOP_REQUIRED = /\b(download the desktop app|use desktop to apply|open the desktop app)\b/i;
function organiseHasUploadLanguage(text) {
    return UPLOAD_WORDS.test(text);
}
function organiseRequiresDesktop(text) {
    return DESKTOP_REQUIRED.test(text);
}
function organisePickErrorMessage(error) {
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$sources$2d$ui$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isFolderPickAbort"])(error)) return null;
    const text = error instanceof Error ? error.message : String(error);
    const lower = text.toLowerCase();
    if (lower.includes('cannot choose folder') || lower.includes('cannot choose folders') || lower.includes('folder access is not available')) {
        return ORGANISE_FOLDER_UNSUPPORTED;
    }
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$sources$2d$ui$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isProtectedFolderConnectError"])(error)) return null;
    if (lower.includes('cannot choose documents') || lower.includes('cannot choose files')) {
        return null;
    }
    if (lower.includes('permission') || lower.includes('not allowed') || lower.includes('denied')) {
        return null;
    }
    return text.trim() ? text : null;
}
function knowledgeItemsFromBrowserFiles(files, idFor) {
    return files.filter((file)=>file.name.trim().length > 0).map((file, index)=>({
            path: idFor(file, index),
            kind: 'file'
        }));
}
function knowledgeItemsFromIndexedFiles(files, pathFor) {
    return files.map((file)=>({
            path: pathFor(file),
            kind: 'file'
        }));
}
function indexedFileFromBrowserFile(file, sourceId, relativePath) {
    return {
        id: `${sourceId}:${relativePath}`,
        sourceId,
        name: file.name.split(/[/\\]/).pop() || file.name,
        relativePath,
        parentRelative: relativePath.includes('/') ? relativePath.split('/').slice(0, -1).join('/') : '',
        size: file.size,
        lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null
    };
}
function transientFolderFromName(sourceId, name) {
    return {
        id: `${sourceId}:.`,
        sourceId,
        sourceType: 'local_folder',
        kind: 'folder',
        name,
        locator: name,
        absolutePath: name,
        relativePath: '.',
        folderName: name,
        parentTokens: [],
        depth: 0,
        extensions: [],
        fileCount: 0,
        fileNames: [],
        lastModified: null
    };
}
function planUsesAbsoluteFilesystemPath(path) {
    return path.startsWith('/') || /^[a-z]:[\\/]/i.test(path) || path.startsWith('\\\\');
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/product/src/lib/device-identity.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getBrowserComputerName",
    ()=>getBrowserComputerName,
    "isGenericDeviceName",
    ()=>isGenericDeviceName,
    "persistBrowserComputerName",
    ()=>persistBrowserComputerName,
    "upgradeGenericDeviceName",
    ()=>upgradeGenericDeviceName
]);
const GENERIC_DEVICE_NAME = /^(this mac|this pc|this computer|this browser|device|mac|pc|computer)$/i;
function isGenericDeviceName(name) {
    if (!name?.trim()) return true;
    return GENERIC_DEVICE_NAME.test(name.trim());
}
function browserKind() {
    if (typeof navigator === 'undefined') return 'Browser';
    const ua = navigator.userAgent;
    if (/Edg\//i.test(ua)) return 'Edge';
    if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return 'Chrome';
    if (/Firefox\//i.test(ua)) return 'Firefox';
    if (/Safari\//i.test(ua)) return 'Safari';
    return 'Browser';
}
function platformKind() {
    if (typeof navigator === 'undefined') return 'Device';
    const ua = navigator.userAgent;
    if (/Win/i.test(ua)) return 'Windows';
    if (/Mac/i.test(ua)) return 'Mac';
    if (/Linux/i.test(ua)) return 'Linux';
    return 'Device';
}
function getBrowserComputerName(storedName) {
    const custom = storedName?.trim();
    if (custom && !isGenericDeviceName(custom)) return custom;
    if (typeof localStorage !== 'undefined') {
        const persisted = localStorage.getItem('suhuella-browser-computer-name')?.trim();
        if (persisted && !isGenericDeviceName(persisted)) return persisted;
    }
    const platform = platformKind();
    if (platform === 'Mac') return `${browserKind()} on Mac`;
    if (platform === 'Windows') return `${browserKind()} on Windows`;
    if (platform === 'Linux') return `${browserKind()} on Linux`;
    return `${browserKind()} preview`;
}
function persistBrowserComputerName(name) {
    const trimmed = name.trim();
    if (!trimmed || typeof localStorage === 'undefined') return;
    localStorage.setItem('suhuella-browser-computer-name', trimmed);
}
function upgradeGenericDeviceName(name) {
    if (!isGenericDeviceName(name)) return name?.trim() ?? getBrowserComputerName();
    return getBrowserComputerName();
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/product/src/lib/device-metrics-view.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "assembleDeviceMetrics",
    ()=>assembleDeviceMetrics,
    "emptyDeviceMetrics",
    ()=>emptyDeviceMetrics
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$storage$2d$overview$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/lib/storage-overview.ts [app-client] (ecmascript)");
;
function appStorageMetrics(breakdown) {
    const totalBytes = breakdown.indexBytes + breakdown.activityBytes + breakdown.cacheBytes + breakdown.logsBytes + breakdown.workflowsBytes + breakdown.settingsBytes + breakdown.licenseBytes;
    return {
        ...breakdown,
        totalBytes
    };
}
function performanceFromPartial(partial) {
    const status = partial?.status ?? (partial?.memoryBytes != null || partial?.cpuPercent != null || partial?.startupMs != null || partial?.lastRecommendationMs != null || partial?.lastPlanExecutionMs != null || partial?.lastIndexingMs != null ? 'measured' : 'not_measured');
    return {
        memoryBytes: partial?.memoryBytes,
        cpuPercent: partial?.cpuPercent,
        startupMs: partial?.startupMs,
        lastRecommendationMs: partial?.lastRecommendationMs,
        lastPlanExecutionMs: partial?.lastPlanExecutionMs,
        lastIndexingMs: partial?.lastIndexingMs,
        lastPlanActions: partial?.lastPlanActions,
        status
    };
}
function assembleDeviceMetrics(input) {
    const knowledgeBytes = input.overview.knowledgeTotalBytes ?? undefined;
    return {
        host: input.host,
        platform: input.platform,
        deviceName: input.deviceName,
        measuredAt: input.overview.measuredAt ?? new Date().toISOString(),
        deviceStorage: input.deviceStorage,
        knowledgeStorage: {
            totalBytes: knowledgeBytes,
            documentCount: input.overview.knowledgeDocumentCount,
            folderCount: input.folderCount ?? 0,
            sourceCount: input.overview.sourceCount,
            status: input.overview.status
        },
        appStorage: appStorageMetrics(input.overview.appStorage),
        performance: performanceFromPartial(input.performance),
        sources: input.overview.sources,
        warnings: input.overview.warnings
    };
}
function emptyDeviceMetrics(host = 'desktop') {
    return assembleDeviceMetrics({
        host,
        platform: host === 'web' ? 'web' : 'darwin',
        deviceName: 'This computer',
        overview: {
            knowledgeTotalBytes: null,
            knowledgeDocumentCount: 0,
            sourceCount: 0,
            localBytes: null,
            cloudBytes: null,
            appStorageTotalBytes: 0,
            sources: [],
            appStorage: (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$storage$2d$overview$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["emptyAppStorage"])(),
            measuredAt: null,
            status: 'empty',
            warnings: []
        },
        deviceStorage: host === 'web' ? {
            status: 'unsupported'
        } : {
            status: 'unavailable'
        },
        performance: {
            status: 'not_measured'
        }
    });
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/product/src/lib/folders-ui.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CLOUD_SOURCES_LATER",
    ()=>CLOUD_SOURCES_LATER,
    "COMING_LATER_SOURCES",
    ()=>COMING_LATER_SOURCES,
    "FUTURE_SOURCES",
    ()=>FUTURE_SOURCES,
    "NETWORK_SOURCES_LATER",
    ()=>NETWORK_SOURCES_LATER,
    "WHY_FOLDER_STEPS",
    ()=>WHY_FOLDER_STEPS,
    "displayComputerName",
    ()=>displayComputerName,
    "formatDayLabel",
    ()=>formatDayLabel,
    "formatLastUpdated",
    ()=>formatLastUpdated,
    "formatLearnedAgo",
    ()=>formatLearnedAgo,
    "isHealthyStatus",
    ()=>isHealthyStatus,
    "learningStatusLabel",
    ()=>learningStatusLabel,
    "qualityLabel",
    ()=>qualityLabel,
    "statusLabel",
    ()=>statusLabel,
    "thisComputerLabel",
    ()=>thisComputerLabel,
    "usefulnessLabel",
    ()=>usefulnessLabel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$product$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/lib/product-copy.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$device$2d$identity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/lib/device-identity.ts [app-client] (ecmascript)");
;
function thisComputerLabel(platform) {
    if (platform === 'darwin') return 'This Mac';
    if (platform === 'win32') return 'This PC';
    return 'This computer';
}
;
function displayComputerName(options) {
    const licenseName = options.licenseName?.trim();
    if (licenseName && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$device$2d$identity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isGenericDeviceName"])(licenseName)) return licenseName;
    const osName = options.osName?.trim();
    if (osName && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$device$2d$identity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isGenericDeviceName"])(osName)) return osName;
    return thisComputerLabel(options.platform ?? 'darwin');
}
function formatLearnedAgo(iso) {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    const ms = Date.now() - date.getTime();
    if (ms < 45_000) return 'just now';
    if (ms < 3_600_000) return `${Math.max(1, Math.round(ms / 60_000))} min ago`;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date >= today) {
        const hours = Math.max(1, Math.round(ms / 3_600_000));
        return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    }
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date >= yesterday) return 'yesterday';
    const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
}
function formatLastUpdated(iso) {
    if (!iso) return 'Not yet';
    const date = new Date(iso);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date >= today) {
        return `Today ${date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        })}`;
    }
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date >= yesterday) return 'Yesterday';
    const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
}
function formatDayLabel(iso) {
    if (!iso) return 'Not yet';
    const date = new Date(iso);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date >= today) return 'Today';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date >= yesterday) return 'Yesterday';
    return date.toLocaleDateString();
}
function statusLabel(status) {
    switch(status){
        case 'indexing':
            return 'Indexing';
        case 'needs_refresh':
            return 'Needs refresh';
        case 'unavailable':
            return 'Unavailable';
        case 'permission_denied':
            return 'Needs permission';
        case 'external_drive_disconnected':
            return 'Drive disconnected';
        case 'cancelled':
            return 'Cancelled';
        case 'not_indexed':
            return 'Not ready yet';
        default:
            return 'Indexed';
    }
}
function usefulnessLabel(usefulness) {
    switch(usefulness){
        case 'very_useful':
            return 'Learning well';
        case 'useful':
            return 'Learning';
        case 'rarely_used':
            return 'Light learning';
        default:
            return 'Not learned yet';
    }
}
function qualityLabel(quality) {
    switch(quality){
        case 'excellent':
            return 'Excellent';
        case 'good':
            return 'Good';
        case 'learning':
            return 'Learning';
        default:
            return 'Needs more folders';
    }
}
function learningStatusLabel(quality, scanning) {
    if (scanning) return 'Learning in progress';
    if (!quality || quality === 'needs_more' || quality === 'learning') return 'Learning in progress';
    return 'Excellent';
}
function isHealthyStatus(status) {
    return status === 'ready' || status === 'needs_refresh' || status === 'indexing';
}
const COMING_LATER_SOURCES = [
    {
        id: 'google_drive',
        label: 'Google Drive'
    },
    {
        id: 'dropbox',
        label: 'Dropbox'
    },
    {
        id: 'onedrive',
        label: 'OneDrive'
    },
    {
        id: 'sharepoint',
        label: 'SharePoint'
    },
    {
        id: 'nas',
        label: 'NAS'
    },
    {
        id: 'outlook',
        label: 'Outlook'
    },
    {
        id: 'gmail',
        label: 'Gmail'
    }
];
const CLOUD_SOURCES_LATER = COMING_LATER_SOURCES.filter(_c = (source)=>[
        'google_drive',
        'dropbox',
        'onedrive',
        'gmail',
        'outlook'
    ].includes(source.id));
_c1 = CLOUD_SOURCES_LATER;
const NETWORK_SOURCES_LATER = COMING_LATER_SOURCES.filter(_c2 = (source)=>[
        'sharepoint',
        'nas'
    ].includes(source.id));
_c3 = NETWORK_SOURCES_LATER;
const FUTURE_SOURCES = COMING_LATER_SOURCES;
const WHY_FOLDER_STEPS = [
    {
        id: 'choose',
        label: 'You choose folders'
    },
    {
        id: 'learn',
        label: (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$product$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["productCopy"])('SuHuella learns')
    },
    {
        id: 'document',
        label: 'New document'
    },
    {
        id: 'recommend',
        label: 'Recommendation'
    },
    {
        id: 'control',
        label: 'You stay in control'
    }
];
var _c, _c1, _c2, _c3;
__turbopack_context__.k.register(_c, "CLOUD_SOURCES_LATER$COMING_LATER_SOURCES.filter");
__turbopack_context__.k.register(_c1, "CLOUD_SOURCES_LATER");
__turbopack_context__.k.register(_c2, "NETWORK_SOURCES_LATER$COMING_LATER_SOURCES.filter");
__turbopack_context__.k.register(_c3, "NETWORK_SOURCES_LATER");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/product/src/lib/host-action-copy.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "HOST_ACTION_COPY",
    ()=>HOST_ACTION_COPY,
    "HostCapabilityError",
    ()=>HostCapabilityError,
    "isHostCapabilityError",
    ()=>isHostCapabilityError
]);
const HOST_ACTION_COPY = {
    openFileDesktopOnly: 'Open the desktop app to open this document.',
    revealUnavailable: 'Open the desktop app to show this folder.',
    openFolderUnavailable: 'Open the desktop app to show this folder.',
    chooseFilesUnsupported: 'This browser cannot choose documents.',
    exportUnavailable: 'Export is not available on this platform.',
    launchAtLoginUnavailable: 'Open the desktop app to launch at sign-in.',
    saveAsPreviewOnly: 'This is a preview. Nothing was saved, and Activity does not record it.',
    saveAsPrepared: 'The recommended folder is ready. Press Save in the other app. Activity records confirmed Plans, not Save As.',
    fileCouldNotOpen: 'That document could not be opened.',
    folderCouldNotReveal: 'That folder could not be shown.'
};
class HostCapabilityError extends Error {
    code = 'unavailable';
    constructor(message){
        super(message);
        this.name = 'HostCapabilityError';
    }
}
function isHostCapabilityError(error) {
    return error instanceof HostCapabilityError || error instanceof Error && error.name === 'HostCapabilityError';
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/product/src/lib/license-plans.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ACTIVATION_ATTEMPT_STORAGE_KEY",
    ()=>ACTIVATION_ATTEMPT_STORAGE_KEY,
    "PERSONAL_DEVICE_LIMIT",
    ()=>PERSONAL_DEVICE_LIMIT,
    "checkoutPath",
    ()=>checkoutPath,
    "commercialPlanCards",
    ()=>commercialPlanCards,
    "isCheckoutPlan",
    ()=>isCheckoutPlan,
    "isCheckoutReturnTo",
    ()=>isCheckoutReturnTo,
    "unavailablePlanMessage",
    ()=>unavailablePlanMessage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f2e$build$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/brands/.build/entry.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/brands/suhuella/entry.ts [app-client] (ecmascript) <locals>");
;
const PERSONAL_DEVICE_LIMIT = 3;
function isCheckoutPlan(value) {
    return value === 'lifetime' || value === 'monthly' || value === 'business';
}
function isCheckoutReturnTo(value) {
    return value === 'settings' || value === 'desktop' || value === 'public';
}
function commercialPlanCards(kind = 'free', surface = 'settings') {
    const devices = `Up to ${PERSONAL_DEVICE_LIMIT} devices.`;
    return [
        {
            id: 'free',
            title: 'Free',
            summary: 'Everything stays on your device. No account needed.',
            cta: surface === 'public' ? `Open ${__TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["brand"].displayName}` : null,
            current: surface === 'settings' && kind === 'free'
        },
        {
            id: 'lifetime',
            title: 'Personal Lifetime',
            summary: `One-time payment. Personal use. ${devices}`,
            cta: 'Buy once',
            current: kind === 'personal_lifetime'
        },
        {
            id: 'monthly',
            title: 'Personal Monthly',
            summary: `Monthly subscription. Personal use. ${devices}`,
            cta: 'Subscribe',
            current: kind === 'personal_monthly'
        },
        {
            id: 'business',
            title: 'Business',
            summary: 'Team seats. Managed organisation.',
            cta: 'Contact sales',
            current: kind === 'business'
        }
    ];
}
function unavailablePlanMessage(plan) {
    if (plan === 'lifetime') return 'Lifetime is not available yet.';
    if (plan === 'monthly') return 'Monthly is not available yet.';
    return 'This plan is not available yet.';
}
function checkoutPath(plan, options = {}) {
    const params = new URLSearchParams();
    if (options.email?.trim()) params.set('email', options.email.trim());
    if (options.platform?.trim()) params.set('platform', options.platform.trim());
    if (options.returnTo) params.set('return', options.returnTo);
    if (options.activationAttemptId?.trim()) params.set('attempt', options.activationAttemptId.trim());
    const query = params.toString();
    return query ? `/checkout/${plan}?${query}` : `/checkout/${plan}`;
}
const ACTIVATION_ATTEMPT_STORAGE_KEY = 'suhuella_activation_attempt_id';
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/product/src/lib/license-status.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "activationSuccessMessage",
    ()=>activationSuccessMessage,
    "identityLicenseLine",
    ()=>identityLicenseLine,
    "licenseErrorMessage",
    ()=>licenseErrorMessage,
    "offlineNote",
    ()=>offlineNote,
    "toLicenseStatusView",
    ()=>toLicenseStatusView
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f2e$build$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/brands/.build/entry.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/brands/suhuella/entry.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$license$2d$plans$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/lib/license-plans.ts [app-client] (ecmascript)");
;
;
const OFFLINE_NOTE = `${__TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["brand"].displayName} can keep working offline for a limited time.`;
function licenseErrorMessage(error) {
    if (error === 'unknown_email' || error === 'no_license') {
        return 'No active license was found for this email.';
    }
    if (error === 'device_limit') {
        return `This Personal license allows ${__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$license$2d$plans$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PERSONAL_DEVICE_LIMIT"]} devices. Deactivate another computer, then activate this one.`;
    }
    if (error === 'payment_incomplete') return 'Payment was not completed.';
    if (error === 'revoked') return 'This complimentary license is no longer active.';
    if (error === 'expired') return 'This subscription is no longer active.';
    if (error === 'not_activated') return 'This computer is not on your license';
    if (error === 'email_verification_required') {
        return 'Verify your purchase email with the code we send you, then activate again.';
    }
    if (error === 'invalid_proof' || error === 'invalid_attempt') {
        return 'That verification expired. Request a new code and try again.';
    }
    if (error === 'invalid_code') {
        return 'That code is incorrect. Try again or request a new one.';
    }
    if (error === 'rate_limited') return 'Too many attempts. Wait a few minutes, then try again.';
    if (error === 'service_unavailable') {
        return 'Some online functions are temporarily unavailable. Your local files are unaffected.';
    }
    if (error === 'offline') return OFFLINE_NOTE;
    return "We couldn't update your license. Try again later or contact support.";
}
function activationSuccessMessage() {
    return 'License active';
}
function identityLicenseLine(license) {
    if (!license) return 'Checking license…';
    if (license.needsAttention) return 'License needs attention';
    if (license.kind === 'free') return 'Free · Activate license';
    if (license.kind === 'personal_lifetime') return 'Personal Lifetime · Activated';
    if (license.kind === 'personal_monthly') return 'Personal Monthly · Activated';
    if (license.kind === 'business') return 'Business · Managed by organisation';
    return license.editionLabel?.trim() || 'License';
}
function formatPeriodDate(iso) {
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime())) return 'Unknown';
    return date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}
function formatRelativeDay(iso, now) {
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime())) return 'Unknown';
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000);
    if (diffDays <= 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long'
    });
}
function editionLabelFor(edition) {
    if (edition === 'personal_lifetime') return 'Personal Lifetime';
    if (edition === 'personal_monthly') return 'Personal Monthly';
    if (edition === 'enterprise') return 'Enterprise';
    if (edition === 'business') return 'Business';
    return 'Free';
}
function roleLabelFor(role) {
    if (role === 'owner') return 'Owner';
    if (role === 'admin') return 'Administrator';
    if (role === 'member') return 'Member';
    return null;
}
function headlineFor(kind, edition) {
    if (kind === 'needs_attention') {
        return edition === 'personal_monthly' ? 'Your subscription has ended.' : 'License needs attention';
    }
    if (kind === 'personal_lifetime') return 'Personal Lifetime';
    if (kind === 'personal_monthly') return 'Personal Monthly';
    if (kind === 'business') {
        return edition === 'enterprise' ? 'Enterprise' : 'Business';
    }
    return 'Free';
}
function detailFor(context, kind, needsAttention) {
    if (kind === 'needs_attention' || needsAttention) {
        if (context.status === 'revoked') return 'This complimentary license is no longer active.';
        if (context.edition === 'personal_monthly' || context.status === 'expired') {
            return 'Reactivate to continue using paid features.';
        }
        return 'Refresh your license or contact support.';
    }
    if (context.edition === 'free') return 'Everything stays on this device. No account needed.';
    if (context.edition === 'personal_lifetime') return 'Activated';
    if (context.edition === 'personal_monthly' && context.validUntil) {
        return `Active until ${formatPeriodDate(context.validUntil)}`;
    }
    if (context.edition === 'business' || context.edition === 'enterprise') {
        return context.organisationName ? `Managed by ${context.organisationName}` : 'Managed by your organisation';
    }
    return 'This computer is using your license.';
}
function kindFor(context, needsAttention) {
    if (needsAttention) return 'needs_attention';
    if (context.edition === 'personal_lifetime') return 'personal_lifetime';
    if (context.edition === 'personal_monthly') return 'personal_monthly';
    if (context.edition === 'business' || context.edition === 'enterprise') return 'business';
    return 'free';
}
function graceHasEnded(context, now) {
    if (context.edition === 'free') return false;
    const offlineUntil = Date.parse(context.offlineUntil);
    return Number.isFinite(offlineUntil) && offlineUntil < now;
}
function productStateFor(context, options) {
    if (options.needsAttention) {
        return context.status === 'expired' || graceHasEnded(context, Date.now()) ? 'expired' : 'needs_attention';
    }
    if (!options.paid) return 'activation_required';
    if (options.workingOffline) return 'offline';
    return 'ready';
}
function identityTitleFor(context, options) {
    if (options.productState === 'needs_attention' || options.productState === 'expired') {
        return 'License needs attention';
    }
    if (context.organisationName) {
        const role = options.roleLabel ? ` · ${options.roleLabel}` : '';
        return `${context.organisationName} · ${options.editionLabel}${role} · ${options.computerName} · Ready`;
    }
    if (context.edition === 'free') {
        return `${__TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["brand"].displayName} · ${options.computerName}`;
    }
    return `${options.editionLabel} · ${options.computerName} · Ready`;
}
function buildHealth(options) {
    return [
        {
            id: 'save_as',
            label: 'Save As Assistant',
            status: options.saveAsActive ? 'ok' : 'unknown'
        },
        {
            id: 'learning',
            label: 'Learning',
            status: options.learningOk ? 'ok' : 'attention'
        },
        {
            id: 'licence',
            label: 'License',
            status: options.licenceOk ? 'ok' : 'attention'
        },
        {
            id: 'updates',
            label: 'Updates',
            status: 'ok'
        }
    ];
}
function toLicenseStatusView(context, options = {}) {
    const now = options.now ?? Date.now();
    const paid = context.edition !== 'free';
    const expired = context.status === 'expired' || context.status === 'revoked';
    const needsAttention = paid && (expired || graceHasEnded(context, now));
    const workingOffline = Boolean(paid && options.lastSeenOffline && !needsAttention);
    const kind = kindFor(context, needsAttention);
    const editionLabel = editionLabelFor(context.edition);
    const roleLabel = roleLabelFor(context.memberRole);
    const computerName = options.computerName?.trim() || 'This computer';
    const productState = productStateFor(context, {
        needsAttention,
        workingOffline,
        paid
    });
    const identityTitle = identityTitleFor(context, {
        editionLabel,
        roleLabel,
        computerName,
        productState
    });
    const devices = (options.devices ?? []).map((device, index)=>({
            index,
            name: device.name,
            platform: device.platform,
            lastSeenLabel: formatRelativeDay(device.lastSeen, now),
            current: device.current
        }));
    if (paid && devices.length === 0) {
        devices.push({
            index: 0,
            name: computerName,
            platform: '',
            lastSeenLabel: formatRelativeDay(context.lastCheckedAt, now),
            current: true
        });
    }
    const lastCheckedLabel = formatRelativeDay(context.lastCheckedAt, now);
    const offlineUntilLabel = paid && context.offlineUntil ? formatRelativeDay(context.offlineUntil, now) : null;
    return {
        kind,
        productState,
        identityTitle,
        editionLabel,
        roleLabel,
        computerName,
        headline: headlineFor(kind, context.edition),
        detail: detailFor(context, kind, needsAttention),
        email: paid || needsAttention ? context.email : '',
        organisationName: kind === 'business' || needsAttention && Boolean(context.organisationName) ? context.organisationName ?? null : null,
        organisationId: kind === 'business' ? context.organisationId ?? null : null,
        organisationLogo: kind === 'business' && context.status === 'active' ? context.organisationLogo ?? null : null,
        canEditBranding: kind === 'business' && context.memberRole === 'owner' && !needsAttention && context.status === 'active',
        deviceCount: paid ? context.activatedDevices : null,
        deviceLimit: paid ? context.deviceLimit : null,
        devices,
        workingOffline,
        needsAttention,
        lastCheckedLabel,
        offlineUntilLabel,
        periodEndLabel: context.edition === 'personal_monthly' && context.validUntil ? formatPeriodDate(context.validUntil) : null,
        supportCode: paid ? context.licenseId : null,
        health: buildHealth({
            saveAsActive: options.saveAsActive ?? false,
            learningOk: options.learningOk ?? true,
            licenceOk: !needsAttention
        })
    };
}
function offlineNote() {
    return OFFLINE_NOTE;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/product/src/lib/product-copy.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "productCopy",
    ()=>productCopy,
    "productName",
    ()=>productName
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f2e$build$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/brands/.build/entry.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/brands/suhuella/entry.ts [app-client] (ecmascript) <locals>");
;
function productCopy(text) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["applyBrandPresentation"])(text);
}
function productName() {
    return __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["brand"].displayName;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/product/src/lib/recognised-names.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "recognisedFromNames",
    ()=>recognisedFromNames,
    "uniqueNameCount",
    ()=>uniqueNameCount
]);
const RECOGNISED_HINTS = [
    {
        label: 'Invoices',
        hints: [
            'invoice',
            'invoices',
            'factura',
            'facturas',
            'factures'
        ]
    },
    {
        label: 'Contracts',
        hints: [
            'contract',
            'contracts',
            'contrato',
            'contratos',
            'contracte',
            'contractes'
        ]
    },
    {
        label: 'Budgets',
        hints: [
            'budget',
            'budgets',
            'presupuesto',
            'presupuestos',
            'pressupost'
        ]
    },
    {
        label: 'Projects',
        hints: [
            'project',
            'projects',
            'proyecto',
            'proyectos',
            'projecte',
            'projectes'
        ]
    },
    {
        label: 'Reports',
        hints: [
            'report',
            'reports',
            'informe',
            'informes'
        ]
    },
    {
        label: 'Photos',
        hints: [
            'photo',
            'photos',
            'image',
            'images',
            'foto',
            'fotos'
        ]
    }
];
const PHOTO_EXTENSIONS = [
    'jpg',
    'jpeg',
    'png',
    'heic',
    'webp',
    'gif'
];
function recognisedFromNames(names, extensions) {
    const haystack = names.join(' ').toLowerCase();
    const found = RECOGNISED_HINTS.filter((item)=>item.hints.some((hint)=>haystack.includes(hint))).map((item)=>item.label);
    const hasPhotos = found.includes('Photos') || extensions.some((extension)=>PHOTO_EXTENSIONS.includes(extension.toLowerCase()));
    return hasPhotos && !found.includes('Photos') ? [
        ...found,
        'Photos'
    ] : found;
}
function uniqueNameCount(names) {
    return new Set(names.map((name)=>name.trim().toLowerCase()).filter(Boolean)).size;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/product/src/lib/service-health.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "NORMAL_SERVICE_HEALTH",
    ()=>NORMAL_SERVICE_HEALTH,
    "SERVICE_CAPABILITIES",
    ()=>SERVICE_CAPABILITIES,
    "SERVICE_STATES",
    ()=>SERVICE_STATES,
    "fetchPublicServiceHealth",
    ()=>fetchPublicServiceHealth,
    "isServiceCapabilityLimited",
    ()=>isServiceCapabilityLimited,
    "parseServiceHealth",
    ()=>parseServiceHealth,
    "serviceHealthCopy",
    ()=>serviceHealthCopy
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f2e$build$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/brands/.build/entry.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/brands/suhuella/entry.ts [app-client] (ecmascript) <locals>");
;
const SERVICE_STATES = [
    'NORMAL',
    'DEGRADED',
    'WEB_CAPACITY_LIMITED'
];
const SERVICE_CAPABILITIES = [
    'license-check',
    'license-activation',
    'license-recovery',
    'checkout',
    'business-branding',
    'release-manifest',
    'remote-analysis',
    'connectors'
];
const NORMAL_SERVICE_HEALTH = {
    serviceState: 'NORMAL',
    affectedCapabilities: [],
    retryAfter: null
};
function isServiceCapabilityLimited(health, capability) {
    if (!health || health.serviceState === 'NORMAL') return false;
    return health.affectedCapabilities.includes(capability);
}
function serviceHealthCopy(health, host) {
    if (health.serviceState === 'WEB_CAPACITY_LIMITED') {
        return {
            title: `${__TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["brand"].displayName} Web is temporarily at capacity`,
            body: 'To keep the service responsive, new browser sessions are temporarily limited.',
            hint: host === 'browser' ? `You can continue in the ${__TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["brand"].displayName} desktop app.` : 'Your local files are unaffected.'
        };
    }
    return {
        title: `${__TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["brand"].displayName} Web is busier than usual`,
        body: 'Some online functions are temporarily unavailable. Your local files are unaffected.',
        hint: host === 'browser' ? `You can continue working in the ${__TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["brand"].displayName} desktop app.` : null
    };
}
function parseServiceHealth(value) {
    if (!value || typeof value !== 'object') return null;
    const record = value;
    const serviceState = record.serviceState;
    if (serviceState !== 'NORMAL' && serviceState !== 'DEGRADED' && serviceState !== 'WEB_CAPACITY_LIMITED') {
        return null;
    }
    const affected = Array.isArray(record.affectedCapabilities) ? record.affectedCapabilities.filter((item)=>typeof item === 'string' && SERVICE_CAPABILITIES.includes(item)) : [];
    return {
        serviceState,
        affectedCapabilities: affected,
        retryAfter: typeof record.retryAfter === 'number' && Number.isFinite(record.retryAfter) ? record.retryAfter : null
    };
}
async function fetchPublicServiceHealth(baseUrl = '') {
    try {
        const response = await fetch(`${baseUrl}/api/service-health`, {
            cache: 'no-store'
        });
        if (!response.ok) return NORMAL_SERVICE_HEALTH;
        const parsed = parseServiceHealth(await response.json());
        return parsed ?? NORMAL_SERVICE_HEALTH;
    } catch  {
        return NORMAL_SERVICE_HEALTH;
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/product/src/lib/source-appearance.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CORPORATE_COLORS",
    ()=>CORPORATE_COLORS,
    "CUSTOMIZABLE_ICONS",
    ()=>CUSTOMIZABLE_ICONS,
    "SOURCE_TONE_CLASSES",
    ()=>SOURCE_TONE_CLASSES,
    "SOURCE_TONE_DOT_COLORS",
    ()=>SOURCE_TONE_DOT_COLORS,
    "canPersistSourceAppearanceColor",
    ()=>canPersistSourceAppearanceColor,
    "corporateColors",
    ()=>corporateColors,
    "defaultSourceAppearance",
    ()=>defaultSourceAppearance,
    "isCorporateColor",
    ()=>isCorporateColor,
    "isCustomizableIconId",
    ()=>isCustomizableIconId,
    "matchWellKnownSource",
    ()=>matchWellKnownSource,
    "normalizeSourceAppearanceStore",
    ()=>normalizeSourceAppearanceStore,
    "normalizeSourceKey",
    ()=>normalizeSourceKey,
    "resolveRecentSourceAppearance",
    ()=>resolveRecentSourceAppearance,
    "resolveSourceAppearance",
    ()=>resolveSourceAppearance,
    "resolveSourceIdentity",
    ()=>resolveSourceIdentity,
    "sourceAppearanceActiveSwatch",
    ()=>sourceAppearanceActiveSwatch,
    "sourceAppearanceDotColor",
    ()=>sourceAppearanceDotColor,
    "sourceAppearancePolicy",
    ()=>sourceAppearancePolicy,
    "sourceAppearanceSwatchSelected",
    ()=>sourceAppearanceSwatchSelected,
    "sourceLabelFromPath",
    ()=>sourceLabelFromPath
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f2e$build$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/brands/.build/entry.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/brands/suhuella/entry.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$well$2d$known$2d$sources$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/lib/well-known-sources.ts [app-client] (ecmascript)");
;
;
const CORPORATE_PALETTE_TAIL = [
    '#5856D6',
    '#5AC8FA',
    '#34C759',
    '#FF9500',
    '#AF52DE',
    '#FF2D55',
    '#8E8E93'
];
function corporateColors() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["brand"].theme.accent.toUpperCase(),
        ...CORPORATE_PALETTE_TAIL
    ];
}
const CORPORATE_COLORS = corporateColors();
const CUSTOMIZABLE_ICONS = [
    'folder',
    'documents',
    'downloads',
    'pictures',
    'movies',
    'music',
    'shared',
    'applications',
    'developer',
    'icloud'
];
const SOURCE_TONE_DOT_COLORS = {
    slate: '#8E8E93',
    blue: '#3B82F6',
    indigo: '#6366F1',
    rose: '#F43F5E',
    orange: '#F97316',
    violet: '#8B5CF6',
    sky: '#0EA5E9',
    teal: '#14B8A6'
};
function sourceAppearanceDotColor(appearance) {
    return appearance.color ?? SOURCE_TONE_DOT_COLORS[appearance.tone];
}
/** Corporate swatch that reflects the source's current color (custom or tone default). */ const TONE_SWATCH = {
    slate: '#8E8E93',
    blue: corporateColors()[0],
    indigo: '#5856D6',
    rose: '#FF2D55',
    orange: '#FF9500',
    violet: '#AF52DE',
    sky: '#5AC8FA',
    teal: '#34C759'
};
function sourceAppearanceActiveSwatch(appearance) {
    if (appearance.color) return appearance.color.trim().toUpperCase();
    const toneColor = SOURCE_TONE_DOT_COLORS[appearance.tone].toUpperCase();
    const paletteMatch = CORPORATE_COLORS.find((color)=>color.toUpperCase() === toneColor);
    return (paletteMatch ?? TONE_SWATCH[appearance.tone]).toUpperCase();
}
function sourceAppearanceSwatchSelected(appearance, swatch) {
    return sourceAppearanceActiveSwatch(appearance) === swatch.trim().toUpperCase();
}
function isCustomizableIconId(iconId) {
    return CUSTOMIZABLE_ICONS.includes(iconId);
}
const SOURCE_TONE_CLASSES = {
    slate: 'from-[var(--sidebar-line)] to-transparent text-[var(--app-fg)] opacity-80',
    blue: 'from-blue-500/10 to-transparent text-blue-500',
    indigo: 'from-indigo-500/10 to-transparent text-indigo-500',
    rose: 'from-rose-500/10 to-transparent text-rose-500',
    orange: 'from-orange-500/10 to-transparent text-orange-500',
    violet: 'from-violet-500/10 to-transparent text-violet-500',
    sky: 'from-sky-500/10 to-transparent text-sky-500',
    teal: 'from-teal-500/10 to-transparent text-teal-500'
};
const WELL_KNOWN_ICON = {
    desktop: 'folder',
    documents: 'documents',
    downloads: 'downloads',
    pictures: 'pictures',
    movies: 'movies',
    videos: 'movies',
    music: 'music',
    shared: 'shared',
    developer: 'developer',
    applications: 'applications',
    icloud: 'icloud',
    dropbox: 'dropbox',
    onedrive: 'onedrive',
    google_drive: 'google_drive',
    external: 'volume',
    usb: 'usb',
    nas: 'volume'
};
const WELL_KNOWN_TONE = {
    desktop: 'slate',
    documents: 'blue',
    downloads: 'indigo',
    pictures: 'rose',
    movies: 'orange',
    videos: 'orange',
    music: 'violet',
    shared: 'teal',
    developer: 'slate',
    applications: 'slate',
    icloud: 'sky',
    dropbox: 'blue',
    onedrive: 'sky',
    google_drive: 'blue',
    external: 'violet',
    usb: 'violet',
    nas: 'violet'
};
function normalizeSourceKey(path) {
    return path.trim().replace(/\\/g, '/').toLowerCase();
}
const WELL_KNOWN_LEAF_ALIASES = {
    desktop: 'desktop',
    escritorio: 'desktop',
    documents: 'documents',
    documentos: 'documents',
    downloads: 'downloads',
    descargas: 'downloads',
    pictures: 'pictures',
    photos: 'pictures',
    imágenes: 'pictures',
    imagenes: 'pictures',
    movies: 'movies',
    películas: 'movies',
    peliculas: 'movies',
    videos: 'videos',
    music: 'music',
    música: 'music',
    musica: 'music',
    shared: 'shared',
    compartido: 'shared',
    developer: 'developer',
    applications: 'applications',
    aplicaciones: 'applications'
};
function normalizeLeafToken(value) {
    return value.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}
function catalogById(catalog, id) {
    return catalog.find((source)=>source.id === id) ?? null;
}
function isExternalVolumePath(path) {
    const normalized = path.replace(/\\/g, '/');
    const lower = normalized.toLowerCase();
    if (lower.includes('/system/volumes/')) return false;
    if (/\/volumes\/[^/]+/i.test(normalized) && !/users|documents and settings/i.test(lower)) {
        return true;
    }
    return /^[a-z]:\\/i.test(normalized) && !/users|documents and settings/i.test(lower);
}
function matchWellKnownSource(name, path, platform = 'darwin') {
    const catalog = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$well$2d$known$2d$sources$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["wellKnownSources"])(platform);
    const byLabel = catalog.find((source)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$well$2d$known$2d$sources$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sameSourceName"])(source.label, name) || (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$well$2d$known$2d$sources$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sameSourceName"])(source.id, name));
    if (byLabel) return byLabel;
    const token = path.includes(':') && !path.includes('/') ? normalizeLeafToken(path.split(':').pop() ?? path) : normalizeLeafToken(sourceLabelFromPath(path));
    const leafId = WELL_KNOWN_LEAF_ALIASES[token];
    if (leafId) {
        const byLeaf = catalogById(catalog, leafId);
        if (byLeaf) return byLeaf;
    }
    const text = `${name} ${path}`.toLowerCase();
    if (/icloud|clouddocs|mobile documents/i.test(text)) {
        return catalogById(catalog, 'icloud');
    }
    if (/dropbox/i.test(text)) return catalogById(catalog, 'dropbox');
    if (/onedrive|one drive/i.test(text)) return catalogById(catalog, 'onedrive');
    if (/google drive|google-drive|googledrive/i.test(text)) {
        return catalogById(catalog, 'google_drive');
    }
    if (isExternalVolumePath(path)) {
        if (/usb/i.test(text)) return catalogById(catalog, 'usb');
        if (/nas/i.test(text)) return catalogById(catalog, 'nas');
        return catalogById(catalog, 'external');
    }
    return null;
}
function appearanceFromWellKnown(source) {
    return {
        iconId: WELL_KNOWN_ICON[source.id] ?? 'folder',
        tone: WELL_KNOWN_TONE[source.id] ?? 'slate',
        group: source.group
    };
}
function sourceAppearancePolicy(group) {
    if (group === 'computer' || group === 'other') return {
        customizable: true
    };
    return {
        customizable: false
    };
}
function defaultSourceAppearance(name, path, kind, platform = 'darwin') {
    const known = matchWellKnownSource(name, path, platform);
    if (known) {
        return {
            ...appearanceFromWellKnown(known),
            color: null,
            ...sourceAppearancePolicy(known.group)
        };
    }
    if (kind === 'volume' || /ssd|usb|nas|volume/.test(name.toLowerCase())) {
        if (/usb/.test(name.toLowerCase())) {
            return {
                iconId: 'usb',
                tone: 'violet',
                color: null,
                group: 'external',
                customizable: false
            };
        }
        return {
            iconId: 'volume',
            tone: 'violet',
            color: null,
            group: 'external',
            customizable: false
        };
    }
    return {
        iconId: 'folder',
        tone: 'slate',
        color: null,
        group: 'other',
        ...sourceAppearancePolicy('other')
    };
}
function resolveSourceAppearance(path, name, kind, overrides, platform = 'darwin') {
    const defaults = defaultSourceAppearance(name, path, kind, platform);
    if (!defaults.customizable) return defaults;
    const override = overrides?.[normalizeSourceKey(path)];
    if (!override) return defaults;
    return {
        ...defaults,
        ...override.color ? {
            color: override.color
        } : {},
        ...override.iconId && isCustomizableIconId(override.iconId) ? {
            iconId: override.iconId
        } : {}
    };
}
function resolveRecentSourceAppearance(path, options = {}) {
    const platform = options.platform ?? 'darwin';
    const normalized = normalizeSourceKey(path);
    const leaf = sourceLabelFromPath(path);
    const catalogMatch = options.indexed?.find((item)=>normalizeSourceKey(item.path) === normalized) ?? options.suggested?.find((item)=>normalizeSourceKey(item.path) === normalized) ?? options.indexed?.find((item)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$well$2d$known$2d$sources$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sameSourceName"])(item.label, leaf)) ?? options.suggested?.find((item)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$well$2d$known$2d$sources$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sameSourceName"])(item.label, leaf));
    if (catalogMatch) {
        return resolveSourceAppearance(catalogMatch.path, catalogMatch.label, catalogMatch.kind, options.overrides, platform);
    }
    const identity = resolveSourceIdentity(path, platform);
    return resolveSourceAppearance(path, identity.name, identity.kind, options.overrides, platform);
}
function isCorporateColor(color) {
    const normalized = color.trim().toUpperCase();
    return corporateColors().some((entry)=>entry.toUpperCase() === normalized);
}
function sourceLabelFromPath(path) {
    if (path.includes(':') && !path.includes('/')) {
        const token = path.split(':').pop() ?? path;
        return token.replace(/-/g, ' ').replace(/\b\w/g, (char)=>char.toUpperCase());
    }
    const parts = path.split(/[/\\]/).filter(Boolean);
    return parts.at(-1) ?? path;
}
function resolveSourceIdentity(path, platform = 'darwin') {
    const catalog = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$well$2d$known$2d$sources$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["wellKnownSources"])(platform);
    const tokenMatch = catalog.find((source)=>source.token.toLowerCase() === path.toLowerCase());
    if (tokenMatch) return {
        name: tokenMatch.label,
        kind: tokenMatch.kind
    };
    return {
        name: sourceLabelFromPath(path)
    };
}
function canPersistSourceAppearanceColor(path, platform = 'darwin', hints) {
    const identity = resolveSourceIdentity(path, platform);
    const name = hints?.name ?? identity.name;
    const kind = hints?.kind ?? identity.kind;
    return defaultSourceAppearance(name, path, kind, platform).customizable;
}
function normalizeSourceAppearanceStore(value, platform = 'darwin') {
    if (!value || typeof value !== 'object') return {};
    const next = {};
    for (const [key, raw] of Object.entries(value)){
        if (!raw || typeof raw !== 'object') continue;
        const color = 'color' in raw && typeof raw.color === 'string' && isCorporateColor(raw.color) ? raw.color : undefined;
        const iconId = 'iconId' in raw && typeof raw.iconId === 'string' && isCustomizableIconId(raw.iconId) ? raw.iconId : undefined;
        if (!color && !iconId) continue;
        const normalizedKey = normalizeSourceKey(key);
        if (!canPersistSourceAppearanceColor(normalizedKey, platform)) continue;
        next[normalizedKey] = {
            ...color ? {
                color
            } : {},
            ...iconId ? {
                iconId
            } : {}
        };
    }
    return next;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/product/src/lib/source-browse.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "browseParentPath",
    ()=>browseParentPath,
    "formatBrowseDate",
    ()=>formatBrowseDate,
    "isBrowsePathUnder",
    ()=>isBrowsePathUnder,
    "isDirectBrowseChild",
    ()=>isDirectBrowseChild,
    "normalizeBrowsePath",
    ()=>normalizeBrowsePath,
    "resolveBrowseRoot",
    ()=>resolveBrowseRoot,
    "sourceBrowseKindLabel",
    ()=>sourceBrowseKindLabel
]);
function normalizeBrowsePath(value) {
    return value.trim().replace(/\\/g, '/').replace(/\/+$/, '');
}
function browseParentPath(value) {
    const normalized = normalizeBrowsePath(value);
    if (!normalized || !normalized.includes('/')) return null;
    return normalized.slice(0, normalized.lastIndexOf('/')) || null;
}
function isBrowsePathUnder(root, candidate) {
    const parent = normalizeBrowsePath(root).toLowerCase();
    const child = normalizeBrowsePath(candidate).toLowerCase();
    return child === parent || child.startsWith(`${parent}/`);
}
function resolveBrowseRoot(folderPath, roots) {
    const normalized = normalizeBrowsePath(folderPath).toLowerCase();
    let best = null;
    for (const root of roots){
        const candidate = normalizeBrowsePath(root.path);
        const lower = candidate.toLowerCase();
        if (normalized === lower || normalized.startsWith(`${lower}/`)) {
            if (!best || candidate.length > best.length) best = candidate;
        }
    }
    return best ?? normalizeBrowsePath(folderPath);
}
function isDirectBrowseChild(root, candidate) {
    const parent = normalizeBrowsePath(root).toLowerCase();
    const child = normalizeBrowsePath(candidate).toLowerCase();
    if (!child.startsWith(`${parent}/`)) return false;
    return !child.slice(parent.length + 1).includes('/');
}
function sourceBrowseKindLabel(entry) {
    if (entry.kind === 'folder') return 'Folder';
    const ext = (entry.extension ?? entry.name.split('.').pop() ?? '').toLowerCase();
    if (ext === 'pdf') return 'PDF';
    if (ext === 'doc' || ext === 'docx') return 'Word';
    if (ext === 'xls' || ext === 'xlsx') return 'Excel';
    if (ext === 'ppt' || ext === 'pptx') return 'PowerPoint';
    if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif' || ext === 'webp' || ext === 'heic') {
        return 'Image';
    }
    if (ext === 'zip' || ext === 'rar' || ext === '7z') return 'Archive';
    if (ext === 'mp3' || ext === 'wav' || ext === 'aac' || ext === 'm4a') return 'Audio';
    if (ext === 'mp4' || ext === 'mov' || ext === 'mkv') return 'Movie';
    if (ext === 'txt' || ext === 'md') return 'Plain Text';
    if (ext) return ext.toUpperCase();
    return 'Document';
}
function formatBrowseDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/product/src/lib/sources-ui.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SOURCES_PRIVACY_LINES",
    ()=>SOURCES_PRIVACY_LINES,
    "browserBlockedFolderDialogCopy",
    ()=>browserBlockedFolderDialogCopy,
    "browserCapabilityCatalog",
    ()=>browserCapabilityCatalog,
    "browserChooseSubfolderLabel",
    ()=>browserChooseSubfolderLabel,
    "browserCloudComingLaterCopy",
    ()=>browserCloudComingLaterCopy,
    "browserConnectDialogCopy",
    ()=>browserConnectDialogCopy,
    "browserConnectFolderHint",
    ()=>browserConnectFolderHint,
    "browserConnectFolderLabel",
    ()=>browserConnectFolderLabel,
    "browserConnectFolderNote",
    ()=>browserConnectFolderNote,
    "browserIntegrationsActionLabel",
    ()=>browserIntegrationsActionLabel,
    "browserLocalFoldersLabel",
    ()=>browserLocalFoldersLabel,
    "browserSystemFolderHint",
    ()=>browserSystemFolderHint,
    "browserSystemFoldersLabel",
    ()=>browserSystemFoldersLabel,
    "folderConnectErrorMessage",
    ()=>folderConnectErrorMessage,
    "formatDocumentCount",
    ()=>formatDocumentCount,
    "includedStatusLabel",
    ()=>includedStatusLabel,
    "isFolderPickAbort",
    ()=>isFolderPickAbort,
    "isProtectedFolderConnectError",
    ()=>isProtectedFolderConnectError,
    "lastUpdatedCopy",
    ()=>lastUpdatedCopy,
    "sourceAnotherFolderLabel",
    ()=>sourceAnotherFolderLabel,
    "sourceDisplayName",
    ()=>sourceDisplayName,
    "sourceGrantActionLabel",
    ()=>sourceGrantActionLabel,
    "sourceKindHint",
    ()=>sourceKindHint,
    "sourcePickActionLabel",
    ()=>sourcePickActionLabel,
    "sourceSightGroup",
    ()=>sourceSightGroup,
    "sourceSightLabel",
    ()=>sourceSightLabel,
    "sourceSightState",
    ()=>sourceSightState,
    "sourceUnavailableActionLabel",
    ()=>sourceUnavailableActionLabel,
    "sourcesEmptyBody",
    ()=>sourcesEmptyBody,
    "sourcesEmptyLead",
    ()=>sourcesEmptyLead,
    "sourcesLimitedSupportCopy",
    ()=>sourcesLimitedSupportCopy,
    "sourcesPrivacyCopy",
    ()=>sourcesPrivacyCopy,
    "sourcesUnsupportedBody",
    ()=>sourcesUnsupportedBody,
    "sourcesUnsupportedTitle",
    ()=>sourcesUnsupportedTitle,
    "sourcesWhatCanSeeCopy",
    ()=>sourcesWhatCanSeeCopy,
    "subtleStatusLabel",
    ()=>subtleStatusLabel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$product$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/lib/product-copy.ts [app-client] (ecmascript)");
;
function sourceSightGroup(kind, name, path) {
    const text = `${name} ${path}`.toLowerCase();
    if (kind === 'volume' || /\/volumes\/|\/media\/|^[a-z]:\\/i.test(path)) {
        if (!/users|documents and settings/i.test(text)) return 'external';
    }
    if (kind === 'cloud_folder' || /icloud|dropbox|onedrive|google drive|box|sharepoint/i.test(text)) {
        return 'cloud';
    }
    return 'computer';
}
function sourceSightState(args) {
    if (args.included) {
        if (!args.exists || !args.hostCanSee || args.status === 'unavailable' || args.status === 'permission_denied' || args.status === 'external_drive_disconnected') {
            return 'unavailable';
        }
        return 'indexed';
    }
    if (args.exists && args.hostCanSee) return 'available';
    return 'not_connected';
}
function sourceUnavailableActionLabel(permissionLost) {
    return permissionLost ? 'Restore permission' : 'Refresh';
}
function sourcePickActionLabel(desktop) {
    return desktop ? 'Add' : 'Connect';
}
function sourceGrantActionLabel() {
    return 'Connect';
}
function sourceAnotherFolderLabel() {
    return 'Choose another folder';
}
function sourcesEmptyLead() {
    return 'No sources yet.';
}
function sourcesEmptyBody(desktop = true) {
    return desktop ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$product$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["productCopy"])('No sources yet. Add a folder so SuHuella can see it.') : (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$product$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["productCopy"])('No sources yet. Connect a folder so SuHuella can see it.');
}
const SOURCES_PRIVACY_LINES = [
    'Your documents stay on this device.',
    'Nothing is uploaded.'
];
function sourcesPrivacyCopy() {
    return SOURCES_PRIVACY_LINES.join(' ');
}
function sourcesUnsupportedTitle() {
    return 'Folder access is not available in this browser.';
}
function sourcesUnsupportedBody() {
    return 'Use Chrome or Edge, or download the desktop app.';
}
function sourcesLimitedSupportCopy() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$product$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["productCopy"])('This browser can open a folder so SuHuella can see it, but it cannot move or rename documents. Use Chrome or Edge, or download the desktop app.');
}
function isFolderPickAbort(error) {
    return error instanceof DOMException && error.name === 'AbortError' || error instanceof Error && error.name === 'AbortError';
}
function isProtectedFolderConnectError(error) {
    const text = (error instanceof Error ? error.message : String(error)).toLowerCase();
    const name = error instanceof Error ? error.name.toLowerCase() : '';
    return error instanceof Error && 'code' in error && error.code === 'protected' || name === 'securityerror' || text.includes('system file') || text.includes('contains system') || text.includes("can't open this folder") || text.includes('cannot open this folder') || text.includes('no se puede abrir esta carpeta') || text.includes('not available in this browser') || text.includes('not allowed to access');
}
function folderConnectErrorMessage(error) {
    if (isFolderPickAbort(error)) return null;
    if (isProtectedFolderConnectError(error)) return null;
    if (error instanceof Error) {
        const text = error.message.toLowerCase();
        if (text.includes('cannot choose files') || text.includes('cannot choose documents')) {
            return 'This browser cannot choose documents.';
        }
        if (text.includes('not available in this browser') || text.includes('requires chrome or edge')) {
            return `${sourcesUnsupportedTitle()} ${sourcesUnsupportedBody()}`;
        }
        if (text.includes('permission') || text.includes('not allowed') || text.includes('denied')) {
            return null;
        }
        if (text.includes('no longer available') || text.includes('unavailable')) {
            return 'That folder is no longer available. Choose it again if it is still on this device.';
        }
    }
    return `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$product$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["productCopy"])('SuHuella could not open that folder.')} ${sourcesUnsupportedBody()}`;
}
function browserLocalFoldersLabel(locale) {
    return locale === 'es' ? 'Local' : 'Local';
}
function browserConnectFolderLabel(locale) {
    return locale === 'es' ? 'Conectar carpeta' : 'Connect folder';
}
function browserIntegrationsActionLabel(locale) {
    return locale === 'es' ? 'Integraciones' : 'Integrations';
}
function browserConnectFolderHint(locale) {
    return locale === 'es' ? 'Elige una carpeta de trabajo o una subcarpeta. Tus archivos permanecen en este dispositivo.' : 'Choose a work folder or subfolder. Your files stay on this device.';
}
function browserConnectFolderNote(locale) {
    return locale === 'es' ? 'Algunas carpetas del sistema pueden estar protegidas por el navegador.' : 'Some system folders may be protected by the browser.';
}
function browserConnectDialogCopy(locale) {
    if (locale === 'es') {
        return {
            title: 'Conecta una carpeta local',
            body: 'Elige una carpeta de trabajo para que SuHuella pueda aprender de sus nombres y ayudarte a organizar documentos. Tus archivos permanecen en este dispositivo. Nada se sube. Para usar todas las funciones, descarga la app de escritorio.',
            note: 'Si el navegador bloquea una carpeta del sistema, elige una subcarpeta normal.',
            primary: 'Elegir carpeta',
            secondary: 'Cancelar'
        };
    }
    return {
        title: 'Connect a local folder',
        body: 'Choose a work folder so SuHuella can learn from its names and help you organise documents. Your files stay on this device. Nothing is uploaded. To use every function, download the desktop app.',
        note: 'If the browser blocks a system folder, choose a regular subfolder.',
        primary: 'Choose folder',
        secondary: 'Cancel'
    };
}
function browserBlockedFolderDialogCopy(locale) {
    if (locale === 'es') {
        return {
            title: 'Esta carpeta no está disponible en este navegador',
            body: 'El navegador no puede usar esa carpeta. Elige una carpeta de trabajo o una subcarpeta. Tus archivos permanecen en este dispositivo. Para usar todas las funciones, descarga la app de escritorio.',
            primary: 'Elegir otra carpeta',
            secondary: 'Cancelar'
        };
    }
    return {
        title: 'This folder is not available in this browser',
        body: 'The browser cannot use that folder. Choose a regular work folder or a subfolder. Your files stay on this device. To use every function, download the desktop app.',
        primary: 'Choose another folder',
        secondary: 'Cancel'
    };
}
function sourceDisplayName(name, path, isTechnicalId) {
    const visible = name?.trim();
    if (visible && !isTechnicalId(visible)) return visible;
    const last = path.split(/[/\\]/).filter(Boolean).at(-1) ?? path;
    if (last && !isTechnicalId(last)) return last;
    return 'Folder';
}
function sourceSightLabel(state, scanning) {
    if (scanning && state === 'indexed') return 'Indexed';
    if (state === 'indexed') return 'Indexed';
    if (state === 'available') return 'Available';
    if (state === 'unavailable') return 'Unavailable';
    if (state === 'limited') return 'Limited in browser';
    if (state === 'coming_later') return 'Coming later';
    return 'Not connected';
}
function sourcesWhatCanSeeCopy(locale) {
    return locale === 'es' ? 'Qué puede ver SuHuella.' : (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$product$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["productCopy"])('What SuHuella can see.');
}
function browserSystemFoldersLabel(locale) {
    return locale === 'es' ? 'Carpetas del sistema' : 'System folders';
}
function browserSystemFolderHint(locale) {
    return locale === 'es' ? 'El navegador puede bloquear algunas carpetas del sistema. Elige una subcarpeta normal dentro de Documentos o Descargas.' : 'The browser may block some system folders. Choose a regular subfolder inside Documents or Downloads.';
}
function browserChooseSubfolderLabel(locale) {
    return locale === 'es' ? 'Elegir subcarpeta' : 'Choose subfolder';
}
function browserCloudComingLaterCopy(locale) {
    return locale === 'es' ? 'Las fuentes en la nube no están disponibles en esta vista previa.' : 'Cloud sources are not available in this preview.';
}
function browserCapabilityCatalog(platform = 'darwin') {
    const system = [
        {
            id: 'documents',
            label: 'Documents',
            path: 'suhuella:documents',
            kind: 'user_folder',
            group: 'computer',
            capability: 'limited'
        },
        {
            id: 'downloads',
            label: 'Downloads',
            path: 'suhuella:downloads',
            kind: 'user_folder',
            group: 'computer',
            capability: 'limited'
        },
        {
            id: 'desktop',
            label: 'Desktop',
            path: 'suhuella:desktop',
            kind: 'user_folder',
            group: 'computer',
            capability: 'limited'
        },
        {
            id: 'pictures',
            label: 'Pictures',
            path: 'suhuella:pictures',
            kind: 'user_folder',
            group: 'computer',
            capability: 'limited'
        }
    ];
    const cloud = [
        ...platform === 'darwin' ? [
            {
                id: 'icloud',
                label: 'iCloud Drive',
                path: 'suhuella:icloud',
                kind: 'cloud_folder',
                group: 'cloud',
                capability: 'coming_later'
            }
        ] : [],
        {
            id: 'google_drive',
            label: 'Google Drive',
            path: 'suhuella:google-drive',
            kind: 'cloud_folder',
            group: 'cloud',
            capability: 'coming_later'
        },
        {
            id: 'onedrive',
            label: 'OneDrive',
            path: 'suhuella:onedrive',
            kind: 'cloud_folder',
            group: 'cloud',
            capability: 'coming_later'
        },
        {
            id: 'dropbox',
            label: 'Dropbox',
            path: 'suhuella:dropbox',
            kind: 'cloud_folder',
            group: 'cloud',
            capability: 'coming_later'
        }
    ];
    return [
        ...system,
        ...cloud
    ];
}
function sourceKindHint(source) {
    if (source.kind === 'volume') return 'External drive';
    if (source.kind === 'cloud_folder') return 'Cloud folder';
    const text = `${source.label} ${source.path}`.toLowerCase();
    if (/dropbox|onedrive|google drive|icloud|cloudstorage/.test(text)) return 'Cloud folder';
    return null;
}
function subtleStatusLabel(status, scanning) {
    if (scanning && (status === 'ready' || status === 'needs_refresh' || status === 'indexing')) return 'Updating…';
    if (status === 'indexing') return 'Updating…';
    if (status === 'needs_refresh') return 'Needs refresh';
    if (status === 'unavailable') return 'Unavailable';
    if (status === 'permission_denied') return 'Needs permission';
    if (status === 'external_drive_disconnected') return 'Unavailable';
    if (status === 'ready') return 'Indexed';
    return null;
}
function formatDocumentCount(count) {
    return `${count.toLocaleString()} document${count === 1 ? '' : 's'}`;
}
function lastUpdatedCopy(iso) {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date >= today) return 'Last updated today';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date >= yesterday) return 'Last updated yesterday';
    const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
    if (diffDays < 7) return `Last updated ${diffDays} days ago`;
    return `Last updated ${date.toLocaleDateString()}`;
}
function includedStatusLabel(status, scanning) {
    if (scanning && (status === 'ready' || status === 'needs_refresh' || status === 'indexing')) {
        return 'Indexed';
    }
    if (status === 'indexing') return 'Indexed';
    if (status === 'needs_refresh') return 'Indexed';
    if (status === 'unavailable' || status === 'permission_denied' || status === 'external_drive_disconnected') {
        return 'Unavailable';
    }
    return 'Indexed';
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/product/src/lib/storage-format.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "formatDuration",
    ()=>formatDuration,
    "formatMeasuredSize",
    ()=>formatMeasuredSize,
    "formatStorageSize",
    ()=>formatStorageSize
]);
function formatStorageSize(bytes) {
    if (bytes <= 0) return '0 B';
    const units = [
        'B',
        'KB',
        'MB',
        'GB',
        'TB'
    ];
    let value = bytes;
    let unitIndex = 0;
    while(value >= 1024 && unitIndex < units.length - 1){
        value /= 1024;
        unitIndex += 1;
    }
    const digits = value >= 100 || unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
    return `${value.toFixed(digits)} ${units[unitIndex]}`;
}
function formatMeasuredSize(bytes, unavailable = 'Not measured') {
    if (bytes == null) return unavailable;
    return formatStorageSize(bytes);
}
function formatDuration(ms) {
    if (ms == null) return 'Not measured yet';
    if (ms < 1000) return `${Math.round(ms)} ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(ms >= 10_000 ? 0 : 1)} s`;
    const minutes = Math.floor(ms / 60_000);
    const seconds = Math.round(ms % 60_000 / 1000);
    return `${minutes}m ${seconds.toString().padStart(1, '0')}s`;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/product/src/lib/storage-overview.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "emptyAppStorage",
    ()=>emptyAppStorage,
    "formatOverviewUpdated",
    ()=>formatOverviewUpdated,
    "overviewWarningCopy",
    ()=>overviewWarningCopy,
    "sourceSizeLabel",
    ()=>sourceSizeLabel,
    "sourceStatusLabel",
    ()=>sourceStatusLabel,
    "storageSourceWarning",
    ()=>storageSourceWarning
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$product$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/lib/product-copy.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$folders$2d$ui$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/lib/folders-ui.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$storage$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/lib/storage-format.ts [app-client] (ecmascript)");
;
;
;
function storageSourceWarning(sources) {
    if (sources.some((source)=>source.status === 'permission_required')) {
        return {
            code: 'permission_required',
            message: (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$product$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["productCopy"])('SuHuella cannot measure this folder yet. Grant access or remove it from Sources.')
        };
    }
    if (sources.some((source)=>source.status === 'unavailable')) {
        return {
            code: 'unavailable',
            message: (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$product$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["productCopy"])('This source is not available right now.')
        };
    }
    if (sources.some((source)=>source.status === 'failed' || source.status === 'skipped')) {
        return {
            code: 'failed',
            message: 'Some sources could not be measured.'
        };
    }
    return null;
}
function overviewWarningCopy(overview, hasSources) {
    if (!hasSources) {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$product$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["productCopy"])('No sources yet. Add a folder so SuHuella can see it.');
    }
    if (!overview) {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$product$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["productCopy"])('Storage details could not be refreshed. SuHuella can still organise your documents.');
    }
    if (overview.status === 'empty') {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$product$2d$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["productCopy"])('No sources yet. Add a folder so SuHuella can see it.');
    }
    if (overview.warnings[0]?.message) return overview.warnings[0].message;
    return null;
}
function formatOverviewUpdated(iso) {
    if (!iso) return 'Not yet';
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$folders$2d$ui$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatLastUpdated"])(iso);
}
function sourceStatusLabel(status) {
    if (status === 'permission_required') return 'Needs access';
    if (status === 'unavailable') return 'Unavailable';
    if (status === 'measuring') return 'Measuring…';
    if (status === 'failed' || status === 'skipped') return 'Size unavailable';
    if (status === 'not_connected') return 'Not connected';
    if (status === 'unsupported') return 'Not available here';
    return null;
}
function sourceSizeLabel(source) {
    if (source?.status === 'measured' && source.bytes != null) return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$storage$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatStorageSize"])(source.bytes);
    if (source?.status === 'permission_required') return 'Permission needed';
    if (source?.status === 'unsupported') return 'Not supported in this browser';
    if (source?.status === 'measuring') return 'Measuring…';
    if (source?.status === 'not_connected') return 'Not connected';
    return 'Size unavailable';
}
function emptyAppStorage() {
    return {
        indexBytes: 0,
        activityBytes: 0,
        cacheBytes: 0,
        logsBytes: 0,
        workflowsBytes: 0,
        settingsBytes: 0,
        licenseBytes: 0
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/product/src/lib/well-known-sources.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "sameSourceName",
    ()=>sameSourceName,
    "wellKnownSources",
    ()=>wellKnownSources
]);
function wellKnownSources(platform) {
    const movies = platform === 'win32' ? {
        id: 'videos',
        label: 'Videos',
        token: 'suhuella:videos'
    } : {
        id: 'movies',
        label: 'Movies',
        token: 'suhuella:movies'
    };
    const computer = [
        {
            id: 'desktop',
            label: 'Desktop',
            group: 'computer',
            token: 'suhuella:desktop',
            kind: 'user_folder'
        },
        {
            id: 'documents',
            label: 'Documents',
            group: 'computer',
            token: 'suhuella:documents',
            kind: 'user_folder'
        },
        {
            id: 'downloads',
            label: 'Downloads',
            group: 'computer',
            token: 'suhuella:downloads',
            kind: 'user_folder'
        },
        {
            id: 'pictures',
            label: 'Pictures',
            group: 'computer',
            token: 'suhuella:pictures',
            kind: 'user_folder'
        },
        {
            ...movies,
            group: 'computer',
            kind: 'user_folder'
        },
        {
            id: 'music',
            label: 'Music',
            group: 'computer',
            token: 'suhuella:music',
            kind: 'user_folder'
        },
        {
            id: 'shared',
            label: 'Shared',
            group: 'computer',
            token: 'suhuella:shared',
            kind: 'user_folder'
        }
    ];
    if (platform !== 'win32') {
        computer.push({
            id: 'developer',
            label: 'Developer',
            group: 'computer',
            token: 'suhuella:developer',
            kind: 'user_folder'
        }, {
            id: 'applications',
            label: 'Applications',
            group: 'computer',
            token: 'suhuella:applications',
            kind: 'user_folder'
        });
    }
    const cloud = [
        ...platform === 'darwin' ? [
            {
                id: 'icloud',
                label: 'iCloud Drive',
                group: 'cloud',
                token: 'suhuella:icloud',
                kind: 'cloud_folder'
            }
        ] : [],
        {
            id: 'dropbox',
            label: 'Dropbox',
            group: 'cloud',
            token: 'suhuella:dropbox',
            kind: 'cloud_folder'
        },
        {
            id: 'onedrive',
            label: 'OneDrive',
            group: 'cloud',
            token: 'suhuella:onedrive',
            kind: 'cloud_folder'
        },
        {
            id: 'google_drive',
            label: 'Google Drive',
            group: 'cloud',
            token: 'suhuella:google-drive',
            kind: 'cloud_folder'
        }
    ];
    const external = [
        {
            id: 'external',
            label: 'External SSD',
            group: 'external',
            token: 'suhuella:external',
            kind: 'volume'
        },
        {
            id: 'usb',
            label: 'USB',
            group: 'external',
            token: 'suhuella:usb',
            kind: 'volume'
        },
        {
            id: 'nas',
            label: 'NAS',
            group: 'external',
            token: 'suhuella:nas',
            kind: 'volume'
        }
    ];
    return [
        ...computer,
        ...cloud,
        ...external
    ];
}
function sameSourceName(left, right) {
    return left.replace(/\s+/g, '').toLowerCase() === right.replace(/\s+/g, '').toLowerCase();
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=packages_product_src_1a_wtw3._.js.map