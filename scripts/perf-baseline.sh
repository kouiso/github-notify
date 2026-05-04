#!/usr/bin/env bash
# perf-baseline.sh — G-10: パフォーマンスベースライン計測スクリプト
#
# 使い方: ./scripts/perf-baseline.sh [binary-path]
# デフォルト: src-tauri/target/release/github-notify
#
# 計測項目:
#   1. コールドスタート → ウィンドウ表示 (許容: 2.0秒以内)
#   2. ポーリング1サイクル CPU 使用率 (許容: 瞬間5%以下 / 平均1%以下)
#   3. アイドル時メモリ常駐 (許容: 200MB以下)
#
# 出力: docs/perf-baseline.json

set -euo pipefail

BINARY="${1:-src-tauri/target/release/github-notify}"
RESULTS_FILE="docs/perf-baseline.json"
MEASURE_DURATION=10  # seconds to measure CPU/memory

echo "=== GitHub Notify Performance Baseline ==="
echo "Binary: $BINARY"
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# Verify binary exists
if [ ! -f "$BINARY" ]; then
  echo "ERROR: Binary not found at $BINARY"
  echo "Run 'cargo build --release' in src-tauri/ first."
  exit 1
fi

mkdir -p docs

# --- 1. Cold Start Time ---
echo "[1/3] Measuring cold start time..."
COLD_START_MS=""

# Launch the app and measure time until process is running
START_TIME=$(python3 -c "import time; print(int(time.time() * 1000))")
"$BINARY" &
APP_PID=$!

# Wait for the process to be fully loaded (window creation)
sleep 0.5
for i in $(seq 1 20); do
  if ps -p "$APP_PID" > /dev/null 2>&1; then
    # Check if the process has created a window (macOS specific)
    if lsof -p "$APP_PID" 2>/dev/null | grep -q "WindowServer\|KQUEUE"; then
      break
    fi
  fi
  sleep 0.1
done
END_TIME=$(python3 -c "import time; print(int(time.time() * 1000))")
COLD_START_MS=$((END_TIME - START_TIME))

echo "  Cold start: ${COLD_START_MS}ms"

# --- 2. CPU Usage ---
echo "[2/3] Measuring CPU usage over ${MEASURE_DURATION}s..."
CPU_SAMPLES=()
for i in $(seq 1 "$MEASURE_DURATION"); do
  CPU=$(ps -p "$APP_PID" -o %cpu= 2>/dev/null | tr -d ' ' || echo "0.0")
  CPU_SAMPLES+=("$CPU")
  sleep 1
done

# Calculate peak and average
CPU_PEAK=$(printf '%s\n' "${CPU_SAMPLES[@]}" | sort -rn | head -1)
CPU_AVG=$(printf '%s\n' "${CPU_SAMPLES[@]}" | python3 -c "
import sys
vals = [float(x.strip()) for x in sys.stdin if x.strip()]
print(f'{sum(vals)/len(vals):.2f}' if vals else '0.00')
")

echo "  CPU peak: ${CPU_PEAK}%"
echo "  CPU avg:  ${CPU_AVG}%"

# --- 3. Memory Usage ---
echo "[3/3] Measuring memory usage..."
MEM_RSS_KB=$(ps -p "$APP_PID" -o rss= 2>/dev/null | tr -d ' ' || echo "0")
MEM_RSS_MB=$(python3 -c "print(f'{int(${MEM_RSS_KB}) / 1024:.1f}')")

echo "  Memory RSS: ${MEM_RSS_MB}MB"

# Cleanup: kill the app
kill "$APP_PID" 2>/dev/null || true
wait "$APP_PID" 2>/dev/null || true

# --- Write Results ---
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
PASS_COLD=$( [ "$COLD_START_MS" -le 2000 ] && echo "true" || echo "false" )
PASS_CPU_PEAK=$(python3 -c "print('true' if ${CPU_PEAK} <= 5.0 else 'false')")
PASS_CPU_AVG=$(python3 -c "print('true' if ${CPU_AVG} <= 1.0 else 'false')")
PASS_MEM=$(python3 -c "print('true' if ${MEM_RSS_MB} <= 200.0 else 'false')")

cat > "$RESULTS_FILE" <<ENDJSON
{
  "timestamp": "${TIMESTAMP}",
  "binary": "${BINARY}",
  "machine": "$(uname -m)",
  "os": "$(sw_vers -productVersion 2>/dev/null || uname -r)",
  "metrics": {
    "cold_start_ms": {
      "value": ${COLD_START_MS},
      "threshold": 2000,
      "unit": "ms",
      "pass": ${PASS_COLD}
    },
    "cpu_peak_percent": {
      "value": ${CPU_PEAK},
      "threshold": 5.0,
      "unit": "%",
      "pass": ${PASS_CPU_PEAK}
    },
    "cpu_avg_percent": {
      "value": ${CPU_AVG},
      "threshold": 1.0,
      "unit": "%",
      "pass": ${PASS_CPU_AVG}
    },
    "memory_rss_mb": {
      "value": ${MEM_RSS_MB},
      "threshold": 200,
      "unit": "MB",
      "pass": ${PASS_MEM}
    }
  }
}
ENDJSON

echo ""
echo "=== Results ==="
echo "  Cold start:  ${COLD_START_MS}ms (threshold: 2000ms) $([ "$PASS_COLD" = "true" ] && echo "PASS" || echo "FAIL")"
echo "  CPU peak:    ${CPU_PEAK}% (threshold: 5.0%) $([ "$PASS_CPU_PEAK" = "true" ] && echo "PASS" || echo "FAIL")"
echo "  CPU avg:     ${CPU_AVG}% (threshold: 1.0%) $([ "$PASS_CPU_AVG" = "true" ] && echo "PASS" || echo "FAIL")"
echo "  Memory RSS:  ${MEM_RSS_MB}MB (threshold: 200MB) $([ "$PASS_MEM" = "true" ] && echo "PASS" || echo "FAIL")"
echo ""
echo "Results saved to: $RESULTS_FILE"
