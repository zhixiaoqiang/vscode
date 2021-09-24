/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import * as DOM from 'vs/base/browser/dom';
import * as network from 'vs/base/common/network';
import { Event } from 'vs/base/common/event';
import { ITableContextMenuEvent, ITableRenderer, ITableVirtualDelegate } from 'vs/base/browser/ui/table/table';
import { Disposable } from 'vs/base/common/lifecycle';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IOpenEvent, WorkbenchTable } from 'vs/platform/list/browser/listService';
import { HighlightedLabel } from 'vs/base/browser/ui/highlightedlabel/highlightedLabel';
import { Marker, ResourceMarkers } from 'vs/workbench/contrib/markers/browser/markersModel';
import { MarkerSeverity } from 'vs/platform/markers/common/markers';
import { SeverityIcon } from 'vs/platform/severityIcon/common/severityIcon';
import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { ILabelService } from 'vs/platform/label/common/label';
import { FilterOptions } from 'vs/workbench/contrib/markers/browser/markersFilterOptions';
import { IMatch } from 'vs/base/common/filters';
import { Link } from 'vs/platform/opener/browser/link';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { MarkersViewModel } from 'vs/workbench/contrib/markers/browser/markersTreeViewer';
import { IAction } from 'vs/base/common/actions';
import { QuickFixAction, QuickFixActionViewItem } from 'vs/workbench/contrib/markers/browser/markersViewActions';
import { DomEmitter } from 'vs/base/browser/event';
import Messages from 'vs/workbench/contrib/markers/browser/messages';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { IProblemsWidget } from 'vs/workbench/contrib/markers/browser/markersView';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';

const $ = DOM.$;

export interface IMarkerTableItem {
	marker: Marker;
	sourceMatches?: IMatch[];
	codeMatches?: IMatch[];
	messageMatches?: IMatch[];
	fileMatches?: IMatch[];
	ownerMatches?: IMatch[];
}

interface IMarkerIconColumnTemplateData {
	readonly icon: HTMLElement;
	readonly actionBar: ActionBar;
}

interface IMarkerMessageColumnTemplateData {
	readonly messageColumn: HTMLElement;
	readonly messageLabel: HighlightedLabel;
	readonly sourceLabel: HighlightedLabel;
	readonly codeLabel: HighlightedLabel;
	readonly codeLink: Link;
}

interface IMarkerFileColumnTemplateData {
	readonly fileLabel: HighlightedLabel;
	readonly positionLabel: HighlightedLabel;
}


interface IMarkerHighlightedLabelColumnTemplateData {
	readonly highlightedLabel: HighlightedLabel;
}

class MarkerSeverityColumnRenderer implements ITableRenderer<IMarkerTableItem, IMarkerIconColumnTemplateData>{

	static readonly TEMPLATE_ID = 'severity';

	readonly templateId: string = MarkerSeverityColumnRenderer.TEMPLATE_ID;

	constructor(
		private readonly markersViewModel: MarkersViewModel,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) { }

	renderTemplate(container: HTMLElement): IMarkerIconColumnTemplateData {
		const severityColumn = DOM.append(container, $('.severity'));
		const icon = DOM.append(severityColumn, $(''));

		const actionBarColumn = DOM.append(container, $('.actions'));
		const actionBar = new ActionBar(actionBarColumn, {
			actionViewItemProvider: (action: IAction) => action.id === QuickFixAction.ID ? this.instantiationService.createInstance(QuickFixActionViewItem, <QuickFixAction>action) : undefined,
			animated: false
		});

		return { actionBar, icon };
	}

	renderElement(element: IMarkerTableItem, index: number, templateData: IMarkerIconColumnTemplateData, height: number | undefined): void {
		const toggleQuickFix = (enabled?: boolean) => {
			if (!isUndefinedOrNull(enabled)) {
				const container = DOM.findParentWithClass(templateData.icon, 'monaco-table-td')!;
				container.classList.toggle('quickFix', enabled);
			}
		};

		templateData.icon.className = `marker-icon codicon ${SeverityIcon.className(MarkerSeverity.toSeverity(element.marker.marker.severity))}`;

		templateData.actionBar.clear();
		const viewModel = this.markersViewModel.getViewModel(element.marker);
		if (viewModel) {
			const quickFixAction = viewModel.quickFixAction;
			templateData.actionBar.push([quickFixAction], { icon: true, label: false });
			toggleQuickFix(viewModel.quickFixAction.enabled);

			quickFixAction.onDidChange(({ enabled }) => toggleQuickFix(enabled));
		}
	}

