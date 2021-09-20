/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import * as DOM from 'vs/base/browser/dom';
import { Event } from 'vs/base/common/event';
import { ITableContextMenuEvent, ITableRenderer, ITableVirtualDelegate } from 'vs/base/browser/ui/table/table';
import { Disposable } from 'vs/base/common/lifecycle';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IOpenEvent, WorkbenchTable } from 'vs/platform/list/browser/listService';
import { HighlightedLabel } from 'vs/base/browser/ui/highlightedlabel/highlightedLabel';
import { Marker } from 'vs/workbench/contrib/markers/browser/markersModel';
import { MarkerSeverity } from 'vs/platform/markers/common/markers';
import { SeverityIcon } from 'vs/platform/severityIcon/common/severityIcon';
import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { ILabelService } from 'vs/platform/label/common/label';
import Messages from 'vs/workbench/contrib/markers/browser/messages';
import { FilterOptions } from 'vs/workbench/contrib/markers/browser/markersFilterOptions';
import { IMatch } from 'vs/base/common/filters';
import { Link } from 'vs/platform/opener/browser/link';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { MarkersViewModel } from 'vs/workbench/contrib/markers/browser/markersTreeViewer';
import { IAction } from 'vs/base/common/actions';
import { QuickFixAction, QuickFixActionViewItem } from 'vs/workbench/contrib/markers/browser/markersViewActions';
import { DomEmitter } from 'vs/base/browser/event';

const $ = DOM.$;

export interface IMarkerTableItem {
	marker: Marker;
	codeMatches?: IMatch[];
	messageMatches?: IMatch[];
	fileMatches?: IMatch[];
	ownerMatches?: IMatch[];
}

interface IMarkerActionsColumnTemplateData {
	readonly actionBar: ActionBar;
}

interface IMarkerIconColumnTemplateData {
	readonly icon: HTMLElement;
}

interface IMarkerHighlightedLabelColumnTemplateData {
	readonly highlightedLabel: HighlightedLabel;
}

interface IMarkerCodeColumnTemplateData {
	readonly container: HTMLElement;
}


class MarkerActionsColumnRenderer implements ITableRenderer<IMarkerTableItem, IMarkerActionsColumnTemplateData>{

	static readonly TEMPLATE_ID = 'actions';

	readonly templateId: string = MarkerActionsColumnRenderer.TEMPLATE_ID;

	constructor(
		private readonly markersViewModel: MarkersViewModel,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) { }

	renderTemplate(container: HTMLElement): IMarkerActionsColumnTemplateData {
		const element = container.appendChild($('.actions'));
		const actionBar = new ActionBar(element, {
			actionViewItemProvider: (action: IAction) => action.id === QuickFixAction.ID ? this.instantiationService.createInstance(QuickFixActionViewItem, <QuickFixAction>action) : undefined,
			animated: false
		});
		return { actionBar };
	}

	renderElement(element: IMarkerTableItem, index: number, templateData: IMarkerActionsColumnTemplateData, height: number | undefined): void {
		templateData.actionBar.clear();

		const viewModel = this.markersViewModel.getViewModel(element.marker);
		if (viewModel) {
			const quickFixAction = viewModel.quickFixAction;
			templateData.actionBar.push([quickFixAction], { icon: true, label: false });
		}
	}
	disposeTemplate(templateData: IMarkerActionsColumnTemplateData): void { }
}


class MarkerSeverityColumnRenderer implements ITableRenderer<IMarkerTableItem, IMarkerIconColumnTemplateData>{

	static readonly TEMPLATE_ID = 'severity';

	readonly templateId: string = MarkerSeverityColumnRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): IMarkerIconColumnTemplateData {
		const severityColumn = DOM.append(container, $('.severity'));
		const icon = DOM.append(severityColumn, $(''));

		return { icon };
	}

	renderElement(element: IMarkerTableItem, index: number, templateData: IMarkerIconColumnTemplateData, height: number | undefined): void {
		templateData.icon.className = `marker-icon codicon ${SeverityIcon.className(MarkerSeverity.toSeverity(element.marker.marker.severity))}`;
	}

	disposeTemplate(templateData: IMarkerIconColumnTemplateData): void { }
}

