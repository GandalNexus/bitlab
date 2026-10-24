<!--
Thank you for contributing to BitLab!
Please keep the PR focused on a single change and answer the checklist below.
-->

## What does this PR do?

<!-- One or two sentences. Reference the issue: Closes #123 -->

## Type of change

- [ ] `feat:` new feature
- [ ] `fix:` bug fix
- [ ] `docs:` documentation
- [ ] `refactor:` no behavior change
- [ ] `test:` tests only
- [ ] `chore:` tooling / config

## Checklist

- [ ] `bun run lint` passes (0 errors)
- [ ] `bun run typecheck` passes
- [ ] `bun run test` passes
- [ ] User-facing strings go through `t()` with an EN entry in `lib/i18n-dict.ts`
- [ ] No key material / mnemonic ever reaches the server
- [ ] No simulated blockchain data was introduced (real errors are displayed as-is)
- [ ] Conventional Commit title (`type(scope): summary`)
