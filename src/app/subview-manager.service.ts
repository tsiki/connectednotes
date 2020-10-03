import { Injectable } from '@angular/core';
import {NoteService} from './note.service';
import {BehaviorSubject} from 'rxjs';
import {Router} from '@angular/router';


export interface Subview {
  type: 'note'|'explore-and-study';
  noteId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SubviewManagerService {

  subviews = new BehaviorSubject<Subview[]>([]);
  activeSubviewIdx: number|null = null;

  constructor(private readonly noteService: NoteService, private router: Router) {}

  setActiveSubview(subview: Subview) {
    this.subviews.value.findIndex(s => s.type === subview.type && s.noteId === subview.noteId);
  }

  openNoteInNewWindow(noteId: string, updateUrl = true) {
    if (updateUrl) {
      this.router.navigate(
          [],
          {
            queryParams: { noteid: noteId },
          });
    }
    const newSubviews = this.subviews.value.slice();
    newSubviews.push({type: 'note', noteId});
    this.subviews.next(newSubviews);
  }

  openNoteInActiveWindow(noteId: string) {
    const newSubviews = this.subviews.value.slice();
    if (newSubviews.length === 0) {
      newSubviews.push({type: 'note', noteId});
      this.activeSubviewIdx = 0;
    }
    newSubviews[this.activeSubviewIdx] = {type: 'note', noteId};
    this.subviews.next(newSubviews);
  }

  openExploreAndLearnInNewWindow() {
    const newSubviews = this.subviews.value.slice();
    newSubviews.push({type: 'explore-and-study'});
    this.subviews.next(newSubviews);
  }

  openExploreAndLearnInActiveWindow() {
    const newSubviews = this.subviews.value.slice();
    if (newSubviews.length === 0) {
      newSubviews.push({type: 'explore-and-study', noteId: null});
      this.activeSubviewIdx = 0;
    }
    newSubviews[this.activeSubviewIdx] = {type: 'explore-and-study'};
    this.subviews.next(newSubviews);
  }

  closeNote(noteId: string) {
    const idx = this.subviews.value.findIndex(n => n.noteId === noteId);
    const subviews = this.subviews.value.slice();
    subviews.splice(idx, 1);
    this.subviews.next(subviews);
  }
}
