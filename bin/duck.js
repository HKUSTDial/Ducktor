#!/usr/bin/env node
// Ducktor hook script. Code in bin/ is MIT; see LICENSES/README.md.
// Two jobs:
//   session-start  tell the AI where the plugin lives and pass along the project's
//                  .duck/config.md; load the resident rules only when the project has
//                  turned the duck on (开关：on or quiet), otherwise a short idle note
//   allow          PreToolUse in Claude Code: let it read the plugin's own files (library/,
//                  cards/, handbook/ ...) and add to the records Ducktor keeps in the project's
//                  .duck/ (notebook, decisions, reports) without a permission prompt; anything
//                  else gets no answer, so the host asks as usual. Also the edit checkpoint
//                  (Claude Code only for now): the first edit of a text draft in a turn is refused
//                  once, with the reminder in rules/checkpoint.md. Codex stays off until its
//                  probes pass; turning it on takes DUCK_CODEX_CHECKPOINT=1 here, apply_patch in
//                  the PreToolUse matcher of hooks/claude-codex-hooks.json, and trusting the
//                  changed hook again in Codex's /hooks
// Rule text stays in rules/ (or the student's copy in .duck/skills/), never in this file.
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
// Characters of .duck/config.md passed through as-is. 1,000 holds the template and a few dozen
// lines of settings; past that the AI is told to read the file. (1,200 until 0.2.1: the rules
// grew, and the worst case must stay under the size test's 7,000.)
const CONFIG_LIMIT = 1000;

// Values the switch line may carry. The Chinese words are what students tend to type.
const MODES = {
  on: 'on', quiet: 'quiet', off: 'off',
  开: 'on', 打开: 'on', 开启: 'on', 启用: 'on', 静音: 'quiet', 安静: 'quiet', 关: 'off', 关闭: 'off', 关掉: 'off',
};
// A switch line looks like "开关：quiet", or "Switch: quiet" in a config written in English.
// Leading list marks, quotes, headings and bold are allowed.
const SWITCH_LINE = /^[\s>#*-]*\**(?:开关|switch)\**\s*[:：=]\s*(.*)$/gim;

// Line ends are made \n and a BOM is dropped, so a file saved on Windows reads the same.
function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  } catch (err) {
    return null;
  }
}

// Both hosts send the hook input as JSON on stdin; its cwd is the project directory.
function readInput() {
  if (process.stdin.isTTY) return {};
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch (err) {
    return {};
  }
}

