import {Injectable, Injector} from '@angular/core';
import {AngularFirestore} from '@angular/fire/firestore';
import {AngularFireAuth} from '@angular/fire/auth';
import {BehaviorSubject, Observable, Subject} from 'rxjs';
import * as firebase from 'firebase/app';
import {AngularFireStorage} from '@angular/fire/storage';
import {UploadTaskSnapshot} from '@angular/fire/storage/interfaces';
import {GoogleDriveService} from './backends/google-drive.service';
import {FirebaseService} from './backends/firebase.service';
import {
  BackendStatusNotification,
  NoteAndLinks,
  NoteObject,
  NotesAndTagGroups,
  RenameResult,
  StorageBackend,
  TagGroup
} from './types';

export enum Backend {
  FIREBASE,
  GOOGLE_DRIVE,
}

@Injectable({
  providedIn: 'root'
})
export class NoteService {

  notes: Subject<NoteObject[]> = new Subject();
  notesAndTagGroups: BehaviorSubject<NotesAndTagGroups> = new BehaviorSubject(null);
  currentNotes: NoteObject[];
  selectedNote: Subject<NoteObject> = new Subject();
  currentSelectedNote: NoteObject;
  backendStatusNotifications: Subject<BackendStatusNotification>;

  private backendType: Backend;
  private backend?: StorageBackend;
  private noteIdToNote?: Map<string, NoteObject>;

  constructor(private injector: Injector) {}

  async initialize(backendType: Backend) {
    if (backendType === Backend.FIREBASE) {
      this.backend = this.injector.get(FirebaseService);
    }
    if (backendType === Backend.GOOGLE_DRIVE) {
      this.backend = this.injector.get(GoogleDriveService);
    }
    this.backendType = backendType;

    this.backend.requestRefreshAllNotes();
    this.notes = this.backend.notes;
    this.backendStatusNotifications = this.backend.backendStatusNotifications;
    this.notes.subscribe(newNotes => {
      this.noteIdToNote = new Map();
      for (const note of newNotes) {
        this.noteIdToNote.set(note.id, note);
      }
      this.currentNotes = newNotes;
      const tagGroups = this.extractTagGroups(newNotes);
      this.notesAndTagGroups.next({tagGroups, notes: newNotes});
    });
  }

  getNote(noteId: string) {
    return this.noteIdToNote.get(noteId);
  }

  logout() {
    this.backend.logout();
  }

  async createNote(title: string): Promise<string> {
    const newNote = await this.backend.createNote(title);
    this.currentNotes.push(newNote);
    this.notes.next(this.currentNotes);
    return newNote.id;
  }

  selectNote(noteId: string) {
    const note = this.currentNotes.find(no => no.id === noteId);
    this.currentSelectedNote = note;
    this.selectedNote.next(note);
  }

  getGraphRepresentation(): NoteAndLinks[] {
    const titleToId = new Map<string, string>();
    for (const note of this.currentNotes) {
      titleToId.set(note.title, note.id);
    }
    const existingTitles = new Set(titleToId.keys());
    const newNotesAndLinks: NoteAndLinks[] = this.currentNotes.map(note => ({
      lastChanged: note.lastChangedEpochMillis,
      noteTitle: note.title,
      connectedTo: this.getAllNotesReferenced(note.content, existingTitles)
    }));
    return newNotesAndLinks;
  }

  async renameNote(noteId: string, newTitle: string): Promise<RenameResult> {
    const noteToRename = this.currentNotes.find(n => n.id === noteId);
    const prevTitle = noteToRename.title;
    const currentNotesAndLinks = this.getGraphRepresentation();
    await this.backend.renameNote(noteId, newTitle);
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
    for (const note of this.currentNotes) {
      if (backRefs.has(note.title)) {
        renamedNoteCount++;
        const tmp = note.content.split('[[' + prevTitle + ']]');
        renamedBackRefCount += tmp.length - 1;
        promises.push(this.saveContent(note.id, tmp.join('[[' + newTitle + ']]'), false));
      }
    }
    this.notes.next(this.currentNotes);
    return {renamedNoteCount, renamedBackRefCount, status: Promise.all(promises)};
  }

  async deleteNote(noteId: string) {
    this.backend.deleteNote(noteId);
    this.currentNotes = this.currentNotes.filter(n => n.id !== noteId);
    this.notes.next(this.currentNotes);
  }

  async saveContent(noteId: string, content: string, notify = true) {
    // TODO: handle save failing
    const noteExists = !!this.currentNotes.find(n => n.id === noteId); // Might not exist if we just deleted it
    if (noteExists) {
      await this.backend.saveContent(noteId, content, notify);
      const note = this.currentNotes.find(n => n.id === noteId);
      note.content = content;
      if (notify) {
        this.notes.next(this.currentNotes);
      }
    }
    return null;
  }

  async saveImage(img: any, fileType: string, fileName: string): Promise<string> {
    return this.backend.saveImage(img, fileType, fileName);
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
    for (const note of notes) {
      const tags = note.content.match(/(^|\W)(#\S+)/ig) || [];
      for (const untrimmedTag of tags) {
        const tag = untrimmedTag.trim();
        if (!tagToNotes.has(tag)) {
          tagToNotes.set(tag, new Set<string>());
        }
        tagToNotes.get(tag).add(note.id);
      }
    }

    const ans = [];
    for (const [tag, noteIds] of tagToNotes) {
      ans.push({tag, noteIds: Array.from(noteIds)});
    }
    return ans;
  }
}
