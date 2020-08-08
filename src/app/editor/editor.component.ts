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
  private selectedNote: NoteObject|null = null;
  private previousChar: string;
  private allNoteTitles: string[];
  private allTags: string[];
  private mouseEventWithCtrlActive = false;
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
    this.allNoteTitles = this.noteService?.currentNotes?.map(n => n.title);
    this.noteService.notesAndTagGroups.subscribe(val => this.allTags = val.tagGroups.map(t => t.tag));
    this.noteService.selectedNote.subscribe(newSelectedNote => {
      if (newSelectedNote === null) {
        this.selectedNote = null;
        return;
      }
      if (this.selectedNote !== null) {
        this.saveChanges();
      }
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
      const lineSoFar = mirror.getRange({ch: 0, line: cur.line}, cur);
      const lastHashtag = lineSoFar.lastIndexOf('#');
      const lastBrackets = lineSoFar.lastIndexOf('[[');

      if (lastHashtag === -1 && lastBrackets === -1) {
        return;
      }

      // Set up autocomplete
      const hintType: '#'|'[' = lastHashtag > lastBrackets ? '#' : '[';
      if (hintType === '#') {
        const wordSoFar = lineSoFar.slice(lastHashtag);
        return {
          list: this.allTags
              .filter(tag => tag.startsWith(wordSoFar))
              .map(s => ({text: s, displayText: s})),
          from: {line: cur.line, ch: lastHashtag},
          to: {line: cur.line, ch: cur.ch},
        };
      } else if (hintType === '[') {
        const wordSoFar = lineSoFar.slice(lastBrackets + 2);
        return {
          list: this.allNoteTitles
              .filter(s => s.startsWith(wordSoFar))
              .map(s => ({text: '[[' + s + ']] ', displayText: s})),
          from: {line: cur.line, ch: lastBrackets},
          to: {line: cur.line, ch: cur.ch},
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

    // Set up notification of unsaved changes
    fromEvent(this.codemirror, 'changes')
        .pipe(debounceTime(100))
        .subscribe(([cmReference, changes]) => {
          const isInitialValueSet = changes[0].origin === 'setValue';
          if (!isInitialValueSet) {
            this.notifications.unsavedChanged(this.selectedNote.id);
          }
        });

    // Autosave after some inacitivity
    fromEvent(this.codemirror, 'changes').pipe(debounceTime(3_000)).subscribe(() => this.saveChanges());

    // Enables keyboard navigation in autocomplete list
    this.codemirror.on('keyup', (cm, event) => {
      const keyboardNavigationInAutocompleteListEnabled = !cm.state.completionActive;
      if (keyboardNavigationInAutocompleteListEnabled && event.key === '[' && this.previousChar === '[') {
        (CodeMirror as unknown as CodeMirrorHelper).commands.autocomplete(cm, null, {completeSingle: true});
      } else if (keyboardNavigationInAutocompleteListEnabled && event.key === '#' && this.previousChar !== '#') {
        (CodeMirror as unknown as CodeMirrorHelper).commands.autocomplete(cm, null, {completeSingle: true});
      }
      this.previousChar = event.key;
    });

    // Emit content on every change to enable autosave
    this.codemirror.on('change', (cm, event) => {
      this.contentChange.emit(cm.getValue());
    });

    // Enable ctrl/cmd + click to jump to a note or create new one
    this.codemirror.on('mousedown', (cm, event) => {
      this.mouseEventWithCtrlActive = event.metaKey || event.ctrlKey;
    });
    this.codemirror.on('cursorActivity', async (cm, event) => {
      if (this.mouseEventWithCtrlActive) {
        const line = cm.getLine(cm.getCursor().line);
        const pos = cm.getCursor().ch;
        const start = line.substr(0, pos);
        const end = line.substr(pos);
        let startIdx;
        for (startIdx = start.length; startIdx > 0; startIdx--) {
          if (start.substr(startIdx - 2, 2) === '[[') {
            break;
          }
        }
        let endIdx;
        for (endIdx = 0; endIdx < end.length; endIdx++) {
          if (end.substr(endIdx, 2) === ']]') {
            break;
          }
        }
        if (startIdx !== 0 && endIdx !== end.length) {
          const noteTitle = start.substr(startIdx) + end.substr(0, endIdx);
          const note = this.noteService.currentNotes.find(n => n.title === noteTitle);
          if (note) {
            this.noteService.selectNote(note.id);
          } else {
            const noteId = await this.noteService.createNote(noteTitle);
            this.noteService.selectNote(noteId);
          }
        }
      }
      this.mouseEventWithCtrlActive = false;
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
