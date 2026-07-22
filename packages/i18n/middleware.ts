import { match as matchLocale } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";
import type { NextRequest } from "next/server";
import { createI18nMiddleware } from "next-international/middleware";
import { locales } from ".";
import languine from "./languine.json";

const I18nMiddleware = createI18nMiddleware({
	locales,
	defaultLocale: "en",
	urlMappingStrategy: "rewriteDefault",
	resolveLocaleFromRequest: (request: NextRequest): string | null => {
		const headers = Object.fromEntries(request.headers.entries());
		const negotiator = new Negotiator({ headers });
		const acceptedLanguages = negotiator.languages();

		const matchedLocale = matchLocale(
			acceptedLanguages,
			languine.locale.targets,
			languine.locale.source,
		);

		return matchedLocale ?? null;
	},
});

export function internationalizationMiddleware(request: NextRequest) {
	// next-international may resolve its internal NextRequest type from a
	// different next version in the pnpm graph than this package's direct
	// `next/server` import. Runtime identity is the same; `as unknown as`
	// bridges the dual-instance TS mismatch without pinning next in
	// root overrides.
	return I18nMiddleware(
		request as unknown as Parameters<typeof I18nMiddleware>[0],
	);
}

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico|404).*)"],
};

//https://nextjs.org/docs/app/building-your-application/routing/internationalization
//https://github.com/QuiiBz/next-international
