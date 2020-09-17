import {Component, Inject, OnDestroy, OnInit} from '@angular/core';
import {AttachedFile, NoteObject} from '../types';
import {Sort} from '@angular/material/sort';
import {Subscription} from 'rxjs';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {NoteService} from '../note.service';

@Component({
  selector: 'app-backreferences-dialog',
  template: `
    <button *ngFor="let ref of backrefs"
            class="result-link"
            mat-button
            (click)="selectNote(ref.id)">
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
      private readonly noteService: NoteService) {
    this.noteId = data.noteId;
    this.backrefs = this.noteService.getBackreferences(this.noteId);
  }

  selectNote(noteId: string) {
    this.noteService.selectNote(noteId);
    this.dialogRef.close();
  }
}
