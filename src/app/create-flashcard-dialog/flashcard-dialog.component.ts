import {
  Component,
  Inject,
  OnInit,
  EventEmitter,
  HostListener,
  SecurityContext,
  ViewChild,
  ElementRef, AfterViewInit
} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {NoteService} from '../note.service';
import {Flashcard, FlashcardSuggestion} from '../types';
import {INITIAL_FLASHCARD_LEARNING_DATA} from '../flashcard.service';
import * as marked from 'marked';
import {MatSnackBar} from '@angular/material/snack-bar';
import {DomSanitizer} from '@angular/platform-browser';
import * as CodeMirror from 'codemirror';
import {SettingsService, Theme} from '../settings.service';
import {DARK_THEME, LIGHT_THEME} from '../constants';
import {fromEvent, Observable} from 'rxjs';
import {debounceTime, map} from 'rxjs/operators';
import {FormControl} from '@angular/forms';
import {COMMA, ENTER} from '@angular/cdk/keycodes';
import {MatChipInputEvent} from '@angular/material/chips';
import {MatAutocompleteSelectedEvent} from '@angular/material/autocomplete';

export interface FlashcardDialogData {
  suggestions?: string[];
  tags?: string[];
  flashcardToEdit?: Flashcard;
}

@Component({
  selector: 'app-flashcard-dialog',
  template: `
    <div id="wrapper">
      <div id="loading-spinner" *ngIf="submitting">
        <mat-spinner></mat-spinner>
      </div>
      <h1 *ngIf="mode === 'create'">Create a flashcard</h1>
      <h1 *ngIf="mode === 'edit'">Edit a flashcard</h1>
      <!--      <div>-->
      <!--        The final card will consist of the visible side (front) and hidden side (back). To hide a word from the visible-->
      <!--        side click on the word. The flashcard will be associated with the given tags. To remove a tag, click on it.-->
      <!--      </div>-->
      <div id="editor-and-rendered-wrapper">
        <span>
          <h2>Edit</h2>
          <div id="editors-container">
            <div>
              <h3>Front:</h3>
              <div class="codemirror-container">
                <textarea #frontEditorElem></textarea>
              </div>
            </div>
            <div>
              <h3>Back:</h3>
              <div class="codemirror-container">
                <textarea #backEditorElem></textarea>
              </div>
            </div>
          </div>
        </span>
        <span>
          <h2>Preview</h2>
            <div id="rendered-sides-container">
              <div id="visible-side-container">
                <h3>Rendered front:</h3>
                <div #renderedFront></div>
              </div>
              <div id="hidden-side-container">
                <h3>Rendered back:</h3>
                <div #renderedBack></div>
              </div>
            </div>
        </span>
      </div>
      <h3>Queues:</h3>

      <mat-form-field class="chip-list">
        <mat-chip-list #chipList aria-label="Tag selection">
          <mat-chip
              *ngFor="let tag of tags"
              [selectable]="true"
              [removable]="true"
              (removed)="removeTag(tag)">
            {{tag}}
            <mat-icon matChipRemove>cancel</mat-icon>
          </mat-chip>
          <input
              #tagInput
              [formControl]="tagCtrl"
              [matAutocomplete]="auto"
              [matChipInputFor]="chipList"
              [matChipInputSeparatorKeyCodes]="separatorKeysCodes"
              (matChipInputTokenEnd)="add($event)">
        </mat-chip-list>
        <mat-autocomplete #auto="matAutocomplete" (optionSelected)="selected($event)">
          <mat-option *ngFor="let tag of filteredTags | async" [value]="tag">
            {{tag}}
          </mat-option>
        </mat-autocomplete>
      </mat-form-field>
      <div>
        <button mat-button (click)="saveAndClose()">save</button>
        <button mat-button (click)="dialogRef.close()">cancel</button>
      </div>
    </div>
  `,
  styles: [`
    h2, h3 {
      margin: 0;
    }

    h2 {
      margin-top: 10px;
    }

    #editors-container,
    #rendered-sides-container {
      display: flex;
      flex-direction: row;
      overflow-wrap: break-word;
    }

    #editor-and-rendered-wrapper {
      display: flex;
      flex-direction: column;
    }

    #editor-and-rendered-wrapper > * {
      height: 50%;
    }

    .codemirror-container {
      border: 1px solid #bdbdbd;
      border-radius: 4px;
      margin-right: 3px;
      padding: 1px;
    }

    #editors-container > * {
      width: 50%;
    }

    #rendered-sides-container > * {
      width: 50%;
    }

    #wrapper {
      position: relative;
    }

    h3 {
      margin: 10px 0 0 0;
    }

    mat-chip {
      cursor: pointer;
    }

    .greyed-out {
      opacity: 0.3;
    }

    #loading-spinner {
      position: absolute;
      display: flex;
      justify-content: space-around;
      align-items: center;
      width: 100%;
      height: 100%;
      background-color: var(--primary-background-color);
      opacity: 0.5;
      z-index: 10;
    }

    .chip-list {
      width: 100%;
    }
  `]
})
export class FlashcardDialogComponent implements OnInit, AfterViewInit {
  @ViewChild('renderedFront') renderedFront: ElementRef;
  @ViewChild('frontEditorElem') frontEditorElem: ElementRef;
  @ViewChild('renderedBack') renderedBack: ElementRef;
  @ViewChild('backEditorElem') backEditorElem: ElementRef;
  @ViewChild('tagInput') tagInput: ElementRef<HTMLInputElement>;

