import { describe, expect, it } from "@jest/globals";
import { scrubPayload } from "../scrub";

describe("scrubPayload", () => {
	it("redacts DID-shaped string values", () => {
		expect(scrubPayload("did:example:abc123")).toBe("[REDACTED]");
		expect(scrubPayload("did:key:z6MkAbc")).toBe("[REDACTED]");
	});

	it("redacts email-shaped string values", () => {
		expect(scrubPayload("a@b.com")).toBe("[REDACTED]");
		expect(scrubPayload("user.name+tag@example.co.uk")).toBe("[REDACTED]");
	});

	it("redacts a DID and an email embedded inside a longer string", () => {
		const input = "user did:example:abc123 signed up with a@b.com today";
		expect(scrubPayload(input)).toBe(
			"user [REDACTED] signed up with [REDACTED] today",
		);
	});

	it("redacts known-sensitive keys regardless of their value", () => {
		const input = {
			email: "a@b.com",
			password: "hunter2",
			token: "abc.def.ghi",
			secret: "shh",
			apiKey: "sk-live-123",
			privateKey: "-----BEGIN KEY-----",
			authorization: "Bearer xyz",
			cookie: "session=1",
			did: "did:key:z6Mk",
			name: "not actually redacted for shape, redacted for key",
		};
		expect(scrubPayload(input)).toEqual({
			email: "[REDACTED]",
			password: "[REDACTED]",
			token: "[REDACTED]",
			secret: "[REDACTED]",
			apiKey: "[REDACTED]",
			privateKey: "[REDACTED]",
			authorization: "[REDACTED]",
			cookie: "[REDACTED]",
			did: "[REDACTED]",
			name: "[REDACTED]",
		});
	});

	it("matches sensitive keys case-insensitively", () => {
		const input = { Email: "a@b.com", CONTACTEMAIL: "c@d.com" };
		expect(scrubPayload(input)).toEqual({
			Email: "[REDACTED]",
			CONTACTEMAIL: "[REDACTED]",
		});
	});

	it("deep-walks nested objects", () => {
		const input = {
			event: "signup",
			user: {
				profile: {
					contactEmail: "deep@nested.com",
					bio: "reachable at deep@nested.com too",
				},
			},
		};
		expect(scrubPayload(input)).toEqual({
			event: "signup",
			user: {
				profile: {
					contactEmail: "[REDACTED]",
					bio: "reachable at [REDACTED] too",
				},
			},
		});
	});

	it("walks arrays and scrubs each element", () => {
		const input = [
			"a@b.com",
			{ did: "did:key:z6Mk" },
			{ note: "no pii here" },
			42,
		];
		expect(scrubPayload(input)).toEqual([
			"[REDACTED]",
			{ did: "[REDACTED]" },
			{ note: "no pii here" },
			42,
		]);
	});

	it("extracts and scrubs Error instances", () => {
		const err = new Error("failed for a@b.com");
		err.stack = "Error: failed for a@b.com\n    at did:key:z6Mk (file.js:1:1)";
		const result = scrubPayload(err) as {
			name: string;
			message: string;
			stack: string;
		};
		expect(result.name).toBe("Error");
		expect(result.message).toBe("failed for [REDACTED]");
		expect(result.stack).toContain("[REDACTED]");
		expect(result.stack).not.toContain("a@b.com");
	});

	it("leaves non-PII values untouched", () => {
		const input = {
			id: 42,
			active: true,
			tags: ["alpha", "beta"],
			nested: { count: 3, ratio: 0.5 },
			nullable: null,
			missing: undefined,
		};
		expect(scrubPayload(input)).toEqual(input);
	});

	it("handles circular references without throwing, redacting the cycle", () => {
		type Circular = { self?: Circular; email: string };
		const input: Circular = { email: "a@b.com" };
		input.self = input;

		expect(() => scrubPayload(input)).not.toThrow();
		const result = scrubPayload(input);
		expect(result.email).toBe("[REDACTED]");
		expect(result.self).toBe("[REDACTED]");
	});

	it("passes null and undefined through unchanged", () => {
		expect(scrubPayload(null)).toBeNull();
		expect(scrubPayload(undefined)).toBeUndefined();
	});

	it("scrubs identically regardless of NODE_ENV (no on/off switch)", () => {
		// NODE_ENV is typed readonly (via Next.js's global ProcessEnv
		// augmentation). Object.assign bypasses the readonly-property
		// assignment check while still mutating the real process.env.
		const setNodeEnv = (value: string | undefined): void => {
			Object.assign(process.env, { NODE_ENV: value });
		};
		const originalEnv = process.env.NODE_ENV;
		const input = { email: "a@b.com", note: "did:key:z6Mk in the wild" };
		const expected = {
			email: "[REDACTED]",
			note: "[REDACTED] in the wild",
		};

		try {
			for (const env of ["development", "production", "test"] as const) {
				setNodeEnv(env);
				expect(scrubPayload(input)).toEqual(expected);
			}
		} finally {
			setNodeEnv(originalEnv);
		}
	});
});
