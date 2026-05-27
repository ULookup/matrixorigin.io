#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

print_success() { echo -e "${GREEN}==${NC} $1"; }
print_warning() { echo -e "${YELLOW}==${NC} $1"; }
print_error()   { echo -e "${RED}==${NC} $1"; }
print_info()    { echo -e "${CYAN}--${NC} $1"; }

# Bucket names (must match bucket-manifest.json keys)
BUCKETS=(
    "DDL"
    "DML"
    "DCL"
    "DQL-base"
    "DQL-apply"
    "Other-SQL"
    "Data-Types"
    "Func-String"
    "Func-Math"
    "Func-Datetime"
    "Func-Aggregate"
    "Func-Other"
    "Operators"
    "Misc"
)

MO_VERSION="${MO_VERSION:-3.0.13}"
OUTPUT_DIR="${REPO_ROOT}/audit-output-${MO_VERSION}"

usage() {
    echo "Usage: $0 {preflight|dispatch|merge|status|cleanup}"
    echo ""
    echo "Commands:"
    echo "  preflight  Start MO ${MO_VERSION} Docker, create audit databases"
    echo "  dispatch   Print agent dispatch instructions (28 agents + 1 merge)"
    echo "  merge      Run the merge agent on collected reports"
    echo "  status     Check which reports exist in ${OUTPUT_DIR}"
    echo "  cleanup    Stop MO container, remove audit databases"
    echo ""
    echo "Environment:"
    echo "  MO_VERSION   Target MatrixOne version (default: 3.0.13)"
}

# ---- Pre-flight ----

do_preflight() {
    echo "============================================================"
    echo " Pre-flight: MO ${MO_VERSION}"
    echo "============================================================"

    # 1. Start MO Docker
    print_info "Starting MO ${MO_VERSION} Docker..."
    cd "$REPO_ROOT"
    bash scripts/mo-test-env.sh start "$MO_VERSION"

    # 2. Wait for readiness
    print_info "Waiting for MO to be ready..."
    sleep 5
    for i in $(seq 1 30); do
        if mysql -h127.0.0.1 -P6001 -uroot -p111 -e "SELECT 1" >/dev/null 2>&1; then
            print_success "MO is ready"
            break
        fi
        sleep 2
    done

    # 3. Create isolated databases
    print_info "Creating audit databases..."
    for bucket in "${BUCKETS[@]}"; do
        local db_name="audit_${bucket//-/_}"
        mysql -h127.0.0.1 -P6001 -uroot -p111 -e "DROP DATABASE IF EXISTS \`${db_name}\`; CREATE DATABASE \`${db_name}\`;" 2>/dev/null
        print_success "Database ${db_name} created"
    done

    # 4. Create output directory
    mkdir -p "$OUTPUT_DIR"
    print_success "Output dir: ${OUTPUT_DIR}"

    # 5. Verify bucket-manifest.json
    if [ ! -f "$REPO_ROOT/bucket-manifest.json" ]; then
        print_error "bucket-manifest.json not found!"
        exit 1
    fi
    local file_count
    file_count=$(python3 -c "import json; m=json.load(open('$REPO_ROOT/bucket-manifest.json')); print(m['total_files'])")
    print_success "bucket-manifest.json has ${file_count} files across ${#BUCKETS[@]} buckets"
}

# ---- Dispatch ----

