import {Component, ElementRef, Input, OnInit, ViewChild} from '@angular/core';
import {StorageService} from '../storage.service';
import {NoteDrag, TagNesting} from '../types';
import {NotificationService} from '../notification.service';
import {SortDirection} from '../zettelkasten/zettelkasten.component';
import {SubviewManagerService} from '../subview-manager.service';
import {CdkDragDrop, CdkDropList} from '@angular/cdk/drag-drop';
import {AUTOMATICALLY_GENERATED_TAG_NAMES, ROOT_TAG_NAME} from '../constants';

@Component({
  selector: 'cn-filelist',
  templateUrl: './filelist.component.html',
  styles: [``],
})
export class FilelistComponent implements OnInit {
  @ViewChild('titleRenameInput') titleRenameInput: ElementRef;
  @ViewChild('contextMenu') contextMenu: ElementRef;
  @ViewChild('droplist') droplist: ElementRef<CdkDropList>;

  ROOT_TAG_NAME = ROOT_TAG_NAME;

  @Input() set sortDirection(direction: SortDirection) {
    this.currentSortDirection = direction;
  }
  get sortDirection() {
    return this.currentSortDirection;
  }

  private currentSortDirection: SortDirection = SortDirection.MODIFIED_NEWEST_FIRST;
  private lastDragEvent: NoteDrag|TagNesting;

  forTesting = {
    setLastDragEvent: (e: TagNesting|NoteDrag) => this.lastDragEvent = e,
  };

  constructor(
      readonly storage: StorageService,
      private readonly subviewManager: SubviewManagerService,
      private notifications: NotificationService) {
  }

  ngOnInit(): void {
  }

  async dragEnded(e: CdkDragDrop<unknown>) {
    this.notifications.showFullScreenBlockingMessage(null);
    if (!e.isPointerOverContainer) {
      return;
    }
    if ('oldParentTag' in this.lastDragEvent) {
      await this.handleTagOverTagDrag(this.lastDragEvent);
    } else {
      await this.handleNoteOverTagDrag(this.lastDragEvent);
    }
  }

  async handleTagOverTagDrag(e: TagNesting) {
    const {oldParentTag, newParentTag, childTag} = e;
    if (newParentTag === null || AUTOMATICALLY_GENERATED_TAG_NAMES.includes(newParentTag)) {
      return;
    }
    if (newParentTag !== childTag && oldParentTag !== newParentTag) {
      await this.storage.changeParentTag(oldParentTag, newParentTag, childTag);
    }
  }

  async handleNoteOverTagDrag(e: NoteDrag) {
    if (AUTOMATICALLY_GENERATED_TAG_NAMES.includes(e.targetTag)) {
      return;
    }
    const note = this.storage.getNoteForTitleCaseInsensitive(e.noteTitle);
    await this.storage.replaceTags(note.id, e.sourceTag, e.targetTag);
  }

  onTagDraggedOverOtherTag(e: TagNesting) {
    this.lastDragEvent = e;
    if (e.newParentTag === null) {
      this.notifications.showFullScreenBlockingMessage(`Cancel drag`);
    } else {
      this.notifications.showFullScreenBlockingMessage(
          `Nest ${e.childTag} under ${e.newParentTag} instead of ${e.oldParentTag}`);
    }
  }

  onNoteDraggedOverTag(e: NoteDrag) {
    this.lastDragEvent = e;
    if (e.targetTag === null
        || e.targetTag === e.sourceTag
        || AUTOMATICALLY_GENERATED_TAG_NAMES.includes(e.targetTag)) {
      this.notifications.showFullScreenBlockingMessage(`Cancel drag`);
    } else {
      const maybeTruncatedTitle = e.noteTitle.length > 40 ? e.noteTitle.slice(0, 40) + '...' : e.noteTitle;
      this.notifications.showFullScreenBlockingMessage(
          `Replace tag ${e.sourceTag} with ${e.targetTag} in
          "${maybeTruncatedTitle}"`);
    }
  }
}
