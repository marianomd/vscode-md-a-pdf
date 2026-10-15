const vscode = require('vscode');
const childProcess = require('child_process');

const TIMEOUT_MS = 120000;
const MD_EXTENSION = /\.(md|markdown)$/i;

function layoutFlags(layout) {
	if (layout === 'tall') return ['--tall'];
	if (layout === 'a4') return ['--a4'];
	return [];
}

function outputPath(markdownPath) {
	return markdownPath.replace(MD_EXTENSION, '.pdf');
}

// With pythonPath configured only that one is used; otherwise the usual Windows and Linux launchers are tried
function pythonCandidates(configured) {
	if (configured) return [{ command: configured, prefix: [] }];
	return [
		{ command: 'python', prefix: [] },
		{ command: 'py', prefix: ['-3'] },
		{ command: 'python3', prefix: [] },
	];
}

function run(command, args, env) {
	return new Promise((resolve) => {
		let stdout = '';
		let stderr = '';
		let settled = false;
		const finish = (result) => {
			if (!settled) {
				settled = true;
				clearTimeout(timer);
				resolve(result);
			}
		};
		const child = childProcess.spawn(command, args, { env, windowsHide: true });
		const timer = setTimeout(() => {
			child.kill();
			finish({ code: null, stdout, stderr, timedOut: true });
		}, TIMEOUT_MS);
		child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
		child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
		child.on('error', (error) => finish({ code: null, stdout, stderr, error }));
		child.on('close', (code) => finish({ code, stdout, stderr }));
	});
}

async function convert(scriptPath, markdownPath, pdfPath, config) {
	const env = { ...process.env, PYTHONIOENCODING: 'utf-8' };
	if (config.browserPath) env.BROWSER_PATH = config.browserPath;
	const scriptArgs = [scriptPath, markdownPath, pdfPath, ...layoutFlags(config.layout)];

	let last = { error: new Error('Python was not found') };
	for (const candidate of pythonCandidates(config.pythonPath)) {
		last = await run(candidate.command, [...candidate.prefix, ...scriptArgs], env);
		if (!(last.error && last.error.code === 'ENOENT')) return last;
	}
	return last;
}

function describeFailure(result) {
	if (result.timedOut) return 'It took more than 2 minutes (is there internet access to load Mermaid?).';
	if (result.error && result.error.code === 'ENOENT') {
		return 'Python was not found. Install it or set "mdAPdf.pythonPath".';
	}
	if (result.error) return result.error.message;
	const detail = (result.stderr || result.stdout || '').trim().split(/\r?\n/).slice(-4).join(' ');
	return detail || `The converter exited with code ${result.code}.`;
}

function activate(context) {
	const output = vscode.window.createOutputChannel('Beautiful Markdown to PDF');

	const exportCommand = vscode.commands.registerCommand('mdAPdf.export', async (arg) => {
		const uri = arg instanceof vscode.Uri ? arg : (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri);
		if (!uri || uri.scheme !== 'file' || !MD_EXTENSION.test(uri.fsPath)) {
			vscode.window.showWarningMessage('Beautiful Markdown to PDF: open a .md file and keep the focus in the editor (not in the preview).');
			return;
		}

		const openDocument = vscode.workspace.textDocuments.find((doc) => doc.uri.fsPath === uri.fsPath);
		if (openDocument && openDocument.isDirty) await openDocument.save();

		const settings = vscode.workspace.getConfiguration('mdAPdf');
		const config = {
			pythonPath: settings.get('pythonPath'),
			browserPath: settings.get('browserPath'),
			layout: settings.get('layout'),
		};
		const pdfPath = outputPath(uri.fsPath);

		const result = await vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Notification, title: 'Generating PDF...' },
			() => convert(context.asAbsolutePath('md-a-pdf.py'), uri.fsPath, pdfPath, config)
		);

		output.appendLine(`[${new Date().toISOString()}] ${uri.fsPath} -> exit code ${result.code}`);
		if (result.stdout) output.appendLine(result.stdout.trim());
		if (result.stderr) output.appendLine(result.stderr.trim());

		if (result.code !== 0) {
			const choice = await vscode.window.showErrorMessage(`Beautiful Markdown to PDF failed: ${describeFailure(result)}`, 'Show details');
			if (choice === 'Show details') output.show();
			return;
		}

		if (!settings.get('openAfterExport')) {
			vscode.window.showInformationMessage(`PDF generated: ${pdfPath}`);
			return;
		}
		const choice = await vscode.window.showInformationMessage(`PDF generated: ${pdfPath}`, 'Open', 'Show in folder');
		if (choice === 'Open') await vscode.env.openExternal(vscode.Uri.file(pdfPath));
		if (choice === 'Show in folder') await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(pdfPath));
	});

	context.subscriptions.push(exportCommand, output);
}

function deactivate() {}

module.exports = { activate, deactivate, layoutFlags, outputPath, pythonCandidates, convert, describeFailure };
