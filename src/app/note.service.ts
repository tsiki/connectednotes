import {Injectable, Injector} from '@angular/core';
import {BehaviorSubject, combineLatest} from 'rxjs';
import {GoogleDriveService} from './backends/google-drive.service';
import {
  AttachmentMetadata, Flashcard,
  NoteAndLinks,
  NoteObject,
  RenameResult,
  StorageBackend,
  TagGroup, UserSettings
} from './types';
import {Router} from '@angular/router';
import {JSON_MIMETYPE, TEXT_MIMETYPE} from './constants';

export enum Backend {
  FIREBASE,
  GOOGLE_DRIVE,
}

@Injectable({
  providedIn: 'root',
})
export class NoteService {

  notes: BehaviorSubject<NoteObject[]> = new BehaviorSubject([]);
  tagGroups: BehaviorSubject<TagGroup[]> = new BehaviorSubject([]);
  flashcards: BehaviorSubject<Flashcard[]> = new BehaviorSubject(null);
  selectedNotes: BehaviorSubject<NoteObject[]> = new BehaviorSubject([]);
  storedSettings = new BehaviorSubject<UserSettings>(null);
  attachmentMetadata = new BehaviorSubject<AttachmentMetadata>(null);

  private backendType: Backend;
  private backend?: StorageBackend;
  private noteIdToNote?: Map<string, NoteObject>;
  private noteTitleToNote?: Map<string, NoteObject>;
  private noteTitleToNoteCaseInsensitive?: Map<string, NoteObject>;
  private tags = new Set<string>();
  private notesAwaitedFor: Map<string, (s: NoteObject) => void> = new Map();

  constructor(private injector: Injector) {}

