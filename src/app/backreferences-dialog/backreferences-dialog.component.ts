import {Component, Inject, OnDestroy, OnInit} from '@angular/core';
import {AttachedFile, NoteObject} from '../types';
import {Sort} from '@angular/material/sort';
import {Subscription} from 'rxjs';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {NoteService} from '../note.service';

@Component({
  selector: 'app-backreferences-dialog',
  template: `
    <button *ngFor="let ref of backrefs"
            class="result-link"
            mat-button>
      {{ ref.title }}
    </button>`,
  styles: [``]
})
export class BackreferencesDialogComponent {

  backrefs: NoteObject[];
  noteId: string;

  private prevSort: Sort = {active: 'name', direction: 'asc'};
  private sub: Subscription;

  constructor(
      @Inject(MAT_DIALOG_DATA) public data: any,
      private readonly noteService: NoteService) {
    this.noteId = data.noteId;
    this.backrefs = this.noteService.getBackreferences(this.noteId);
  }
}
