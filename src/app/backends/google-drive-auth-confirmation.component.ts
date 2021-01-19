import {Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';

declare interface ExtendedWindow {
  gapi: any;
}

declare const window: ExtendedWindow;

@Component({
  selector: 'cn-google-drive-auth-confirmation-dialog',
  template: `
    <h2 *ngIf="expired">Google Drive authorization has expired.</h2>
    <h2 *ngIf="!expired">Click below to authorize Google Drive usage</h2>
    Connected Notes will only have access to the notes and flashcards it has created itself and
    won't be able to see any other files.
    <div id="buttons">
      <button mat-button color="primary" (click)="authorize()">AUTHORIZE</button>
    </div>`,
  styles: [`
      #buttons {
        display: flex;
        justify-content: space-around;
        margin-top: 15px;
      }
  `]
})
export class GoogleDriveAuthConfirmationComponent {

  expired: boolean;

  constructor(
      @Inject(MAT_DIALOG_DATA) public data: any,
      public dialogRef: MatDialogRef<GoogleDriveAuthConfirmationComponent>) {
    this.expired = data.expired;
  }

  async authorize() {
    await window.gapi.auth2.getAuthInstance().signIn();
    this.close();
  }

  close() {
    this.dialogRef.close();
  }
}
