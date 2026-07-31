### Erp

A multi-tenant ERP for education groups. One Institution runs many Campuses and many Colleges —
engineering, arts & science, polytechnic, medical, law and MBA colleges as well as K-12 schools —
through a single, profile-driven model.

Built on Frappe v16, with a React/Vite SPA served at `/erp`.

### Docs

Start at [docs/README.md](docs/README.md).

| Doc | For |
| --- | --- |
| [docs/METHOD.md](docs/METHOD.md) | How a feature slice gets built, start to finish |
| [docs/PRODUCT.md](docs/PRODUCT.md) | The domain — institution types, college/school vocabulary, personas |
| [docs/DATA-MODEL.md](docs/DATA-MODEL.md) | What exists today and the hierarchy contract |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Slice order |
| [docs/MODULES.md](docs/MODULES.md) | Modules and SPA navigation |

We build **features first**: no master is created without a feature slice that consumes it.

### Installation

You can install this app using the [bench](https://github.com/frappe/bench) CLI:

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch main
bench install-app erp
```

### Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/erp
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:

- ruff
- eslint
- prettier
- pyupgrade

### License

mit
