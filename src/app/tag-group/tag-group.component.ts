import {Component, EventEmitter, HostBinding, Input, OnInit, Output} from '@angular/core';
import {StorageService} from '../storage.service';
import {SettingsService} from '../settings.service';
import {SubviewManagerService} from '../subview-manager.service';
import {NotificationService} from '../notification.service';
import {NoteDrag, NoteObject, ParentTagToChildTags, TagGroup, TagNesting} from '../types';
import {SortDirection} from '../zettelkasten/zettelkasten.component';
import {MatDialog} from '@angular/material/dialog';
import {EditTagParentsDialogComponent} from '../edit-tag-parents-dialog/edit-tag-parents-dialog.component';
import {AUTOMATICALLY_GENERATED_TAG_NAMES, ROOT_TAG_NAME} from '../constants';
import {CdkDragMove} from '@angular/cdk/drag-drop';
import {combineLatest} from 'rxjs';

@Component({
  selector: 'cn-tag-group',
  template: `
    <button class="tag-group-link"
            *ngIf="!isRootTagGroup"
            [class.expanded]="expanded"
            (click)="expanded = !expanded"
            mat-button>
      <mat-icon class="expand-icon">expand_more</mat-icon>
      {{ tag }}
      <span class="more-button"
            *ngIf="!automaticallyGeneratedTagNames.includes(tag)"
            mat-button
            matTooltip="extra options"
            [matMenuTriggerFor]="menu"
            (click)="$event.stopPropagation()">
        <mat-icon>more_vert</mat-icon>
        <mat-menu #menu="matMenu">
          <button mat-menu-item (click)="ignoreTag(tag)">
            Ignore tag "{{ tag }}"
          </button>
          <button mat-menu-item (click)="editParentTags(tag)">
            Edit parent tags
          </button>
        </mat-menu>
      </span>
    </button>
    <ng-container *ngIf="expanded || isRootTagGroup">
      <div id="group-indicator" *ngIf="!isRootTagGroup"></div>
      <cn-tag-group
          *ngFor="let childTag of childTags"
          cdkDrag
          [class.highlighted]="isRootTagGroup"
          (cdkDragMoved)="onTagGroupDragMoved($event)"
          (tagDraggedOverOtherTag)="tagDraggedOverOtherTag.emit($event)"
          (noteDraggedOverTag)="noteDraggedOverTag.emit($event)"
          class="tag-group"
          [ngStyle]="{'margin-left.px': isRootTagGroup ? 0 : 10}"
          [attr.data-tag]="childTag"
          [attr.data-parent-tag]="tag"
          [tag]="childTag"
          [sortDirection]="currentSortDirection">
      </cn-tag-group>

      <ng-container *ngIf="!isRootTagGroup">
        <button *ngFor="let noteId of noteIds"
                [class.mat-button-toggle-checked]="selectedNoteIds.has(noteId)"
                class="note-link tag-group-note"
                (click)="openNote($event, noteId)"
                matTooltip="{{ storage.getNote(noteId).title }}"
                [attr.data-title]="storage.getNote(noteId).title"
                [attr.data-tag-group]="tag"
                data-button-type="note-title-button"
                cdkDrag
                (cdkDragMoved)="onNoteButtonDragMoved($event)"
                mat-button>
          <span>{{ storage.getNote(noteId).title }}<!--
          --><span class="unsaved-marker" *ngIf="unsavedNotes.has(noteId)">*</span></span>
        </button>
      </ng-container>
    </ng-container>
  `,
  styles: [`
    :host {
      border-left: 1px solid transparent;
      display: flex;
      flex-direction: column;
      font-weight: 300;
      position: relative;
    }

    #group-indicator {
      height: calc(100% - 30px);
      width: 1px;
      position: absolute;
      left: 8px;
      top: 30px;
      background-color: var(--nested-tag-gutter-color);
    }

    #icon-menu > * {
      align-items: stretch;
      flex-direction: column;
      width: 40px;
    }

    #note-list-container ol {
      align-items: stretch;
      display: flex;
      flex-direction: column;
      list-style-type: none;
      padding: 0;
    }

    .expanded .tag-group-note.note-link {
      display: flex;
      padding-left: 30px;
      background-color: var(--primary-background-color);
    }

    .tag-group-link,
    .tag-group-note {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .tag-group-link {
      padding-left: 0;
    }

    .tag-group-link,
    .note-link {
      cursor: pointer;
      color: var(--primary-text-color);
      display: flex;
      font-weight: 400;
      width: 100%;
    }

    button {
      outline: none;
    }

    #context-menu > mat-card {
      padding: 0;
    }

    .expand-icon {
      font-size: 18px;
      transition: .2s;
      transform: rotate(-90deg);
    }

    .expanded .expand-icon {
      transform: initial;
      margin-left: -3px;
    }

    .unsaved-marker {
      position: sticky;
      right: 0;
    }

    .more-button {
      display: none;
      position: absolute;
      right: 0;
      width: 30px;
    }

    .tag-group-link:hover .more-button {
      align-items: center;
      display: inline-flex;
      height: 100%;
    }

    .mat-button-toggle-checked {
      background-color: var(--selected-note-color);
    }
  `]
})
export class TagGroupComponent implements OnInit {
  @Input() tag: string;
  // Emits event when user is dragging a tag around.
  @Output() tagDraggedOverOtherTag: EventEmitter<TagNesting> = new EventEmitter();
  @Output() noteDraggedOverTag: EventEmitter<NoteDrag> = new EventEmitter();
  selectedNoteIds: Set<string> = new Set();
  noteIds: string[] = [];
  unsavedNotes = new Set<string>();
  childTags: string[] = [];
  expanded = false;
  automaticallyGeneratedTagNames = AUTOMATICALLY_GENERATED_TAG_NAMES;
  currentSortDirection: SortDirection = SortDirection.MODIFIED_NEWEST_FIRST;
  isRootTagGroup = false;

