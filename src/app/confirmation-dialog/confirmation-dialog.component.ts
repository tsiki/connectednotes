import {Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';


export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmButtonText?: string;
  rejectButtonText?: string;
}


@Component({
  selector: 'cn-confirmation-dialog',
  template: `
      <h1>{{title}}</h1>
      {{message}}
      <div id="button-container">
        <button mat-button *ngIf="rejectButtonText" (click)="reject()">{{rejectButtonText}}</button>
        <button mat-button (click)="confirm()">{{confirmButtonText}}</button>
      </div>
  `,
  styles: [`
    #button-container {
      display: flex;
      justify-content: flex-end;
      margin-top: 10px;
    }
  `]
})
export class ConfirmationDialogComponent {

  title: string;
  message: string;
  confirmButtonText: string;
  rejectButtonText: string|null;

  constructor(
      @Inject(MAT_DIALOG_DATA) public data: any,
      public dialogRef: MatDialogRef<ConfirmationDialogComponent>) {
    this.title = data.title;
    this.message = data.message;
    this.confirmButtonText = data.confirmButtonText;
    this.rejectButtonText = data.rejectButtonText;
  }

  confirm() {
    this.dialogRef.close(true);
  }

  reject() {
    this.dialogRef.close(false);
  }
}
