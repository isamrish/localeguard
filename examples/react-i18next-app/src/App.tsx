import { useTranslation, Trans } from "react-i18next";

/**
 * A small synthetic component that mixes correctly localized markup with a few
 * deliberate mistakes, so `localeguard check` has something to report.
 */
export function App() {
  const { t } = useTranslation();

  return (
    <div>
      {/* Hardcoded JSX text — should be flagged. */}
      <h1>Cluster Manager</h1>

      {/* Correctly localized — should NOT be flagged. */}
      <p>{t("app.subtitle")}</p>

      {/* Hardcoded aria-label — should be flagged. */}
      <button aria-label="Close dialog" onClick={() => {}}>
        {t("actions.delete")}
      </button>

      {/* Hardcoded alt text — should be flagged. */}
      <img src="/logo.png" alt="Company logo" />

      {/* Localized placeholder — should NOT be flagged. */}
      <input placeholder={t("app.subtitle")} />

      {/* Decorative empty alt and a percentage — should NOT be flagged. */}
      <img src="/divider.png" alt="" />
      <span>100%</span>

      {/* Text inside <Trans> is intentional — should NOT be flagged. */}
      <Trans i18nKey="welcome">Welcome back</Trans>
    </div>
  );
}