  static getTagsForNoteContent(noteContent: string): string[] {
    return noteContent.match(/(^|\W)(#((?![#])[\S])+)/ig);
  }

  static fileIdToLink(fileId: string) {
    return `https://drive.google.com/uc?id=${fileId}`;
  }

  async initialize(backendType: Backend) {
    if (backendType === Backend.FIREBASE) {
      // this.backend = this.injector.get(FirebaseService);
    }
    if (backendType === Backend.GOOGLE_DRIVE) {
      this.backend = this.injector.get(GoogleDriveService);
      this.backend.initialize();
    }
    this.backendType = backendType;
    this.backend.storedSettings.subscribe(newSettings => this.storedSettings.next(newSettings));
    this.backend.attachmentMetadata.subscribe(newVal => this.attachmentMetadata.next(newVal));
    this.backend.notes.subscribe(newNotes => {
      if (newNotes) {
        this.notes.next(newNotes);
        if (this.notesAwaitedFor.size > 0) {
          for (const note of newNotes) { // TODO: maybe only send updates of new notes?
            if (this.notesAwaitedFor.has(note.id)) {
              this.notesAwaitedFor.get(note.id)(note);
              this.notesAwaitedFor.delete(note.id);
            }
          }
        }
      }
    });
    this.backend.flashcards.subscribe(fcs => {
      if (fcs) {
        this.flashcards.next(fcs);
      }
    });
    this.notes.subscribe(newNotes => {
      this.noteIdToNote = new Map();
      this.noteTitleToNote = new Map();
      this.noteTitleToNoteCaseInsensitive = new Map();
      for (const note of newNotes) {
        this.noteIdToNote.set(note.id, note);
        this.noteTitleToNote.set(note.title, note);
        this.noteTitleToNoteCaseInsensitive.set(note.title.toLowerCase(), note);
      }
    });

    // Set up processing of tags when we have fetched ignored tags from settings and notes
    combineLatest([this.notes, this.storedSettings]).subscribe(notesAndSettings => {
      const [notes, settings] = notesAndSettings;
      if (notes && settings) {
        this.tagGroups.next(NoteService.extractTagGroups(notes, settings.ignoredTags || []));
        this.tags = new Set(this.tagGroups.value.map(t => t.tag));
      }
    });

    this.notes.next(this.backend.notes.value);
  }

  getNote(noteId: string) {
    return this.noteIdToNote.get(noteId);
  }

  getNoteWhenReady(noteId: string): Promise<NoteObject> {
    if (this.noteIdToNote.has(noteId)) {
      return Promise.resolve(this.noteIdToNote.get(noteId));
    }
    return new Promise((resolve) => this.notesAwaitedFor.set(noteId, resolve));
  }

  getNoteForTitleCaseInsensitive(title: string) {
    return this.noteTitleToNoteCaseInsensitive.get(title.toLowerCase());
  }

  tagExists(tag: string) {
    return this.tags?.has(tag);
  }

  logout() {
    this.backend.logout();
  }

  async createNote(title: string): Promise<string> {
    const newNoteFile = await this.backend.createNote(title);
    const newNote = Object.assign({content: ''}, newNoteFile);
    this.noteIdToNote.set(newNoteFile.id, newNote);
    const allNotes = this.notes.value;
    allNotes.push(newNote);
    this.notes.next(allNotes);
    return newNoteFile.id;
  }

  async createFlashcard(fc: Flashcard): Promise<Flashcard> {
    const fileMetadata = await this.backend.createFlashcard(fc);
    return Object.assign({
      id: fileMetadata.id,
      lastChangedEpochMillis: fileMetadata.lastChangedEpochMillis,
    }, fc);
  }

  async saveFlashcard(fc: Flashcard) {
    await this.backend.saveContent(fc.id, JSON.stringify(fc), false, JSON_MIMETYPE);
  }

  getBackreferences(noteId: string) {
    const noteTitle = this.notes.value.find(n => n.id === noteId).title;
    const backrefTitles = this.getGraphRepresentation()
        .filter(noteAndLinks => noteAndLinks.connectedTo.includes(noteTitle))
        .map(noteAndLinks => noteAndLinks.noteTitle);
    const backrefTitleSet = new Set(backrefTitles);
    return this.notes.value.filter(n => backrefTitleSet.has(n.title));
  }

  getGraphRepresentation(): NoteAndLinks[] {
    const titleToId = new Map<string, string>();
    for (const note of this.notes.value) {
      titleToId.set(note.title, note.id);
    }
    const existingTitles = new Set(titleToId.keys());
    const newNotesAndLinks: NoteAndLinks[] = this.notes.value.map(note => ({
      lastChanged: note.lastChangedEpochMillis,
      noteTitle: note.title,
      connectedTo: this.getAllNotesReferenced(note.content, existingTitles)
    }));
    return newNotesAndLinks;
  }

  async renameNote(noteId: string, newTitle: string): Promise<RenameResult> {
    const noteToRename = this.noteIdToNote.get(noteId);
    const prevTitle = noteToRename.title;
    const currentNotesAndLinks = this.getGraphRepresentation();
    await this.backend.renameFile(noteId, newTitle);
    noteToRename.title = newTitle;

    // Rename backreferences
    const backRefs =
      new Set(
        currentNotesAndLinks
          .filter(noteAndLink => !!noteAndLink.connectedTo.find(n => n === prevTitle))
          .map(noteAndLinks => noteAndLinks.noteTitle));
    const promises = [];
    let renamedBackRefCount = 0;
    let renamedNoteCount = 0;
    for (const note of this.notes.value) {
      if (backRefs.has(note.title)) {
        renamedNoteCount++;
        const tmp = note.content.split('[[' + prevTitle + ']]');
        renamedBackRefCount += tmp.length - 1;
        promises.push(this.saveContent(note.id, tmp.join('[[' + newTitle + ']]'), false));
      }
    }
    this.notes.next(this.notes.value);
    return {renamedNoteCount, renamedBackRefCount, status: Promise.all(promises)};
  }

  async deleteNote(noteId: string) {
    await this.backend.deleteFile(noteId);
    const newSelectedNotes = this.selectedNotes.value.filter(n => n.id !== noteId);
    const allNotes = this.notes.value.filter(n => n.id !== noteId);
    this.notes.next(allNotes);
    this.selectedNotes.next(newSelectedNotes);
  }

  async deleteAttachment(noteId: string, fileId: string) {
    await this.backend.removeAttachmentFromNote(noteId, fileId);
    this.backend.deleteFile(fileId);
  }

  async saveContent(noteId: string, content: string, notify = true) {
    // TODO: handle save failing
    const noteExists = this.noteIdToNote.has(noteId); // Might not exist if we just deleted it
    if (noteExists) {
      // Save the note locally before attempting to save it remotely. In case the remote save fails or takes a while
      // we don't want the user to see old content.
      const note = this.noteIdToNote.get(noteId);
      note.content = content;
      note.lastChangedEpochMillis = new Date().getTime();
      await this.backend.saveContent(noteId, content, notify, TEXT_MIMETYPE);
      if (notify) {
        this.notes.next(this.notes.value);
      }
    }
  }

  async uploadFile(content: any, fileType: string, fileName: string): Promise<string> {
    return this.backend.uploadFile(content, fileType, fileName);
  }

  async attachUploadedFileToNote(noteId: string, uploadedFileId: string, fileName: string, mimeType: string): Promise<string> {
    return await this.backend.addAttachmentToNote(noteId, uploadedFileId, fileName, mimeType);
  }

  async updateSettings(settingKey: string, settingValue: string|string[]) {
    this.backend.updateSettings(settingKey, settingValue);
  }

  private getAllNotesReferenced(s: string, existingTitles: Set<string>): string[] {
    const ans = [];
    let idx = s.indexOf('[[');
    while (idx !== -1) {
      // Just in case there's something like [[[title]] (note 3 times '[')
      while (s.length > idx + 1 && s[idx] === '[' && s[idx + 1] === '[') {
        idx++;
      }
      const endIdx = s.indexOf(']]', idx);
      const ref = s.slice(idx + 1, endIdx);
      if (existingTitles.has(ref)) {
        ans.push(s.slice(idx + 1, endIdx));
      }
      idx = s.indexOf('[[', endIdx);
    }
    return ans;
  }

  private static extractTagGroups(notes: NoteObject[], ignoredTags: string[]): TagGroup[] {
    const tagToNotes = new Map<string, Set<string>>();
    const tagToNewestTimestamp = new Map<string, number>();
    const tagToOldestTimestamp = new Map<string, number>();
    for (const note of notes) {
      let tags = this.getTagsForNoteContent(note.content);
      if (!tags || tags.length === 0) {
        tags = ['untagged'];
      }
      tags.push('all');
      for (const untrimmedTag of tags) {
        const tag = untrimmedTag.trim();
        if (ignoredTags.includes(tag)) {
          continue;
        }
        if (!tagToNotes.has(tag)) {
          tagToNotes.set(tag, new Set<string>());
          tagToNewestTimestamp.set(tag, 0);
          tagToOldestTimestamp.set(tag, 1e15);
        }
        tagToNewestTimestamp.set(tag, Math.max(tagToNewestTimestamp.get(tag), note.lastChangedEpochMillis));
        tagToOldestTimestamp.set(tag, Math.min(tagToNewestTimestamp.get(tag), note.lastChangedEpochMillis));
        tagToNotes.get(tag).add(note.id);
      }
    }
    const ans: TagGroup[] = [];
    for (const [tag, noteIds] of tagToNotes) {
      const tagGroup = {
        tag,
        noteIds: Array.from(noteIds),
        newestTimestamp: tagToNewestTimestamp.get(tag),
        oldestTimestamp: tagToOldestTimestamp.get(tag),
      };
      ans.push(tagGroup);
    }
    return ans;
  }
}
