import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  SecurityContext,
  ViewChild
} from '@angular/core';
import {Flashcard} from '../types';
import {Subscription} from 'rxjs';
import {FlashcardService} from '../flashcard.service';
import {SubviewManagerService} from '../subview-manager.service';
import * as marked from 'marked';
import {DomSanitizer} from '@angular/platform-browser';
import {FlashcardDialogComponent, FlashcardDialogData} from '../create-flashcard-dialog/flashcard-dialog.component';
import {MatDialog} from '@angular/material/dialog';

export const DUE_FCS_QUEUE_NAME = 'due flashcards';
export const ALL_FCS_QUEUE_NAME = 'all flashcards';

@Component({
  selector: 'app-study',
  template: `
    <div id="top-bar">
      <span><!-- this element is for centering the dropdown --></span>
      <mat-form-field id="queue-dropdown" appearance="fill">
        <mat-label>Flashcard queue</mat-label>
        <mat-select [(value)]="selectedQueue" (selectionChange)="queueChanged()">
          <span class="queue-option-container" *ngFor="let queue of fcQueues">
            <mat-option [value]="queue[0]">
              <span class="queue-info-container">
                <span class="queue-name">{{queue[0]}}</span>
              </span>
            </mat-option>
            <span class="due-count">{{dueFcQueues.get(queue[0])?.length || 0}}/{{queue[1]?.length || 0}} due</span>
          </span>
        </mat-select>
      </mat-form-field>
      <button mat-button (click)="closeView()" matTooltip="close view">
        <mat-icon>close</mat-icon>
      </button>
    </div>
    <div id="container">
      <button *ngIf="displayedFc" mat-button id="more-button" [matMenuTriggerFor]="optionsMenu">
        <mat-icon>more_vert</mat-icon>
        <mat-menu #optionsMenu="matMenu">
          <button (click)="editFlashcard(displayedFc)" mat-menu-item matTooltip="edit flashcard">
            <mat-icon>edit</mat-icon>
            edit
          </button>
          <button (click)="deleteFlashcard(displayedFc.id)" mat-menu-item matTooltip="delete flashcard">
            <mat-icon>delete_outline</mat-icon>
            delete
          </button>
        </mat-menu>
      </button>
      <div id="fc-container">
        <div class="notification" *ngIf="allFcs.length === 0">You haven't created any flashcards.</div>
        <div class="notification" *ngIf="allFcs.length > 0 && currentDueFcsQueue.length === 0">
          All done!
        </div>
        <span [style.display]="displayedFc ? 'initial' : 'none'">
          <div id="tags">
            <div id="tags-container">
                <span class="tag" *ngFor="let tag of displayedFc?.tags">{{tag}}</span>
            </div>
          </div>
          <div id="due-fc-container" class="raisedbox">
            <div class="fc-side" #front [hidden]="revealed"></div>
            <div class="fc-side" #back [hidden]="!revealed"></div>
            <button id="show-answer-button" mat-button *ngIf="!revealed" (click)="reveal()">
              show answer
            </button>
            <ng-container *ngIf="revealed">
              <div id="rating-container">
                <button mat-button
                        (click)="submitRating(3, displayedFc)"
                        matTooltip="Remembering was easy">Easy
                </button>
                <button mat-button
                        (click)="submitRating(2, displayedFc)"
                        matTooltip="Remembering was not easy, not hard">Moderate
                </button>
                <button mat-button
                        (click)="submitRating(1, displayedFc)"
                        matTooltip="Remembering was hard or incomplete">Hard
                </button>
                <button mat-button
                        (click)="submitRating(0, displayedFc)"
                        matTooltip="Couldn't remember">No idea
                </button>
              </div>
            </ng-container>
          </div>
        </span>
      </div>
    </div>
  `,
  styles: [`
    :host {
      background: var(--primary-background-color);
      display: flex;
      flex-direction: column;
      justify-content: space-around;
    }

    .fc-side {
      overflow-wrap: break-word;
    }

    #more-button {
      position: absolute;
      right: 0;
    }

    #container {
      position: relative;
    }

    .queue-option-container {
      align-items: center;
      display: flex;
      position: relative;
    }

    .queue-option-container mat-option {
      display: inline-block;
      flex-grow: 1;
    }

    #top-bar {
      display: flex;
      justify-content: space-between;
      height: var(--top-bar-height);
      background: var(--secondary-background-color);
      border-bottom: 1px solid var(--gutter-color);
    }

    #due-fc-container {
      border-radius: 6px;
      box-shadow: 0 0 10px #bdbdbd;
      display: flex;
      flex-direction: column;
      width: 350px;
      /*min-height: 500px;*/
      padding: 10px;
    }

    #queue-dropdown {
      margin-left: 60px;
      max-width: 350px;
    }

    #rating-container {
      display: flex;
      justify-content: space-between;
    }

    #rating-container > button {
      flex-grow: 1;
    }

    #fc-container {
      align-items: center;
      display: flex;
      flex-direction: column;
      justify-content: space-around;
    }

    .due-count {
      color: var(--low-contrast-text-color);
      position: absolute;
      right: 5px;
    }

    .queue-info-container {
      display: flex;
      justify-content: space-between;
    }

    #tags {
      display: flex;
      justify-content: space-around;
      margin: 20px 0;
    }

    .tag {
      margin-left: 10px;
    }

    .notification {
      margin-top: 10px;
    }

    #show-answer-button {
      width: 100%;
    }
  `]
})
export class StudyComponent implements AfterViewInit, OnDestroy {