class MarkerCodeColumnRenderer implements ITableRenderer<IMarkerTableItem, IMarkerCodeColumnTemplateData>{

	static readonly TEMPLATE_ID = 'code';

	readonly templateId: string = MarkerCodeColumnRenderer.TEMPLATE_ID;

	constructor(
		@IOpenerService private readonly openerService: IOpenerService,
	) { }
	renderTemplate(container: HTMLElement): IMarkerCodeColumnTemplateData {
		return { container };
	}

	renderElement(element: IMarkerTableItem, index: number, templateData: IMarkerCodeColumnTemplateData, height: number | undefined): void {
		if (element.marker.marker.code) {
			// TODO: Need a better way to do this
			templateData.container.textContent = '';
			const codeColumn = DOM.append(templateData.container, $('.code'));

			if (typeof element.marker.marker.code === 'string') {
				const highlightedLabel = new HighlightedLabel(codeColumn, false);
				highlightedLabel.set(element.marker.marker.code, element.codeMatches);
			} else {
				const codeLink = new Link({ href: element.marker.marker.code.target.toString(), label: '', title: element.marker.marker.code.target.toString() }, undefined, this.openerService);
				DOM.append(codeColumn, codeLink.el);
				const highlightedLabel = new HighlightedLabel(codeLink.el, false);
				highlightedLabel.set(element.marker.marker.code.value, element.codeMatches);
			}
		}
	}

	disposeTemplate(templateData: IMarkerCodeColumnTemplateData): void { }
}

class MarkerMessageColumnRenderer implements ITableRenderer<IMarkerTableItem, IMarkerHighlightedLabelColumnTemplateData>{

	static readonly TEMPLATE_ID = 'message';

	readonly templateId: string = MarkerMessageColumnRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): IMarkerHighlightedLabelColumnTemplateData {
		const messageColumn = DOM.append(container, $('.message'));
		const highlightedLabel = new HighlightedLabel(messageColumn, false);
		return { highlightedLabel };
	}

	renderElement(element: IMarkerTableItem, index: number, templateData: IMarkerHighlightedLabelColumnTemplateData, height: number | undefined): void {
		templateData.highlightedLabel.set(element.marker.marker.message, element.messageMatches);
	}

	disposeTemplate(templateData: IMarkerHighlightedLabelColumnTemplateData): void { }
}

class MarkerFileColumnRenderer implements ITableRenderer<IMarkerTableItem, IMarkerHighlightedLabelColumnTemplateData>{

	static readonly TEMPLATE_ID = 'file';

	readonly templateId: string = MarkerFileColumnRenderer.TEMPLATE_ID;

	constructor(
		@ILabelService private readonly labelService: ILabelService
	) { }

	renderTemplate(container: HTMLElement): IMarkerHighlightedLabelColumnTemplateData {
		const fileColumn = DOM.append(container, $('.file'));
		const highlightedLabel = new HighlightedLabel(fileColumn, false);
		return { highlightedLabel };
	}

	renderElement(element: IMarkerTableItem, index: number, templateData: IMarkerHighlightedLabelColumnTemplateData, height: number | undefined): void {
		templateData.highlightedLabel.set(this.labelService.getUriLabel(element.marker.resource, { relative: true }), element.fileMatches);
	}

	disposeTemplate(templateData: IMarkerHighlightedLabelColumnTemplateData): void { }
}

class MarkerPositionColumnRenderer implements ITableRenderer<IMarkerTableItem, IMarkerHighlightedLabelColumnTemplateData>{

	static readonly TEMPLATE_ID = 'position';

	readonly templateId: string = MarkerPositionColumnRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): IMarkerHighlightedLabelColumnTemplateData {
		const fileColumn = DOM.append(container, $('.position'));
		const highlightedLabel = new HighlightedLabel(fileColumn, false);
		return { highlightedLabel };
	}

	renderElement(element: IMarkerTableItem, index: number, templateData: IMarkerHighlightedLabelColumnTemplateData, height: number | undefined): void {
		templateData.highlightedLabel.set(Messages.MARKERS_PANEL_AT_LINE_COL_NUMBER(element.marker.marker.startLineNumber, element.marker.marker.startColumn), undefined);
	}

	disposeTemplate(templateData: IMarkerHighlightedLabelColumnTemplateData): void { }
}

