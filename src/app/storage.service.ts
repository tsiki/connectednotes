import {Injectable, Injector} from '@angular/core';
import {BehaviorSubject, combineLatest, Subject} from 'rxjs';
import {GoogleDriveService} from './backends/google-drive.service';
import {
  AttachmentMetadata, Flashcard,
  NoteAndLinks,
  NoteObject, NoteTitleChanged, ParentTagToChildTags,
  RenameResult,
  StorageBackend,
  TagGroup, UserSettings
} from './types';
import {ALL_NOTES_TAG_NAME, JSON_MIMETYPE, TAG_MATCH_REGEX, TEXT_MIMETYPE, UNTAGGED_NOTES_TAG_NAME} from './constants';
import {InMemoryCache} from './backends/in-memory-cache.service';
import {NotificationService} from './notification.service';
import {TestDataService} from './backends/test-data.service';
import assert from 'assert';
import {SubviewManagerService} from './subview-manager.service';

export enum Backend {
  FIREBASE,
  GOOGLE_DRIVE,
  TEST_DATA,
}

@Injectable({
  providedIn: 'root',
})
export class StorageService { // Should be actually something like BackendService or so since this handles ~everything

  notes: BehaviorSubject<NoteObject[]> = new BehaviorSubject([]);
  tagGroups: BehaviorSubject<TagGroup[]> = new BehaviorSubject([]);
  flashcards: BehaviorSubject<Flashcard[]> = new BehaviorSubject([]);
  selectedNotes: BehaviorSubject<NoteObject[]> = new BehaviorSubject([]);
  storedSettings = new BehaviorSubject<UserSettings>(null);
  attachmentMetadata = new BehaviorSubject<AttachmentMetadata>(null);
  nestedTagGroups: BehaviorSubject<ParentTagToChildTags> = new BehaviorSubject({});

  private backendType: Backend;
  private backend?: StorageBackend;
  private backendAvailable = false;
  private noteIdToNote = new Map<string, NoteObject>();
  private noteTitleToNote?: Map<string, NoteObject>;
  private noteTitleToNoteCaseInsensitive?: Map<string, NoteObject>;
  private tagToTagGroup = new Map<string, TagGroup>();
  private notesAwaitedFor: Map<string, (s: NoteObject) => void> = new Map();

  constructor(
      private injector: Injector,
      private cache: InMemoryCache,
      private subviewManager: SubviewManagerService,
      private notifications: NotificationService) {}

  static getTagsForNoteContent(noteContent: string): string[] {
    return noteContent.match(TAG_MATCH_REGEX)
        ?.map(t => t[0] !== '#' ? t.slice(1) : t)
        || [];
  }

  async replaceTags(noteId: string, oldTag: string, newTag: string) {
    const note = this.getNote(noteId);
    assert(oldTag[0] === '#' && newTag[0] === '#');
    const matcher = new RegExp(`(^|\\s)(${oldTag})($|\\s)`);
    const newContent = note.content.replace(matcher, `$1${newTag}$3`);
    await this.saveContent(note.id, newContent);
    this.subviewManager.renameTagInActiveView(noteId, oldTag, newTag);
  }

  static fileIdToLink(fileId: string) {
    return `https://drive.google.com/uc?id=${fileId}`;
  }

  private static deepCopyObject(obj: {}): {} {
    return JSON.parse(JSON.stringify(obj));
  }

