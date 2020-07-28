import { Injectable } from '@angular/core';
import {BehaviorSubject, Subject, Subscription} from 'rxjs';
import {GDRIVE_API_KEY, GDRIVE_CLIENT_ID} from '../../environments/environment';
import {HttpClient} from '@angular/common/http';
import {BackendStatusNotification, NoteMetadata, NoteObject, StorageBackend, UserSettings} from '../types';
import {LocalCacheService} from './local-cache.service';
import {NotificationService} from '../notification.service';

const ROOT_FOLDER_NAME = 'Connected Notes';
const SETTINGS_AND_METADATA_FOLDER_NAME = 'Settings and Metadata';
const SETTINGS_FILE_NAME = 'settings.json';

@Injectable({
  providedIn: 'root'
})
export class GoogleDriveService implements StorageBackend {

  notes = new BehaviorSubject<NoteObject[]>([]);
  storedSettings = new BehaviorSubject<UserSettings>(null);

  private rootFolderId = new Subject<string>();
  private settingAndMetadataFolderId = new BehaviorSubject<string>(null);
  private storedSettingsFileId: string; // Not observable since we assume any settings update is done with delay
  private currentRootFolderId: string;
  private refreshSubscription: Subscription;

  // This service should be created when it's actually needed, ie. user has decided they want to use Google Drive as
  // backend - that way we can go straight to the authentication.
  constructor(private http: HttpClient, private cache: LocalCacheService, private notifications: NotificationService) {
  }

  initialize() {
    this.signInIfNotSignedIn().then(() => {
      this.createFoldersIfNotExist();
      this.requestRefreshAllNotes();
    }).catch(async err => {
      this.notes.next(await this.cache.getAllNotesInCache());
    });
  }

  async initiateSignIn() {
    await gapi.auth2.getAuthInstance().signIn();
  }

  logout() {
    gapi.auth2.getAuthInstance().signOut();
  }

  private async createFoldersIfNotExist() {
    const rootFolderReq = await gapi.client.drive.files.list({
      q: `trashed = false and mimeType='application/vnd.google-apps.folder' and name='${ROOT_FOLDER_NAME}'`,
      fields: 'files(id, name)',
    });
    if (rootFolderReq.result.files.length > 0) {
      this.currentRootFolderId = rootFolderReq.result.files[0].id;
      this.rootFolderId.next(this.currentRootFolderId);
    } else {
      const rootFolderCreationResp = await gapi.client.drive.files.create({
        resource: {
          name: ROOT_FOLDER_NAME,
          mimeType: 'application/vnd.google-apps.folder'
        },
        fields: 'id'
      });
      this.currentRootFolderId = rootFolderCreationResp.result.id;
      this.rootFolderId.next(rootFolderCreationResp.result.id);
    }

    const settingsFolderListResp = await gapi.client.drive.files.list({
      q: `trashed = false and mimeType='application/vnd.google-apps.folder' and `
          + `name='${SETTINGS_AND_METADATA_FOLDER_NAME}' and '${this.currentRootFolderId}' in parents`,
      fields: 'files(id, name)',
    });
    if (settingsFolderListResp.result.files.length > 0) {
      const folderId = settingsFolderListResp.result.files[0].id;
      this.settingAndMetadataFolderId.next(folderId);
    } else {
      // Also create settings/metadata folder
      const settingsFolderCreationResp = await gapi.client.drive.files.create({
        resource: {
          name: SETTINGS_AND_METADATA_FOLDER_NAME,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [this.currentRootFolderId],
        },
        fields: 'id'
      });
      this.settingAndMetadataFolderId.next(settingsFolderCreationResp.result.id);
    }

    const storedSettingsListResp = await gapi.client.drive.files.list({
      q: `trashed = false and mimeType='application/json' and `
          + `name='${SETTINGS_FILE_NAME}' and '${this.settingAndMetadataFolderId.getValue()}' in parents`,
      fields: 'files(id, name,  parents)',
    });
    if (storedSettingsListResp.result.files.length > 0) {
      const storedSettingsFileId = storedSettingsListResp.result.files[0].id;
      this.storedSettingsFileId = storedSettingsFileId;
      const settingsPromise = this.fetchContents([storedSettingsFileId]).next().value;
      // If the file is new it doesn't contain any settings, and isn't JSON parseable -> use empty object as placeholder
      this.storedSettings.next(JSON.parse(await settingsPromise || '{}'));
    } else {
      // Finally, create settings file
      const settingsFileCreationResp = await gapi.client.drive.files.create({
        resource: {
          name: SETTINGS_FILE_NAME,
          mimeType: 'application/json',
          parents: [this.settingAndMetadataFolderId.getValue()],
        },
        fields: 'id'
      });
      this.storedSettingsFileId = settingsFileCreationResp.result.id;
      this.storedSettings.next({});
    }
  }

