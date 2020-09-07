import {Component, Inject, OnDestroy, OnInit} from '@angular/core';
import {AttachedFile} from '../types';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {Sort} from '@angular/material/sort';
import {NoteService} from '../note.service';
import {Subscription} from 'rxjs';

function compare(a: number | string, b: number | string, isAsc: boolean) {
  return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
}

@Component({
  selector: 'app-attachments-dialog',
  template: `
    <table (matSortChange)="sortData($event)"
           matSort
           matSortActive="name"
           matSortDirection="asc"
           matSortDisableClear>
      <tr id="header">
        <th mat-sort-header="name">Name</th>
        <th mat-sort-header="mimeType">Type</th>
        <th></th>
      </tr>

      <tr *ngFor="let attachment of attachedFiles">
        <td><a href="{{getLink(attachment.fileId)}}" target="_blank">{{attachment.name}}</a></td>
        <td>{{attachment.mimeType}}</td>
        <td><mat-icon class="delete-icon" (click)="deleteAttachment(attachment.fileId)">delete_outline</mat-icon></td>
      </tr>
    </table>
  `,
  styles: [`
      #header {
        margin: 10px;
      }

      td, th {
        padding: 10px;
      }

      .delete-icon {
        cursor: pointer;
      }
  `]
})
export class AttachmentsDialogComponent implements OnDestroy {

  attachedFiles: AttachedFile[];
  noteId: string;

  private prevSort: Sort = {active: 'name', direction: 'asc'};
  private sub: Subscription;

  constructor(
      @Inject(MAT_DIALOG_DATA) public data: any,
      private readonly noteService: NoteService) {
    this.noteId = data.noteId;
    this.attachedFiles = this.noteService.attachmentMetadata.value[this.noteId] || [];
    this.sortData(this.prevSort);
    this.sub = this.noteService.attachmentMetadata.subscribe(metadata => {
      if (metadata) {
        this.attachedFiles = metadata[this.noteId] || [];
        this.sortData(this.prevSort);
      }
    });
  }

  getLink(id: string) {
    return NoteService.fileIdToLink(id);
  }

  sortData(sort: Sort) {
    this.prevSort = sort;
    const data = this.attachedFiles.slice();
    if (!sort.active || sort.direction === '') {
      this.attachedFiles = data;
      return;
    }
    this.attachedFiles = data.sort((a, b) => {
      const isAsc = sort.direction === 'asc';
      switch (sort.active) {
        case 'name': return compare(a.name, b.name, isAsc);
        case 'mimeType': return compare(a.mimeType, b.mimeType, isAsc);
        default: return 0;
      }
    });
  }

  deleteAttachment(fileId: string) {
    this.noteService.deleteAttachment(this.noteId, fileId);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}