  constructor(
      public dialog: MatDialog,
      readonly storage: StorageService,
      private readonly settingsService: SettingsService,
      private readonly subviewManager: SubviewManagerService,
      private notifications: NotificationService) {}

  get isRoot() {
    return this.isRootTagGroup;
  }

  @Input() set isRoot(isRoot: boolean|string) {
    this.isRootTagGroup = isRoot === 'true';
  }

  @Input() set sortDirection(direction: SortDirection) {
    this.currentSortDirection = direction;
    this.setSortDirection(direction);
  }

  ngOnInit(): void {
    this.subviewManager.activeNotes
        .subscribe(activeNotes => this.selectedNoteIds = new Set(activeNotes));

    if (!this.isRootTagGroup) {
      this.storage.nestedTagGroups
          .subscribe(nestedTagGroups => this.childTags = nestedTagGroups[this.tag]);
    }

    combineLatest([this.storage.tagGroups, this.storage.nestedTagGroups])
        .subscribe(data => {
      const [tagGroups, nestedTagGroups] = data;
      if (tagGroups && nestedTagGroups) {
        if (this.isRootTagGroup) {
          this.childTags = this.getRootTags(tagGroups.map(tg => tg.tag), nestedTagGroups);
        } else {
          this.noteIds = tagGroups?.find(tg => tg.tag === this.tag)?.noteIds || [];
          this.childTags = nestedTagGroups[this.tag] || [];
        }
        this.setSortDirection(this.currentSortDirection);
      }
    });
    this.notifications.unsaved.subscribe(
        unsavedNotes => this.unsavedNotes = new Set<string>(unsavedNotes));
  }

  ignoreTag(tag: string) {
    this.settingsService.addIgnoredTag(tag);
  }

  editParentTags(tag: string) {
    this.dialog.open(EditTagParentsDialogComponent, {
      position: { top: '10px' },
      data: { tag },
    });
  }

  openNote(e: MouseEvent, noteId: string) {
    if (e.metaKey || e.ctrlKey) {
      this.subviewManager.openNoteInNewWindow(noteId);
    } else {
      this.subviewManager.openViewInActiveWindow(noteId);
    }
  }

  setSortDirection(direction: SortDirection) {
    if (!this.childTags) {
      return;
    }
    const getTagGroupFn = (tag) => this.storage.getTagGroupForTag(tag);
    if (!this.isRootTagGroup) {
      this.childTags = TagGroupComponent.sortTags(this.childTags, direction, getTagGroupFn);
    } else {
      const autoTags = this.childTags.filter(tag => AUTOMATICALLY_GENERATED_TAG_NAMES.includes(tag));
      const toSortTags = this.childTags.filter(tag => !AUTOMATICALLY_GENERATED_TAG_NAMES.includes(tag));
      const sortedTags = TagGroupComponent.sortTags(toSortTags, direction, getTagGroupFn);
      this.childTags = [...autoTags, ...sortedTags];
    }
    const getNoteFn = noteId => this.storage.getNote(noteId);
    this.noteIds = TagGroupComponent.sortNotes(this.noteIds, direction, getNoteFn);
  }