  signInIfNotSignedIn() {
    return new Promise((resolve, reject) => {
      gapi.load('client:auth2', () => this.checkAndListenForSignIn().then(() => resolve()));
    });
  }

  private async checkAndListenForSignIn() {
    await gapi.client.init({
      apiKey: GDRIVE_API_KEY,
      clientId: GDRIVE_CLIENT_ID,
      discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.install'
    });

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

  requestRefreshAllNotes() {
    if (!this.currentRootFolderId) {
      if (!this.refreshSubscription) {
        this.refreshSubscription = this.rootFolderId.subscribe(() => {
          this.refreshAllNotes();
          this.refreshSubscription = null;
        });
      }
    } else {
      this.refreshAllNotes();
    }
  }

  updateSettings(settingKey: string, settingValue: string) {
    const current = this.storedSettings.getValue();
    current[settingKey] = settingValue;
    this.saveContent(this.storedSettingsFileId, JSON.stringify(current), true, 'application/json');
    this.storedSettings.next(current);
  }

  createNote(filename: string): Promise<NoteObject> {
    return this.createFile(filename);
  }

  renameNote(noteId: string, newTitle: string) {
    const req = gapi.client.drive.files.update({fileId: noteId, name: newTitle});
    return new Promise<void>((resolve, reject) => {
      req.execute(() => resolve());
    });
  }

  deleteNote(noteId: string) {
    const req = gapi.client.drive.files.delete({fileId: noteId});
    return new Promise<void>((resolve, reject) => {
      req.execute(() => resolve());
    });
  }

  private async fetchNoteMetadata(): Promise<NoteMetadata[]> {
    const noteMetadata: NoteMetadata[] = [];
    let pageToken = null;
    do {
      const generateListReqFn = () => gapi.client.drive.files.list({
        q: "trashed = false and mimeType='text/plain'",
        pageToken,
        // fields: `*` can be used for debugging, returns all fields
        fields: `nextPageToken, files(id, name, parents, modifiedTime)`,
        pageSize: 1000 // 1000 is the max value
      });
      const resp = await this.awaitPromiseWithRetry(generateListReqFn);
      const notes = resp.result.files.map(note => ({
        id: note.id,
        title: note.name,
        lastChangedEpochMillis: new Date(note.modifiedTime).getTime(),
      }));
      pageToken = (resp as any).nextPageToken;
      noteMetadata.push(...notes);
    } while (pageToken);
    return noteMetadata;
  }

  /**
   * Get all files. TODO: long function is loooong
   */
  private async refreshAllNotes() {
    const notificationId = new Date().getTime();
    this.notifications.toSidebar(notificationId.toString(), 'Syncing notes...');

    let noteMetadata;
    try {
      noteMetadata = await this.fetchNoteMetadata();
    } catch (e) {
      this.notifications.toSidebar(
          notificationId.toString(),
          'Fetching metadata for notes failed. Displaying only cached notes.',
          10_000);
      noteMetadata = null;
    }

    const noteIdToLastChanged = await this.cache.getAllNoteIdToLastChangedTimestamp();
    // Delete notes from cache that aren't there anymore
    if (noteMetadata !== null) {
      const existingNoteIds = new Set(noteMetadata?.map(n => n.id)); // inserting null creates empty set
      for (const noteIdInCache of noteIdToLastChanged.keys()) {
        if (!existingNoteIds.has(noteIdInCache)) {
          this.cache.deleteFromCache(noteIdInCache);
        }
      }
    }

    // Then, only consider the notes which have newer version on drive
    const notesWithNewerVersion = noteMetadata
        ?.filter(n => n.lastChangedEpochMillis > (noteIdToLastChanged.get(n.id) || 0))
        || [];

    // Now fetch the content of the notes for which we don't have the newest version for.
    // TODO don't wait for all notes to be loaded
    const noteContentGenerator = this.fetchContents(notesWithNewerVersion.map(n => n.id));

    const cachedNotes = await this.cache.getAllNotesInCache();
    const newerNoteIds = new Set(notesWithNewerVersion.map(n => n.id));
    const upToDateCachedNotes = cachedNotes.filter(note => !newerNoteIds.has(note.id));
    this.notes.next(upToDateCachedNotes);
    if (notesWithNewerVersion.length === 0) {
      this.notifications.toSidebar(notificationId.toString(), 'Syncing notes... done', 3000);
    }

    let idx = 0;
    let doneCount = 0;
    let failCount = 0;
    const failNotificationId = new Date().getTime() + 1e9;
    let it = noteContentGenerator.next();
    while (!it.done) {
      const promise = it.value;
      const metadata = notesWithNewerVersion[idx];
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
      idx++;
      it = noteContentGenerator.next();
    }
  }

  private *fetchContents(fileIds: string[]): IterableIterator<Promise<string>> {
    const token = gapi
      .auth2
      .getAuthInstance()
      .currentUser
      .get()
      .getAuthResponse(true)
      .access_token;

    const requestIntervalMillis = 200;
    for (let i = 0; i < fileIds.length; i++) {
      const promise = this.fetchSingleFileContents(fileIds[i], token, i * requestIntervalMillis);
      yield promise;
    }
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
    let backoffMillis = 100 + Math.random() * 200;
    for (let attempt = 1; attempt <= 3; attempt++) {
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

  async saveContent(fileId: string, content: string, notify: boolean, mimeType = 'text/plain') {
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

    // TODO: cache this - we need the last changed timestamp from the server
    await req;
  }

  createFile(filename: string): Promise<NoteObject> {
    // TODO: check that the boundary isn't in the stringified version of contentJson
    const boundary = '-------314159265358979323846';
    const delimiter = '\r\n--' + boundary + '\r\n';
    const closeDelim = '\r\n--' + boundary + '--';

    const contentType = 'text/plain';

    const metadata = {
      name: filename,
      mimeType: contentType,
      parents: [this.currentRootFolderId],
    };

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: ' + contentType + '\r\n\r\n' +
      // here we could attach content like so:
      // 'lalalalalalalalalalalala' +
      closeDelim;

    const req = gapi.client.request({
      path: '/upload/drive/v3/files',
      method: 'POST',
      params: {uploadType: 'multipart'},
      headers: {
        'Content-Type': 'multipart/related; boundary="' + boundary + '"'
      },
      body: multipartRequestBody});

    return new Promise((resolve, reject) => {
      req.execute(createdFileMetadata => {
        resolve( {
          id: (createdFileMetadata as any).id,
          title: filename,
          content: '',
          lastChangedEpochMillis: new Date().getTime() // TODO: get the timestamp from server
        });
      });
    });
  }

  /**
   * Saves image to google drive.
   *
   * First created the file and, in a separate request, updates the file with the
   * contents of the image. This is because I couldn't find a nice way to upload
   * everything in a single request.
   */
  saveImage(img: any, fileType: string, fileName: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const fileMetadata = {
        name: fileName,
        mimeType: fileType,
        parents: [this.currentRootFolderId],
      };
      const req = gapi.client.drive.files.create({
        resource: fileMetadata,
        fields: 'id'
      });
      req.execute(newFile => {
        const newFileId = newFile.result.id;
        const reader = new FileReader();
        reader.onload = (e2) => {
          const token = gapi
            .auth2
            .getAuthInstance()
            .currentUser
            .get()
            .getAuthResponse(true)
            .access_token;
          const asBlob = new Blob([e2.target.result], {type: fileType});
          this.http.patch(`https://www.googleapis.com/upload/drive/v3/files/${newFileId}?uploadType=media`, asBlob, {
            headers: {
              'Content-Type': fileType,
              Authorization: 'Bearer ' + token
            },
            withCredentials: true
          }).subscribe(resp => resolve(`https://drive.google.com/uc?id=${(resp as any).id}`));
        };
        reader.readAsArrayBuffer(img);
      });
    });
  }
}