do_dispatch() {
    echo "============================================================"
    echo " Agent Dispatch Instructions"
    echo "============================================================"
    echo ""
    echo "Output directory: ${OUTPUT_DIR}"
    echo ""
    echo "--- STATIC AGENTS (14) ---"
    echo ""
    for bucket in "${BUCKETS[@]}"; do
        local prompt_file="${SCRIPT_DIR}/prompts/static-agent.md"
        local prompt_content
        prompt_content=$(sed "s/{{BUCKET_NAME}}/${bucket}/g" "$prompt_file")
        echo "### static-${bucket}"
        echo "Prompt: ${prompt_file} (with BUCKET_NAME=${bucket})"
        echo "Output: ${OUTPUT_DIR}/static-${bucket}-report.json"
        echo ""
    done

    echo "--- LIVE AGENTS (14) ---"
    echo ""
    for bucket in "${BUCKETS[@]}"; do
        local prompt_file="${SCRIPT_DIR}/prompts/live-agent.md"
        local prompt_content
        prompt_content=$(sed "s/{{BUCKET_NAME}}/${bucket}/g" "$prompt_file")
        local db_name="audit_${bucket//-/_}"
        echo "### live-${bucket}"
        echo "Database: ${db_name}"
        echo "Prompt: ${prompt_file} (with BUCKET_NAME=${bucket})"
        echo "Output: ${OUTPUT_DIR}/live-${bucket}-report.json"
        echo ""
    done

    echo "--- DISPATCH PLAN ---"
    echo ""
    echo "Launch all 28 agents in parallel as background agents."
    echo "Each agent:"
    echo "  1. Read its prompt file (already parameterized with bucket name)"
    echo "  2. Execute verification"
    echo "  3. Write JSON report to ${OUTPUT_DIR}/"
    echo ""
    echo "After all 28 complete (or timeout):"
    echo "  Run: $0 merge"
    echo ""
    echo "--- AGENT DISPATCH COMMANDS ---"
    echo ""
    echo "For each bucket, dispatch two agents concurrently:"
    echo ""
    echo '```'
    echo '# Example for bucket DDL:'
    echo ''
    echo '# Static agent:'
    echo 'cat scripts/verify-mo313/prompts/static-agent.md | sed "s/{{BUCKET_NAME}}/DDL/g"'
    echo ''
    echo '# Live agent:'
    echo 'cat scripts/verify-mo313/prompts/live-agent.md | sed "s/{{BUCKET_NAME}}/DDL/g"'
    echo '```'
}

# ---- Merge ----

do_merge() {
    echo "============================================================"
    echo " Merge Reports"
    echo "============================================================"

    # Count available reports
    local static_count live_count
    static_count=$(ls "${OUTPUT_DIR}"/static-*-report.json 2>/dev/null | wc -l | tr -d ' ')
    live_count=$(ls "${OUTPUT_DIR}"/live-*-report.json 2>/dev/null | wc -l | tr -d ' ')

    print_info "Static reports found: ${static_count}/14"
    print_info "Live reports found: ${live_count}/14"

    if [ "$static_count" -eq 0 ] && [ "$live_count" -eq 0 ]; then
        print_error "No reports found in ${OUTPUT_DIR}"
        exit 1
    fi

    print_info "To run the merge, provide the merge agent prompt to a Claude Code agent:"
    echo ""
    echo "  Prompt file: scripts/verify-mo313/prompts/merge-agent.md"
    echo "  Input dir: ${OUTPUT_DIR}"
    echo "  Output: ${OUTPUT_DIR}/final-report.json"
}

# ---- Status ----

do_status() {
    echo "Report Status for MO ${MO_VERSION}:"
    echo ""

    for bucket in "${BUCKETS[@]}"; do
        local s_ok l_ok
        if [ -f "${OUTPUT_DIR}/static-${bucket}-report.json" ]; then
            s_ok="${GREEN}DONE${NC}"
        else
            s_ok="${RED}MISS${NC}"
        fi
        if [ -f "${OUTPUT_DIR}/live-${bucket}-report.json" ]; then
            l_ok="${GREEN}DONE${NC}"
        else
            l_ok="${RED}MISS${NC}"
        fi
        printf "  %-15s  static: %b  live: %b\n" "$bucket" "$s_ok" "$l_ok"
    done

    if [ -f "${OUTPUT_DIR}/final-report.json" ]; then
        echo ""
        print_success "final-report.json exists"
    fi
}

# ---- Cleanup ----

do_cleanup() {
    print_info "Stopping MO container..."
    cd "$REPO_ROOT"
    bash scripts/mo-test-env.sh stop
    print_success "Cleanup complete"
}

# ---- Main ----

case "${1:-}" in
    preflight) do_preflight ;;
    dispatch)  do_dispatch ;;
    merge)     do_merge ;;
    status)    do_status ;;
    cleanup)   do_cleanup ;;
    *)
        usage
        exit 1
        ;;
esac
