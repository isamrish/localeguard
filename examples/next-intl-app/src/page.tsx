import { useTranslations } from "next-intl";

/**
 * Synthetic next-intl (App Router) page. With `"framework": "next-intl"`,
 * LocaleGuard reads the nested-namespace `messages/{locale}.json` files and
 * validates the ICU `{var}` interpolation in them.
 */
export default function HomePage() {
  const t = useTranslations("HomePage");

  return (
    <main>
      {/* Localized via t() — not flagged. */}
      <h1>{t("title")}</h1>
      <p>{t("greeting", { userName: "Ada" })}</p>

      {/* Hardcoded aria-label — flagged. */}
      <button aria-label="Close">{t("items", { count: 3 })}</button>
    </main>
  );
}
