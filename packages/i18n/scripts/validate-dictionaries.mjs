#!/usr/bin/env node

/**
 * Validate i18n dictionary key parity against source locale.
 *
 * Default behavior:
 * - Fails on missing keys in target locales.
 * - Warns on extra keys in target locales.
 *
 * Strict mode:
 * - Pass --strict-extra to fail on extra keys too.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const I18N_ROOT = path.join(__dirname, "..");
const DICT_ROOT = path.join(I18N_ROOT, "dictionaries");
const LANGUINE_CONFIG = path.join(I18N_ROOT, "languine.json");
const strictExtra = process.argv.includes("--strict-extra");

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function flattenLeafPaths(value, prefix = "", out = new Set()) {
	if (Array.isArray(value)) {
		value.forEach((item, index) => {
			const next = prefix ? `${prefix}[${index}]` : `[${index}]`;
			if (item && typeof item === "object") {
				flattenLeafPaths(item, next, out);
			} else {
				out.add(next);
			}
		});
		return out;
	}

	if (value && typeof value === "object") {
		for (const [key, child] of Object.entries(value)) {
			const next = prefix ? `${prefix}.${key}` : key;
			if (child && typeof child === "object") {
				flattenLeafPaths(child, next, out);
			} else {
				out.add(next);
			}
		}
		return out;
	}

	if (prefix) out.add(prefix);
	return out;
}

function diffSets(source, target) {
	const missing = [];
	for (const key of source) {
		if (!target.has(key)) missing.push(key);
	}

	const extra = [];
	for (const key of target) {
		if (!source.has(key)) extra.push(key);
	}

	return { missing, extra };
}

function main() {
	if (!fs.existsSync(LANGUINE_CONFIG)) {
		console.error(`❌ Missing config: ${LANGUINE_CONFIG}`);
		process.exit(1);
	}

	const config = readJson(LANGUINE_CONFIG);
	const sourceLocale = config.locale?.source;
	const targetLocales = config.locale?.targets ?? [];

	if (!sourceLocale || targetLocales.length === 0) {
		console.error("❌ Invalid languine.json locale configuration.");
		process.exit(1);
	}

	const sourcePath = path.join(DICT_ROOT, `${sourceLocale}.json`);
	if (!fs.existsSync(sourcePath)) {
		console.error(`❌ Missing source dictionary: ${sourcePath}`);
		process.exit(1);
	}

	const sourceLeafPaths = flattenLeafPaths(readJson(sourcePath));
	let hasMissing = false;
	let hasExtra = false;

	console.log(
		`🌐 Validating i18n dictionaries (source: ${sourceLocale}, keys: ${sourceLeafPaths.size})`,
	);

	for (const locale of targetLocales) {
		const targetPath = path.join(DICT_ROOT, `${locale}.json`);
		if (!fs.existsSync(targetPath)) {
			console.error(`❌ Missing target dictionary: ${targetPath}`);
			hasMissing = true;
			continue;
		}

		const targetLeafPaths = flattenLeafPaths(readJson(targetPath));
		const { missing, extra } = diffSets(sourceLeafPaths, targetLeafPaths);
		const status = `${locale}: missing=${missing.length}, extra=${extra.length}`;

		if (missing.length > 0) {
			hasMissing = true;
			console.error(`❌ ${status}`);
			missing.slice(0, 20).forEach((key) => console.error(`   - ${key}`));
			if (missing.length > 20) {
				console.error(`   ... and ${missing.length - 20} more`);
			}
		} else if (extra.length > 0) {
			hasExtra = true;
			console.warn(`⚠️  ${status}`);
			extra.slice(0, 20).forEach((key) => console.warn(`   - ${key}`));
			if (extra.length > 20) {
				console.warn(`   ... and ${extra.length - 20} more`);
			}
		} else {
			console.log(`✅ ${status}`);
		}
	}

	if (hasMissing) {
		console.error("❌ i18n validation failed: missing keys detected.");
		process.exit(1);
	}

	if (strictExtra && hasExtra) {
		console.error(
			"❌ i18n validation failed: extra keys detected in strict mode.",
		);
		process.exit(1);
	}

	console.log("✅ i18n validation passed.");
	if (hasExtra && !strictExtra) {
		console.log("ℹ️ Extra keys were found but allowed (non-strict mode).");
	}
}

main();
