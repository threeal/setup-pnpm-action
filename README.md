# Setup pnpm Action

Set up [pnpm](https://pnpm.io/) with a specified version in [GitHub Actions](https://github.com/features/actions).

This action installs the standalone version of pnpm from the [GitHub releases](https://github.com/pnpm/pnpm/releases) page, allowing pnpm to be used as both a package manager and a Node.js version manager (see [pnpm env](https://pnpm.io/cli/env)).

## Available Inputs

The following input parameters are available for this action:

| Name      | Type                  | Description                                         |
| --------- | --------------------- | --------------------------------------------------- |
| `version` | Version number or tag | The pnpm version to install (defaults to `latest`). |

## Example Usage

Here's a basic example of how to use this action to set up the latest version of pnpm in a GitHub Actions workflow:

```yaml
name: CI
on:
  push:
jobs:
  build:
    name: Build Project
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout Project
        uses: actions/checkout@v4.2.2

      - name: Setup pnpm
        uses: threeal/setup-pnpm-action@v1.0.0

      - name: Check pnpm
        run: pnpm --version
```

## License

This project is licensed under the terms of the [MIT License](./LICENSE).

Copyright © 2025 [Alfi Maulana](https://github.com/threeal)