// Returns { mode, note }. mode is on, quiet, off, or unset: the duck has not been turned
// on in this project (no file, no switch line, or a value we cannot read). Only an explicit
// on or quiet loads the resident rules; off is the same as not turned on. note is a sentence
// for the AI when the switch line was there but could not be read.
function modeOf(config) {
  if (!config) return { mode: 'unset', note: null };
  const seen = [];
  for (const m of config.matchAll(SWITCH_LINE)) {
    const value = m[1].replace(/\*/g, '').trim();
    const word = value.split(/[\s（(，,。.;；]/)[0].toLowerCase();
    if (MODES[word]) return { mode: MODES[word], note: null };
    seen.push(value);
  }
  if (seen.length === 0) return { mode: 'unset', note: null };
  return {
    mode: 'unset',
    note: `.duck/config.md 的开关行写的是「${seen[0]}」，只认 on、quiet、off，这次按没开启处理。请提醒学生改成这三个词之一。`,
  };
}

// The student's edited copy of the rules wins over the plugin's own. A copy made before
// 「每次都照做」 (0.1) or 「怎么讲」 (0.2.1) existed gets that section from the plugin, so turning
// the duck on never gives fewer of those rules than a command carries when it is off.
function coreRules(project) {
  const copy = path.join(project, '.duck', 'skills', 'core.md');
  const own = readText(copy);
  if (own !== null) {
    const parts = [own];
    const plugin = readText(path.join(ROOT, 'rules', 'core.md')) || '';
    for (const [heading, name] of [[EVERY_TIME, '每次都照做'], [HOW_TO_EXPLAIN, '怎么讲']]) {
      if (heading.test(own)) continue;
      const section = sectionOf(plugin, heading);
      if (section) parts.push(`${section}\n\n（上面「${name}」一节来自插件原版 rules/core.md：学生的副本里没有这一节。）`);
    }
    parts.push('（这份常驻规则是项目里的副本 .duck/skills/core.md，学生改过。原版在插件根目录的 rules/core.md。）');
    return parts.join('\n\n');
  }
  return readText(path.join(ROOT, 'rules', 'core.md')) || '（没读到 rules/core.md，常驻规则这次缺席。）';
}

// The 「每次都照做」 section of rules/core.md: the few rules that hold in every mode (the
// student's language, checking facts, pushback). A student's copy of the rules made before
// it existed gets it from the plugin. Commands carry it, with 「东西在哪」, in their own
// files (scripts/build.js copies both in), so a project that has not turned Ducktor on
// pays only for the short idle note.
const EVERY_TIME = /^##[ \t]*每次都照做[ \t]*$/m;
const HOW_TO_EXPLAIN = /^##[ \t]*怎么讲[ \t]*$/m;

// 「回复：短」 (English config: Reply: short) holds for every reply of every session. On the
// second day of an 11-04 trial the first reply of a new session came back long although the line
// was in the config passed through below, so the hook says it again in words.
// An English config (its switch line reads 「Switch:」) means the student works in English. The rules
// are in Chinese; on day 2 of an 11-04 re-test a new session answered an English question in
// Chinese although the student, the config and the records were all English. The reminder is
// itself in English.
const ENGLISH_CONFIG = /^[ \t>*-]*switch[ \t]*[:：]/im;

const SHORT_REPLIES = /^[ \t>*-]*(?:回复[ \t]*[:：][ \t]*短|reply[ \t]*:[ \t]*short)[ \t。.]*$/im;

// One "## " section of a rules file, heading included; '' when it is not there.
function sectionOf(text, heading) {
  const m = heading.exec(text);
  if (m === null) return '';
  const end = text.indexOf('\n## ', m.index + 1);
  return text.slice(m.index, end < 0 ? undefined : end).trim();
}

function buildContext(project) {
  const config = readText(path.join(project, '.duck', 'config.md'));
  const { mode, note } = modeOf(config);
  const parts = [`Ducktor 插件根目录：${ROOT}`];

  if (mode === 'unset' || mode === 'off') {
    // off is the same as not turned on: the idle note, and commands keep their why and records.
    parts.push(readText(path.join(ROOT, 'rules', 'idle.md')) || 'Ducktor 没在这个项目开启。');
  } else {
    parts.push(coreRules(project));
  }

  if (config !== null) {
    const shown = config.length > CONFIG_LIMIT
      ? `${config.slice(0, CONFIG_LIMIT)}\n……（后面太长没放进来，要用时直接读这个文件）`
      : config;
    const label = { unset: '没开启', off: 'off，和没开启一样' }[mode] || mode;
    parts.push(`项目的 .duck/config.md（开关：${label}）：\n${shown}`);
    if (note) parts.push(note);
    if (ENGLISH_CONFIG.test(config)) parts.push('The student works in English: reply in English, the first reply of this session included.');
    if (SHORT_REPLIES.test(config)) parts.push('学生要过回复写短（config.md 里的「回复：短」）：这次会话的每条回复都写短，十行以内。');
    if (config.includes('�')) parts.push('.duck/config.md 里有读不出的字节（可能不是 UTF-8 编码），开关可能没认对。');
  }
  return parts.join('\n\n');
}

function sessionStart() {
  const input = readInput();
  // Claude Code sets CLAUDE_PROJECT_DIR; Claude Code and Codex send cwd; Cursor sends workspace_roots.
  const roots = Array.isArray(input.workspace_roots) ? input.workspace_roots : [];
  // Claude Code's project root first: after `cd paper` the hook input's cwd moves, and a
  // hook rerun on compact, clear or resume would read paper/.duck/ instead.
  const project = [process.env.CLAUDE_PROJECT_DIR, input.cwd, roots[0]]
    .find((p) => typeof p === 'string' && p);
  return buildContext(project || process.cwd());
}

// True when target (a file or folder) sits inside the plugin root, symlinks resolved.
function insideRoot(target) {
  if (typeof target !== 'string' || !target) return false;
  let real;
  try {
    real = fs.realpathSync(path.resolve(target));
  } catch (err) {
    return false;
  }
  const rel = path.relative(fs.realpathSync(ROOT), real);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

// PreToolUse for Read, Glob and Grep. Says allow only for paths under the plugin root;
// for anything else it prints nothing, so the host's usual permission rules apply.
// The fixed leading part of a glob pattern: '/a/b/**/*.md' gives '/a/b'.
function globBase(pattern) {
  const fixed = [];
  for (const part of pattern.split(/[\\/]/)) {
    if (/[*?[\]{}]/.test(part)) break;
    fixed.push(part);
  }
  return fixed.join(path.sep) || path.sep;
}

function allowRead(input) {
  const toolInput = input.tool_input || {};
  if (!['Read', 'Glob', 'Grep'].includes(input.tool_name)) return;
  // Glob and Grep search the folder in path; a file_path next to it is not what they read.
  let target = input.tool_name === 'Read' ? toolInput.file_path || toolInput.path : toolInput.path;
  // Glob and Grep can also reach files through a pattern (Glob's pattern, Grep's glob
  // filter). Allow only patterns that stay inside the root: no '..' anywhere (braces such as
  // {..,x} would hide it from a check of whole path parts), no '~', and an absolute pattern
  // must start inside the root.
  const pattern = input.tool_name === 'Glob' ? toolInput.pattern : input.tool_name === 'Grep' ? toolInput.glob : undefined;
  if (typeof pattern === 'string' && pattern) {
    // '~' anywhere, and a brace alternative that starts a new absolute path ({/etc/*,x}), also leave the root.
    if (pattern.includes('~') || pattern.includes('..') || /[{,]\s*(?:[\\/]|[A-Za-z]:)/.test(pattern)) return;
    if (path.isAbsolute(pattern)) {
      if (!insideRoot(globBase(pattern))) return;
      if (!target) target = globBase(pattern);
    }
  }
  if (!insideRoot(target)) return;
  fs.writeSync(1, JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      permissionDecisionReason: 'Ducktor reads its own plugin files',
    },
  }));
}

