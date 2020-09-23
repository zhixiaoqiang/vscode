/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { addDisposableListener } from 'vs/base/browser/dom';
import { CancelablePromise, createCancelablePromise } from 'vs/base/common/async';
import { CancellationToken } from 'vs/base/common/cancellation';
import { Disposable } from 'vs/base/common/lifecycle';
import { generateUuid } from 'vs/base/common/uuid';
import { toIDataTransfer } from 'vs/editor/browser/dnd';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { IBulkEditService, ResourceEdit } from 'vs/editor/browser/services/bulkEditService';
import { IDataTransfer } from 'vs/editor/common/dnd';
import { IEditorContribution } from 'vs/editor/common/editorCommon';
import { ILanguageFeaturesService } from 'vs/editor/common/services/languageFeatures';


const vscodeClipboardMime = 'x-vscode/id';

export class CopyPasteController extends Disposable implements IEditorContribution {

	public static readonly ID = 'editor.contrib.copyPasteActionController';

	public static get(editor: ICodeEditor): CopyPasteController {
		return editor.getContribution<CopyPasteController>(CopyPasteController.ID)!;
	}

	private readonly _editor: ICodeEditor;

	private _currentClipboardItem: undefined | {
		readonly handle: string;
		readonly dataTransferPromise: CancelablePromise<IDataTransfer>;
	};

	constructor(
		editor: ICodeEditor,
		@IBulkEditService private readonly _bulkEditService: IBulkEditService,
		@ILanguageFeaturesService private readonly _languageFeaturesService: ILanguageFeaturesService,
	) {
		super();

		this._editor = editor;

		this._register(addDisposableListener(document, 'copy', (e: ClipboardEvent) => {
			if (!e.clipboardData) {
				return;
			}

			const model = editor.getModel();
			const selection = this._editor.getSelection();
			if (!model || !selection) {
				return;
			}

			const providers = this._languageFeaturesService.copyPasteActionProvider.ordered(model).filter(x => !!x.provideCopyData);
			if (!providers.length) {
				return;
			}

			const dataTransfer = toIDataTransfer(e.clipboardData);

			// Save off a handle pointing to data that VS Code maintains.
			const handle = generateUuid();
			e.clipboardData.setData(vscodeClipboardMime, handle);

			const promise = createCancelablePromise(async token => {
				const results = await Promise.all(providers.map(provider => {
					return provider.provideCopyData!(model, selection, dataTransfer, token);
				}));

				for (const result of results) {
					result?.forEach((value, key) => {
						dataTransfer.set(key, value);
					});
				}

				return dataTransfer;
			});

			this._currentClipboardItem = { handle: handle, dataTransferPromise: promise };
		}));

		this._register(addDisposableListener(document, 'paste', async (e: ClipboardEvent) => {
			const model = editor.getModel();
			const selection = this._editor.getSelection();
			if (!model || !selection || !e.clipboardData) {
				return;
			}

			const providers = this._languageFeaturesService.copyPasteActionProvider.ordered(model);
			if (!providers.length) {
				return;
			}

			const handle = e.clipboardData?.getData(vscodeClipboardMime);
			if (typeof handle !== 'string') {
				return;
			}

			e.preventDefault();
			e.stopImmediatePropagation();

			const dataTransfer = toIDataTransfer(e.clipboardData);

			if (handle && this._currentClipboardItem?.handle === handle) {
				const toMergeDataTransfer = await this._currentClipboardItem.dataTransferPromise;
				toMergeDataTransfer.forEach((value, key) => {
					dataTransfer.set(key, value);
				});
			}

			dataTransfer.delete(vscodeClipboardMime);

			for (const provider of providers) {
				const edit = await provider.providePasteEdits(model, selection, dataTransfer, CancellationToken.None);
				if (edit) {
					await this._bulkEditService.apply(ResourceEdit.convert(edit), { editor });
					return;
				}
			}
		}, true));
	}
}