  visibleSentence: string;
  originalSentence: string[];
  tags: string[];
  suggestions: string[];
  selectedSuggestionIndex: number;
  ignoredTags: Set<string> = new Set();
  submitting = false;
  mode: 'create'|'edit';
  tagCtrl = new FormControl();
  separatorKeysCodes: number[] = [ENTER, COMMA];
  filteredTags: Observable<string[]>;
  allTags: string[];

  private frontEditor: CodeMirror.EditorFromTextArea;
  private backEditor: CodeMirror.EditorFromTextArea;
  private mouseEventWithCtrlActive = false;

  constructor(
      public dialogRef: MatDialogRef<FlashcardDialogComponent>,
      @Inject(MAT_DIALOG_DATA) public data: FlashcardDialogData,
      private readonly settingsService: SettingsService,
      private readonly noteService: NoteService,
      private sanitizer: DomSanitizer) {
    if (data.flashcardToEdit) {
      this.mode = 'edit';
      this.tags = data.flashcardToEdit.tags;
    } else {
      this.mode = 'create';
      this.suggestions = data.suggestions;
      this.tags = data.tags;
    }

    this.noteService.tagGroups.subscribe(tgs => this.allTags = tgs.map(tg => tg.tag));
    this.filteredTags = this.tagCtrl.valueChanges.pipe(
        map((tag: string | null) => tag ? this._filter(tag) : this.allTags.slice()));
  }

  ngOnInit(): void {
    if (this.mode === 'create') {
      this.selectedSuggestionIndex = 0;
      this.suggestedContentSelectionChanged();
    }
  }

