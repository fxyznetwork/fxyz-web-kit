/**
 * PII scrubbing for observability event payloads.
 *
 * Strategy:
 *   1. Walk the payload depth-first.
 *   2. Redact known sensitive field names (email, contactEmail, name,
 *      firstName, lastName, fullName, password, token, secret, apiKey,
 *      privateKey, authorization, cookie, did).
 *   3. Redact values that look like emails OR DIDs (`did:method:id`).
 *
 * Output preserves shape so events stay grep-able in your telemetry UI.
 */

const SENSITIVE_KEYS = new Set([
	"email",
	"contactemail",
	"useremail",
	"primaryemail",
	"contact_email",
	"user_email",
	"primary_email",
	"name",
	"firstname",
	"lastname",
	"fullname",
	"first_name",
	"last_name",
	"full_name",
	"password",
	"token",
	"secret",
	"apikey",
	"api_key",
	"privatekey",
	"private_key",
	"authorization",
	"cookie",
	"set-cookie",
	"did",
]);

// did:method:identifier — matches did:key, did:web, did:ethr, etc.
const DID_RE = /did:[a-z0-9]+:[a-zA-Z0-9._-]+/g;
// RFC 5322-ish email; deliberately permissive — we redact on suspicion.
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const REDACTED = "[REDACTED]";

const isSensitiveKey = (key: string): boolean =>
	SENSITIVE_KEYS.has(key.toLowerCase());

const scrubString = (value: string): string =>
	value.replace(DID_RE, REDACTED).replace(EMAIL_RE, REDACTED);

/**
 * Deep-clone + scrub. Cycles are detected via a WeakSet (events should
 * never carry cycles but defensive programming is cheap here).
 */
export const scrubPayload = <T>(value: T): T => {
	const seen = new WeakSet<object>();

	const walk = (v: unknown): unknown => {
		if (v === null || v === undefined) return v;
		if (typeof v === "string") return scrubString(v);
		if (typeof v !== "object") return v;
		if (seen.has(v as object)) return REDACTED;
		seen.add(v as object);

		if (Array.isArray(v)) return v.map(walk);

		if (v instanceof Error) {
			return {
				name: v.name,
				message: scrubString(v.message),
				stack: v.stack ? scrubString(v.stack) : undefined,
			};
		}

		const out: Record<string, unknown> = {};
		for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
			if (isSensitiveKey(k)) {
				out[k] = REDACTED;
				continue;
			}
			out[k] = walk(child);
		}
		return out;
	};

	return walk(value) as T;
};
