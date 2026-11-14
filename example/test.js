import { StorageFiles } from "repossess";

const storage = new StorageFiles("owner/repo", {
  token: token: process.env.GH_TOKEN,
  storage: "sqlite", or json
});

const users = storage.collection("users");

const jo = await users.create({ name: "Youssefv", role: "user" });
console.log(jo);

await users.update(jo.id, { role: "admin" });
console.log(await users.get(ali.id));