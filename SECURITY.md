# Security Policy

## Supported version

BitLab is a young project — only the latest commit on `main` is supported.
Please make sure you are up to date before reporting an issue.

## Scope

BitLab is deliberately built so that **no sensitive data ever reaches the
server**: keys, mnemonics and WIF strings live in the browser (IndexedDB) and
are never sent over the network. The areas where a vulnerability would matter
most are:

1. **Key material exfiltration** — any path that could send private key
   material, mnemonics or WIF strings outside the browser is a critical bug.
2. **`/api/bitcoin` proxy injection** — the endpoint must only relay the
   allow-listed public Esplora paths (`src/app/api/bitcoin/route.ts`).
3. **Lightning lab** — the two LDK nodes run in the user's browser
   (WebAssembly); seeds and channel state live in the visitor's IndexedDB and
   are never transmitted. The server holds no Lightning material.
   or seed leak is in scope.
4. **Mainnet safety** — a UI flow that could silently broadcast a mainnet
   transaction the user did not explicitly confirm.

## How to report

Please do **not** open a public issue for security reports.

- Preferred: open a **private security advisory** via GitHub on this
  repository (*Security → Report a vulnerability*).
- Alternatively, contact the maintainer directly:
  [@GandalNexus](https://github.com/GandalNexus).

You will get an acknowledgment within a few days. Once fixed, credit is
given in the release notes unless you prefer to stay anonymous.

## Non-scope

- Compromising the host machine running BitLab (it is meant to run locally);
  report it only if a browser session alone can trigger it.
- Public mempool.space availability or upstream Esplora data correctness.
