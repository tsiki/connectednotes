import {Component, EventEmitter, HostBinding, Input, OnInit, Output} from '@angular/core';
import {NoteService} from '../note.service';
import {SettingsService} from '../settings.service';
import {SubviewManagerService} from '../subview-manager.service';
import {NotificationService} from '../notification.service';
import {NoteObject, ParentTagToChildTags, TagGroup, TagNesting} from '../types';
import {SortDirection} from '../zettelkasten/zettelkasten.component';
import {MatDialog} from '@angular/material/dialog';
import {EditTagParentsDialogComponent} from '../edit-tag-parents-dialog/edit-tag-parents-dialog.component';
import {AUTOMATICALLY_GENERATED_TAG_NAMES, ROOT_TAG_NAME} from '../constants';
import {FilelistComponent} from '../filelist/filelist.component';
import {CdkDragMove} from '@angular/cdk/drag-drop';
import {combineLatest} from 'rxjs';

@Component({
  selector: 'app-tag-group',
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
<!--    ['#root-tag1', '#root-tag2']-->
    <ng-container *ngIf="expanded || isRootTagGroup">
      <app-tag-group
          *ngFor="let tag of childTags; trackBy: trackByTagFn"
          cdkDrag
          (cdkDragMoved)="onDragMoved($event)"
          (tagDraggedOverOtherTag)="tagDraggedOverOtherTag.emit($event)"
          class="tag-group"
          [ngStyle]="{'margin-left.px': isRootTagGroup ? 0 : 10}"
          showBorder="true"
          [attr.data-tag]="tag"
          [tag]="tag"
          [sortDirection]="currentSortDirection">
      </app-tag-group>

      <ng-container *ngIf="!isRootTagGroup">
        <button *ngFor="let noteId of noteIds; trackBy: trackByIdFn"
                [class.mat-button-toggle-checked]="selectedNoteIds.has(noteId)"
                class="note-link tag-group-note"
                (click)="openNote($event, noteId)"
                matTooltip="{{ noteService.getNote(noteId).title }}"
                mat-button>
          <span>{{ noteService.getNote(noteId).title }}<!--
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
      readonly noteService: NoteService,
      private readonly settingsService: SettingsService,
      private readonly subviewManager: SubviewManagerService,
      private notifications: NotificationService) {
  }

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

  @HostBinding('style.border-left')
  get borderLeft(): string {
    if (this.isRootTagGroup) {
      return '';
    }
    return this.expanded
        ? '1px solid var(--nested-tag-gutter-color)'
        : '1px solid transparent';
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

  ngOnInit(): void {
    this.subviewManager.activeNotes
        .subscribe(activeNotes => this.selectedNoteIds = new Set(activeNotes));

    if (!this.isRootTagGroup) {
      this.noteService.nestedTagGroups
          .subscribe(nestedTagGroups => this.childTags = nestedTagGroups[this.tag]);
    }

    combineLatest([this.noteService.tagGroups, this.noteService.nestedTagGroups])
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

  trackByIdFn(index: number, item: NoteObject) {
    return item.id;
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
    const getTagGroupFn = (tag) => this.noteService.getTagGroupForTag(tag);
    if (!this.isRootTagGroup) {
      this.childTags = TagGroupComponent.sortTags(this.childTags, direction, getTagGroupFn);
    } else {
      const autoTags = this.childTags.filter(tag => AUTOMATICALLY_GENERATED_TAG_NAMES.includes(tag));
      const toSortTags = this.childTags.filter(tag => !AUTOMATICALLY_GENERATED_TAG_NAMES.includes(tag));
      const sortedTags = TagGroupComponent.sortTags(toSortTags, direction, getTagGroupFn);
      this.childTags = [...autoTags, ...sortedTags];
    }
    const getNoteFn = noteId => this.noteService.getNote(noteId);
    this.noteIds = TagGroupComponent.sortNotes(this.noteIds, direction, getNoteFn);
  }

  trackByTagFn(index: number, item: TagGroup) {
    return item.tag;
  }

  onDragMoved(e: CdkDragMove) {
    const sourceTag = e.source.element.nativeElement.dataset.tag;
    for (const elem of e.event.composedPath()) {
      if ((elem as HTMLElement).tagName === 'APP-TAG-GROUP') {
        const targetTag = (elem as HTMLElement).dataset.tag;
        this.tagDraggedOverOtherTag.emit({ parentTag: targetTag, childTag: sourceTag });
        return;
      }
    }
    this.tagDraggedOverOtherTag.emit({ parentTag: null, childTag: sourceTag });
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
}
