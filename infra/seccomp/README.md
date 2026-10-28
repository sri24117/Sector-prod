# Seccomp profile for the worker

`chromium.json` is Playwright's published Docker seccomp profile, unchanged:
`utils/docker/seccomp_profile.json` at tag `v1.63.0` of
https://github.com/microsoft/playwright (Apache-2.0).
SHA-256: `cc3e61cabda6bbc1e53e54d27ba4d55a9d3be829b6dd1a596f4a7b31b1cc7849`.

It is Docker's default allowlist plus one rule that lets unprivileged processes
call `clone`, `setns` and `unshare`. Chromium needs those calls to create the
user namespaces its renderer sandbox runs in. On Docker's default profile,
Chromium won't start with the sandbox on, and the full-report worker must not
run it with `--no-sandbox`.

Only the `worker` service uses it (`docker-compose.yml`). When Playwright is
upgraded, compare against that version's profile, and run one full report
inside the rebuilt worker image before deploying.
