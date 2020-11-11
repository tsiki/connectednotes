import {EventEmitter, Injectable, SecurityContext} from '@angular/core';
import {NoteService} from './note.service';
import {BehaviorSubject} from 'rxjs';
import {ActivatedRoute, Router} from '@angular/router';
import {DomSanitizer} from '@angular/platform-browser';

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

  constructor(
      private readonly noteService: NoteService,
      private router: Router,
      private activatedRoute: ActivatedRoute,
      private sanitizer: DomSanitizer) {
    this.activatedRoute.queryParamMap.subscribe(qps => {
      const views = qps.getAll('views').map(v => sanitizer.sanitize(SecurityContext.URL, v));
      if (views.length && this.activeSubviewIdx === null) {
        this.activeSubviewIdx = 0;
      }
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

  openViewInNewWindow(view: string) {
    const views = this.subviews.value.slice();
    const idx = views.findIndex(n => n === view);
    if (idx >= 0) {
      this.activeSubviewIdx = idx;
      return;
    }
    views.push(view);
    this.updateUrl(views);
    this.somethingOpened.emit();
  }

  openNoteInNewWindow(noteId: string) {
    this.openViewInNewWindow(noteId);
  }

  openGraphInNewWindow() {
    this.openViewInNewWindow('graph');
  }

  openFlashcardsInNewWindow() {
    this.openViewInNewWindow('flashcards');
  }

  openViewInActiveWindow(viewId: string) {
    const views = this.subviews.value.slice();
    if (views.length === 0) {
      views.push(viewId);
      this.activeSubviewIdx = 0;
    } else {
      const idx = views.findIndex(n => n === viewId);
      if (idx >= 0) {
        this.activeSubviewIdx = idx;
        return;
      }
      views[this.activeSubviewIdx] = viewId;
    }
    this.updateUrl(views);
    this.somethingOpened.emit();
  }

  openGraphInActiveWindow() {
    this.openViewInActiveWindow('graph');
  }

  openFlashcardsInActiveWindow() {
    this.openViewInActiveWindow('flashcards');
  }

  closeView(viewId: string) {
    const views = this.subviews.value.slice();
    const idx = views.findIndex(n => n === viewId);
    views.splice(idx, 1);
    if (this.activeSubviewIdx >= views.length) {
      this.activeSubviewIdx = views.length - 1;
    }
    this.updateUrl(views);
  }

  private updateUrl(views: string[]) {
    this.router.navigate(
        [],
        {
          queryParams: { views },
        });
  }
}
