import {ChangeDetectorRef, Component, ElementRef, Input, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {NoteService} from '../note.service';
import {MatSnackBar} from '@angular/material/snack-bar';
import {NoteObject, TagGroup} from '../types';
import {SettingsService} from '../settings.service';
import {NotificationService} from '../notification.service';
import {SortDirection} from '../zettelkasten/zettelkasten.component';

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

  selectedNoteId: string;
  notes: NoteObject[];
  tagGroups: TagGroup[];
  unsavedNotes = new Set<string>();

  private currentSortDirection: SortDirection = SortDirection.MODIFIED_NEWEST_FIRST;

  constructor(
      readonly noteService: NoteService,
      private readonly route: ActivatedRoute,
      private readonly settingsService: SettingsService,
      private snackBar: MatSnackBar,
      private cdr: ChangeDetectorRef,
      private notifications: NotificationService) {
  }

  ngOnInit(): void {
    this.notes = this.noteService.notes.value;
    this.noteService.selectedNote.subscribe(newSelectedNote => this.selectedNoteId = newSelectedNote?.id);
    this.noteService.notesAndTagGroups.asObservable().subscribe(notesAndTagGroups => {
      this.notes = notesAndTagGroups?.notes.slice();
      this.tagGroups = notesAndTagGroups?.tagGroups.slice();
      this.setSortDirection(this.currentSortDirection);
      this.cdr.detectChanges(); // For some reason angular doesn't always pick up the changes
    });
    this.notifications.unsaved.subscribe(unsavedNotes => this.unsavedNotes = new Set<string>(unsavedNotes));
  }

  setSortDirection(direction: SortDirection) {
    if (!this.notes) {
      return;
    }
    this.currentSortDirection = direction;
    const getNoteFn = (noteId) => this.noteService.getNote(noteId);
    switch (direction) {
      case SortDirection.MODIFIED_NEWEST_FIRST:
        // Default to 0 if lastChanged timestamp doesn't exist because it means the note isn't stored to memory yet and
        // is likely very new
        this.notes.sort((a, b) => (b.lastChangedEpochMillis || 0) - (a.lastChangedEpochMillis || 0));
        this.tagGroups.sort((a, b) => b.newestTimestamp - a.newestTimestamp);
        for (const tagGroup of this.tagGroups) {
          tagGroup.noteIds.sort((a, b) =>
              (getNoteFn(b).lastChangedEpochMillis || 0) - (getNoteFn(a).lastChangedEpochMillis || 0));
        }
        break;
      case SortDirection.MODIFIED_OLDEST_FIRST:
        this.notes.sort((a, b) => (a.lastChangedEpochMillis || 0) - (b.lastChangedEpochMillis || 0));
        this.tagGroups.sort((a, b) => a.oldestTimestamp - b.oldestTimestamp);
        for (const tagGroup of this.tagGroups) {
          tagGroup.noteIds.sort((a, b) =>
              (getNoteFn(a).lastChangedEpochMillis || 0) - (getNoteFn(b).lastChangedEpochMillis || 0));
        }
        break;
      case SortDirection.ALPHABETICAL:
        this.notes.sort((a, b) => a.title.localeCompare(b.title));
        this.tagGroups.sort((a, b) => a.tag.localeCompare(b.tag));
        for (const tagGroup of this.tagGroups) {
          tagGroup.noteIds.sort((a, b) => getNoteFn(a).title.localeCompare(getNoteFn(b).title));
        }
        break;
      case SortDirection.ALPHABETICAL_REVERSED:
        this.notes.sort((a, b) => b.title.localeCompare(a.title));
        this.tagGroups.sort((a, b) => b.tag.localeCompare(a.tag));
        for (const tagGroup of this.tagGroups) {
          tagGroup.noteIds.sort((a, b) => getNoteFn(b).title.localeCompare(getNoteFn(a).title));
        }
        break;
    }
    const allIdx = this.tagGroups.findIndex(tagGroup => tagGroup.tag === 'all');
    const allTagGroup = this.tagGroups.splice(allIdx, 1);
    const untaggedIdx = this.tagGroups.findIndex(tagGroup => tagGroup.tag === 'untagged');
    const untaggedTagGroup = this.tagGroups.splice(untaggedIdx, 1);
    this.tagGroups = [...allTagGroup, ...untaggedTagGroup, ...this.tagGroups];
  }

  openNote(noteId: string) {
    this.noteService.selectNote(noteId);
  }

  toggleTagGroup(e: Event) {
    const elem = e.currentTarget as HTMLElement;
    elem.parentElement.classList.toggle('expanded');
  }
}
