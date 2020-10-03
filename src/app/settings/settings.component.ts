import {Component} from '@angular/core';
import {MatDialogRef} from '@angular/material/dialog';
import {SettingsService, Theme} from '../settings.service';
import {BehaviorSubject} from 'rxjs';

@Component({
  selector: 'app-settings',
  template: `
  <mat-form-field>
    <mat-label>Theme</mat-label>
    <mat-select [(value)]="selectedTheme" (selectionChange)="changeTheme($event)">
      <mat-option value="LIGHT">Light</mat-option>
      <mat-option value="DARK">Dark</mat-option>
      <mat-option value="DEVICE">Follow Device Settings</mat-option>
    </mat-select>
  </mat-form-field>

  <h3 id="ignored-tags-header">Ignored tags:</h3>
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

  constructor(public dialogRef: MatDialogRef<SettingsComponent>,
              private readonly settingsService: SettingsService) {
    this.ignoredTags = settingsService.ignoredTags;
  }

  changeTheme(e) {
    this.settingsService.setTheme(Theme[e.value]);
  }

  async removeIgnoredTag(tag: string) {
    await this.settingsService.removeIgnoredTag(tag);
  }
}
