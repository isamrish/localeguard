/**
 * Vue Single File Components: extract the top-level `<template>` block and scan
 * it. Line numbers are offset back to the position in the `.vue` file.
 */

import type { Issue } from "@localeguard/core";

import { scanTemplate } from "./scanner";

export function scanVueSfc(
  source: string,
  fileName: string,
  translationComponents?: string[],
): Issue[] {
  const block = extractTemplateBlock(source);
  if (!block) return [];
  return scanTemplate(block.content, {
    mode: "vue",
    fileName,
    startLine: block.startLine,
    translationComponents,
  });
}

function extractTemplateBlock(source: string): { content: string; startLine: number } | null {
  const open = /<template(\s[^>]*)?>/i.exec(source);
  if (!open) return null;
  const contentStart = open.index + open[0].length;
  // The root <template> closes at the last </template> (later ones may be
  // nested `<template #slot>` / `<template v-if>` elements).
  const closeIdx = source.toLowerCase().lastIndexOf("</template>");
  if (closeIdx === -1 || closeIdx < contentStart) return null;

  const content = source.slice(contentStart, closeIdx);
  const startLine = source.slice(0, contentStart).split("\n").length;
  return { content, startLine };
}
