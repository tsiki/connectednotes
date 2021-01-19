import {Component, Inject} from '@angular/core';
import {NoteObject} from '../types';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {StorageService} from '../storage.service';
import {SubviewManagerService} from '../subview-manager.service';

@Component({
  selector: 'cn-backreferences-dialog',
  template: `
    <button *ngFor="let ref of backrefs"
            class="result-link"
            mat-button
            (click)="selectNote($event, ref.id)">
      {{ ref.title }}
    </button>`,
  styles: [`
    .result-link {
      display: block;
    }
  `]
})
export class BackreferencesDialogComponent {

  backrefs: NoteObject[];
  noteId: string;

  constructor(
      @Inject(MAT_DIALOG_DATA) public data: any,
      public dialogRef: MatDialogRef<BackreferencesDialogComponent>,
      private readonly storage: StorageService,
      private readonly subviewManager: SubviewManagerService) {
    this.noteId = data.noteId;
    this.backrefs = this.storage.getBackreferences(this.noteId);
  }

  selectNote(e: MouseEvent, noteId: string) {
    if (e.metaKey || e.ctrlKey) {
      this.subviewManager.openNoteInNewWindow(noteId);
    } else {
      this.subviewManager.openViewInActiveWindow(noteId);
    }
    this.dialogRef.close();
  }
}
