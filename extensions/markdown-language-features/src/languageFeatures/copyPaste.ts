/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { tryInsertUriList } from './dropIntoEditor';

export function registerCopyPaste(selector: vscode.DocumentSelector) {
	return vscode.languages.registerDocumentCopyPasteEditProvider(selector, new class implements vscode.DocumentCopyPasteEditProvider {

		async providePasteDocumentEdits(
			document: vscode.TextDocument,
			selection: vscode.Selection,
			dataTransfer: vscode.DataTransfer,
			token: vscode.CancellationToken,
		): Promise<vscode.WorkspaceEdit | undefined> {
			const snippet = await tryInsertUriList(document, selection, dataTransfer, token);
			if (!snippet) {
				return;
			}

			const edit = new vscode.WorkspaceEdit();
			edit.replace(document.uri, selection, snippet.snippet.value);
			return edit;
		}
	});
}
