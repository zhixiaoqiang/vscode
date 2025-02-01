/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { ICompletionResource } from '../types';
import { type ExecOptionsWithStringEncoding } from 'node:child_process';
import { execHelper, spawnHelper } from './common';

export async function getBashGlobals(options: ExecOptionsWithStringEncoding, existingCommands?: Set<string>): Promise<(string | ICompletionResource)[]> {
	return [
		...await getAliases(options),
		...await getBuiltins(options, existingCommands)
	];
}

async function getBuiltins(options: ExecOptionsWithStringEncoding, existingCommands?: Set<string>): Promise<string[]> {
	const compgenOutput = await execHelper('compgen -b', options);
	const filter = (cmd: string) => cmd && !existingCommands?.has(cmd);
	return compgenOutput.split('\n').filter(filter);
}

async function getAliases(options: ExecOptionsWithStringEncoding): Promise<ICompletionResource[]> {
	// This must be run with interactive, otherwise there's a good chance aliases won't
	// be set up. Note that this could differ from the actual aliases as it's a new bash
	// session, for the same reason this would not include aliases that are created
	// by simply running `alias ...` in the terminal.
	const aliasOutput = await spawnHelper('bash', ['-ic', 'alias'], options);
	const result: ICompletionResource[] = [];
	for (const line of aliasOutput.split('\n')) {
		const match = line.match(/^alias (?<alias>[a-zA-Z0-9\.:-]+)='(?<resolved>.+)'$/);
		if (!match?.groups) {
			continue;
		}
		result.push({
			label: match.groups.alias,
			detail: match.groups.resolved,
			kind: vscode.TerminalCompletionItemKind.Alias,
		});
	}
	return result;
}
