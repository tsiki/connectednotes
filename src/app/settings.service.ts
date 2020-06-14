import { Injectable } from '@angular/core';
import {NoteService} from './note.service';
import {BehaviorSubject} from 'rxjs';

export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  DEVICE = 'device',
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {

  themeSetting = new BehaviorSubject<Theme>(Theme.DARK);

  colorSchemeListener = e => this.themeSetting.next(e.matches ? Theme.DARK : Theme.LIGHT);

  constructor(private readonly noteService: NoteService) {
    noteService.storedSettings.asObservable().subscribe(newSettings => {
      if (newSettings?.theme) {
        if (newSettings.theme === Theme.DEVICE) {
          window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', this.colorSchemeListener);
          const darkModePreferred = window.matchMedia('(prefers-color-scheme: dark)');
          this.themeSetting.next(darkModePreferred.matches ? Theme.DARK : Theme.LIGHT);
        } else {
          window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', this.colorSchemeListener);
          this.themeSetting.next(newSettings.theme);
        }
      }
    });
  }

  setTheme(value: Theme) {
    this.noteService.updateSettings('theme', value);
  }
}
