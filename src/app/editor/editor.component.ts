import {AfterViewInit, Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild} from '@angular/core';
import * as CodeMirror from 'codemirror';
import {NoteService} from '../note.service';
import {fromEvent} from 'rxjs';
import {debounceTime} from 'rxjs/operators';
import 'codemirror/addon/hint/show-hint';
import {DragAndDropImage, NoteObject} from '../types';
import {SettingsService, Theme} from '../settings.service';
import {NotificationService} from '../notification.service';

declare interface CodeMirrorHelper {
  commands: {
    autocomplete: any
  };
  hint: {
    notes: {}
  };
}

const DARK_THEME = 'darcula';
const LIGHT_THEME = 'default';

@Component({
  selector: 'app-editor',
  templateUrl: './editor.component.html',
  styles: [],
})
export class EditorComponent implements AfterViewInit, OnInit, OnDestroy {
  @ViewChild('codemirror') cm: ElementRef;
  @Output() contentChange = new EventEmitter();

  private codemirror: CodeMirror.EditorFromTextArea;
  private selectedNote: NoteObject;
  private previousChar: string;
  private allNoteTitles: string[];
  private allTags: string[];
  private unloadListener = () => this.saveChanges();

  constructor(
      private readonly noteService: NoteService,
      private readonly settingsService: SettingsService,
      private readonly notifications: NotificationService) {
    this.settingsService.themeSetting.subscribe(theme => {
      switch (theme) {
        case Theme.DARK:
          this.codemirror?.setOption('theme', DARK_THEME);
          break;
        case Theme.LIGHT:
          this.codemirror?.setOption('theme', LIGHT_THEME);
      }
    });
  }

  ngOnInit(): void {
    this.selectedNote = this.noteService.currentSelectedNote;
    this.allNoteTitles = this.noteService?.currentNotes?.map(n => n.title);
    this.noteService.notesAndTagGroups.subscribe(val => this.allTags = val.tagGroups.map(t => t.tag));
    this.noteService.selectedNote.subscribe(newSelectedNote => {
      this.saveChanges();
      this.selectedNote = newSelectedNote;
      this.codemirror.setValue(newSelectedNote.content);
      this.codemirror.focus();
      this.codemirror.setCursor(0, 0);
    });
    this.noteService.notes.subscribe(newNotes => {
      this.allNoteTitles = newNotes.map(note => note.title);
    });
    window.addEventListener('beforeunload', this.unloadListener);
  }

  ngAfterViewInit(): void {
    this.initializeCodeMirror();
    if (this.selectedNote) { // Might not be initialized at first
      // TODO: we need to show something like 'no notes selected/created' or something
      this.codemirror.setValue(this.selectedNote.content);
    }
  }

  initializeCodeMirror() {
    CodeMirror.registerHelper('hint', 'notes', (mirror, options) => {
      const cur = mirror.getCursor();
      const range = mirror.findWordAt(cur);
      const wordSoFar = mirror.getRange(range.anchor, range.head);

      // Because '#' and '[' seem to be considered punctuation marks, some special handling is required.
      const hintTypeStart = {
        ch: range.anchor.ch - 1,
        line: range.anchor.line,
        sticky: range.anchor.sticky
      } as CodeMirror.Position;
      const charPrecedingCurWord = mirror.getRange(hintTypeStart, range.anchor);
      const lettersTyped = ['#', '['].includes(charPrecedingCurWord);
      const hintType = lettersTyped ? charPrecedingCurWord : wordSoFar.slice(-1);

      if (hintType === '#') {
        return {
          list: this.allTags
              .filter(tag => tag.startsWith(wordSoFar === '#' ? '' : '#' + wordSoFar))
              .map(s => ({text: (lettersTyped ? s.slice(1) : s) + ' ', displayText: s})),
          from: range.anchor,
          to: range.head,
        };
      } else if (hintType === '[') {
        // Current range includes [[ if nothing else has been typed.
        // If we've typed something like [[mo only 'mo' is included in the range.
        const prefix = lettersTyped ? '' : '[[';
        return {
          list: this.allNoteTitles
              .filter(s => s.startsWith(wordSoFar === '[[' ? '' : wordSoFar))
              // Because current range might or might not include [[ (see above for why) we need to manually add/remove it here
              .map(s => ({text: prefix + s + ']] ', displayText: s})),
          from: range.anchor,
          to: range.head,
        };
      }
    });

    (CodeMirror as unknown as CodeMirrorHelper).commands.autocomplete = (cm) => {
      cm.showHint({
        hint: (CodeMirror as unknown as CodeMirrorHelper).hint.notes
      });
    };

    const theme = this.settingsService.themeSetting.value === Theme.DARK ? DARK_THEME : LIGHT_THEME;
    this.codemirror = CodeMirror.fromTextArea(this.cm.nativeElement,
      {mode: 'markdown', lineWrapping: true, extraKeys: {'Shift-Space': 'autocomplete'}, theme});
    // this.codemirror.setSize('400px', '1000px'); // keep this here for performance testing codemirror resizing
    this.codemirror.setSize('100%', '100%');

    fromEvent(this.codemirror, 'changes')
        .pipe(debounceTime(100))
        .subscribe(([cmReference, changes]) => {
          const isInitialValueSet = changes[0].origin === 'setValue';
          if (!isInitialValueSet) {
            this.notifications.unsavedChanged(this.selectedNote.id);
          }
        });
    fromEvent(this.codemirror, 'changes').pipe(debounceTime(3_000)).subscribe(() => this.saveChanges());

    this.codemirror.on('keyup', (cm, event) => {
      /* Enables keyboard navigation in autocomplete list */
      const keyboardNavigationInAutocompleteListEnabled = !cm.state.completionActive;
      if (keyboardNavigationInAutocompleteListEnabled && event.key === '[' && this.previousChar === '[') {
        (CodeMirror as unknown as CodeMirrorHelper).commands.autocomplete(cm, null, {completeSingle: true});
      } else if (keyboardNavigationInAutocompleteListEnabled && event.key === '#' && this.previousChar !== '#') {
        (CodeMirror as unknown as CodeMirrorHelper).commands.autocomplete(cm, null, {completeSingle: true});
      }
      this.previousChar = event.key;
    });

    this.codemirror.on('change', (cm, event) => {
      this.contentChange.emit(cm.getValue());
    });
  }

  ngOnDestroy(): void {
    this.saveChanges();
    window.removeEventListener('beforeunload', this.unloadListener);
  }

  async saveChanges() {
    const valueToSave = this.codemirror.getValue();
    const noteId = this.selectedNote?.id;
    if (noteId && this.selectedNote.content !== valueToSave) {
      await this.noteService.saveContent(this.selectedNote.id, valueToSave);
      const userSwitchedToOtherNote = noteId !== this.selectedNote?.id;
      const noteChangedWhileSaving = valueToSave === this.codemirror.getValue();
      if (noteChangedWhileSaving || userSwitchedToOtherNote) {
        this.notifications.noteSaved(noteId);
      }
    }
  }

  onImageDropped(urlAndName: DragAndDropImage) {
    const doc = this.codemirror.getDoc();
    const cursor = doc.getCursor();

    const pos = {
      line: cursor.line,
      ch: cursor.ch
    };

    doc.replaceRange(`![${urlAndName.name}](${urlAndName.url})`, pos);
  }

  getContent() {
    return this.codemirror.getValue();
  }
}
