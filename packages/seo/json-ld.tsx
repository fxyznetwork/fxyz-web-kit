import type { Thing, WithContext } from "schema-dts";

type JsonLdProps = {
	code: WithContext<Thing>;
	/**
	 * Optional explicit script id. Defaults to the schema @type so multiple
	 * JSON-LD blocks on one page (Organization + WebSite + Article…) get
	 * distinct ids. A shared static id would collide via next/script's
	 * id-based dedupe — the second block would never render.
	 */
	id?: string;
};

const JSON_FOR_HTML_ESCAPES: Record<string, string> = {
	"<": "\\u003c",
	">": "\\u003e",
	"&": "\\u0026",
	"\u2028": "\\u2028",
	"\u2029": "\\u2029",
};

function serializeJsonForHtml(code: WithContext<Thing>): string {
	return JSON.stringify(code).replace(
		/[<>&\u2028\u2029]/g,
		(character) => JSON_FOR_HTML_ESCAPES[character] ?? character,
	);
}

/**
 * Renders JSON-LD structured data as a plain server-rendered <script> tag.
 *
 * A plain tag (not next/script) puts the JSON-LD in the initial HTML, so
 * crawlers that do not execute JavaScript still read it. next/script with
 * strategy="afterInteractive" only injects it client-side post-hydration.
 *
 * dangerouslySetInnerHTML is required because JSON-LD must be raw JSON
 * inside a <script> tag. JSON-significant values are preserved while
 * HTML-significant characters are emitted as Unicode escapes so dynamic
 * fields cannot terminate the script element.
 */
export const JsonLd = ({ code, id }: JsonLdProps) => {
	const schemaType = (code as { "@type"?: string })["@type"];
	const scriptId = id ?? `json-ld-${schemaType ?? "thing"}`;
	return (
		<script
			id={scriptId}
			type="application/ld+json"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON is escaped for HTML script contexts before insertion
			dangerouslySetInnerHTML={{ __html: serializeJsonForHtml(code) }}
		/>
	);
};

export type { Thing, WithContext } from "schema-dts";
