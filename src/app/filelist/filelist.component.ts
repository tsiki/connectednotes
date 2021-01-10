import {Component, ElementRef, Input, OnInit, ViewChild} from '@angular/core';
import {NoteService} from '../note.service';
import {TagNesting} from '../types';
import {NotificationService} from '../notification.service';
import {SortDirection} from '../zettelkasten/zettelkasten.component';
import {SubviewManagerService} from '../subview-manager.service';
import {CdkDragDrop, CdkDropList} from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-filelist',
  templateUrl: './filelist.component.html',
  styles: [``],
})
export class FilelistComponent implements OnInit {
  @ViewChild('titleRenameInput') titleRenameInput: ElementRef;
  @ViewChild('contextMenu') contextMenu: ElementRef;
  @ViewChild('droplist') droplist: ElementRef<CdkDropList>;

  @Input() set sortDirection(direction: SortDirection) {
    this.currentSortDirection = direction;
  }
  get sortDirection() {
    return this.currentSortDirection;
  }

  private lastChildTagDragged: string;

  private currentSortDirection: SortDirection = SortDirection.MODIFIED_NEWEST_FIRST;
  private lastParentTagDragged: string;
  forTesting = {
    setLastChildTagDragged: val => this.lastChildTagDragged = val,
    setLastParentTagDragged: val => this.lastParentTagDragged = val,
  };

  constructor(
      readonly noteService: NoteService,
      private readonly subviewManager: SubviewManagerService,
      private notifications: NotificationService) {
  }

  ngOnInit(): void {
  }

  async nestTags(e: CdkDragDrop<unknown>) {
    this.notifications.showFullScreenBlockingMessage(null);
    if (!e.isPointerOverContainer) {
      return;
    }
    if (this.lastParentTagDragged === null || this.lastChildTagDragged === null) {
      return;
    }
    const childTag = this.lastChildTagDragged;
    const parentTag = this.lastParentTagDragged;
    if (parentTag !== childTag) {
      await this.noteService.addChildTag(parentTag, childTag);
    }
  }

  onTagDraggedOverOtherTag(e: TagNesting) {
    this.lastChildTagDragged = e.childTag;
    this.lastParentTagDragged = e.parentTag;
    if (e.parentTag === null) {
      this.notifications.showFullScreenBlockingMessage(`Cancel drag`);
    } else {
      this.notifications.showFullScreenBlockingMessage(`Nest ${e.childTag} under ${e.parentTag}`);
    }
  }
}
