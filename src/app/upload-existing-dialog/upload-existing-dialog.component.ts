import {AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, ViewChild} from '@angular/core';
import {StorageService} from '../storage.service';
import {MatDialogRef} from '@angular/material/dialog';

import Dropzone from 'dropzone';
import {Sort} from '@angular/material/sort';


const NOTE_MIME_TYPES = ['text/plain', 'text/markdown', 'text/x-markdown', '' /* treat unknown as note */];

@Component({
  selector: 'cn-upload-existing-dialog',
  template: `

    <div id="wrapper">
      <div id="overlay" *ngIf="attachmentStatusMsg || noteStatusMsg">
        <span id="status-messages">
          <h2>{{attachmentStatusMsg}}</h2>
          <h2>{{noteStatusMsg}}</h2>
        </span>
      </div>

      <div id="instructions">
        <p>
          This is an experimental note uploading, many features are in development.
          Drop notes and their attachments below. The notes should be plain text or markdown files.
        </p>
        <p>
          For each note, its attachments should be uploaded at the
          same time as the note itself. This is because as part of the uploading process,
          the links to attachments will be renamed to point to their new URLs.
        </p>
        <p>
          This tool is in beta so there are limitations:
          if your notes don't have unique names, we'll rename the notes by attaching a number to the end of the note.
          Attachments should have unique names.
        </p>

        <div id="settings">
          <mat-checkbox #attachmentRename checked>Rename attachment references</mat-checkbox>
        </div>
      </div>

      <div id="dropzone" #dropzone>
        <h1>Drop notes and attachments here</h1>
      </div>

      <table *ngIf="files?.length" (matSortChange)="sortData($event)"
             matSort
             matSortActive="name"
             matSortDirection="asc"
             matSortDisableClear>
        <tr id="header">
          <th mat-sort-header="name">Name</th>
          <th mat-sort-header="mimeType">Type</th>
          <th mat-sort-header="type">Note/Attachment</th>
          <th>Remove</th>
        </tr>

        <tr *ngFor="let file of files; let idx = index">
          <td>{{file.name}}</td>
          <td>{{file.type}}</td>
          <td>{{getNoteOrAttachment(file)}}</td>
          <td><mat-icon class="delete-icon" (click)="deleteFile(idx)">clear</mat-icon></td>
        </tr>
      </table>

      <div id="buttons">
        <button mat-button (click)="upload()">upload</button>
        <button mat-button (click)="cancel()">cancel</button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      position: relative;
    }

    .delete-icon {
      cursor: pointer;
    }

    #buttons {
      display: flex;
      flex-direction: row-reverse;
      margin-top: 10px;
    }

    #instructions {
      width: 500px;
    }

    #dropzone {
      align-items: center;
      background-color: var(--tertiary-background-color);
      display: flex;
      flex-direction: column;
      justify-content: space-around;
      height: 250px;
      width: 500px;
    }

    #wrapper {
      position: relative;
    }

    #overlay {
      display: flex;
      justify-content: space-around;
      align-items: center;
      position: absolute;
      background-color: var(--primary-background-color);
      opacity: 0.75;
      height: 100%;
      width: 100%;
      z-index: 100;
    }

    #status-messages {
      position: fixed;
      top: 40%;
    }

    #settings {
      margin: 10px;
    }
  `]
})
export class UploadExistingDialogComponent implements AfterViewInit {
  @ViewChild('dropzone') dropzoneElem: ElementRef;
  @ViewChild('attachmentRename') attachmentRename: ElementRef;

  files: Dropzone.DropzoneFile[];
  attachmentStatusMsg: string;
  noteStatusMsg: string;

  private dropzone: Dropzone;

  constructor(
      private readonly storage: StorageService,
      private dialogRef: MatDialogRef<UploadExistingDialogComponent>,
      private cdr: ChangeDetectorRef) {
  }

  deleteFile(idx: number) {
    this.files.splice(idx, 1);
    this.cdr.detectChanges();
  }

  getNoteOrAttachment(file): 'note'|'attachment' {
    return NOTE_MIME_TYPES.includes(file.type) ? 'note' : 'attachment';
  }

