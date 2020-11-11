import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  SecurityContext,
  ViewChild
} from '@angular/core';
import 'codemirror/addon/fold/foldgutter';
import 'codemirror/addon/fold/brace-fold';
import 'codemirror/addon/fold/comment-fold';
import 'codemirror/addon/fold/foldcode';
import 'codemirror/addon/fold/indent-fold';
import 'codemirror/addon/fold/markdown-fold';
import 'codemirror/addon/fold/xml-fold';

import 'codemirror/addon/hint/show-hint';
import 'codemirror/addon/search/searchcursor';
import 'codemirror/addon/mode/overlay';
import 'codemirror/addon/mode/simple';
import 'codemirror/addon/mode/multiplex';
import 'codemirror/mode/markdown/markdown';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/clike/clike';
import 'codemirror/mode/clojure/clojure';
import 'codemirror/mode/elm/elm';
import 'codemirror/mode/haskell/haskell';
import 'codemirror/mode/css/css';
import 'codemirror/mode/xml/xml';
import 'codemirror/mode/gfm/gfm';
import 'codemirror/mode/php/php';
import 'codemirror/mode/python/python';
import 'codemirror/mode/r/r';
import 'codemirror/mode/ruby/ruby';
import 'codemirror/mode/sql/sql';
import 'codemirror/mode/swift/swift';
import 'codemirror/mode/vb/vb';
import 'codemirror/mode/yaml/yaml';
import 'codemirror/mode/go/go';
import 'codemirror/mode/rust/rust';
import 'codemirror/mode/julia/julia';
import 'codemirror/mode/tcl/tcl';
import 'codemirror/mode/scheme/scheme';
import 'codemirror/mode/commonlisp/commonlisp';
import 'codemirror/mode/powershell/powershell';
import 'codemirror/mode/smalltalk/smalltalk';
import * as CodeMirror from 'codemirror';
import {NoteService} from '../note.service';
import {fromEvent} from 'rxjs';
import {debounceTime} from 'rxjs/operators';
import {AttachedFile, FlashcardSuggestion, FlashcardSuggestionExtractionRule, NoteObject} from '../types';
import {SettingsService, Theme} from '../settings.service';
import {NotificationService} from '../notification.service';
import * as marked from 'marked';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import {AttachmentsDialogComponent} from '../attachments-dialog/attachments-dialog.component';
import {MatSnackBar} from '@angular/material/snack-bar';
import {BackreferencesDialogComponent} from '../backreferences-dialog/backreferences-dialog.component';
import {ValidateImmediatelyMatcher} from '../already-existing-note.directive';
import {PROGRAMMING_LANGUAGES} from './highlighted-programming-languages';
import {SubviewManagerService} from '../subview-manager.service';
import {DomSanitizer} from '@angular/platform-browser';
import {FlashcardDialogComponent} from '../create-flashcard-dialog/flashcard-dialog.component';
import {TextMarker} from 'codemirror';

declare interface CodeMirrorHelper {
  commands: {
    autocomplete: any
  };
  hint: {
    notes: {}
  };
}

declare const ResizeObserver;

const DARK_THEME = 'darcula';
const LIGHT_THEME = 'default';

const FC_SUGGESTION_EXTRACTION_RULES: FlashcardSuggestionExtractionRule[] = [
  {
    start: /[.?!]\s|^- |\d\. |[\r\n]|^/,
    end: /[.?!]\s|[\r\n]|$/,
    description: 'Match sentence',
  },
  {
    start: /[\r\n]|^/,
    end: /[\r\n]|$/,
    description: 'Match paragraph',
  }
];

@Component({
  selector: 'app-editor',
  templateUrl: './editor.component.html',
  styles: [],
})
export class EditorComponent implements AfterViewInit, OnInit, OnDestroy, AfterViewInit {
  @ViewChild('codemirror') cm: ElementRef;
  @ViewChild('cmContainer') cmContainer: ElementRef;
  @ViewChild('markdown') markdown: ElementRef;
  @ViewChild('titleRenameInput', { read: ElementRef }) titleRenameInput: ElementRef;
  @Output() contentChange = new EventEmitter();
  @Input() noteId;

