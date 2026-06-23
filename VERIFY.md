# Verification

## Environment / PR checkout
```text
$ gh pr view 55 -R kouiso/github-notify --json headRefName -q .headRefName
gh command failed: /bin/bash: line 1: gh: command not found

$ git fetch origin <branch> && git checkout <branch>
git fetch failed: fatal: unable to access 'https://github.com/kouiso/github-notify.git/': CONNECT tunnel failed, response 403
Changes were applied on the current branch because the cloud environment could not fetch PR #55.
```

## pnpm typecheck
```text
$ pnpm typecheck
mise ERROR error parsing config file: /workspace/github-notify/.mise.toml
mise ERROR Config files in /workspace/github-notify/.mise.toml are not trusted.
Trust them with `mise trust`. See https://mise.en.dev/cli/trust.html for more information.
mise ERROR Run with --verbose or MISE_VERBOSE=1 for more information
 WARN  Unsupported engine: wanted: {"node":">=25.6.1"} (current: {"node":"v20.20.2","pnpm":"9.15.0"})

> github-notify@0.0.0 typecheck /workspace/github-notify
> tsc -b --noEmit

[exit code: 0]
```

## pnpm lint
```text
$ pnpm lint
mise ERROR error parsing config file: /workspace/github-notify/.mise.toml
mise ERROR Config files in /workspace/github-notify/.mise.toml are not trusted.
Trust them with `mise trust`. See https://mise.en.dev/cli/trust.html for more information.
mise ERROR Run with --verbose or MISE_VERBOSE=1 for more information
 WARN  Unsupported engine: wanted: {"node":">=25.6.1"} (current: {"node":"v20.20.2","pnpm":"9.15.0"})

> github-notify@0.0.0 lint /workspace/github-notify
> biome check . && eslint .

biome.json:2:14 deserialize ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  i The configuration schema version does not match the CLI version 2.4.14
  
    1 │ {
  > 2 │   "$schema": "https://biomejs.dev/schemas/2.3.15/schema.json",
      │              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    3 │   "vcs": {
    4 │     "enabled": true,
  
  i   Expected:                     2.4.14
      Found:                        2.3.15
  
  
  i Run the command biome migrate to migrate the configuration file.
  

src/components/dashboard/dashboard.tsx:49:14 lint/style/useTemplate  FIXABLE  ━━━━━━━━━━━━━━━━━━━━━━

  ! Template literals are preferred over string concatenation.
  
    47 │       }
    48 │       if (activeGroup && activeGroup.repositories.length > 0) {
  > 49 │         q += ' ' + activeGroup.repositories.map((r) => `repo:${r}`).join(' ');
       │              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    50 │       }
    51 │       return q;
  
  i Unsafe fix: Use a template literal.
  
     47  47 │         }
     48  48 │         if (activeGroup && activeGroup.repositories.length > 0) {
     49     │ - ········q·+=·'·'·+·activeGroup.repositories.map((r)·=>·`repo:${r}`).join('·');
         49 │ + ········q·+=·`·${activeGroup.repositories.map((r)·=>·`repo:${r}`).join('·')}`;
     50  50 │         }
     51  51 │         return q;
  

src/components/settings/notification-filter-editor.test.tsx:5:29 lint/correctness/noUnusedImports  FIXABLE  ━━━━━━━━━━

  ! Several of these imports are unused.
  
    3 │ import { describe, expect, it, vi } from 'vitest';
    4 │ 
  > 5 │ import type { CustomFilter, NotificationReason } from '@/types';
      │                             ^^^^^^^^^^^^^^^^^^
    6 │ import { IssueStatusRulesEditor, NotificationFilterEditor } from './notification-filter-editor';
    7 │ 
  
  i Unused imports might be the result of an incomplete refactoring.
  
  i Unsafe fix: Remove the unused imports.
  
    5 │ import·type·{·CustomFilter,·NotificationReason·}·from·'@/types';
      │                             -------------------                 

src/components/ui/dialog.tsx:72:5 lint/a11y/noStaticElementInteractions ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ! Static Elements should not be interactive.
  
    71 │   return (
  > 72 │     <div
       │     ^^^^
  > 73 │       role="presentation"
        ...
  > 86 │       {...props}
  > 87 │     />
       │     ^^
    88 │   );
    89 │ }
  
  i To add interactivity such as a mouse or key event listener to a static element, give the element an appropriate role value.
  

.claude/settings.json internalError/io  INTERNAL  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  × stream did not contain valid UTF-8
  
  ! This diagnostic was derived from an internal Biome error. Potential bug, please report it if necessary.
  

Checked 126 files in 428ms. No fixes applied.
Found 3 warnings.
Found 1 info.

/workspace/github-notify/src/components/inbox/inbox-item.tsx
  31:17  warning  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components

✖ 1 problem (0 errors, 1 warning)

[exit code: 0]
```

## pnpm test -- --run
```text
$ pnpm test -- --run
mise ERROR error parsing config file: /workspace/github-notify/.mise.toml
mise ERROR Config files in /workspace/github-notify/.mise.toml are not trusted.
Trust them with `mise trust`. See https://mise.en.dev/cli/trust.html for more information.
mise ERROR Run with --verbose or MISE_VERBOSE=1 for more information
 WARN  Unsupported engine: wanted: {"node":">=25.6.1"} (current: {"node":"v20.20.2","pnpm":"9.15.0"})

> github-notify@0.0.0 test /workspace/github-notify
> vitest "--run"


 RUN  v4.1.5 /workspace/github-notify


 Test Files  28 passed (28)
      Tests  512 passed (512)
   Start at  15:15:02
   Duration  34.15s (transform 3.23s, setup 4.02s, import 10.79s, tests 14.45s, environment 23.72s)

[exit code: 0]
```

## Real-device Tauri E2E
```text
Not run: this cloud environment cannot perform real-device Tauri OAuth/PAT login or external-account secret flows. Per request, only the code/test portions were applied.
```