  sortData(sort: Sort) {
    const compareFn = (a: number | string, b: number | string, isAsc: boolean) => {
      return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
    };

    this.files = this.files.sort((a, b) => {
      const isAsc = sort.direction === 'asc';
      switch (sort.active) {
        case 'name': return compareFn(a.name, b.name, isAsc);
        case 'type': return compareFn(a.type, b.type, isAsc);
        default: return 0;
      }
    });
  }

  cancel() {
    this.dialogRef.close();
  }

  readNoteFile(file: Dropzone.DropzoneFile) {
    const reader = new FileReader();
    const ans = new Promise(success =>
        reader.addEventListener('load',
                event => success(event.target.result as string))) as Promise<string>;
    reader.readAsText(file);
    return ans;
  }

  // TODO: should take into account all existing note names
  getUniqueNoteName(curName: string, existingNames: Set<string>) {
    if (!existingNames.has(curName)) {
      return curName;
    }
    let i = 1;
    while (existingNames.has(curName + ` (${i})`)) {
      i++;
    }
    return curName + ` (${i})`;
  }

  // TODO: link the attachments to the notes
  async upload() {
    // TODO: check the following:
    //  1. Does note with that name exist? Warn if yes.
    //  2. Can we match all attachments in notes to files that are going to be uploaded? Warn if no.
    //  3. Support linking to already uploaded attachments.

    const notes = this.files.filter(f => NOTE_MIME_TYPES.includes(f.type));
    const attachments = this.files.filter(f => !NOTE_MIME_TYPES.includes(f.type));

    const names = new Set<string>();
    const noteToName = new Map();

    // 1. Check that each note has unique name - if not, append running number to make it unique
    for (const note of notes) {
      const actualName = this.getUniqueNoteName(this.stripSuffix(note.name), names);
      names.add(actualName);
      noteToName.set(note, actualName);
    }

    // 2. Create the notes and get their IDs
    const noteToNoteId = new Map();
    const noteIdToContent = new Map();
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      this.attachmentStatusMsg = `Created ${i}/${notes.length} notes`;
      const noteId = await this.storage.createNote(noteToName.get(note));
      noteToNoteId.set(note, noteId);
      const noteContent = await this.readNoteFile(note);
      noteIdToContent.set(noteId, noteContent);
    }

    // 3. Store all the attachments and get their URLs, assuming the uploaded notes are from local filesystem
    const attachmentToUrl = new Map();
    for (let i = 0; i < attachments.length; i++) {
      this.attachmentStatusMsg = `Uploaded ${i}/${attachments.length} attachments`;
      const file = attachments[i];
      const fileId = await this.storage.uploadFile(file, file.type, file.name);
      const url = StorageService.fileIdToLink(fileId);
      attachmentToUrl.set(file, url);
    }
    this.attachmentStatusMsg = `Uploaded all ${attachments.length} attachments`;

    // 4. Replace links
    const noteIdToUpdatedContent = new Map<string, string>();
    for (const [noteId, content] of noteIdToContent.entries()) {
      const linkLocations = this.getLinkLocations(content);
      linkLocations.reverse(); // We need to replace links from last to first so the locations won't change
      let newContent = content;
      for (const loc of linkLocations) {
        const [start, end] = loc;
        const link = content.slice(start, end);
        const attachment = this.matchLinkToAttachment(link, attachments);
        if (attachment && this.attachmentRename.nativeElement.checked) {
          const attachmentLink = attachmentToUrl.get(attachment);
          newContent = newContent.substring(0, start) + attachmentLink + newContent.substring(end);
        }
      }
      noteIdToUpdatedContent.set(noteId, newContent);
    }

