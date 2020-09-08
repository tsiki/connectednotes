import {Injectable, Injector} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {GoogleDriveService} from './backends/google-drive.service';
import {
  AttachmentMetadata,
  NoteAndLinks,
  NoteObject,
  NotesAndTagGroups,
  RenameResult,
  StorageBackend,
  TagGroup, UserSettings
} from './types';
import {Router} from '@angular/router';

export enum Backend {
  FIREBASE,
  GOOGLE_DRIVE,
}

@Injectable({
  providedIn: 'root',
})
export class NoteService {

  notes: BehaviorSubject<NoteObject[]> = new BehaviorSubject(null);
  notesAndTagGroups: BehaviorSubject<NotesAndTagGroups> = new BehaviorSubject(null);
  selectedNote: BehaviorSubject<NoteObject> = new BehaviorSubject(null);
  storedSettings = new BehaviorSubject<UserSettings>(null);
  attachmentMetadata = new BehaviorSubject<AttachmentMetadata>(null);

  private backendType: Backend;
  private backend?: StorageBackend;
  private noteIdToNote?: Map<string, NoteObject>;

  constructor(private injector: Injector, private router: Router) {}

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
      }
    });
    this.notes.subscribe(newNotes => {
      this.noteIdToNote = new Map();
      for (const note of newNotes) {
        this.noteIdToNote.set(note.id, note);
      }
      const tagGroups = this.extractTagGroups(newNotes);
      this.notesAndTagGroups.next({tagGroups, notes: newNotes});
    });
    this.notes.next(this.backend.notes.value);
    this.backend.requestRefreshAllNotes();
  }

  getNote(noteId: string) {
    return this.noteIdToNote.get(noteId);
  }

  logout() {
    this.backend.logout();
  }

  async createNote(title: string): Promise<string> {
    const newNote = await this.backend.createNote(title);
    const allNotes = this.notes.value;
    allNotes.push(newNote);
    this.notes.next(allNotes);
    return newNote.id;
  }

  selectNote(noteId: string|null, updateUrl = true) {
    // TODO: if notes aren't loaded yet we might not be able to load anything (eg. if noteid is defined in query param)
    const note = this.notes.value.find(no => no.id === noteId) || null;
    if (updateUrl) {
      this.router.navigate(
          [],
          {
            queryParams: { noteid: note.id },
          });
    }
    this.selectedNote.next(note);
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
    const noteToRename = this.notes.value.find(n => n.id === noteId);
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
    if (this.selectedNote.value.id === noteId) {
      this.selectedNote.next(null);
    }
    const allNotes = this.notes.value.filter(n => n.id !== noteId);
    this.notes.next(allNotes);
  }

  async deleteAttachment(noteId: string, fileId: string) {
    await this.backend.removeAttachmentFromNote(noteId, fileId);
    this.backend.deleteFile(fileId);
  }

  async saveContent(noteId: string, content: string, notify = true) {
    // TODO: handle save failing
    const noteExists = !!this.notes.value.find(n => n.id === noteId); // Might not exist if we just deleted it
    if (noteExists) {
      // Save the note locally before attempting to save it remotely. In case the remote save fails or takes a while
      // we don't want the user to see old content.
      const note = this.notes.value.find(n => n.id === noteId);
      note.content = content;
      note.lastChangedEpochMillis = new Date().getTime();
      await this.backend.saveContent(noteId, content, notify);
      if (notify) {
        this.notes.next(this.notes.value);
      }
    }
    return null;
  }

  async uploadFile(content: any, fileType: string, fileName: string): Promise<string> {
    return this.backend.uploadFile(content, fileType, fileName);
  }

  async attachUploadedFileToNote(noteId: string, uploadedFileId: string, fileName: string, mimeType: string): Promise<string> {
    return await this.backend.addAttachmentToNote(noteId, uploadedFileId, fileName, mimeType);
  }

  async updateSettings(settingKey: string, settingValue: string) {
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

  private extractTagGroups(notes: NoteObject[]): TagGroup[] {
    const tagToNotes = new Map<string, Set<string>>();
    const tagToNewestTimestamp = new Map<string, number>();
    const tagToOldestTimestamp = new Map<string, number>();
    for (const note of notes) {
      let tags = note.content.match(/(^|\W)(#((?![#])[\S])+)/ig) || [];
      if (tags.length === 0) {
        tags = ['untagged'];
      }
      tags.push('all');
      for (const untrimmedTag of tags) {
        const tag = untrimmedTag.trim();
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
