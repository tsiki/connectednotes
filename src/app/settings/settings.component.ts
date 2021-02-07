import {Component} from '@angular/core';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import {SettingsService, Theme} from '../settings.service';
import {BehaviorSubject} from 'rxjs';
import {UploadExistingDialogComponent} from '../upload-existing-dialog/upload-existing-dialog.component';

@Component({
  selector: 'cn-settings',
  template: `
  <div>
    <button color="primary" mat-button (click)="openUploadDialog()">Upload existing notes</button>
  </div>
  <mat-form-field>
    <mat-label>Theme</mat-label>
    <mat-select [(value)]="selectedTheme" (selectionChange)="changeTheme($event)">
      <mat-option value="LIGHT">Light</mat-option>
      <mat-option value="DARK">Dark</mat-option>
      <mat-option value="DEVICE">Follow Device Settings (default)</mat-option>
    </mat-select>
  </mat-form-field>

  <h3 id="ignored-tags-header" *ngIf="(ignoredTags | async)?.length">Ignored tags:</h3>
  <mat-chip-list aria-label="Ignored tags">
    <mat-chip *ngFor="let tag of ignoredTags | async">
      {{ tag }}
      <mat-icon class="delete-icon" (click)="removeIgnoredTag(tag)">delete_outline</mat-icon>
    </mat-chip>
  </mat-chip-list>
  `,
  styles: [`
    .delete-icon {
      cursor: pointer;
    }
  `]
})
export class SettingsComponent {

  selectedTheme: string;
  ignoredTags: BehaviorSubject<string[]>;

  constructor(
      private readonly settingsService: SettingsService,
      public dialog: MatDialog) {
    this.ignoredTags = settingsService.ignoredTags;
  }

  changeTheme(e) {
    this.settingsService.setTheme(Theme[e.value]);
  }

  openUploadDialog() {
    this.dialog.open(UploadExistingDialogComponent, {
      position: { top: '10px' },
      maxHeight: '90vh' /* to enable scrolling on overflow */,
    });
  }

  async removeIgnoredTag(tag: string) {
    await this.settingsService.removeIgnoredTag(tag);
  }
}
