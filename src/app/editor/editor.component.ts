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
import {StorageService} from '../storage.service';
import {fromEvent, ReplaySubject} from 'rxjs';
import {debounceTime, takeUntil} from 'rxjs/operators';
import {AttachedFile, FlashcardSuggestionExtractionRule, NoteObject} from '../types';
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
import {FlashcardDialogComponent, FlashcardDialogData} from '../create-flashcard-dialog/flashcard-dialog.component';
import {TextMarker} from 'codemirror';
import {DARK_THEME, LIGHT_THEME, TAG_MATCH_REGEX} from '../constants';
import {makeNamesUnique} from '../utils';

declare interface CodeMirrorHelper {
  commands: {
    autocomplete: any
  };
  hint: {
    notes: {}
  };
}

declare const ResizeObserver;

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

const URL_REGEX =
    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

@Component({
  selector: 'cn-editor',
  templateUrl: './editor.component.html',
  styles: [],
})
export class EditorComponent implements AfterViewInit, OnInit, OnDestroy {
  @ViewChild('codemirror') cm: ElementRef;
  @ViewChild('cmContainer') cmContainer: ElementRef;
  @ViewChild('markdown') markdown: ElementRef;
  @ViewChild('titleRenameInput', { read: ElementRef }) titleRenameInput: ElementRef;
  @Output() contentChange = new EventEmitter();
  @Input() noteId;

  @HostBinding('class.ctrl-pressed') ctrlPressed = false;

  markdownContent: string;
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
  private tagMarkers = new Set<TextMarker>();
  private mdHeaderMarkers = new Set<TextMarker>();
  private noteLinkTextMarkers = new Set<TextMarker>();
  private fetchSelectedNotePromise: Promise<NoteObject>;
  private readonly destroyed = new ReplaySubject(1);
  private lastValueSaved: string;

  private cmResizeObserver = new ResizeObserver(unused => {
    const {width, height} = this.cmContainer.nativeElement.getBoundingClientRect();
    this.codemirror.setSize(width + 'px', height + 'px');
    this.codemirror.refresh(); // Apparently setting size doesn't always refresh
  });

  private unloadListener = () => this.saveChanges();

  constructor(
      public dialog: MatDialog,
      private readonly storage: StorageService,
      private readonly subviewManager: SubviewManagerService,
      private readonly settingsService: SettingsService,
      private readonly notifications: NotificationService,
      private snackBar: MatSnackBar,
      private sanitizer: DomSanitizer) {
    this.settingsService.themeSetting.pipe(takeUntil(this.destroyed)).subscribe(theme => {
      switch (theme) {
        case Theme.DARK:
          this.codemirror?.setOption('theme', DARK_THEME);
          break;
        case Theme.LIGHT:
          this.codemirror?.setOption('theme', LIGHT_THEME);
      }
    });
    this.subviewManager.noteTitleChanged.pipe(takeUntil(this.destroyed)).subscribe(change => {
      this.renameNote(change.oldTitle, change.newTitle);
    });
    this.subviewManager.tagChanged.pipe(takeUntil(this.destroyed)).subscribe(change => {
      const isAffected = !change.affectedNoteIds || change.affectedNoteIds.includes(this.noteId);
      if (isAffected) {
        this.renameTag(change.oldTag, change.newTag);
      }
    });
    this.storage.attachedFiles.subscribe(af => {
      this.attachedFiles = af;
    });

    // TODO: can we just initialize this once?
    this.setUpMarkedJsRenderer();
  }

