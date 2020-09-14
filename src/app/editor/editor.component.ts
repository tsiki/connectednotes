import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  OnDestroy,
  OnInit,
  Output,
  ViewChild
} from '@angular/core';
import 'codemirror/addon/hint/show-hint';
import 'codemirror/addon/search/searchcursor';
import * as CodeMirror from 'codemirror';
import {NoteService} from '../note.service';
import {fromEvent} from 'rxjs';
import {debounceTime} from 'rxjs/operators';
import {AttachedFile, NoteObject} from '../types';
import {SettingsService, Theme} from '../settings.service';
import {NotificationService} from '../notification.service';
import * as marked from 'marked';
import {MatDialog} from '@angular/material/dialog';
import {AttachmentsDialogComponent} from '../attachments-dialog/attachments-dialog.component';
import {MatSnackBar} from '@angular/material/snack-bar';
import {BackreferencesDialogComponent} from '../backreferences-dialog/backreferences-dialog.component';
import {ValidateImmediatelyMatcher} from '../already-existing-note.directive';

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
  @ViewChild('markdown') markdown: ElementRef;
  @ViewChild('titleRenameInput', { read: ElementRef }) titleRenameInput: ElementRef;
  @Output() contentChange = new EventEmitter();

  noteTitle: string;
  editorState: 'editor'|'split' = 'editor';
  attachedFiles: AttachedFile[]|null = null;
  selectedNote: NoteObject|null = null;
  noteDeleted = false;
  matcher = new ValidateImmediatelyMatcher();

  private codemirror: CodeMirror.EditorFromTextArea;
  private previousChar: string;
  private allNoteTitles: string[];
  private allTags: string[];
  private mouseEventWithCtrlActive = false;
  private inlinedImages: Map<string, CodeMirror.LineWidget> = new Map();

  private unloadListener = () => this.saveChanges();

  constructor(
      public dialog: MatDialog,
      private readonly noteService: NoteService,
      private readonly settingsService: SettingsService,
      private readonly notifications: NotificationService,
      private snackBar: MatSnackBar) {
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
    this.allNoteTitles = this.noteService?.notes.value?.map(n => n.title);
    this.noteService.notesAndTagGroups.subscribe(val => this.allTags = val.tagGroups.map(t => t.tag));

    this.noteService.selectedNote.subscribe(newSelectedNote => {
      if (newSelectedNote === null) {
        this.selectedNote = null;
        this.codemirror?.setValue('');
        return;
      }
      // Save changes for previous
      if (this.selectedNote !== null) {
        this.saveChanges();
      }
      this.selectedNote = newSelectedNote;

      if (this.noteService.attachmentMetadata.value) {
        this.attachedFiles = this.noteService.attachmentMetadata.value[this.selectedNote.id];
        this.inlineImages();
      }

      this.codemirror.setValue(newSelectedNote.content);
      this.codemirror.focus();
      this.codemirror.setCursor(0, 0);
    });

    this.noteService.attachmentMetadata.subscribe(metadata => {
      if (this.selectedNote && metadata && metadata.hasOwnProperty(this.selectedNote.id)) {
        this.attachedFiles = metadata[this.selectedNote.id];
        this.inlineImages();
      }
    });

    this.noteService.notes.subscribe(newNotes => {
      this.allNoteTitles = newNotes.map(note => note.title);
    });

    window.addEventListener('beforeunload', this.unloadListener);
  }

  inlineImages() {
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
        imgElem.src = link;
        // If we don't refresh CM after loading it seems codemirror 'misplaces' lines and thinks there's text in empty
        // areas and vice versa
        imgElem.onload = () => this.codemirror.refresh();
        const lineWidget = this.codemirror.addLineWidget(line, imgElem);
        this.inlinedImages.set(newLineAndLink, lineWidget);
      }
    }
  }

  ngAfterViewInit(): void {
    this.initializeCodeMirror();
    if (this.selectedNote) { // Might not be initialized at first
      // TODO: we need to show something like 'no notes selected/created' or something
      this.codemirror.setValue(this.selectedNote.content);
    }

    this.contentChange.pipe(debounceTime(100)).subscribe(newContent => {
      if (this.editorState === 'split') {
        // Currently not sanitizing html since you need to be logged into see anything and nothing's shareable
        // Maybe one day when we enable shared notes this needs to be fixed
        this.markdown.nativeElement.innerHTML = (marked as any)(newContent);
      }
    });
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
      {
        mode: 'markdown',
        lineWrapping: true,
        extraKeys: {'Shift-Space': 'autocomplete'},
        theme,
      });
    // this.codemirror.setSize('400px', '1000px'); // keep this here for performance testing codemirror resizing
    this.codemirror.setSize('100%', '100%');

    // Set up notification of unsaved changes
    fromEvent(this.codemirror, 'changes')
        .pipe(debounceTime(100))
        .subscribe(([cm, changes]) => {
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
          const note = this.noteService.notes.value.find(n => n.title === noteTitle);
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

    // Inline images
    this.contentChange.pipe(debounceTime(100)).subscribe(e => this.inlineImages());
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
    // If user adds and then deleted the addition, remove the 'unsaved' marker
    if (this.selectedNote.content === valueToSave) {
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
        const content = this.getContent();
        this.markdown.nativeElement.innerHTML = (marked as any)(content);
      });
    } else {
      this.editorState = 'editor';
    }
  }

  getContent() {
    return this.codemirror.getValue();
  }

  @HostListener('drop', ['$event'])
  async evtDrop(e: DragEvent) {
    const files = e.dataTransfer.files;
    if (files.length !== 1) {
      throw new Error(`Was expecting 1 file. Got ${files.length}.`);
    }
    const file = files[0];
    const name = file.name;
    const notificationId = new Date().getTime().toString();
    this.notifications.toSidebar(notificationId, 'Uploading file');
    const fileId = await this.noteService.uploadFile(file, file.type, file.name);
    await this.noteService.attachUploadedFileToNote(
        this.noteService?.selectedNote.value.id, fileId, file.name, file.type);
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
      this.noteDeleted = true;
    }
  }
}
