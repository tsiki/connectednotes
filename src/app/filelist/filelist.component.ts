import {ChangeDetectorRef, Component, ElementRef, HostListener, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {NoteService} from '../note.service';
import {MatSnackBar} from '@angular/material/snack-bar';
import {NoteObject, TagGroup} from '../types';
import {SettingsService} from '../settings.service';
import {NotificationService} from '../notification.service';

@Component({
  selector: 'app-filelist',
  templateUrl: './filelist.component.html',
  styles: [``],
})
export class FilelistComponent implements OnInit {
  @ViewChild('titleRenameInput') titleRenameInput: ElementRef;
  @ViewChild('contextMenu') contextMenu: ElementRef;

  selectedNoteId: string;
  notes: NoteObject[];
  tagGroups: TagGroup[];
  unsavedNotes = new Set<string>();

  constructor(
      readonly noteService: NoteService,
      private readonly route: ActivatedRoute,
      private readonly settingsService: SettingsService,
      private snackBar: MatSnackBar,
      private cdr: ChangeDetectorRef,
      private notifications: NotificationService) {
  }

  ngOnInit(): void {
    this.notes = this.noteService.currentNotes;
    this.noteService.selectedNote.subscribe(newSelectedNote => this.selectedNoteId = newSelectedNote?.id);
    this.noteService.notesAndTagGroups.asObservable().subscribe(notesAndTagGroups => {
      this.notes = notesAndTagGroups?.notes;
      this.tagGroups = notesAndTagGroups?.tagGroups;
      this.cdr.detectChanges(); // For some reason angular doesn't always pick up the changes
    });
    this.notifications.unsaved.subscribe(unsavedNotes => this.unsavedNotes = new Set<string>(unsavedNotes));
  }

  openNote(noteId: string) {
    this.noteService.selectNote(noteId);
  }

  toggleTagGroup(e: Event) {
    const elem = e.currentTarget as HTMLElement;
    elem.parentElement.classList.toggle('expanded');
  }
}