class MarkerOwnerColumnRenderer implements ITableRenderer<IMarkerTableItem, IMarkerHighlightedLabelColumnTemplateData>{

	static readonly TEMPLATE_ID = 'owner';

	readonly templateId: string = MarkerOwnerColumnRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): IMarkerHighlightedLabelColumnTemplateData {
		const fileColumn = DOM.append(container, $('.owner'));
		const highlightedLabel = new HighlightedLabel(fileColumn, false);
		return { highlightedLabel };
	}

	renderElement(element: IMarkerTableItem, index: number, templateData: IMarkerHighlightedLabelColumnTemplateData, height: number | undefined): void {
		templateData.highlightedLabel.set(element.marker.marker.owner, element.ownerMatches);
	}

	disposeTemplate(templateData: IMarkerHighlightedLabelColumnTemplateData): void { }
}

export class MarkersTable extends Disposable {

	private _itemCount: number = 0;
	private readonly table: WorkbenchTable<IMarkerTableItem>;

	constructor(
		private readonly container: HTMLElement,
		private readonly markersViewModel: MarkersViewModel,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILabelService private readonly labelService: ILabelService,
	) {
		super();

		this.table = this.instantiationService.createInstance(WorkbenchTable,
			'Markers',
			this.container,
			new MarkersTableVirtualDelegate(),
			[
				{
					label: '',
					tooltip: '',
					weight: 0,
					minimumWidth: 40,
					maximumWidth: 40,
					templateId: MarkerActionsColumnRenderer.TEMPLATE_ID,
					project(row: Marker): Marker { return row; }
				},
				{
					label: '',
					tooltip: '',
					weight: 0,
					minimumWidth: 36,
					maximumWidth: 36,
					templateId: MarkerSeverityColumnRenderer.TEMPLATE_ID,
					project(row: Marker): Marker { return row; }
				},
				{
					label: localize('codeColumnLabel', "Code"),
					tooltip: '',
					weight: 0,
					minimumWidth: 100,
					maximumWidth: 100,
					templateId: MarkerCodeColumnRenderer.TEMPLATE_ID,
					project(row: Marker): Marker { return row; }
				},
				{
					label: localize('messageColumnLabel', "Message"),
					tooltip: '',
					weight: 2,
					templateId: MarkerMessageColumnRenderer.TEMPLATE_ID,
					project(row: Marker): Marker { return row; }
				},
				{
					label: localize('fileColumnLabel', "File"),
					tooltip: '',
					weight: 1,
					templateId: MarkerFileColumnRenderer.TEMPLATE_ID,
					project(row: Marker): Marker { return row; }
				},
				{
					label: localize('positionColumnLabel', "Position"),
					tooltip: '',
					weight: 0,
					minimumWidth: 100,
					maximumWidth: 100,
					templateId: MarkerPositionColumnRenderer.TEMPLATE_ID,
					project(row: Marker): Marker { return row; }
				},
				{
					label: localize('ownerColumnLabel', "Owner"),
					tooltip: '',
					weight: 1,
					templateId: MarkerOwnerColumnRenderer.TEMPLATE_ID,
					project(row: Marker): Marker { return row; }
				}
			],
			[
				this.instantiationService.createInstance(MarkerActionsColumnRenderer, this.markersViewModel),
				this.instantiationService.createInstance(MarkerSeverityColumnRenderer),
				this.instantiationService.createInstance(MarkerCodeColumnRenderer),
				this.instantiationService.createInstance(MarkerMessageColumnRenderer),
				this.instantiationService.createInstance(MarkerFileColumnRenderer),
				this.instantiationService.createInstance(MarkerPositionColumnRenderer),
				this.instantiationService.createInstance(MarkerOwnerColumnRenderer),
			],
			{
				horizontalScrolling: false,
				multipleSelectionSupport: false
			}
		) as WorkbenchTable<IMarkerTableItem>;

		const list = this.table.domNode.querySelector('.monaco-list-rows')! as HTMLElement;

		const onMouseOver = new DomEmitter(list, 'mouseover');
		const onRowHover = Event.chain(onMouseOver.event)
			.map(e => DOM.findParentWithClass(e.target as HTMLElement, 'monaco-list-row', 'monaco-list-rows'))
			.filter<HTMLElement>(((e: HTMLElement | null) => !!e) as any)
			.map(e => parseInt(e.getAttribute('data-index')!))
			.event;

		const onMouseLeave = new DomEmitter(list, 'mouseleave');
		const onListLeave = Event.map(onMouseLeave.event, () => -1);

		const onRowHoverOrLeave = Event.latch(Event.any(onRowHover, onListLeave));
		const onRowPermanentHover = Event.debounce(onRowHoverOrLeave, (_, e) => e, 500);

		onRowPermanentHover(e => {
			if (e !== -1) {
				this.markersViewModel.onMarkerMouseHover(this.table.row(e).marker);
			}
		});
	}

