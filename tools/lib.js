"use strict";
const fs = require("fs"), path = require("path");
const SITE = path.join(__dirname, "..", "site");
const read = p => JSON.parse(fs.readFileSync(p, "utf8"));
const list = dir => fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith(".json") && f !== "index.json").sort() : [];
module.exports = { SITE, read, list, fs, path };
