import { Injectable } from '@angular/core';
import {BehaviorSubject, combineLatest} from 'rxjs';
import {environment} from '../../environments/environment';
import {HttpClient} from '@angular/common/http';
import {
  AttachedFile,
  AttachmentMetadata,
  FileMetadata, Flashcard,
  NoteObject, ParentTagToChildTags,
  StorageBackend,
  UserSettings
} from '../types';
import {InMemoryCache} from './in-memory-cache.service';
import {NotificationService} from '../notification.service';
import {JSON_MIMETYPE, TEXT_MIMETYPE} from '../constants';
import {AnalyticsService} from '../analytics.service';

const ROOT_FOLDER_NAME = 'Connected Notes';
const NOTES_FOLDER_NAME = 'Notes';
const SETTINGS_AND_METADATA_FOLDER_NAME = 'Settings and Metadata';
const ATTACHMENTS_FOLDER_NAME = 'Attachments';
const FLASHCARDS_FOLDER_NAME = 'Flashcards';
const SETTINGS_FILE_NAME = 'settings.json';
const ATTACHMENT_METADATA_FILE_NAME = 'attachment_metadata.json';
const NESTED_TAG_GROUPS_FILE_NAME = 'nested_tag_groups.json';

enum ItemType {
  NOTE,
  FLASHCARD,
}

declare interface WindowWithGapi extends Window {
  gapi: object;
}

declare var window: WindowWithGapi;
declare var gapi: any;


@Injectable({
  providedIn: 'root'
})
export class GoogleDriveService implements StorageBackend {

  notes = new BehaviorSubject<NoteObject[]>([]);
  flashcards = new BehaviorSubject<Flashcard[]>([]);
  storedSettings = new BehaviorSubject<UserSettings>(null);
  attachmentMetadata = new BehaviorSubject<AttachmentMetadata>(null);
  nestedTagGroups = new BehaviorSubject<ParentTagToChildTags>({});

  private rootFolderId = new BehaviorSubject<string>(null);
  private notesFolderId = new BehaviorSubject<string>(null);
  private settingAndMetadataFolderId = new BehaviorSubject<string>(null);
  private attachmentsFolderId = new BehaviorSubject<string>(null);
  private flashcardsFolderId = new BehaviorSubject<string>(null);
  // Not observable since we assume any settings/attachment/nested group update is done with delay
  private storedSettingsFileId: string;
  private attachmentMetadataFileId: string;
  private nestedTagGroupsFileId: string;
  private initialized = false;

  constructor(
      private http: HttpClient,
      private cache: InMemoryCache,
      private notifications: NotificationService,
      private analytics: AnalyticsService) {}


  async shouldUseThisBackend(): Promise<boolean> {
    try {
      await this.loadScript();
      const isSignedIn = await this.isSignedIn();
      this.analytics.recordEvent('Google Drive backend loaded', {isSignedIn});
      return isSignedIn;
    } catch (e) {
      this.analytics.recordEvent('Failed to load Google Drive backend', { error: e?.message });
      return Promise.resolve(false);
    }
  }

  // Fetch/create all folders, notes and flashcards
  async initialize() {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    try {
      await this.loadScript();
      await this.signInIfNotSignedIn();
      await this.fetchOrCreateFoldersAndFiles();
    } catch (e) {
      this.initialized = false;
      this.notifications.showFullScreenBlockingMessage(`Couldn't initialize backend: ${e?.message}`);
      this.analytics.recordEvent(`Initialization failure: ${e.message}`);
      return;
    }
    this.analytics.recordEvent('Google Drive backend initialized successfully');
    combineLatest([this.notesFolderId, this.flashcardsFolderId]).subscribe(async data => {
      const [notesFolderId, fcFolderId] = data;
      // Settings, attachment data etc. is initialized in fetchOrCreateFoldersAndFiles()
      if (notesFolderId && fcFolderId) {
        const promise = Promise.all([this.refreshAllNotes(), this.refreshAllFlashcards()]);
        await promise;
      }
    });
  }

