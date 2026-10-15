// Runs the extension logic against a fake `vscode` module and a fake child_process.spawn.
// Usage: node test/extension.test.js
const Module = require('node:module');
const path = require('node:path');
const assert = require('node:assert');
const { EventEmitter } = require('node:events');

const registered = {};
const messages = [];
let nextChoice;
const calls = { spawn: [], launched: [], opened: [] };

const fakeVscode = {
	Uri: class Uri {
		constructor(fsPath) { this.fsPath = fsPath; this.scheme = 'file'; }
		static file(p) { return new Uri(p); }
	},
	ProgressLocation: { Notification: 15 },
	window: {
		activeTextEditor: undefined,
		createOutputChannel: () => ({ appendLine() {}, show() {}, dispose() {} }),
		withProgress: (_options, task) => task(),
		showWarningMessage: async (m) => { messages.push(['warn', m]); },
		showInformationMessage: async (m) => { messages.push(['info', m]); return nextChoice; },
		showErrorMessage: async (m) => { messages.push(['error', m]); },
	},
	workspace: {
		textDocuments: [],
		getConfiguration: () => ({ get: (key) => ({ pythonPath: '', browserPath: '', layout: 'auto', openAfterExport: true })[key] }),
	},
	commands: {
		registerCommand: (id, fn) => { registered[id] = fn; return { dispose() {} }; },
		executeCommand: async () => {},
	},
	env: { openExternal: async (uri) => { calls.opened.push(uri.fsPath); } },
};

const realLoad = Module._load;
Module._load = function (request, ...rest) {
	if (request === 'vscode') return fakeVscode;
	return realLoad.call(this, request, ...rest);
};

// Fake spawn: `python` does not exist (ENOENT), `py` works, failing.md makes the converter fail,
// and the file launchers (explorer.exe, open, xdg-open) just start
const LAUNCHERS = ['explorer.exe', 'open', 'xdg-open'];
const childProcess = require('node:child_process');
childProcess.spawn = (command, args) => {
	const child = new EventEmitter();
	child.stdout = new EventEmitter();
	child.stderr = new EventEmitter();
	child.kill = () => {};
	child.unref = () => {};
	if (LAUNCHERS.includes(command)) {
		calls.launched.push([command, ...args]);
		setImmediate(() => child.emit('spawn'));
		return child;
	}
	calls.spawn.push([command, ...args]);
	setImmediate(() => {
		if (command === 'python') {
			const error = new Error('spawn python ENOENT');
			error.code = 'ENOENT';
			child.emit('error', error);
		} else if (args.some((a) => String(a).endsWith('failing.md'))) {
			child.stderr.emit('data', Buffer.from('The markdown library is missing'));
			child.emit('close', 1);
		} else {
			child.stdout.emit('data', Buffer.from('PDF generated'));
			child.emit('close', 0);
		}
	});
	return child;
};

const extension = require(path.join(__dirname, '..', 'extension.js'));

(async () => {
	assert.deepStrictEqual(extension.layoutFlags('auto'), []);
	assert.deepStrictEqual(extension.layoutFlags('tall'), ['--tall']);
	assert.deepStrictEqual(extension.layoutFlags('a4'), ['--a4']);
	assert.strictEqual(extension.outputPath('C:\\docs\\Guía de uso.md'), 'C:\\docs\\Guía de uso.pdf');
	assert.strictEqual(extension.outputPath('/x/y.MARKDOWN'), '/x/y.pdf');
	assert.deepStrictEqual(extension.pythonCandidates('C:\\py\\python.exe'), [{ command: 'C:\\py\\python.exe', prefix: [] }]);
	console.log('OK   helpers');

	extension.activate({ subscriptions: [], asAbsolutePath: (f) => path.join('/ext', f) });
	assert.ok(registered['mdAPdf.export'], 'command registered');
	console.log('OK   command mdAPdf.export registered');

	await registered['mdAPdf.export']();
	assert.strictEqual(messages.at(-1)[0], 'warn');
	console.log('OK   no active editor: warns');

	await registered['mdAPdf.export'](new fakeVscode.Uri('/a/main.c'));
	assert.strictEqual(messages.at(-1)[0], 'warn');
	assert.strictEqual(calls.spawn.length, 0);
	console.log('OK   non-markdown file: warns and does not convert');

	nextChoice = 'Open';
	await registered['mdAPdf.export'](new fakeVscode.Uri('C:\\docs\\guide.md'));
	assert.deepStrictEqual(calls.spawn.map((c) => c[0]), ['python', 'py']);
	assert.deepStrictEqual(calls.spawn[1].slice(0, 2), ['py', '-3']);
	assert.ok(calls.spawn[1][2].endsWith('md-a-pdf.py'));
	assert.strictEqual(calls.spawn[1][3], 'C:\\docs\\guide.md');
	assert.strictEqual(calls.spawn[1][4], 'C:\\docs\\guide.pdf');
	assert.strictEqual(messages.at(-1)[0], 'info');
	console.log('OK   conversion: python (ENOENT) -> py -3, notifies');

	// "Open" must use the system launcher, never vscode.env.openExternal (it fails with accents)
	assert.deepStrictEqual(calls.launched, [['xdg-open', 'C:\\docs\\guide.pdf']]);
	assert.deepStrictEqual(calls.opened, []);
	console.log('OK   Open button uses the system launcher, not openExternal');

	calls.launched.length = 0;
	await extension.openFile('C:\\docs\\Guía de integración.pdf', 'win32');
	await extension.openFile('/docs/Guía de integración.pdf', 'darwin');
	await extension.openFile('/docs/Guía de integración.pdf', 'linux');
	assert.deepStrictEqual(calls.launched, [
		['explorer.exe', 'C:\\docs\\Guía de integración.pdf'],
		['open', '/docs/Guía de integración.pdf'],
		['xdg-open', '/docs/Guía de integración.pdf'],
	]);
	console.log('OK   launchers per platform, path with accents and spaces passed as one argument');

	await registered['mdAPdf.export'](new fakeVscode.Uri('C:\\docs\\failing.md'));
	assert.strictEqual(messages.at(-1)[0], 'error');
	assert.ok(messages.at(-1)[1].includes('markdown'));
	console.log('OK   converter error: the reason is shown');

	console.log('RESULT: PASS');
})().catch((error) => { console.error('FAIL', error); process.exit(1); });
