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
    // this.themeSetting.next()

  }

}
