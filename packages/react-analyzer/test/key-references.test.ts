import { test } from "node:test";
import assert from "node:assert/strict";

import { extractFromSource } from "../src/key-references";

const FUNCS = new Set(["t", "i18n.t", "formatMessage", "intl.formatMessage"]);
const COMPS = new Set(["FormattedMessage", "Trans"]);

function extract(code: string) {
  return extractFromSource(code, "App.tsx", FUNCS, COMPS);
}

test("extracts t() literal keys and applies the file namespace", () => {
  const r = extract(`const t = useTranslations("Home"); t("title"); t("app.sub");`);
  assert.deepEqual(
    r.references.map((x) => ({ key: x.key, ns: x.namespace })),
    [
      { key: "title", ns: "Home" },
      { key: "app.sub", ns: "Home" },
    ],
  );
  assert.equal(r.hasDynamicKeys, false);
});

test("flags dynamic key usage and does not emit a reference", () => {
  const r = extract("t(key); t(`a.${x}`);");
  assert.equal(r.hasDynamicKeys, true);
  assert.equal(r.references.length, 0);
});

test("formatMessage id and <FormattedMessage> are flat (no namespace)", () => {
  const r = extract(`intl.formatMessage({ id: "msg.one" }); const x = <FormattedMessage id="msg.two" />;`);
  assert.deepEqual(r.references.map((x) => x.key).sort(), ["msg.one", "msg.two"]);
  assert.ok(r.references.every((x) => x.namespace === undefined));
});

test("<Trans i18nKey> picks up the file namespace", () => {
  const r = extract(`const { t } = useTranslation("ns"); const x = <Trans i18nKey="greeting" />;`);
  const ref = r.references.find((x) => x.key === "greeting");
  assert.equal(ref?.namespace, "ns");
});

test("non-translation calls are ignored", () => {
  const r = extract(`doSomething("not a key"); console.log("hello");`);
  assert.equal(r.references.length, 0);
  assert.equal(r.hasDynamicKeys, false);
});