  initializeCodeMirror() {
    this.initializeHighlightModes();
    this.cmResizeObserver.observe(this.cmContainer.nativeElement);

    // Set up autocomplete
    CodeMirror.registerHelper('hint', 'notes', (mirror, options) => {
      const cur = mirror.getCursor();
      const lineSoFar = mirror.getRange({ch: 0, line: cur.line}, cur);
      const lastHashtag = lineSoFar.lastIndexOf('#');
      const lastBrackets = lineSoFar.lastIndexOf('[[');

      if (lastHashtag === -1 && lastBrackets === -1) {
        return;
      }

      const hintType: 'tag'|'note' = lastHashtag > lastBrackets ? 'tag' : 'note';
      if (hintType === 'tag') {
        const wordSoFar = lineSoFar.slice(lastHashtag);
        return {
          list: this.allTags
              .filter(tag => tag.startsWith(wordSoFar))
              .map(s => ({text: s, displayText: s})),
          from: {line: cur.line, ch: lastHashtag},
          to: {line: cur.line, ch: cur.ch},
        };
      } else if (hintType === 'note') {
        const wordSoFar = lineSoFar.slice(lastBrackets + 2);
        return {
          list: this.allNoteTitles
              .filter(s => s.toLocaleLowerCase().startsWith(wordSoFar.toLocaleLowerCase()))
              .map(s => ({text: '[[' + s + ']] ', displayText: s})),
          from: {line: cur.line, ch: lastBrackets},
          to: {line: cur.line, ch: cur.ch},
        };
      }
    });

    (CodeMirror as unknown as CodeMirrorHelper).commands.autocomplete = (cm) => {
      cm.showHint({
        hint: (CodeMirror as unknown as CodeMirrorHelper).hint.notes,
        closeCharacters: /[]/, // Only close the autocomplete menu when there are no suggestions left
      });
    };

    const theme = this.settingsService.themeSetting.value === Theme.DARK ? DARK_THEME : LIGHT_THEME;
    this.codemirror = CodeMirror.fromTextArea(this.cm.nativeElement,
      {
        mode: 'multiplex',
        lineWrapping: true,
        extraKeys: {'Shift-Space': 'autocomplete'},
        theme,
        viewportMargin: Infinity, // To enable ctrl + f in browser
        foldGutter: true,
        gutters: ['CodeMirror-foldgutter'],
      });

    // Set up notification of unsaved changes
    fromEvent(this.codemirror, 'changes')
        .pipe(debounceTime(100))
        .pipe(takeUntil(this.destroyed))
        .subscribe(([cm, changes]) => {
          const isInitialValueSet = changes[0].origin === 'setValue';
          if (!isInitialValueSet) {
            this.notifications.unsavedChanged(this.selectedNote.id);
          }
        });

    // Autosave after some inactivity
    fromEvent(this.codemirror, 'changes')
        .pipe(debounceTime(3_000))
        .pipe(takeUntil(this.destroyed))
        .subscribe(() => this.saveChanges());

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
        const endIdx = end.indexOf(']]');
        if (startIdx !== 0 && endIdx !== -1) {
          const noteTitle = start.substr(startIdx) + end.substr(0, endIdx);
          const note = this.storage.getNoteForTitleCaseInsensitive(noteTitle);
          let noteId;
          if (note) {
            noteId = note.id;
          } else {
            noteId = await this.storage.createNote(noteTitle);
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

    // TODO: fix image inlining by looking for the links and marking them down, can do this with markedJS renderer
    // Inline images
    this.contentChange.pipe(debounceTime(100))
        .pipe(takeUntil(this.destroyed))
        .subscribe(e => this.inlineImages());

    // Style hashtags
    this.contentChange.pipe(debounceTime(100))
        .pipe(takeUntil(this.destroyed))
        .subscribe(e => this.styleTags());

    // Style markdown header (hashtags)
    this.contentChange.pipe(debounceTime(100))
        .pipe(takeUntil(this.destroyed))
        .subscribe(e => this.styleMarkdownHeaders());

    // Style note links
    this.contentChange.pipe(debounceTime(100))
        .pipe(takeUntil(this.destroyed))
        .subscribe(e => this.styleNoteLinks());
  }

  renameNote(oldName: string, newName: string) {
    const cursor = this.codemirror.getSearchCursor(`[[${oldName}]]`);
    while (cursor.findNext()) {
      this.codemirror.replaceRange(`[[${newName}]]`, cursor.from(), cursor.to());
    }
  }

  renameTag(oldTag: string, newTag: string) {
    const cursor = this.codemirror.getSearchCursor(new RegExp(`(^|\\s)(${oldTag})($|\\s)`));
    while (cursor.findNext()) {
      const line = cursor.from().line;
      const lineStr = this.codemirror.getLine(line);
      let startCh = cursor.from().ch;
      let endCh = Math.min(cursor.to().ch - 1, lineStr.length - 1);
      for (; lineStr[startCh] !== '#' && startCh < lineStr.length; startCh++) {}
      for (; lineStr[endCh].match(/\s/) && endCh >= 0; endCh--) {}
      if (startCh < endCh) {
        this.codemirror.replaceRange(newTag, {line, ch: startCh}, {line, ch: endCh + 1});
      }
    }
  }

  async ngOnInit() {
    // Initialize selectedNote here instead of in ngAfterViewInit to avoid 'expression has changed after it was last
    // checked' exceptions.
    this.selectedNote = this.storage.getNote(this.noteId);
    if (!this.selectedNote) {
      this.showSpinner = true;
      this.fetchSelectedNotePromise = this.storage.getNoteWhenReady(this.noteId);
      this.selectedNote = await this.fetchSelectedNotePromise;
      this.showSpinner = false;
    }

    this.noteTitle = this.selectedNote.title;
    this.storage.tagGroups.pipe(takeUntil(this.destroyed)).subscribe(val => {
      this.allTags = val.map(t => t.tag);
      this.allTags.sort();
    });
    this.storage.notes.pipe(takeUntil(this.destroyed))
        .subscribe(newNotes => this.allNoteTitles = newNotes.map(n => n.title));
    this.storage.attachmentMetadata.pipe(takeUntil(this.destroyed)).subscribe(metadata => {
      if (this.selectedNote && metadata && metadata.hasOwnProperty(this.selectedNote.id)) {
        this.attachedFiles = metadata[this.selectedNote.id];
      }
    });
    window.addEventListener('beforeunload', this.unloadListener);
  }

  // Initialize codemirror - we need to do this in ngAfterViewInit since (IIRC) some html elements weren't in place
  // if we try to do this in ngOnInit, probably codemirror
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

    this.contentChange.pipe(debounceTime(100)).pipe(takeUntil(this.destroyed))
        .subscribe(newContent => {
          if (this.editorState === 'split') {
            this.setRenderedMarkdown(newContent);
          }
        });
  }

  async saveChanges() {
    const valueToSave = this.codemirror?.getValue();
    // If the tab is inactive for a long while and is then closed, we don't want to save the note because there
    // shouldn't be any changes and the note might've been modified elsewhere.
    if (this.lastValueSaved === valueToSave) {
      return;
    }
    this.lastValueSaved = valueToSave;
    const noteId = this.selectedNote?.id;
    if (noteId && this.selectedNote.content !== valueToSave) { // TODO: why compare against this.selectedNote.content?
      await this.storage.saveNote(this.selectedNote.id, valueToSave);
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

  insertLinkToCursorPosition(url: string, name: string) {
    const doc = this.codemirror.getDoc();
    const cursor = doc.getCursor();

    const pos = {
      line: cursor.line,
      ch: cursor.ch
    };

    doc.replaceRange(`![${name}](${url})`, pos);
  }

  ngOnDestroy(): void {
    this.cmResizeObserver.disconnect();
    this.saveChanges();
    window.removeEventListener('beforeunload', this.unloadListener);
    this.destroyed.next(undefined);
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

  @HostListener('drop', ['$event'])
  async evtDrop(e: DragEvent) {
    const files = e.dataTransfer.files;
    if (files.length !== 1) {
      throw new Error(`Was expecting 1 file. Got ${files.length}.`);
    }
    const file = files[0];
    this.notifications.showFullScreenBlockingMessage('Uploading file...');

    // Rename attachment if the name would clash
    let name = file.name;
    const existingNames = new Set(this.storage.attachedFiles.value.map(af => af.name));
    if (existingNames.has(name)) {
      name = makeNamesUnique([name], existingNames)[0];
      this.notifications.showFullScreenBlockingMessage(
          `Uploading file... attachment with that name exists, renamed attachment to '${name}'`);
    }

    // Upload the attachment
    const fileId = await this.storage.uploadFile(file, file.type, name);
    await this.storage.attachUploadedFileToNote(this.selectedNote.id, fileId, name, file.type);
    this.notifications.showFullScreenBlockingMessage(null);
    this.insertLinkToCursorPosition(name, name);
  }

  // Set up markdown rendering so we can refer to attachments by their names.
  private setUpMarkedJsRenderer() {
    const renderer = {
      image: (href: string, title: string, text: string) => {
        // Allow linking to attached images using their name.
        for (const af of this.attachedFiles) {
          if (href === af.name) {
            return `<img src="${StorageService.fileIdToLink(af.fileId)}" alt="${text}" title="${title}"/>`;
          }
        }
        return `<img src="href" alt="${text}" title="${title}"/>`;
      },
      link: (href: string, title: string, text: string) => {
        // Allow linking by name to attachments.
        for (const af of this.attachedFiles) {
          if (href === af.name) {
            return `<a href="${StorageService.fileIdToLink(af.fileId)}">${text}</a>`;
          }
        }
        // For notes that are imported from local file system. They might be of the format ../blah/image.jpg so we'll
        // just assume the user wants to link to the image.jpg we have in attachments.
        const isUrl = URL_REGEX.test(href);
        for (const af of this.attachedFiles) {
          const looksLikeFilePath = (!isUrl && href.endsWith('/' + af.name));
          if (looksLikeFilePath) {
            return `<a href="${StorageService.fileIdToLink(af.fileId)}">${text}</a>`;
          }
        }
        return `<a href="${href}" title="${title}">${text}</a>`;
      }
    };

    marked.use({ renderer });
  }

  openAttachmentsDialog() {
    this.dialog.open(AttachmentsDialogComponent, {
      position: { top: '10px' },
      data: { noteId: this.selectedNote.id },
    });
  }

  private setRenderedMarkdown(content: string) {
    this.markdownContent = (marked as any)(content); // Automatically sanitized by angular
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

  async executeRename(newTitle) {
    this.titleRenameInput.nativeElement.blur();
    const noteId = this.selectedNote.id;
    const curTitle = this.storage.notes.value.find(n => n.id === noteId).title;
    if (newTitle !== curTitle) {
      const res = await this.storage.renameNote(noteId, newTitle);
      this.snackBar.open(
          `Renamed ${res.renamedBackRefCount} references in ${res.renamedNoteCount} notes`,
          null,
          {duration: 5000});
    }
  }

  async deleteNote() {
    const result = window.confirm(`Delete ${this.selectedNote.title}?`);
    if (result) {
      await this.storage.deleteNote(this.selectedNote.id);
      this.closeNote();
    }
  }

  revertChangesAndBlur() {
    this.titleRenameInput.nativeElement.value = this.selectedNote.title;
    this.titleRenameInput.nativeElement.blur();
  }

  private openNewFlashcardDialog() {
    const cursor = this.codemirror.getCursor();
    const flashcardSuggestions = this.getAutomaticFlashcardSuggestion(cursor);
    const userSelection = this.codemirror.getSelection();
    if (userSelection) {
      flashcardSuggestions.unshift(userSelection);
    }
    this.dialog.open(FlashcardDialogComponent, {
      position: { top: '10px' },
      data: {
        suggestions: flashcardSuggestions,
        tags: StorageService.getTagsForNoteContent(this.codemirror.getValue()),
        noteTitle: this.selectedNote.title,
      } as FlashcardDialogData,
      width: '100%',
      maxHeight: '90vh' /* to enable scrolling on overflow */,
    });
  }

  closeNote() {
    this.subviewManager.closeView(this.selectedNote.id);
  }

  private async styleMarkdownHeaders() {
    for (const textMarker of this.mdHeaderMarkers) {
      textMarker.clear();
    }
    this.mdHeaderMarkers.clear();
    const cursor = this.codemirror.getSearchCursor(/^[#]+\s/);
    while (cursor.findNext()) {
      // The range here might include some whitespace around the tag but that shouldn't matter.
      // -1 from ch so we don't end up painting the whole
      const end = {line: cursor.to().line, ch: cursor.to().ch - 1};
      const textMarker = this.codemirror.markText(cursor.from(), end, {className: 'md-header-hashtags'});
      this.mdHeaderMarkers.add(textMarker);
    }
  }

  private async styleTags() {
    for (const textMarker of this.tagMarkers) {
      textMarker.clear();
    }
    this.tagMarkers.clear();
    const cursor = this.codemirror.getSearchCursor(TAG_MATCH_REGEX);
    while (cursor.findNext()) {
      const txt = this.codemirror.getRange(cursor.from(), cursor.to()).trim();
      const isIgnored = await this.storage.isTagIgnored(txt);
      if (!isIgnored) {
        // The range here might include some whitespace around the tag but that shouldn't matter.
        const textMarker = this.codemirror.markText(cursor.from(), cursor.to(), {className: 'existing-tag'});
        this.tagMarkers.add(textMarker);
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
    for (const attachment of this.attachedFiles) {
      // TODO: this doesn't support commented markdown links
      const cursor = this.codemirror.getSearchCursor('[' + attachment.name + ']');
      while (cursor.findNext()) {
        const line = cursor.to().line;
        const link = StorageService.fileIdToLink(attachment.fileId);
        newLineNumsAndLinks.add(JSON.stringify([line, link]));
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
      const note = this.storage.getNoteForTitleCaseInsensitive(txt);
      if (!note) {
        const textMarker = this.codemirror.markText(from, to, {className: 'not-existing-note-link'});
        this.noteLinkTextMarkers.add(textMarker);
      } else {
        const textMarker = this.codemirror.markText(from, to, {className: 'existing-note-link'});
      }
    }
  }

  private getAutomaticFlashcardSuggestion(cursor: CodeMirror.Position): string[] {
    const line = this.codemirror.getLine(cursor.line);
    const lineStart = line.slice(0, cursor.ch);
    const lineEnd = line.slice(cursor.ch);
    const suggestions: string[] = [];
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
      suggestions.push(lineStart.slice(startIdx) + lineEnd.slice(0, endIdx));
    }
    return suggestions;
  }
}
