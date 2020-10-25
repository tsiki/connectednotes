import {Component, HostBinding, OnInit} from '@angular/core';
import {MatDialogRef} from '@angular/material/dialog';
import {NoteService} from '../note.service';
import {FormattedSegment, SearchResult} from '../types';
import {SettingsService, Theme} from '../settings.service';
import {SubviewManagerService} from '../subview-manager.service';

@Component({
  selector: 'app-search-dialog',
  template: `
    <mat-form-field id="search-input">
      <mat-label>Note search</mat-label>
      <input autocomplete="off"
             matInput
             [(ngModel)]="noteTitle"
             (keyup.enter)="close()"
             (keyup)="onKeyUp($event)">
    </mat-form-field>
    <div id="results-container">
      <div class="result"
           *ngFor="let result of this.searchResults; let idx = index"
           [class.focused-result]="idx==selectedListIndex">
        <button (click)="onButtonPressed($event, result.noteId)"
                class="result-link"
                mat-button>
          <span *ngFor="let segment of result.titleSegments"
                [ngClass]="segment.highlighted ? 'title-highlighted' : ''">{{segment.text}}</span>
        </button>
        <div class="content" *ngFor="let sample of result.contentSegments">
          <span *ngFor="let segment of sample"
                [ngClass]="segment.highlighted ? 'content-highlighted' : ''">{{segment.text}}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      align-items: center;
      display: flex;
      flex-direction: column;
      max-height: 100vh;
    }

    #search-input {
      width: 200px;
    }

    .title-highlighted {
      background-color: var(--highlight-color);
    }

    .content-highlighted {
      background-color: var(--low-contrast-highlight-color);
    }

    .result-link {
      display: block;
      font-size: 18px;
      max-width: 100%;
      text-overflow: ellipsis;
      overflow: hidden;
    }

    #results-container {
      align-items: stretch;
      display: flex;
      flex-direction: column;
      max-width: 100%;
    }

    .focused-result {
      background-color: var(--selected-note-color);
    }

    .content {
      color: var(--low-contrast-text-color);
    }

    .result {
      align-items: center;
      display: flex;
      flex-direction: column;
    }
  `]
})
export class SearchDialogComponent implements OnInit {

  noteTitle: string;
  searchResults: SearchResult[];
  selectedListIndex = 0;

  @HostBinding('class.dark-theme') darkThemeActive = false;

  constructor(
      public dialogRef: MatDialogRef<SearchDialogComponent>,
      private readonly noteService: NoteService,
      private readonly subviewManager: SubviewManagerService,
      private readonly settingsService: SettingsService) {
    this.settingsService.themeSetting.subscribe(theme => {
      this.darkThemeActive = theme === Theme.DARK;
    });
  }

  close() {
    this.dialogRef.close();
  }

  ngOnInit(): void {
  }

  onButtonPressed(e: MouseEvent, noteId: string) {
    if (e.metaKey || e.ctrlKey) {
      this.subviewManager.openNoteInNewWindow(noteId);
    } else {
      this.subviewManager.openViewInActiveWindow(noteId);
    }
    this.close();
  }

  onKeyUp(e) {
    if (e.key === 'Enter') {
      const noteId = this.searchResults[this.selectedListIndex].noteId;
      // Checking for e.metaKey doesn't work here because keyup doesn't trigger when metakey is pressed, see
      // https://stackoverflow.com/questions/27380018/when-cmd-key-is-kept-pressed-keyup-is-not-triggered-for-any-other-key
      if (e.ctrlKey) {
        this.subviewManager.openNoteInNewWindow(noteId);
      } else {
        this.subviewManager.openViewInActiveWindow(noteId);
      }
      this.close();
    } else if (e.key === 'ArrowDown') {
      this.selectedListIndex = (this.selectedListIndex + 1) % this.searchResults.length;
    } else if (e.key === 'ArrowUp') {
      this.selectedListIndex = (this.selectedListIndex + this.searchResults.length - 1) % this.searchResults.length;
    } else if (this.noteTitle && this.noteTitle.length > 0) {
      this.selectedListIndex = 0;
      this.searchResults = this.searchForNotesByTitle(this.noteTitle);
    }
  }

