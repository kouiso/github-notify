# Verification for #56

Command executed:

```bash
pnpm install && CI=true pnpm vitest run
```

Actual output observed:

```text
 WARN  Unsupported engine: wanted: {"node":">=25.6.1"} (current: {"node":"v20.20.2","pnpm":"9.15.0"})
Lockfile is up to date, resolution step is skipped
Already up to date


> github-notify@0.0.0 prepare /workspace/github-notify
> husky

Done in 2.7s
INSTALL_EXIT_CODE=0
 WARN  Unsupported engine: wanted: {"node":">=25.6.1"} (current: {"node":"v20.20.2","pnpm":"9.15.0"})

 RUN  v4.1.5 /workspace/github-notify


 Test Files  28 passed (28)
      Tests  512 passed (512)
   Start at  11:57:16
   Duration  33.35s (transform 3.51s, setup 3.93s, import 10.66s, tests 15.00s, environment 22.44s)

VITEST_EXIT_CODE=0

```

Summary:

- pnpm install exit code: 0
- vitest exit code: 0
- Vitest pass count: 28 test files passed, 512 tests passed
