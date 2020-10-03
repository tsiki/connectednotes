import {ChangeDetectorRef, Component, ElementRef, Input, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {NoteService} from '../note.service';
import {MatSnackBar} from '@angular/material/snack-bar';
import {NoteObject, TagGroup} from '../types';
import {SettingsService} from '../settings.service';
import {NotificationService} from '../notification.service';
import {SortDirection} from '../zettelkasten/zettelkasten.component';
import {SubviewManagerService} from '../subview-manager.service';

@Component({
  selector: 'app-filelist',
  templateUrl: './filelist.component.html',
  styles: [``],
})
export class FilelistComponent implements OnInit {
  @ViewChild('titleRenameInput') titleRenameInput: ElementRef;
  @ViewChild('contextMenu') contextMenu: ElementRef;
  @Input() set sortDirection(direction: SortDirection) {
    this.currentSortDirection = direction;
    this.setSortDirection(direction);
  }

  selectedNoteIds: Set<string> = new Set();
  tagGroups: TagGroup[];
  unsavedNotes = new Set<string>();

  private currentSortDirection: SortDirection = SortDirection.MODIFIED_NEWEST_FIRST;

  constructor(
      readonly noteService: NoteService,
      private readonly route: ActivatedRoute,
      private readonly settingsService: SettingsService,
      private readonly subviewManager: SubviewManagerService,
      private snackBar: MatSnackBar,
      private cdr: ChangeDetectorRef,
      private notifications: NotificationService) {
  }

  ngOnInit(): void {
    this.subviewManager.subviews.subscribe(subviews =>
        this.selectedNoteIds = new Set(subviews.filter(s => s.type === 'note').map(s => s.noteId)));
    this.noteService.tagGroups.asObservable().subscribe(tagGroups => {
      if (tagGroups) {
        this.tagGroups = tagGroups.slice();
        this.setSortDirection(this.currentSortDirection);
        this.cdr.detectChanges(); // For some reason angular doesn't always pick up the changes
      }
    });
    this.notifications.unsaved.subscribe(unsavedNotes => this.unsavedNotes = new Set<string>(unsavedNotes));
  }

  setSortDirection(direction: SortDirection) {
    if (!this.tagGroups) {
      return;
    }
    this.currentSortDirection = direction;
    const getNoteFn = (noteId) => this.noteService.getNote(noteId);
    switch (direction) {
      case SortDirection.MODIFIED_NEWEST_FIRST:
        // Default to 0 if lastChanged timestamp doesn't exist because it means the note isn't stored to memory yet and
        // is likely very new
        this.tagGroups.sort((a, b) => b.newestTimestamp - a.newestTimestamp);
        for (const tagGroup of this.tagGroups) {
          tagGroup.noteIds.sort((a, b) =>
              (getNoteFn(b).lastChangedEpochMillis || 0) - (getNoteFn(a).lastChangedEpochMillis || 0));
        }
        break;
      case SortDirection.MODIFIED_OLDEST_FIRST:
        this.tagGroups.sort((a, b) => a.oldestTimestamp - b.oldestTimestamp);
        for (const tagGroup of this.tagGroups) {
          tagGroup.noteIds.sort((a, b) =>
              (getNoteFn(a).lastChangedEpochMillis || 0) - (getNoteFn(b).lastChangedEpochMillis || 0));
        }
        break;
      case SortDirection.ALPHABETICAL:
        this.tagGroups.sort((a, b) => a.tag.localeCompare(b.tag));
        for (const tagGroup of this.tagGroups) {
          tagGroup.noteIds.sort((a, b) => getNoteFn(a).title.localeCompare(getNoteFn(b).title));
        }
        break;
      case SortDirection.ALPHABETICAL_REVERSED:
        this.tagGroups.sort((a, b) => b.tag.localeCompare(a.tag));
        for (const tagGroup of this.tagGroups) {
          tagGroup.noteIds.sort((a, b) => getNoteFn(b).title.localeCompare(getNoteFn(a).title));
        }
        break;
    }
    const allIdx = this.tagGroups.findIndex(tagGroup => tagGroup.tag === 'all');
    const allTagGroup = this.tagGroups.splice(allIdx, 1);
    const untaggedIdx = this.tagGroups.findIndex(tagGroup => tagGroup.tag === 'untagged');
    const untaggedTagGroup = untaggedIdx >= 0 ? this.tagGroups.splice(untaggedIdx, 1) : [];
    this.tagGroups = [...allTagGroup, ...untaggedTagGroup, ...this.tagGroups];
  }

  openNote(e: MouseEvent, noteId: string) {
    if (e.metaKey || e.ctrlKey) {
      this.subviewManager.openNoteInNewWindow(noteId);
    } else {
      this.subviewManager.openNoteInActiveWindow(noteId);
    }
  }

  toggleTagGroup(e: Event) {
    const elem = e.currentTarget as HTMLElement;
    elem.parentElement.classList.toggle('expanded');
  }

  ignoreTag(tag: string) {
    this.settingsService.addIgnoredTag(tag);
  }

  trackByTagFn(index: number, item: TagGroup) {
    return item.tag;
  }

  trackByIdFn(index: number, item: NoteObject) {
    return item.id;
  }
}