	get itemCount(): number {
		return this._itemCount;
	}

	get on(): Event<ITableContextMenuEvent<IMarkerTableItem>> {
		return this.table.onContextMenu;
	}

	get onContextMenu(): Event<ITableContextMenuEvent<IMarkerTableItem>> {
		return this.table.onContextMenu;
	}

	get onDidOpen(): Event<IOpenEvent<IMarkerTableItem | undefined>> {
		return this.table.onDidOpen;
	}

	isVisible(): boolean {
		return !this.container.classList.contains('hidden');
	}

	layout(height: number, width: number): void {
		this.table.layout(height, width);
	}

	toggleVisibility(hide: boolean): void {
		this.container.classList.toggle('hidden', hide);
	}

	updateTable(markers: Marker[], filterOptions: FilterOptions): void {
		const items: IMarkerTableItem[] = [];
		for (const marker of markers) {
			// Severity filter
			const matchesSeverity = filterOptions.showErrors && MarkerSeverity.Error === marker.marker.severity ||
				filterOptions.showWarnings && MarkerSeverity.Warning === marker.marker.severity ||
				filterOptions.showInfos && MarkerSeverity.Info === marker.marker.severity;

			if (!matchesSeverity) {
				continue;
			}

			// // Include pattern
			// if (filterOptions.filter && !filterOptions.includesMatcher.matches(marker.resource)) {
			// 	continue;
			// }

			// // Exclude pattern
			// if (filterOptions.filter && filterOptions.excludesMatcher.matches(marker.resource)) {
			// 	continue;
			// }

			// Text filter
			if (filterOptions.textFilter.text) {
				const codeMatches = marker.marker.code ? FilterOptions._filter(filterOptions.textFilter.text, typeof marker.marker.code === 'string' ? marker.marker.code : marker.marker.code.value) ?? undefined : undefined;
				const messageMatches = FilterOptions._messageFilter(filterOptions.textFilter.text, marker.marker.message) ?? undefined;
				const fileMatches = FilterOptions._messageFilter(filterOptions.textFilter.text, this.labelService.getUriLabel(marker.resource, { relative: true })) ?? undefined;
				const ownerMatches = FilterOptions._messageFilter(filterOptions.textFilter.text, marker.marker.owner) ?? undefined;

				const matched = codeMatches || messageMatches || fileMatches || ownerMatches;
				if ((matched && !filterOptions.textFilter.negate) || (!matched && filterOptions.textFilter.negate)) {
					items.push({ marker, codeMatches, messageMatches, fileMatches, ownerMatches });
				}

				continue;
			}

			items.push({ marker });
		}

		this._itemCount = items.length;
		this.table.splice(0, Number.POSITIVE_INFINITY, items);
	}
}

class MarkersTableVirtualDelegate implements ITableVirtualDelegate<any> {
	static readonly HEADER_ROW_HEIGHT = 30;
	static readonly ROW_HEIGHT = 24;
	readonly headerRowHeight = MarkersTableVirtualDelegate.HEADER_ROW_HEIGHT;

	getHeight(item: any) {
		return MarkersTableVirtualDelegate.ROW_HEIGHT;
	}
}
