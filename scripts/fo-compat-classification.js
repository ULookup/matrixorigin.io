/**
 * Per-page mysql_compat classification for
 * `docs/MatrixOne/Reference/Functions-and-Operators/**`.
 *
 * Source of truth: `docs/MatrixOne/Overview/feature/mysql-compatibility.md`
 * cross-checked against MySQL 8.0 documentation. Any page not listed here
 * falls back to `mysql_compat: unknown` and is reported at the end of the
 * upgrade run so a human can triage it.
 *
 * Keys are paths relative to Functions-and-Operators/.
 */

// Default per-top-level-subdir classification.
// A file listed explicitly in FILE_OVERRIDES wins over this default.
export const DIR_DEFAULTS = {
  // Vector types and vector-distance / vector-norm / cluster functions
  // are MatrixOne extensions (see compat doc: Data Types — "MatrixOne
  // supports vector types").
  'Vector':              { compat: 'mo_only', mo_only_notes: ['Vector type and related distance/norm/clustering functions are MatrixOne extensions (compat doc: Data Types — "MatrixOne supports vector types").'] },

  // Table-valued functions: MySQL has no equivalent generate_series / unnest.
  'Table':               { compat: 'mo_only', mo_only_notes: ['Table-valued function; no direct MySQL equivalent.'] },

  // system-ops returns current role/user/log/version etc. Compat doc
  // explicitly lists these under "System Management functions".
  'system-ops':          { compat: 'mo_only', mo_only_notes: ['MatrixOne multi-account/role system management function (compat doc: System Management Functions).'] },

  // Window functions — compat doc is explicit: "Only RANK, DENSE_RANK,
  // ROW_NUMBER are supported".
  'Window-Functions':    { compat: 'full' },

  // Strings / Regex / Datetime / Math / Aggregate / Json / Other have a
  // mix of standard MySQL functions and MO extensions; per-file overrides
  // handle the non-standard entries below.
}

