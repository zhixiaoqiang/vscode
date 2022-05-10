/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';
import { IDataTransfer, IDataTransferItem } from 'vs/editor/common/dnd';


export function toIDataTransfer(dataTransfer: DataTransfer) {
	const textEditorDataTransfer: IDataTransfer = new Map<string, IDataTransferItem>();
	for (const item of dataTransfer.items) {
		const type = item.type;
		if (item.kind === 'string') {
			const asStringValue = new Promise<string>(resolve => item.getAsString(resolve));
			textEditorDataTransfer.set(type, {
				asString: () => asStringValue,
				asFile: () => undefined,
				value: undefined
			});
		} else if (item.kind === 'file') {
			const file = item.getAsFile() as null | (File & { path?: string });
			if (file) {
				textEditorDataTransfer.set(type, {
					asString: () => Promise.resolve(''),
					asFile: () => {
						const uri = file.path ? URI.parse(file.path) : undefined;
						return {
							name: file.name,
							uri: uri,
							data: async () => {
								return new Uint8Array(await file.arrayBuffer());
							},
						};
					},
					value: undefined
				});
			}
		}
	}
	return textEditorDataTransfer;
}
