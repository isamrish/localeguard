# Security Policy

## Supported versions

LocaleGuard is pre-1.0. Security fixes are applied to the latest `0.x` release.

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Instead, report them privately using GitHub's
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
on this repository, or by contacting the maintainers directly.

When reporting, please include:

- A description of the vulnerability and its impact
- Steps to reproduce
- Any relevant configuration or sample input (use **synthetic** data only —
  never include real or proprietary locale files)

We will acknowledge your report as soon as possible and keep you informed as we
work on a fix.

## Scope

LocaleGuard reads JSON locale files and project configuration from disk. It does
not execute project code or make network requests. Reports about parsing
untrusted input safely (for example, malformed JSON causing excessive resource
use) are in scope.