  async initiateSignIn() {
    await gapi.auth2.getAuthInstance().signIn();
  }

  logout() {
    gapi.auth2.getAuthInstance().signOut();
  }

  async saveNestedTagGroups(nestedTagGroups: ParentTagToChildTags) {
    this.nestedTagGroups.next(nestedTagGroups);
    await this.saveContent(
        this.nestedTagGroupsFileId, JSON.stringify(this.nestedTagGroups.value), true, JSON_MIMETYPE);
  }

  async saveSettings(settings: UserSettings) {
    await this.saveContent(this.storedSettingsFileId, JSON.stringify(settings), true, JSON_MIMETYPE);
  }

  private loadScript() {
    return new Promise((resolve, reject) => {
      if (window.gapi) {
        resolve();
      }
      const scriptElem = document.createElement('script');
      scriptElem.src = 'https://apis.google.com/js/api.js';
      scriptElem.type = 'text/javascript';
      scriptElem.onload = () => resolve();
      scriptElem.onerror = () => reject();
      document.querySelector('head').appendChild(scriptElem);
    });
  }

  async signInIfNotSignedIn() {
    await this.loadAndInitGapiAuth();
    await this.signIn();
  }

  private async isSignedIn(): Promise<boolean> {
    await new Promise(resolve => gapi.load('client:auth2', () => resolve()));
    await gapi.client.init({
      apiKey: environment.googleDrive.gdriveApiKey,
      clientId: environment.googleDrive.gdriveClientKey,
      discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.install'
    });
    return gapi.auth2.getAuthInstance().isSignedIn.get();
  }

  private async signIn() {
    const isSignedIn = gapi.auth2.getAuthInstance().isSignedIn.get();
    if (!isSignedIn) {
      await this.initiateSignIn();
    }
    // In case the session expires
    gapi.auth2.getAuthInstance().isSignedIn.listen(signedIn => {
      if (signedIn) {
        this.initiateSignIn();
      }
    });
  }

  private async loadAndInitGapiAuth() {
    await new Promise((resolve) => {
      gapi.load('client:auth2', async () => {
        await gapi.client.init({
          apiKey: environment.googleDrive.gdriveApiKey,
          clientId: environment.googleDrive.gdriveClientKey,
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
          scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.install'
        });
        resolve();
      });
    });
  }

  renameFile(fileId: string, newTitle: string) {
    const req = gapi.client.drive.files.update({fileId, name: newTitle});
    return new Promise<void>((resolve, reject) => {
      req.execute(() => resolve());
    });
  }

  deleteFile(fileId: string) {
    const req = gapi.client.drive.files.delete({fileId});
    return new Promise<void>((resolve, reject) => {
      req.execute(() => resolve());
    });
  }

  // TODO NEXT: fetch all flashcards and basically handle them like we handle notes
  private async fetchFileMetadata(mimeType: string, parentFolderId: string): Promise<FileMetadata[]> {
    const fileMetadata: FileMetadata[] = [];
    let pageToken = null;
    do {
      let query = `trashed = false and mimeType='${mimeType}'`;
      if (parentFolderId) {
        query += ` and '${parentFolderId}' in parents`;
      }
      const generateListReqFn = () => gapi.client.drive.files.list({
        q: query,
        pageToken,
        // fields: `*` can be used for debugging, returns all fields
        fields: `nextPageToken, files(id, name, parents, modifiedTime, createdTime)`,
        pageSize: 1000 // 1000 is the max value
      });
      const resp = await this.awaitPromiseWithRetry(generateListReqFn) as any;
      const files = resp.result.files.map(f => ({
        id: f.id,
        title: f.name,
        lastChangedEpochMillis: new Date(f.modifiedTime).getTime(),
        createdEpochMillis: new Date(f.createdTime).getTime(),
      }));
      pageToken = (resp as any).nextPageToken;
      fileMetadata.push(...files);
    } while (pageToken);
    return fileMetadata;
  }

