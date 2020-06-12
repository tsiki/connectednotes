import { Injectable } from '@angular/core';
import {NoteService} from './note.service';
import {BehaviorSubject} from 'rxjs';

export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {

  themeSetting = new BehaviorSubject<Theme>(Theme.DARK);

  constructor(private readonly noteService: NoteService) {
    noteService.storedSettings.asObservable().subscribe(newSettings => {
      if (newSettings?.theme) {
        this.themeSetting.next(newSettings.theme);
      }
    });
  }

  setTheme(value: Theme) {
    this.noteService.updateSettings('theme', value);
  }
}