	disposeTemplate(templateData: IMarkerIconColumnTemplateData): void { }
}

class MarkerMessageColumnRenderer implements ITableRenderer<IMarkerTableItem, IMarkerMessageColumnTemplateData>{

	static readonly TEMPLATE_ID = 'message';

	readonly templateId: string = MarkerMessageColumnRenderer.TEMPLATE_ID;

	constructor(
		@IOpenerService private readonly openerService: IOpenerService
	) { }

	renderTemplate(container: HTMLElement): IMarkerMessageColumnTemplateData {
		const messageColumn = DOM.append(container, $('.message'));

		const messageLabel = new HighlightedLabel(messageColumn, false);

		const sourceLabel = new HighlightedLabel(messageColumn, false);
		sourceLabel.element.classList.add('source-label');

		const codeLabel = new HighlightedLabel(messageColumn, false);
		codeLabel.element.classList.add('code-label');

		const codeLink = new Link(messageColumn, { href: '', label: '' }, {}, this.openerService);

		return { messageColumn, messageLabel, sourceLabel, codeLabel, codeLink };
	}

	renderElement(element: IMarkerTableItem, index: number, templateData: IMarkerMessageColumnTemplateData, height: number | undefined): void {
		templateData.messageLabel.set(element.marker.marker.message, element.messageMatches);

		if (element.marker.marker.source && element.marker.marker.code) {
			templateData.messageColumn.classList.toggle('code-link', typeof element.marker.marker.code !== 'string');

			if (typeof element.marker.marker.code === 'string') {
				templateData.sourceLabel.set(element.marker.marker.source, element.sourceMatches);
				templateData.codeLabel.set(element.marker.marker.code, element.codeMatches);
			} else {
				templateData.sourceLabel.set(element.marker.marker.source, element.sourceMatches);

				const codeLinkLabel = new HighlightedLabel($('.code-link-label'), false);
				codeLinkLabel.set(element.marker.marker.code.value, element.codeMatches);

				templateData.codeLink.link = {
					href: element.marker.marker.code.target.toString(),
					title: element.marker.marker.code.target.toString(),
					label: codeLinkLabel.element,
				};
			}
		}
	}

	disposeTemplate(templateData: IMarkerMessageColumnTemplateData): void { }
}

class MarkerFileColumnRenderer implements ITableRenderer<IMarkerTableItem, IMarkerFileColumnTemplateData>{

	static readonly TEMPLATE_ID = 'file';

	readonly templateId: string = MarkerFileColumnRenderer.TEMPLATE_ID;

	constructor(
		@ILabelService private readonly labelService: ILabelService
	) { }

	renderTemplate(container: HTMLElement): IMarkerFileColumnTemplateData {
		const fileColumn = DOM.append(container, $('.file'));
		const fileLabel = new HighlightedLabel(fileColumn, false);
		fileLabel.element.classList.add('file-label');
		const positionLabel = new HighlightedLabel(fileColumn, false);
		positionLabel.element.classList.add('file-position');

		return { fileLabel, positionLabel };
	}

	renderElement(element: IMarkerTableItem, index: number, templateData: IMarkerFileColumnTemplateData, height: number | undefined): void {
		templateData.fileLabel.set(this.labelService.getUriLabel(element.marker.resource, { relative: true }), element.fileMatches);
		templateData.positionLabel.set(Messages.MARKERS_PANEL_AT_LINE_COL_NUMBER(element.marker.marker.startLineNumber, element.marker.marker.startColumn), undefined);
	}

	disposeTemplate(templateData: IMarkerFileColumnTemplateData): void { }
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

class MarkersTableVirtualDelegate implements ITableVirtualDelegate<any> {
	static readonly HEADER_ROW_HEIGHT = 24;
	static readonly ROW_HEIGHT = 24;
	readonly headerRowHeight = MarkersTableVirtualDelegate.HEADER_ROW_HEIGHT;

	getHeight(item: any) {
		return MarkersTableVirtualDelegate.ROW_HEIGHT;
	}
}

export class MarkersTable extends Disposable implements IProblemsWidget {

	private _itemCount: number = 0;
	private readonly table: WorkbenchTable<IMarkerTableItem>;

