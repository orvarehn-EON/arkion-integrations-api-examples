import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function printUsage(): void {
	console.error(
		"Usage: node dist/src/run-scenario.js <scenario-name> [scenario-args...]",
	);
	console.error("Example: node dist/src/run-scenario.js get-project 42");
}

async function main(): Promise<void> {
	const scenarioName = process.argv[2];
	const scenarioArgs = process.argv.slice(3);

	if (!scenarioName) {
		printUsage();
		process.exitCode = 1;
		return;
	}

	const currentFilePath = fileURLToPath(import.meta.url);
	const scenariosDir = resolve(dirname(currentFilePath), "scenarios");
	const scenarioFile = resolve(scenariosDir, `${scenarioName}.js`);

	try {
		await access(scenarioFile, constants.F_OK);
	} catch {
		console.error(
			`Scenario not found: ${scenarioName}. Expected file: dist/src/scenarios/${scenarioName}.js`,
		);
		process.exitCode = 1;
		return;
	}

	const child = spawn(process.execPath, [scenarioFile, ...scenarioArgs], {
		stdio: "inherit",
		env: process.env,
	});

	child.on("exit", (code, signal) => {
		if (signal) {
			console.error(`Scenario process terminated by signal: ${signal}`);
			process.exitCode = 1;
			return;
		}
		process.exitCode = code ?? 1;
	});
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
