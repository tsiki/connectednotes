import { Injectable } from '@angular/core';
import {BehaviorSubject, Subject} from 'rxjs';
import {BackendStatusNotification, NoteFile, NoteObject, StorageBackend, UserSettings} from '../types';
import {AngularFireAuth} from '@angular/fire/auth';
import {AngularFirestore, DocumentReference} from '@angular/fire/firestore';
import {AngularFireStorage} from '@angular/fire/storage';
import {UploadTaskSnapshot} from '@angular/fire/storage/interfaces';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {

  user?: string;
  notes: Subject<NoteObject[]> = new Subject();

  // Not used TODO: should we just delete this backend for now
  backendStatusNotifications: Subject<BackendStatusNotification> = new Subject();

  constructor(private fireAuth: AngularFireAuth,
              private readonly firestore: AngularFirestore,
              private storage: AngularFireStorage) {
    this.fireAuth.user.subscribe(newUser => {
      if (!newUser) {
        this.user = null;
        return;
      }
      if (newUser.uid && newUser.uid !== this.user) {
        this.user = newUser.uid;
        this.requestRefreshAllNotes();
      }
    });
  }

  async updateSettings(settingsKey, settingsValue) {
    // Do nothing - should we get rid of firebase backend?
  }

  // Might not immediately refresh all notes if the user is undefined
  async requestRefreshAllNotes() {
    if (!this.user) {
      return;
    }
    this.firestore.collection<NoteObject>(`users/${this.user}/notes`)
      .get()
      .subscribe(snapshot => {
        const notes = snapshot.docs.map(ss => {
          const noteFile = ss.data() as NoteFile;
          const note: NoteObject = {
            id: ss.id,
            title: noteFile.title,
            content: noteFile.content,
            lastChangedEpochMillis: noteFile.lastChangedEpochMillis,
          };
          return note;
        }) as NoteObject[];
        this.notes.next(notes);
      });
  }

  async createNote(title: string): Promise<NoteObject> {
    // TODO: get the timestamp by using firebase.firestore.FieldValue.serverTimestamp()
    const lastChangedEpochMillis = new Date().getTime();
    const newNote = { title, content: '', lastChangedEpochMillis };
    const docRef: DocumentReference = await this.firestore.collection(`users/${this.user}/notes`).add(newNote);
    return {id: docRef.id, title, content: '', lastChangedEpochMillis };
  }

  renameNote(noteId: string, newTitle: string): Promise<void> {
    return this.firestore.collection(`users/${this.user}/notes`).doc(noteId).update({title: newTitle});
  }

  async deleteNote(noteId: string): Promise<void> {
    return this.firestore.collection(`users/${this.user}/notes`).doc(noteId).delete();
  }

  saveContent(noteId: string, content: string): Promise<void> {
    // TODO: handle save failing
    return this.firestore.collection(`users/${this.user}/notes`).doc(noteId).update({content});
  }

  async saveImage(img: any, unusedFileType: string, fileName: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
      // TODO: how do we know this is an image?
      if (fileName.length > 0) {
        const ref = this.storage.ref(`/users/${this.user}/images/${fileName}`);
        const task: UploadTaskSnapshot = await ref.put(img);
        ref.getDownloadURL().subscribe(downloadLink => resolve(downloadLink));
      }
      reject(null);
    });
  }

  logout() {
    this.fireAuth.signOut();
  }
}
