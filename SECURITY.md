# Security & privacy policy

`yggdrasil-ft` is a fully local, offline web app. The realistic threat model is
**not** a remote attacker on a server (there is no server) but:

1. **Leakage of personal data** — anything that causes family data to leave the
   device (a hidden network call, telemetry, an external asset, a link that
   exfiltrates parameters, a service worker caching a third-party URL).
2. **Data loss / corruption** — a bug that wipes or mangles the document in
   `localStorage`, or an import that destroys existing data.
3. **Malicious input** — a crafted `.ged`/JSON file exploiting the parser, or
   pasted content injected as HTML.
4. **Privacy of living persons** — an export/print path that ignores privacy mode.

## Supported expectations

- No network requests at runtime; verified in CI and by the offline test.
- Imports never destroy existing data on failure (`{ ok:false, errors[] }`).
- All user text is rendered as text, never as HTML.
- Real data is git-ignored and never part of the repository.

## Reporting

- **Security/privacy issues: report privately.** Open a *private* security
  advisory on GitHub (Security → Report a vulnerability) or contact the
  maintainer directly. Please do not open a public issue.
- Include: what leaked or broke, minimal reproduction, whether real data could
  have left the device, and the affected version/commit.
- Acknowledgement target: within a few days. A fix plus a note in the changelog
  follows as fast as is reasonable; the app ships no server component, so a
  release is a static build.

## Out of scope

- Attacks that require malware already running on the user's machine.
- Physical access to an unlocked browser profile (see `docs/privacy.md` for the
  encrypted-vault plan, P7).
- Third-party services the user chooses to visit afterwards (archive sites,
  DNA platforms) — this app never contacts them.