  @ViewChild('front') front: ElementRef;
  @ViewChild('back') back: ElementRef;

  displayedFc?: Flashcard;
  revealed: boolean;
  allFcs: Flashcard[] = [];
  currentDueFcsQueue: Flashcard[] = [];
  fcQueues: [string, Flashcard[]][];
  dueFcQueues: Map<string, Flashcard[]>;
  numDueFcs: Map<string, number>;
  selectedQueue = DUE_FCS_QUEUE_NAME;

  private sub: Subscription;

  constructor(
      private readonly flashcardService: FlashcardService,
      private readonly subviewManager: SubviewManagerService,
      private sanitizer: DomSanitizer,
      private dialog: MatDialog,
      private cdr: ChangeDetectorRef) {}

  ngAfterViewInit() {
    this.sub = this.flashcardService.flashcards.subscribe(fcs => {
      if (!fcs) {
        return;
      }
      this.dueFcQueues = this.getQueueToDueFcs(fcs);
      this.allFcs = fcs;
      this.queueChanged();
      // Present first note automatically
      this.setNextFlashcard();
      // Tell angular things have changed to prevent ExpressionChangedAfter... error in tests
      this.cdr.detectChanges();
    });
  }

  queueChanged() {
    this.currentDueFcsQueue = this.dueFcQueues.get(this.selectedQueue);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  reveal() {
    this.revealed = true;
  }

  setNextFlashcard() {
    this.revealed = false;
    // TODO: if FC is in two queues we might mess up here, it needs to be removed from both
    this.currentDueFcsQueue = this.dueFcQueues.get(this.selectedQueue);
    if (this.currentDueFcsQueue.length === 0) {
      this.displayedFc = undefined;
      return;
    }
    this.displayedFc = this.currentDueFcsQueue[0];
    this.setRenderedContents(this.displayedFc);
  }

  submitRating(rating: number, fc: Flashcard) {
    this.flashcardService.submitFlashcardRating(rating, fc);
    this.currentDueFcsQueue = this.currentDueFcsQueue.splice(0, 1);
    if (rating === 0) {
      // If user couldn't remember the card at all it re-enters queue
      this.currentDueFcsQueue.push(fc);
    }
    // Call to setNextFlashcard() is not needed here - note service triggers update
    // on flashcards which propagates to this component.
  }

  closeView() {
    this.subviewManager.closeView('flashcards');
  }

  deleteFlashcard(id: string) {
    const result = window.confirm(`Delete this flashcard?`);
    if (result) {
      this.flashcardService.deleteFlashcard(id);
    }
  }

  editFlashcard(fc: Flashcard) {
    this.dialog.open(FlashcardDialogComponent, {
      position: { top: '10px' },
      data: {
        flashcardToEdit: fc
      } as FlashcardDialogData,
      width: '100%',
      maxHeight: '90vh' /* to enable scrolling on overflow */,
    });
  }

  private setRenderedContents(fc: Flashcard) {
    const side1UnsafeContent = (marked as any)(fc.side1);
    const side1SanitizedContent = this.sanitizer.sanitize(SecurityContext.HTML, side1UnsafeContent);
    this.front.nativeElement.innerHTML = this.sanitizer.sanitize(SecurityContext.HTML, side1SanitizedContent);
    const side2UnsafeContent = (marked as any)(fc.side2);
    const side2SanitizedContent = this.sanitizer.sanitize(SecurityContext.HTML, side2UnsafeContent);
    this.back.nativeElement.innerHTML = this.sanitizer.sanitize(SecurityContext.HTML, side2SanitizedContent);
  }

  private getQueueToDueFcs(fcs: Flashcard[]) {
    const queueToFcs = new Map<string, Flashcard[]>([[ALL_FCS_QUEUE_NAME, []]]);
    const queueToDueFcs = new Map<string, Flashcard[]>();
    const dueFcs: Flashcard[] = [];
    for (const fc of fcs) {
      for (const tag of [ALL_FCS_QUEUE_NAME, ...fc.tags]) {
        if (!queueToFcs.has(tag)) {
          queueToFcs.set(tag, []);
        }
        queueToFcs.get(tag).push(fc);
        if (this.flashcardService.isDue(fc)) {
          if (!queueToDueFcs.has(tag)) {
            queueToDueFcs.set(tag, []);
          }
          queueToDueFcs.get(tag).push(fc);
          dueFcs.push(fc);
        }
      }
    }
    this.fcQueues = [
      [DUE_FCS_QUEUE_NAME, dueFcs],
      ...queueToFcs.entries(),
    ];
    queueToDueFcs.set(DUE_FCS_QUEUE_NAME, dueFcs);
    return queueToDueFcs;
  }
}
