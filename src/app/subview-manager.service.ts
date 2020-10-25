import {EventEmitter, Injectable} from '@angular/core';
import {NoteService} from './note.service';
import {BehaviorSubject} from 'rxjs';
import {ActivatedRoute, Router} from '@angular/router';


// export interface Subview {
//   type: 'note'|'explore-and-study';
//   noteId?: string;
// }

export enum ViewType {
  NOTE,
  GRAPH,
  FLASHCARDS,
}

@Injectable({
  providedIn: 'root'
})
export class SubviewManagerService {

  subviews = new BehaviorSubject<string[]>([]); // array of note IDs or 'graph' or 'flashcards'
  activeNotes = new BehaviorSubject<string[]>([]);
  activeSubviewIdx: number|null = null;
  somethingOpened = new EventEmitter();

  private currentSubviews: string[] = [];

  constructor(
      private readonly noteService: NoteService,
      private router: Router,
      private activatedRoute: ActivatedRoute) {
    this.activatedRoute.queryParamMap.subscribe(qps => {
      const views = qps.getAll('views');
      this.subviews.next(views);
      const notes = views.filter(v => !['graph', 'study'].includes(v));
      this.activeNotes.next(notes);
    });
  }

  static getViewType(s: string): ViewType {
    switch (s) {
      case 'graph':
        return ViewType.GRAPH;
      case 'flashcards':
        return ViewType.FLASHCARDS;
      default:
        return ViewType.NOTE;
    }
  }

  setActiveSubview(subview: string) {
    this.activeSubviewIdx =
        this.subviews.value.findIndex(s => s === subview);
  }

  openNoteInNewWindow(noteId: string) {
    this.currentSubviews.push(noteId);
    this.updateUrl();
    this.somethingOpened.emit();
  }

  openViewInActiveWindow(viewId: string) {
    if (this.currentSubviews.length === 0) {
      this.currentSubviews.push(viewId);
      this.activeSubviewIdx = 0;
    } else {
      this.currentSubviews[this.activeSubviewIdx] = viewId;
    }
    this.updateUrl();
    this.somethingOpened.emit();
  }

  openGraphInNewWindow() {
    this.currentSubviews.push('graph');
    this.updateUrl();
    this.somethingOpened.emit();
  }

  openFlashcardsInNewWindow() {
    this.currentSubviews.push('graph');
    this.updateUrl();
    this.somethingOpened.emit();
  }

  openGraphInActiveWindow() {
    this.openViewInActiveWindow('graph');
  }

  openFlashcardsInActiveWindow() {
    this.openViewInActiveWindow('flashcards');
  }

  closeView(viewId: string) {
    const idx = this.currentSubviews.findIndex(n => n === viewId);
    this.currentSubviews.splice(idx, 1);
    if (this.activeSubviewIdx >= this.currentSubviews.length) {
      this.activeSubviewIdx = this.currentSubviews.length - 1;
    }
    this.updateUrl();
  }

  private updateUrl() {
    this.router.navigate(
        [],
        {
          queryParams: { views: this.currentSubviews },
        });
  }
}