// Explicit per-file classification. Entries override DIR_DEFAULTS.
// Path is relative to Functions-and-Operators/. Compat column values
// follow the check-compat-frontmatter allowlist: full | partial | none |
// mo_only | unknown.
//
// Rationale for each non-full entry is captured in `differs` (for partial)
// or `mo_only_notes` (for mo_only).
export const FILE_OVERRIDES = {
  // === Aggregate functions ===
  // Standard MySQL 8.0 aggregates — behave identically.
  'Aggregate-Functions/any-value.md':    { compat: 'full' },
  'Aggregate-Functions/avg.md':          { compat: 'full' },
  'Aggregate-Functions/bit_and.md':      { compat: 'full' },
  'Aggregate-Functions/bit_or.md':       { compat: 'full' },
  'Aggregate-Functions/bit_xor.md':      { compat: 'full' },
  'Aggregate-Functions/count.md':        { compat: 'full' },
  'Aggregate-Functions/group-concat.md': { compat: 'full' },
  'Aggregate-Functions/max.md':          { compat: 'full' },
  'Aggregate-Functions/min.md':          { compat: 'full' },
  'Aggregate-Functions/stddev_pop.md':   { compat: 'full' },
  'Aggregate-Functions/sum.md':          { compat: 'full' },
  'Aggregate-Functions/var_pop.md':      { compat: 'full' },
  'Aggregate-Functions/variance.md':     { compat: 'full' },
  // MO-only aggregates — compat doc: "Support MatrixOne-specific Median function".
  'Aggregate-Functions/median.md':       { compat: 'mo_only', mo_only_notes: ['MEDIAN aggregate is a MatrixOne-specific aggregate (no native MySQL equivalent).'] },
  'Aggregate-Functions/bitmap.md':       { compat: 'mo_only', mo_only_notes: ['BITMAP aggregates are MatrixOne extensions.'] },

  // === Datetime ===
  'Datetime/convert-tz.md':         { compat: 'full' },
  'Datetime/curdate.md':            { compat: 'full' },
  'Datetime/current-timestamp.md':  { compat: 'full' },
  'Datetime/date-add.md':           { compat: 'full' },
  'Datetime/date-format.md':        { compat: 'full' },
  'Datetime/date-sub.md':           { compat: 'full' },
  'Datetime/date.md':               { compat: 'full' },
  'Datetime/datediff.md':           { compat: 'full' },
  'Datetime/day.md':                { compat: 'full' },
  'Datetime/dayofyear.md':          { compat: 'full' },
  'Datetime/extract.md':            { compat: 'full' },
  'Datetime/from-unixtime.md':      { compat: 'full' },
  'Datetime/hour.md':               { compat: 'full' },
  'Datetime/minute.md':             { compat: 'full' },
  'Datetime/month.md':              { compat: 'full' },
  'Datetime/now.md':                { compat: 'full' },
  'Datetime/second.md':             { compat: 'full' },
  'Datetime/str-to-date.md':        { compat: 'full' },
  'Datetime/sysdate.md':            { compat: 'full' },
  'Datetime/time.md':               { compat: 'full' },
  'Datetime/timediff.md':           { compat: 'full' },
  'Datetime/timestamp.md':          { compat: 'partial', differs: ['MatrixOne TIMESTAMP range is \'0001-01-01\'–\'9999-12-31\' vs MySQL \'1970-01-01\'–\'2038-01-19\' (compat doc: Data Types).'] },
  'Datetime/timestampdiff.md':      { compat: 'full' },
  'Datetime/to-days.md':            { compat: 'full' },
  'Datetime/to-seconds.md':         { compat: 'full' },
  'Datetime/unix-timestamp.md':     { compat: 'full' },
  'Datetime/utc-timestamp.md':      { compat: 'full' },
  'Datetime/week.md':               { compat: 'full' },
  'Datetime/weekday.md':            { compat: 'full' },
  'Datetime/year.md':               { compat: 'full' },
  // Compat doc: "MatrixOne's TO_DATE function is the same as MySQL's STR_TO_DATE function."
  'Datetime/to-date.md':            { compat: 'mo_only', mo_only_notes: ['TO_DATE is a MatrixOne alias for MySQL STR_TO_DATE (compat doc: Date and Time Functions). MySQL\'s own TO_DATE does not exist.'] },

  // === JSON ===
  // Compat doc: "Only JSON_UNQUOTE, JSON_QUOTE, JSON_EXTRACT are supported".
  'Json/json_extract.md':            { compat: 'full' },
  'Json/json_quote.md':              { compat: 'full' },
  'Json/json_unquote.md':            { compat: 'full' },
  // MO-only JSON helpers.
  'Json/json_extract_string.md':     { compat: 'mo_only', mo_only_notes: ['MatrixOne convenience wrapper returning a string result directly.'] },
  'Json/json_extract_float64.md':    { compat: 'mo_only', mo_only_notes: ['MatrixOne convenience wrapper returning FLOAT64 directly.'] },
  'Json/json_row.md':                { compat: 'mo_only', mo_only_notes: ['MatrixOne-only; no MySQL equivalent.'] },
  'Json/json_set.md':                { compat: 'mo_only', mo_only_notes: ['MatrixOne-implemented extension; compat doc lists only JSON_UNQUOTE, JSON_QUOTE, JSON_EXTRACT as MySQL-compatible JSON functions.'] },
  'Json/jq.md':                      { compat: 'mo_only', mo_only_notes: ['MatrixOne integration of the jq JSON query language; no MySQL equivalent.'] },
  'Json/try_jq.md':                  { compat: 'mo_only', mo_only_notes: ['MatrixOne integration of the jq JSON query language; no MySQL equivalent.'] },

  // === Math ===
  'Mathematical/abs.md':     { compat: 'full' },
  'Mathematical/acos.md':    { compat: 'full' },
  'Mathematical/atan.md':    { compat: 'full' },
  'Mathematical/ceil.md':    { compat: 'full' },
  'Mathematical/ceiling.md': { compat: 'full' },
  'Mathematical/cos.md':     { compat: 'full' },
  'Mathematical/cot.md':     { compat: 'full' },
  'Mathematical/crc32.md':   { compat: 'full' },
  'Mathematical/exp.md':     { compat: 'full' },
  'Mathematical/floor.md':   { compat: 'full' },
  'Mathematical/ln.md':      { compat: 'full' },
  'Mathematical/log.md':     { compat: 'full' },
  'Mathematical/log10.md':   { compat: 'full' },
  'Mathematical/log2.md':    { compat: 'full' },
  'Mathematical/pi.md':      { compat: 'full' },
  'Mathematical/power.md':   { compat: 'full' },
  'Mathematical/rand.md':    { compat: 'full' },
  'Mathematical/round.md':   { compat: 'full' },
  'Mathematical/sin.md':     { compat: 'full' },
  'Mathematical/sinh.md':    { compat: 'full' },
  'Mathematical/tan.md':     { compat: 'full' },

  // === Other ===
  // MatrixOne LOAD_FILE() takes a DATALINK value (stage:// or file:// URL cast
  // to datalink), not a plain filesystem path as MySQL does. The semantics
  // are materially different.
  'Other/load_file.md':      { compat: 'mo_only', mo_only_notes: ['LOAD_FILE() takes a DATALINK value (file:// or stage:// URL) rather than MySQL\'s plain filesystem path argument; semantics differ.'] },
  'Other/sleep.md':           { compat: 'full' },
  'Other/uuid.md':            { compat: 'full' },
  'Other/sample.md':          { compat: 'mo_only', mo_only_notes: ['SAMPLE() is a MatrixOne sampling operator; no MySQL equivalent.'] },
  'Other/stage_list.md':      { compat: 'mo_only', mo_only_notes: ['STAGE_LIST() lists MatrixOne stage contents.'] },
  'Other/save_file.md':       { compat: 'mo_only', mo_only_notes: ['SAVE_FILE() writes to a MatrixOne stage; no MySQL equivalent.'] },
  'Other/serial_extract.md':  { compat: 'mo_only', mo_only_notes: ['SERIAL_EXTRACT() is a MatrixOne internal serial-column extractor.'] },

  // === String ===
  'String/bin.md':          { compat: 'full' },
  'String/bit-length.md':   { compat: 'full' },
  'String/char-length.md':  { compat: 'full' },
  'String/concat-ws.md':    { compat: 'full' },
  'String/concat.md':       { compat: 'full' },
  'String/field.md':        { compat: 'full' },
  'String/find-in-set.md':  { compat: 'full' },
  'String/format.md':       { compat: 'full' },
  'String/from_base64.md':  { compat: 'full' },
  'String/hex.md':          { compat: 'full' },
  'String/instr.md':        { compat: 'full' },
  'String/lcase.md':        { compat: 'full' },
  'String/left.md':         { compat: 'full' },
  'String/length.md':       { compat: 'full' },
  'String/locate.md':       { compat: 'full' },
  'String/lower.md':        { compat: 'full' },
  'String/lpad.md':         { compat: 'full' },
  'String/ltrim.md':        { compat: 'full' },
  'String/md5.md':          { compat: 'full' },
  'String/oct.md':          { compat: 'full' },
  'String/repeat.md':       { compat: 'full' },
  'String/reverse.md':      { compat: 'full' },
  'String/rpad.md':         { compat: 'full' },
  'String/rtrim.md':        { compat: 'full' },
  'String/sha1.md':         { compat: 'full' },
  'String/sha2.md':         { compat: 'full' },
  'String/space.md':        { compat: 'full' },
  'String/strcmp.md':       { compat: 'full' },
  'String/substring-index.md': { compat: 'full' },
  'String/substring.md':    { compat: 'full' },
  'String/to_base64.md':    { compat: 'full' },
  'String/trim.md':         { compat: 'full' },
  'String/ucase.md':        { compat: 'full' },
  'String/unhex.md':        { compat: 'full' },
  'String/upper.md':        { compat: 'full' },
  // MO-only string helpers.
  'String/empty.md':        { compat: 'mo_only', mo_only_notes: ['EMPTY() is a MatrixOne helper returning whether a string is empty.'] },
  'String/endswith.md':     { compat: 'mo_only', mo_only_notes: ['ENDSWITH() is a MatrixOne helper; MySQL has no direct equivalent.'] },
  'String/startswith.md':   { compat: 'mo_only', mo_only_notes: ['STARTSWITH() is a MatrixOne helper; MySQL has no direct equivalent.'] },
  'String/split_part.md':   { compat: 'mo_only', mo_only_notes: ['SPLIT_PART() is inherited from PostgreSQL; no MySQL equivalent.'] },

  // === Regex (under String/) ===
  'String/Regular-Expressions/Regular-Expression-Functions-Overview.md': { compat: 'full' },
  'String/Regular-Expressions/not-regexp.md':     { compat: 'full' },
  'String/Regular-Expressions/regexp-instr.md':   { compat: 'full' },
  'String/Regular-Expressions/regexp-like.md':    { compat: 'full' },
  'String/Regular-Expressions/regexp-replace.md': { compat: 'full' },
  'String/Regular-Expressions/regexp-substr.md':  { compat: 'full' },

  // === system-ops === (use DIR_DEFAULTS mo_only, but version() is standard)
  'system-ops/version.md':          { compat: 'full' },
  // The remaining system-ops/*.md inherit mo_only from DIR_DEFAULTS.

  // === Overview page ===
  'matrixone-function-list.md':     { compat: 'mo_only', mo_only_notes: ['Listing page (includes MatrixOne-only functions).'] },
}

export function classify(relPath) {
  if (FILE_OVERRIDES[relPath]) return FILE_OVERRIDES[relPath]
  const topDir = relPath.split('/')[0]
  if (DIR_DEFAULTS[topDir]) return { ...DIR_DEFAULTS[topDir] }
  return { compat: 'unknown' }
}