  noteTitle: string;
  editorState: 'editor'|'split' = 'editor';
  attachedFiles: AttachedFile[]|null = null;
  selectedNote: NoteObject|null = null;
  matcher = new ValidateImmediatelyMatcher();
  showSpinner = false;

  private codemirror: CodeMirror.EditorFromTextArea;
  private previousChar: string;
  private allNoteTitles: string[];
  private allTags: string[];
  private mouseEventWithCtrlActive = false;
  private mouseEventWithCtrlAndShiftActive = false;
  private inlinedImages: Map<string, CodeMirror.LineWidget> = new Map();
  private fcDialogRef: MatDialogRef<FlashcardDialogComponent>;
  private hashtagTextMarkers = new Set<TextMarker>();
  private noteLinkTextMarkers = new Set<TextMarker>();
  @HostBinding('class.ctrl-pressed') ctrlPressed = false;
  private fetchSelectedNotePromise: Promise<NoteObject>;

  private cmResizeObserver = new ResizeObserver(unused => {
    const {width, height} = this.cmContainer.nativeElement.getBoundingClientRect();
    this.codemirror.setSize(width + 'px', height + 'px');
    this.codemirror.refresh(); // Apparently setting size doesn't always refresh
  });

  private unloadListener = () => this.saveChanges();