	constructor(
		private readonly container: HTMLElement,
		private readonly markersViewModel: MarkersViewModel,
		@IContextKeyService readonly contextKeyService: IContextKeyService,
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
					minimumWidth: 36,
					maximumWidth: 36,
					templateId: MarkerSeverityColumnRenderer.TEMPLATE_ID,
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
					label: localize('sourceColumnLabel', "Source"),
					tooltip: '',
					weight: 1,
					templateId: MarkerOwnerColumnRenderer.TEMPLATE_ID,
					project(row: Marker): Marker { return row; }
				}
			],
			[
				this.instantiationService.createInstance(MarkerSeverityColumnRenderer, this.markersViewModel),
				this.instantiationService.createInstance(MarkerMessageColumnRenderer),
				this.instantiationService.createInstance(MarkerFileColumnRenderer),
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

	get onContextMenu(): Event<ITableContextMenuEvent<IMarkerTableItem>> {
		return this.table.onContextMenu;
	}

	get onDidOpen(): Event<IOpenEvent<IMarkerTableItem | undefined>> {
		return this.table.onDidOpen;
	}

	collapseMarkers(): void { }

	domFocus(): void {
		this.table.domFocus();
	}

	filterMarkers(resourceMarkers: ResourceMarkers[], filterOptions: FilterOptions): void {
		this.reset(resourceMarkers, filterOptions);
	}

	getFocus(): (Marker | null)[] {
		return [];
	}

	getHTMLElement(): HTMLElement {
		return this.table.getHTMLElement();
	}

	getRelativeTop(location: Marker | null): number | null {
		return null;
	}

	getSelection(): any {
		return this.table.getSelection();
	}

	getVisibleItemCount(): number {
		return this._itemCount;
	}

	isVisible(): boolean {
		return !this.container.classList.contains('hidden');
	}

	layout(height: number, width: number): void {
		this.table.layout(height, width);
	}

	reset(resourceMarkers: ResourceMarkers[], filterOptions: FilterOptions): void {
		const items: IMarkerTableItem[] = [];
		for (const resourceMarker of resourceMarkers) {
			for (const marker of resourceMarker.markers) {
				if (marker.resource.scheme === network.Schemas.walkThrough || marker.resource.scheme === network.Schemas.walkThroughSnippet) {
					continue;
				}

				// Exclude pattern
				if (filterOptions.excludesMatcher.matches(marker.resource)) {
					continue;
				}

				// Include pattern
				if (filterOptions.includesMatcher.matches(marker.resource)) {
					items.push({ marker });
					continue;
				}

				// Severity filter
				const matchesSeverity = filterOptions.showErrors && MarkerSeverity.Error === marker.marker.severity ||
					filterOptions.showWarnings && MarkerSeverity.Warning === marker.marker.severity ||
					filterOptions.showInfos && MarkerSeverity.Info === marker.marker.severity;

				if (!matchesSeverity) {
					continue;
				}

				// Text filter
				if (filterOptions.textFilter.text) {
					const sourceMatches = marker.marker.source ? FilterOptions._filter(filterOptions.textFilter.text, marker.marker.source) ?? undefined : undefined;
					const codeMatches = marker.marker.code ? FilterOptions._filter(filterOptions.textFilter.text, typeof marker.marker.code === 'string' ? marker.marker.code : marker.marker.code.value) ?? undefined : undefined;
					const messageMatches = FilterOptions._messageFilter(filterOptions.textFilter.text, marker.marker.message) ?? undefined;
					const fileMatches = FilterOptions._messageFilter(filterOptions.textFilter.text, this.labelService.getUriLabel(marker.resource, { relative: true })) ?? undefined;
					const ownerMatches = FilterOptions._messageFilter(filterOptions.textFilter.text, marker.marker.owner) ?? undefined;

					const matched = sourceMatches || codeMatches || messageMatches || fileMatches || ownerMatches;
					if ((matched && !filterOptions.textFilter.negate) || (!matched && filterOptions.textFilter.negate)) {
						items.push({ marker, sourceMatches, codeMatches, messageMatches, fileMatches, ownerMatches });
					}

					continue;
				}

				items.push({ marker });
			}
		}
		this._itemCount = items.length;
		this.table.splice(0, Number.POSITIVE_INFINITY, items.sort((a, b) => MarkerSeverity.compare(a.marker.marker.severity, b.marker.marker.severity)));
	}

	revealMarkers(activeResource: ResourceMarkers | null, focus: boolean): void { }

	setAriaLabel(label: string): void {
		this.table.domNode.ariaLabel = label;
	}

	setMarkerSelection(): void {
	}

	toggleVisibility(hide: boolean): void {
		this.container.classList.toggle('hidden', hide);
	}

	update(resourceMarkers: ResourceMarkers[]): void {
	}

	updateMarker(marker: Marker): void {
	}
}
