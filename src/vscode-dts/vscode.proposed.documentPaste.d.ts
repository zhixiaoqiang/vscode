/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'vscode' {

	// https://github.com/microsoft/vscode/issues/30066/

	/**
	 * Provider invoked when the user copies and pastes code.
	 */
	interface DocumentPasteEditProvider {

		/**
		 * Optional method invoked after the user copies text in a file.
		 *
		 * During `provideCopyData`, an extension can compute metadata that is attached to
		 * the clipboard and is passed back to the provider in `providePasteDocument`.
		 *
		 * @param document Document where the copy took place.
		 * @param selection Selection being copied in the `document`.
		 * @param token
		 */
		prepareDocumentPaste?(document: TextDocument, selection: Selection, dataTransfer: DataTransfer, token: CancellationToken): void | Thenable<void>;

		/**
		 * Invoked before the user pastes into a document.
		 *
		 * In this method, extensions can return a workspace edit that replaces the standard pasting behavior.
		 *
		 * @param document Document being pasted into
		 * @param selection Current selection in the document.
		 * @param dataTransfer
		 * @param token
		 *
		 * @return Optional workspace edit that applies the paste. Return undefined to use standard pasting.
		 */
		provideDocumentPasteEdits(document: TextDocument, selection: Selection, dataTransfer: DataTransfer, token: CancellationToken): ProviderResult<WorkspaceEdit>;
	}

	namespace languages {
		export function registerDocumentPasteEditProvider(selector: DocumentSelector, provider: DocumentPasteEditProvider): Disposable;
	}
}