// PreToolUse for Write, Edit and MultiEdit. Says allow only for the records Ducktor keeps in
// the project's .duck/: notebook.md, decisions.md and reports/*.md. A denied prompt there
// loses the record. notebook.md and decisions.md are logs the student may show at a group
// meeting, so only adding goes through without a prompt: creating the file, a Write that keeps
// the old text at its start, an Edit whose new text starts with the old text. An Edit that
// rewrites or deletes a line asks as usual; a Write that drops the old text is refused. Files the next session loads as settings or rules
// (config.md, skills/, cards/) also ask, so changing them stays the student's call.
// A symlinked or hard-linked .duck/, reports/ or record file is not followed.
const RECORDS = /^(?:(?:notebook|decisions)\.md|reports\/[^/]+\.md)$/;
const LOGS = /^(?:notebook|decisions)\.md$/;

function lstatOrNull(p) {
  try {
    return fs.lstatSync(p);
  } catch (err) {
    return null;
  }
}

// Real path of something that may not exist yet: resolve the deepest part that exists and
// put the rest back on.
function realPathOf(p) {
  const rest = [];
  let dir = p;
  for (;;) {
    try {
      return path.join(fs.realpathSync(dir), ...rest);
    } catch (err) {
      const parent = path.dirname(dir);
      if (parent === dir) return null;
      rest.unshift(path.basename(dir));
      dir = parent;
    }
  }
}

// True when the write leaves the old file as it was and only adds after its end. Edits are
// applied here the way the host applies them (each old_string must occur exactly once;
// replace_all is refused), and the result is compared byte for byte with the old file.
function onlyAdds(input, target, stat) {
  const toolInput = input.tool_input || {};
  if (!stat || stat.size === 0) return true;
  const old = fs.readFileSync(target);
  let result;
  if (input.tool_name === 'Write') {
    result = toolInput.content;
  } else {
    const edits = input.tool_name === 'MultiEdit' ? toolInput.edits : [toolInput];
    if (!Array.isArray(edits) || edits.length === 0) return false;
    result = old.toString('utf8');
    for (const e of edits) {
      if (!e || e.replace_all || typeof e.old_string !== 'string' || typeof e.new_string !== 'string' || e.old_string === '') return false;
      const at = result.indexOf(e.old_string);
      if (at < 0 || result.indexOf(e.old_string, at + 1) >= 0) return false;
      result = result.slice(0, at) + e.new_string + result.slice(at + e.old_string.length);
    }
  }
  if (typeof result !== 'string') return false;
  const bytes = Buffer.from(result, 'utf8');
  if (bytes.length < old.length || !bytes.subarray(0, old.length).equals(old)) return false;
  // When the old file does not end in a newline, text added straight after it lands on the
  // old last line and changes what that line says. Only a new line counts as adding.
  if (bytes.length === old.length || old[old.length - 1] === 0x0a) return true;
  const next = bytes[old.length];
  return next === 0x0a || (next === 0x0d && bytes[old.length + 1] === 0x0a);
}