  ngAfterViewInit() {
    const theme = this.settingsService.themeSetting.value === Theme.DARK ? DARK_THEME : LIGHT_THEME;
    this.frontEditor = CodeMirror.fromTextArea(this.frontEditorElem.nativeElement,
        {
          mode: 'multiplex',
          lineWrapping: true,
          theme,
          configureMouse: (cm, repeat, ev) => ({ addNew: false}),
        } as any /* for some reason configureMouse is missing from the typings */);

    this.backEditor = CodeMirror.fromTextArea(this.backEditorElem.nativeElement,
        {
          mode: 'multiplex',
          lineWrapping: true,
          theme,
        });

    if (this.mode === 'edit') {
      this.frontEditor.setValue(this.data.flashcardToEdit.side1);
      this.backEditor.setValue(this.data.flashcardToEdit.side2);
    } else {
      this.frontEditor.setValue(this.visibleSentence);
      this.backEditor.setValue(this.visibleSentence);
    }
    this.frontChanged();
    this.backChanged();

    fromEvent(this.frontEditor, 'changes')
        .pipe(debounceTime(100))
        .subscribe(([cm, changes]) => this.frontChanged());

    fromEvent(this.backEditor, 'changes')
        .pipe(debounceTime(100))
        .subscribe(([cm, changes]) => this.backChanged());

    // Enable ctrl/cmd + click to hide a word
    this.frontEditor.on('mousedown', (cm, e) => {
      this.mouseEventWithCtrlActive = e.metaKey || e.ctrlKey;
    });
    this.frontEditor.on('cursorActivity', async (cm, event) => {
      if (this.mouseEventWithCtrlActive) {
        const wordUnderCursor = cm.findWordAt(cm.getCursor());
        const word = cm.getRange(wordUnderCursor.anchor, wordUnderCursor.head);
        const replacementWord = Array(Math.max(1, Math.floor(word.length / 2))).fill('█').join('');
        this.frontEditor.replaceRange(replacementWord, wordUnderCursor.anchor, wordUnderCursor.head);
      }
      this.mouseEventWithCtrlActive = false;
    });
  }

  @HostListener('window:keydown', ['$event'])
  shortcutHandler(e) {
    const ctrlPressed = e.ctrlKey || e.metaKey;
    if (e.key === 'j' && ctrlPressed && this.mode === 'create') {
      this.selectedSuggestionIndex = (this.selectedSuggestionIndex + 1) % this.suggestions.length;
      this.suggestedContentSelectionChanged();
    }
  }

  suggestedContentSelectionChanged() {
    const suggestion = this.suggestions[this.selectedSuggestionIndex];
    this.visibleSentence = suggestion;
  }

  removeTag(tag: string) {
    this.tags = this.tags.filter(tg => tg !== tag);
  }

  async saveAndClose() {
    this.submitting = true;
    let fc;
    if (this.mode === 'edit') {
      fc = this.data.flashcardToEdit;
      fc.side1 = this.frontEditor.getValue();
      fc.side2 = this.backEditor.getValue();
      await this.noteService.saveFlashcard(fc);
    } else {
      await this.noteService.createFlashcard({
        tags: this.tags.filter(t => !this.ignoredTags.has(t)),
        side1: this.frontEditor.getValue(),
        side2: this.backEditor.getValue(),
        isTwoWay: false, // TODO: let user select
        learningData: INITIAL_FLASHCARD_LEARNING_DATA,
      });
    }
    this.dialogRef.close();
  }

  add(event: MatChipInputEvent) {
    const input = event.input;
    const value = event.value;

    if ((value || '').trim()) {
      this.tags.push(value.trim());
    }

    if (input) {
      input.value = '';
    }

    this.tagCtrl.setValue(null);
  }

  selected(event: MatAutocompleteSelectedEvent): void {
    this.tags.push(event.option.viewValue);
    this.tagInput.nativeElement.value = '';
    this.tagCtrl.setValue(null);
  }

  private frontChanged() {
    const unsafeContent = (marked as any)(this.frontEditor.getValue());
    const sanitizedContent = this.sanitizer.sanitize(SecurityContext.HTML, unsafeContent);
    this.renderedFront.nativeElement.innerHTML = this.sanitizer.sanitize(SecurityContext.HTML, sanitizedContent);
  }

  private backChanged() {
    const unsafeContent = (marked as any)(this.backEditor.getValue());
    const sanitizedContent = this.sanitizer.sanitize(SecurityContext.HTML, unsafeContent);
    this.renderedBack.nativeElement.innerHTML = this.sanitizer.sanitize(SecurityContext.HTML, sanitizedContent);
  }

  private _filter(value: string): string[] {
    const filterValue = value.toLowerCase();
    return this.allTags.filter(tag => tag.toLowerCase().indexOf(filterValue) === 0);
  }
}