  // Searches notes for the corresponding term. Just search titles for now.
  public searchForNotesByTitle(searchTerm: string): SearchResult[] {
    const notes = this.noteService.notes.value;

    // First try full match in title.
    const matchingNotes = notes
      .filter(note => note.title.toLowerCase().includes(searchTerm.toLowerCase()))
      .map(note => {
        const [numContentMatches, contentSegments] = this.getContentMatches(note.content, searchTerm);
        return {
          noteId: note.id,
          titleSegments: this.splitToHighlightedParts(
              note.title,
              this.getIndicesCoveredByWords(note.title.toLowerCase(), [searchTerm.toLowerCase()])),
          contentSegments,
          numContentMatches,
        };
      });

    // Then get full matches in content
    const alreadyAdded = new Set(matchingNotes.map(n => n.noteId));
    const contentMatches = notes
        .filter(note => !alreadyAdded.has(note.id) && note.content.toLowerCase().includes(searchTerm.toLowerCase()))
        .map(note => {
          const [numContentMatches, contentSegments] = this.getContentMatches(note.content, searchTerm);
          return {
            noteId: note.id,
            titleSegments: [{ text: note.title, highlighted: false }],
            contentSegments,
            numContentMatches,
          };
        });

    matchingNotes.push(...contentMatches);

    // If we don't have that many full matches then try splitting the search term and checking the coverage in titles
    if (matchingNotes.length < 5) {
      const splitTerms = searchTerm.toLowerCase().split(' ').filter(term => term.length > 0);
      const addedNotes = new Set(matchingNotes.map(n => n.noteId));
      const notesWithAtLeastOneTerm =
          notes.filter(n => !addedNotes.has(n.id) && splitTerms.some(term => n.title.toLowerCase().includes(term)));
      const highlightedTitleIndices =
          notesWithAtLeastOneTerm.map(note => this.getIndicesCoveredByWords(note.title.toLowerCase(), splitTerms));
      const trueCounts = highlightedTitleIndices.map(indices => indices.reduce((prev, cur) => cur ? prev + 1 : prev, 0));
      const trueCountPerLength = notesWithAtLeastOneTerm.map((note, idx) => trueCounts[idx] / note.title.length);
      const largestElementIndices = this.getLargestElementIndices(trueCountPerLength, 5);
      for (const idx of largestElementIndices) {
        const {id, title} = notesWithAtLeastOneTerm[idx];
        const searchRes = {
          noteId: id,
          titleSegments: this.splitToHighlightedParts(title, highlightedTitleIndices[idx]),
          contentSegments: [],
          numContentMatches: 0, // Any content matches have been handled above
        };
        matchingNotes.push(searchRes);
      }
    }
    return matchingNotes;
  }

  private getContentMatches(content: string, searchTerm: string): [number, FormattedSegment[][]] {
    const lcSearchTerm = searchTerm.toLowerCase();
    const lcContent = content.toLowerCase();
    let idx = lcContent.indexOf(lcSearchTerm);
    const indices = [];
    while (idx >= 0) {
      indices.push(idx);
      idx = lcContent.indexOf(lcSearchTerm, idx + 1);
    }
    // Take some 20 characters from before and after the occurrence
    const samples: FormattedSegment[][] = [];
    for (let i = 0; i < Math.min(/* max samples */ 1, indices.length); i++) {
      const curIdx = indices[i];
      const prefix = (curIdx - 20 > 0 ? '...' : '');
      const suffix = (curIdx + searchTerm.length + 20 >= content.length ? '' : '...');
      const startIdx = Math.max(0, curIdx - 20);
      const endIdx = Math.min(content.length, curIdx + searchTerm.length + 20);
      samples.push([
        {text: prefix + content.slice(startIdx, curIdx), highlighted: false},
        {text: content.slice(curIdx, curIdx + searchTerm.length), highlighted: true},
        {text: content.slice(curIdx + searchTerm.length, endIdx) + suffix, highlighted: false},
      ]);
    }
    return [indices.length, samples];
  }

  // Split given string to highlighted parts which are defined by the given boolean array, where 'true' corresponds to highlighted char.
  private splitToHighlightedParts(str: string, highlightedIndices: boolean[]): FormattedSegment[] {
    const ans: FormattedSegment[] = [];
    let subseqStartInx = 0;
    for (let i = 1; i < highlightedIndices.length; i++) {
      if (highlightedIndices[i] !== highlightedIndices[i - 1]) {
        const text = str.slice(subseqStartInx, i);
        ans.push({text, highlighted: highlightedIndices[subseqStartInx]});
        subseqStartInx = i;
      }
    }
    ans.push({text: str.slice(subseqStartInx), highlighted: highlightedIndices[subseqStartInx]});
    return ans;
  }

  // Returns the indices of the numbers that are among the 'numberOfLargestIndices' largest numbers in the given array.
  private getLargestElementIndices(arr: number[], numberOfLargestIndices: number) {
    const copy = arr.slice();
    // noooo you cant sort its nlogn and time complexity will suffer!!
    copy.sort((a, b) => b - a); // descending sort
    // haha sort goes brrrrrr
    const ans = [];
    for (let i = 0; i < Math.min(arr.length, numberOfLargestIndices); i++) {
      ans.push(arr.indexOf(copy[i]));
    }
    return ans;
  }

  // Returns the indices of the given string that are part of at least one of the
  // given words. For example, if the word is 'aabaa' and words is 'ba' returns
  // [false, false, true, true, false].
  private getIndicesCoveredByWords(str: string, words: string[]): boolean[] {
    const highlightIndices = new Array(str.length).fill(false);
    for (const term of words) {
      let occurrenceIdx = str.indexOf(term);
      while (occurrenceIdx !== -1) {
        for (let i = occurrenceIdx; i < occurrenceIdx + term.length; i++) {
          highlightIndices[i] = true;
        }
        occurrenceIdx = str.indexOf(term, occurrenceIdx + 1);
      }
    }
    return highlightIndices;
  }

}
