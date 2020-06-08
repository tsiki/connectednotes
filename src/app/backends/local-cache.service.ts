import { Injectable } from '@angular/core';
import {NoteObject} from '../types';

@Injectable({
  providedIn: 'root'
})
export class LocalCacheService {

  private db;
  private initPromise: Promise<any>;

  constructor() {
    this.initializeIndexedDb();
  }

  private initializeIndexedDb() {
    const openRequest = indexedDB.open('ConnectedNotes');
    this.initPromise = new Promise((resolve, reject) => {
      openRequest.onupgradeneeded = (e) => {
        this.db = openRequest.result;
        if (!this.db.objectStoreNames.contains('notes')) {
          this.db.createObjectStore('notes', {keyPath: 'id'});
        }
        resolve();
      };
      openRequest.onsuccess = (e) => {
        this.db = openRequest.result;
        resolve();
      };
      openRequest.onerror = (e) => {
        reject();
      };
    });
  }

  // TODO: figure out how to update the cache smoothly in case NoteObject structure changes
  //  maybe just run indexedDB.deleteDatabase("ConnectedNotes") or change objectStore name?
  async addOrUpdateNoteInCache(noteId: string, lastChangedEpochMillis: number, title: string, content: string) {
    if (!this.db) {
      await this.initPromise;
    }
    const transaction = this.db.transaction('notes', 'readwrite');
    const notes = transaction.objectStore('notes');
    const newNote: NoteObject = {
      id: noteId,
      lastChangedEpochMillis,
      title,
      content,
    };

    const putReq = notes.put(newNote);
    return new Promise((resolve, reject) => {
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject();
    });
  }

  // TODO: the caching logic needs some tests
  async deleteFromCache(noteId: string) {
    if (!this.db) {
      await this.initPromise;
    }
    const transaction = this.db.transaction('notes', 'readwrite');
    const notes = transaction.objectStore('notes');
    notes.delete(noteId);
  }

  async getAllNoteIdToLastChangedInCache(): Promise<Map<string, number>> {
    if (!this.db) {
      await this.initPromise;
    }
    const notes = await this.getAllNotesInCache();
    const noteIdToLastChanged = new Map<string, number>();
    for (const {id, lastChangedEpochMillis} of notes) {
      noteIdToLastChanged.set(id, lastChangedEpochMillis);
    }
    return noteIdToLastChanged;
  }

  async getAllNotesInCache(): Promise<NoteObject[]> {
    if (!this.db) {
      await this.initPromise;
    }
    const transaction = this.db.transaction('notes', 'readwrite');
    const notes = transaction.objectStore('notes');
    const req = notes.getAll();
    return new Promise((resolve, reject) => {
      req.onsuccess = (e) => {
        resolve(req.result);
      };
      req.onerror = (e) => {
        resolve([]);
      };
    });
  }
}