  private async fetchOrCreateFolder(folderName: string, parentFolder?: string) {
    let query = `trashed = false and mimeType='application/vnd.google-apps.folder' and name='${folderName}'`;
    if (parentFolder) {
      query += ` and '${parentFolder}' in parents`;
    }

    const folderListResp = await gapi.client.drive.files.list({
      q: query,
      fields: 'files(id, name)',
    });
    if (folderListResp.result.files.length > 0) {
      const folderId = folderListResp.result.files[0].id;
      return folderId;
    }
    const folderCreationResp = await gapi.client.drive.files.create({
      resource: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentFolder ? [parentFolder] : []
      },
      fields: 'id'
    });
    return folderCreationResp.result.id;
  }

  private async fetchOrCreateFoldersAndFiles() {
    const rootFolderId = await this.fetchOrCreateFolder(ROOT_FOLDER_NAME);
    this.rootFolderId.next(rootFolderId);

    const notes = this.fetchOrCreateFolder(NOTES_FOLDER_NAME, this.rootFolderId.value);
    const settingsAndMetadata = this.fetchOrCreateFolder(SETTINGS_AND_METADATA_FOLDER_NAME, this.rootFolderId.value);
    const attachments = this.fetchOrCreateFolder(ATTACHMENTS_FOLDER_NAME, this.rootFolderId.value);
    const flashcards = this.fetchOrCreateFolder(FLASHCARDS_FOLDER_NAME, this.rootFolderId.value);
    const folders = await Promise.all([notes, settingsAndMetadata, attachments, flashcards]);

    this.notesFolderId.next(folders[0]);
    this.settingAndMetadataFolderId.next(folders[1]);
    this.attachmentsFolderId.next(folders[2]);
    this.flashcardsFolderId.next(folders[3]);

    // After folders, create or fetch files

    const settingsPromise =
        this.fetchOrCreateJsonFile(SETTINGS_FILE_NAME, this.settingAndMetadataFolderId.value);
    const attachmentPromise =
        this.fetchOrCreateJsonFile(ATTACHMENT_METADATA_FILE_NAME, this.settingAndMetadataFolderId.value);
    const nestedTagGroupsPromise =
        this.fetchOrCreateJsonFile(NESTED_TAG_GROUPS_FILE_NAME, this.settingAndMetadataFolderId.value);

    const [settingsData, attachmentData, nestedTagGroupsData] =
        await Promise.all([settingsPromise, attachmentPromise, nestedTagGroupsPromise]);

    const [settingsFileId, settings] = settingsData;
    this.storedSettings.next(settings);
    this.storedSettingsFileId = settingsFileId;

    const [attachmentMetadataFileId, attachmentMetadata] = attachmentData;
    this.attachmentMetadata.next(attachmentMetadata);
    this.attachmentMetadataFileId = attachmentMetadataFileId;

    const [nestedTagGroupsFileId, nestedTagGroups] = nestedTagGroupsData;
    this.nestedTagGroups.next(nestedTagGroups);
    this.nestedTagGroupsFileId = nestedTagGroupsFileId;
  }

  private getToken() {
    return gapi
        .auth2
        .getAuthInstance()
        .currentUser
        .get()
        .getAuthResponse(true)
        .access_token;
  }

  // Delete files from cache if they're not in 'allIds' but are in 'cachedIds'.
  private async removeDeletedIdsFromCache(itemType: ItemType, allIds: string[], cachedIds: IterableIterator<string>) {
    const allIdsSet = new Set(allIds);
    for (const cachedId of cachedIds) {
      if (!allIdsSet.has(cachedId)) {
        if (itemType === ItemType.NOTE) {
          this.cache.deleteNoteFromCache(cachedId);
        } else if (itemType === ItemType.FLASHCARD) {
          this.cache.deleteFlashcardFromCache(cachedId);
        }
      }
    }
  }

  // TODO: is there seriously no way to merge this and refreshAllNotes???
  private async refreshAllFlashcards() {
    const notificationId = this.notifications.createId();
    this.notifications.toSidebar(notificationId.toString(), 'Syncing flashcards...');

    let flashcardMetadata: FileMetadata[];
    try {
      flashcardMetadata = await this.fetchFileMetadata(JSON_MIMETYPE, this.flashcardsFolderId.value);
    } catch (e) {
      this.notifications.toSidebar(
          notificationId,
          'Fetching metadata for flashcards failed. Displaying only cached flashcards.',
          10_000);
      flashcardMetadata = null;
    }

    const cachedIdToLastChanged = await this.cache.getAllFlashcardIdToLastChangedTimestamp();
    this.removeDeletedIdsFromCache(
        ItemType.FLASHCARD,
        flashcardMetadata?.map(n => n.id),
        cachedIdToLastChanged.keys());

    // Then, only consider the flashcards which have newer version on drive
    const flashcardsWithNewerVersion = flashcardMetadata
            ?.filter(n => n.lastChangedEpochMillis > (cachedIdToLastChanged.get(n.id) || 0))
        || [];

    // Get up-to-date cached flashcards
    const cachedFlashcards = await this.cache.getAllFlashcardsInCache();
    const newerFlashcardIds = new Set(flashcardsWithNewerVersion.map(n => n.id));
    const upToDateCachedFlashcards = cachedFlashcards.filter(fc => !newerFlashcardIds.has(fc.id));
    this.flashcards.next(upToDateCachedFlashcards);
    if (flashcardsWithNewerVersion.length === 0) {
      this.notifications.toSidebar(notificationId, 'Syncing flashcards... done', 3000);
    }

    let doneCount = 0;
    let failCount = 0;
    const failNotificationId = this.notifications.createId();

    // Now fetch the content of the flashcards for which we don't have the newest version for.
    const flashcardContentFetchPromises = this.fetchContents(flashcardsWithNewerVersion.map(n => n.id));
    for (let i = 0; i < flashcardsWithNewerVersion.length; i++) {
      const promise = flashcardContentFetchPromises[i];
      const metadata = flashcardsWithNewerVersion[i];
      promise.then(flashcardTxtJson => {
        const updatedFlashcard: Flashcard = Object.assign({
          id: metadata.id,
          lastChangedEpochMillis: metadata.lastChangedEpochMillis,
          createdEpochMillis: metadata.createdEpochMillis,
        }, JSON.parse(flashcardTxtJson));

        this.cache.addOrUpdateFlashcardInCache(metadata.id, updatedFlashcard);
        this.flashcards.value.push(updatedFlashcard);
        this.flashcards.next(this.flashcards.value);
        doneCount++;
        this.notifications.toSidebar(
            notificationId.toString(),
            `Syncing flashcards (${doneCount}/${flashcardsWithNewerVersion.length})`,
            5000);
      }).catch(err => {
        failCount++;
        this.notifications.toSidebar(failNotificationId.toString(),
            `Failed to sync (${failCount}} flashcards - refresh might help?`,
            10_000);
      });
    }
  }

  /**
   * Get all files. TODO: long function is long
   */
  private async refreshAllNotes() {
    const notificationId = this.notifications.createId();
    this.notifications.toSidebar(notificationId.toString(), 'Syncing notes...');

    let noteMetadata;
    try {
      noteMetadata = await this.fetchFileMetadata(TEXT_MIMETYPE, this.notesFolderId.value);
    } catch (e) {
      this.notifications.toSidebar(
          notificationId,
          'Fetching metadata for notes failed. Displaying only cached notes.',
          10_000);
      noteMetadata = null;
    }

    const noteIdToLastChanged = await this.cache.getAllNoteIdToLastChangedTimestamp();
    this.removeDeletedIdsFromCache(
        ItemType.NOTE,
        noteMetadata?.map(n => n.id),
        noteIdToLastChanged.keys());

    // Then, only consider the notes which have newer version on drive
    const notesWithNewerVersion = noteMetadata
        ?.filter(n => n.lastChangedEpochMillis > (noteIdToLastChanged.get(n.id) || 0))
        || [];

    const cachedNotes = await this.cache.getAllNotesInCache();
    const newerNoteIds = new Set(notesWithNewerVersion.map(n => n.id));
    const upToDateCachedNotes = cachedNotes.filter(note => !newerNoteIds.has(note.id));
    this.notes.next(upToDateCachedNotes);
    if (notesWithNewerVersion.length === 0) {
      this.notifications.toSidebar(notificationId, 'Syncing notes... done', 3000);
    }

    let doneCount = 0;
    let failCount = 0;
    const failNotificationId = this.notifications.createId();

    // Now fetch the content of the notes for which we don't have the newest version for.
    // TODO don't wait for all notes to be loaded
    const noteContentFetchPromises = this.fetchContents(notesWithNewerVersion.map(n => n.id));
    for (let i = 0; i < notesWithNewerVersion.length; i++) {
      const promise = noteContentFetchPromises[i];
      const metadata = notesWithNewerVersion[i];
      promise.then(noteContent => {
        const updatedNote: NoteObject = {
          id: metadata.id,
          title: metadata.title,
          lastChangedEpochMillis: metadata.lastChangedEpochMillis,
          content: noteContent,
        };
        this.cache.addOrUpdateNoteInCache(metadata.id, metadata.lastChangedEpochMillis, metadata.title, noteContent);
        this.notes.value.push(updatedNote);
        this.notes.next(this.notes.value);
        doneCount++;
        this.notifications.toSidebar(
            notificationId.toString(),
            `Syncing notes (${doneCount}/${notesWithNewerVersion.length})`,
            5000);
      }).catch(err => {
        failCount++;
        this.notifications.toSidebar(failNotificationId.toString(),
            `Failed to sync (${failCount}} notes - refresh might help?`,
            10_000);
      });
    }
  }

  private fetchContents(fileIds: string[]): Promise<string>[] {
    const requestIntervalMillis = 200;
    const promises = [];
    for (let i = 0; i < fileIds.length; i++) {
      const promise = this.fetchSingleFileContents(fileIds[i], this.getToken(), i * requestIntervalMillis);
      promises.push(promise);
    }
    return promises;
  }

  private async fetchSingleFileContents(fileId: string, token: string, startDelayMillis: number = 0) {
    await new Promise(resolve => setTimeout(resolve, startDelayMillis));
    const requestGeneratorFn = () =>
        this.http.get(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
          headers: {
            Authorization: 'Bearer ' + token
          },
          params: {
            alt: 'media'
          },
          responseType: 'text'
        }).toPromise();
    return await this.awaitPromiseWithRetry(requestGeneratorFn);
  }

  // Exponential backoff with randomization
  private async awaitPromiseWithRetry<T>(requestGeneratorFn: () => Promise<T>): Promise<T> {
    let backoffMillis = 200 + Math.random() * 400;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        return await requestGeneratorFn();
      } catch (e) {
        if (attempt === 3) {
          throw e;
        }
        await new Promise(resolve => setTimeout(resolve, backoffMillis));
        backoffMillis *= 2;
      }
    }
  }

  async saveContent(fileId: string, content: string, notify: boolean, mimeType = TEXT_MIMETYPE) {
    if (!content) {
      return; // Don't save empty content, just in case there's some bug which overwrites the notes
    }
    const req = gapi.client.request({
      path: `/upload/drive/v3/files/${fileId}`,
      method: 'PATCH',
      headers: {
        'Content-Type': mimeType
      },
      body: content});

    // TODO: cache this
    await req;
  }

  private async fetchOrCreateJsonFile(fileName: string, parentFolder: string): Promise<[string, {}]> {
    const metadataReq = await gapi.client.drive.files.list({
      q: `trashed = false and
          mimeType='${JSON_MIMETYPE}' and
          '${parentFolder}' in parents and
          name='${fileName}'`,
      fields: `nextPageToken, files(id, name, parents, modifiedTime)`,
      pageSize: 1000 // 1000 is the max value
    });

    if (metadataReq.result.files.length > 0) {
      const fileId = metadataReq.result.files[0].id;
      const promise = this.fetchContents([fileId])[0];
      // If the file is new it doesn't contain anything, and isn't JSON parseable -> use empty object as placeholder
      return [fileId, JSON.parse(await promise || '{}')];
    }
    const creationResp = await gapi.client.drive.files.create({
      resource: {
        name: fileName,
        mimeType: JSON_MIMETYPE,
        parents: [parentFolder],
      },
      fields: 'id'
    });
    return [creationResp.result.id, {}];
  }

  async createNote(noteTitle: string): Promise<FileMetadata> {
    return await this.createFile(noteTitle, this.notesFolderId.value);
  }

  async createFlashcard(fc: Flashcard): Promise<FileMetadata> {
    return await this.createFile('fc', this.flashcardsFolderId.value, JSON.stringify(fc), JSON_MIMETYPE);
  }

  private async createFile(
      filename: string,
      parentFolder: string,
      content = '',
      mimeType = TEXT_MIMETYPE): Promise<FileMetadata> {
    const boundary = '-------52891988385335693762';
    const delimiter = '\r\n--' + boundary + '\r\n';
    const closeDelim = '\r\n--' + boundary + '--';

    const metadata = {
      name: filename,
      mimeType,
      parents: [parentFolder],
    };

    const multipartRequestBody =
      delimiter +
      `Content-Type: ${JSON_MIMETYPE}\r\n\r\n` +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: ' + mimeType + '\r\n\r\n' +
      content +
      closeDelim;

    const req = gapi.client.request({
      path: '/upload/drive/v3/files',
      method: 'POST',
      params: {uploadType: 'multipart'},
      headers: {
        'Content-Type': 'multipart/related; boundary="' + boundary + '"'
      },
      body: multipartRequestBody});

    const resp = await req;
    // lastChanged is accurate down to second, not millis, but it's good enough
    const lastChanged = new Date((resp.headers as any).date).getTime();
    return {
      id: (resp as any).result.id,
      title: filename,
      lastChangedEpochMillis: lastChanged,
      createdEpochMillis: lastChanged, // I guess there's no better way?
    };
  }

  /**
   * Saves file to google drive.
   *
   * First created the file and, in a separate request, updates the file with the
   * contents of the image. This is because I couldn't find a nice way to upload
   * everything in a single request.
   */
  async uploadFile(content: any, fileType: string, fileName: string): Promise<string> {
    const fileMetadata = {
      name: fileName,
      mimeType: fileType,
      parents: [this.attachmentsFolderId.value],
    };
    const newFileCreationReq = gapi.client.drive.files.create({
      resource: fileMetadata,
      fields: 'id'
    });

    const newFile = await newFileCreationReq;

    const newFileId = newFile.result.id;
    const reader = new FileReader();
    return new Promise(resolve => {
      reader.onload = async (e2) => {
        const token = this.getToken();
        const asBlob = new Blob([e2.target.result], {type: fileType});
        const resp = await this.http.patch(`https://www.googleapis.com/upload/drive/v3/files/${newFileId}?uploadType=media`, asBlob, {
          headers: {
            'Content-Type': fileType,
            Authorization: 'Bearer ' + token
          },
          withCredentials: true
        }).toPromise();
        resolve((resp as any).id);
      };
      reader.readAsArrayBuffer(content);
    });
  }

  async addAttachmentToNote(noteId: string, fileId: string, fileName: string, mimeType: string) {
    const val = this.attachmentMetadata.value;
    if (!val.hasOwnProperty(noteId)) {
      val[noteId] = [];
    }
    const attachedFile: AttachedFile = {
      name: fileName,
      fileId,
      mimeType,
    };
    val[noteId].push(attachedFile);
    this.attachmentMetadata.next(val);
    await this.saveContent(this.attachmentMetadataFileId, JSON.stringify(val), false, JSON_MIMETYPE);
  }

  async removeAttachmentFromNote(noteId: string, fileId: string) {
    const val = this.attachmentMetadata.value;
    val[noteId] = val[noteId].filter(attachment => attachment.fileId !== fileId);
    this.attachmentMetadata.next(val);
    await this.saveContent(this.attachmentMetadataFileId, JSON.stringify(val), false, JSON_MIMETYPE);
  }
}
