# Repossess

<p align="center">
  <img src="https://i.pinimg.com/736x/c4/54/12/c45412ca677b62172ccec884b9b29b41.jpg" alt="Thumbnail" />
</p>

A lightweight TypeScript library that turns any GitHub repository into a full storage backend. Store structured data (collections), upload files, images, and videos — all with one simple API. Built with zero native dependencies, works everywhere: Node.js, Termux, servers, and edge runtimes. Switch between JSON and SQLite storage with a single option.

---

Main Features and Advantages

- GitHub as storage — Collections, files, and metadata live in your repo. No external DB.
- Collections — Named, isolated storage per group (users, products, orders).
- JSON or SQLite — Pick your format. Same API, different backends.
- Local cache + auto-sync — Fast reads, writes go to GitHub with conflict retry.
- File uploads — Images, videos, any file. Get url and raw links ready for <img>/<video>.
- Temp files with TTL — tmp: true auto-cleans after a configurable period.
- Recursive folder ops — Delete whole folders in one call.
- Works everywhere — Termux, servers, Node 18+, ESM + CJS, zero native bindings.
- Rate-limit safe — Built-in concurrency control via p-limit.
- Validated input — Zod checks everything before it hits GitHub.
- Free — No credits, no branding.

---

Installation

```bash
npm install repossess
```

Or from GitHub:

```bash
npm install github:deveni0/repossess
```

---

Quick Start

```javascript
import { StorageFiles } from "repossess";

const storage = new StorageFiles("owner/repo", {
  token: "ghp_Aw.......",
  storage: "sqlite", or json
});

const users = storage.collection("users");

const jo = await users.create({ name: "Youssefv", role: "user" });
console.log(jo);

await users.update(jo.id, { role: "admin" });
console.log(await users.get(ali.id));
```

---

Initialization Options

Option Type Default Description
token string — GitHub personal access token (required, repo scope)
branch string "main" Branch to store data in
dir string ".repossess/data" Local cache directory
storage "json" \| "sqlite" "json" Storage format on GitHub
tmpTtlMinutes number 10 TTL for temporary files in minutes
concurrency number 4 Max parallel GitHub requests
committer {name, email} bot defaults Git commit author

---

Collections

Each collection is stored in its own file:

· storage: "json" → collections/users/data.json
· storage: "sqlite" → collections/users/data.db

Create

```javascript
const user = await users.create({
  name: "Ali",
  email: "ali@example.com",
  role: "user",
  age: 22,
});
// { id: "k3j9x2aB1cD4", name: "Ali", email: "...", role: "user", age: 22 }
```

Get

```javascript
const user = await users.get(userId);
// { id, ...data } or null
```

Update

```javascript
const updated = await users.update(userId, { role: "admin" });
```

Delete

```javascript
const ok = await users.delete(userId); // true / false
```

Find

```javascript
const admins = await users.find({ role: "admin" });
const all = await users.all();
const count = await users.count();
```

Refresh

```javascript
await users.refresh();
```

Backend

```javascript
console.log(users.backend); // "json" or "sqlite"
```

---

File Uploads

Upload from buffer

```javascript
const file = await storage.upload("folder", {
  buffer: Buffer.from("hello"),
  namefile: "hello.txt",
});

console.log(file);
// {
//   path: "images/hello.txt",
//   url:  "https://github.com/owner/repo/blob/main/images/hello.txt",
//   raw:  "https://raw.githubusercontent.com/owner/repo/main/images/hello.txt",
//   sha:  "abc123...",
//   size: 5,
//   tmp:  false
// }
```

Upload from URL

```javascript
const remote = await storage.upload("images", {
  url: "https://example.com/photo.jpg",
  namefile: "photo.jpg",
});
```

Upload temporary file

```javascript
const tmp = await storage.upload("avatars", {
  buffer: Buffer.from("temp"),
  namefile: "temp.png",
  tmp: true,
});
// Saved to .repossess/tmp/avatars/temp.png
// Auto-deleted after tmpTtlMinutes
```

---

File Management

List files

```javascript
const items = await storage.list("images");
// [{ name, path, type, size, sha, url, raw }, ...]
```

Get a file

```javascript
const file = await storage.get("images/hello.txt");
if (file) {
  console.log(file.content); // Buffer
}
```

Delete a file

```javascript
await storage.remove("images/hello.txt");
```

Delete a folder recursively

```javascript
const removed = await storage.removeFolder("images");
console.log(`Deleted ${removed} files`);
```

Cleanup temporary files

```javascript
const cleaned = await storage.cleanupTmp();
```

---

Shutdown

```javascript
storage.destroy(); // stop the auto-cleanup timer
```

---

Repository Structure

```
owner/repo/
├── collections/
│   ├── users/
│   │   └── data.json
│   └── products/
│       └── data.json
├── images/
│   └── products/
│       └── phone.jpg
└── .repossess/
    └── tmp/
        └── avatars/
            └── temp.png
```

---

Full Example

```javascript
import { StorageFiles } from "repossess";

const storage = new StorageFiles("deveni0/files_xov", {
  token: "ghp_Aw.......",
  dir: ".repossess/data",
  storage: "json",
  tmpTtlMinutes: 10,
});

const users = storage.collection("users");
const products = storage.collection("products");

// Users
const ali = await users.create({ name: "Ali", email: "ali@example.com", role: "user" });
const sara = await users.create({ name: "Sara", email: "sara@example.com", role: "user" });

await users.update(ali.id, { role: "admin" });

console.log(await users.find({ role: "admin" })); // [Ali]
console.log(await users.count());                  // 2

// Products
const phone = await products.create({ title: "Phone", price: 999 });
console.log(await products.get(phone.id));

// Upload image
const img = await storage.upload("images/products", {
  buffer: Buffer.from("fake-image-data"),
  namefile: "phone.jpg",
});
console.log("Raw URL:", img.raw);

// Upload temp file
await storage.upload("avatars", {
  buffer: Buffer.from("temp"),
  namefile: "temp.png",
  tmp: true,
});

// Cleanup
await storage.remove("images/products/phone.jpg");
await storage.removeFolder("images/products");
await users.delete(sara.id);

await storage.cleanupTmp();
storage.destroy();
```

---


🙌 Contributors

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/deveni0">
        <img src="https://github.com/deveni0.png" width="80px;" style="border-radius:50%;" alt="Developer"/>
        <br />
        <sub><b>YoussefvDev</b></sub>
      </a>
    </td>
  </tr>
</table>


> Note: This documentation was generated with AI assistance :)