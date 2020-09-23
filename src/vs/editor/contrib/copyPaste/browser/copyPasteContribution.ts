/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerEditorContribution } from 'vs/editor/browser/editorExtensions';
import { CopyPasteController } from 'vs/editor/contrib/copyPaste/browser/copyPasteController';


registerEditorContribution(CopyPasteController.ID, CopyPasteController);