// A Write that does not keep a log's old text at its start replaces every entry in it. The model
// does this when it has not read the file: on 11-04 a new session wrote one line over a notebook
// it never opened, and the two entries of the day before were lost (the session ran with edits
// accepted, so no prompt came). Such a Write is refused with a note on how to add. Changing or
// deleting an entry goes through Edit, which names the lines it changes and asks as usual.
function refuseRewrite(rel) {
  fs.writeSync(1, JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `.duck/${rel} keeps the student's earlier entries and this Write would replace them. Read the file, then add the new line at its end with Edit. To change or delete an entry the student asked about, Edit only that entry.`,
    },
  }));
}

// A shell command that writes a log (a redirect, tee, sed -i or perl -i) gets none of the
// checks above, and in the default permission mode it asks the student; when the student says
// no, the line is lost (11-04 rc10: 2 of 6 Claude Code runs appended with echo or printf and
// >>). Such a command is refused with a note to use Edit, which goes through without a prompt
// when it only adds. Reading a log in the shell (cat, grep, tail) is not touched, nor are cp
// and mv.
const LOG_PATH = String.raw`(?:"[^"]*\.duck/(?:notebook|decisions)\.md"|'[^']*\.duck/(?:notebook|decisions)\.md'|(?:\\\s|[^\s"'|;&<>])*\.duck/(?:notebook|decisions)\.md(?=$|[\s|;&)]))`;
const SHELL_LOG_WRITE = new RegExp([
  String.raw`>>?\|?\s*${LOG_PATH}`,
  String.raw`\btee\b[^|;&]*?\s${LOG_PATH}`,
  String.raw`\b(?:sed|perl)\b[^|;&]*?\s(?:-[a-zA-Z]*i\S*|--in-place\S*)[^|;&]*?\s${LOG_PATH}`,
].join('|'));

function refuseShellLogWrite(input) {
  const command = (input.tool_input || {}).command;
  if (typeof command !== 'string' || !SHELL_LOG_WRITE.test(command)) return;
  fs.writeSync(1, JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: 'Write .duck/notebook.md and .duck/decisions.md with Edit, not the shell: a shell write asks the student for permission, and the line is lost if they say no. Read the file, then add the new line at its end with Edit; Ducktor lets that through without a prompt.',
    },
  }));
}

function allowRecord(input) {
  const file = (input.tool_input || {}).file_path;
  // Claude Code's project root, not the shell's current folder: after `cd paper` the hook's
  // cwd moves, but .duck/ stays where the session started.
  const project = [process.env.CLAUDE_PROJECT_DIR, input.cwd].find((p) => typeof p === 'string' && p);
  if (typeof file !== 'string' || !file || !project) return;
  const root = realPathOf(path.resolve(project));
  const resolved = path.resolve(typeof input.cwd === 'string' && input.cwd ? input.cwd : project, file);
  const parent = realPathOf(path.dirname(resolved));
  if (!root || !parent) return;
  const duck = path.join(root, '.duck');
  const rel = path.relative(duck, path.join(parent, path.basename(resolved))).split(path.sep).join('/');
  if (!RECORDS.test(rel)) return;
  const duckStat = lstatOrNull(duck);
  if (!duckStat || !duckStat.isDirectory()) return;
  if (rel.startsWith('reports/')) {
    const reports = lstatOrNull(path.join(duck, 'reports'));
    if (reports && !reports.isDirectory()) return;
  }
  const target = path.join(duck, rel);
  const stat = lstatOrNull(target);
  if (stat && !(stat.isFile() && stat.nlink === 1)) return;
  if (LOGS.test(rel) && !onlyAdds(input, target, stat)) {
    if (input.tool_name === 'Write' && stat && stat.size > 0) refuseRewrite(rel);
    return;
  }
  fs.writeSync(1, JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      permissionDecisionReason: 'Ducktor writes its own record in .duck/',
    },
  }));
}