  constructor(
      public dialog: MatDialog,
      private readonly noteService: NoteService,
      private readonly subviewManager: SubviewManagerService,
      private readonly settingsService: SettingsService,
      private readonly notifications: NotificationService,
      private snackBar: MatSnackBar,
      private sanitizer: DomSanitizer) {
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

  async ngOnInit() {
    // Initialize selectedNote here instead of in ngAfterViewInit to avoid 'expression has changed after it was last
    // checked' exceptions.
    this.selectedNote = this.noteService.getNote(this.noteId);
    if (!this.selectedNote) {
      this.showSpinner = true;
      this.fetchSelectedNotePromise = this.noteService.getNoteWhenReady(this.noteId);
      this.selectedNote = await this.fetchSelectedNotePromise;
      this.showSpinner = false;
    }

    this.noteTitle = this.selectedNote.title;
    this.noteService.tagGroups.subscribe(val => this.allTags = val.map(t => t.tag));
    this.noteService.notes.subscribe(newNotes => this.allNoteTitles = newNotes.map(n => n.title));
    this.noteService.attachmentMetadata.subscribe(metadata => {
      if (this.selectedNote && metadata && metadata.hasOwnProperty(this.selectedNote.id)) {
        this.attachedFiles = metadata[this.selectedNote.id];
      }
    });
    window.addEventListener('beforeunload', this.unloadListener);
  }

  // Initialize codemirror - we need to do this in ngAfterViewInit since (IIRC) some html elements weren't in place
  // if we try to do this in ngOnInit
  async ngAfterViewInit() {
    if (!this.selectedNote) {
      this.selectedNote = await this.fetchSelectedNotePromise;
    }

    this.initializeCodeMirror();
    this.codemirror.setValue(this.selectedNote.content);
    this.codemirror.focus();
    this.codemirror.setCursor(0, 0);

    if (this.selectedNote) {
      this.codemirror.setValue(this.selectedNote.content);
    }

    this.contentChange.pipe(debounceTime(100)).subscribe(newContent => {
      if (this.editorState === 'split') {
        this.setRenderedMarkdown(newContent);
      }
    });
  }

  private setRenderedMarkdown(content: string) {
    const unsafeContent = (marked as any)(content);
    this.markdown.nativeElement.innerHTML = this.sanitizer.sanitize(SecurityContext.HTML, unsafeContent);
  }

  private initializeHighlightModes() {
    CodeMirror.defineMode('multiplex',  (config) => {
      const codeModes = PROGRAMMING_LANGUAGES.map(({mimeType, selectors}) => {
        const escapedSelectors = selectors.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        return {
          open: new RegExp('(?:```)\\s*(' + escapedSelectors.join('|') + ')\\b'),
          close: /```/,
          mode: CodeMirror.getMode(config, mimeType),
          delimStyle: 'formatted-code-block',
          innerStyle: 'formatted-code'
        };
      });
      return (CodeMirror as any).multiplexingMode(
          CodeMirror.getMode(config, 'markdown'), // Default mode
          ...codeModes,
      );
    });
  }

  initializeCodeMirror() {
    this.initializeHighlightModes();
    this.cmResizeObserver.observe(this.cmContainer.nativeElement);

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
      {
        mode: 'multiplex',
        lineWrapping: true,
        extraKeys: {'Shift-Space': 'autocomplete'},
        theme,
        foldGutter: true,
        gutters: ['CodeMirror-foldgutter'],
      });

    // Set up notification of unsaved changes
    fromEvent(this.codemirror, 'changes')
        .pipe(debounceTime(100))
        .subscribe(([cm, changes]) => {
          const isInitialValueSet = changes[0].origin === 'setValue';
          if (!isInitialValueSet) {
            this.notifications.unsavedChanged(this.selectedNote.id);
          }
        });

    // Autosave after some inactivity
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
    this.codemirror.on('mousedown', (cm, e) => {
      this.mouseEventWithCtrlActive = e.metaKey || e.ctrlKey;
      this.mouseEventWithCtrlAndShiftActive = this.mouseEventWithCtrlActive && e.shiftKey;
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
          const note = this.noteService.notes.value.find(n => n.title === noteTitle);
          let noteId;
          if (note) {
            noteId = note.id;
          } else {
            noteId = await this.noteService.createNote(noteTitle);
          }
          if (this.mouseEventWithCtrlAndShiftActive) {
            this.subviewManager.openNoteInNewWindow(noteId);
          } else {
            this.subviewManager.openViewInActiveWindow(noteId);
          }
        }
      }
      this.mouseEventWithCtrlActive = false;
    });

    // Inline images
    this.contentChange.pipe(debounceTime(100)).subscribe(e => this.inlineImages());

    // Style hashtags
    this.contentChange.pipe(debounceTime(100)).subscribe(e => this.styleHashtags());

    // Style note links
    this.contentChange.pipe(debounceTime(100)).subscribe(e => this.styleNoteLinks());
  }

  ngOnDestroy(): void {
    this.cmResizeObserver.disconnect();
    this.saveChanges();
    window.removeEventListener('beforeunload', this.unloadListener);
  }

  async saveChanges() {
    const valueToSave = this.codemirror.getValue();
    const noteId = this.selectedNote?.id;
    if (noteId && this.selectedNote.content !== valueToSave) {
      await this.noteService.saveContent(this.selectedNote.id, valueToSave);
      const userSwitchedToOtherNote = noteId !== this.selectedNote?.id;
      const noteUnchangedWhileSaving = valueToSave === this.codemirror.getValue();
      if (noteUnchangedWhileSaving || userSwitchedToOtherNote) {
        this.notifications.noteSaved(noteId);
      }
    }
    // If user adds and then deleted the addition, remove the 'unsaved' marker
    if (this.selectedNote?.content === valueToSave) {
      this.notifications.noteSaved(noteId);
    }
  }

  insertImageLinkToCursorPosition(imageUrl: string, imageName: string) {
    const doc = this.codemirror.getDoc();
    const cursor = doc.getCursor();

    const pos = {
      line: cursor.line,
      ch: cursor.ch
    };

    doc.replaceRange(`![${imageName}](${imageUrl})`, pos);
  }

  openAttachmentsDialog() {
    this.dialog.open(AttachmentsDialogComponent, {
      position: { top: '10px' },
      data: { noteId: this.selectedNote.id },
    });
  }

  private openNewFlashcardDialog() {
    if (this.fcDialogRef) {
      return;
    }
    const cursor = this.codemirror.getCursor();
    const flashcardSuggestions = this.getFlashcardSuggestion(cursor);
    const userSelection = this.codemirror.getSelection();
    if (userSelection) {
      const manualSuggestion = {
        text: userSelection,
        start: this.codemirror.getCursor('from'),
        end: this.codemirror.getCursor('to'),
      };
      flashcardSuggestions.unshift(manualSuggestion);
    }
    this.fcDialogRef = this.dialog.open(FlashcardDialogComponent, {
      position: { top: '10px' },
      data: {
        flashcardSuggestions,
        tags: NoteService.getTagsForNoteContent(this.codemirror.getValue()),
      },
    });
    this.fcDialogRef.componentInstance.selectNextSuggestion.subscribe(
        (e) => this.codemirror.setSelection(e.start, e.end));
    this.fcDialogRef.afterClosed().subscribe(() => this.fcDialogRef = null);
  }

  openBackreferencesDialog() {
    this.dialog.open(BackreferencesDialogComponent, {
      position: { top: '10px' },
      data: { noteId: this.selectedNote.id },
    });
  }

  toggleSplitView() {
    if (this.editorState !== 'split') {
      this.editorState = 'split';
      // Needs to be async since markdown isn't inserted into the dom at this point yet
      setTimeout(() => {
        this.setRenderedMarkdown(this.codemirror.getValue());
      });
    } else {
      this.editorState = 'editor';
    }
  }

  @HostListener('drop', ['$event'])
  async evtDrop(e: DragEvent) {
    const files = e.dataTransfer.files;
    if (files.length !== 1) {
      throw new Error(`Was expecting 1 file. Got ${files.length}.`);
    }
    const file = files[0];
    const name = file.name;
    const notificationId = this.notifications.createId();
    this.notifications.toSidebar(notificationId, 'Uploading file');
    const fileId = await this.noteService.uploadFile(file, file.type, file.name);
    await this.noteService.attachUploadedFileToNote(this.selectedNote.id, fileId, file.name, file.type);
    this.notifications.toSidebar(notificationId, 'File uploaded', 3000);
    if (file.type.startsWith('image/')) {
      this.insertImageLinkToCursorPosition(NoteService.fileIdToLink(fileId), name);
    }
  }

  async executeRename(newTitle) {
    this.titleRenameInput.nativeElement.blur();
    const noteId = this.selectedNote.id;
    const curTitle = this.noteService.notes.value.find(n => n.id === noteId).title;
    if (newTitle !== curTitle) {
      const res = await this.noteService.renameNote(noteId, newTitle);
      this.snackBar.open(
          `Renamed ${res.renamedBackRefCount} references in ${res.renamedNoteCount} notes`,
          null,
          {duration: 5000});
    }
  }

  revertChangesAndBlur() {
    this.titleRenameInput.nativeElement.value = this.selectedNote.title;
    this.titleRenameInput.nativeElement.blur();
  }

  async deleteNote() {
    const result = window.confirm(`Delete ${this.selectedNote.title}?`);
    if (result) {
      await this.noteService.deleteNote(this.selectedNote.id);
      this.closeNote();
    }
  }

  closeNote() {
    this.subviewManager.closeView(this.selectedNote.id);
  }

  private styleHashtags() {
    for (const textMarker of this.hashtagTextMarkers) {
      textMarker.clear();
    }
    this.hashtagTextMarkers.clear();
    const cursor = this.codemirror.getSearchCursor(/#[^\s#]+\s/);
    while (cursor.findNext()) {
      const txt = this.codemirror.getRange(cursor.from(), cursor.to()).trimEnd();
      if (this.noteService.tagExists(txt)) {
        const textMarker = this.codemirror.markText(cursor.from(), cursor.to(), {className: 'existing-tag'});
        this.hashtagTextMarkers.add(textMarker);
      }
    }
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(e) {
    if (e.key === 'Meta' || e.key === 'Control') {
      this.ctrlPressed = true;
    } else if (e.key === 'j' && (e.ctrlKey || e.metaKey)) {
      this.openNewFlashcardDialog();
      e.stopPropagation();
    }
  }

  private inlineImages() {
    if (!this.attachedFiles) {
      return;
    }
    const newLineNumsAndLinks: Set<string> = new Set();
    // Get all images which should be inlined
    for (const attachedFile of this.attachedFiles) {
      if (attachedFile.mimeType.startsWith('image/')) {
        const link = NoteService.fileIdToLink(attachedFile.fileId);
        const cursor = this.codemirror.getSearchCursor(link);
        while (cursor.findNext()) {
          const line = cursor.to().line;
          newLineNumsAndLinks.add(JSON.stringify([line, link]));
        }
      }
    }

    // Remove the images that have been removed or have moved lines
    const existingLineNumAndLinks = Array.from(this.inlinedImages.keys());
    for (const existing of existingLineNumAndLinks) {
      if (!newLineNumsAndLinks.has(existing)) {
        this.codemirror.removeLineWidget(this.inlinedImages.get(existing));
        this.inlinedImages.delete(existing);
      }
    }

    // Add added images
    for (const newLineAndLink of newLineNumsAndLinks) {
      const [line, link] = JSON.parse(newLineAndLink);
      if (!this.inlinedImages.has(newLineAndLink)) {
        const imgElem = document.createElement('img');
        imgElem.src = this.sanitizer.sanitize(SecurityContext.URL, link);
        imgElem.style.setProperty('max-width', '100%');
        // If we don't refresh CM after loading it seems codemirror 'misplaces' lines and thinks there's text in empty
        // areas and vice versa
        imgElem.onload = () => this.codemirror.refresh();
        const lineWidget = this.codemirror.addLineWidget(line, imgElem);
        this.inlinedImages.set(newLineAndLink, lineWidget);
      }
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(e) {
    if (e.key === 'Meta' || e.key === 'Control') {
      this.ctrlPressed = false;
    }
  }

  private styleNoteLinks() {
    for (const textMarker of this.noteLinkTextMarkers) {
      textMarker.clear();
    }
    this.noteLinkTextMarkers.clear();
    const cursor = this.codemirror.getSearchCursor(/\[\[.*?]]/);
    while (cursor.findNext()) {
      const from = { line: cursor.from().line, ch: cursor.from().ch + 2 };
      const to = { line: cursor.to().line, ch: cursor.to().ch - 2 };
      const txt = this.codemirror.getRange(from, to);
      const note = this.noteService.getNoteForTitleCaseInsensitive(txt);
      if (!note) {
        const textMarker = this.codemirror.markText(from, to, {className: 'not-existing-note-link'});
        this.noteLinkTextMarkers.add(textMarker);
      } else {
        const textMarker = this.codemirror.markText(from, to, {className: 'existing-note-link'});
      }
    }
  }

  private getFlashcardSuggestion(cursor: CodeMirror.Position): FlashcardSuggestion[] {
    const line = this.codemirror.getLine(cursor.line);
    const lineStart = line.slice(0, cursor.ch);
    const lineEnd = line.slice(cursor.ch);
    const suggestions: FlashcardSuggestion[] = [];
    for (const extRule of FC_SUGGESTION_EXTRACTION_RULES) {
      // Make start regex global since we want to get the last match
      const startRegex = new RegExp(extRule.start, extRule.start.flags + 'g');
      const allMatches = Array.from(lineStart.matchAll(startRegex));
      const startMatch = allMatches[allMatches.length - 1];
      let startIdx = startMatch.index;
      if (!extRule.isStartInclusive) {
        startIdx += startMatch[0].length;
      }
      const endMatch = lineEnd.match(extRule.end);
      let endIdx = endMatch.index;
      if (extRule.isEndInclusive) {
        endIdx += endMatch[0].length;
      }
      suggestions.push({
        text: lineStart.slice(startIdx) + lineEnd.slice(0, endIdx),
        start: {ch: startIdx, line: cursor.line},
        end: {ch: lineStart.length + endIdx, line: cursor.line},
      });
    }
    return suggestions;
  }
}