  onTagGroupDragMoved(e: CdkDragMove) {
    const sourceTag = e.source.element.nativeElement.dataset.tag;
    const oldParentTag = e.source.element.nativeElement.dataset.parentTag;
    for (const elem of e.event.composedPath()) {
      if ((elem as HTMLElement).tagName === 'CN-TAG-GROUP') {
        const targetTag = (elem as HTMLElement).dataset.tag;
        this.tagDraggedOverOtherTag.emit({ oldParentTag, newParentTag: targetTag, childTag: sourceTag });
        return;
      }
    }
    this.tagDraggedOverOtherTag.emit({ newParentTag: null, oldParentTag: null, childTag: sourceTag });
  }

  onNoteButtonDragMoved(e: CdkDragMove) {
    const source = e.source.element.nativeElement;
    const noteTitle = source.dataset.title;
    const sourceTag = source.dataset.tagGroup;
    for (const elem of e.event.composedPath()) {
      // If we drag note title button over another button nothing happens
      if ((elem as HTMLElement).dataset.buttonType === 'note-title-button') {
        this.noteDraggedOverTag.emit({noteTitle, sourceTag, targetTag: null});
        return;
      }
      if ((elem as HTMLElement).tagName === 'CN-TAG-GROUP') {
        const targetTag = (elem as HTMLElement).dataset.tag;
        this.noteDraggedOverTag.emit({noteTitle, sourceTag, targetTag});
        return;
      }
    }
    this.noteDraggedOverTag.emit({noteTitle, sourceTag, targetTag: null});
  }

  /**
   * If a tag is the child tag of another tag, it won't show up on the 'root' level
   * unless it's explicitly marked as having root as its parent. Otherwise it'll only
   * show up as a child under its parent tag(s). If a tag doesn't have any parent tags,
   * it only appears on the root level.
   */
  private getRootTags(allTags: string[], nestedTagGroups: ParentTagToChildTags) {
    // Get tag groups have no specified parent or have explicitly specified root as their
    // parent - these are the root tags.
    const tagsWithExplicitRoot = new Set(nestedTagGroups[ROOT_TAG_NAME] || []);
    const tagsWithParent = Object.values(nestedTagGroups).flat();
    const tagsNotOnRootLevel = new Set(tagsWithParent.filter(tag => !tagsWithExplicitRoot.has(tag)));
    return allTags.filter(tag => !tagsNotOnRootLevel.has(tag));
  }

  static sortNotes(noteIds: string[], direction: SortDirection, getNoteFn: (noteId: string) => NoteObject) {
    switch (direction) {
      case SortDirection.MODIFIED_NEWEST_FIRST:
        noteIds.sort(
            (a, b) =>
                getNoteFn(b).lastChangedEpochMillis - getNoteFn(a).lastChangedEpochMillis);
        break;
      case SortDirection.MODIFIED_OLDEST_FIRST:
        noteIds.sort(
            (a, b) =>
                getNoteFn(a).lastChangedEpochMillis - getNoteFn(b).lastChangedEpochMillis);
        break;
      case SortDirection.ALPHABETICAL:
        noteIds.sort((a, b) => getNoteFn(a).title.localeCompare(getNoteFn(b).title));
        break;
      case SortDirection.ALPHABETICAL_REVERSED:
        noteIds.sort((a, b) => getNoteFn(b).title.localeCompare(getNoteFn(a).title));
        break;
    }
    return noteIds;
  }

  static sortTags(tags: string[], direction: SortDirection, getTagGroupFn: (tag: string) => TagGroup) {
    switch (direction) {
      case SortDirection.MODIFIED_NEWEST_FIRST:
        tags.sort(
            (a, b) =>
                getTagGroupFn(b).newestNoteChangeTimestamp - getTagGroupFn(a).newestNoteChangeTimestamp);
        break;
      case SortDirection.MODIFIED_OLDEST_FIRST:
        tags.sort(
            (a, b) =>
                getTagGroupFn(a).newestNoteChangeTimestamp - getTagGroupFn(b).newestNoteChangeTimestamp);
        break;
      case SortDirection.ALPHABETICAL:
        tags.sort((a, b) => a.localeCompare(b));
        break;
      case SortDirection.ALPHABETICAL_REVERSED:
        tags.sort((a, b) => b.localeCompare(a));
        break;
    }
    return tags;
  }
}