// ---------------------------------------------------------------------------------------
// Edit checkpoint (0.2.4). In a project with the switch on or quiet, the first edit of a text
// draft in each turn is refused once, with the reminder from rules/checkpoint.md: undecided
// research decisions stay as the draft has them and are listed for the student. On 11-05 the
// model wrote such decisions into the draft before asking in 4 of 5 re-tests, although
// rules/core.md says to list them; a reminder at the moment of editing is the remedy chosen
// (design: agent-hosts/ducktor/out/design-0.2.4/DESIGN.md). The other text-draft edits sent in
// the same batch are refused too, so none lands before the reminder is read (sameBatch below;
// the 11-09 e2e found the batch edits writing the decision). Every doubt lets the edit through.

const TEXT_DRAFT = new Set(['.md', '.tex', '.txt', '.rst', '.typ', '.org', '.qmd', '.rmd']);
// Session and turn ids go into a file name joined by "--", so an id may not hold "--" itself.
// Without a usable session id the turn cannot be told apart from other sessions: let through.
const SAFE_ID = /^(?!.*--)[\w.-]{1,128}$/;
const EDIT_TOOLS = ['Write', 'Edit', 'MultiEdit'];

// Paths an apply_patch command touches: Update, Add and Delete lines, and the new path of a move.
function patchPaths(command) {
  if (typeof command !== 'string') return [];
  const out = [];
  for (const m of command.matchAll(/^\*\*\* (?:(?:Update|Add|Delete) File|Move to): (.+?)\s*$/gm)) out.push(m[1]);
  return out;
}

// True for a file inside the project, outside .duck/, with a text-draft extension.
function isTextDraft(file, project) {
  if (typeof file !== 'string' || !file || !project) return false;
  if (!TEXT_DRAFT.has(path.extname(file).toLowerCase())) return false;
  const root = realPathOf(path.resolve(project));
  const real = realPathOf(path.resolve(file));
  if (!root || !real) return false;
  const rel = path.relative(root, real);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return false;
  return rel.split(path.sep)[0] !== '.duck';
}

// The decision without any file I/O except reading paths. Returns 'allow' or 'claim': claim
// means the caller should try to create this turn's record and refuse when that succeeds.
// facts: { mode, isSubagent, session, turn, cwd, project, files }.
function checkpointDecision(facts) {
  if (facts.mode !== 'on' && facts.mode !== 'quiet') return 'allow';
  if (facts.isSubagent) return 'allow';
  if (!SAFE_ID.test(String(facts.session || '')) || !SAFE_ID.test(String(facts.turn || ''))) return 'allow';
  const base = facts.cwd || facts.project;
  const files = (facts.files || []).filter((f) => typeof f === 'string' && f);
  if (files.some((f) => !path.isAbsolute(f)) && !base) return 'allow';
  if (!files.some((f) => isTextDraft(path.resolve(base || '/', f), facts.project))) return 'allow';
  return 'claim';
}

// Where the turn records and the test log live. CLAUDE_PLUGIN_DATA when the host sets it
// (Claude Code and Codex); otherwise $XDG_STATE_HOME/ducktor, or ~/.local/state/ducktor.
function checkpointDir(env = process.env) {
  if (env.CLAUDE_PLUGIN_DATA) return path.join(env.CLAUDE_PLUGIN_DATA, 'checkpoint');
  const state = env.XDG_STATE_HOME || path.join(env.HOME || require('os').homedir(), '.local', 'state');
  return path.join(state, 'ducktor', 'checkpoint');
}

// Creates this turn's record with the given content. 'created' when this call created it,
// 'exists' when an earlier call of the turn did, 'error' when anything else fails (the edit is
// then let through).
function claimTurn(dir, key, content = '') {
  try {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    // A folder another user made, or one others can write to, could be used to fake records.
    const stat = fs.lstatSync(dir);
    if (!stat.isDirectory() || (process.getuid && stat.uid !== process.getuid()) || (stat.mode & 0o077) !== 0) return 'error';
    const c = fs.constants;
    let fd;
    try {
      fd = fs.openSync(path.join(dir, key), c.O_WRONLY | c.O_CREAT | c.O_EXCL | c.O_NOFOLLOW, 0o600);
    } catch (err) {
      return err && err.code === 'EEXIST' ? 'exists' : 'error';
    }
    try { fs.writeSync(fd, content); } finally { fs.closeSync(fd); }
    return 'created';
  } catch (err) {
    return 'error';
  }
}