    // 5. Store modified notes
    let i = 0;
    for (const [noteId, newContent] of noteIdToUpdatedContent.entries()) {
      this.noteStatusMsg = `Uploaded ${i}/${noteIdToUpdatedContent.size} note contents`;
      await this.storage.saveContent(noteId, newContent);
      i++;
    }
    this.noteStatusMsg = `Uploaded all ${noteIdToUpdatedContent.size} note contents`;
  }

  ngAfterViewInit(): void {
    const unusedDiv = document.createElement('div');
    this.dropzone = new Dropzone(this.dropzoneElem.nativeElement, {
      previewsContainer: unusedDiv,
      autoProcessQueue: false,
      url: 'unused, here just because dropzone requires URL',
    });
    this.dropzone.on('addedfile', () => {
      this.files = this.dropzone.files;
      this.cdr.detectChanges();
    });
  }

  // // Drop handler function to get all files
  // async getAllFileEntries(dataTransferItemList) {
  //   const fileEntries = [];
  //   // Use BFS to traverse entire directory/file structure
  //   const queue = [];
  //   // Unfortunately dataTransferItemList is not iterable i.e. no forEach
  //   for (let i = 0; i < dataTransferItemList.length; i++) {
  //     queue.push(dataTransferItemList[i].webkitGetAsEntry());
  //   }
  //   while (queue.length > 0) {
  //     const entry = queue.shift();
  //     if (entry.isFile) {
  //       fileEntries.push(entry);
  //     } else if (entry.isDirectory) {
  //       queue.push(...await this.readAllDirectoryEntries(entry.createReader()));
  //     }
  //   }
  //   return fileEntries;
  // }
  //
  // // Get all the entries (files or sub-directories) in a directory
  // // by calling readEntries until it returns empty array
  // async readAllDirectoryEntries(directoryReader) {
  //   const entries = [];
  //   let readEntries = await this.readEntriesPromise(directoryReader);
  //   while (readEntries.length > 0) {
  //     entries.push(...readEntries);
  //     readEntries = await this.readEntriesPromise(directoryReader);
  //   }
  //   return entries;
  // }
  //
  // // Wrap readEntries in a promise to make working with readEntries easier
  // // readEntries will return only some of the entries in a directory
  // // e.g. Chrome returns at most 100 entries at a time
  // async readEntriesPromise(directoryReader) {
  //   try {
  //     return await new Promise((resolve, reject) => {
  //       directoryReader.readEntries(resolve, reject);
  //     });
  //   } catch (err) {
  //     console.log(err);
  //   }
  // }

  private stripSuffix(name: string) {
    if (name.endsWith('.txt')) {
      return name.slice(0, -4);
    }
    if (name.endsWith('.md')) {
      return name.slice(0, -3);
    }
    return name;
  }

  // TODO: hard to read function
  private getLinkLocations(content: string): [number, number][] {
    const ans = [];
    for (let start = 0; start < content.length; start++) {
      if (content[start] === '[' && (start === 0 || !['\\', '['].includes(content[start - 1]))) {
        for (let end = start + 1; end < content.length; end++) {
          if (content[end] === '\n') {
            break;
          }
          // skip closing bracket but no opening for link
          if (content[end] === ']' && content[end - 1] !== '\\' && content[end + 1] !== '(') {
            break;
          }
          if (content[end] === ']' && content[end - 1] !== '\\' && content[end + 1] === '(') {
            const linkStart = end + 2;
            for (let linkEnd = end + 3; linkEnd < content.length; linkEnd++) {
              const isTitleStart = content.slice(linkEnd, linkEnd + 2) === ' "'
                  && content.indexOf(')', linkEnd) >= 0;
              if (isTitleStart || content[linkEnd] === ')') {
                ans.push([linkStart, linkEnd]);
                // start = linkEnd; // Otherwise ??
                break;
              }
            }
            break;
          }
        }
      }
    }
    return ans;
  }

  private matchLinkToAttachment(link: string, attachments: Dropzone.DropzoneFile[]) {
    const pathParts = link.split('/'); // TODO: doesn't take into account escaped slashes or OS specific stuff
    for (let i = 0; i < pathParts.length; i++) {
      const pth = pathParts.slice(i).join('/');
      for (const file of attachments) {
        // for some reason 'fullPath' isn't in the TS typings for dropzone
        const fullPath = (file as any).fullPath as string;
        if (fullPath.endsWith(pth)) {
          return file;
        }
      }
    }
    return null;
  }
}
