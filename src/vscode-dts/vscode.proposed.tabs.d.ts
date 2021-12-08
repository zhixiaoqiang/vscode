/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'vscode' {

	// https://github.com/Microsoft/vscode/issues/15178

	/**
	 * Represents a tab within the window
	 */
	export interface Tab {
		/**
		 * The text displayed on the tab
		 */
		readonly label: string;

		/**
		 * The index of the tab within the column
		 */
		readonly index: number;

		/**
		 * The column which the tab belongs to
		 */
		readonly viewColumn: ViewColumn;

		/**
		 * The resource represented by the tab if available.
		 * Note: Not all tabs have a resource associated with them.
		 */
		readonly resource: Uri | undefined;

		/**
		 * The identifier of the view contained in the tab
		 * This is equivalent to `viewType` for custom editors and `notebookType` for notebooks.
		 * The built-in text editor has an id of 'default' for all configurations.
		 */
		readonly viewId: string | undefined;

		/**
		 * All the resources and viewIds represented by a tab
		 * {@link Tab.resource resource} and {@link Tab.viewId viewId} will
		 * always be at index 0.
		 */
		readonly additionalResourcesAndViewIds: readonly {
			readonly resource: Uri | undefined,
			readonly viewId: string | undefined
		}[];

		/**
		 * Whether or not the tab is currently active
		 * Dictated by being the selected tab in the active group
		 */
		readonly isActive: boolean;

		/**
		 * Moves a tab to the given index within the column.
		 * If the index is out of range, the tab will be moved to the end of the column.
		 * If the column is out of range, a new one will be created after the last existing column.
		 * @param index The index to move the tab to
		 * @param viewColumn The column to move the tab into
		 */
		move(index: number, viewColumn: ViewColumn): Thenable<void>;

		/**
		 * Closes the tab. This makes the tab object invalid and the tab
		 * should no longer be used for further actions.
		 */
		close(): Thenable<void>;
	}

	export interface TabGroups {
		/**
		 * A list of all tab groups in the window
		 */
		all: TabGroup[];
	}

	export interface TabGroup {
		/**
		 * Whether or not the group is currently active
		 */
		isActive: boolean;

		/**
		 * The view column the group is currently located at
		 */
		viewColumn: ViewColumn;

		/**
		 * A list of tabs in the group
		 */
		tabs: Tab[];

		/**
		 * The active tab in the group
		 */
		activeTab: Tab | undefined;

		/**
		 * Closes the group. This makes the group object invalid and the group
		 * should no longer be used for further actions.
		 */
		close(): Thenable<void>;

		/**
		 * Moves the group to the given view column
		 * @param target The view column to move the group to.
		 */
		move(target: ViewColumn): Thenable<void>;

		/**
		 * An {@link Event} which fires when the array of {@link window.tabs tabs}
		 * has changed.
		 */
		onDidChangeTabs: Event<readonly Tab[]>;

		/**
		 * An {@link Event} which fires when the {@link window.activeTab activeTab}
		 * has changed.
		 */
		onDidChangeActiveTab: Event<Tab | undefined>;
	}

	export namespace window {


		/**
		 * The groups within the window
		 */
		export const tabGroups: TabGroups;
	}
}