// Claude Code sends several edits in one message and runs them one after another before the
// model reads any result, so the edits sent with the refused one would land before the reminder
// is read. Its transcript gets the refused call only after the whole batch has run (probe of
// 11-09), so an edit of the same turn that comes while the transcript does not hold the refused
// call yet belongs to that batch and is refused too. Two limits keep a host that writes its
// transcript differently from refusing a whole turn: two minutes after the first refusal, and
// eight refusals in the batch besides the first one (nine in a turn). Anything unexpected lets
// the edit through.
const BATCH_MS = 120 * 1000;
const BATCH_MAX = 8;
const CALL_ID = /^[\w-]{1,128}$/;

// The last max bytes of a file as text, or null when it cannot be read.
function readTail(file, max) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const size = fs.fstatSync(fd).size;
    const len = Math.min(size, max);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, size - len);
    return buf.toString('utf8');
  } catch (err) {
    return null;
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch (err) { /* closed */ }
  }
}

// True when this edit belongs to the batch of the turn's first refused edit (see above).
function sameBatch(dir, key, input, now = Date.now()) {
  try {
    const c = fs.constants;
    const fd = fs.openSync(path.join(dir, key), c.O_RDONLY | c.O_NOFOLLOW);
    let rec;
    try { rec = JSON.parse(fs.readFileSync(fd, 'utf8')); } finally { fs.closeSync(fd); }
    const first = rec && typeof rec.first === 'string' && CALL_ID.test(rec.first) ? rec.first : '';
    if (!first || typeof rec.t !== 'number' || now < rec.t || now - rec.t > BATCH_MS) return false;
    if (typeof input.tool_use_id !== 'string' || !CALL_ID.test(input.tool_use_id) || input.tool_use_id === first) return false;
    const transcript = input.transcript_path;
    if (typeof transcript !== 'string' || !path.isAbsolute(transcript)) return false;
    const text = readTail(transcript, 8 * 1024 * 1024);
    if (text === null || text.includes(first)) return false;
    // One marker file per refusal of the batch, so the count survives across hook processes.
    const prefix = `${key}.b`;
    if (fs.readdirSync(dir).filter((n) => n.startsWith(prefix)).length >= BATCH_MAX) return false;
    fs.closeSync(fs.openSync(path.join(dir, `${prefix}${input.tool_use_id}`), c.O_WRONLY | c.O_CREAT | c.O_EXCL | c.O_NOFOLLOW, 0o600));
    return true;
  } catch (err) {
    return false;
  }
}

// One line of the test log, only when checkpoint/LOG exists. A failure here changes nothing.
function writeCheckpointLog(dir, entry, root = ROOT) {
  try {
    if (!fs.existsSync(path.join(dir, 'LOG'))) return;
    let build = 'unknown';
    try { build = fs.readFileSync(path.join(root, 'BUILD'), 'utf8').trim() || 'unknown'; } catch (err) { /* none */ }
    const c = fs.constants;
    const fd = fs.openSync(path.join(dir, 'log.txt'), c.O_WRONLY | c.O_CREAT | c.O_APPEND | c.O_NOFOLLOW, 0o600);
    try {
      fs.writeSync(fd, `${JSON.stringify({ ...entry, time: new Date().toISOString(), build })}\n`);
    } finally {
      fs.closeSync(fd);
    }
  } catch (err) { /* the test log is optional */ }
}

// Removes turn records older than seven days. LOG and log.txt stay.
function pruneCheckpoint(dir, now = Date.now()) {
  let names;
  try { names = fs.readdirSync(dir); } catch (err) { return; }
  for (const name of names) {
    if (name === 'LOG' || name === 'log.txt') continue;
    try {
      const file = path.join(dir, name);
      const stat = fs.lstatSync(file);
      if (stat.isFile() && now - stat.mtimeMs > 7 * 24 * 3600 * 1000) fs.unlinkSync(file);
    } catch (err) { /* another session removed it, or it is not ours: skip */ }
  }
}

