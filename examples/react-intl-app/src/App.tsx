import { FormattedMessage, useIntl } from "react-intl";

/**
 * Synthetic react-intl component. With `"framework": "react-intl"`, LocaleGuard
 * reads the FormatJS message-descriptor locale files and treats
 * <FormattedMessage> as a translation component.
 */
export function App() {
  const intl = useIntl();

  return (
    <div>
      {/* Hardcoded JSX text — flagged. */}
      <h1>Cluster Manager</h1>

      {/* defaultMessage is the source message, not a hardcoded UI string — not flagged. */}
      <FormattedMessage id="app.title" defaultMessage="Cluster Manager" />

      {/* Localized via formatMessage — not flagged. */}
      <p>{intl.formatMessage({ id: "app.greeting" }, { userName: "Ada" })}</p>

      {/* Children of a translation component are intentional — not flagged. */}
      <FormattedMessage id="app.items">{(txt) => <span>{txt}</span>}</FormattedMessage>
    </div>
  );
}
