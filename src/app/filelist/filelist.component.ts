import {AfterViewChecked, ChangeDetectorRef, Component, ElementRef, HostListener, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {NoteService} from '../note.service';
import {Observable} from 'rxjs';
import {AngularFireAuth} from '@angular/fire/auth';
import {auth} from 'firebase';
import {MatSnackBar} from '@angular/material/snack-bar';
import {NoteObject} from '../types';
import {SettingsService} from '../settings.service';

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

  contextMenuX: string;
  contextMenuY: string;
  showContextMenu = false;
  lastRightClickedNoteId: string;
  noteToBeRenamed?: string; // if null then there's no note to be renamed

  constructor(
      private readonly route: ActivatedRoute,
      private readonly noteService: NoteService,
      private readonly settingsService: SettingsService,
      private snackBar: MatSnackBar,
      private cdr: ChangeDetectorRef) {
  }

  ngOnInit(): void {
    this.selectedNoteId = this.noteService.currentSelectedNote?.id;
    this.notes = this.noteService.currentNotes;
    this.noteService.selectedNote.subscribe(newSelectedNote => {
      if (newSelectedNote !== null) {
        this.selectedNoteId = newSelectedNote.id;
      } else {
        this.selectedNoteId = null;
      }
    });
    this.noteService.notes.asObservable().subscribe(newNotes => {
      this.notes = newNotes;
      this.cdr.detectChanges(); // For some reason angular doesn't always pick up the changes
    });
  }

  onRightClick(e, nodeId) {
    // Double right click usually closes the custom context menu and reveals the browser one
    if (this.showContextMenu) {
      this.showContextMenu = false;
      return;
    }
    this.lastRightClickedNoteId = nodeId;
    this.showContextMenu = true;
    this.contextMenuX = e.clientX + 'px';
    this.contextMenuY = e.clientY + 'px';
    this.cdr.detectChanges(); // why is this even needed??
    e.preventDefault();
  }

  // For renaming notes.
  @HostListener('document:click', ['$event'])
  documentClick(e) {
    if (this.showContextMenu && e.path.includes(this.contextMenu.nativeElement)) {
      this.showContextMenu = false;
      return;
    }
    // TODO: don't rename when there's nothing
    if (this.noteToBeRenamed) {
      this.executeRename(this.lastRightClickedNoteId, this.titleRenameInput.nativeElement.value);
    }
  }

  // For renaming notes.
  @HostListener('document:keydown.escape')
  escClicked() {
    this.noteToBeRenamed = null;
  }

  openNoteRenameInput() {
    this.noteToBeRenamed = this.lastRightClickedNoteId;
    // TODO: we might want to wait for some dom event or shit
    setTimeout(() => {
      this.titleRenameInput.nativeElement.select();
    });
  }

  async executeRename(noteId, newTitle) {
    const curTitle = this.notes.find(n => n.id === noteId).title;
    // Checking that the title is different always prevents at least 1 useless backend call since this method is called when the user clicks
    // on the 'rename' option because 'documentClick' function is triggered
    if (newTitle !== curTitle) {
      const res = await this.noteService.renameNote(noteId, newTitle);
      this.snackBar.open(`Renamed ${res.renamedBackRefCount} references in ${res.renamedNoteCount} notes`);
    }
    this.noteToBeRenamed = null;
  }

  deleteNote() {
    this.noteService.deleteNote(this.lastRightClickedNoteId);
  }

  openNote(noteId: string) {
    this.noteService.selectNote(noteId);
  }
}
