import { Component, OnInit } from '@angular/core';
import {MatDialogRef} from '@angular/material/dialog';
import {NoteService} from '../note.service';
import {SettingsService, Theme} from '../settings.service';

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
  `,
  styles: []
})
export class SettingsComponent implements OnInit {

  selectedTheme: string;

  constructor(public dialogRef: MatDialogRef<SettingsComponent>, private readonly settingsService: SettingsService) { }

  ngOnInit(): void {}

  changeTheme(e) {
    this.settingsService.setTheme(Theme[e.value]);
  }
}
