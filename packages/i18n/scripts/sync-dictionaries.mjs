#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const I18N_ROOT = path.join(__dirname, "..");
const DICT_ROOT = path.join(I18N_ROOT, "dictionaries");
const LANGUINE_CONFIG = path.join(I18N_ROOT, "languine.json");

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
	fs.writeFileSync(filePath, JSON.stringify(data, null, "\t") + "\n", "utf8");
}

function syncObjects(source, target) {
	let updated = false;

	function walk(s, t) {
		if (Array.isArray(s)) {
			const res = Array.isArray(t) ? [...t] : [];
			for (let i = 0; i < s.length; i++) {
				if (i >= res.length) {
					res.push(s[i]);
					updated = true;
				} else if (s[i] && typeof s[i] === "object") {
					const [childRes, childUpdated] = walk(s[i], res[i]);
					res[i] = childRes;
					if (childUpdated) updated = true;
				}
			}
			return [res, updated];
		}
		if (s && typeof s === "object") {
			const res =
				t && typeof t === "object" && !Array.isArray(t) ? { ...t } : {};
			for (const [key, val] of Object.entries(s)) {
				if (!(key in res)) {
					res[key] = val;
					updated = true;
				} else {
					const [childRes, childUpdated] = walk(val, res[key]);
					res[key] = childRes;
					if (childUpdated) updated = true;
				}
			}
			return [res, updated];
		}
		if (t === undefined) {
			return [s, true];
		}
		return [t, updated];
	}

	return walk(source, target);
}

function main() {
	const config = readJson(LANGUINE_CONFIG);
	const sourceLocale = config.locale.source;
	const targetLocales = config.locale.targets;

	const sourcePath = path.join(DICT_ROOT, `${sourceLocale}.json`);
	const sourceData = readJson(sourcePath);

	for (const loc of targetLocales) {
		const targetPath = path.join(DICT_ROOT, `${loc}.json`);
		if (!fs.existsSync(targetPath)) {
			console.log(`Creating missing dictionary for ${loc}`);
			writeJson(targetPath, sourceData);
			continue;
		}

		const targetData = readJson(targetPath);
		const [syncedData, updated] = syncObjects(sourceData, targetData);

		if (updated) {
			console.log(`Syncing missing keys in ${loc}.json`);
			writeJson(targetPath, syncedData);
		} else {
			console.log(`${loc}.json is already in sync`);
		}
	}
}

main();
