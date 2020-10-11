import { Injectable } from '@angular/core';
import {NoteService} from './note.service';
import {BehaviorSubject} from 'rxjs';

export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  DEVICE = 'device',
}

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable({
  providedIn: 'root'
})
export class SettingsService {

  themeSetting = new BehaviorSubject<Theme>(Theme.DEVICE);
  ignoredTags = new BehaviorSubject<string[]>(null);
  flashcardInitialDelayPeriod = new BehaviorSubject<number[]>([MILLIS_PER_DAY, 6 * MILLIS_PER_DAY]);

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
      if (newSettings?.ignoredTags) {
        this.ignoredTags.next(newSettings?.ignoredTags);
      }
    });
  }

  async setTheme(value: Theme) {
    await this.noteService.updateSettings('theme', value);
  }

  async addIgnoredTag(tag: string) {
    const cur = this.ignoredTags.value?.slice() || [];
    cur.push(tag);
    await this.noteService.updateSettings('ignoredTags', cur);
  }

  async removeIgnoredTag(tag: string) {
    const newTags = this.ignoredTags.value?.slice().filter(existingTag => tag !== existingTag) || [];
    await this.noteService.updateSettings('ignoredTags', newTags);
  }
}
