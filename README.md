### Erp

A configurable ERP for one education Trust operating multiple Campuses and Institutions, including
schools, arts and science colleges, engineering colleges, and medical colleges.

Built on Frappe v16, with a React/Vite SPA served at `/erp`.

### Docs

| Doc | For |
| --- | --- |
| [docs/METHOD.md](docs/METHOD.md) | How a feature slice gets built, start to finish |
| [docs/DATA-MODEL.md](docs/DATA-MODEL.md) | What exists today and the hierarchy contract |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Slice order |

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
