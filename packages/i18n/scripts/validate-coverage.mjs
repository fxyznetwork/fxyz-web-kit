#!/usr/bin/env node

/**
 * Validate translation coverage for target locales.
 *
 * Purpose:
 * - Catch new English strings that were added/changed in source dictionary
 *   but not translated in target locale dictionaries.
 *
 * Behavior:
 * - Compares source (`en`) and target locale leaf string values.
 * - Flags keys where target value is exactly equal to source value.
 * - Applies structural exclusions (URLs, references, emails, etc.).
 * - Requires all remaining equal-value keys to be explicitly allowlisted.
 *
 * Usage (from repo root):
 * - Validate:                 pnpm validate:i18n:coverage
 * - Refresh allowlist:        pnpm --filter @fxyz/i18n validate:coverage --update-allowlist
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const I18N_ROOT = path.join(__dirname, "..");
const DICT_ROOT = path.join(I18N_ROOT, "dictionaries");
const LANGUINE_CONFIG = path.join(I18N_ROOT, "languine.json");
const ALLOWLIST_PATH = path.join(I18N_ROOT, "untranslated-allowlist.json");
const updateAllowlist = process.argv.includes("--update-allowlist");

const URL_RE = /https?:\/\/|www\./i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SYMBOLS_ONLY_RE = /^[\W_\d]+$/;
const TICKER_RE = /^(?:[A-Z]{2,10}|[a-z][A-Z]{2,10})$/;
const RANGE_YEAR_RE = /^\d{4}\s*-\s*\d{4}$/;
const QUARTER_RANGE_RE = /^Q[1-4]-Q[1-4]\s+\d{4}$/i;
const PERCENT_RE = /^\d+(?:\.\d+)?%$/;
const TIMEZONE_RE = /^[A-Z]{2,4}(?:\/[A-Z]{2,4})?$/;
const DURATION_RE = /^~?\d+(?:\.\d+)?\s?(?:ms|s|m|h)$/i;
const PHASE_LABEL_RE = /^Phase\s+\d+$/i;

// Proper nouns / brand names / protocol codes expected to stay identical
// across locales. Extend this list for your own project's vocabulary.
const KNOWN_PROPER_VALUES = new Set([
	"OK",
	"Email",
	"Live",
	"Info",
	"Open Source",
]);

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function flattenLeafValues(value, prefix = "", out = {}) {
	if (Array.isArray(value)) {
		value.forEach((item, index) => {
			const next = prefix ? `${prefix}[${index}]` : `[${index}]`;
			if (item && typeof item === "object") {
				flattenLeafValues(item, next, out);
			} else {
				out[next] = item;
			}
		});
		return out;
	}

	if (value && typeof value === "object") {
		for (const [key, child] of Object.entries(value)) {
			const next = prefix ? `${prefix}.${key}` : key;
			if (child && typeof child === "object") {
				flattenLeafValues(child, next, out);
			} else {
				out[next] = child;
			}
		}
		return out;
	}

	out[prefix] = value;
	return out;
}

function shouldTreatAsIntentionalEnglish(key, value) {
	if (typeof value !== "string") return true;

	const k = key.toLowerCase();
	const s = value.trim();

	if (!s) return true;

	// Structural paths that are not natural-language translations.
	if (
		k.endsWith(".url") ||
		k.endsWith(".email") ||
		k.endsWith(".image") ||
		k.includes(".references.") ||
		k.includes("keywords[") ||
		k.endsWith(".key")
	) {
		return true;
	}

	// Natural invariants (links, identifiers, metrics, and symbols).
	if (
		URL_RE.test(s) ||
		EMAIL_RE.test(s) ||
		SYMBOLS_ONLY_RE.test(s) ||
		TICKER_RE.test(s) ||
		RANGE_YEAR_RE.test(s) ||
		QUARTER_RANGE_RE.test(s) ||
		PERCENT_RE.test(s) ||
		TIMEZONE_RE.test(s) ||
		DURATION_RE.test(s) ||
		PHASE_LABEL_RE.test(s)
	) {
		return true;
	}

	// Examples often encode ticker/protocol symbols.
	if (k.includes(".examples[")) return true;

	// Proper nouns / brands / protocol terms expected to remain stable.
	if (KNOWN_PROPER_VALUES.has(s)) return true;

	return false;
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

	const source = flattenLeafValues(readJson(sourcePath));
	const allowlist = fs.existsSync(ALLOWLIST_PATH)
		? readJson(ALLOWLIST_PATH)
		: {};

	const baseline = {};
	let hasError = false;

	console.log(
		`🌐 Validating i18n translation coverage (source: ${sourceLocale})`,
	);

	for (const locale of targetLocales) {
		const targetPath = path.join(DICT_ROOT, `${locale}.json`);
		if (!fs.existsSync(targetPath)) {
			console.error(`❌ Missing target dictionary: ${targetPath}`);
			hasError = true;
			continue;
		}

		const target = flattenLeafValues(readJson(targetPath));
		const equalKeys = [];
		for (const [key, value] of Object.entries(source)) {
			if (
				typeof value === "string" &&
				typeof target[key] === "string" &&
				target[key] === value
			) {
				equalKeys.push(key);
			}
		}

		const unresolved = equalKeys.filter(
			(key) => !shouldTreatAsIntentionalEnglish(key, source[key]),
		);
		baseline[locale] = unresolved.sort();

		const allowed = new Set(
			Array.isArray(allowlist[locale]) ? allowlist[locale] : [],
		);
		const unknown = unresolved.filter((key) => !allowed.has(key));
		const stale = [...allowed].filter((key) => !unresolved.includes(key));

		console.log(
			`${locale}: equal=${equalKeys.length}, unresolved=${unresolved.length}, new=${unknown.length}, stale_allowlist=${stale.length}`,
		);

		if (unknown.length > 0) {
			hasError = true;
			console.error(`❌ ${locale} has untranslated keys not in allowlist:`);
			unknown.slice(0, 30).forEach((key) => console.error(`   - ${key}`));
			if (unknown.length > 30) {
				console.error(`   ... and ${unknown.length - 30} more`);
			}
		}
	}

	if (updateAllowlist) {
		fs.writeFileSync(
			ALLOWLIST_PATH,
			`${JSON.stringify(baseline, null, "\t")}\n`,
		);
		console.log(`✅ Updated allowlist baseline: ${ALLOWLIST_PATH}`);
	}

	if (hasError && !updateAllowlist) {
		console.error(
			"❌ Translation coverage validation failed. Translate keys or update allowlist intentionally.",
		);
		console.error(
			"   To refresh baseline intentionally: pnpm --filter @fxyz/i18n validate:coverage --update-allowlist",
		);
		process.exit(1);
	}

	console.log("✅ Translation coverage validation passed.");
}

main();