  getNote(noteId: string): NoteObject|null {
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

  async isTagIgnored(tag: string) {
    if (this.storedSettings.value) {
      return Promise.resolve(this.storedSettings.value.ignoredTags?.includes(tag));
    }
    return new Promise(async resolve => {
      const settings = await this.storedSettings.toPromise();
      resolve(settings.ignoredTags.includes(tag));
    });
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
    const idx = this.flashcards.value.findIndex(f => f.id === fc.id);
    this.flashcards.value[idx] = fc;
    this.flashcards.next(this.flashcards.value);
    await this.backend.saveContent(fc.id, JSON.stringify(fc), false, JSON_MIMETYPE);
  }

  async deleteFlashcard(id: string) {
    const idx = this.flashcards.value.findIndex(f => f.id === id);
    const newFcs = this.flashcards.value.slice();
    newFcs.splice(idx, 1);
    this.flashcards.next(newFcs);
    await this.backend.deleteFile(id);
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
    this.subviewManager.renameNoteInActiveViews(prevTitle, newTitle);
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
      // Save the note locally before attempting to save it remotely. In case the remote save
      // fails or takes a while we don't want the user to see old content.
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

  async attachUploadedFileToNote(
      noteId: string, uploadedFileId: string, fileName: string, mimeType: string): Promise<string> {
    return await this.backend.addAttachmentToNote(noteId, uploadedFileId, fileName, mimeType);
  }

  async initialize(backendType: Backend) {
    if (backendType === Backend.FIREBASE) {
      // this.backend = this.injector.get(FirebaseService);
    }
    if (backendType === Backend.GOOGLE_DRIVE) {
      this.backend = this.injector.get(GoogleDriveService);
      try {
        await this.backend.initialize();
      } catch (e) {
        this.backendAvailable = false;
        // TODO: offline mode here some day
      }
      this.backendAvailable = true;
    }
    if (backendType === Backend.TEST_DATA) {
      this.backend = this.injector.get(TestDataService);
    }
    this.backendType = backendType;
    this.backend.storedSettings.subscribe(newSettings => this.storedSettings.next(newSettings));
    this.backend.attachmentMetadata.subscribe(newVal => this.attachmentMetadata.next(newVal));
    this.backend.nestedTagGroups.subscribe(newVal => this.nestedTagGroups.next(newVal));
    this.backend.notes.subscribe(newNotes => {
      if (newNotes) {
        this.notes.next(newNotes);
        if (this.notesAwaitedFor.size > 0) {
          for (const note of newNotes) {
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
    combineLatest([this.notes, this.storedSettings, this.nestedTagGroups]).subscribe(
        data => {
      const [notes, settings, nestedTagGroups] = data;
      if (notes && settings && nestedTagGroups) {
        const tagGroups = this.extractTagGroups(notes, settings.ignoredTags || [], nestedTagGroups);
        this.tagToTagGroup = new Map();
        for (const tg of tagGroups) {
          this.tagToTagGroup.set(tg.tag, tg);
        }
        this.tagGroups.next(tagGroups);
      }
    });

    this.notes.next(this.backend.notes.value);
  }

  async changeParentTag(oldParentTag: string, newParentTag: string, childTag: string) {
    const ntg = StorageService.deepCopyObject(this.nestedTagGroups.value);
    if (!ntg[newParentTag]) {
      ntg[newParentTag] = [];
    }
    if (!ntg[newParentTag].includes(childTag)) {
      ntg[newParentTag].push(childTag);
    }
    if (oldParentTag in ntg && ntg[oldParentTag].includes(childTag)) {
      const idx = ntg[oldParentTag].findIndex(childTag);
      ntg[oldParentTag].splice(idx, 1);
    }
    this.backend.saveNestedTagGroups(ntg);
  }

  async updateParentTags(childTag: string, parentTags: string[]) {
    // TODO: what if we weren't connected when initializing and now are?
    //  We would overwrite the whole thing. Overall we need to support offline use cases better.

    // Remove previous parents
    const newNestedTagGroups = {};
    for (const [parent, children] of Object.entries(this.nestedTagGroups.value)) {
      newNestedTagGroups[parent] = children.filter(c => c !== childTag);
    }

    // Add new parents
    for (const parentTag of parentTags) {
      if (!newNestedTagGroups[parentTag]) {
        newNestedTagGroups[parentTag] = [];
      }
      newNestedTagGroups[parentTag].push(childTag);
    }

    this.backend.saveNestedTagGroups(newNestedTagGroups);
  }

  getTagGroupForTag(tag: string): TagGroup {
    return this.tagToTagGroup.get(tag);
  }

  private getAllNotesReferenced(s: string, existingTitles: Set<string>): string[] {
    const ans = [];
    let idx = s.indexOf('[[');
    while (idx !== -1) {
      // Just in case there's something like [[[[[title]]
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

  // DFS to get the newest timestamp for a tag, taking into account its child tags.
  // Performance can be improved with caching if that ever becomes necessary.
  private getNewestNoteChangeTimestamp(
      tag: string,
      tagToNotes: Map<string, Set<string>>,
      nestedTagGroups: ParentTagToChildTags,
      seen = new Set<string>()) {
    if (seen.has(tag)) {
      return 1e15;
    }
    seen.add(tag);
    let newestTs = 1e15;
    for (const noteId of tagToNotes.get(tag)) {
      const lastChanged = this.noteIdToNote.get(noteId).lastChangedEpochMillis;
      newestTs = Math.min(newestTs, lastChanged);
    }
    for (const childTag of (nestedTagGroups[tag] || [])) {
      const tmpBest = this.getNewestNoteChangeTimestamp(childTag, tagToNotes, nestedTagGroups, seen);
      newestTs = Math.min(tmpBest, newestTs);
    }
    return newestTs;
  }

  async updateSettings(settingKey: string, settingValue: string|string[]) {
    const settings = StorageService.deepCopyObject(this.storedSettings.value);
    settings[settingKey] = settingValue;
    try {
      await this.cache.upsertSettingsInCache(settings);
    } catch (e) {
      this.notifications.showFullScreenBlockingMessage(
          'Failed to update settings in local cache. Try saving again.');
    }
    this.storedSettings.next(settings);
    if (this.backendAvailable) {
      try {
        await this.backend.saveSettings(settings);
      } catch (e) {
        this.notifications.showFullScreenBlockingMessage(
            'Failed to update settings. Try saving again.');
      }
    }
  }

  private extractTagGroups(
      notes: NoteObject[], ignoredTags: string[], nestedTagGroups: ParentTagToChildTags): TagGroup[] {
    const tagToNotes = new Map<string, Set<string>>();
    for (const note of notes) {
      let tags = StorageService.getTagsForNoteContent(note.content);
      if (!tags || tags.length === 0) {
        tags = [UNTAGGED_NOTES_TAG_NAME];
      }
      tags.push(ALL_NOTES_TAG_NAME);
      for (const untrimmedTag of tags) {
        const tag = untrimmedTag.trim();
        if (ignoredTags.includes(tag)) {
          continue;
        }
        if (!tagToNotes.has(tag)) {
          tagToNotes.set(tag, new Set<string>());
        }
        tagToNotes.get(tag).add(note.id);
      }
    }
    const ans: TagGroup[] = [];
    for (const [tag, noteIds] of tagToNotes) {
      const newestTs =
          this.getNewestNoteChangeTimestamp(tag, tagToNotes, nestedTagGroups);
      const tagGroup = {
        tag,
        noteIds: Array.from(noteIds),
        newestNoteChangeTimestamp: newestTs,
      };
      ans.push(tagGroup);
    }
    return ans;
  }
}
