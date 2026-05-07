<div align="center">
  <img src="docs/assets/new-logo.png" alt="MatrixOne Logo" width="200"/>
  
  # MatrixOne Documentation
  
  [![Website](https://img.shields.io/badge/Website-docs.matrixorigin.cn-blue)](https://docs.matrixorigin.cn/en/)
  [![License](https://img.shields.io/badge/License-Apache%202.0-green.svg)](LICENSE)
  [![GitHub Stars](https://img.shields.io/github/stars/matrixorigin/matrixone)](https://github.com/matrixorigin/matrixone)
  
  **Official documentation repository for MatrixOne Database**
  
  [📖 Documentation](https://docs.matrixorigin.cn/en/) | [🚀 Quick Start](#quick-start) | [🤝 Contributing](CONTRIBUTING.md) | [💬 Discussions](https://github.com/matrixorigin/matrixone/discussions)
  
</div>

---

## 📚 About

This repository contains all the source files for the **MatrixOne documentation website**. 

### What is MatrixOne?

**MatrixOne** is a **hyperconverged cloud-edge native database** designed to consolidate transactional (TP), analytical (AP), and streaming workloads into a single system. It features:

#### 🎯 Core Capabilities

- **🔄 Hyper-Converged Engine**: Single database supporting OLTP, OLAP, time-series, and machine learning workloads
- **☁️ Cloud-Edge Native**: Deploy across public clouds, private clouds, edge, and on-premises with seamless scalability
- **⚡ Extreme Performance**: Vectorized execution engine with high-performance distributed transactions
- **🌍 Multi-Tenancy**: Complete tenant isolation with independent resource management
- **📊 Real-time HTAP**: Handle mixed transactional and analytical workloads with real-time consistency
- **🔌 MySQL Compatibility**: Compatible with MySQL protocol and syntax for easy migration

#### 💡 Key Benefits

- **Simplify Architecture**: Replace multiple databases (MySQL, PostgreSQL, ClickHouse, etc.) with one unified system
- **Reduce Costs**: Lower infrastructure and operational costs through consolidation
- **Accelerate Development**: Faster development with unified data platform
- **Ensure Consistency**: Global distributed transactions guarantee data consistency
- **Scale Effortlessly**: Separate storage and compute for elastic scaling

MatrixOne is ideal for scenarios requiring real-time data processing, large-scale analytics, multi-cloud deployment, and mixed workloads.

### 🌐 Live Documentation

Visit our documentation at: **[docs.matrixorigin.cn](https://docs.matrixorigin.cn/en/)**

### 🐛 Found an Issue?

We appreciate your feedback! If you find any documentation issues:
- 📝 [Create an Issue](https://github.com/matrixorigin/matrixorigin.io/issues/new) to let us know
- 🔧 [Submit a Pull Request](https://github.com/matrixorigin/matrixorigin.io/pulls) to help fix it directly

## 🤖 For AI Agents

These docs are built to be consumed by LLM-driven clients (Cursor, Claude Code, ChatGPT, MCP servers). Three machine-readable artifacts ship alongside the HTML site:

| URL | Purpose |
|---|---|
| `https://docs.matrixorigin.io/llms.txt` | Curated index in the [llmstxt.org](https://llmstxt.org) format. Paste into Cursor / Claude / ChatGPT to load MatrixOne context. |
| `https://docs.matrixorigin.io/llms-full.txt` | Whole corpus concatenated into one markdown file — drop into a long-context model for full coverage. |
| `https://docs.matrixorigin.io/<path>.md` | Every HTML page has a matching raw markdown mirror at the same path. |

Additionally, the `mysql_compat` frontmatter on every SQL-Reference page feeds the [MySQL Compatibility Matrix](https://docs.matrixorigin.io/MatrixOne/Reference/mysql-compatibility-matrix.md) — agents should consult it before assuming MySQL 8.0 syntax works on MatrixOne. Every SQL example is validated against the `3.0-dev` nightly image by `scripts/doc-validator` on every pull request.

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- Node.js 18+ and pnpm

### Get Started

```bash
# Install dependencies
make install

# Start development server
make serve
```

Open **[http://127.0.0.1:8000](http://127.0.0.1:8000)** to preview the documentation.

### Common Commands

| Command | Description |
|---------|-------------|
| `make install` | Install all dependencies |
| `make serve` | Start local server |
| `make build` | Build static site |
| `make lint` | Check code style |
| `make lint-fix` | Auto-fix style issues |
| `make clean` | Clean build artifacts |
| `make check-all` | Run all checks (lint + links + SQL syntax) |
| `make pre-commit` | Run pre-commit checks |
| `make setup` | Complete setup (install + validate) |

Run `make help` to see all available commands.

## 🔍 Documentation Validation Tool

This repository includes a documentation validation tool for Dead Link, SQL syntax, and SQL execution checking.

### Quick Usage (Makefile Commands)

```bash
# 🔗 Dead Link Checking
make check-links                    # Check all files
make check-links-changed            # Check changed files only
make check-links-file FILE=path    # Check specific file

# 🧾 SQL Syntax Checking
make check-sql-syntax               # Check all files
make check-sql-syntax-changed       # Check changed files only
make check-sql-syntax-file FILE=path # Check specific file

# ▶️ SQL Execution Checking (requires database)
# Option 1: Use test database (automated start/stop)
make db-start                       # Start test database
make db-start VERSION=3.0.4        # Start specific version
make check-sql-exec-changed         # Check changed files
make check-sql-exec-file FILE=path  # Check specific file
make db-stop                        # Stop test database

# Option 2: Use existing MatrixOne instance (skip start/stop)
make db-test                        # Verify database connection first
make check-sql-exec-changed         # Check changed files (uses existing DB)
make check-sql-exec-file FILE=path  # Check specific file
# Note: If MatrixOne is already running at 127.0.0.1:6001, 
#       you can skip db-start and db-stop steps

# 🔄 Comprehensive Checks
make check-all                      # Run all checks (lint + links + SQL syntax)
make validate-all                   # Full validation (lint + build + checks)
make pre-commit                     # Pre-commit checks (lint-fix + check-all)
```

### Alternative: Direct pnpm Commands

You can also use pnpm commands directly:

```bash
# 🔗 Dead Link 检测
pnpm run check:links:file docs/MatrixOne/xxx.md      # 单文件
pnpm run check:links:changed                          # 变更文件

# 🧾 SQL 语法检测
pnpm run check:sql-syntax:file docs/MatrixOne/xxx.md # 单文件
pnpm run check:sql-syntax:changed                     # 变更文件

# ▶️ SQL 执行检测
# 选项 1: 使用测试数据库（自动启动/停止）
pnpm run db:start                                     # 启动测试数据库
pnpm run db:start 3.0.4                               # 启动指定版本
pnpm run check:sql-exec:file docs/MatrixOne/xxx.md   # 单文件
pnpm run check:sql-exec:changed                       # 变更文件
pnpm run db:stop                                      # 停止测试数据库

# 选项 2: 使用已有的 MatrixOne 实例（跳过启动/停止）
pnpm run db:test                                       # 先验证数据库连接
pnpm run check:sql-exec:changed                       # 检查变更文件（使用已有数据库）
# 注意: 如果 MatrixOne 已在 127.0.0.1:6001 运行，
#       可以跳过 db:start 和 db:stop 步骤
```

💡 For more details, see [Documentation Validation Tool Guide](scripts/doc-validator/README.md)

## 📝 Development Workflow

### Initial Setup

```bash
# 1. Clone the repository
git clone https://github.com/matrixorigin/matrixorigin.io.git
cd matrixorigin.io

# 2. Install dependencies
make install

# 3. Validate setup
make setup
```

### Daily Development Workflow

#### Step 1: Make Changes
Edit documentation files in `docs/MatrixOne/` directory.

#### Step 2: Preview Locally
```bash
make serve
# Open http://127.0.0.1:8000 in your browser to preview
```

#### Step 3: Run Pre-commit Checks
Before committing, run comprehensive checks:

```bash
make pre-commit
```

This command automatically:
- ✅ Auto-fixes linting issues (punctuation, markdown style)
- ✅ Checks linting compliance
- ✅ Checks dead links in changed files
- ✅ Checks SQL syntax in changed files

#### Step 4: (Optional) Full Validation
For thorough validation before pushing:

```bash
make validate-all
```

This includes:
- Linting checks
- Build test (ensures site builds correctly)
- Dead link checks
- SQL syntax checks

#### Step 5: Commit Changes
```bash
git add .
git commit -m "Your commit message"
```

#### Step 6: (Optional) Test SQL Execution
If your changes include SQL examples, test their execution:

**Option A: Use Test Database (Recommended for CI/CD)**
```bash
# Start test database
make db-start

# Check SQL execution in changed files
make check-sql-exec-changed

# Stop test database
make db-stop
```

**Option B: Use Existing MatrixOne Instance**
If you already have MatrixOne running (locally or remotely), you can skip the start/stop steps:

```bash
# Check if your database is accessible
make db-test
# If successful, you can directly run:
make check-sql-exec-changed
# No need to start/stop database
```

> **💡 Using Existing Database**: 
> - If MatrixOne is already running at `127.0.0.1:6001` with user `root` and password `111`, you can skip `make db-start` and `make db-stop`
> - Use `make db-status` to check database status
> - Use `make db-test` to verify database connection
> - The validation tools will automatically connect to your existing database

#### Step 7: Push to Remote
```bash
git push
```

### Quick Reference

| Task | Command | Notes |
|------|---------|-------|
| **Setup** | | |
| Setup project | `make setup` | Install + validate |
| **Development** | | |
| Start dev server | `make serve` | Preview at http://127.0.0.1:8000 |
| **Validation** | | |
| Pre-commit check | `make pre-commit` | Auto-fix + all checks |
| Run all checks | `make check-all` | Lint + links + SQL syntax |
| Full validation | `make validate-all` | Includes build test |
| Check specific file | `make check-links-file FILE=path` | Replace `path` with file path |
| **Database** | | |
| Check database status | `make db-status` | See if database is running |
| Test connection | `make db-test` | Verify database accessibility |
| Start test database | `make db-start` | Start test environment |
| Start specific version | `make db-start VERSION=3.0.4` | Use specific MatrixOne version |
| Stop database | `make db-stop` | Stop test environment |
| **SQL Execution** | | |
| Check SQL execution | `make check-sql-exec-changed` | Requires running database |

### Workflow Tips

1. **Quick Check Before Commit**: Use `make pre-commit` - it's the fastest way to ensure your changes are ready
2. **Using Existing Database**: If you have MatrixOne running, check with `make db-test` first, then skip start/stop steps
3. **Check Specific Files**: Use `FILE=path/to/file.md` parameter for targeted checks
4. **Full Validation**: Run `make validate-all` before important commits or PRs

> 💡 **Tip**: For more detailed usage and advanced options, see [Documentation Validation Tool Guide](scripts/doc-validator/README.md).

## 🤝 Contributing

We welcome contributions! See [Contributing Guide](CONTRIBUTING.md) for details.

## 📜 License

Apache License 2.0 - see [LICENSE](LICENSE) for details.

---

<div align="center">
  
  **Built with ❤️ by the MatrixOne Team**
  
  ⭐ **Star us on GitHub!** ⭐
  
  [Website](https://www.matrixorigin.io) • [Documentation](https://docs.matrixorigin.cn/en/) • [GitHub](https://github.com/matrixorigin/matrixone) • [Community](https://matrixorigin.io/community)
  
</div>