import { Injectable } from '@angular/core';
import {BehaviorSubject, Subject, Subscription} from 'rxjs';
import {GDRIVE_API_KEY, GDRIVE_CLIENT_ID} from '../../environments/environment';
import {HttpClient} from '@angular/common/http';
import {BackendStatusNotification, NoteMetadata, NoteObject, StorageBackend} from '../types';
import {LocalCacheService} from './local-cache.service';

interface PartialMetadataFetch {
  notes: NoteMetadata[];
  nextPageToken?: string;
}

const ROOT_FOLDER_NAME = 'Connected Notes';
const SETTINGS_AND_METADATA_FOLDER_NAME = 'Settings and Metadata';

@Injectable({
  providedIn: 'root'
})
export class GoogleDriveService implements StorageBackend {

  notes = new Subject<NoteObject[]>();
  backendStatusNotifications = new Subject<BackendStatusNotification>();

  private rootFolderId = new Subject<string>();
  private settingAndMetadataFolderId = new BehaviorSubject<string>(null);
  private currentRootFolderId: string;
  private refreshSubscription: Subscription;

  // This service should be created when it's actually needed, ie. user has decided they want to use Google Drive as backend
  constructor(private http: HttpClient, private cache: LocalCacheService) {
    this.initialize();
  }

  async initialize() {
    this.signInIfNotSignedIn().then(() => {
      this.createFoldersIfNotExist();
      this.requestRefreshAllNotes();
    }).catch(async err => {
      this.notes.next(await this.cache.getAllNotesInCache());
    });
  }

  async initiateSignIn() {
    gapi.auth2.getAuthInstance().signIn();
  }

  logout() {
    gapi.auth2.getAuthInstance().signOut();
  }

  private async createFoldersIfNotExist() {
    const listReq = gapi.client.drive.files.list({
      q: `trashed = false and mimeType='application/vnd.google-apps.folder' and name='${ROOT_FOLDER_NAME}'`,
      fields: 'files(id, name)',
    });
    const rootFolderReq = await listReq;
    if (rootFolderReq.result.files.length > 0) {
      this.currentRootFolderId = rootFolderReq.result.files[0].id;
      this.rootFolderId.next(this.currentRootFolderId);
      const settingsListResp = await gapi.client.drive.files.list({
        q: `trashed = false and mimeType='application/vnd.google-apps.folder' and `
          + `name='${SETTINGS_AND_METADATA_FOLDER_NAME}' and '${this.currentRootFolderId}' in parents`,
        fields: 'files(id, name)',
      });
      if (settingsListResp.result.files.length > 0) {
        // TODO: we should actually create it in an else branch
        const folderId = settingsListResp.result.files[0].id;
        this.settingAndMetadataFolderId.next(folderId);
      }
      return;
    }

    const rootFolderCreationResp = await gapi.client.drive.files.create({
      resource: {
        name: ROOT_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder'
      },
      fields: 'id'
    });
    this.currentRootFolderId = rootFolderCreationResp.result.id;
    this.rootFolderId.next(rootFolderCreationResp.result.id);

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

  private signInIfNotSignedIn() {
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

  private async executeListMetadataReq(req: gapi.client.Request<any>): Promise<PartialMetadataFetch> {
    return new Promise((resolve, reject) => {
      req.execute(resp => {
        const ans = resp.result.files.map(note => ({
          id: note.id,
          title: note.name,
          lastChangedEpochMillis: new Date(note.modifiedTime).getTime(),
        }));
        resolve({notes: ans, nextPageToken: (resp as any).nextPageToken});
      });
    });
  }

  /**
   * Get all files. TODO: split this fn
   */
  private async refreshAllNotes() {
    const notificationId = new Date().getTime();
    this.backendStatusNotifications.next({id: notificationId.toString(), message: 'Syncing notes...'});
    const noteMetadata: NoteMetadata[] = [];
    let pageToken = null;
    do {
      const listReq = gapi.client.drive.files.list({
        q: "trashed = false and mimeType='text/plain'",
        pageToken,
        // fields: `*` can be used for debugging, returns all fields
        fields: `nextPageToken, files(id, name, parents, modifiedTime)`,
        pageSize: 1000 // 1000 is the max value
      });
      const resp = await this.executeListMetadataReq(listReq);
      noteMetadata.push(...resp.notes);
      pageToken = resp.nextPageToken;
    } while (pageToken);


    // Handle caching - first, delete version from cache that aren't there anymore
    const existingNoteIds = new Set(noteMetadata.map(n => n.id));
    const noteIdToLastChanged = await this.cache.getAllNoteIdToLastChangedInCache();
    for (const noteIdInCache of noteIdToLastChanged.keys()) {
      if (!existingNoteIds.has(noteIdInCache) && existingNoteIds.size > 0) {
        this.cache.deleteFromCache(noteIdInCache);
      }
    }

    // Then, only consider the notes which have newer version on drive
    const notesWithNewerVersion = noteMetadata
        .filter(n => n.lastChangedEpochMillis > (noteIdToLastChanged.get(n.id) || 0));

    // Now fetch the content of the notes for which we don't have the newest version for.
    const noteContents = await this.fetchContents(notesWithNewerVersion.map(n => n.id));
    const notes: NoteObject[] = await this.cache.getAllNotesInCache();
    for (let i = 0; i < noteContents.length; i++) {
      const metadata = notesWithNewerVersion[i];
      const note = {
        id: metadata.id,
        title: metadata.title,
        lastChangedEpochMillis: metadata.lastChangedEpochMillis,
        content: noteContents[i],
      };
      this.cache.addOrUpdateNoteInCache(metadata.id, metadata.lastChangedEpochMillis, metadata.title, noteContents[i]);
      notes.push(note);
    }
    this.notes.next(notes);
    this.backendStatusNotifications.next({
      id: notificationId.toString(),
      message: 'All notes synced',
      removeAfterMillis: 5000
    });
  }

  private async fetchContents(fileIds: string[]): Promise<string[]> {
    const token = gapi
      .auth2
      .getAuthInstance()
      .currentUser
      .get()
      .getAuthResponse(true)
      .access_token;

    // TODO: load test this. I encountered some weird QPS limit errors with only a dozen fetches, make sure that won't happen at scale.
    const fetches: Promise<string>[] = fileIds.map(id => {
      return new Promise((resolve, reject) => {
        this.http.get(`https://www.googleapis.com/drive/v3/files/${id}`, {
          headers: {
            Authorization: 'Bearer ' + token
          },
          params: {
            alt: 'media'
          },
          responseType: 'text'
        }).subscribe((txt: string) => {
          resolve(txt);
        });
      });
    });
    return Promise.all(fetches);
  }

  saveContent(noteId: string, content: string, notify: boolean) {
    if (!content) {
      return; // Don't save empty content, just in case there's some bug which overwrites the notes
    }
    const req = gapi.client.request({
      path: `/upload/drive/v3/files/${noteId}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: content});

    // Use note ID as the ID for the status update because if the same note
    // is save twice we don't want to see two different notifications.
    if (notify) {
      this.backendStatusNotifications.next({id: noteId, message: 'Saving...'});
    }
    req.execute(resp => {
      if (notify) {
        this.backendStatusNotifications.next({id: noteId, message: 'Saved', removeAfterMillis: 5000});
      }
    });
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