// The reminder from rules/checkpoint.md: the English section when the config is in English;
// '' when the file or the section is missing (the checkpoint then lets the edit through).
function checkpointReminder(config, root = ROOT) {
  const text = readText(path.join(root, 'rules', 'checkpoint.md')) || '';
  const english = typeof config === 'string' && ENGLISH_CONFIG.test(config);
  const section = sectionOf(text, english ? /^##[ \t]*English[ \t]*$/m : /^##[ \t]*中文[ \t]*$/m)
    .replace(/^##.*\n+/, '').trim();
  return section;
}

// PreToolUse for Write, Edit, MultiEdit (Claude Code) and apply_patch (Codex). Prints a deny
// and returns true when it refuses; returns false otherwise, printing nothing.
function checkpoint(input) {
  const toolInput = input.tool_input || {};
  const project = [process.env.CLAUDE_PROJECT_DIR, input.cwd].find((p) => typeof p === 'string' && p);
  const host = input.tool_name === 'apply_patch' ? 'codex' : 'claude-code';
  if (!project) {
    writeCheckpointLog(checkpointDir(), { host, session: String(input.session_id || ''), turn: '', tool: input.tool_name, subagent: false, decision: 'allow' });
    return false;
  }
  const config = readText(path.join(project, '.duck', 'config.md'));
  const files = input.tool_name === 'apply_patch' ? patchPaths(toolInput.command) : [toolInput.file_path];
  const facts = {
    mode: modeOf(config).mode,
    isSubagent: typeof input.agent_id === 'string' && input.agent_id !== '',
    session: input.session_id,
    turn: host === 'codex' ? input.turn_id : input.prompt_id,
    cwd: typeof input.cwd === 'string' ? input.cwd : '',
    project,
    files,
  };
  const dir = checkpointDir();
  const reminder = checkpointReminder(config);
  let decision = reminder ? checkpointDecision(facts) : 'allow';
  let batch = false;
  if (decision === 'claim') {
    const key = `${facts.session}--${facts.turn}`;
    const first = typeof input.tool_use_id === 'string' && CALL_ID.test(input.tool_use_id) ? input.tool_use_id : '';
    const claim = claimTurn(dir, key, JSON.stringify({ first, t: Date.now() }));
    if (claim === 'created') decision = 'deny';
    else if (claim === 'exists' && sameBatch(dir, key, input)) { decision = 'deny'; batch = true; }
    else decision = 'allow';
  }
  writeCheckpointLog(dir, { host, session: String(facts.session || ''), turn: String(facts.turn || ''), tool: input.tool_name, subagent: facts.isSubagent, decision, batch });
  if (decision !== 'deny') return false;
  fs.writeSync(1, JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reminder,
    },
  }));
  return true;
}

function main(command) {
  // allow-read is the name the hooks file used before writes were added.
  if (command === 'allow' || command === 'allow-read') {
    try {
      const input = readInput();
      if (EDIT_TOOLS.includes(input.tool_name)) {
        // A checkpoint that throws refuses nothing: the record rules still apply.
        let refused = false;
        try { refused = checkpoint(input); } catch (err) { refused = false; }
        if (!refused) allowRecord(input);
      } else if (input.tool_name === 'apply_patch') {
        // Codex goes through the checkpoint only after its probes pass (0.2.4 design, choice 6).
        // Until then the probes and the tests turn it on with DUCK_CODEX_CHECKPOINT=1. The shipped
        // hooks file does not send apply_patch here yet (its PreToolUse matcher lacks it), so this
        // branch also needs that matcher before Codex users get the check.
        if (process.env.DUCK_CODEX_CHECKPOINT === '1') checkpoint(input);
      }
      else if (input.tool_name === 'Bash') refuseShellLogWrite(input);
      else allowRead(input);
    } catch (err) { /* stay silent: the host asks as usual */ }
    return;
  }
  let context = '';
  try {
    if (command === 'session-start') {
      pruneCheckpoint(checkpointDir());
      context = sessionStart();
    }
  } catch (err) {
    context = `Ducktor 插件根目录：${ROOT}\n\n（开场脚本出错，常驻规则这次没加载：${err.message}）`;
  }
  if (!context) return;
  // Claude Code and Codex read hookSpecificOutput; Cursor reads additional_context.
  // Print only the one the host reads: Claude Code would inject both, twice.
  // writeSync, because an async pipe write can be lost when the process exits right after it.
  const output = process.env.CURSOR_PLUGIN_ROOT
    ? { additional_context: context }
    : { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context } };
  fs.writeSync(1, JSON.stringify(output));
}

module.exports = {
  main, modeOf, buildContext, insideRoot, ROOT,
  // Edit checkpoint, also used by DeepSeek-Ducktor.
  patchPaths, isTextDraft, checkpointDecision, checkpointDir, claimTurn, sameBatch, writeCheckpointLog, pruneCheckpoint, checkpointReminder,
};

if (require.main === module) main(process.argv[2]);
